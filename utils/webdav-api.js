// WebDAV API 模块
import { createClient } from 'webdav';
import { getLastSyncTimestamp, updateLastSyncTimestamp, getPendingSyncData, clearPendingSync, addToPendingSync } from './sync-utils.js';
import { encryptData, decryptData, hasEncryptKey } from './encrypt-utils.js';
import { getIncrementalHistory, getBrowserHistory, getAllBrowserHistory } from '../background/history-api.js';

const TOTAL_FILE_NAME = 'browser-history-total.json';
const INCREMENT_PREFIX = 'browser-history-increment-';

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
    
    await client.putFileContents(TOTAL_FILE_NAME, dataToUpload, {
      overwrite: true
    });
    
    await updateLastSyncTimestamp();
    return { success: true, message: '全量同步成功', count: historyData.length };
  } catch (error) {
    return { success: false, message: `全量同步失败：${error.message}` };
  }
}

/**
 * 从 WebDAV 下载历史数据（全量）
 * @returns {Promise<Object>} 下载结果
 */
export async function downloadHistoryFromWebDAV() {
  try {
    const client = await initWebDAVClient();
    
    const exists = await client.exists(TOTAL_FILE_NAME);
    if (!exists) {
      return { success: false, message: 'WebDAV服务器无历史数据', data: [] };
    }
    
    const content = await client.getFileContents(TOTAL_FILE_NAME, { format: 'text' });
    
    let historyData;
    try {
      // 尝试作为加密数据解密
      if (await hasEncryptKey()) {
        historyData = await decryptData(content);
      } else {
        historyData = JSON.parse(content);
      }
    } catch (e) {
      // 解密失败，尝试直接解析JSON
      historyData = JSON.parse(content);
    }
    
    // 缓存到本地
    await chrome.storage.local.set({ cachedHistory: historyData });
    
    return { success: true, message: '下载成功', data: historyData, count: historyData.length };
  } catch (error) {
    return { success: false, message: `下载失败：${error.message}`, data: [] };
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
    const fileName = `${INCREMENT_PREFIX}${timestamp}.json`;
    
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
    const totalExists = await client.exists(TOTAL_FILE_NAME);
    if (totalExists) {
      const totalContent = await client.getFileContents(TOTAL_FILE_NAME, { format: 'text' });
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
      file.basename && file.basename.startsWith(INCREMENT_PREFIX) && file.type === 'file'
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
      await client.putFileContents(TOTAL_FILE_NAME, dataToUpload, { overwrite: true });
    }
    
    return { success: true, message: `合并成功，共${mergedHistory.length}条历史数据`, count: mergedHistory.length };
  } catch (error) {
    return { success: false, message: `合并失败：${error.message}` };
  }
}

/**
 * 测试 WebDAV 连接
 * @returns {Promise<Object>} 测试结果
 */
export async function testWebDAVConnection() {
  try {
    const client = await initWebDAVClient();
    await client.getDirectoryContents('/');
    return { success: true, message: 'WebDAV连接成功' };
  } catch (error) {
    return { success: false, message: `WebDAV连接失败：${error.message}` };
  }
}
