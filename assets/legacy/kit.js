// Спільні шматки екранів Legacy Mode (розмітка з макета ChatGPT 26.11_v5).

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

export const fullName = (hero) => [hero.firstName, hero.lastName].map((s) => (s || '').trim()).filter(Boolean).join(' ');
export const initials = (hero) => [hero.firstName, hero.lastName].map((s) => (s || '').trim().charAt(0)).join('').toUpperCase() || '17';

export function shell(content) {
  return `<div class="legacy-shell">
    <header class="legacy-topbar"><div class="legacy-topbar__inner">
      <button type="button" class="wordmark-link" data-go="#home" aria-label="Головна Football Legacy"><span class="legacy-wordmark"><b>Legacy</b> Mode</span></button><span class="stage-badge">STAGE</span>
      <a class="topbar-link" href="#catalog">Усі світи</a>
    </div></header>${content}
  </div>`;
}

// Формулювання залежить від перемикача «Реальні імена» (№265).
export function disclaimer(realNames) {
  return `<p class="disclaimer">${realNames
    ? 'Вигадана історія: події й репліки вигадані, збіги випадкові. Клуби реальні; реальні люди з’являються лише в нейтральних і добрих сценах.'
    : 'Вигадана історія: герої й події вигадані, збіги випадкові. Клуби — реальні, люди — ні.'}</p>`;
}

export function medal(icon = '★', level = 'gold', extra = '') {
  const colors = { bronze: ['#7f5d42', '#b98155'], silver: ['#758181', '#bec9c7'], gold: ['#8f6a18', '#F4C430'], legend: ['#66548d', '#A98FDB'] };
  const c = colors[level] || colors.gold;
  const id = `g-${icon.codePointAt(0)}-${level}`;
  return `<div class="medal ${extra}"><svg viewBox="0 0 80 92" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${c[1]}"/><stop offset="1" stop-color="${c[0]}"/></linearGradient></defs><path d="M21 5h38l-6 24H27z" fill="${c[0]}" opacity=".9"/><path d="M40 20 68 35v32L40 85 12 67V35z" fill="url(#${id})" stroke="rgba(255,255,255,.35)" stroke-width="2"/><path d="M40 28 60 39v23L40 76 20 62V39z" fill="rgba(10,15,12,.28)"/><text x="40" y="59" text-anchor="middle" font-size="24" font-family="Onest" fill="#fff">${icon}</text></svg></div>`;
}

export const heroSvg = () => `<svg viewBox="0 0 120 170" aria-hidden="true"><circle cx="60" cy="36" r="25" fill="var(--accent)"/><path d="M27 76q33-25 66 0l13 80H14z" fill="var(--accent)" opacity=".8"/><path d="M31 83 8 128l18 8 21-44M89 83l23 45-18 8-21-44" fill="var(--accent)" opacity=".65"/><text x="60" y="125" text-anchor="middle" font-family="IBM Plex Mono" font-size="28" font-weight="700" fill="var(--accent-ink)">17</text></svg>`;

export const soonCard = (icon, title, text) => `<article class="card mode-card soon"><span class="badge">Скоро</span><div class="mode-icon">${icon}</div><h3>${title}</h3><p>${text}</p></article>`;
export const achievementMini = ([icon, title, status, level, extra]) => `<div class="achievement-mini">${medal(icon, level, extra)}<strong>${title}</strong><small>${status}</small></div>`;
export const rule = (n, title, text) => `<div class="rule-row"><span class="rule-num">${n}</span><div><strong>${title}</strong><p>${text}</p></div></div>`;

export const difficultyClass = (name) => ({ 'Легко': 'easy', 'Нормально': 'normal', 'Складно': 'hard' }[name] || 'normal');

// Стани «завантаження» й «помилка». Повертає null, якщо екран звичайний.
export function statePanel(view) {
  if (view === 'loading') return shell(`<div class="content"><div class="state-panel"><span class="eyebrow">Завантажуємо</span><div class="skeleton" style="width:45%;margin:auto"></div><div class="skeleton-grid">${'<div class="skeleton-card"><div class="skeleton"></div><div class="skeleton" style="width:70%"></div></div>'.repeat(3)}</div></div></div>`);
  if (view === 'error') return shell(`<div class="content"><article class="card state-panel"><span class="eyebrow danger-text">Не вдалося завантажити</span><h2>Щось пішло не так</h2><p>Перевір з’єднання й спробуй ще раз. Твій прогрес збережено.</p><button type="button" class="button" data-retry>Спробувати ще</button></article></div>`);
  return null;
}
