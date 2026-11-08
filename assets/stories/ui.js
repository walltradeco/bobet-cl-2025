// BoBet Stories — екрани: вхід, головна, створення героя, гра. Рушій (engine.js) і збереження (store.js) — окремо.
// Сторінка викликає boot({ sb, root }); sb — клієнт supabase-js (або мок з tools/stories_mock_sb.js).
import * as E from './engine.js';
import { createStore, canGoBack, ROLE, CHAPTER } from './store.js';
import { tipBtn, initTip } from '../common/tip.js';
import { renderLogin, getSession, bindMe } from '../common/auth.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const para = (t) => esc(t).replace(/\n+/g, '<br>');
const fmt = (n) => (n > 0 ? '+' + n : n < 0 ? '\u2212' + (-n) : String(n));

const POS = {
  ST: { label: 'Нападник', sub: 'Голи й завершальний удар' },
  MF: { label: 'Півзахисник', sub: 'Гра, пас, баланс команди' },
  DF: { label: 'Захисник', sub: 'Відбір, позиція, залізна лінія' },
  GK: { label: 'Воротар', sub: 'Реакція й останній рубіж' },
};
const CLOSE = {
  father: { label: 'Батько', sub: 'Підтримка й вимогливість' },
  girlfriend: { label: 'Дівчина', sub: 'Тил, але й свої очікування' },
  friend: { label: 'Друг', sub: 'Той, хто знав тебе до футболу' },
  none: { label: 'Без близької людини', sub: 'Сам по собі' },
};
const MODULES = {
  personal: 'Особисте — стосунки з близькою людиною',
  injuries: 'Травми',
  scandals: 'Скандали-приколи',
};
const EVENT_FREQ = {
  off: { label: 'Без подій', sub: 'Лише основний сюжет' },
  low: { label: 'Рідко', sub: 'До 1 випадку за сезон' },
  medium: { label: 'Помірно', sub: 'До 3 випадків' },
  high: { label: 'Часто', sub: 'До 5 випадків' },
};
const STAT_HELP = {
  rep: 'Репутація: що про тебе думають у клубі та футбольному світі.',
  pop: 'Популярність: наскільки тебе впізнають вболівальники й медіа.',
  wealth: 'Багатство: гроші, які ти заробив, і наскільки вони тебе тримають або звільняють.',
  rel: 'Стосунки: атмосфера у роздягальні й поза нею.',
  fit: 'Фізична форма: втома, відновлення, готовність до матчу.',
  ment: 'Ментальність: стійкість, коли йде не по плану.',
  trust: 'Довіра тренера: від неї залежить, чи доведеться доводити право грати.',
  disc: 'Дисципліна: режим, вчасність, поведінка.',
  sk: 'Ігрова навичка твоєї позиції.',
};
const GROUPS = [
  ['core', 'Кар’єра', 'Стрілки показують зміну від початку епізоду.'],
  ['state', 'Стан', 'Фізична форма й ментальність. Вони додаються до шансів у моментах матчу та в рішеннях.'],
  ['skill', 'Навички', 'Три навички твоєї позиції. Вони додаються до шансів у моментах матчу.'],
  ['hidden', 'Характер', 'Приховані за замовчуванням показники; на Рівні 1 ти їх бачиш.'],
];

const newForm = () => ({ name: '', club: '', pos: 'ST', archetype: 'perfectionist', close: 'father', event_freq: '', modules: { personal: true, injuries: false, scandals: false }, error: '' });
const App = { sb: null, root: null, store: null, user: null, screen: 'boot', runs: [], run: null, content: null, friends: null, busy: false, toast: null, confirm: null, form: newForm() };
if (typeof window !== 'undefined') window.__stories = App;

const ss = {
  get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch (e) { /* ігноруємо */ } },
};

export async function boot({ sb, root }) {
  App.sb = sb; App.root = root; App.store = createStore(sb);
  initTip();
  root.addEventListener('click', onClick);
  root.addEventListener('input', onInput);
  if (sb.auth.onAuthStateChange) sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT') location.reload(); });
  await start();
}

