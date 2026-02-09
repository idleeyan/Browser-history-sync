# 项目规则 (Project Rules)

## 版本管理规范

### 1. 版本号格式
采用 [语义化版本控制 2.0.0](https://semver.org/lang/zh-CN/) 规范：

```
版本号格式：主版本号.次版本号.修订号（MAJOR.MINOR.PATCH）

- 主版本号（MAJOR）：做了不兼容的API修改时递增
- 次版本号（MINOR）：做了向下兼容的功能性新增时递增
- 修订号（PATCH）：做了向下兼容的问题修正时递增
```

### 2. 版本号递增规则

| 场景 | 版本变化 | 示例 |
|------|----------|------|
| 修复bug、性能优化 | PATCH + 1 | 0.1.0 → 0.1.1 |
| 新增功能（向下兼容） | MINOR + 1, PATCH = 0 | 0.1.0 → 0.2.0 |
| 重大变更/不兼容修改 | MAJOR + 1, MINOR = 0, PATCH = 0 | 0.1.0 → 1.0.0 |
| 初始开发阶段 | 保持 0.x.x | 0.1.0, 0.2.0 |

### 3. 强制规则

**⚠️ 每次代码修改必须同时执行以下操作：**

#### 3.1 更新版本号
修改以下文件中的版本号（保持一致）：
- `manifest.json` - `"version": "x.x.x"`
- `package.json` - `"version": "x.x.x"`

#### 3.2 更新 CHANGELOG.md
在 `CHANGELOG.md` 中添加新版本记录：

```markdown
## [x.x.x] - YYYY-MM-DD

### 新增
- 新增功能描述

### 变更
- 变更描述

### 修复
- 修复描述

### 废弃
- 废弃功能描述

### 移除
- 移除功能描述

### 安全
- 安全相关修复
```

### 4. 更新流程检查清单

每次提交代码前，必须确认：

- [ ] 已更新 `manifest.json` 中的版本号
- [ ] 已更新 `package.json` 中的版本号
- [ ] 已更新 `CHANGELOG.md`，添加新版本记录
- [ ] 版本号在三处保持一致
- [ ] 已描述本次变更的具体内容

### 5. 版本发布流程

#### 5.1 开发阶段（0.x.x）
- 快速迭代，频繁更新 PATCH 版本
- 功能重大变更时更新 MINOR 版本
- 不保证向后兼容

#### 5.2 正式发布（1.0.0+）
- 保证向后兼容
- 重大变更必须更新 MAJOR 版本
- 完整测试后发布

### 6. Git 提交规范

提交信息格式：
```
类型: 简短描述（不超过50字符）

详细描述（可选）

相关Issue: #123
```

类型包括：
- `feat`: 新功能
- `fix`: 修复bug
- `docs`: 文档更新
- `style`: 代码格式（不影响代码运行的变动）
- `refactor`: 重构
- `perf`: 性能优化
- `test`: 测试相关
- `chore`: 构建过程或辅助工具的变动

### 7. 文件变更记录

本项目重要文件：

| 文件 | 用途 | 变更频率 |
|------|------|----------|
| manifest.json | 扩展配置 | 低 |
| package.json | npm配置 | 中 |
| CHANGELOG.md | 更新日志 | 高 |
| PROJECT_RULES.md | 项目规则 | 低 |
| background/*.js | 后台脚本 | 高 |
| utils/*.js | 工具函数 | 高 |
| ui/*.html | UI页面 | 中 |
| ui/*.js | UI逻辑 | 高 |
| ui/*.css | UI样式 | 中 |

## 代码规范

### 1. 命名规范

- 文件：kebab-case（例如：`history-api.js`）
- 函数：camelCase（例如：`getBrowserHistory`）
- 常量：UPPER_SNAKE_CASE（例如：`TOTAL_FILE_NAME`）
- 类：PascalCase（例如：`HistoryManager`）

### 2. 注释规范

所有导出函数必须包含 JSDoc 注释：

```javascript
/**
 * 函数描述
 * @param {类型} 参数名 - 参数描述
 * @returns {类型} 返回值描述
 */
```

### 3. 错误处理

所有异步函数必须使用 try-catch 包裹，并返回统一格式：

```javascript
{ success: boolean, message: string, data?: any }
```

## 架构规范

### 1. 模块职责

- `background/`: 后台Service Worker，处理核心业务逻辑
- `utils/`: 工具函数，无状态，纯函数
- `ui/`: 用户界面，仅处理DOM操作和事件
- `icons/`: 图标资源
- `dist/`: 构建输出（不提交到git）

### 2. 依赖关系

```
ui/ → background/
  ↓       ↓
utils/ ← utils/
```

- UI层只能调用background的消息接口
- 工具函数可以被任何层调用
- 禁止循环依赖

## 安全规范

### 1. 数据安全
- 所有同步数据必须加密（AES）
- 密钥存储在 chrome.storage.local
- 禁止在代码中硬编码密钥

### 2. 隐私保护
- 不上传用户敏感信息
- 本地处理和加密所有数据
- 提供数据清除功能

---

**最后更新**: 2026-02-01
**版本**: 0.1.1
