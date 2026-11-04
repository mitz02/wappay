function escapeHtml(value: string): string {
  return String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        char
      ] as string,
  );
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length <= 6) return '***';
  return `${digits.slice(0, 4)}***${digits.slice(-3)}`;
}

function shell(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; margin: 0; padding: 0; }

    @keyframes fadeSlideUp {
      from { opacity: 0; transform: translateY(24px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes pulseGlow {
      0%, 100% { box-shadow: 0 0 20px rgba(52,211,153,0.30), 0 10px 24px rgba(52,211,153,0.18); }
      50%       { box-shadow: 0 0 36px rgba(52,211,153,0.55), 0 14px 32px rgba(52,211,153,0.28); }
    }
    @keyframes shimmer {
      from { background-position: -200% center; }
      to   { background-position: 200% center; }
    }
    @keyframes successPop {
      0%   { transform: scale(0) rotate(-12deg); opacity: 0; }
      70%  { transform: scale(1.16) rotate(4deg); opacity: 1; }
      100% { transform: scale(1) rotate(0deg); opacity: 1; }
    }
    @keyframes checkDraw {
      from { stroke-dashoffset: 100; }
      to   { stroke-dashoffset: 0; }
    }
    @keyframes stepPulse {
      0%, 100% { transform: scale(1); }
      50%       { transform: scale(1.06); }
    }

    body {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px 16px;
      background:
        radial-gradient(circle at 12% 8%, rgba(52,211,153,0.18), transparent 40%),
        radial-gradient(circle at 88% 90%, rgba(99,102,241,0.16), transparent 44%),
        radial-gradient(circle at 50% 50%, rgba(16,185,129,0.06), transparent 60%),
        linear-gradient(145deg, #070d12 0%, #0c1520 50%, #050a0e 100%);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #eef6f3;
      overflow-x: hidden;
    }

    .card {
      position: relative;
      z-index: 1;
      width: 100%;
      max-width: 460px;
      border-radius: 28px;
      padding: 36px 28px 30px;
      background: rgba(255,255,255,0.055);
      border: 1px solid rgba(255,255,255,0.12);
      box-shadow: 0 40px 100px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.12);
      backdrop-filter: blur(22px);
      animation: fadeSlideUp 0.5s ease both;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border-radius: 999px;
      font-size: 10.5px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      font-weight: 700;
      color: #a7f3d0;
      background: rgba(52,211,153,0.12);
      border: 1px solid rgba(52,211,153,0.30);
    }

    h1 {
      font-size: 24px;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: #fff;
      margin: 18px 0 4px;
      text-align: center;
    }
    .sub {
      font-size: 13.5px;
      color: rgba(255,255,255,0.55);
      text-align: center;
      margin-bottom: 22px;
    }

    /* ── Stepper ─────────────────────────────── */
    .stepper {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0;
      margin-bottom: 26px;
    }
    .step {
      display: flex;
      align-items: center;
      gap: 0;
    }
    .step-dot {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      font-weight: 800;
      background: rgba(255,255,255,0.08);
      border: 1.5px solid rgba(255,255,255,0.15);
      color: rgba(255,255,255,0.4);
      transition: all 0.3s ease;
    }
    .step.active .step-dot {
      background: linear-gradient(135deg, #34d399, #10b981);
      border-color: #34d399;
      color: #04231a;
      animation: stepPulse 1.8s ease-in-out infinite;
      box-shadow: 0 0 16px rgba(52,211,153,0.4);
    }
    .step.done .step-dot {
      background: rgba(52,211,153,0.2);
      border-color: #34d399;
      color: #34d399;
    }
    .step-bar {
      width: 36px;
      height: 2px;
      background: rgba(255,255,255,0.12);
      margin: 0 4px;
      transition: background 0.3s ease;
    }
    .step-bar.filled {
      background: linear-gradient(90deg, #34d399, #10b981);
    }

    /* ── Panels ──────────────────────────────── */
    .panel { display: none; animation: fadeSlideUp 0.35s ease both; }
    .panel.active { display: block; }

    label {
      display: block;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: rgba(255,255,255,0.45);
      margin-bottom: 6px;
      font-weight: 600;
    }
    .field { margin-bottom: 16px; }
    input[type="text"],
    input[type="tel"],
    input[type="email"],
    input[type="password"] {
      width: 100%;
      padding: 14px 16px;
      border-radius: 14px;
      border: 1.5px solid rgba(255,255,255,0.12);
      background: rgba(255,255,255,0.05);
      color: #fff;
      font-size: 15px;
      outline: none;
      transition: border 0.2s, box-shadow 0.2s;
    }
    input::placeholder { color: rgba(255,255,255,0.28); }
    input:focus {
      border-color: #34d399;
      box-shadow: 0 0 0 3px rgba(52,211,153,0.18);
    }
    input.invalid {
      border-color: #f87171;
      box-shadow: 0 0 0 3px rgba(248,113,113,0.15);
    }

    /* ── Identity toggle ─────────────────────── */
    .id-toggle {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 16px;
    }
    .id-option {
      padding: 16px 12px;
      border-radius: 16px;
      border: 1.5px solid rgba(255,255,255,0.12);
      background: rgba(255,255,255,0.04);
      text-align: center;
      cursor: pointer;
      transition: all 0.2s ease;
      user-select: none;
    }
    .id-option:hover { border-color: rgba(52,211,153,0.4); }
    .id-option.selected {
      border-color: #34d399;
      background: rgba(52,211,153,0.12);
      box-shadow: 0 0 16px rgba(52,211,153,0.15);
    }
    .id-option .id-emoji { font-size: 26px; display: block; margin-bottom: 6px; }
    .id-option .id-name { font-size: 14px; font-weight: 700; color: #fff; }
    .id-option .id-hint { font-size: 11px; color: rgba(255,255,255,0.4); margin-top: 2px; }

    /* ── PIN boxes ───────────────────────────── */
    .pin-row {
      display: flex;
      gap: 10px;
      justify-content: center;
      margin-bottom: 8px;
    }
    .pin-box {
      width: 54px;
      height: 60px;
      border-radius: 14px;
      border: 1.5px solid rgba(255,255,255,0.12);
      background: rgba(255,255,255,0.05);
      text-align: center;
      font-size: 26px;
      font-weight: 800;
      color: #fff;
      outline: none;
      transition: border 0.2s, box-shadow 0.2s;
    }
    .pin-box:focus {
      border-color: #34d399;
      box-shadow: 0 0 0 3px rgba(52,211,153,0.18);
    }
    .pin-box.filled { border-color: rgba(52,211,153,0.5); }
    .pin-label {
      text-align: center;
      font-size: 12px;
      color: rgba(255,255,255,0.4);
      margin: 18px 0 8px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }

    /* ── Buttons ─────────────────────────────── */
    .btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      width: 100%;
      padding: 16px;
      border: none;
      border-radius: 16px;
      font-size: 15.5px;
      font-weight: 800;
      cursor: pointer;
      transition: transform 0.15s, filter 0.2s;
    }
    .btn:active { transform: scale(0.98); }
    .btn-primary {
      color: #04231a;
      background: linear-gradient(120deg, #34d399, #6ee7b7, #34d399);
      background-size: 200% auto;
      animation: pulseGlow 2.5s ease-in-out infinite, shimmer 3.5s linear infinite;
      margin-top: 8px;
    }
    .btn-primary:hover { filter: brightness(1.06); }
    .btn-secondary {
      color: rgba(255,255,255,0.75);
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.14);
      margin-top: 10px;
    }
    .btn-row { display: flex; gap: 10px; }
    .btn-row .btn { flex: 1; }

    .error-box {
      background: rgba(248,113,113,0.12);
      border: 1px solid rgba(248,113,113,0.35);
      border-radius: 12px;
      padding: 10px 14px;
      font-size: 13px;
      color: #fca5a5;
      margin-bottom: 14px;
      display: none;
    }
    .error-box.show { display: block; }

    .note {
      margin-top: 18px;
      font-size: 11px;
      line-height: 1.6;
      color: rgba(255,255,255,0.3);
      text-align: center;
    }

    /* ── Success ─────────────────────────────── */
    .success-icon {
      width: 88px;
      height: 88px;
      margin: 20px auto 16px;
      border-radius: 50%;
      background: linear-gradient(135deg, #34d399, #059669);
      display: flex;
      align-items: center;
      justify-content: center;
      animation: successPop 0.6s cubic-bezier(0.34,1.56,0.64,1) both;
      box-shadow: 0 12px 36px rgba(52,211,153,0.35);
    }
    .success-icon svg {
      width: 42px; height: 42px;
      stroke: #fff; stroke-width: 3.5;
      stroke-linecap: round; stroke-linejoin: round;
      fill: none;
      stroke-dasharray: 100;
      stroke-dashoffset: 100;
      animation: checkDraw 0.5s 0.4s ease forwards;
    }
    .account-ref {
      display: inline-block;
      margin-top: 12px;
      padding: 10px 22px;
      border-radius: 12px;
      background: rgba(52,211,153,0.12);
      border: 1px solid rgba(52,211,153,0.3);
      font-family: ui-monospace, monospace;
      font-size: 18px;
      font-weight: 700;
      color: #6ee7b7;
      letter-spacing: 0.08em;
    }

    .footer {
      margin-top: 24px;
      font-size: 12px;
      font-weight: 600;
      color: rgba(255,255,255,0.3);
      letter-spacing: 0.03em;
      text-align: center;
    }
    .footer strong { color: rgba(167,243,208,0.6); }

    @media (max-width: 420px) {
      .card { padding: 28px 18px 24px; border-radius: 22px; }
      h1 { font-size: 21px; }
      .pin-box { width: 48px; height: 54px; font-size: 22px; }
      .step-bar { width: 24px; }
    }
  </style>
</head>
<body>
  <main class="card">${body}</main>
  <div class="footer">Powered by <strong>WAPPay</strong> · Secure Registration</div>
</body>
</html>`;
}

export function renderRegisterPage(prefilledPhone = ''): string {
  const body = `
    <span class="badge">🔐 WAPPay Registration</span>
    <h1>Create Your Account</h1>
    <p class="sub">A few quick steps and you&rsquo;re ready to bank on WhatsApp</p>

    <div class="stepper" id="stepper">
      <div class="step active" data-step="1"><div class="step-dot">1</div></div>
      <div class="step-bar"></div>
      <div class="step" data-step="2"><div class="step-dot">2</div></div>
      <div class="step-bar"></div>
      <div class="step" data-step="3"><div class="step-dot">3</div></div>
      <div class="step-bar"></div>
      <div class="step" data-step="4"><div class="step-dot">4</div></div>
    </div>

    <div class="error-box" id="errorBox"></div>

    <form id="regForm" method="POST" action="/register" novalidate>
      <!-- STEP 1: Account -->
      <div class="panel active" data-panel="1">
        <div class="field">
          <label for="fullName">Full Name</label>
          <input type="text" id="fullName" name="fullName" placeholder="e.g. Adebayo Ogunlesi" autocomplete="name" required />
        </div>
        <div class="field">
          <label for="phone">Phone Number</label>
          <input type="tel" id="phone" name="phone" placeholder="08012345678" inputmode="tel"
            value="${escapeHtml(prefilledPhone)}" autocomplete="tel" required />
        </div>
        <div class="field">
          <label for="email">Email <span style="text-transform:none;letter-spacing:0">(optional)</span></label>
          <input type="email" id="email" name="email" placeholder="you@example.com" autocomplete="email" />
        </div>
        <button type="button" class="btn btn-primary" onclick="goStep(2)">Continue →</button>
      </div>

      <!-- STEP 2: Identity -->
      <div class="panel" data-panel="2">
        <p class="sub" style="margin-bottom:16px">Choose a verification method</p>

        <div class="id-toggle">
          <div class="id-option selected" data-id="NIN" onclick="selectId(this)">
            <span class="id-emoji">🆔</span>
            <span class="id-name">NIN</span>
            <span class="id-hint">National ID</span>
          </div>
          <div class="id-option" data-id="BVN" onclick="selectId(this)">
            <span class="id-emoji">🏦</span>
            <span class="id-name">BVN</span>
            <span class="id-hint">Bank Verification</span>
          </div>
        </div>

        <input type="hidden" name="identityType" id="identityType" value="NIN" />

        <div class="field">
          <label for="identityNumber"><span id="idLabel">NIN</span> Number</label>
          <input type="text" id="identityNumber" name="identityNumber"
            placeholder="11-digit number" inputmode="numeric" maxlength="11"
            pattern="\\d{11}" required />
        </div>

        <div class="btn-row">
          <button type="button" class="btn btn-secondary" onclick="goStep(1)">← Back</button>
          <button type="button" class="btn btn-primary" onclick="goStep(3)">Continue →</button>
        </div>
      </div>

      <!-- STEP 3: PIN -->
      <div class="panel" data-panel="3">
        <p class="sub" style="margin-bottom:14px">Create a 4-digit transaction PIN</p>

        <div class="pin-label">Enter PIN</div>
        <div class="pin-row" id="pinRow1">
          <input class="pin-box" type="password" inputmode="numeric" maxlength="1" data-pin="1" />
          <input class="pin-box" type="password" inputmode="numeric" maxlength="1" data-pin="2" />
          <input class="pin-box" type="password" inputmode="numeric" maxlength="1" data-pin="3" />
          <input class="pin-box" type="password" inputmode="numeric" maxlength="1" data-pin="4" />
        </div>
        <input type="hidden" name="pin" id="pin" />

        <div class="pin-label">Confirm PIN</div>
        <div class="pin-row" id="pinRow2">
          <input class="pin-box" type="password" inputmode="numeric" maxlength="1" data-pin="1" />
          <input class="pin-box" type="password" inputmode="numeric" maxlength="1" data-pin="2" />
          <input class="pin-box" type="password" inputmode="numeric" maxlength="1" data-pin="3" />
          <input class="pin-box" type="password" inputmode="numeric" maxlength="1" data-pin="4" />
        </div>
        <input type="hidden" name="pinConfirm" id="pinConfirm" />

        <div class="btn-row" style="margin-top:18px">
          <button type="button" class="btn btn-secondary" onclick="goStep(2)">← Back</button>
          <button type="submit" class="btn btn-primary">Create Account ✓</button>
        </div>
      </div>
    </form>

    <p class="note">🔒 Your NIN/BVN &amp; PIN are encrypted and used only for identity verification.</p>

  <script>
    (function () {
      let current = 1;
      const total = 4;

      window.goStep = function (n) {
        if (n > current && !validateStep(current)) return;
        current = n;
        document.querySelectorAll('.panel').forEach(function (p) {
          p.classList.toggle('active', Number(p.dataset.panel) === n);
        });
        document.querySelectorAll('.step').forEach(function (s) {
          const i = Number(s.dataset.step);
          s.classList.toggle('active', i === n);
          s.classList.toggle('done', i < n);
        });
        document.querySelectorAll('.step-bar').forEach(function (b, i) {
          b.classList.toggle('filled', i < n - 1);
        });
        var err = document.getElementById('errorBox');
        if (err) { err.classList.remove('show'); err.textContent = ''; }
        window.scrollTo({ top: 0, behavior: 'smooth' });
      };

      function validateStep(n) {
        var err = document.getElementById('errorBox');
        function fail(msg, el) {
          err.textContent = msg;
          err.classList.add('show');
          if (el) { el.classList.add('invalid'); el.focus(); }
          return false;
        }
        document.querySelectorAll('.invalid').forEach(function (e) { e.classList.remove('invalid'); });

        if (n === 1) {
          var name = document.getElementById('fullName');
          var phone = document.getElementById('phone');
          if (name.value.trim().length < 2) return fail('Please enter your full name.', name);
          var digits = phone.value.replace(/[^0-9]/g, '');
          if (!/^(?:234|0)[789][01]\\d{8}$/.test(digits)) return fail('Enter a valid Nigerian phone number.', phone);
        }
        if (n === 2) {
          var idNum = document.getElementById('identityNumber');
          var idType = document.getElementById('identityType').value;
          if (!/^\\d{11}$/.test(idNum.value.replace(/\\s/g, ''))) {
            return fail(idType + ' must be exactly 11 digits.', idNum);
          }
        }
        if (n === 3) {
          var pin = collectPin('pinRow1');
          var pin2 = collectPin('pinRow2');
          if (!/^\\d{4}$/.test(pin)) return fail('Enter a 4-digit PIN.');
          if (pin !== pin2) return fail('PINs do not match.');
          if (['0000','1111','1234','9999'].indexOf(pin) !== -1) return fail('Choose a less predictable PIN.');
          document.getElementById('pin').value = pin;
          document.getElementById('pinConfirm').value = pin2;
        }
        if (err) { err.classList.remove('show'); }
        return true;
      }

      function collectPin(rowId) {
        var boxes = document.querySelectorAll('#' + rowId + ' .pin-box');
        var val = '';
        boxes.forEach(function (b) { val += b.value || ''; });
        return val;
      }

      window.selectId = function (el) {
        document.querySelectorAll('.id-option').forEach(function (o) { o.classList.remove('selected'); });
        el.classList.add('selected');
        var type = el.dataset.id;
        document.getElementById('identityType').value = type;
        document.getElementById('idLabel').textContent = type;
        document.getElementById('identityNumber').placeholder = type + ' (11 digits)';
      };

      // PIN box auto-advance
      document.querySelectorAll('.pin-row').forEach(function (row) {
        var boxes = row.querySelectorAll('.pin-box');
        boxes.forEach(function (box, i) {
          box.addEventListener('input', function () {
            box.value = box.value.replace(/[^0-9]/g, '').slice(0, 1);
            box.classList.toggle('filled', !!box.value);
            if (box.value && i < boxes.length - 1) boxes[i + 1].focus();
          });
          box.addEventListener('keydown', function (e) {
            if (e.key === 'Backspace' && !box.value && i > 0) boxes[i - 1].focus();
          });
        });
      });

      // Final submit validation
      document.getElementById('regForm').addEventListener('submit', function (e) {
        if (!validateStep(1) || !validateStep(2) || !validateStep(3)) {
          e.preventDefault();
        }
      });

      // Digit-only filters
      ['identityNumber', 'phone'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.addEventListener('input', function () {
          el.value = el.value.replace(/[^0-9]/g, '');
        });
      });
    })();
  </script>
</body>
</html>`;

  return shell('Create Your Account • WAPPay', body);
}

export function renderRegisterSuccess(accountReference: string): string {
  const body = `
    <span class="badge">✅ Registration Complete</span>
    <div class="success-icon">
      <svg viewBox="0 0 44 44"><polyline points="8,22 18,32 36,14"/></svg>
    </div>
    <h1>Welcome to WAPPay!</h1>
    <p class="sub">Your account is verified and ready to use</p>

    <div style="text-align:center">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.14em;color:rgba(255,255,255,0.4);margin-bottom:6px">
        Virtual Account
      </div>
      <span class="account-ref">${escapeHtml(accountReference)}</span>
    </div>

    <p class="note" style="margin-top:22px">
      Reply <strong style="color:#6ee7b7">register</strong> is done — go back to WhatsApp and say
      <strong style="color:#6ee7b7">balance</strong> or <strong style="color:#6ee7b7">send money</strong> to get started.
    </p>
  `;
  return shell('Registration Complete • WAPPay', body);
}

export function renderRegisterError(message: string): string {
  const body = `
    <span class="badge" style="color:#fca5a5;background:rgba(248,113,113,0.12);border-color:rgba(248,113,113,0.3)">
      ⚠️ Registration Issue
    </span>
    <h1>Almost there</h1>
    <p class="sub">${escapeHtml(message)}</p>
    <button type="button" class="btn btn-primary" onclick="history.back()">← Try Again</button>
  `;
  return shell('Registration Error • WAPPay', body);
}
