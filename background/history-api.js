// 浏览历史记录 API 模块
import { formatTimestamp } from '../utils/common.js';
import { getLastSyncTimestamp } from '../utils/sync-utils.js';

// Chrome History API 单次调用限制
const CHROME_HISTORY_BATCH_SIZE = 100000; // Chrome API 最大限制
const DEFAULT_TOTAL_LIMIT = 500000; // 默认获取总量上限（可调整）

/**
 * 获取浏览器历史记录（支持超过100000条）
 * @param {number} days - 查询天数（0表示全部）
 * @param {number} maxResults - 最大结果数（默认无上限或很大，通过分批获取突破限制）
 * @returns {Promise<Array>} 历史记录数组
 */
export async function getBrowserHistory(days = 0, maxResults = DEFAULT_TOTAL_LIMIT) {
  // 始终使用分批获取，以确保获取完整数据并支持超过100000条
  return await getBrowserHistoryBatched(days, maxResults);
  
  const searchOptions = {
    text: '',
    maxResults: maxResults
  };
  
  // 如果指定了天数，添加开始时间
  if (days > 0) {
    searchOptions.startTime = Date.now() - days * 24 * 60 * 60 * 1000;
  }
  
  return new Promise((resolve, reject) => {
    chrome.history.search(searchOptions, (historyItems) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      
      const formattedHistory = historyItems.map(item => ({
        id: item.id,
        url: item.url,
        title: item.title || '无标题',
        lastVisitTime: item.lastVisitTime,
        formattedTime: formatTimestamp(item.lastVisitTime),
        visitCount: item.visitCount || 1
      }));
      
      resolve(formattedHistory);
    });
  });
}

/**
 * 分批获取浏览器历史记录（突破 Chrome API 100000 条限制）
 * 通过时间窗口分段获取，支持获取数十万甚至上百万条历史记录
 * @param {number} days - 查询天数（0表示全部）
 * @param {number} maxResults - 最大结果数（默认 500000，可设置更大值）
 * @returns {Promise<Array>} 历史记录数组
 */
async function getBrowserHistoryBatched(days = 0, maxResults = DEFAULT_TOTAL_LIMIT) {
  const allHistory = new Map(); // 使用 Map 去重
  const now = Date.now();
  
  // 确定查询的时间范围
  let startTime = 0; // 从最早的历史开始
  let endTime = now;
  
  if (days > 0) {
    startTime = now - days * 24 * 60 * 60 * 1000;
  }
  
  // 尝试先获取最早的历史记录时间
  try {
    // 获取一批数据来推断最早时间
    const sampleItems = await searchHistoryChunk(0, now, CHROME_HISTORY_BATCH_SIZE);
    if (sampleItems.length > 0) {
      // 由于API返回的是倒序（最新的在前），最后一条就是这批中最早的
      const earliestInSample = sampleItems[sampleItems.length - 1].lastVisitTime;
      console.log('样本中最早的历史记录时间:', new Date(earliestInSample).toLocaleString());
      console.log('样本数据量:', sampleItems.length, '条');
      
      // 如果样本已经满100000条，说明历史记录很多，需要进一步获取更早的数据
      if (sampleItems.length >= CHROME_HISTORY_BATCH_SIZE) {
        console.log('样本已满，历史记录可能超过100000条，继续获取更早的数据...');
        // 使用样本中的最早时间作为临时起点，后续会逐步向后扩展
        startTime = earliestInSample;
      } else {
        // 样本未满，说明已经获取了全部或大部分历史
        startTime = earliestInSample;
      }
    }
  } catch (error) {
    console.warn('获取最早历史时间失败，使用默认时间范围:', error);
  }
  
  // 使用更小的时间窗口以确保数据密度高的时期也能完整获取
  // 从1天开始，如果发现数据密集则自动缩小
  let chunkSize = 1 * 24 * 60 * 60 * 1000; // 1天的毫秒数（初始值）
  let currentEnd = endTime;
  let batchCount = 0;
  let totalFetched = 0;
  let consecutiveEmptyChunks = 0; // 连续空批次计数
  
  console.log(`开始分批获取历史记录，目标: ${maxResults} 条，时间范围: ${new Date(startTime).toLocaleString()} 到 ${new Date(endTime).toLocaleString()}`);
  
  // 从最近的时间开始，向后遍历直到达到上限或获取完所有数据
  while (currentEnd > 0 && totalFetched < maxResults) {
    const currentStart = Math.max(currentEnd - chunkSize, 0);
    
    try {
      const chunk = await searchHistoryChunk(currentStart, currentEnd, CHROME_HISTORY_BATCH_SIZE);
      batchCount++;
      
      if (chunk.length > 0) {
        consecutiveEmptyChunks = 0; // 重置空批次计数
        
        // 将结果添加到 Map 中（自动去重，使用 URL + 时间作为键更可靠）
        chunk.forEach(item => {
          const uniqueKey = `${item.url}_${item.lastVisitTime}`;
          if (!allHistory.has(uniqueKey)) {
            allHistory.set(uniqueKey, {
              id: item.id,
              url: item.url,
              title: item.title || '无标题',
              lastVisitTime: item.lastVisitTime,
              formattedTime: formatTimestamp(item.lastVisitTime),
              visitCount: item.visitCount || 1
            });
          }
        });
        
        totalFetched = allHistory.size;
        
        // 每10批次输出一次进度
        if (batchCount % 10 === 0 || chunk.length >= CHROME_HISTORY_BATCH_SIZE) {
          console.log(`批次 ${batchCount}: 获取到 ${chunk.length} 条记录，累计 ${totalFetched} 条，时间窗口: ${chunkSize / (24 * 60 * 60 * 1000)} 天`);
        }
        
        // 如果这一批达到了限制，说明这时间段内数据非常密集
        if (chunk.length >= CHROME_HISTORY_BATCH_SIZE) {
          console.log(`批次 ${batchCount} 达到 ${CHROME_HISTORY_BATCH_SIZE} 条限制，缩小时间窗口...`);
          // 缩小时间窗口为原来的1/4（更激进地缩小以应对高密度数据）
          chunkSize = Math.max(chunkSize / 4, 1 * 60 * 60 * 1000); // 最小1小时
          // 保持当前结束时间不变，用更小的时间窗口重新获取这一段时间
          continue;
        }
        
        // 如果数据量很小且连续多次都小，可以适当增大时间窗口以提高效率
        if (chunk.length < 100 && chunkSize < 7 * 24 * 60 * 60 * 1000) {
          chunkSize = Math.min(chunkSize * 2, 7 * 24 * 60 * 60 * 1000); // 最大7天
        }
      } else {
        consecutiveEmptyChunks++;
        
        // 如果连续多个批次为空，增大时间窗口以快速跳过空白期
        if (consecutiveEmptyChunks >= 3 && chunkSize < 30 * 24 * 60 * 60 * 1000) {
          chunkSize = Math.min(chunkSize * 3, 30 * 24 * 60 * 60 * 1000); // 最大30天
          consecutiveEmptyChunks = 0;
        }
        
        // 如果已经远超用户设定的days且连续空批次，考虑提前结束
        if (days > 0 && currentEnd < startTime && consecutiveEmptyChunks > 10) {
          console.log(`已连续 ${consecutiveEmptyChunks} 个批次为空，且已超出目标时间范围，提前结束`);
          break;
        }
      }
      
      // 移动到下一个时间窗口
      currentEnd = currentStart;
      
      // 如果已经到达或超过了最早时间，继续尝试获取更多（可能有更早的数据）
      if (currentEnd <= startTime && days === 0) {
        console.log(`已到达初始最早时间 ${new Date(startTime).toLocaleString()}，继续检查是否有更早的数据...`);
        // 继续循环，看看是否还有更多数据
      }
      
    } catch (error) {
      console.error(`批次 ${batchCount} 获取失败:`, error);
      // 继续尝试下一个时间窗口
      currentEnd = currentStart;
    }
  }
  
  const result = Array.from(allHistory.values());
  console.log(`分批获取完成: 共 ${batchCount} 个批次，总计 ${result.length} 条唯一记录`);
  
  // 按时间倒序排序（最新的在前）
  result.sort((a, b) => b.lastVisitTime - a.lastVisitTime);
  
  return result;
}

