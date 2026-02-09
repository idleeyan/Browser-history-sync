// 同步工具函数模块

const LAST_SYNC_KEY = 'lastSyncTimestamp';
const PENDING_SYNC_KEY = 'pendingSyncData';

/**
 * 获取最后同步时间戳
 * @returns {Promise<number>} 时间戳（毫秒）
 */
export async function getLastSyncTimestamp() {
  const data = await chrome.storage.local.get([LAST_SYNC_KEY]);
  return data[LAST_SYNC_KEY] || 0;
}

/**
 * 更新最后同步时间戳
 * @returns {Promise<number>} 当前时间戳
 */
export async function updateLastSyncTimestamp() {
  const currentTime = Date.now();
  await chrome.storage.local.set({ [LAST_SYNC_KEY]: currentTime });
  return currentTime;
}

/**
 * 获取待同步的缓存数据
 * @returns {Promise<Array>} 待同步数据数组
 */
export async function getPendingSyncData() {
  const data = await chrome.storage.local.get([PENDING_SYNC_KEY]);
  return data[PENDING_SYNC_KEY] || [];
}

/**
 * 添加数据到待同步缓存
 * @param {Array} historyData - 历史数据数组
 */
export async function addToPendingSync(historyData) {
  const pendingData = await getPendingSyncData();
  const newPendingData = [...pendingData, ...historyData];
  await chrome.storage.local.set({ [PENDING_SYNC_KEY]: newPendingData });
}

/**
 * 清空待同步缓存
 */
export async function clearPendingSync() {
  await chrome.storage.local.remove([PENDING_SYNC_KEY]);
}

/**
 * 获取同步配置
 * @returns {Promise<Object>} 同步配置对象
 */
export async function getSyncConfig() {
  const data = await chrome.storage.local.get([
    'syncEnabled',
    'syncFrequency',
    'encryptEnabled'
  ]);
  
  return {
    syncEnabled: data.syncEnabled !== false, // 默认启用
    syncFrequency: data.syncFrequency || 3600000, // 默认1小时
    encryptEnabled: data.encryptEnabled !== false // 默认启用加密
  };
}

/**
 * 保存同步配置
 * @param {Object} config - 同步配置
 */
export async function setSyncConfig(config) {
  await chrome.storage.local.set(config);
}
