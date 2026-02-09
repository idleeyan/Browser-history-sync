// options.js - 配置页面逻辑

document.addEventListener('DOMContentLoaded', async () => {
  // 获取表单元素
  const webdavConfigForm = document.getElementById('webdavConfigForm');
  const encryptConfigForm = document.getElementById('encryptConfigForm');
  const syncConfigForm = document.getElementById('syncConfigForm');
  const testConnectionBtn = document.getElementById('testConnectionBtn');
  const manualUploadBtn = document.getElementById('manualUploadBtn');
  const manualDownloadBtn = document.getElementById('manualDownloadBtn');
  const clearCacheBtn = document.getElementById('clearCacheBtn');
  const resetConfigBtn = document.getElementById('resetConfigBtn');

  // 反馈元素
  const connectionFeedback = document.getElementById('connectionFeedback');
  const encryptFeedback = document.getElementById('encryptFeedback');
  const syncFeedback = document.getElementById('syncFeedback');
  const actionFeedback = document.getElementById('actionFeedback');

  // 显示反馈
  function showFeedback(element, message, type = 'info') {
    element.textContent = message;
    element.className = 'feedback show ' + type;
    
    // 5秒后隐藏
    setTimeout(() => {
      element.classList.remove('show');
    }, 5000);
  }

  // 加载配置
  async function loadConfig() {
    try {
      const config = await chrome.storage.local.get([
        'webdavUrl',
        'webdavUsername',
        'webdavPassword',
        'encryptKey',
        'encryptEnabled',
        'syncEnabled',
        'syncFrequency'
      ]);

      // 填充WebDAV配置
      if (config.webdavUrl) document.getElementById('webdavUrl').value = config.webdavUrl;
      if (config.webdavUsername) document.getElementById('webdavUsername').value = config.webdavUsername;
      if (config.webdavPassword) document.getElementById('webdavPassword').value = config.webdavPassword;

      // 填充加密配置
      if (config.encryptKey) document.getElementById('encryptKey').value = config.encryptKey;
      if (config.encryptEnabled !== undefined) {
        document.getElementById('encryptEnabled').checked = config.encryptEnabled;
      }

      // 填充同步配置
      if (config.syncEnabled !== undefined) {
        document.getElementById('syncEnabled').checked = config.syncEnabled;
      }
      if (config.syncFrequency) {
        document.getElementById('syncFrequency').value = config.syncFrequency.toString();
      }
    } catch (error) {
      console.error('加载配置失败:', error);
      showFeedback(connectionFeedback, '加载配置失败: ' + error.message, 'error');
    }
  }

  // WebDAV配置表单提交
  webdavConfigForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const webdavUrl = document.getElementById('webdavUrl').value.trim();
    const webdavUsername = document.getElementById('webdavUsername').value.trim();
    const webdavPassword = document.getElementById('webdavPassword').value;

    if (!webdavUrl || !webdavUsername || !webdavPassword) {
      showFeedback(connectionFeedback, '请填写所有必填项', 'error');
      return;
    }

    try {
      await chrome.storage.local.set({
        webdavUrl,
        webdavUsername,
        webdavPassword
      });

      showFeedback(connectionFeedback, 'WebDAV配置保存成功！', 'success');
    } catch (error) {
      showFeedback(connectionFeedback, '保存失败: ' + error.message, 'error');
    }
  });

  // 测试连接按钮
  testConnectionBtn.addEventListener('click', async () => {
    showFeedback(connectionFeedback, '正在测试连接...', 'info');
    
    try {
      const result = await chrome.runtime.sendMessage({ action: 'testWebDAVConnection' });
      
      if (result.success) {
        showFeedback(connectionFeedback, result.message, 'success');
      } else {
        showFeedback(connectionFeedback, result.message, 'error');
      }
    } catch (error) {
      showFeedback(connectionFeedback, '测试失败: ' + error.message, 'error');
    }
  });

  // 加密配置表单提交
  encryptConfigForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const encryptEnabled = document.getElementById('encryptEnabled').checked;
    const encryptKey = document.getElementById('encryptKey').value;

    if (encryptEnabled && (!encryptKey || encryptKey.length < 8)) {
      showFeedback(encryptFeedback, '启用加密时，密钥必须至少8位', 'error');
      return;
    }

    try {
      await chrome.storage.local.set({
        encryptEnabled,
        encryptKey: encryptEnabled ? encryptKey : ''
      });

      showFeedback(encryptFeedback, '加密配置保存成功！', 'success');
    } catch (error) {
      showFeedback(encryptFeedback, '保存失败: ' + error.message, 'error');
    }
  });

  // 同步配置表单提交
  syncConfigForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const syncEnabled = document.getElementById('syncEnabled').checked;
    const syncFrequency = parseInt(document.getElementById('syncFrequency').value);

    try {
      await chrome.storage.local.set({
        syncEnabled,
        syncFrequency
      });

      // 重新初始化定时同步
      await chrome.runtime.sendMessage({ action: 'initScheduledSync' });

      showFeedback(syncFeedback, '同步设置保存成功！', 'success');
    } catch (error) {
      showFeedback(syncFeedback, '保存失败: ' + error.message, 'error');
    }
  });

  // 手动上传按钮
  manualUploadBtn.addEventListener('click', async () => {
    showFeedback(actionFeedback, '正在上传...', 'info');
    
    try {
      const result = await chrome.runtime.sendMessage({ action: 'incrementalSyncToWebDAV' });
      
      if (result.success) {
        showFeedback(actionFeedback, result.message, 'success');
      } else {
        showFeedback(actionFeedback, result.message, 'error');
      }
    } catch (error) {
      showFeedback(actionFeedback, '上传失败: ' + error.message, 'error');
    }
  });

  // 手动下载按钮
  manualDownloadBtn.addEventListener('click', async () => {
    showFeedback(actionFeedback, '正在下载...', 'info');
    
    try {
      const result = await chrome.runtime.sendMessage({ action: 'downloadAndMerge' });
      
      if (result.success) {
        showFeedback(actionFeedback, result.message, 'success');
      } else {
        showFeedback(actionFeedback, result.message, 'error');
      }
    } catch (error) {
      showFeedback(actionFeedback, '下载失败: ' + error.message, 'error');
    }
  });

  // 清空缓存按钮
  clearCacheBtn.addEventListener('click', async () => {
    if (!confirm('确定要清空本地缓存的历史数据吗？此操作不可恢复。')) {
      return;
    }

    try {
      await chrome.storage.local.remove(['cachedHistory', 'pendingSyncData', 'lastSyncTimestamp']);
      showFeedback(actionFeedback, '本地缓存已清空', 'success');
    } catch (error) {
      showFeedback(actionFeedback, '清空失败: ' + error.message, 'error');
    }
  });

  // 重置配置按钮
  resetConfigBtn.addEventListener('click', async () => {
    if (!confirm('确定要重置所有配置吗？此操作不可恢复。')) {
      return;
    }

    try {
      await chrome.storage.local.clear();
      showFeedback(actionFeedback, '所有配置已重置，页面将刷新...', 'success');
      
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      showFeedback(actionFeedback, '重置失败: ' + error.message, 'error');
    }
  });

  // 初始化加载配置
  await loadConfig();
});
