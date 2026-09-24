const fs = require('fs');
const path = require('path');

const password = process.argv[2] || 'vegan2026';
console.log(`Starting encryption process with password: "${password}"...`);

const sourceFile = path.join(__dirname, '..', 'index_5.html');
const targetFile = path.join(__dirname, '..', 'index.html');

let rawHtml = fs.readFileSync(sourceFile, 'utf-8');

// Inject the "鎖定網頁" (Lock Page) button into the sticky nav if not already present
const lockButtonHtml = `
      <div class="nav-checklist-indicator" onclick="lockPage()" style="cursor:pointer; background:rgba(166,93,40,0.15); color:var(--caramel-wood); border:1px solid rgba(166,93,40,0.4);" title="鎖定本指南並清除 7 天授權">
        <i class="fa-solid fa-lock"></i> 鎖定網頁
      </div>`;

if (!rawHtml.includes('onclick="lockPage()"')) {
  rawHtml = rawHtml.replace(
    '      <div class="nav-checklist-indicator" onclick="document.getElementById(\'prep-checklist\')',
    lockButtonHtml + '\n      <div class="nav-checklist-indicator" onclick="document.getElementById(\'prep-checklist\')'
  );
}

// Inject the lockPage function into the script section if not already present
const lockScript = `
    function lockPage() {
      if (confirm('確定要鎖定本指南並清除此瀏覽器的 7 天登入授權嗎？')) {
        localStorage.removeItem('vegan_bbq_auth');
        location.reload();
      }
    }
`;

if (!rawHtml.includes('function lockPage()')) {
  rawHtml = rawHtml.replace('function updateChecklistProgress() {', lockScript + '\n    function updateChecklistProgress() {');
}

