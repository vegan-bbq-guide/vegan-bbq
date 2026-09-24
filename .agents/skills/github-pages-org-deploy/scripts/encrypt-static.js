#!/usr/bin/env node
/**
 * encrypt-static.js
 * 靜態網頁 AES-256-GCM 端對端加密建置腳本
 * 
 * 功能：
 * 1. 將指定 HTML 原始碼進行 PBKDF2 (100,000次) + AES-256-GCM 軍規加密
 * 2. 生成包含優雅毛玻璃解密介面與本機 Web Crypto 解密邏輯之 index.html
 * 3. 支援「記住解鎖狀態 7 天」，並在解密後頁面提供「鎖定網頁」按鈕
 * 4. 零第三方依賴（依賴 Node.js 內建 crypto.subtle）
 * 
 * 用法：
 *   node encrypt-static.js -p <密碼> [-s <原始HTML>] [-t <輸出HTML>] [--title <網站標題>]
 *   node encrypt-static.js mypassword123
 */

const fs = require('fs');
const path = require('path');

// 解析命令列參數
const args = process.argv.slice(2);
let password = '';
let sourcePath = '';
let targetPath = '';
let siteTitle = '';
let rememberDays = 7;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '-p' || arg === '--password') {
    password = args[++i];
  } else if (arg === '-s' || arg === '--source') {
    sourcePath = args[++i];
  } else if (arg === '-t' || arg === '--target') {
    targetPath = args[++i];
  } else if (arg === '--title') {
    siteTitle = args[++i];
  } else if (arg === '--days') {
    rememberDays = parseInt(args[++i], 10) || 7;
  } else if (!password && !arg.startsWith('-')) {
    password = arg;
  }
}

if (!password) {
  console.error('❌ 錯誤：請提供加密密碼！');
  console.error('用法範例: node encrypt-static.js -p "mySecretPassword"');
  process.exit(1);
}

// 自動推斷原始 HTML 檔案路徑
const cwd = process.cwd();
if (!sourcePath) {
  const candidates = [
    'index_source.html',
    'index_5.html',
    'index_raw.html',
    'index_src.html',
    'source.html',
    'index.html'
  ];
  for (const c of candidates) {
    const full = path.join(cwd, c);
    if (fs.existsSync(full)) {
      sourcePath = full;
      break;
    }
  }
}

if (!sourcePath || !fs.existsSync(sourcePath)) {
  console.error('❌ 找不到原始 HTML 檔案，請透過 -s 參數指定路徑。');
  process.exit(1);
}

if (!targetPath) {
  targetPath = path.join(cwd, 'index.html');
}

// 安全防護：若來源與目標相同，先將原始檔備份為 index_source.html
if (path.resolve(sourcePath) === path.resolve(targetPath)) {
  const backupPath = path.join(cwd, 'index_source.html');
  if (!fs.existsSync(backupPath)) {
    console.log(`ℹ️ 原始檔與輸出路徑相同，自動備份未加密原始檔至: ${path.basename(backupPath)}`);
    fs.copyFileSync(sourcePath, backupPath);
    sourcePath = backupPath;
  }
}

console.log(`🔒 正在使用 AES-256 加密靜態網頁...`);
console.log(`   來源檔案: ${path.relative(cwd, sourcePath)}`);
console.log(`   輸出檔案: ${path.relative(cwd, targetPath)}`);
console.log(`   授權記憶: ${rememberDays} 天`);

let rawHtml = fs.readFileSync(sourcePath, 'utf-8');

// 自動提取原始 HTML 標題（若未手動指定）
if (!siteTitle) {
  const titleMatch = rawHtml.match(/<title>([^<]+)<\/title>/i);
  siteTitle = titleMatch ? titleMatch[1].trim() : '私密受保護專案';
}

// 在解密後網頁中注入「鎖定網頁」輔助函式（若尚未存在）
const lockScript = `
    /* 靜態加密：手動重新鎖定網頁 */
    function lockPage() {
      if (confirm('確定要鎖定本網站並清除此裝置的免密碼登入授權嗎？')) {
        localStorage.removeItem('gh_pages_auth');
        localStorage.removeItem('vegan_bbq_auth');
        location.reload();
      }
    }
`;

