// 操作日志模块 - 记录所有重要操作

const LOG_KEY = 'operationLogs';
const MAX_LOGS = 1000; // 最大保留日志条数

/**
 * 日志级别
 */
export const LogLevel = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error'
};

/**
 * 操作类型
 */
export const OperationType = {
  SYNC_UPLOAD: 'sync_upload',
  SYNC_DOWNLOAD: 'sync_download',
  CONFIG_UPDATE: 'config_update',
  EXPORT: 'export',
  IMPORT: 'import',
  CLEANUP: 'cleanup',
  BACKUP: 'backup',
  RESTORE: 'restore',
  DEDUPLICATE: 'deduplicate',
  ERROR: 'error'
};

/**
 * 添加日志
 * @param {string} type - 操作类型
 * @param {string} message - 日志消息
 * @param {Object} details - 详细信息
 * @param {string} level - 日志级别
 */
export async function addLog(type, message, details = {}, level = LogLevel.INFO) {
  try {
    const log = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      timestamp: Date.now(),
      type,
      level,
      message,
      details
    };
    
    // 获取现有日志
    const data = await chrome.storage.local.get([LOG_KEY]);
    const logs = data[LOG_KEY] || [];
    
    // 添加新日志
    logs.unshift(log);
    
    // 限制日志数量
    if (logs.length > MAX_LOGS) {
      logs.length = MAX_LOGS;
    }
    
    // 保存
    await chrome.storage.local.set({ [LOG_KEY]: logs });
    
    // 同时在控制台输出
    console.log(`[${type}] ${message}`, details);
    
    return log;
  } catch (error) {
    console.error('添加日志失败:', error);
    return null;
  }
}

/**
 * 获取日志
 * @param {Object} filters - 筛选条件
 * @param {number} limit - 限制条数
 * @returns {Promise<Array>}
 */
export async function getLogs(filters = {}, limit = 100) {
  try {
    const data = await chrome.storage.local.get([LOG_KEY]);
    let logs = data[LOG_KEY] || [];
    
    // 筛选
    if (filters.type) {
      logs = logs.filter(log => log.type === filters.type);
    }
    if (filters.level) {
      logs = logs.filter(log => log.level === filters.level);
    }
    if (filters.startTime) {
      logs = logs.filter(log => log.timestamp >= filters.startTime);
    }
    if (filters.endTime) {
      logs = logs.filter(log => log.timestamp <= filters.endTime);
    }
    
    // 限制条数
    return logs.slice(0, limit);
  } catch (error) {
    console.error('获取日志失败:', error);
    return [];
  }
}

/**
 * 清空日志
 */
export async function clearLogs() {
  try {
    await chrome.storage.local.remove([LOG_KEY]);
    await addLog(OperationType.CLEANUP, '日志已清空', {}, LogLevel.INFO);
    return true;
  } catch (error) {
    console.error('清空日志失败:', error);
    return false;
  }
}

/**
 * 导出日志
 * @returns {Promise<string>}
 */
export async function exportLogs() {
  try {
    const logs = await getLogs({}, MAX_LOGS);
    return JSON.stringify(logs, null, 2);
  } catch (error) {
    console.error('导出日志失败:', error);
    return '';
  }
}

/**
 * 获取统计信息
 * @returns {Promise<Object>}
 */
export async function getLogStats() {
  try {
    const logs = await getLogs({}, MAX_LOGS);
    
    const stats = {
      total: logs.length,
      byType: {},
      byLevel: {},
      recentErrors: logs.filter(log => log.level === LogLevel.ERROR).slice(0, 10)
    };
    
    logs.forEach(log => {
      stats.byType[log.type] = (stats.byType[log.type] || 0) + 1;
      stats.byLevel[log.level] = (stats.byLevel[log.level] || 0) + 1;
    });
    
    return stats;
  } catch (error) {
    console.error('获取日志统计失败:', error);
    return { total: 0, byType: {}, byLevel: {}, recentErrors: [] };
  }
}

// 便捷的日志记录函数
export const logSync = (message, details = {}) => addLog(OperationType.SYNC_UPLOAD, message, details);
export const logDownload = (message, details = {}) => addLog(OperationType.SYNC_DOWNLOAD, message, details);
export const logConfig = (message, details = {}) => addLog(OperationType.CONFIG_UPDATE, message, details);
export const logExport = (message, details = {}) => addLog(OperationType.EXPORT, message, details);
export const logError = (message, error = {}) => addLog(OperationType.ERROR, message, { error: error.message || error }, LogLevel.ERROR);
