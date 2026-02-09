# 浏览器历史同步扩展 - GitHub推送脚本

Write-Host "=== 浏览器历史同步扩展推送脚本 ===" -ForegroundColor Cyan

# 检查git是否安装
try {
    git --version | Out-Null
} catch {
    Write-Host "错误: 未安装Git，请先安装Git" -ForegroundColor Red
    exit 1
}

# 检查是否已初始化git仓库
if (-not (Test-Path ".git")) {
    Write-Host "初始化Git仓库..." -ForegroundColor Yellow
    git init
    git config user.name "idleeyan"
    git config user.email "idleeyan@example.com"
}

# 检查远程仓库
$remote = git remote get-url origin 2>$null
if (-not $remote) {
    Write-Host "添加远程仓库..." -ForegroundColor Yellow
    git remote add origin https://github.com/idleeyan/Browser-history-sync.git
}

# 检查版本号
Write-Host "检查版本号..." -ForegroundColor Yellow
$manifestVersion = (Get-Content manifest.json | ConvertFrom-Json).version
$packageVersion = (Get-Content package.json | ConvertFrom-Json).version

Write-Host "manifest.json版本: $manifestVersion" -ForegroundColor Green
Write-Host "package.json版本: $packageVersion" -ForegroundColor Green

# 检查CHANGELOG
if (-not (Test-Path "CHANGELOG.md")) {
    Write-Host "警告: 未找到CHANGELOG.md文件" -ForegroundColor Yellow
} else {
    Write-Host "CHANGELOG.md已存在" -ForegroundColor Green
}

# 添加文件
Write-Host "添加文件到暂存区..." -ForegroundColor Yellow
git add .

# 提交
$commitMessage = "chore: 版本 $manifestVersion 推送"
Write-Host "提交代码: $commitMessage" -ForegroundColor Yellow
git commit -m "$commitMessage"

# 推送
Write-Host "推送到GitHub..." -ForegroundColor Yellow
git push -u origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host "=== 推送成功! ===" -ForegroundColor Green
} else {
    Write-Host "=== 推送失败，请检查错误信息 ===" -ForegroundColor Red
}

Write-Host "脚本执行完成" -ForegroundColor Cyan