if (!rawHtml.includes('function lockPage()')) {
  if (rawHtml.includes('</head>')) {
    rawHtml = rawHtml.replace('</head>', `<script>${lockScript}</script>\n</head>`);
  } else if (rawHtml.includes('</body>')) {
    rawHtml = rawHtml.replace('</body>', `<script>${lockScript}</script>\n</body>`);
  } else {
    rawHtml += `<script>${lockScript}</script>`;
  }
}

(async () => {
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // PBKDF2 金鑰派生
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  // AES-256-GCM 加密
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    enc.encode(rawHtml)
  );

  const saltB64 = Buffer.from(salt).toString('base64');
  const ivB64 = Buffer.from(iv).toString('base64');
  const ctB64 = Buffer.from(ciphertextBuffer).toString('base64');

  // 自我解密測試（確保密鑰與演算法 100% 吻合）
  const testKeyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  const testKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    testKeyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
  const testDecrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv },
    testKey,
    ciphertextBuffer
  );

  if (dec.decode(testDecrypted) !== rawHtml) {
    console.error('❌ 自我解密檢驗失敗：解密結果與原始碼不符！');
    process.exit(1);
  }

  // 生成自包含的密碼解鎖頁面 HTML
  const encryptedPageHtml = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>私密受保護專案｜${siteTitle}</title>
  
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Noto+Sans+TC:wght@300;400;500;700;900&family=Noto+Serif+TC:wght@500;700;900&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" referrerpolicy="no-referrer" />

  <style>
    :root {
      --primary: #1c382b;
      --primary-light: #2c5340;
      --accent: #a65d28;
      --accent-gold: #c98838;
      --bg: #faf7f2;
      --card-bg: #ffffff;
      --text: #1f1e1d;
      --text-sub: #595550;
      --border: #e5dfd5;
      --radius: 16px;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background-color: var(--bg);
      background-image: 
        radial-gradient(circle at 15% 20%, rgba(166, 93, 40, 0.06) 0%, transparent 40%),
        radial-gradient(circle at 85% 80%, rgba(28, 56, 43, 0.06) 0%, transparent 40%),
        linear-gradient(135deg, #faf7f2 0%, #f4eee3 100%);
      font-family: 'Noto Sans TC', system-ui, -apple-system, sans-serif;
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px 16px;
    }

    .lock-card {
      width: 100%;
      max-width: 460px;
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      box-shadow: 0 16px 40px rgba(31, 30, 29, 0.08), 0 2px 6px rgba(0,0,0,0.03);
      padding: 38px 30px;
      text-align: center;
      position: relative;
      overflow: hidden;
      animation: fadeIn 0.35s ease-out;
    }

    .lock-card::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0; height: 5px;
      background: linear-gradient(90deg, var(--accent), var(--accent-gold), var(--primary));
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .badge-lock {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #fdf6ec;
      color: var(--accent);
      border: 1px solid rgba(166, 93, 40, 0.25);
      border-radius: 20px;
      padding: 4px 12px;
      font-size: 0.8rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      margin-bottom: 18px;
    }

    .icon-lock {
      width: 64px;
      height: 64px;
      background: linear-gradient(135deg, var(--primary), var(--primary-light));
      color: #fff;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.7rem;
      margin: 0 auto 16px;
      box-shadow: 0 8px 18px rgba(28, 56, 43, 0.22);
    }

    .card-title {
      font-family: 'Noto Serif TC', serif;
      font-size: 1.55rem;
      font-weight: 900;
      color: var(--primary);
      margin-bottom: 8px;
      line-height: 1.35;
    }

    .card-subtitle {
      font-size: 0.9rem;
      color: var(--text-sub);
      line-height: 1.55;
      margin-bottom: 24px;
    }

    .form-group {
      margin-bottom: 18px;
      text-align: left;
    }

    .form-label {
      display: block;
      font-size: 0.84rem;
      font-weight: 700;
      color: var(--text);
      margin-bottom: 8px;
    }

    .input-wrap {
      position: relative;
      display: flex;
      align-items: center;
    }

    .input-icon {
      position: absolute;
      left: 14px;
      color: #8c8882;
      font-size: 0.95rem;
      pointer-events: none;
    }

    .pass-input {
      width: 100%;
      padding: 12px 42px 12px 38px;
      font-size: 1.05rem;
      font-family: 'JetBrains Mono', monospace;
      border: 1.5px solid var(--border);
      border-radius: 10px;
      background: #faf9f6;
      color: var(--text);
      outline: none;
      transition: all 0.2s ease;
    }

    .pass-input:focus {
      background: #ffffff;
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(166, 93, 40, 0.14);
    }

    .btn-eye {
      position: absolute;
      right: 12px;
      background: none;
      border: none;
      color: #8c8882;
      cursor: pointer;
      font-size: 1rem;
      padding: 4px;
    }

    .btn-eye:hover { color: var(--accent); }

    .remember-box {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 20px;
      font-size: 0.85rem;
      color: var(--text-sub);
      user-select: none;
    }

    .remember-box input[type="checkbox"] {
      width: 16px;
      height: 16px;
      accent-color: var(--primary);
      cursor: pointer;
    }

    .btn-submit {
      width: 100%;
      padding: 13px 18px;
      background: linear-gradient(135deg, var(--accent), #8c4c1e);
      color: #ffffff;
      border: none;
      border-radius: 10px;
      font-size: 0.98rem;
      font-weight: 700;
      letter-spacing: 0.02em;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      box-shadow: 0 6px 16px rgba(166, 93, 40, 0.28);
      transition: all 0.2s ease;
    }

    .btn-submit:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(166, 93, 40, 0.36);
    }

    .btn-submit:disabled { opacity: 0.7; cursor: not-allowed; }

    .error-box {
      background: #fdf2f0;
      border: 1px solid #f5c2bc;
      color: #b33936;
      border-radius: 8px;
      padding: 10px 14px;
      font-size: 0.86rem;
      font-weight: 600;
      margin-top: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      animation: shake 0.35s ease;
    }

    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      20%, 60% { transform: translateX(-5px); }
      40%, 80% { transform: translateX(5px); }
    }

    .auto-load-box {
      margin-top: 12px;
      color: var(--primary);
      font-size: 0.88rem;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }

    .footer-desc {
      margin-top: 24px;
      font-size: 0.76rem;
      color: #9c9790;
      line-height: 1.5;
    }
  </style>