async function start() {
  App.root.innerHTML = '<div class="app"><div class="loading">Завантажую…</div></div>';
  const session = await getSession(App.sb);
  if (!session) return showLogin();
  App.user = session.user;
  await bindMe(App.sb);
  await loadHome(true);
}

function showLogin() {
  App.screen = 'login';
  App.root.innerHTML = '<div class="app"></div>';
  renderLogin(App.root.firstChild, App.sb, { title: 'BoBet Stories', lead: 'Інтерактивні історії у світі футболу. Вхід — за кодом із пошти, як на BoOrbit.', onDone: start });
}

async function loadHome(allowResume) {
  try {
    App.runs = await App.store.myRuns();
  } catch (e) {
    App.screen = 'error';
    App.root.innerHTML = shell('', `<div class="card"><h2>Не вдалося завантажити історії</h2><p class="dim">${esc(e.message)}</p><div class="actions"><button class="btn" data-act="retry">Спробувати ще раз</button></div></div>`);
    return;
  }
  // старі підсумки із сирим шаблоном у назві: підвантажуємо контент, щоб підставити клуб героя (див. tplFree)
  if (!App.content && App.runs.some((r) => r.summary && /\{[^}]*\}/.test(String(r.summary.title || '')))) {
    try { App.content = await App.store.loadContent(); } catch (e) { /* не критично: tplFree прибере шаблон */ }
  }
  const active = App.runs.find((r) => r.status === 'active');
  if (allowResume && active && ss.get('stories_screen') === 'game') return openRun(active);
  App.screen = 'home'; ss.set('stories_screen', null);
  render();
}

// ───────────────────────── оболонка ─────────────────────────
function shell(right, body) {
  return `<div class="app">
    <div class="topbar"><span class="brand">Bo<b>Bet</b> Stories</span><span class="badge stage">STAGE</span><span class="spacer"></span>${right || ''}</div>
    ${body}
  </div>`;
}
function render() {
  if (App.screen === 'home') return renderHome();
  if (App.screen === 'create') return renderCreate();
  if (App.screen === 'game') return renderGame();
}
function setHtml(html) {
  App.root.innerHTML = html;
  App.root.classList.toggle('busy', App.busy);
  if (App.toast) App.root.insertAdjacentHTML('beforeend', `<div class="toast" role="alert"><span>${esc(App.toast)}</span><button class="iconbtn" data-act="toast-close">Гаразд</button></div>`);
}