(async () => {
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

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

  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    enc.encode(rawHtml)
  );

  const saltB64 = Buffer.from(salt).toString('base64');
  const ivB64 = Buffer.from(iv).toString('base64');
  const ctB64 = Buffer.from(ciphertextBuffer).toString('base64');

  console.log(`Encryption successful! Ciphertext size: ${ctB64.length} chars.`);

  // Self-test decryption
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
  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv },
    testKey,
    ciphertextBuffer
  );
  if (dec.decode(decryptedBuffer) !== rawHtml) {
    throw new Error('Self-test failed: Decrypted output does not match original HTML!');
  }
  console.log('Self-test passed: Decrypted content exactly matches injected source HTML.');

  // Create the encrypted wrapper HTML
  const wrapperHtml = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>私密受保護專案｜極致素烤全書</title>
  
  <!-- Google Fonts: Noto Sans TC, Noto Serif TC, Playfair Display, JetBrains Mono -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Noto+Sans+TC:wght@300;400;500;700;900&family=Noto+Serif+TC:wght@500;700;900&family=Playfair+Display:ital,wght@0,600;0,800;1,600&display=swap" rel="stylesheet">
  
  <!-- FontAwesome 6 CDN -->
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" integrity="sha512-DTOQO9RWCH3ppGqcWaEA1BIZOC6xxalwEsw9c2QQeAIftl+Vegovlnee1c9QX4TctnWMn13TZye+giMm8e2LwA==" crossorigin="anonymous" referrerpolicy="no-referrer" />

  <style>
    :root {
      --primary-forest: #1c382b;
      --primary-forest-light: #2c5340;
      --caramel-wood: #a65d28;
      --caramel-gold: #c98838;
      --caramel-soft: #fdf6ec;
      --charcoal-black: #1f1e1d;
      --charcoal-sub: #4b4845;
      --parchment-cream: #faf7f2;
      --card-white: #ffffff;
      --border-subtle: #e5dfd5;
      --border-accent: #d4a973;
      --radius-md: 14px;
      --radius-lg: 20px;
      --font-serif: 'Noto Serif TC', 'Playfair Display', serif;
      --font-sans: 'Noto Sans TC', system-ui, -apple-system, sans-serif;
      --font-mono: 'JetBrains Mono', monospace;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-tap-highlight-color: transparent;
    }

    body {
      background-color: var(--parchment-cream);
      background-image: 
        radial-gradient(circle at 10% 20%, rgba(166, 93, 40, 0.05) 0%, transparent 40%),
        radial-gradient(circle at 90% 80%, rgba(28, 56, 43, 0.05) 0%, transparent 40%),
        linear-gradient(135deg, #faf7f2 0%, #f4eee3 100%);
      font-family: var(--font-sans);
      color: var(--charcoal-black);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px 16px;
    }

    .lock-container {
      width: 100%;
      max-width: 480px;
      background: var(--card-white);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-lg);
      box-shadow: 0 16px 40px rgba(31, 30, 29, 0.09), 0 2px 6px rgba(0,0,0,0.04);
      padding: 40px 32px;
      text-align: center;
      position: relative;
      overflow: hidden;
      animation: fadeIn 0.4s ease-out;
    }

    .lock-container::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 6px;
      background: linear-gradient(90deg, var(--caramel-wood), var(--caramel-gold), var(--primary-forest));
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(14px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .lock-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: var(--caramel-soft);
      color: var(--caramel-wood);
      border: 1px solid rgba(166, 93, 40, 0.25);
      border-radius: 20px;
      padding: 4px 14px;
      font-size: 0.82rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      margin-bottom: 20px;
    }

    .lock-icon-wrap {
      width: 68px;
      height: 68px;
      background: linear-gradient(135deg, var(--primary-forest), var(--primary-forest-light));
      color: #ffffff;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.8rem;
      margin: 0 auto 18px;
      box-shadow: 0 8px 20px rgba(28, 56, 43, 0.25);
    }

    .lock-title {
      font-family: var(--font-serif);
      font-size: 1.65rem;
      font-weight: 900;
      color: var(--primary-forest);
      margin-bottom: 8px;
      line-height: 1.3;
    }

    .lock-subtitle {
      font-size: 0.92rem;
      color: var(--charcoal-sub);
      line-height: 1.6;
      margin-bottom: 26px;
    }

    .form-group {
      margin-bottom: 18px;
      text-align: left;
    }

    .form-label {
      display: block;
      font-size: 0.85rem;
      font-weight: 700;
      color: var(--charcoal-black);
      margin-bottom: 8px;
    }

    .input-wrapper {
      position: relative;
      display: flex;
      align-items: center;
    }

    .input-icon-left {
      position: absolute;
      left: 14px;
      color: #8c8882;
      font-size: 1rem;
      pointer-events: none;
    }

    .password-input {
      width: 100%;
      padding: 13px 44px 13px 40px;
      font-size: 1.05rem;
      font-family: var(--font-mono);
      border: 1.5px solid var(--border-subtle);
      border-radius: var(--radius-md);
      background: #faf9f6;
      color: var(--charcoal-black);
      outline: none;
      transition: all 0.2s ease;
    }

    .password-input:focus {
      background: #ffffff;
      border-color: var(--caramel-wood);
      box-shadow: 0 0 0 3px rgba(166, 93, 40, 0.15);
    }

    .toggle-visibility-btn {
      position: absolute;
      right: 12px;
      background: transparent;
      border: none;
      color: #8c8882;
      cursor: pointer;
      font-size: 1.05rem;
      padding: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: color 0.2s ease;
    }

    .toggle-visibility-btn:hover {
      color: var(--caramel-wood);
    }

    .remember-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 22px;
      font-size: 0.86rem;
      color: var(--charcoal-sub);
      user-select: none;
    }

    .remember-wrap input[type="checkbox"] {
      width: 16px;
      height: 16px;
      accent-color: var(--primary-forest);
      cursor: pointer;
    }

    .remember-wrap label {
      cursor: pointer;
    }

    .submit-btn {
      width: 100%;
      padding: 14px 20px;
      background: linear-gradient(135deg, var(--caramel-wood), #8c4c1e);
      color: #ffffff;
      border: none;
      border-radius: var(--radius-md);
      font-size: 1rem;
      font-weight: 700;
      letter-spacing: 0.03em;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      box-shadow: 0 6px 16px rgba(166, 93, 40, 0.3);
      transition: all 0.2s ease;
    }

    .submit-btn:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 8px 22px rgba(166, 93, 40, 0.4);
      background: linear-gradient(135deg, #b3662e, var(--caramel-wood));
    }

    .submit-btn:active:not(:disabled) {
      transform: translateY(0);
    }

    .submit-btn:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }

    .error-banner {
      background: #fdf2f0;
      border: 1px solid #f5c2bc;
      color: #b33936;
      border-radius: 8px;
      padding: 10px 14px;
      font-size: 0.88rem;
      font-weight: 600;
      margin-top: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      animation: shake 0.4s ease;
    }

    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      20%, 60% { transform: translateX(-6px); }
      40%, 80% { transform: translateX(6px); }
    }

    .auto-decrypt-box {
      margin-top: 14px;
      color: var(--primary-forest);
      font-size: 0.9rem;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }

    .footer-note {
      margin-top: 26px;
      font-size: 0.78rem;
      color: #9c9790;
      line-height: 1.5;
    }
  </style>
