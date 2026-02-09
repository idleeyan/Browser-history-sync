// 数据预处理模块 - 用于可视化报告
import { extractDomain, getDateString, getHour } from './common.js';

/**
 * 分析历史数据并生成统计数据
 * @param {Array} historyData - 历史数据数组
 * @returns {Object} 统计结果对象
 */
export function analyzeHistoryData(historyData) {
  if (!Array.isArray(historyData) || historyData.length === 0) {
    return {
      totalCount: 0,
      uniqueDomains: 0,
      dateRange: { start: null, end: null },
      domainStats: [],
      hourlyDistribution: new Array(24).fill(0),
      dailyTrend: [],
      topWebsites: []
    };
  }

  // 基础统计
  const totalCount = historyData.length;
  
  // 日期范围
  const timestamps = historyData.map(item => item.lastVisitTime);
  const dateRange = {
    start: Math.min(...timestamps),
    end: Math.max(...timestamps)
  };

  // 域名统计
  const domainMap = new Map();
  historyData.forEach(item => {
    const domain = extractDomain(item.url);
    if (!domainMap.has(domain)) {
      domainMap.set(domain, {
        domain,
        count: 0,
        urls: new Set(),
        lastVisit: 0
      });
    }
    const stats = domainMap.get(domain);
    stats.count++;
    stats.urls.add(item.url);
    if (item.lastVisitTime > stats.lastVisit) {
      stats.lastVisit = item.lastVisitTime;
    }
  });

  // 转换为数组并排序
  const domainStats = Array.from(domainMap.values())
    .map(stats => ({
      domain: stats.domain,
      count: stats.count,
      uniqueUrls: stats.urls.size,
      lastVisit: stats.lastVisit,
      percentage: ((stats.count / totalCount) * 100).toFixed(1)
    }))
    .sort((a, b) => b.count - a.count);

  // 时段分布（24小时）
  const hourlyDistribution = new Array(24).fill(0);
  historyData.forEach(item => {
    const hour = getHour(item.lastVisitTime);
    hourlyDistribution[hour]++;
  });

  // 每日趋势
  const dailyMap = new Map();
  historyData.forEach(item => {
    const date = getDateString(item.lastVisitTime);
    if (!dailyMap.has(date)) {
      dailyMap.set(date, { date, count: 0 });
    }
    dailyMap.get(date).count++;
  });
  
  const dailyTrend = Array.from(dailyMap.values())
    .sort((a, b) => a.date.localeCompare(b.date));

  // TOP10 网站
  const topWebsites = domainStats.slice(0, 10);

  return {
    totalCount,
    uniqueDomains: domainStats.length,
    dateRange,
    domainStats,
    hourlyDistribution,
    dailyTrend,
    topWebsites
  };
}

/**
 * 按时间范围筛选历史数据
 * @param {Array} historyData - 历史数据数组
 * @param {number} days - 天数（最近N天）
 * @returns {Array} 筛选后的数据
 */
export function filterByTimeRange(historyData, days) {
  const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;
  return historyData.filter(item => item.lastVisitTime >= cutoffTime);
}

/**
 * 按自定义日期范围筛选
 * @param {Array} historyData - 历史数据数组
 * @param {string} startDate - 开始日期（YYYY-MM-DD）
 * @param {string} endDate - 结束日期（YYYY-MM-DD）
 * @returns {Array} 筛选后的数据
 */
export function filterByDateRange(historyData, startDate, endDate) {
  const start = new Date(startDate + 'T00:00:00').getTime();
  const end = new Date(endDate + 'T23:59:59').getTime();
  
  return historyData.filter(item => 
    item.lastVisitTime >= start && item.lastVisitTime <= end
  );
}

/**
 * 生成图表数据格式
 * @param {Object} stats - 统计数据
 * @returns {Object} 图表数据
 */
