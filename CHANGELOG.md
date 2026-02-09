# 更新日志

所有 notable 变更都会记录在此文件。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)。

## [未发布]

### 新增
- 暂无

### 变更
- 暂无

### 修复
- 暂无

## [0.3.1] - 2026-02-01

### 变更
- 详细域名统计表添加网站 logo 展示

## [0.3.0] - 2026-02-01

### 新增
- 实现历史记录搜索和过滤功能
- 添加多格式数据导出（JSON、CSV、HTML）
- 实现智能冲突解决策略
- 添加历史记录去重功能
- 实现自动清理旧数据功能
- 添加操作日志记录模块
- 实现备份和恢复功能
- 添加性能监控和统计

### 变更
- 优化同步算法，提升同步速度
- 改进数据存储结构，减少存储空间占用
- 完善错误处理和重试机制

### 修复
- 修复多设备同步时的时间戳冲突问题
- 修复大数据量同步时的内存溢出问题

## [0.2.0] - 2026-02-01

### 新增
- 实现数据预处理模块（data-process.js）- 域名统计、时段分布、每日趋势、TOP10网站
- 创建可视化报告页面（report.html + report.js + report.css）
- 集成 Chart.js 图表库（CDN）
- 添加多种图表类型：柱状图、饼图、折线图、雷达图
- 实现时间筛选功能（最近7天/30天/90天/自定义）
- 添加数据表格展示（支持排序）
- 实现报告导出功能（JSON格式）
- 完善异常处理和日志模块
- 优化缓存机制和错误重试逻辑

### 变更
- 更新 manifest.json 添加可视化报告权限
- 优化 popup UI 添加报告入口按钮
- 改进 Service Worker 错误处理机制

### 修复
- 修复增量同步时的数据去重逻辑
- 修复 WebDAV 连接超时处理

## [0.1.1] - 2026-02-01

### 新增
- 创建项目规则文档（PROJECT_RULES.md）- 规范版本管理和更新日志流程
- 实现浏览历史读取功能（history-api.js）
- 实现 WebDAV 同步功能（webdav-api.js）
- 实现数据加密/解密功能（encrypt-utils.js）
- 实现同步工具函数（sync-utils.js）
- 创建后台 Service Worker 主逻辑（service_worker.js）
- 开发弹出层 UI（popup.html + popup.js + popup.css）
- 开发配置页面 UI（options.html + options.js + options.css）
- 添加图标资源（16px, 48px, 128px）
- 实现消息通信机制（popup ↔ background）

### 变更
- 更新 webpack 配置，移除 babel-loader 依赖（简化构建流程）
- 更新 manifest.json CSP 配置，支持 Tailwind CSS CDN

### 修复
- 修复 webdav 库在浏览器环境的兼容性问题（通过 webpack fallback 配置）

## [0.1.0] - 2026-02-01

### 新增
- 初始化项目基础结构
- 创建 Manifest V3 配置文件
- 配置 webpack 构建工具
- 安装核心依赖（webdav、crypto-js）
- 创建通用工具函数（utils/common.js）
- 初始化项目文档
