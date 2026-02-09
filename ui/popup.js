// popup.js - 弹出层逻辑

document.addEventListener('DOMContentLoaded', async () => {
  // 获取DOM元素
  const syncUploadBtn = document.getElementById('syncUploadBtn');
  const syncDownloadBtn = document.getElementById('syncDownloadBtn');
  const openOptionsBtn = document.getElementById('openOptionsBtn');
  const feedback = document.getElementById('feedback');
  const lastSyncTime = document.getElementById('lastSyncTime');
  const syncStatus = document.getElementById('syncStatus');
  const pendingCount = document.getElementById('pendingCount');
  const localCount = document.getElementById('localCount');
  const cachedCount = document.getElementById('cachedCount');

  // 显示反馈消息
  function showFeedback(message, type = 'info') {
    feedback.textContent = message;
    feedback.className = 'mt-3 text-sm text-center';
    
    if (type === 'success') {
      feedback.classList.add('text-green-600');
    } else if (type === 'error') {
      feedback.classList.add('text-red-600');
    } else if (type === 'warning') {
      feedback.classList.add('text-orange-600');
    } else {
      feedback.classList.add('text-blue-600');
    }
    
    feedback.classList.remove('hidden');
    
    // 3秒后隐藏
    setTimeout(() => {
      feedback.classList.add('hidden');
    }, 3000);
  }

  // 设置按钮加载状态
  function setButtonLoading(button, loading) {
    if (loading) {
      button.classList.add('loading');
      button.disabled = true;
    } else {
      button.classList.remove('loading');
      button.disabled = false;
    }
  }

  // 格式化时间
  function formatTime(timestamp) {
    if (!timestamp || timestamp === 0) return '从未同步';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    // 小于1小时显示相对时间
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    
    // 否则显示具体时间
    return date.toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // 加载同步状态
  async function loadSyncStatus() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getSyncStatus' });
      
      if (response.success) {
        lastSyncTime.textContent = formatTime(response.lastSyncTime);
        
        // 更新状态指示器
        syncStatus.className = 'w-3 h-3 rounded-full';
        if (response.lastSyncTime > 0) {
          const hoursSinceSync = (Date.now() - response.lastSyncTime) / 3600000;
          if (hoursSinceSync < 1) {
            syncStatus.classList.add('online');
            syncStatus.title = '最近已同步';
          } else if (hoursSinceSync < 24) {
            syncStatus.classList.add('online');
            syncStatus.title = '今日已同步';
          } else {
            syncStatus.classList.add('offline');
            syncStatus.title = '超过24小时未同步';
          }
        } else {
          syncStatus.classList.add('offline');
          syncStatus.title = '从未同步';
        }
        
        // 显示待同步数量
        if (response.pendingCount > 0) {
          pendingCount.textContent = `待同步: ${response.pendingCount}条`;
          pendingCount.classList.remove('hidden');
        } else {
          pendingCount.classList.add('hidden');
        }
      }
    } catch (error) {
      console.error('加载同步状态失败:', error);
    }
  }

  // 加载历史统计
  async function loadHistoryStats() {
    try {
      // 获取本地历史数量（全部历史，支持超过10万条）
      const localResponse = await chrome.runtime.sendMessage({ 
        action: 'getBrowserHistory',
        days: 0,  // 0 表示全部
        maxResults: 1000000  // 支持高达100万条
      });
      
      if (localResponse.success) {
        const count = localResponse.data.length;
        localCount.textContent = count.toLocaleString();
        
        // 如果数量异常（太少），显示警告
        if (count < 10) {
          console.warn('历史记录数量异常偏少:', count);
        }
        
        // 计算日期范围
        if (count > 0) {
          const timestamps = localResponse.data.map(item => item.lastVisitTime);
          const earliest = new Date(Math.min(...timestamps));
          const latest = new Date(Math.max(...timestamps));
          console.log(`历史记录统计: ${count} 条，时间范围: ${earliest.toLocaleDateString()} - ${latest.toLocaleDateString()}`);
        }
      }

      // 获取已缓存的历史数量
      const cachedResponse = await chrome.runtime.sendMessage({ action: 'getCachedHistory' });
      
      if (cachedResponse.success) {
        cachedCount.textContent = (cachedResponse.data.length || 0).toLocaleString();
      }
    } catch (error) {
      console.error('加载历史统计失败:', error);
    }
  }

  // 上传同步按钮（增量）
  syncUploadBtn.addEventListener('click', async () => {
    setButtonLoading(syncUploadBtn, true);
    syncStatus.classList.add('syncing');
    showFeedback('正在上传增量数据...', 'info');
    
    try {
      const result = await chrome.runtime.sendMessage({ action: 'incrementalSyncToWebDAV' });
      
      if (result.success) {
        showFeedback(result.message, 'success');
        await loadSyncStatus();
        await loadHistoryStats();
      } else {
        showFeedback(result.message, 'error');
      }
    } catch (error) {
      showFeedback(`同步失败: ${error.message}`, 'error');
    } finally {
      setButtonLoading(syncUploadBtn, false);
      syncStatus.classList.remove('syncing');
    }
  });

  // 上传全部历史按钮
  const syncUploadFullBtn = document.getElementById('syncUploadFullBtn');
  syncUploadFullBtn.addEventListener('click', async () => {
    if (!confirm('确定要上传全部历史记录吗？这可能需要一些时间。')) {
      return;
    }
    
    setButtonLoading(syncUploadFullBtn, true);
    syncStatus.classList.add('syncing');
    showFeedback('正在获取全部历史记录...', 'info');
    
    try {
      // 获取全部历史记录（支持超过10万条）
      const historyResponse = await chrome.runtime.sendMessage({ 
        action: 'getBrowserHistory',
        days: 0,
        maxResults: 1000000  // 支持高达100万条
      });
      
      if (!historyResponse.success || historyResponse.data.length === 0) {
        showFeedback('没有历史记录可上传', 'warning');
        return;
      }
      
      showFeedback(`获取到 ${historyResponse.data.length} 条记录，正在上传...`, 'info');
      
      // 上传全部历史
      const result = await chrome.runtime.sendMessage({ 
        action: 'fullSyncToWebDAV',
        historyData: historyResponse.data
      });
      
      if (result.success) {
        showFeedback(`全部历史上传成功！共 ${result.count} 条`, 'success');
        await loadSyncStatus();
        await loadHistoryStats();
      } else {
        showFeedback(result.message, 'error');
      }
    } catch (error) {
      showFeedback(`上传失败: ${error.message}`, 'error');
    } finally {
      setButtonLoading(syncUploadFullBtn, false);
      syncStatus.classList.remove('syncing');
    }
  });

  // 下载合并按钮
  syncDownloadBtn.addEventListener('click', async () => {
    setButtonLoading(syncDownloadBtn, true);
    syncStatus.classList.add('syncing');
    showFeedback('正在下载并合并...', 'info');
    
    try {
      const result = await chrome.runtime.sendMessage({ action: 'downloadAndMerge' });
      
      if (result.success) {
        showFeedback(result.message, 'success');
        await loadSyncStatus();
        await loadHistoryStats();
      } else {
        showFeedback(result.message, 'error');
      }
    } catch (error) {
      showFeedback(`下载失败: ${error.message}`, 'error');
    } finally {
      setButtonLoading(syncDownloadBtn, false);
      syncStatus.classList.remove('syncing');
    }
  });

  // 打开配置页按钮
  openOptionsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // 打开报告页面按钮
  const openReportBtn = document.getElementById('openReportBtn');
  openReportBtn.addEventListener('click', () => {
    const reportUrl = chrome.runtime.getURL('ui/report.html');
    chrome.tabs.create({ url: reportUrl });
  });

  // 查看本地历史记录
  const viewLocalHistory = document.getElementById('viewLocalHistory');
  viewLocalHistory.addEventListener('click', async () => {
    try {
      const response = await chrome.runtime.sendMessage({ 
        action: 'getBrowserHistory',
        days: 0,  // 全部历史
        maxResults: 1000000  // 支持高达100万条
      });
      
      if (response.success && response.data.length > 0) {
        // 按时间倒序排序，显示最新的100条
        const sortedData = response.data.sort((a, b) => b.lastVisitTime - a.lastVisitTime).slice(0, 100);
        showHistoryModal(`本地历史记录 (共${response.data.length}条，显示最新100条)`, sortedData);
      } else {
        showFeedback('暂无本地历史记录', 'warning');
      }
    } catch (error) {
      showFeedback('加载失败: ' + error.message, 'error');
    }
  });

  // 查看已同步历史记录
  const viewCachedHistory = document.getElementById('viewCachedHistory');
  viewCachedHistory.addEventListener('click', async () => {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getCachedHistory' });
      
      if (response.success && response.data.length > 0) {
        showHistoryModal('已同步历史记录', response.data);
      } else {
        showFeedback('暂无已同步历史记录', 'warning');
      }
    } catch (error) {
      showFeedback('加载失败: ' + error.message, 'error');
    }
  });

  // 显示历史记录弹窗
  function showHistoryModal(title, historyData) {
    // 创建弹窗
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.5);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    
    const content = document.createElement('div');
    content.style.cssText = `
      background: white;
      width: 90%;
      max-width: 600px;
      max-height: 80%;
      border-radius: 8px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    `;
    
    // 标题栏
    const header = document.createElement('div');
    header.style.cssText = `
      padding: 16px;
      border-bottom: 1px solid #e5e7eb;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #f9fafb;
    `;
    header.innerHTML = `
      <h3 style="margin: 0; font-size: 16px; font-weight: 600;">${title} (${historyData.length}条)</h3>
      <button id="closeModal" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #6b7280;">×</button>
    `;
    
    // 列表
    const listContainer = document.createElement('div');
    listContainer.style.cssText = `
      overflow-y: auto;
      max-height: 400px;
      padding: 8px;
    `;
    
    const list = historyData.slice(0, 50).map((item, index) => `
      <div style="padding: 8px; border-bottom: 1px solid #f3f4f6; font-size: 13px;">
        <div style="font-weight: 500; color: #1f2937; margin-bottom: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          ${index + 1}. ${item.title || '无标题'}
        </div>
        <div style="color: #6b7280; font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          ${item.url}
        </div>
        <div style="color: #9ca3af; font-size: 10px; margin-top: 2px;">
          ${item.formattedTime || new Date(item.lastVisitTime).toLocaleString('zh-CN')}
        </div>
      </div>
    `).join('');
    
    if (historyData.length > 50) {
      listContainer.innerHTML = list + `<div style="text-align: center; padding: 8px; color: #9ca3af; font-size: 12px;">...还有 ${historyData.length - 50} 条记录</div>`;
    } else {
      listContainer.innerHTML = list;
    }
    
    content.appendChild(header);
    content.appendChild(listContainer);
    modal.appendChild(content);
    document.body.appendChild(modal);
    
    // 关闭事件
    document.getElementById('closeModal').addEventListener('click', () => {
      document.body.removeChild(modal);
    });
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
      }
    });
  }

  // 初始化加载
  await loadSyncStatus();
  await loadHistoryStats();
  
  // 每30秒自动刷新一次数据
  setInterval(async () => {
    console.log('自动刷新统计数据...');
    await loadHistoryStats();
  }, 30000);
  
  console.log('Popup初始化完成，数据每30秒自动刷新');

  // 测试历史记录按钮
  const testHistoryBtn = document.getElementById('testHistoryBtn');
  testHistoryBtn.addEventListener('click', async () => {
    try {
      showFeedback('正在测试...', 'info');
      const response = await chrome.runtime.sendMessage({ 
        action: 'getBrowserHistory',
        days: 0,
        maxResults: 1000000  // 支持高达100万条
      });
      
      if (response.success) {
        const count = response.data.length;
        const timestamps = response.data.map(item => item.lastVisitTime);
        const earliest = new Date(Math.min(...timestamps));
        const latest = new Date(Math.max(...timestamps));
        
        const message = `测试成功！\n获取到 ${count} 条历史记录\n时间范围: ${earliest.toLocaleDateString()} - ${latest.toLocaleDateString()}`;
        alert(message);
        console.log('历史记录详情:', response.data.slice(0, 10));
      } else {
        showFeedback('测试失败', 'error');
      }
    } catch (error) {
      showFeedback('测试失败: ' + error.message, 'error');
    }
  });
});