export function generateChartData(stats) {
  // 域名分布饼图数据
  const domainPieData = {
    labels: stats.domainStats.slice(0, 10).map(d => d.domain),
    datasets: [{
      data: stats.domainStats.slice(0, 10).map(d => d.count),
      backgroundColor: generateColors(10)
    }]
  };

  // 时段分布柱状图数据
  const hourlyBarData = {
    labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
    datasets: [{
      label: '访问次数',
      data: stats.hourlyDistribution,
      backgroundColor: 'rgba(59, 130, 246, 0.6)',
      borderColor: 'rgba(59, 130, 246, 1)',
      borderWidth: 1
    }]
  };

  // 每日趋势折线图数据
  const dailyLineData = {
    labels: stats.dailyTrend.map(d => d.date),
    datasets: [{
      label: '每日访问数',
      data: stats.dailyTrend.map(d => d.count),
      borderColor: 'rgba(16, 185, 129, 1)',
      backgroundColor: 'rgba(16, 185, 129, 0.1)',
      tension: 0.4,
      fill: true
    }]
  };

  // TOP10 网站柱状图数据
  const topSitesBarData = {
    labels: stats.topWebsites.map(w => w.domain.length > 15 ? w.domain.substring(0, 15) + '...' : w.domain),
    datasets: [{
      label: '访问次数',
      data: stats.topWebsites.map(w => w.count),
      backgroundColor: generateColors(stats.topWebsites.length)
    }]
  };

  return {
    domainPie: domainPieData,
    hourlyBar: hourlyBarData,
    dailyLine: dailyLineData,
    topSitesBar: topSitesBarData
  };
}

/**
 * 生成颜色数组
 * @param {number} count - 颜色数量
 * @returns {Array} 颜色数组
 */
function generateColors(count) {
  const baseColors = [
    '#3B82F6', // blue
    '#10B981', // green
    '#F59E0B', // yellow
    '#EF4444', // red
    '#8B5CF6', // purple
    '#EC4899', // pink
    '#06B6D4', // cyan
    '#84CC16', // lime
    '#F97316', // orange
    '#6366F1', // indigo
  ];
  
  const colors = [];
  for (let i = 0; i < count; i++) {
    colors.push(baseColors[i % baseColors.length]);
  }
  return colors;
}

/**
 * 导出数据为JSON格式
 * @param {Object} stats - 统计数据
 * @returns {string} JSON字符串
 */
export function exportToJSON(stats) {
  const exportData = {
    exportTime: new Date().toISOString(),
    summary: {
      totalCount: stats.totalCount,
      uniqueDomains: stats.uniqueDomains,
      dateRange: stats.dateRange
    },
    domainStats: stats.domainStats,
    hourlyDistribution: stats.hourlyDistribution.map((count, hour) => ({ hour, count })),
    dailyTrend: stats.dailyTrend,
    topWebsites: stats.topWebsites
  };
  
  return JSON.stringify(exportData, null, 2);
}

/**
 * 计算统计数据摘要
 * @param {Object} stats - 统计数据
 * @returns {Object} 摘要信息
 */
export function getSummary(stats) {
  if (stats.totalCount === 0) {
    return {
      averagePerDay: 0,
      mostActiveHour: null,
      mostActiveHourCount: 0,
      mostVisitedDomain: null,
      mostVisitedDomainCount: 0
    };
  }

  // 计算日均访问量
  const days = stats.dailyTrend.length || 1;
  const averagePerDay = (stats.totalCount / days).toFixed(1);

  // 最活跃时段
  let maxHourCount = 0;
  let maxHour = 0;
  stats.hourlyDistribution.forEach((count, hour) => {
    if (count > maxHourCount) {
      maxHourCount = count;
      maxHour = hour;
    }
  });

  // 最常访问域名
  const mostVisited = stats.domainStats[0] || { domain: null, count: 0 };

  return {
    averagePerDay,
    mostActiveHour: maxHour,
    mostActiveHourCount: maxHourCount,
    mostVisitedDomain: mostVisited.domain,
    mostVisitedDomainCount: mostVisited.count,
    totalDays: days
  };
}