/**
 * 搜索特定时间范围内的历史记录
 * @param {number} startTime - 开始时间戳
 * @param {number} endTime - 结束时间戳
 * @param {number} maxResults - 最大结果数
 * @returns {Promise<Array>} 历史记录数组
 */
function searchHistoryChunk(startTime, endTime, maxResults) {
  return new Promise((resolve, reject) => {
    chrome.history.search({
      text: '',
      startTime: startTime,
      endTime: endTime,
      maxResults: maxResults
    }, (historyItems) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(historyItems);
    });
  });
}

/**
 * 获取增量历史记录（自上次同步以来的新记录）
 * @param {number} maxResults - 最大结果数（默认100000）
 * @returns {Promise<Array>} 增量历史记录数组
 */
export async function getIncrementalHistory(maxResults = 100000) {
  const lastSyncTime = await getLastSyncTimestamp();
  
  return new Promise((resolve, reject) => {
    chrome.history.search({
      text: '',
      startTime: lastSyncTime,
      maxResults: maxResults
    }, (historyItems) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      
      const formattedHistory = historyItems.map(item => ({
        id: item.id,
        url: item.url,
        title: item.title || '无标题',
        lastVisitTime: item.lastVisitTime,
        formattedTime: formatTimestamp(item.lastVisitTime),
        visitCount: item.visitCount || 1
      }));
      
      resolve(formattedHistory);
    });
  });
}

/**
 * 获取所有历史记录（无上限，突破100000限制）
 * @param {number} maxResults - 最大结果数（默认100万条）
 * @returns {Promise<Array>} 所有历史记录数组
 */
export async function getAllBrowserHistory(maxResults = 1000000) {
  console.log('开始获取所有历史记录（上限:', maxResults, '条）...');
  
  try {
    // 使用分批获取机制
    const allHistory = await getBrowserHistoryBatched(0, maxResults);
    
    if (allHistory.length > 0) {
      const timestamps = allHistory.map(item => item.lastVisitTime);
      const earliest = new Date(Math.min(...timestamps));
      const latest = new Date(Math.max(...timestamps));
      console.log(`成功获取 ${allHistory.length} 条历史记录`);
      console.log('History date range:', earliest.toISOString(), 'to', latest.toISOString());
    } else {
      console.warn('未获取到任何历史记录');
    }
    
    return allHistory;
  } catch (error) {
    console.error('获取所有历史记录失败:', error);
    throw error;
  }
}

/**
 * 获取特定URL的访问详情
 * @param {string} url - 要查询的URL
 * @returns {Promise<Object>} 访问详情
 */
export async function getVisitDetails(url) {
  return new Promise((resolve, reject) => {
    chrome.history.getVisits({ url: url }, (visitItems) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      
      resolve(visitItems.map(visit => ({
        visitId: visit.visitId,
        visitTime: visit.visitTime,
        formattedTime: formatTimestamp(visit.visitTime),
        referringVisitId: visit.referringVisitId,
        transition: visit.transition
      })));
    });
  });
}
