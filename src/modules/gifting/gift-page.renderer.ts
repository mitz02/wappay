import { formatKoboToNaira } from '../../common/types';
import { GIFT_KINDS } from './gift.constants';
import { GiftTokenData } from './gift.service';

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[char] as string,
  );
}

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length <= 6) return '***';
  return `${digits.slice(0, 4)}***${digits.slice(-3)}`;
}

function giftDetail(data: GiftTokenData): string {
  if (data.k === 'DATA' && data.p) {
    return `${data.p} data bundle`;
  }
  if (data.k === 'AIRTIME') {
    return 'Instant airtime top-up';
  }
  return 'Cash to WAPPay wallet';
}

function shell(title: string, body: string, extraStyles = ''): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; margin: 0; padding: 0; }

    @keyframes floatUp {
      0%   { transform: translateY(0) rotate(0deg); opacity: 1; }
      100% { transform: translateY(-100vh) rotate(720deg); opacity: 0; }
    }
    @keyframes giftBounce {
      0%, 100% { transform: scale(1) rotate(-3deg); }
      50%       { transform: scale(1.12) rotate(3deg); }
    }
    @keyframes fadeSlideUp {
      from { opacity: 0; transform: translateY(28px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes pulseGlow {
      0%, 100% { box-shadow: 0 0 24px rgba(255,150,180,0.35), 0 14px 30px rgba(255,150,180,0.22); }
      50%       { box-shadow: 0 0 44px rgba(255,150,180,0.65), 0 18px 40px rgba(255,150,180,0.38); }
    }
    @keyframes shimmer {
      from { background-position: -200% center; }
      to   { background-position: 200% center; }
    }
    @keyframes successPop {
      0%   { transform: scale(0) rotate(-15deg); opacity: 0; }
      70%  { transform: scale(1.18) rotate(5deg); opacity: 1; }
      100% { transform: scale(1) rotate(0deg); opacity: 1; }
    }
    @keyframes checkDraw {
      from { stroke-dashoffset: 100; }
      to   { stroke-dashoffset: 0; }
    }
    @keyframes heartBeat {
      0%, 100% { transform: scale(1); }
      14%  { transform: scale(1.3); }
      28%  { transform: scale(1); }
      42%  { transform: scale(1.2); }
      70%  { transform: scale(1); }
    }

    body {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 20px 16px 0;
      background:
        radial-gradient(circle at 15% 10%, rgba(255,122,162,0.30), transparent 42%),
        radial-gradient(circle at 85% 88%, rgba(255,196,84,0.24), transparent 45%),
        radial-gradient(circle at 50% 50%, rgba(140,70,180,0.12), transparent 60%),
        linear-gradient(145deg, #120814 0%, #1e0b1b 50%, #0c0610 100%);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #fdf6f8;
      overflow-x: hidden;
      position: relative;
    }

    /* ── Confetti particles ─────────────────────────── */
    .confetti-wrap {
      position: fixed;
      inset: 0;
      pointer-events: none;
      overflow: hidden;
      z-index: 0;
    }
    .confetti-wrap span {
      position: absolute;
      bottom: -20px;
      width: 10px;
      height: 10px;
      border-radius: 2px;
      animation: floatUp linear infinite;
    }

    /* ── Main card ─────────────────────────────────── */
    .card {
      position: relative;
      z-index: 1;
      width: 100%;
      max-width: 440px;
      border-radius: 32px;
      padding: 40px 28px 32px;
      text-align: center;
      background: rgba(255,255,255,0.065);
      border: 1px solid rgba(255,255,255,0.15);
      box-shadow:
        0 40px 100px rgba(0,0,0,0.5),
        inset 0 1px 0 rgba(255,255,255,0.16);
      backdrop-filter: blur(24px);
      animation: fadeSlideUp 0.6s ease both;
    }

    /* ── Brand badge ───────────────────────────────── */
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border-radius: 999px;
      font-size: 10.5px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      font-weight: 700;
      color: #ffd8e6;
      background: rgba(255,122,162,0.13);
      border: 1px solid rgba(255,122,162,0.30);
    }
    .badge svg { width: 10px; height: 10px; fill: #ff7aa2; }

    /* ── Giant animated gift icon ──────────────────── */
    .gift-icon {
      font-size: 76px;
      line-height: 1;
      margin: 22px 0 6px;
      display: block;
      animation: giftBounce 2.6s ease-in-out infinite;
    }

    /* ── "From" pill ───────────────────────────────── */
    .from-pill {
      display: inline-block;
      background: rgba(255,196,84,0.12);
      border: 1px solid rgba(255,196,84,0.28);
      border-radius: 999px;
      padding: 5px 14px;
      font-size: 12px;
      font-weight: 600;
      color: #ffdfa6;
      margin: 4px 0 20px;
    }

    /* ── Headline ──────────────────────────────────── */
    h1 {
      font-size: 28px;
      font-weight: 800;
      line-height: 1.18;
      letter-spacing: -0.02em;
      color: #fff;
      margin-bottom: 6px;
      animation: fadeSlideUp 0.6s 0.15s ease both;
    }
    .sub-headline {
      font-size: 14px;
      color: rgba(255,255,255,0.65);
      margin-bottom: 20px;
      animation: fadeSlideUp 0.6s 0.25s ease both;
    }

    /* ── Amount display ────────────────────────────── */
    .amount-wrap {
      margin: 0 0 18px;
      animation: fadeSlideUp 0.6s 0.3s ease both;
    }
    .amount-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.18em;
      color: rgba(255,255,255,0.45);
      margin-bottom: 4px;
    }
    .amount {
      font-size: 40px;
      font-weight: 900;
      background: linear-gradient(100deg, #ffd1df 20%, #ffc46b 60%, #ff9fd4 100%);
      background-size: 200% auto;
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
      animation: shimmer 3s linear infinite;
    }
    .detail-tag {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      margin-top: 6px;
      padding: 4px 12px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.12);
      color: rgba(255,255,255,0.75);
    }

    /* ── Message blockquote ────────────────────────── */
    .message-box {
      margin: 0 0 22px;
      padding: 16px 20px;
      border-radius: 20px;
      font-size: 15.5px;
      line-height: 1.55;
      color: #fff5f8;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.10);
      animation: fadeSlideUp 0.6s 0.4s ease both;
      text-align: left;
    }
    .message-box .msg-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.15em;
      color: rgba(255,200,210,0.6);
      margin-bottom: 8px;
      display: block;
    }
    .message-box.locked {
      position: relative;
      overflow: hidden;
      background:
        linear-gradient(135deg, rgba(255,122,162,0.10), rgba(255,196,84,0.08)),
        rgba(255,255,255,0.04);
      border: 1px dashed rgba(255,180,200,0.35);
      text-align: center;
      padding: 22px 20px;
    }
    .message-box.locked::before {
      content: '🔒';
      display: block;
      font-size: 28px;
      margin-bottom: 10px;
      animation: heartBeat 2.4s ease-in-out infinite;
    }
    .message-box.locked .msg-label {
      margin-bottom: 6px;
      color: rgba(255,210,225,0.85);
    }
    .locked-text {
      display: block;
      font-size: 13px;
      color: rgba(255,255,255,0.5);
      line-height: 1.5;
    }
    .message-box.revealed {
      background: linear-gradient(135deg, rgba(34,197,94,0.10), rgba(255,196,84,0.08));
      border: 1px solid rgba(34,197,94,0.28);
      animation: fadeSlideUp 0.5s ease both, revealPop 0.55s cubic-bezier(0.34,1.56,0.64,1) both;
    }
    @keyframes revealPop {
      0%   { transform: scale(0.92); opacity: 0; }
      100% { transform: scale(1); opacity: 1; }
    }

    /* ── CTA Claim button ──────────────────────────── */
    .btn-claim {
      display: block;
      width: 100%;
      padding: 0;
      border: none;
      border-radius: 18px;
      font-size: 16px;
      font-weight: 800;
      cursor: pointer;
      color: #2a0b16;
      background: linear-gradient(120deg, #ffb3c8, #ffc46b, #ffb3c8);
      background-size: 200% auto;
      text-decoration: none;
      animation: pulseGlow 2.5s ease-in-out infinite, shimmer 4s linear infinite, fadeSlideUp 0.6s 0.5s ease both;
      letter-spacing: 0.01em;
      overflow: hidden;
      position: relative;
      transition: transform 0.15s ease, filter 0.2s ease;
    }
    .btn-claim:hover { filter: brightness(1.06); }
    .btn-claim:active { transform: scale(0.98); }
    .btn-claim-inner {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 17px 22px;
    }
    .btn-claim-icon {
      font-size: 18px;
      animation: giftBounce 1.8s ease-in-out infinite;
      display: inline-block;
    }

    /* ── Secondary link button ─────────────────────── */
    .btn-secondary {
      display: inline-block;
      margin-top: 14px;
      padding: 11px 22px;
      border-radius: 14px;
      font-size: 14px;
      font-weight: 600;
      text-decoration: none;
      color: rgba(255,255,255,0.8);
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.14);
      width: 100%;
      transition: background 0.2s;
    }

    /* ── Recipient line ────────────────────────────── */
    .recipient {
      margin: 16px 0 0;
      font-size: 11.5px;
      color: rgba(255,255,255,0.35);
    }

    /* ── Success state ─────────────────────────────── */
    .success-icon-wrap {
      width: 90px;
      height: 90px;
      margin: 24px auto 16px;
      border-radius: 50%;
      background: linear-gradient(135deg, #22c55e, #16a34a);
      display: flex;
      align-items: center;
      justify-content: center;
      animation: successPop 0.65s cubic-bezier(0.34,1.56,0.64,1) both;
      box-shadow: 0 10px 36px rgba(34,197,94,0.35);
    }
    .success-icon-wrap svg {
      width: 44px;
      height: 44px;
      stroke: #fff;
      stroke-width: 3.5;
      stroke-linecap: round;
      stroke-linejoin: round;
      fill: none;
      stroke-dasharray: 100;
      stroke-dashoffset: 100;
      animation: checkDraw 0.5s 0.5s ease forwards;
    }

    /* ── Not-found state ───────────────────────────── */
    .error-icon {
      font-size: 60px;
      margin: 24px 0 12px;
      display: block;
      filter: grayscale(0.3);
    }

    /* ── Notes / meta ──────────────────────────────── */
    .note {
      margin: 18px 0 0;
      font-size: 11px;
      line-height: 1.6;
      color: rgba(255,255,255,0.3);
    }
    .meta {
      margin: 10px 0 0;
      font-size: 10px;
      color: rgba(255,255,255,0.18);
      word-break: break-all;
    }

    /* ── Footer ────────────────────────────────────── */
    .footer {
      position: relative;
      z-index: 1;
      margin: 28px 0 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 600;
      color: rgba(255,255,255,0.35);
      letter-spacing: 0.03em;
    }
    .footer strong { color: rgba(255,210,230,0.65); font-weight: 700; }
    .footer .heart {
      font-size: 14px;
      animation: heartBeat 1.8s ease-in-out infinite;
      display: inline-block;
    }

    @media (max-width: 420px) {
      .card { padding: 32px 20px 26px; border-radius: 26px; }
      h1 { font-size: 24px; }
      .amount { font-size: 34px; }
      .gift-icon { font-size: 64px; }
    }
    ${extraStyles}
  </style>
</head>
<body>
  <div class="confetti-wrap" id="confetti"></div>
  <main class="card">${body}</main>
  <div class="footer">
    <span>Powered by</span>
    <strong>WAPPay</strong>
    <span class="heart">❤️</span>
  </div>
  <script>
    // Confetti generator
    (function(){
      const wrap = document.getElementById('confetti');
      if (!wrap) return;
      const colors = ['#ff7aa2','#ffc46b','#b388ff','#64ffda','#ffeb3b','#ff80ab','#80d8ff'];
      const count = 22;
      for (let i = 0; i < count; i++) {
        const s = document.createElement('span');
        const size = 7 + Math.random() * 9;
        s.style.cssText = [
          'left:' + Math.random()*100 + '%',
          'width:' + size + 'px',
          'height:' + size + 'px',
          'border-radius:' + (Math.random() > 0.5 ? '50%' : '2px'),
          'background:' + colors[Math.floor(Math.random()*colors.length)],
          'opacity:' + (0.5 + Math.random()*0.5),
          'animation-duration:' + (4 + Math.random()*6) + 's',
          'animation-delay:' + (Math.random()*5) + 's',
        ].join(';');
        wrap.appendChild(s);
      }
    })();
  </script>
</body>
</html>`;
}

function senderDisplay(data: GiftTokenData): string {
  if (data.an) return 'a secret admirer';
  return data.s || 'someone special';
}

export function renderGiftPage(
  token: string,
  data: GiftTokenData,
  claimed: boolean,
): string {
  const meta = GIFT_KINDS[data.k];
  const amount = formatKoboToNaira(BigInt(data.a));
  const sender = data.an ? 'Anonymous 🕵️' : escapeHtml(data.s);
  const fromName = escapeHtml(senderDisplay(data));
  const message = data.m || 'A little something to make you smile 🎁';
  const safeToken = encodeURIComponent(token);
  const kindLabel =
    data.k === 'AIRTIME' ? 'Airtime' : data.k === 'DATA' ? 'Data Bundle' : 'Cash Gift';

  if (claimed) {
    const body = `
      <span class="badge">
        <svg viewBox="0 0 12 12"><path d="M2 6.5L5 9.5L10 3"/></svg>
        WAPPay Gifts
      </span>

      <div class="success-icon-wrap">
        <svg viewBox="0 0 44 44">
          <polyline points="8,22 18,32 36,14"/>
        </svg>
      </div>

      <h1>Gift Claimed!</h1>
      <p class="sub-headline">It&rsquo;s all yours to enjoy</p>

      <div class="amount-wrap">
        <div class="amount-label">${kindLabel} Value</div>
        <div class="amount">${escapeHtml(amount)}</div>
        <span class="detail-tag">${meta.emoji} ${escapeHtml(data.n)}</span>
      </div>

      <div class="message-box revealed">
        <span class="msg-label">💬 Message from ${fromName}</span>
        &ldquo;${escapeHtml(message)}&rdquo;
      </div>

      <span class="from-pill">🎁 From ${sender}</span>
      <div class="recipient">Recipient · ${escapeHtml(maskPhone(data.r))}</div>

      <a class="btn-secondary" href="/">Back to WAPPay</a>
      <p class="note">Simulated claim · No real funds are moved in test mode.</p>
      <p class="meta">Ref: ${escapeHtml(data.ref)}</p>`;

    return shell('Gift claimed 🎉 • WAPPay', body);
  }

  const body = `
      <span class="badge">
        <svg viewBox="0 0 12 12"><path d="M6 1L7.5 4.5H11L8.25 6.75L9.5 10.5L6 8.25L2.5 10.5L3.75 6.75L1 4.5H4.5Z" stroke="none"/></svg>
        WAPPay Gifts
      </span>

      <span class="gift-icon">🎁</span>

      <h1>You received a Gift<br/>from ${fromName}</h1>
      <p class="sub-headline">Click to view the message and claim it</p>

      <div class="amount-wrap">
        <div class="amount-label">${kindLabel} · ${escapeHtml(data.n)}</div>
        <div class="amount">${escapeHtml(amount)}</div>
        <span class="detail-tag">${meta.emoji} ${escapeHtml(giftDetail(data))}</span>
      </div>

      <div class="message-box locked">
        <span class="msg-label">💌 A message is waiting for you</span>
        <span class="locked-text">Tap below to reveal your personal message</span>
      </div>

      <form method="POST" action="/gift/${safeToken}/claim">
        <button class="btn-claim" type="submit">
          <span class="btn-claim-inner">
            <span class="btn-claim-icon">✨</span>
            View Message &amp; Claim Gift
          </span>
        </button>
      </form>

      <div class="recipient">For ${escapeHtml(maskPhone(data.r))}</div>

      <p class="note">Simulated gift · No real funds are moved in test mode.</p>
      <p class="meta">Ref: ${escapeHtml(data.ref)}</p>`;

  return shell('You received a Gift 🎁 • WAPPay', body);
}

export function renderNotFoundPage(): string {
  const body = `
      <span class="badge">WAPPay Gifts</span>
      <span class="error-icon">🔍</span>
      <h1>This gift link is invalid or expired.</h1>
      <p class="sub-headline">The link may have already been claimed, or it has expired.</p>
      <p class="note">Ask the sender for a fresh link, or send <strong style="color:#ffd1df">gift</strong> on WhatsApp to create a new one.</p>`;
  return shell('Gift not found • WAPPay', body);
}
