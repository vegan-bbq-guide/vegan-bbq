<#
.SYNOPSIS
    自動化推送專案至 GitHub 並部署至 GitHub Pages（支援個人或組織專屬網址）。
.PARAMETER RepoName
    儲存庫名稱（例如：my-awesome-site）
.PARAMETER OrgName
    （選填）GitHub 組織名稱。若指定，將自動移轉儲存庫至該組織，讓網址不顯示個人帳號。
.PARAMETER CommitMessage
    提交訊息（預設為 "feat: deploy project"）
.EXAMPLE
    .\deploy.ps1 -RepoName "vegan-bbq" -OrgName "vegan-bbq-guide"
#>
param (
    [Parameter(Mandatory = $true)]
    [string]$RepoName,

    [Parameter(Mandatory = $false)]
    [string]$OrgName = "",

    [Parameter(Mandatory = $false)]
    [string]$CommitMessage = "feat: deploy project"
)

$ErrorActionPreference = "Stop"

Write-Host "=== [1/5] 檢查環境與 GitHub 登入狀態 ===" -ForegroundColor Cyan
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Host "找不到 GitHub CLI (gh)，正在嘗試透過 winget 安裝..." -ForegroundColor Yellow
    winget install --id GitHub.cli -e --source winget --accept-source-agreements --accept-package-agreements
}

# 驗證登入
$authStatus = & gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error "尚未登入 GitHub，請先在終端機執行: gh auth login"
}

# 取得目前登入的 GitHub 帳號
$currentAccount = ($authStatus | Select-String "account ([^ ]+)").Matches.Groups[1].Value
if (-not $currentAccount) {
    $currentAccount = & gh api user -q ".login"
}
Write-Host "已登入帳號: $currentAccount" -ForegroundColor Green

Write-Host "`n=== [2/5] 本地 Git 提交 ===" -ForegroundColor Cyan
if (-not (Test-Path ".git")) {
    git init -b main
}
git add .
$status = git status --porcelain
if ($status) {
    git commit -m $CommitMessage
} else {
    Write-Host "沒有需要提交的新變更。" -ForegroundColor Gray
}

Write-Host "`n=== [3/5] 建立/確認 GitHub 儲存庫 ===" -ForegroundColor Cyan
$targetOwner = if ($OrgName) { $OrgName } else { $currentAccount }
$repoExists = $false
try {
    $null = & gh repo view "$targetOwner/$RepoName" 2>$null
    if ($LASTEXITCODE -eq 0) { $repoExists = $true }
} catch {
    $repoExists = $false
}

if (-not $repoExists) {
    Write-Host "建立並推送遠端儲存庫: $targetOwner/$RepoName ..." -ForegroundColor Yellow
    if ($OrgName) {
        # 先在個人帳號建立並推送，再移轉給組織（相容性最佳）
        & gh repo create $RepoName --public --source=. --remote=origin --push
        Write-Host "移轉儲存庫至組織: $OrgName ..." -ForegroundColor Yellow
        & gh api -X POST "repos/$currentAccount/$RepoName/transfer" -f "new_owner=$OrgName"
        git remote set-url origin "https://github.com/$OrgName/$RepoName.git"
    } else {
        & gh repo create $RepoName --public --source=. --remote=origin --push
    }
} else {
    Write-Host "儲存庫 $targetOwner/$RepoName 已存在，推送最新分支..." -ForegroundColor Gray
    git push origin main
}

Write-Host "`n=== [4/5] 啟用 GitHub Pages ===" -ForegroundColor Cyan
try {
    & gh api -X POST "repos/$targetOwner/$RepoName/pages" -F "source[branch]=main" -F "source[path]=/" 2>$null
    Write-Host "GitHub Pages 啟用請求已送出。" -ForegroundColor Green
} catch {
    Write-Host "GitHub Pages 可能已啟用或正在建置中。" -ForegroundColor Gray
}

Write-Host "`n=== [5/5] 部署完成 ===" -ForegroundColor Cyan
$siteUrl = "https://$($targetOwner.ToLower()).github.io/$RepoName/"
Write-Host "專屬網站網址: $siteUrl" -ForegroundColor Green
Write-Host "原始碼位置:   https://github.com/$targetOwner/$RepoName" -ForegroundColor Gray
Write-Host "（首次啟用可能需 30-60 秒完成線上建置，請稍候刷新即可）" -ForegroundColor Yellow