</head>
<body>

  <div class="lock-card">
    <div class="badge-lock">
      <i class="fa-solid fa-shield-halved"></i> AES-256 原生端對端加密
    </div>

    <div class="icon-lock">
      <i class="fa-solid fa-lock"></i>
    </div>

    <h1 class="card-title">${siteTitle}</h1>
    <p class="card-subtitle">
      此網站受密碼安全防護，原始碼與資料均經加密封存。<br>
      請輸入授權通行密碼以解鎖閱讀。
    </p>

    <div id="autoLoading" class="auto-load-box" style="display: none;">
      <i class="fa-solid fa-circle-notch fa-spin"></i> 檢測到有效授權，正在自動解密...
    </div>

    <form id="unlockForm" onsubmit="handleUnlock(event)">
      <div class="form-group">
        <label class="form-label" for="passInput">請輸入通行密碼：</label>
        <div class="input-wrap">
          <i class="fa-solid fa-key input-icon"></i>
          <input 
            type="password" 
            id="passInput" 
            class="pass-input" 
            placeholder="請輸入密碼..." 
            autocomplete="current-password"
            required
            autofocus
          >
          <button type="button" class="btn-eye" onclick="toggleVisibility()" aria-label="切換密碼顯示">
            <i class="fa-solid fa-eye" id="eyeIcon"></i>
          </button>
        </div>
      </div>

      <div class="remember-box">
        <input type="checkbox" id="rememberMe" checked>
        <label for="rememberMe">在此瀏覽器記住解鎖狀態 ${rememberDays} 天（免重複輸入）</label>
      </div>

      <button type="submit" id="submitBtn" class="btn-submit">
        <span id="btnText">解鎖閱讀內容</span>
        <i class="fa-solid fa-arrow-right" id="btnIcon"></i>
      </button>

      <div id="errorBanner" class="error-box" style="display: none;">
        <i class="fa-solid fa-circle-exclamation"></i>
        <span>密碼錯誤，請重新確認後輸入。</span>
      </div>
    </form>

    <div class="footer-desc">
      <i class="fa-solid fa-lock-open"></i> 瀏覽器本機記憶體完成秒速解密，原始碼絕不外流。
    </div>
  </div>

  <script type="application/json" id="encryptedPayload">
  {
    "salt": "${saltB64}",
    "iv": "${ivB64}",
    "ciphertext": "${ctB64}"
  }
  </script>

  <script>
    const AUTH_KEY = 'gh_pages_auth';
    const EXPIRY_MS = ${rememberDays} * 24 * 60 * 60 * 1000;

    function b64ToUint8(b64) {
      const bin = atob(b64);
      const len = bin.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = bin.charCodeAt(i);
      }
      return bytes;
    }

    function toggleVisibility() {
      const input = document.getElementById('passInput');
      const icon = document.getElementById('eyeIcon');
      if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'fa-solid fa-eye-slash';
      } else {
        input.type = 'password';
        icon.className = 'fa-solid fa-eye';
      }
    }

    async function decryptPayload(password) {
      const rawPayload = JSON.parse(document.getElementById('encryptedPayload').textContent);
      const salt = b64ToUint8(rawPayload.salt);
      const iv = b64ToUint8(rawPayload.iv);
      const ciphertext = b64ToUint8(rawPayload.ciphertext);

      const enc = new TextEncoder();
      const dec = new TextDecoder();

      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        enc.encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
      );

      const key = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: 100000,
          hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );

      const decryptedBuffer = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        ciphertext
      );

      return dec.decode(decryptedBuffer);
    }

    function renderDecrypted(html) {
      document.open();
      document.write(html);
      document.close();
    }

    async function handleUnlock(event) {
      if (event) event.preventDefault();
      const passInput = document.getElementById('passInput');
      const submitBtn = document.getElementById('submitBtn');
      const btnText = document.getElementById('btnText');
      const btnIcon = document.getElementById('btnIcon');
      const errorBanner = document.getElementById('errorBanner');
      const rememberMe = document.getElementById('rememberMe').checked;

      const password = passInput.value.trim();
      if (!password) return;

      submitBtn.disabled = true;
      btnText.textContent = '正在解密驗證...';
      btnIcon.className = 'fa-solid fa-spinner fa-spin';
      errorBanner.style.display = 'none';

      try {
        const decryptedHtml = await decryptPayload(password);

        if (rememberMe) {
          localStorage.setItem(AUTH_KEY, JSON.stringify({
            pw: password,
            expiry: Date.now() + EXPIRY_MS
          }));
        } else {
          localStorage.removeItem(AUTH_KEY);
        }

        renderDecrypted(decryptedHtml);
      } catch (err) {
        errorBanner.style.display = 'flex';
        passInput.select();
        passInput.focus();
        submitBtn.disabled = false;
        btnText.textContent = '解鎖閱讀內容';
        btnIcon.className = 'fa-solid fa-arrow-right';
      }
    }

    // 自動登入檢測
    (async function checkSavedAuth() {
      const saved = localStorage.getItem(AUTH_KEY) || localStorage.getItem('vegan_bbq_auth');
      if (!saved) return;

      try {
        const data = JSON.parse(saved);
        if (data && data.pw && data.expiry && data.expiry > Date.now()) {
          const autoLoading = document.getElementById('autoLoading');
          const unlockForm = document.getElementById('unlockForm');
          autoLoading.style.display = 'flex';
          unlockForm.style.display = 'none';

          const decryptedHtml = await decryptPayload(data.pw);
          renderDecrypted(decryptedHtml);
        } else {
          localStorage.removeItem(AUTH_KEY);
        }
      } catch (e) {
        localStorage.removeItem(AUTH_KEY);
        const autoLoading = document.getElementById('autoLoading');
        const unlockForm = document.getElementById('unlockForm');
        autoLoading.style.display = 'none';
        unlockForm.style.display = 'block';
      }
    })();
  </script>
</body>
</html>`;

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, encryptedPageHtml, 'utf-8');
  console.log(`✅ 加密成功！已將加密版網頁輸出至: ${path.relative(cwd, targetPath)}`);
})();