// ───────────────────────── головна ─────────────────────────
function runLine(r) {
  const hero = (r.settings && r.settings.hero) || {};
  const pos = (POS[hero.pos] || {}).label || '';
  return `${esc(hero.name || 'Герой')} · ${esc(pos)}`;
}
function renderHome() {
  const active = App.runs.find((r) => r.status === 'active');
  const finished = App.runs.filter((r) => r.status === 'finished');
  const right = `<span class="dim" style="font-size:13px">${esc((App.user && App.user.email) || '')}</span><button class="iconbtn" data-act="logout">Вийти</button>`;
  let mine = '';
  const list = App.runs.filter((r) => r.status === 'active' || r.status === 'finished').slice(0, 8);
  if (list.length) {
    mine = `<div class="card"><h3>Мої проходження</h3>` + list.map((r) => {
      const st = r.state || {};
      const ep = st.cursor ? st.cursor.ep + 1 : 1;
      const sum = r.summary;
      const meta = r.status === 'active' ? `У грі · епізод ${ep}` : `Завершено · ${esc(tplFree(sum, App.content))}`;
      const acts = r.status === 'active'
        ? `<button class="btn primary sm" data-act="resume" data-id="${esc(r.id)}">Продовжити</button>${App.confirm === r.id ? `<button class="btn danger sm" data-act="abandon" data-id="${esc(r.id)}">Точно кинути?</button>` : `<button class="btn ghost sm" data-act="abandon-ask" data-id="${esc(r.id)}">Кинути</button>`}`
        : `<button class="btn sm" data-act="resume" data-id="${esc(r.id)}">Підсумок</button>`;
      return `<div class="run"><div><div class="who">${runLine(r)}</div><div class="meta">${meta}</div></div><div class="acts">${acts}</div></div>`;
    }).join('') + `</div>`;
  }
  const newBtn = active
    ? `<button class="btn primary" data-act="resume" data-id="${esc(active.id)}">Продовжити кар’єру</button>`
    : `<button class="btn primary" data-act="new">Нова історія</button>`;
  setHtml(shell(right, `
    <h1>Обери історію</h1>
    <p class="lead">Ти керуєш рішеннями, а історія відповідає. Усе, що ти бачиш, — вигадане.</p>
    <div class="home-grid">
      <div class="card role"><h2>Футболіст ${tipBtn('Кар’єра гравця з нуля: Розділ 1 «Дебют» — перший сезон у молодіжній команді клубу на твій вибір, 5 епізодів. Далі — нові розділи.')}</h2>
        <p class="dim" style="margin:0">Розділ 1 · «Дебют». П’ять епізодів першого сезону: контракт, дербі, тиск, конфлікт і вибір, що визначить, ким ти станеш.</p>
        <div class="row">${newBtn}</div>
      </div>
      <div>
        <div class="card role soon"><span class="tag">скоро</span><h2>Тренер</h2><p class="dim" style="margin:0">Склад, тактика, роздягальня.</p></div>
        <div class="card role soon"><span class="tag">скоро</span><h2>Власник</h2><p class="dim" style="margin:0">Клуб, гроші, трансфери.</p></div>
      </div>
    </div>
    ${mine}
    <p class="fiction">Вигадана історія: герої, клуби й події вигадані, збіги випадкові.</p>`));
}

