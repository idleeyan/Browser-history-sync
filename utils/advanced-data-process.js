// 高级数据处理模块 - 阶段4功能
// 包含搜索过滤、去重、冲突解决等功能

import { extractDomain, getDateString } from './common.js';

/**
 * 搜索历史记录
 * @param {Array} historyData - 历史数据数组
 * @param {string} keyword - 搜索关键词
 * @param {Object} options - 搜索选项
 * @returns {Array} 搜索结果
 */
export function searchHistory(historyData, keyword, options = {}) {
  if (!keyword || keyword.trim() === '') return historyData;
  
  const { 
    searchIn = ['title', 'url', 'domain'], // 搜索范围
    exactMatch = false, // 是否精确匹配
    caseSensitive = false // 是否区分大小写
  } = options;
  
  const searchTerm = caseSensitive ? keyword : keyword.toLowerCase();
  
  return historyData.filter(item => {
    const title = caseSensitive ? (item.title || '') : (item.title || '').toLowerCase();
    const url = caseSensitive ? item.url : item.url.toLowerCase();
    const domain = caseSensitive ? extractDomain(item.url) : extractDomain(item.url).toLowerCase();
    
    if (exactMatch) {
      if (searchIn.includes('title') && title === searchTerm) return true;
      if (searchIn.includes('url') && url === searchTerm) return true;
      if (searchIn.includes('domain') && domain === searchTerm) return true;
    } else {
      if (searchIn.includes('title') && title.includes(searchTerm)) return true;
      if (searchIn.includes('url') && url.includes(searchTerm)) return true;
      if (searchIn.includes('domain') && domain.includes(searchTerm)) return true;
    }
    
    return false;
  });
}

/**
 * 高级筛选历史记录
 * @param {Array} historyData - 历史数据数组
 * @param {Object} filters - 筛选条件
 * @returns {Array} 筛选结果
 */
export function filterHistory(historyData, filters = {}) {
  const {
    startDate, // 开始日期 YYYY-MM-DD
    endDate, // 结束日期 YYYY-MM-DD
    domains, // 域名数组 ['example.com', 'test.com']
    minVisitCount, // 最小访问次数
    maxVisitCount, // 最大访问次数
    excludeDomains // 排除的域名
  } = filters;
  
  return historyData.filter(item => {
    // 日期筛选
    if (startDate || endDate) {
      const itemDate = getDateString(item.lastVisitTime);
      if (startDate && itemDate < startDate) return false;
      if (endDate && itemDate > endDate) return false;
    }
    
    // 域名筛选
    const domain = extractDomain(item.url);
    if (domains && domains.length > 0 && !domains.includes(domain)) return false;
    if (excludeDomains && excludeDomains.length > 0 && excludeDomains.includes(domain)) return false;
    
    // 访问次数筛选
    const visitCount = item.visitCount || 1;
    if (minVisitCount && visitCount < minVisitCount) return false;
    if (maxVisitCount && visitCount > maxVisitCount) return false;
    
    return true;
  });
}

/**
 * 去除重复的历史记录
 * @param {Array} historyData - 历史数据数组
 * @param {string} strategy - 去重策略：'url' | 'title' | 'url+title'
 * @returns {Array} 去重后的数据
 */
export function deduplicateHistory(historyData, strategy = 'url') {
  const seen = new Map();
  
  return historyData.filter(item => {
    let key;
    switch (strategy) {
      case 'url':
        key = item.url;
        break;
      case 'title':
        key = item.title || item.url;
        break;
      case 'url+title':
        key = `${item.url}::${item.title || ''}`;
        break;
      default:
        key = item.url;
    }
    
    if (seen.has(key)) {
      // 保留访问时间最新的记录
      const existing = seen.get(key);
      if (item.lastVisitTime > existing.lastVisitTime) {
        seen.set(key, item);
        return true;
      }
      return false;
    }
    
    seen.set(key, item);
    return true;
  });
}

/**
 * 智能冲突解决
 * 当多个设备的历史记录冲突时，自动选择最佳版本
 * @param {Array} localData - 本地数据
 * @param {Array} remoteData - 远程数据
 * @param {string} strategy - 解决策略
 * @returns {Array} 合并后的数据
 */
export function resolveConflicts(localData, remoteData, strategy = 'smart') {
  const merged = new Map();
  
  // 先添加本地数据
  localData.forEach(item => {
    merged.set(item.id || item.url, { ...item, source: 'local' });
  });
  
  // 处理远程数据
  remoteData.forEach(item => {
    const key = item.id || item.url;
    
    if (merged.has(key)) {
      const local = merged.get(key);
      const remote = { ...item, source: 'remote' };
      
      let winner;
      switch (strategy) {
        case 'local':
          winner = local;
          break;
        case 'remote':
          winner = remote;
          break;
        case 'latest':
          winner = local.lastVisitTime > remote.lastVisitTime ? local : remote;
          break;
        case 'maxVisits':
          winner = (local.visitCount || 0) > (remote.visitCount || 0) ? local : remote;
          break;
        case 'smart':
        default:
          // 智能策略：优先选择访问次数多的，如果相同则选择最新的
          const localVisits = local.visitCount || 0;
          const remoteVisits = remote.visitCount || 0;
          if (localVisits !== remoteVisits) {
            winner = localVisits > remoteVisits ? local : remote;
          } else {
            winner = local.lastVisitTime > remote.lastVisitTime ? local : remote;
          }
          break;
      }
      
      // 合并访问次数
      if (winner === local && remote.visitCount) {
        winner.visitCount = Math.max(local.visitCount || 0, remote.visitCount || 0);
      }
      
      merged.set(key, winner);
    } else {
      merged.set(key, { ...item, source: 'remote' });
    }
  });
  
  return Array.from(merged.values());
}