</head>
<body>

  <div class="lock-container" id="lockCard">
    <div class="lock-badge">
      <i class="fa-solid fa-shield-halved"></i> AES-256 原生端對端加密
    </div>

    <div class="lock-icon-wrap">
      <i class="fa-solid fa-lock"></i>
    </div>

    <h1 class="lock-title">極致素烤全書</h1>
    <p class="lock-subtitle">
      食材圖鑑、無五辛特調醬與科學燒烤指南<br>
      <span style="font-size: 0.82rem; color: #7a7672;">本專案已受密碼防護，請輸入授權通行碼以解鎖閱讀。</span>
    </p>

    <!-- 自動登入狀態指示 -->
    <div id="autoLoading" class="auto-decrypt-box" style="display: none;">
      <i class="fa-solid fa-circle-notch fa-spin"></i> 檢測到 7 天有效授權，正在自動解密...
    </div>

    <form id="unlockForm" onsubmit="handleUnlock(event)">
      <div class="form-group">
        <label class="form-label" for="passInput">請輸入通行密碼：</label>
        <div class="input-wrapper">
          <i class="fa-solid fa-key input-icon-left"></i>
          <input 
            type="password" 
            id="passInput" 
            class="password-input" 
            placeholder="請輸入密碼..." 
            autocomplete="current-password"
            required
            autofocus
          >
          <button 
            type="button" 
            id="toggleVisBtn" 
            class="toggle-visibility-btn" 
            onclick="togglePasswordVisibility()" 
            aria-label="切換密碼顯示"
          >
            <i class="fa-solid fa-eye" id="toggleIcon"></i>
          </button>
        </div>
      </div>

      <div class="remember-wrap">
        <input type="checkbox" id="rememberMe" checked>
        <label for="rememberMe">在此瀏覽器記住解鎖狀態 7 天（免重複輸入）</label>
      </div>

      <button type="submit" id="submitBtn" class="submit-btn">
        <span id="btnText">解鎖閱讀指南</span>
        <i class="fa-solid fa-arrow-right" id="btnIcon"></i>
      </button>

      <div id="errorBanner" class="error-banner" style="display: none;">
        <i class="fa-solid fa-circle-exclamation"></i>
        <span id="errorText">密碼錯誤，請重新確認後輸入。</span>
      </div>
    </form>

    <div class="footer-note">
      <i class="fa-solid fa-lock-open"></i> 解密於瀏覽器本機記憶體完成，原始碼絕不外流。<br>
      © 2026 極致素烤研發小組 · 版權所有
    </div>
  </div>

  <!-- 加密數據載體（AES-GCM-256） -->
  <script type="application/json" id="encryptedPayload">
  {
    "salt": "${saltB64}",
    "iv": "${ivB64}",
    "ciphertext": "${ctB64}"
  }
  </script>

  <script>
    const AUTH_KEY = 'vegan_bbq_auth';
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

    function b64ToUint8(b64) {
      const bin = atob(b64);
      const len = bin.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = bin.charCodeAt(i);
      }
      return bytes;
    }

    function togglePasswordVisibility() {
      const input = document.getElementById('passInput');
      const icon = document.getElementById('toggleIcon');
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
            expiry: Date.now() + SEVEN_DAYS_MS
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
        btnText.textContent = '解鎖閱讀指南';
        btnIcon.className = 'fa-solid fa-arrow-right';
      }
    }

    // 自動登入檢測
    (async function checkSavedAuth() {
      const saved = localStorage.getItem(AUTH_KEY);
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

  fs.writeFileSync(targetFile, wrapperHtml, 'utf-8');
  console.log(`Successfully generated encrypted "${targetFile}"!`);
})();