// ───────────────────────── створення героя ─────────────────────────
function archetypeEffects(arch) {
  const lab = (App.content && App.content.meta.stat_labels) || { rep: 'Репутація', pop: 'Популярність', wealth: 'Багатство', rel: 'Стосунки', fit: 'Форма', ment: 'Ментальність', trust: 'Довіра тренера', disc: 'Дисципліна' };
  const up = [], down = [];
  for (const [k, d] of Object.entries({ ...(arch.stats || {}), ...(arch.hidden || {}) })) { if (/^sk/.test(k)) continue; (d > 0 ? up : down).push(lab[k] || k); }
  return { up, down };
}
async function renderCreate() {
  if (!App.content) {
    try { App.content = await App.store.loadContent(); } catch (e) { App.toast = e.message; App.screen = 'home'; return render(); }
  }
  const f = App.form, meta = App.content.meta;
  const presetFreq = ((meta.presets || {})['1'] || {}).event_freq_default;
  if (!EVENT_FREQ[f.event_freq]) f.event_freq = EVENT_FREQ[presetFreq] ? presetFreq : 'medium';
  const offers = E.clubOffers(App.content);
  if (!offers.some((o) => o.key === f.club)) f.club = (meta.club_default && offers.some((o) => o.key === meta.club_default)) ? meta.club_default : offers[0].key;
  const clubs = offers.map((c) => {
    const e = archetypeEffects(c.start);
    const where = [c.country, c.league].filter(Boolean).join(' · ');
    return `<button type="button" class="pick ${f.club === c.key ? 'on' : ''}" data-act="pick" data-field="club" data-val="${c.key}"><div class="pt">${esc(c.label)}</div>${where ? `<div class="ps">${esc(where)}</div>` : ''}${c.blurb ? `<div class="ps">${esc(c.blurb)}</div>` : ''}<div class="pd">${e.up.map((x) => `<span class="u">▲ ${esc(x)}</span>`).join('')}${e.down.map((x) => `<span class="d">▼ ${esc(x)}</span>`).join('')}</div></button>`;
  }).join('');
  const pos = Object.keys(POS).map((k) => `<button type="button" class="pick ${f.pos === k ? 'on' : ''}" data-act="pick" data-field="pos" data-val="${k}"><div class="pt">${POS[k].label}</div><div class="ps">${esc(meta.skills_by_pos[k].join(' · '))}</div></button>`).join('');
  const archs = Object.entries(meta.archetypes).map(([k, a]) => {
    const e = archetypeEffects(a);
    return `<button type="button" class="pick ${f.archetype === k ? 'on' : ''}" data-act="pick" data-field="archetype" data-val="${k}"><div class="pt">${esc(a.label)}</div><div class="ps">${esc(a.blurb)}</div><div class="pd">${e.up.map((x) => `<span class="u">▲ ${esc(x)}</span>`).join('')}${e.down.map((x) => `<span class="d">▼ ${esc(x)}</span>`).join('')}</div></button>`;
  }).join('');
  const close = Object.keys(CLOSE).map((k) => `<button type="button" class="pick ${f.close === k ? 'on' : ''}" data-act="pick" data-field="close" data-val="${k}"><div class="pt">${CLOSE[k].label}</div><div class="ps">${CLOSE[k].sub}</div></button>`).join('');
  const freq = Object.keys(EVENT_FREQ).map((k) => `<button type="button" class="pick ${f.event_freq === k ? 'on' : ''}" data-act="pick" data-field="event_freq" data-val="${k}"><div class="pt">${EVENT_FREQ[k].label}</div><div class="ps">${EVENT_FREQ[k].sub}</div></button>`).join('');
  const mods = Object.entries(MODULES).map(([k, t]) => `<label class="chk"><input type="checkbox" data-act="module" data-mod="${k}" ${f.modules[k] ? 'checked' : ''}>${esc(t)}</label>`).join('');
  setHtml(shell('<button class="iconbtn" data-act="home">← Головна</button>', `
    <div class="form">
      <h1>Створи футболіста</h1>
      <p class="lead">Тобі ${meta.start_age}, попереду перший сезон у молодіжній команді. Клуб, позицію й характер обираєш ти.</p>
      <div class="fsec"><h3>Клуб ${tipBtn('Три пропозиції. Клуб змінює країну, суперників, імена людей навколо тебе й трохи стартові показники (стрілки на картці). Сюжет у всіх клубів однаковий.')}</h3><div class="clubs">${clubs}</div></div>
      <div class="fsec"><label class="lbl" for="in-name">Ім’я героя</label>
        <input id="in-name" type="text" maxlength="20" autocomplete="off" value="${esc(f.name)}" placeholder="Наприклад, Марко"></div>
      <div class="fsec"><h3>Позиція ${tipBtn('Позиція визначає три твої навички та момент матчу, у якому ти робитимеш вибір.')}</h3><div class="seg four">${pos}</div></div>
      <div class="fsec"><h3>Характер ${tipBtn('Стартовий склад характеру: підсилює одні показники й послаблює інші. Далі ти формуєш його вибором.')}</h3><div class="archs">${archs}</div></div>
      <div class="fsec"><h3>Близька людина ${tipBtn('Персонаж, що з’являється в особистих сценах. Можна вимкнути.')}</h3><div class="seg">${close}</div></div>
      <div class="fsec"><h3>Події між матчами ${tipBtn('Непередбачувані життєві випадки між матчами: запізнення, дрібні курйози, пресконференції, сварки в роздягальні. Вони не міняють головний сюжет, але додають і приємних, і прикрих несподіванок. Курйозні травми з’являються лише якщо ввімкнено модуль «Травми» (розділ «Додатково»).')}</h3><div class="seg four">${freq}</div></div>
      <details class="more"><summary>Додатково</summary>${mods}</details>
      <div class="err" id="form-err">${esc(f.error)}</div>
      <div class="actions" style="margin-top:6px"><button class="btn primary" data-act="create">Почати кар’єру</button><button class="btn ghost" data-act="home">Скасувати</button></div>
      <p class="fiction">Вигадана історія: герої, клуби й події вигадані.</p>
    </div>`));
}