/**
 * 导出为CSV格式
 * @param {Array} historyData - 历史数据
 * @returns {string} CSV内容
 */
export function exportToCSV(historyData) {
  const headers = ['标题', 'URL', '域名', '访问时间', '访问次数'];
  const rows = historyData.map(item => [
    `"${(item.title || '').replace(/"/g, '""')}"`,
    `"${item.url}"`,
    `"${extractDomain(item.url)}"`,
    `"${new Date(item.lastVisitTime).toLocaleString('zh-CN')}"`,
    item.visitCount || 1
  ]);
  
  return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
}

/**
 * 导出为HTML格式
 * @param {Array} historyData - 历史数据
 * @param {Object} stats - 统计数据
 * @returns {string} HTML内容
 */
export function exportToHTML(historyData, stats) {
  const rows = historyData.map(item => `
    <tr>
      <td>${escapeHtml(item.title || '无标题')}</td>
      <td><a href="${escapeHtml(item.url)}" target="_blank">${escapeHtml(item.url)}</a></td>
      <td>${escapeHtml(extractDomain(item.url))}</td>
      <td>${new Date(item.lastVisitTime).toLocaleString('zh-CN')}</td>
      <td>${item.visitCount || 1}</td>
    </tr>
  `).join('');
  
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>浏览历史报告 - ${new Date().toLocaleDateString('zh-CN')}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    h1 { color: #333; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
    .stat-box { background: #f8fafc; padding: 15px; border-radius: 6px; border-left: 4px solid #3b82f6; }
    .stat-label { color: #64748b; font-size: 14px; }
    .stat-value { color: #1e293b; font-size: 24px; font-weight: bold; margin-top: 5px; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th { background: #f1f5f9; text-align: left; padding: 12px; font-weight: 600; color: #475569; border-bottom: 2px solid #e2e8f0; }
    td { padding: 12px; border-bottom: 1px solid #e2e8f0; color: #334155; }
    tr:hover { background: #f8fafc; }
    a { color: #3b82f6; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .footer { margin-top: 30px; text-align: center; color: #94a3b8; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>浏览历史报告</h1>
    <p>生成时间：${new Date().toLocaleString('zh-CN')}</p>
    
    <div class="summary">
      <div class="stat-box">
        <div class="stat-label">总访问次数</div>
        <div class="stat-value">${stats?.totalCount || historyData.length}</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">独立域名</div>
        <div class="stat-value">${stats?.uniqueDomains || 'N/A'}</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">日均访问</div>
        <div class="stat-value">${stats?.averagePerDay || 'N/A'}</div>
      </div>
    </div>
    
    <table>
      <thead>
        <tr>
          <th>标题</th>
          <th>URL</th>
          <th>域名</th>
          <th>访问时间</th>
          <th>访问次数</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
    
    <div class="footer">
      由 WebDAV历史同步扩展生成
    </div>
  </div>
</body>
</html>`;
}

/**
 * HTML转义
 * @param {string} text 
 * @returns {string}
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * 清理旧数据
 * @param {Array} historyData - 历史数据
 * @param {number} keepDays - 保留天数
 * @returns {Object} { cleaned: 清理后的数据, removed: 被移除的数据 }
 */
export function cleanupOldData(historyData, keepDays = 90) {
  const cutoffTime = Date.now() - keepDays * 24 * 60 * 60 * 1000;
  
  const cleaned = [];
  const removed = [];
  
  historyData.forEach(item => {
    if (item.lastVisitTime >= cutoffTime) {
      cleaned.push(item);
    } else {
      removed.push(item);
    }
  });
  
  return { cleaned, removed, removedCount: removed.length };
}

/**
 * 生成数据摘要
 * @param {Array} historyData 
 * @returns {Object} 数据摘要信息
 */
export function generateDataSummary(historyData) {
  const total = historyData.length;
  const sizeInBytes = new Blob([JSON.stringify(historyData)]).size;
  const domains = new Set(historyData.map(item => extractDomain(item.url))).size;
  
  const timestamps = historyData.map(item => item.lastVisitTime);
  const dateRange = {
    earliest: timestamps.length > 0 ? Math.min(...timestamps) : null,
    latest: timestamps.length > 0 ? Math.max(...timestamps) : null
  };
  
  return {
    totalRecords: total,
    uniqueDomains: domains,
    sizeInBytes,
    sizeFormatted: formatFileSize(sizeInBytes),
    dateRange,
    averageRecordSize: total > 0 ? Math.round(sizeInBytes / total) : 0
  };
}

/**
 * 格式化文件大小
 * @param {number} bytes 
 * @returns {string}
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
