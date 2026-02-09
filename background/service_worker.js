// Service Worker - 后台脚本主入口
import { getBrowserHistory, getIncrementalHistory, getAllBrowserHistory } from './history-api.js';
import { 
  uploadHistoryToWebDAV, 
  downloadHistoryFromWebDAV, 
  uploadIncrementalHistory,
  downloadAndMergeHistory,
  testWebDAVConnection 
} from '../utils/webdav-api.js';
import { getSyncConfig, updateLastSyncTimestamp } from '../utils/sync-utils.js';

// 初始化扩展
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('WebDAV历史同步扩展已安装/更新', details);
  
  // 初始化默认配置
  const defaultConfig = {
    syncEnabled: true,
    syncFrequency: 3600000, // 1小时
    encryptEnabled: true,
    lastSyncTimestamp: 0
  };
  
  const existingConfig = await chrome.storage.local.get(Object.keys(defaultConfig));
  const configToSet = {};
  
  for (const [key, value] of Object.entries(defaultConfig)) {
    if (existingConfig[key] === undefined) {
      configToSet[key] = value;
    }
  }
  
  if (Object.keys(configToSet).length > 0) {
    await chrome.storage.local.set(configToSet);
    console.log('默认配置已初始化', configToSet);
  }
  
  // 初始化定时同步
  await initScheduledSync();
});

// 监听启动事件（浏览器启动时）
chrome.runtime.onStartup.addListener(async () => {
  console.log('浏览器启动，初始化定时同步');
  await initScheduledSync();
});

// 消息处理中心
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('收到消息:', request.action);
  
  // 使用异步处理
  const handleMessage = async () => {
    try {
      switch (request.action) {
        case 'fullSyncToWebDAV':
          const historyData = request.historyData || await getBrowserHistory(0, 1000000);
          return await uploadHistoryToWebDAV(historyData);
          
        case 'fullSyncFromWebDAV':
          return await downloadHistoryFromWebDAV();
          
        case 'incrementalSyncToWebDAV':
          return await uploadIncrementalHistory();
          
        case 'downloadAndMerge':
          return await downloadAndMergeHistory();
          
        case 'testWebDAVConnection':
          return await testWebDAVConnection();
          
        case 'getBrowserHistory':
          console.log('getBrowserHistory called with days:', request.days, 'maxResults:', request.maxResults);
          let resultData;
          const maxResults = request.maxResults || 500000;
          
          if (request.days === 'all' || request.days === 0) {
            console.log('Using getAllBrowserHistory() with maxResults:', maxResults);
            resultData = await getAllBrowserHistory(maxResults);
          } else {
            console.log('Using getBrowserHistory() with days:', request.days, 'maxResults:', maxResults);
            resultData = await getBrowserHistory(request.days || 0, maxResults);
          }
          console.log('Returning', resultData.length, 'history items');
          return { success: true, data: resultData };
          
        case 'getCachedHistory':
          const cached = await chrome.storage.local.get(['cachedHistory']);
          return { success: true, data: cached.cachedHistory || [] };
          
        case 'getSyncStatus':
          const lastSync = await chrome.storage.local.get(['lastSyncTimestamp']);
          const pending = await chrome.storage.local.get(['pendingSyncData']);
          return { 
            success: true, 
            lastSyncTime: lastSync.lastSyncTimestamp || 0,
            pendingCount: (pending.pendingSyncData || []).length
          };
          
        case 'initScheduledSync':
          await initScheduledSync();
          return { success: true, message: '定时同步已初始化' };
          
        default:
          return { success: false, message: '未知操作类型' };
      }
    } catch (error) {
      console.error('消息处理错误:', error);
      return { success: false, message: error.message };
    }
  };
  
  // 异步处理并返回结果
  handleMessage().then(sendResponse);
  return true; // 保持消息通道开放
});

// 初始化定时同步
async function initScheduledSync() {
  try {
    const config = await getSyncConfig();
    
    if (!config.syncEnabled) {
      console.log('同步功能已禁用');
      await chrome.alarms.clearAll();
      return;
    }
    
    // 清除已有闹钟
    await chrome.alarms.clearAll();
    
    // 创建新闹钟（最小1分钟）
    const periodInMinutes = Math.max(1, Math.floor(config.syncFrequency / 60000));
    
    await chrome.alarms.create('scheduledSync', {
      periodInMinutes: periodInMinutes
    });
    
    console.log(`定时同步已设置，频率：${periodInMinutes}分钟`);
  } catch (error) {
    console.error('初始化定时同步失败:', error);
  }
}

// 监听闹钟触发
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'scheduledSync') {
    console.log('定时同步触发');
    try {
      const config = await getSyncConfig();
      if (config.syncEnabled) {
        const result = await uploadIncrementalHistory();
        console.log('定时同步结果:', result);
      }
    } catch (error) {
      console.error('定时同步失败:', error);
    }
  }
});

// 监听存储变化（配置更新时重新初始化定时同步）
chrome.storage.onChanged.addListener(async (changes, namespace) => {
  if (namespace === 'local' && (changes.syncFrequency || changes.syncEnabled)) {
    console.log('同步配置已更新，重新初始化定时同步');
    await initScheduledSync();
  }
});

console.log('Service Worker 已加载');
