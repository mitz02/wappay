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

function shell(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px;
      background:
        radial-gradient(circle at 15% 10%, rgba(255, 122, 162, 0.28), transparent 42%),
        radial-gradient(circle at 85% 88%, rgba(255, 196, 84, 0.22), transparent 45%),
        linear-gradient(145deg, #140915 0%, #1f0d1c 45%, #0d0710 100%);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #fdf6f8;
    }
    .card {
      width: 100%;
      max-width: 480px;
      border-radius: 28px;
      padding: 42px 30px 30px;
      text-align: center;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.14);
      box-shadow: 0 30px 80px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.14);
      backdrop-filter: blur(18px);
    }
    .badge {
      display: inline-block;
      padding: 7px 14px;
      border-radius: 999px;
      font-size: 11px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: #ffd8e6;
      background: rgba(255, 122, 162, 0.14);
      border: 1px solid rgba(255, 122, 162, 0.3);
    }
    .icon { font-size: 58px; line-height: 1; margin: 26px 0 10px; }
    .eyebrow {
      margin: 0 0 8px;
      font-size: 12px;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: #ffb3c8;
    }
    h1 {
      margin: 0;
      font-size: 30px;
      line-height: 1.15;
      letter-spacing: -0.02em;
    }
    .amount {
      margin: 12px 0 22px;
      font-size: 34px;
      font-weight: 800;
      background: linear-gradient(90deg, #ffd1df, #ffc46b);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }
    .detail { margin: -10px 0 20px; font-size: 14px; color: #e6cbd6; }
    blockquote {
      margin: 0 auto 22px;
      max-width: 360px;
      padding: 18px 20px;
      border-radius: 18px;
      font-size: 17px;
      line-height: 1.5;
      color: #fff3f7;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    .from { margin: 0 0 4px; font-size: 15px; color: #f7dce6; }
    .from strong { color: #ffd1df; }
    .for { margin: 0 0 26px; font-size: 13px; color: #b9a3ae; }
    .button, button {
      display: inline-block;
      width: 100%;
      padding: 16px 22px;
      border: 0;
      border-radius: 16px;
      font-size: 16px;
      font-weight: 700;
      cursor: pointer;
      color: #2a0b16;
      background: linear-gradient(120deg, #ffb3c8, #ffc46b);
      box-shadow: 0 14px 30px rgba(255, 150, 180, 0.28);
      text-decoration: none;
    }
    button:active { transform: translateY(1px); }
    .note { margin: 20px 0 0; font-size: 11px; line-height: 1.5; color: #9f8a94; }
    .meta { margin: 14px 0 0; font-size: 11px; color: #8f7a84; word-break: break-all; }
    .claimed { color: #ffd1df; }
    @media (max-width: 420px) {
      .card { padding: 34px 22px 24px; border-radius: 24px; }
      h1 { font-size: 26px; }
      .amount { font-size: 30px; }
    }
  </style>
</head>
<body>
  <main class="card">${body}</main>
</body>
</html>`;
}

export function renderGiftPage(
  token: string,
  data: GiftTokenData,
  claimed: boolean,
): string {
  const meta = GIFT_KINDS[data.k];
  const amount = formatKoboToNaira(BigInt(data.a));
  const sender = data.an ? 'Anonymous' : data.s;
  const message = data.m || 'A little something to make you smile 🎁';
  const safeToken = encodeURIComponent(token);

  if (claimed) {
    const body = `
      <span class="badge">WAPPay Gifts</span>
      <div class="icon">💝</div>
      <p class="eyebrow">Gift claimed</p>
      <h1>It&rsquo;s yours to enjoy!</h1>
      <p class="amount">${escapeHtml(amount)}</p>
      <p class="detail">${meta.emoji} ${escapeHtml(data.n)} &middot; ${escapeHtml(giftDetail(data))}</p>
      <blockquote>&ldquo;${escapeHtml(message)}&rdquo;</blockquote>
      <p class="from">From <strong>${escapeHtml(sender)}</strong></p>
      <p class="for">${escapeHtml(maskPhone(data.r))}</p>
      <a class="button" href="/docs">Done</a>
      <p class="note">Simulated claim complete. In live mode, the gift would now be delivered automatically.</p>
      <p class="meta">Ref: ${escapeHtml(data.ref)}</p>`;
    return shell('Gift claimed • WAPPay', body);
  }

  const body = `
      <span class="badge">WAPPay Gifts</span>
      <div class="icon">🎁</div>
      <p class="eyebrow">A gift for you</p>
      <h1>${escapeHtml(data.n)}</h1>
      <p class="amount">${escapeHtml(amount)}</p>
      <p class="detail">${meta.emoji} ${escapeHtml(giftDetail(data))}</p>
      <blockquote>&ldquo;${escapeHtml(message)}&rdquo;</blockquote>
      <p class="from">From <strong>${escapeHtml(sender)}</strong></p>
      <p class="for">For ${escapeHtml(maskPhone(data.r))}</p>
      <form method="POST" action="/gift/${safeToken}/claim">
        <button type="submit">Claim this gift</button>
      </form>
      <p class="note">Simulated gift &middot; No real funds are moved in test mode.</p>
      <p class="meta">Ref: ${escapeHtml(data.ref)}</p>`;

  return shell('You received a gift • WAPPay', body);
}

export function renderNotFoundPage(): string {
  const body = `
      <span class="badge">WAPPay Gifts</span>
      <div class="icon">🔍</div>
      <p class="eyebrow">Link unavailable</p>
      <h1>This gift link is invalid or expired.</h1>
      <p class="note">Ask the sender for a fresh link, or send <strong>gift</strong> on WhatsApp to create a new one.</p>`;
  return shell('Gift not found • WAPPay', body);
}
