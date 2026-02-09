# 快速推送指南

## 一键推送
```powershell
# 运行推送脚本
.\push-to-github.ps1
```

## 手动推送步骤

### 1. 检查版本
```bash
# 查看版本号
cat manifest.json | findstr "version"
```

### 2. 更新日志
确保 `CHANGELOG.md` 已记录本次变更

### 3. 提交代码
```bash
# 添加所有文件
git add .

# 提交
git commit -m "feat: 新增功能描述"

# 推送
git push
```

## 常见命令
```bash
# 查看状态
git status

# 查看差异
git diff

# 拉取更新
git pull

# 查看日志
git log --oneline
```

## 版本更新规则
- **修复bug**: 修订号+1 (1.2.3 → 1.2.4)
- **新增功能**: 次版本号+1 (1.2.3 → 1.3.0)
- **重大重构**: 主版本号+1 (1.2.3 → 2.0.0)