// ───────────────────────── гра ─────────────────────────
function statsPanel(v, content) {
  const byGroup = { core: [], state: [], skill: [], hidden: [] };
  for (const s of v.stats) { if (s.mode !== 'hidden') byGroup[s.group].push(s); }
  const groups = GROUPS.map(([g, title, help]) => {
    const rows = byGroup[g];
    if (!rows.length) return '';
    return `<div class="sgrp"><h3>${title}${tipBtn(help)}</h3>${rows.map((s) => {
      const tr = s.trend > 0 ? '<i class="tr up">▲</i>' : s.trend < 0 ? '<i class="tr down">▼</i>' : '';
      const val = s.value != null ? s.value : '';
      const help1 = STAT_HELP[s.group === 'skill' ? 'sk' : s.key] || '';
      return `<div class="st"><div class="srow"><span>${esc(s.label)}${help1 ? tipBtn(help1) : ''}</span><span class="sv">${val !== '' ? val : esc(s.word || '')}${tr}</span></div>${val !== '' ? `<div class="bar ${s.group}"><i style="width:${val}%"></i></div>` : ''}</div>`;
    }).join('')}</div>`;
  }).join('');
  const people = v.people && v.people.length
    ? `<div class="sgrp"><h3>Люди${tipBtn('Ставлення цих людей до тебе: від −100 до +100, старт біля нуля. Змінюється від твоїх рішень; імена — як у цій історії.')}</h3>${v.people.map((p) => `<div class="st"><div class="srow"><span>${esc(p.name)} <em class="role">${esc(p.role)}</em></span><span class="sv ${p.value > 0 ? 'pos' : p.value < 0 ? 'neg' : ''}">${p.value != null ? (p.value === 0 ? '0' : fmt(p.value)) : esc(p.word)}</span></div></div>`).join('')}</div>`
    : '';
  const traces = v.traces.length
    ? `<div class="sgrp"><h3>Сліди${tipBtn('Рішення, які історія запам’ятала. Вони можуть повернутись пізніше.')}</h3><ol class="traces">${v.traces.map((t) => `<li>${esc(t.t)}</li>`).join('')}</ol></div>` : '';
  return `<div class="card">${groups}${people}${traces}</div>`;
}
function miniStats(v) {
  return `<div class="ministats">${v.stats.filter((s) => s.group === 'core' && s.mode !== 'hidden').map((s) => `<span class="mini">${esc(s.label)}<b>${s.value != null ? s.value : esc(s.word || '')}</b></span>`).join('')}</div>`;
}
// Ім'я NPC у чіпі змін — з іменами ЦЬОГО клубу (E.nameVars) і роллю: раніше брали базове cast-імʼя («Монтефьоре»),
// хоч в історії Динамо тренер Коваленко, — звідси плутанина «хто є хто» (Богдан, 08.11).
function npcName(key, content, state) {
  const base = (content.cast || {})[key];
  if (!state) return base ? base.name : key;
  const vars = E.nameVars(state, content);
  const name = vars[key] || (base ? base.name : key);
  const role = key === 'close' ? vars.close_role : (base && base.role_label);
  return role ? `${name} (${role})` : name;
}
function reportHtml(delta, content, state) {
  if (!delta) return '';
  const chips = [];
  for (const d of delta.delta || []) chips.push(`<span class="chip ${d.d > 0 ? 'up' : 'down'}">${esc(d.label)} ${d.from} → ${d.to} (${fmt(d.d)})</span>`);
  for (const n of delta.npc || []) chips.push(`<span class="chip ${n.d > 0 ? 'up' : 'down'}">${esc(npcName(n.key, content, state))}: ${fmt(n.d)}</span>`);
  for (const t of delta.traces || []) chips.push(`<span class="chip trace">Слід: ${esc(t)}</span>`);
  return chips.length ? `<div class="report">${chips.join('')}</div>` : '';
}
function rollHtml(roll, content, level) {
  if (!roll) return '';
  const preset = (content.meta.presets || {})[level] || {};
  if (!preset.show_chances) return '';
  return `<p class="roll">🎲 випало ${roll.die} · потрібно ≤ ${roll.target} — <span class="${roll.ok ? 'ok' : 'no'}">${roll.ok ? 'вдалося' : 'не вдалося'}</span></p>`;
}
function optionsHtml(v) {
  return `<div class="opts">${v.options.map((o) => {
    const chips = (o.chance != null ? [`<span class="chip chance">шанс ${o.chance}%</span>`] : []).concat((o.affects || []).map((a) => `<span class="chip">${esc(a)}</span>`));
    return `<button class="opt" data-act="choose" data-key="${esc(o.key)}"><span class="ol">${esc(o.label)}</span>${o.hint ? `<span class="oh">${esc(o.hint)}</span>` : ''}${chips.length ? `<span class="oc">${chips.join('')}</span>` : ''}</button>`;
  }).join('')}</div>`;
}
function eptrack(v) {
  return `<div class="epwrap"><div class="eptrack">${Array.from({ length: v.ep_count }, (_, i) => `<i class="${i + 1 < v.ep ? 'done' : i + 1 === v.ep ? 'cur' : ''}"></i>`).join('')}</div><span class="eplabel">Епізод ${v.ep} з ${v.ep_count}</span></div>`;
}
function storyBody(v, run, content) {
  const level = run.state.settings.level;
  const next = (label) => `<div class="actions"><button class="btn primary" data-act="next">${label}</button></div>`;
  switch (v.type) {
    case 'episode_start':
      return `<div class="kicker"><span class="pill">Епізод ${v.ep} з ${v.ep_count}</span></div><h2>${esc(v.title)}</h2><p class="txt">${para(v.text)}</p>${next('Почати епізод')}`;
    case 'card': case 'moment': case 'approach': {
      const pills = [];
      if (v.match) pills.push(`<span class="pill match">⚽ ${esc(v.match.title)}</span>`);
      if (v.type === 'approach') pills.push('<span class="pill match">Підхід до гри</span>');
      else if (v.match) pills.push(`<span class="pill match">Момент ${v.match.moment} з ${v.match.moments}</span>`);
      if (v.big) pills.push(`<span class="pill big">Велике рішення</span>${tipBtn('Великі рішення сильніше за інші впливають на те, чим закінчиться твоя історія.')}`);
      return `${pills.length ? `<div class="kicker">${pills.join('')}</div>` : ''}${v.speaker ? `<div class="speaker">${esc(v.speaker)}</div>` : ''}<p class="txt">${para(v.text)}</p>${optionsHtml(v)}`;
    }
    case 'scene':
      return `${rollHtml(v.roll, content, level)}<p class="txt">${para(v.text)}</p>${reportHtml(v.delta, content, run.state)}${next('Далі')}`;
    case 'match_result':
      return `<div class="kicker"><span class="pill match">⚽ ${esc(v.title)}</span></div><div class="score">${esc(v.score)}</div>
        <div class="facts"><span><b>${v.rating.toFixed(1)}</b>оцінка</span><span><b>${v.goals}</b>голи</span><span><b>${v.assists}</b>передачі</span></div>
        <p class="txt">${para(v.text)}</p>${reportHtml(v.delta, content, run.state)}${next('Далі')}`;
    case 'episode_end': {
      const ch = v.changes.length ? `<div class="changes">${v.changes.map((c) => `<div><span>${esc(c.label)}</span><span class="${c.d > 0 ? 'dim' : 'dim'}">${c.from} → ${c.to} <span style="color:var(${c.d > 0 ? '--up' : '--down'})">(${fmt(c.d)})</span></span></div>`).join('')}</div>` : '';
      const s = v.season;
      return `<div class="kicker"><span class="pill">Підсумок епізоду ${v.ep}</span></div><h2>${esc(v.title)}</h2><p class="txt">${para(v.text)}</p>${ch}
        <div class="facts"><span><b>${s.goals}</b>голи за сезон</span><span><b>${s.assists}</b>передачі</span><span><b>${s.avg_rating != null ? s.avg_rating.toFixed(2) : '—'}</b>середня оцінка</span></div>
        ${next(v.ep < v.ep_count ? 'До наступного епізоду' : 'Підбити підсумок сезону')}`;
    }
    case 'season_end': {
      const s = v.season;
      const titles = Object.fromEntries((content.trajectories || []).map((t) => [t.key, t.title]));
      const fr = App.friends;
      const friends = fr == null ? '' : `<div class="friends"><h3>Як зіграли друзі</h3>${fr.length ? fr.map((f) => `<div class="frow"><span>${esc(f.display_name)}</span><span class="tj">${esc(friendTitle(f, titles, content))}</span></div>`).join('') : '<p class="dim" style="margin:0">Поки ти перший, хто дограв цей розділ.</p>'}</div>`;
      return `<div class="kicker"><span class="pill">Кінець сезону</span></div><h2>${esc(v.title)}</h2><p class="txt">${para(v.text)}</p>
        <div class="facts"><span><b>${s.goals}</b>голи</span><span><b>${s.assists}</b>передачі</span><span><b>${s.avg_rating != null ? s.avg_rating.toFixed(2) : '—'}</b>середня оцінка</span><span><b>${s.matches}</b>матчів</span></div>
        <p class="txt coda">${para(v.coda)}</p>
        ${v.teasers.length ? `<h3>Що далі</h3><ul class="teasers">${v.teasers.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
        ${friends}
        <div class="actions" style="margin-top:14px"><button class="btn primary" data-act="home">На головну</button></div>
        <p class="fiction">Вигадана історія: герої, клуби й події вигадані, збіги випадкові.</p>`;
    }
    default: return `<p class="dim">Невідомий екран ${esc(v.type)}</p>`;
  }
}
// Назва кінцівки зі збереженого підсумку для списків. Нові проходження зберігають уже підставлену назву (store.js);
// проходження, збережені до виправлення 08.11, мають шаблон («Надійна опора {youth.gen}») — підставляємо клуб героя з підсумку,
// а що підставити нічим (контент не завантажений) — прибираємо, щоб не світити сирий шаблон.
function tplFree(sum, content) {
  let t = String((sum && sum.title) || '');
  if (!/\{[^}]*\}/.test(t)) return t;
  if (content && sum.hero) { try { t = E.renderText(t, { settings: {}, hero: sum.hero }, content); } catch (e) { /* лишаємо шаблон — нижче приберемо */ } }
  return t.replace(/\s*\{[^}]*\}/g, '').trim();
}
// Назва траєкторії друга: беремо вже відрендерену назву з його підсумку (вона містить ЙОГО клуб);
// запасний варіант — шаблонна назва без змінних (змінні клубу не показуємо сирими).
function friendTitle(f, titles, content) {
  const t = f.summary && typeof f.summary.title === 'string' ? f.summary.title : null;
  if (t) return tplFree(f.summary, content) || t;
  const raw = titles[f.trajectory_key] || f.trajectory_key;
  return String(raw).replace(/\s*\{[^}]*\}/g, '').trim() || f.trajectory_key;
}
function renderGame() {
  const run = App.run, content = App.content;
  let v;
  try { v = E.view(run.state, content); }
  catch (e) { App.toast = 'Помилка стану гри: ' + e.message; App.screen = 'home'; return render(); }
  const back = canGoBack(run) && !run.state.done;
  const right = `<button class="iconbtn" data-act="back" ${back ? '' : 'disabled'} title="Повернутися до попереднього рішення" aria-label="Назад: повернутися до попереднього рішення">↩<span class="tx"> Назад</span></button><button class="iconbtn" data-act="home" aria-label="На головну">⌂<span class="tx"> Головна</span></button>`;
  setHtml(`<div class="app">
    <div class="topbar"><span class="brand">Bo<b>Bet</b> Stories</span><span class="badge stage">STAGE</span>${eptrack(v)}<span class="spacer"></span>${right}</div>
    ${miniStats(v)}
    <div class="cols">
      <main class="card story" id="story">${storyBody(v, run, content)}</main>
      <aside class="side">${statsPanel(v, content)}</aside>
    </div>
  </div>`);
}

// ───────────────────────── дії ─────────────────────────
function setBusy(b) { App.busy = b; App.root.classList.toggle('busy', b); }
async function guard(fn) {
  if (App.busy) return;
  setBusy(true); App.toast = null;
  try { await fn(); }
  catch (e) {
    App.toast = e.conflict ? 'Гра змінилась в іншому вікні — синхронізую.' : (e.message || String(e));
    if (e.conflict && App.run) { try { const rows = await App.store.myRuns(); const row = rows.find((r) => r.id === App.run.id); if (row) { const o = await App.store.openRun(row); App.run = o.run; App.content = o.content; } } catch (e2) { /* лишаємо як є */ } }
    render();
  }
  setBusy(false);
}
async function openRun(row) {
  const o = await App.store.openRun(row);
  App.run = o.run; App.content = o.content; App.friends = null; App.screen = 'game'; ss.set('stories_screen', 'game');
  render();
  if (App.run.state.done) loadFriends();
  window.scrollTo(0, 0);
}
async function loadFriends() {
  try { App.friends = await App.store.friendsResults(); } catch (e) { App.friends = []; }
  if (App.screen === 'game' && App.run && App.run.state.done) render();
}
async function act(input) {
  const out = await App.store.step(App.run, App.content, input);
  App.run = out.run;
  render();
  window.scrollTo(0, 0);
  if (App.run.state.done) loadFriends();
}

function onInput(e) {
  if (e.target.id === 'in-name') { App.form.name = e.target.value; App.form.error = ''; const el = document.getElementById('form-err'); if (el) el.textContent = ''; }
}

async function onClick(e) {
  const t = e.target.closest('[data-act]');
  if (!t) return;
  const a = t.dataset.act;
  if (a === 'toast-close') { App.toast = null; return render(); }
  if (a === 'retry') return start();
  if (a === 'logout') { await App.sb.auth.signOut(); location.reload(); return; }
  if (a === 'home') return guard(async () => { App.screen = 'home'; ss.set('stories_screen', null); App.runs = await App.store.myRuns(); render(); window.scrollTo(0, 0); });
  if (a === 'new') { App.form = newForm(); App.screen = 'create'; return render(); }
  if (a === 'pick') { App.form[t.dataset.field] = t.dataset.val; return render(); }
  if (a === 'module') { App.form.modules[t.dataset.mod] = t.checked; return; }
  if (a === 'create') return guard(async () => {
    const f = App.form, name = f.name.trim();
    if (name.length < 2) { f.error = 'Вкажи ім’я героя (від 2 літер).'; return render(); }
    const hero = { name, pos: f.pos, archetype: f.archetype, club: f.club };
    const settings = { level: 1, close_person: f.close, real_names: false, club_mode: 'offers', event_freq: f.event_freq, modules: { ...f.modules } };
    const { content, run } = await App.store.startRun(hero, settings);
    App.content = content; App.run = run; App.friends = null; App.screen = 'game'; ss.set('stories_screen', 'game');
    render(); window.scrollTo(0, 0);
  });
  if (a === 'resume') return guard(async () => { const row = App.runs.find((r) => r.id === t.dataset.id); if (row) await openRun(row); });
  if (a === 'abandon-ask') { App.confirm = t.dataset.id; render(); setTimeout(() => { if (App.confirm === t.dataset.id) { App.confirm = null; if (App.screen === 'home') render(); } }, 4000); return; }
  if (a === 'abandon') return guard(async () => { await App.store.abandon(t.dataset.id); App.confirm = null; App.runs = await App.store.myRuns(); render(); });
  if (a === 'choose') return guard(() => act({ choice: t.dataset.key }));
  if (a === 'next') return guard(() => act({ continue: true }));
  if (a === 'back') return guard(async () => {
    const r = await App.store.back(App.run, App.content);
    if (!r) { App.toast = 'Нема куди відкочуватись: ти ще не зробив жодного вибору.'; return render(); }
    App.run = r; render(); window.scrollTo(0, 0);
  });
}
