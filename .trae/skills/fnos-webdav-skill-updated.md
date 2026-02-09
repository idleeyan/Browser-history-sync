---
name: fnos-webdav
description: 飞牛NAS WebDAV服务集成指南。用于浏览器扩展、Web应用与飞牛NAS的WebDAV服务进行数据同步。处理飞牛NAS特有的路径格式、认证方式、上传下载逻辑。适用于需要与飞牛NAS进行文件同步的场景，包括浏览器新标签页扩展、书签同步、配置备份等。
---

# 飞牛NAS WebDAV服务

## 概述

飞牛NAS（FnOS）的WebDAV服务有一些特殊之处，需要特定的处理方式才能正常工作。本技能提供了与飞牛NAS WebDAV服务集成的完整解决方案。

## 飞牛NAS WebDAV特性

### 1. 路径格式

飞牛NAS的WebDAV路径有以下特点：
- 实际存储路径通常包含 `/vol1/1000/` 前缀
- 用户目录通过用户名访问，如 `/idleeyan/`
- 需要尝试多种路径格式才能找到正确的文件位置

**需要尝试的路径格式：**
```javascript
const pathsToTry = [
  `${syncPath}${filename}`,                    // /idleeyan/newtab-sync/data.json
  `${syncPath}${filename}`.replace(/\/$/, ''), // 移除末尾斜杠
  `/vol1/1000${syncPath}${filename}`,          // 飞牛NAS完整路径
  `${syncPath.replace(/\/idleeyan\//, '/')}${filename}`, // 移除用户名
];
```

### 2. 支持的HTTP方法

飞牛NAS WebDAV支持的方法：
- `GET` - 下载文件
- `PUT` - 上传文件
- `POST` - 备选上传方式
- `PROPFIND` - 查询文件/目录信息
- `MKCOL` - 创建目录（可能返回405）
- `HEAD` - 获取文件元数据

**注意：** 某些方法可能返回405（Method Not Allowed），需要有备选方案。

### 3. 认证方式

使用Basic认证：
```javascript
const credentials = btoa(`${username}:${password}`);
const headers = {
  'Authorization': `Basic ${credentials}`
};
```

### 4. 响应特点

- 404 Not Found - 文件不存在
- 403 Forbidden - 权限不足或路径错误
- 405 Method Not Allowed - 方法不被允许（如MKCOL）
- 401 Unauthorized - 认证失败

## 核心实现

### WebDAV客户端类

```javascript
class WebDAVClient {
  constructor(config) {
    this.serverUrl = config.serverUrl;
    this.username = config.username;
    this.password = config.password;
    this.syncPath = config.syncPath || '/newtab-sync/';
    this.filename = config.filename || 'data.json';
  }

  async sendRequest(method, path = '', data = null) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
        action: 'webdav',
        config: {
          serverUrl: this.serverUrl,
          username: this.username,
          password: this.password
        },
        method: method,
        path: path,
        data: data
      }, (result) => {
        resolve(result);
      });
    });
  }
}
```

### 上传数据（带多种路径尝试）

```javascript
async uploadData(data) {
  const syncData = {
    version: '1.0',
    timestamp: Date.now(),
    device: navigator.userAgent,
    data: data
  };

  // 尝试多种路径格式
  const pathsToTry = [
    `${this.syncPath}${this.filename}`,
    `${this.syncPath}${this.filename}`.replace(/\/$/, ''),
    `/vol1/1000${this.syncPath}${this.filename}`,
    `${this.syncPath.replace(/\/idleeyan\//, '/')}${this.filename}`,
  ];

  for (const filePath of pathsToTry) {
    try {
      // 先尝试PUT
      let result = await Promise.race([
        this.sendRequest('PUT', filePath, syncData),
        new Promise((_, reject) => setTimeout(() => reject(new Error('PUT超时')), 10000))
      ]);

      if (result.success) return true;

      // PUT失败，尝试POST
      if (result.status === 403 || result.status === 405) {
        result = await Promise.race([
          this.sendRequest('POST', filePath, syncData),
          new Promise((_, reject) => setTimeout(() => reject(new Error('POST超时')), 10000))
        ]);
        if (result.success) return true;
      }
    } catch (error) {
      console.log('上传请求失败或超时', filePath, error.message);
    }
  }
  return false;
}
```

### 下载数据（带多种路径尝试）

```javascript
async downloadData() {
  const pathsToTry = [
    `${this.syncPath}${this.filename}`,
    `${this.syncPath}${this.filename}`.replace(/\/$/, ''),
    `/vol1/1000${this.syncPath}${this.filename}`,
    `${this.syncPath.replace(/\/idleeyan\//, '/')}${this.filename}`,
  ];

  for (const filePath of pathsToTry) {
    try {
      const result = await Promise.race([
        this.sendRequest('GET', filePath),
        new Promise((_, reject) => setTimeout(() => reject(new Error('GET超时')), 10000))
      ]);

      if (result.success) {
        const syncData = JSON.parse(result.data);
        return {
          success: true,
          data: syncData.data,
          timestamp: syncData.timestamp
        };
      }
    } catch (error) {
      console.log('下载请求失败或超时', filePath, error.message);
    }
  }
  return { success: false, error: '服务器上没有同步数据' };
}
```

### 后台请求处理（background.js）

```javascript
async function handleWebDAVRequest(request) {
  const { config, method, path = '', data = null } = request;
  const { serverUrl, username, password } = config;

  const baseUrl = serverUrl.replace(/\/$/, '');
  const fullPath = path.startsWith('/') ? path : '/' + path;
  const url = baseUrl + fullPath;

  const credentials = btoa(`${username}:${password}`);
  const headers = {
    'Authorization': `Basic ${credentials}`
  };

  if (method === 'PROPFIND') {
    headers['Depth'] = '0';
    headers['Content-Type'] = 'text/xml; charset=utf-8';
  }

  if (method === 'PUT' || method === 'POST') {
    headers['Content-Type'] = 'application/json';
    headers['Accept'] = '*/*';
  }

  try {
    const fetchOptions = {
      method: method,
      headers: headers,
      signal: AbortSignal.timeout(10000)
    };

    if (data && (method === 'PUT' || method === 'POST')) {
      fetchOptions.body = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    }

    const response = await fetch(url, fetchOptions);

    if (method === 'GET') {
      const responseData = await response.text();
      return {
        success: response.ok,
        status: response.status,
        data: responseData
      };
    } else if (method === 'HEAD') {
      return {
        success: response.ok,
        status: response.status,
        headers: {
          'last-modified': response.headers.get('last-modified'),
          'content-length': response.headers.get('content-length')
        }
      };
    } else {
      return {
        success: response.ok || response.status === 201 || response.status === 204,
        status: response.status,
        statusText: response.statusText
      };
    }
  } catch (error) {
    console.error('WebDAV请求失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
```

## 浏览器扩展集成方案

### 基于 webdav 库的实现

#### 1. 核心模块设计

```javascript
// WebDAV API 模块
import { createClient } from 'webdav';

/**
 * 初始化 WebDAV 客户端
 * @returns {Promise<Object>} WebDAV 客户端实例
 */
export async function initWebDAVClient() {
  const config = await chrome.storage.local.get(['webdavUrl', 'webdavUsername', 'webdavPassword']);
  
  if (!config.webdavUrl || !config.webdavUsername || !config.webdavPassword) {
    throw new Error('WebDAV配置未完善，请先在配置页填写');
  }
  
  return createClient(config.webdavUrl, {
    username: config.webdavUsername,
    password: config.webdavPassword
  });
}

/**
 * 全量上传历史数据到 WebDAV
 * @param {Array} historyData - 历史数据数组
 * @returns {Promise<Object>} 上传结果
 */
export async function uploadHistoryToWebDAV(historyData) {
  try {
    const client = await initWebDAVClient();
    
    let dataToUpload;
    if (await hasEncryptKey()) {
      dataToUpload = await encryptData(historyData);
    } else {
      dataToUpload = JSON.stringify(historyData, null, 2);
    }
    
    await client.putFileContents('browser-history-total.json', dataToUpload, {
      overwrite: true
    });
    
    await updateLastSyncTimestamp();
    return { success: true, message: '全量同步成功', count: historyData.length };
  } catch (error) {
    return { success: false, message: `全量同步失败：${error.message}` };
  }
}

/**
 * 增量上传历史数据到 WebDAV
 * @returns {Promise<Object>} 上传结果
 */
export async function uploadIncrementalHistory() {
  try {
    // 先检查是否有待同步的缓存数据
    const pendingData = await getPendingSyncData();
    let incrementalHistory;
    
    if (pendingData.length > 0) {
      incrementalHistory = pendingData;
    } else {
      incrementalHistory = await getIncrementalHistory();
    }
    
    if (incrementalHistory.length === 0) {
      return { success: true, message: '无新增历史数据，无需同步' };
    }
    
    const client = await initWebDAVClient();
    
    let dataToUpload;
    if (await hasEncryptKey()) {
      dataToUpload = await encryptData(incrementalHistory);
    } else {
      dataToUpload = JSON.stringify(incrementalHistory, null, 2);
    }
    
    const timestamp = Date.now();
    const fileName = `browser-history-increment-${timestamp}.json`;
    
    await client.putFileContents(fileName, dataToUpload, { overwrite: true });
    
    await updateLastSyncTimestamp();
    await clearPendingSync(); // 清空待同步缓存
    
    return { success: true, message: `增量同步成功，新增${incrementalHistory.length}条数据`, count: incrementalHistory.length };
  } catch (error) {
    // 同步失败，缓存数据到本地
    const incrementalHistory = await getIncrementalHistory();
    if (incrementalHistory.length > 0) {
      await addToPendingSync(incrementalHistory);
    }
    return { success: false, message: `增量同步失败：${error.message}` };
  }
}

/**
 * 从 WebDAV 下载并合并历史数据
 * @returns {Promise<Object>} 合并结果
 */
export async function downloadAndMergeHistory() {
  try {
    const client = await initWebDAVClient();
    
    // 1. 下载总文件
    let mergedHistory = [];
    const totalExists = await client.exists('browser-history-total.json');
    if (totalExists) {
      const totalContent = await client.getFileContents('browser-history-total.json', { format: 'text' });
      try {
        if (await hasEncryptKey()) {
          mergedHistory = await decryptData(totalContent);
        } else {
          mergedHistory = JSON.parse(totalContent);
        }
      } catch (e) {
        mergedHistory = JSON.parse(totalContent);
      }
    }
    
    // 2. 列出所有增量文件
    const files = await client.getDirectoryContents('/', { deep: false });
    const incrementalFiles = files.filter(file => 
      file.basename && file.basename.startsWith('browser-history-increment-') && file.type === 'file'
    );
    
    // 3. 下载并合并所有增量文件
    for (const file of incrementalFiles) {
      try {
        const content = await client.getFileContents(file.basename, { format: 'text' });
        let incrementalData;
        
        try {
          if (await hasEncryptKey()) {
            incrementalData = await decryptData(content);
          } else {
            incrementalData = JSON.parse(content);
          }
        } catch (e) {
          incrementalData = JSON.parse(content);
        }
        
        // 去重（根据id字段）
        mergedHistory = [
          ...mergedHistory.filter(item => !incrementalData.some(inc => inc.id === item.id)),
          ...incrementalData
        ];
        
        // 删除已合并的增量文件
        await client.deleteFile(file.basename);
      } catch (fileError) {
        console.error(`处理增量文件失败 ${file.basename}:`, fileError);
      }
    }
    
    // 4. 更新本地缓存
    await chrome.storage.local.set({ cachedHistory: mergedHistory });
    await updateLastSyncTimestamp();
    
    // 5. 更新总文件
    if (incrementalFiles.length > 0) {
      let dataToUpload;
      if (await hasEncryptKey()) {
        dataToUpload = await encryptData(mergedHistory);
      } else {
        dataToUpload = JSON.stringify(mergedHistory, null, 2);
      }
      await client.putFileContents('browser-history-total.json', dataToUpload, { overwrite: true });
    }
    
    return { success: true, message: `合并成功，共${mergedHistory.length}条历史数据`, count: mergedHistory.length };
  } catch (error) {
    return { success: false, message: `合并失败：${error.message}` };
  }
}
```

#### 2. 同步策略设计

- **全量同步**：首次同步或手动触发时使用
- **增量同步**：定时同步时使用，只同步新数据
- **待同步缓存**：网络中断时缓存数据，恢复后自动上传
- **增量文件合并**：定期将多个增量文件合并为总文件

#### 3. 安全加密集成

- **AES加密**：使用crypto-js进行数据加密
- **容错处理**：解密失败时尝试直接解析JSON
- **密钥管理**：从本地存储安全读取加密密钥

## 配置示例

### 飞牛NAS WebDAV配置

```javascript
const webdavConfig = {
  serverUrl: 'http://192.168.31.89:5005',  // 飞牛NAS地址
  username: 'idleeyan',                     // NAS用户名
  password: 'your-password',                // NAS密码
  syncPath: '/idleeyan/newtab-sync/',       // 同步目录
  filename: 'newtab-data.json'              // 同步文件名
};
```

### 浏览器扩展配置

```javascript
// 保存WebDAV配置
await chrome.storage.local.set({
  webdavUrl: 'http://192.168.1.100:5005',
  webdavUsername: 'user',
  webdavPassword: 'password',
  encryptKey: 'your-encryption-key'  // 加密密钥
});
```

### 目录结构

在飞牛NAS上创建目录：
```
/vol1/1000/
  └── idleeyan/
      └── newtab-sync/
          └── newtab-data.json
```

## 常见问题与解决方案

### 1. 405 Method Not Allowed

**原因：** 飞牛NAS可能不支持MKCOL方法或某些路径格式

**解决：** 
- 忽略405错误，继续尝试上传
- 预先在NAS上手动创建目录

### 2. 403 Forbidden

**原因：** 
- 路径格式不正确
- 用户权限不足

**解决：**
- 尝试多种路径格式
- 检查NAS用户权限设置

### 3. 404 Not Found

**原因：** 文件确实不存在或路径错误

**解决：**
- 首次同步时自动上传本地数据
- 尝试不同的路径格式

### 4. 请求超时

**原因：** 网络延迟或服务器响应慢

**解决：**
- 添加请求超时机制（建议10秒）
- 使用Promise.race实现超时控制

### 5. 数据加密/解密失败

**原因：** 
- 密钥不匹配
- 数据损坏

**解决：**
- 确保所有设备使用相同的加密密钥
- 添加容错处理，解密失败时尝试直接解析

## 最佳实践

### 通用WebDAV最佳实践

1. **分层架构设计** - 将WebDAV逻辑与业务逻辑分离，便于维护
2. **增量同步策略** - 减少传输数据量，提高同步速度
3. **数据加密** - 敏感数据传输前加密，保护隐私
4. **错误处理与重试** - 网络不稳定时的容错机制
5. **待同步数据缓存** - 网络中断时保存数据，恢复后自动同步
6. **增量文件管理** - 定期清理已合并的增量文件，节省存储空间
7. **智能去重** - 基于唯一ID的去重逻辑，避免数据重复
8. **容错处理** - 解密失败时尝试备用方案，提高兼容性
9. **批量处理** - 合并多个增量文件时的高效处理
10. **详细日志** - 便于问题定位和调试

### 飞牛NAS特有的最佳实践

1. **尝试多种路径格式** - 飞牛NAS的路径映射可能有多种情况
2. **添加超时机制** - 防止请求无限期挂起（建议10秒）
3. **优雅处理405错误** - 某些方法可能不被支持
4. **使用Promise.race** - 实现可靠的超时控制
5. **预先创建目录** - 避免MKCOL方法不被支持的问题
6. **详细的路径日志** - 便于调试路径映射问题
7. **权限检查** - 确保用户有正确的读写权限
8. **网络环境适配** - 处理局域网和公网访问的差异

## 性能优化建议

1. **批量操作** - 合并多个小文件的上传/下载
2. **压缩数据** - 大数据集传输前压缩
3. **缓存策略** - 合理使用本地缓存，减少重复请求
4. **增量同步** - 只传输变更数据
5. **并行处理** - 多个文件的并行下载/上传
6. **超时控制** - 避免长时间阻塞
7. **错误重试** - 网络错误的自动重试机制
8. **分批处理** - 大文件的分批处理

## 安全考虑

1. **密钥管理** - 加密密钥的安全存储
2. **HTTPS** - 公网访问时使用HTTPS
3. **密码保护** - WebDAV密码的安全处理
4. **权限控制** - 最小权限原则
5. **数据验证** - 输入数据的验证
6. **错误处理** - 避免敏感信息泄露
7. **日志安全** - 日志中避免记录敏感信息
8. **CSP配置** - 浏览器扩展的内容安全策略

## 相关资源

- [references/webdav-client.js](references/webdav-client.js) - 完整的WebDAV客户端实现
- [references/background-handler.js](references/background-handler.js) - 后台请求处理代码
- [scripts/example-usage.js](scripts/example-usage.js) - 使用示例
