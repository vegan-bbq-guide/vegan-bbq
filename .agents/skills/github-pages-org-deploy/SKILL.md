---
name: github-pages-org-deploy
description: >-
  Guides and executes pushing projects to GitHub and deploying to GitHub Pages under a GitHub Organization (組織).
  Ensures the live website URL displays an organization/brand name (https://<org>.github.io/<repo>/) rather than
  exposing personal GitHub usernames in the browser address bar.
  Use when the user wants to push code to GitHub, deploy to GitHub Pages, or create/transfer a project to a GitHub Organization.
---

# GitHub 專案推送與專屬組織網址部署流程 (GitHub Pages Org Deploy)

本技能提供一套標準化、自動化且隱藏個人帳號的 GitHub 靜態網頁發布流程，適用於任何前端或靜態網站專案。

---

## 核心價值

* **傳統個人網址**：`https://<個人帳號>.github.io/<專案名>/`（瀏覽器網址列會顯示個人帳號）
* **組織型專屬網址**：`https://<組織名稱>.github.io/<專案名>/`（品牌化、專業感、完全隱藏個人帳號）
* **根網域型 (進階)**：若專案命名為 `<組織名稱>.github.io`，網址更可簡化為 `https://<組織名稱>.github.io/`（無子目錄路徑）

---

## 標準執行步驟 (SOP)

### 階段一：環境檢測與 GitHub 驗證

1. **檢查/安裝 GitHub CLI (`gh`)**：
   ```powershell
   gh --version
   # 若未安裝，透過 winget 自動安裝
   winget install --id GitHub.cli -e --source winget --accept-source-agreements --accept-package-agreements
   ```
2. **驗證登入狀態**：
   ```powershell
   gh auth status
   ```
   * 若未登入，在終端機執行：
     ```powershell
     gh auth login
     ```
   * **關鍵建議**：在驗證方式選擇 **`Login with a web browser`**（瀏覽器授權），可自動配齊 `repo`, `read:org`, `workflow` 完整權限，避免手動輸入 Token 遺漏 `read:org`。

---

### 階段二：本地 Git 初始化與推送

1. **初始化與提交檔案**：
   ```powershell
   git init -b main
   git config user.name "<設定名稱或專案名>"
   git config user.email "<設定信箱>"
   git add .
   git commit -m "feat: initial commit for deployment"
   ```
2. **在 GitHub 建立儲存庫並推送**：
   ```powershell
   gh repo create <repo-name> --public --source=. --remote=origin --push
   ```

---

### 階段三：建立專屬組織 (Organization) 與移轉

1. **建立免費組織**：
   * 前往：`https://github.com/organizations/plan`
   * 選擇 **Free** 計畫 -> 輸入 **組織名稱**（例如 `vegan-bbq-guide`）-> 填寫聯絡 Email -> 選擇 "My personal account" -> 完成建立。
2. **將儲存庫移轉給組織**：
   ```powershell
   gh api -X POST "repos/<personal-username>/<repo-name>/transfer" -f "new_owner=<org-name>"
   ```
3. **更新本地 Git Remote 網址**：
   ```powershell
   git remote set-url origin https://github.com/<org-name>/<repo-name>.git
   ```

---

### 階段四：啟用 GitHub Pages 並驗證

1. **啟用 GitHub Pages**：
   ```powershell
   gh api -X POST "repos/<org-name>/<repo-name>/pages" -F "source[branch]=main" -F "source[path]=/"
   ```
2. **檢查線上建置狀態**：
   ```powershell
   gh api repos/<org-name>/<repo-name>/pages/builds/latest
   ```
   * 等待 `status` 轉為 `"built"`。
3. **驗證連線**：
   ```powershell
   curl.exe -sI https://<org-name>.github.io/<repo-name>/
   ```
   * 回傳 `HTTP/1.1 200 OK` 即代表網站已正式上線！

---

## 自動化執行腳本

本技能隨附自動化 PowerShell 腳本 `deploy.ps1`，可在終端機單行完成全部流程：

```powershell
# 語法：
.\deploy.ps1 -RepoName "<儲存庫名稱>" -OrgName "<組織名稱>"

# 範例：
.\deploy.ps1 -RepoName "vegan-bbq" -OrgName "vegan-bbq-guide"
```
