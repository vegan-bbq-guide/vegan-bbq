---
name: github-pages-org-deploy
description: >-
  Guides and executes pushing projects to GitHub and deploying to GitHub Pages under a GitHub Organization (組織).
  Ensures the live website URL displays an organization/brand name (https://<org>.github.io/<repo>/) rather than
  exposing personal GitHub usernames in the browser address bar. Supports optional client-side AES-256 password protection
  allowing private sharing on free GitHub accounts without leaking source code.
  Use when the user wants to push code to GitHub, deploy to GitHub Pages, password-protect a static site, or create/transfer a project to a GitHub Organization.
---

# GitHub 專案推送與專屬組織網址部署流程 (GitHub Pages Org Deploy)

本技能提供一套標準化、自動化且隱藏個人帳號的 GitHub 靜態網頁發布流程，並支援**選用之「AES-256 原生端對端密碼保護機制」**，適用於任何前端或靜態網站專案。

---

## 核心價值

* **組織型專屬網址**：`https://<組織名稱>.github.io/<專案名>/`（品牌化、專業感、完全隱藏個人 GitHub 帳號）
* **傳統個人網址對比**：`https://<個人帳號>.github.io/<專案名>/`（瀏覽器網址列會洩漏個人帳號）
* **根網域型 (進階)**：若專案命名為 `<組織名稱>.github.io`，網址更可簡化為 `https://<組織名稱>.github.io/`（無子目錄路徑）
* **🔐 端對端密碼防護（免費版私密分享解法）**：
  * **GitHub 限制痛點**：GitHub Free 免費版一旦將儲存庫改為 Private（私有），GitHub Pages 就會被強制下架（404）。
  * **密碼防護解法**：儲存庫維持 Public（以啟用免費 Pages），但透過 **PBKDF2 + AES-256-GCM** 將 HTML 內容完全加密成亂碼密文。
  * **零外洩保證**：外人與搜尋引擎爬蟲「檢視原始碼」只能看到加密密文；只有在輸入正確通行密碼後，瀏覽器才於本機記憶體秒速解密還原。
  * **便民體驗**：支援「記住解鎖狀態 7 天」，並在解密後的網頁中配備「鎖定網頁」快捷按鈕。

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

### 階段二（選用）：靜態網頁 AES-256 密碼加密

若使用者希望**網頁有公開網址、但必須輸入密碼才能觀看**：

1. **確認 Node.js 環境**：
   ```powershell
   node -v
   ```
2. **執行靜態加密腳本**：
   使用隨附之 `encrypt-static.js`：
   ```powershell
   # 基本用法（預設自動尋找 index_source.html / index.html 並輸出至 index.html）：
   node .agents/skills/github-pages-org-deploy/scripts/encrypt-static.js -p "設定通行密碼"

   # 進階自訂參數：
   node .agents/skills/github-pages-org-deploy/scripts/encrypt-static.js -p "密碼" -s "index_source.html" -t "index.html" --title "專案標題" --days 7
   ```
   * **安全性**：加密後的 `index.html` 內嵌隨機 16-byte Salt 與 12-byte IV，無密碼絕對無法推算原文。
   * **原始檔保護**：腳本會自動將原始 HTML 備份保存為 `index_source.html`，確保後續隨時可編輯維護。

---

### 階段三：本地 Git 初始化與推送

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

### 階段四：建立專屬組織 (Organization) 與移轉

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

### 階段五：啟用 GitHub Pages 並驗證

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

## 🚀 自動化執行腳本

本技能隨附全功能自動化 PowerShell 腳本 `deploy.ps1`，可在終端機單行完成從加密到部署的全部流程：

### 1. 一般公開部署（不設密碼）：
```powershell
.\.agents\skills\github-pages-org-deploy\scripts\deploy.ps1 -RepoName "my-project" -OrgName "my-org"
```

### 2. 🔐 附帶密碼保護部署（自動 AES-256 加密）：
```powershell
.\.agents\skills\github-pages-org-deploy\scripts\deploy.ps1 -RepoName "vegan-bbq" -OrgName "vegan-bbq-guide" -Password "vegan2026"
```

---

## 🛠️ 常見情境與排錯

* **Q：若之後想更改通行密碼怎麼辦？**
  * 執行：`node .agents/skills/github-pages-org-deploy/scripts/encrypt-static.js -p "新密碼"`
  * 提交推播：`git add index.html; git commit -m "chore: update password"; git push origin main`。
* **Q：使用者如何手動重新鎖定？**
  * 解密後的網頁導覽列會自動注入「鎖定網頁」按鈕，點擊即清除瀏覽器本機的 7 天記住憑證並重新鎖定。
