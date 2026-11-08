// BoBet Stories — рушій (ES-модуль). Чисті детерміновані функції: жодного DOM, мережі, годинника.
// Публічний файл: тут НЕМАЄ жодного тексту сюжету — увесь контент приходить пакетом `content` (stories_content.bundle).
// Контракт: newRun → state; view(state, content) → що показати; step(state, content, input) → {state, result}.
// Стан — звичайний JSON (зберігається в БД). Випадковість — лічильникова: «зерно + журнал вибору» відтворює проходження.

export const ENGINE_VERSION = 1;

// ---------- утиліти ----------
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const clone = (o) => JSON.parse(JSON.stringify(o));
const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const round1 = (x) => Math.round(x * 10) / 10;
// лише власні властивості: «constructor», «toString» тощо не є ключами
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

// n-й вихід mulberry32(seed): детермінований за (seed, n), тому відкат/повтор не потребують серіалізації генератора.
export function mulberry32At(seed, n) {
  let a = (seed + Math.imul(n + 1, 0x6D2B79F5)) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = ((t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export function rand01(rng) { const v = mulberry32At(rng.seed | 0, rng.n); rng.n += 1; return v; }
export function rollD100(rng) { return 1 + Math.floor(rand01(rng) * 100); }
function normSeed(seed) {
  const x = Math.abs(Math.floor(Number(seed))) % 4294967296;
  return Number.isFinite(x) ? x : 1;
}

// ---------- вирази: «75+(ment-50)/2+approach» ----------
// Дозволено: числа, + - * / ( ), ідентифікатори (стати, skN, approach). Нічого іншого.
export function evalExpr(expr, lookup) {
  const src = String(expr);
  let i = 0;
  const ws = () => { while (i < src.length && src[i] === ' ') i++; };
  function num() {
    ws();
    if (src[i] === '(') { i++; const v = add(); ws(); if (src[i] !== ')') throw new Error('вираз: немає ")" у «' + src + '»'); i++; return v; }
    if (src[i] === '-') { i++; return -num(); }
    let m = /^[0-9]+(\.[0-9]+)?/.exec(src.slice(i));
    if (m) { i += m[0].length; return parseFloat(m[0]); }
    m = /^[a-z_][a-z0-9_]*/.exec(src.slice(i));
    if (m) { i += m[0].length; const v = lookup(m[0]); if (typeof v !== 'number' || Number.isNaN(v)) throw new Error('вираз: невідомий ідентифікатор «' + m[0] + '» у «' + src + '»'); return v; }
    throw new Error('вираз: несподіваний символ на позиції ' + i + ' у «' + src + '»');
  }
  function mul() { let v = num(); for (;;) { ws(); const c = src[i]; if (c === '*') { i++; v *= num(); } else if (c === '/') { i++; v /= num(); } else return v; } }
  function add() { let v = mul(); for (;;) { ws(); const c = src[i]; if (c === '+') { i++; v += mul(); } else if (c === '-') { i++; v -= mul(); } else return v; } }
  const out = add(); ws();
  if (i !== src.length) throw new Error('вираз: зайвий хвіст у «' + src + '»');
  return out;
}

// ---------- доступ до даних стану ----------
function statVal(state, key) {
  if (has(state.stats, key)) return state.stats[key];
  if (has(state.hidden, key)) return state.hidden[key];
  throw new Error('невідомий стат «' + key + '»');
}
function setStat(state, key, v) {
  if (has(state.stats, key)) state.stats[key] = clamp(Math.round(v), 0, 100);
  else if (has(state.hidden, key)) state.hidden[key] = clamp(Math.round(v), 0, 100);
  else throw new Error('невідомий стат «' + key + '»');
}
export function seasonAvgRating(state) {
  const r = state.season.ratings;
  return r.length ? round1(r.reduce((a, b) => a + b, 0) / r.length) : 0;
}
function exprLookup(state) {
  return (name) => {
    if (name === 'approach') return state.match ? (state.match.bonus || 0) : 0;
    if (has(state.stats, name)) return state.stats[name];
    if (has(state.hidden, name)) return state.hidden[name];
    return NaN;
  };
}

// ---------- умови як дані ----------
function cmp(val, c) {
  if ('eq' in c && val !== c.eq) return false;
  if ('gte' in c && !(val >= c.gte)) return false;
  if ('lte' in c && !(val <= c.lte)) return false;
  if ('gt' in c && !(val > c.gt)) return false;
  if ('lt' in c && !(val < c.lt)) return false;
  if ('between' in c && !(val >= c.between[0] && val <= c.between[1])) return false;
  return true;
}
export function evalCond(cond, state) {
  if (cond === undefined || cond === null) return true;
  if (!isObj(cond)) throw new Error('умова має бути об\'єктом');
  if ('all' in cond) return cond.all.every((c) => evalCond(c, state));
  if ('any' in cond) return cond.any.some((c) => evalCond(c, state));
  if ('not' in cond) return !evalCond(cond.not, state);
  if ('stat' in cond) return cmp(statVal(state, cond.stat), cond);
  if ('flag' in cond) {
    const v = !!state.flags[cond.flag];
    if ('eq' in cond) return v === !!cond.eq;
    return v;
  }
  if ('npc' in cond) return cmp(state.npc[cond.npc] ?? 0, cond);
  if ('season' in cond) {
    const k = cond.season;
    const v = k === 'avg_rating' ? seasonAvgRating(state) : state.season[k];
    if (typeof v !== 'number') throw new Error('невідоме поле сезону «' + k + '»');
    return cmp(v, cond);
  }
  if ('age' in cond) return cmp(state.hero.age, cond.age);
  if ('episode' in cond) return cmp(state.cursor.ep + 1, cond.episode);
  if ('pos' in cond) return [].concat(cond.pos).includes(state.hero.pos);
  if ('archetype' in cond) return [].concat(cond.archetype).includes(state.hero.archetype);
  if ('module' in cond) return moduleOn(state, cond.module);
  if ('setting' in cond) return state.settings[cond.setting] === cond.eq;
  if ('match' in cond) {
    const m = state.match;
    if (!m) return false;
    const k = cond.match;
    const v = has(m.counters, k) ? m.counters[k] : (has(m, k) ? m[k] : 0);
    return cmp(typeof v === 'number' ? v : 0, cond);
  }
  if ('big' in cond) return cmp(state.big, cond.big);
  throw new Error('невідомий вузол умови: ' + Object.keys(cond).join(','));
}
function moduleOn(state, m) {
  if (m === 'sport') return true;
  return state.settings.modules && state.settings.modules[m] === true;
}

// ---------- дельти / ефекти ----------
export function parseDelta(v, meta) {
  if (typeof v === 'number') return v;
  const m = /^([+-]?)([a-z]+)$/.exec(String(v));
  if (!m) throw new Error('невірна дельта «' + v + '»');
  const size = has(meta.delta_sizes, m[2]) ? meta.delta_sizes[m[2]] : undefined;
  if (typeof size !== 'number') throw new Error('невідомий розмір дельти «' + m[2] + '»');
  return (m[1] === '-' ? -1 : 1) * size;
}
function labelOf(state, content, key) {
  const meta = content.meta;
  if (/^sk[123]$/.test(key)) return meta.skills_by_pos[state.hero.pos][Number(key[2]) - 1];
  return (meta.stat_labels && has(meta.stat_labels, key) && meta.stat_labels[key]) || key;
}
function applyEffects(state, content, eff, report) {
  if (!eff) return;
  const meta = content.meta;
  if (eff.stat) {
    for (const [k, raw] of Object.entries(eff.stat)) {
      const before = statVal(state, k);
      setStat(state, k, before + parseDelta(raw, meta));
      const after = statVal(state, k);
      if (after !== before) report.delta.push({ key: k, label: labelOf(state, content, k), from: before, to: after, d: after - before });
    }
  }
  if (eff.npc) {
    for (const [k, raw] of Object.entries(eff.npc)) {
      const before = state.npc[k] ?? 0;
      const after = clamp(before + parseDelta(raw, meta), -100, 100);
      state.npc[k] = after;
      if (after !== before) report.npc.push({ key: k, from: before, to: after, d: after - before });
    }
  }
  if (eff.flag) {
    for (const f of eff.flag.set || []) state.flags[f] = true;
    for (const f of eff.flag.clear || []) delete state.flags[f];
  }
  if (eff.trace) {
    // слід рендериться ТУТ (змінні клубу/імена) і зберігається готовим рядком
    const tr = renderText(eff.trace, state, content);
    state.traces.push({ t: tr, ep: state.cursor.ep + 1 });
    report.traces.push(tr);
  }
  if (eff.big) { state.big += 1; }
}

// ---------- тексти, змінні, шар імен ----------
function pickText(t, state) {
  if (typeof t === 'string' || t === undefined) return t;
  if (isObj(t)) {
    const by = t.by;
    const key = by === 'close_person' ? state.settings.close_person
      : by === 'pos' ? state.hero.pos
      : by === 'archetype' ? state.hero.archetype
      : by === 'club' ? state.hero.club : undefined;
    if (key !== undefined && has(t, key) && key !== 'by' && key !== 'default') return t[key];
    if (t.default !== undefined) return t.default;
    throw new Error('текст без default для ключа «' + key + '»');
  }
  throw new Error('текст має бути рядком або {by,...}');
}
// Клубовий пакет героя (рішення 95). Пакет: vars (змінні й відмінки), cast (країнозалежні імена), start (стартові дельти).
// Старі пакети без meta.clubs (лише meta.club) працюють як єдиний пакет — сумісність зі збереженими проходженнями.
export function clubOf(content, key) {
  const m = content.meta;
  if (m.clubs) {
    const k = key && has(m.clubs, key) ? key : m.club_default;
    return { key: k, ...m.clubs[k] };
  }
  const vars = { club: m.club.name };
  for (const [cs, v] of Object.entries(m.club.forms || {})) vars['club.' + cs] = v;
  return { key: m.club.key, vars, cast: {}, start: {} };
}
export function clubOffers(content) {
  const m = content.meta;
  if (!m.clubs) return [{ key: m.club.key, label: m.club.name, country: '', league: '', blurb: '', start: {} }];
  return Object.entries(m.clubs).map(([key, c]) => ({ key, label: c.label, country: c.country, league: c.league, blurb: c.blurb, start: c.start || {} }));
}
export function nameVars(state, content) {
  const real = !!state.settings.real_names;
  const pack = clubOf(content, state.hero.club);
  const out = {};
  for (const [k, base] of Object.entries(content.cast || {})) {
    const c = pack.cast && pack.cast[k] ? { ...base, ...pack.cast[k] } : base;
    const useReal = real && c.real_name;
    out[k] = useReal ? c.real_name : c.name;
    // відмінки: {coach.dat}; якщо форми нема — береться називний (невідмінювані імена)
    for (const [cs, v] of Object.entries((useReal ? c.real_forms : c.forms) || {})) out[k + '.' + cs] = v;
  }
  const cp = state.settings.close_person;
  if (cp && cp !== 'none' && has(content.cast, 'close_' + cp)) {
    const ck = 'close_' + cp;
    out.close = out[ck];
    out.close_role = content.cast[ck].role_label;
    for (const k of Object.keys(out)) if (k.startsWith(ck + '.')) out['close.' + k.slice(ck.length + 1)] = out[k];
  }
  out.hero = state.hero.name;
  for (const [k, v] of Object.entries(pack.vars || {})) out[k] = v;
  const sk = content.meta.skills_by_pos[state.hero.pos];
  out.sk1 = sk[0]; out.sk2 = sk[1]; out.sk3 = sk[2];
  return out;
}
export function renderText(t, state, content) {
  const raw = pickText(t, state);
  if (raw === undefined) return '';
  const vars = nameVars(state, content);
  return raw.replace(/\{([a-z_0-9]+)(?:\.([a-z]+))?\}/g, (m, k, cs) => {
    if (cs && has(vars, k + '.' + cs)) return vars[k + '.' + cs];
    return has(vars, k) ? vars[k] : m;
  });
}

// ---------- індекс контенту ----------
const POOL_CACHE = new WeakMap();
function poolIndex(content) {
  let idx = POOL_CACHE.get(content);
  if (!idx) {
    idx = {};
    for (const [key, card] of Object.entries(content.cards)) {
      if (card.pool) (idx[card.pool] = idx[card.pool] || []).push(key);
    }
    for (const k of Object.keys(idx)) idx[k].sort();
    POOL_CACHE.set(content, idx);
  }
  return idx;
}
function nodeAllowed(node, state) {
  if (node.module && !moduleOn(state, node.module)) return false;
  if (node.module === 'personal' && (!state.settings.close_person || state.settings.close_person === 'none')) return false;
  return evalCond(node.when, state);
}
function presetOf(content, level) {
  const p = content.meta.presets[String(level)];
  if (!p) throw new Error('нема пресета рівня ' + level);
  return p;
}

// ---------- створення проходження ----------
export function newRun({ content, hero, settings = {}, seed }) {
  const meta = content.meta;
  const level = settings.level ?? 1;
  const preset = presetOf(content, level);
  const arch = meta.archetypes[hero.archetype];
  if (!arch) throw new Error('невідомий архетип «' + hero.archetype + '»');
  if (!meta.skills_by_pos[hero.pos]) throw new Error('невідома позиція «' + hero.pos + '»');

  const club = clubOf(content, hero.club);
  const stats = { ...meta.base_stats };
  for (const [k, d] of Object.entries(arch.stats || {})) stats[k] = (stats[k] ?? 0) + d;
  for (const [k, d] of Object.entries((club.start || {}).stats || {})) stats[k] = (stats[k] ?? 0) + d;
  for (const [k, d] of Object.entries((meta.pos_start || {})[hero.pos] || {})) stats[k] = (stats[k] ?? 0) + d;
  for (const k of Object.keys(stats)) stats[k] = clamp(Math.round(stats[k]), 0, 100);
  const hidden = { ...meta.base_hidden };
  for (const [k, d] of Object.entries(arch.hidden || {})) hidden[k] = clamp((hidden[k] ?? 0) + d, 0, 100);
  for (const [k, d] of Object.entries((club.start || {}).hidden || {})) hidden[k] = clamp((hidden[k] ?? 0) + d, 0, 100);

  const modules = { ...(preset.modules_default || {}), ...(settings.modules || {}) };
  const st = {
    v: 1, engine: ENGINE_VERSION, content_version: content.version,
    hero: { name: hero.name, pos: hero.pos, archetype: hero.archetype, age: hero.age ?? meta.start_age ?? 18, club: club.key },
    settings: {
      level, modules,
      close_person: settings.close_person ?? preset.close_person_default ?? 'none',
      real_names: !!settings.real_names,
      club_mode: settings.club_mode ?? 'offers',
      // частота подій «Банку подій»: off|low|medium|high (0/1/3/5 слотів пулу events); нема в старого проходження → подій нема
      event_freq: settings.event_freq ?? preset.event_freq_default ?? 'medium',
      rollback_mode: settings.rollback_mode ?? preset.rollback_mode ?? 'free',
    },
    stats, hidden, flags: {}, traces: [], npc: startNpc(meta, club),
    season: { goals: 0, assists: 0, ratings: [] },
    big: 0, seen: {}, match: null,
    cursor: { ep: 0, slot: -1, phase: 'episode_start', node: null, scene: null, roll: null, delta: null, ep_stats: null },
    rng: { seed: normSeed(seed), n: 0 },
    done: false, result: null,
  };
  st.cursor.ep_stats = snapshotStats(st);
  return st;
}
function startNpc(meta, club) {
  const npc = { ...(meta.base_npc || {}) };
  for (const [k, d] of Object.entries((club.start || {}).npc || {})) npc[k] = clamp((npc[k] ?? 0) + d, -100, 100);
  return npc;
}
function snapshotStats(state) { return { ...state.stats, ...state.hidden }; }

// ---------- вигляд (що показати) ----------
export function statsView(state, content) {
  const meta = content.meta;
  const preset = presetOf(content, state.settings.level);
  const vis = preset.visibility;
  const snap = state.cursor.ep_stats || {};
  const word = (v) => { for (const [a, b, w] of meta.word_bands) if (v >= a && v <= b) return w; return ''; };
  const mk = (key, group, mode, isHidden) => {
    const v = isHidden ? state.hidden[key] : state.stats[key];
    // режими видимості: number — число+слово, word — лише слово, hidden — нічого
    const shown = mode === 'number' ? v : null;
    const trend = snap[key] === undefined ? 0 : Math.sign(v - snap[key]);
    return { key, group, label: labelOf(state, content, key), mode, value: shown, word: mode === 'hidden' ? null : word(v), trend, hidden_default: !!isHidden };
  };
  const out = [];
  for (const k of meta.core_stats) out.push(mk(k, 'core', vis.core, false));
  // Фізична форма й Ментальність — видимі стати Рівня 1 (рішення 14 і 62), але не входять у core_stats (4 спільні для ролей) і не є прихованими:
  // тому раніше випадали з панелі зовсім (виправлено 08.11, Богдан: «показувати всі змінні»).
  for (const k of ['fit', 'ment']) if (has(state.stats, k)) out.push(mk(k, 'state', vis.core, false));
  for (const k of ['sk1', 'sk2', 'sk3']) out.push(mk(k, 'skill', vis.skills, false));
  for (const k of Object.keys(state.hidden)) out.push(mk(k, 'hidden', vis.hidden, true));
  return out;
}
// «Люди»: ставлення NPC до героя (state.npc −100…+100) з іменами ЦЬОГО клубу й ролями — щоб не плутати, хто є хто.
// Імена беремо з nameVars (клубові перевизначення: Динамо → тренер Коваленко, а не базовий Монтефьоре). Порядок — за близькістю до героя.
const PEOPLE_ORDER = ['coach', 'mate', 'agent', 'captain', 'rival', 'doctor', 'journalist', 'close'];
export function peopleView(state, content) {
  const mode = presetOf(content, state.settings.level).visibility.core;
  if (mode === 'hidden') return [];
  const vars = nameVars(state, content);
  const out = [];
  for (const key of PEOPLE_ORDER) {
    if (!has(state.npc, key)) continue;
    if (key === 'close' && !vars.close) continue;
    const role = key === 'close' ? vars.close_role : (content.cast && content.cast[key] ? content.cast[key].role_label : null);
    if (!role) continue;
    const v = state.npc[key];
    out.push({ key, name: vars[key], role, value: mode === 'number' ? v : null, word: v >= 5 ? 'добре' : v <= -5 ? 'напружено' : 'рівно' });
  }
  return out;
}
function targetOf(opt, state) {
  if (!opt.roll) return null;
  const v = evalExpr(opt.roll.target, exprLookup(state));
  return clamp(Math.round(v), 5, 95);
}
function optionViews(node, state, content) {
  const preset = presetOf(content, state.settings.level);
  const out = [];
  for (const o of node.options || []) {
    if (!evalCond(o.when, state)) continue;
    const v = { key: o.key, label: renderText(o.label, state, content) };
    if (preset.show_hints && o.hint) v.hint = renderText(o.hint, state, content);
    if (preset.show_hints && o.affects) v.affects = o.affects.map((k) => labelOf(state, content, k));
    if (o.roll && preset.show_chances) v.chance = targetOf(o, state);
    out.push(v);
  }
  return out;
}
function approachNode(state, content) {
  const md = content.matches[state.match.key];
  return { kind: 'approach', text: md.intro, options: md.approaches.map((a) => ({ key: a.key, label: a.label, hint: a.hint, affects: a.affects, effects: a.effects })) };
}
function getNode(state, content, key) {
  if (key === '__approach') return approachNode(state, content);
  if (content.cards[key]) return content.cards[key];
  if (content.moments[key]) return content.moments[key];
  throw new Error('нема вузла «' + key + '»');
}
export function view(state, content) {
  const c = state.cursor;
  const ep = content.episodes[c.ep];
  const base = { ep: c.ep + 1, ep_count: content.episodes.length, ep_title: ep ? renderText(ep.title, state, content) : '', stats: statsView(state, content), people: peopleView(state, content), traces: state.traces.slice(-8) };
  if (c.phase === 'episode_start') {
    return { ...base, type: 'episode_start', title: renderText(ep.title, state, content), text: renderText(ep.intro, state, content) };
  }
  if (c.phase === 'node') {
    const node = getNode(state, content, c.node);
    const t = c.node === '__approach' ? 'approach' : (content.moments[c.node] ? 'moment' : 'card');
    return { ...base, type: t, node: c.node, speaker: node.speaker ? renderText(node.speaker, state, content) : null, text: renderText(node.text, state, content), big: !!node.big, options: optionViews(node, state, content), match: state.match ? { title: renderText(content.matches[state.match.key].title, state, content), moment: state.match.i + 1, moments: content.matches[state.match.key].moments[state.hero.pos].length } : null };
  }
  if (c.phase === 'scene') {
    const sc = content.scenes[c.scene];
    return { ...base, type: 'scene', scene: c.scene, text: renderText(sc.text, state, content), delta: c.delta, roll: c.roll, big_trace: !!sc.big_trace };
  }
  if (c.phase === 'match_result') {
    const r = state.match.result;
    return { ...base, type: 'match_result', title: renderText(content.matches[state.match.key].title, state, content), score: r.score, text: renderText(r.text, state, content), rating: r.rating, goals: r.goals, assists: r.assists, delta: c.delta };
  }
  if (c.phase === 'episode_end') {
    const snap = c.ep_stats || {};
    const now = snapshotStats(state);
    const changes = Object.keys(now).filter((k) => snap[k] !== undefined && now[k] !== snap[k]).map((k) => ({ key: k, label: labelOf(state, content, k), from: snap[k], to: now[k], d: now[k] - snap[k] }));
    return { ...base, type: 'episode_end', title: renderText(ep.title, state, content), text: renderText(ep.outro, state, content), changes, season: { goals: state.season.goals, assists: state.season.assists, avg_rating: seasonAvgRating(state) } };
  }
  if (c.phase === 'season_end') {
    const r = state.result;
    return { ...base, type: 'season_end', trajectory: r.trajectory, title: renderText(r.title, state, content), text: renderText(r.text, state, content), coda: renderText(r.coda, state, content), teasers: r.teasers.map((t) => renderText(t, state, content)), season: r.season };
  }
  throw new Error('невідома фаза ' + c.phase);
}

// ---------- рух по хребту ----------
function advanceFlow(state, content) {
  const c = state.cursor;
  const ep = content.episodes[c.ep];
  for (;;) {
    c.slot += 1;
    const slot = ep.flow[c.slot];
    if (!slot) { c.phase = 'episode_end'; c.node = null; return; }
    if (slot.when && !evalCond(slot.when, state)) continue;
    if (slot.card) {
      const card = content.cards[slot.card];
      if (!nodeAllowed(card, state)) continue;
      state.seen[slot.card] = true; c.node = slot.card; c.phase = 'node'; return;
    }
    if (slot.pool) {
      const keys = (poolIndex(content)[slot.pool] || []).filter((k) => !state.seen[k] && nodeAllowed(content.cards[k], state));
      if (!keys.length) continue;
      const total = keys.reduce((a, k) => a + (content.cards[k].weight ?? 1), 0);
      let r = rand01(state.rng) * total, pick = keys[keys.length - 1];
      for (const k of keys) { r -= (content.cards[k].weight ?? 1); if (r < 0) { pick = k; break; } }
      state.seen[pick] = true; c.node = pick; c.phase = 'node'; return;
    }
    if (slot.match) {
      state.match = { key: slot.match, i: -1, bonus: 0, approach: null, counters: {}, rating: content.matches[slot.match].rating_base ?? 6.0, goals: 0, assists: 0, result: null };
      c.node = '__approach'; c.phase = 'node'; return;
    }
    throw new Error('слот хребта без card/pool/match');
  }
}
function nextMoment(state, content) {
  const m = state.match, c = state.cursor;
  const md = content.matches[m.key];
  m.i += 1;
  const list = md.moments[state.hero.pos];
  if (m.i < list.length) { c.node = list[m.i]; c.phase = 'node'; return; }
  finalizeMatch(state, content);
}
function finalizeMatch(state, content) {
  const m = state.match, c = state.cursor;
  const md = content.matches[m.key];
  let fin = null;
  for (const f of md.final) { if (evalCond(f.when, state)) { fin = f; break; } }
  if (!fin) throw new Error('жодне правило final не спрацювало у матчі «' + m.key + '»');
  const rating = round1(clamp(m.rating, 4.5, 9.5));
  m.result = { score: fin.score, text: fin.text, rating, goals: m.goals, assists: m.assists };
  state.season.goals += m.goals; state.season.assists += m.assists; state.season.ratings.push(rating);
  const report = { delta: [], npc: [], traces: [] };
  applyEffects(state, content, fin.effects, report);
  c.delta = report; c.phase = 'match_result'; c.node = null;
}
function enterScene(state, content, key, roll) {
  const sc = content.scenes[key];
  if (!sc) throw new Error('нема сцени «' + key + '»');
  const c = state.cursor;
  const report = { delta: [], npc: [], traces: [] };
  applyEffects(state, content, sc.effects, report);
  if (sc.m && state.match) {
    const m = state.match;
    if (sc.m.rating) m.rating += sc.m.rating;
    if (sc.m.goals) m.goals += sc.m.goals;
    if (sc.m.assists) m.assists += sc.m.assists;
    for (const [k, v] of Object.entries(sc.m.counters || {})) m.counters[k] = (m.counters[k] || 0) + v;
  }
  c.phase = 'scene'; c.scene = key; c.roll = roll || null; c.delta = report; c.node = null;
}

// ---------- крок ----------
export function step(stateIn, content, input) {
  const state = clone(stateIn);
  const c = state.cursor;
  const result = { kind: null, card: null, choice: null, roll: null, delta: null };
  if (state.done) throw new Error('проходження завершено');

  if (c.phase === 'episode_start') {
    if (!input || !input.continue) throw new Error('очікується continue');
    c.ep_stats = snapshotStats(state);
    c.slot = -1;
    advanceFlow(state, content);
    result.kind = 'episode_start';
    return { state, result };
  }

  if (c.phase === 'node') {
    const nodeKey = c.node;
    const node = getNode(state, content, nodeKey);
    const opt = (node.options || []).find((o) => o.key === (input && input.choice) && evalCond(o.when, state));
    if (!opt) throw new Error('невірний вибір «' + (input && input.choice) + '» у вузлі «' + nodeKey + '»');
    result.kind = nodeKey === '__approach' ? 'approach' : (content.moments[nodeKey] ? 'moment' : 'card');
    result.card = nodeKey; result.choice = opt.key;
    if (nodeKey === '__approach') {
      state.match.approach = opt.key;
      state.match.bonus = content.matches[state.match.key].approaches.find((a) => a.key === opt.key).bonus || 0;
    }
    const rep0 = { delta: [], npc: [], traces: [] };
    applyEffects(state, content, opt.effects, rep0);
    let sceneKey = opt.scene, rollInfo = null;
    if (opt.roll) {
      const target = targetOf(opt, state);
      const die = rollD100(state.rng);
      const ok = die <= target;
      rollInfo = { target, die, ok };
      sceneKey = ok ? opt.roll.ok : opt.roll.fail;
      result.roll = rollInfo;
    }
    if (nodeKey !== '__approach' && content.cards[nodeKey] && content.cards[nodeKey].big) {
      state.big += 1;
    }
    if (nodeKey === '__approach' && !sceneKey) { nextMoment(state, content); }
    else if (sceneKey) {
      enterScene(state, content, sceneKey, rollInfo);
      // ефекти самого вибору показуємо разом зі сценою
      if (rep0.delta.length || rep0.npc.length || rep0.traces.length) {
        c.delta.delta = rep0.delta.concat(c.delta.delta);
        c.delta.npc = rep0.npc.concat(c.delta.npc);
        c.delta.traces = rep0.traces.concat(c.delta.traces);
      }
    } else {
      if (state.match) nextMoment(state, content); else advanceFlow(state, content);
    }
    result.delta = sceneKey ? c.delta : rep0; // без сцени звітуємо про ефекти самого вибору
    return { state, result };
  }

  if (c.phase === 'scene') {
    if (!input || !input.continue) throw new Error('очікується continue');
    const sc = content.scenes[c.scene];
    result.kind = 'scene'; result.card = c.scene;
    c.roll = null; c.delta = null; c.scene = null;
    if (sc.then && sc.then.goto) { c.node = sc.then.goto; c.phase = 'node'; state.seen[sc.then.goto] = true; }
    else if (state.match && !state.match.result) nextMoment(state, content);
    else advanceFlow(state, content);
    return { state, result };
  }

  if (c.phase === 'match_result') {
    if (!input || !input.continue) throw new Error('очікується continue');
    result.kind = 'match_result'; result.card = state.match.key;
    state.match = null; c.delta = null;
    advanceFlow(state, content);
    return { state, result };
  }

  if (c.phase === 'episode_end') {
    if (!input || !input.continue) throw new Error('очікується continue');
    result.kind = 'episode_end';
    c.ep += 1;
    if (c.ep >= content.episodes.length) { c.ep = content.episodes.length - 1; finishSeason(state, content); result.kind = 'season_end'; return { state, result }; }
    c.phase = 'episode_start'; c.slot = -1; c.node = null;
    return { state, result };
  }

  throw new Error('крок у фазі «' + c.phase + '»');
}

// ---------- траєкторії ----------
export function pickTrajectory(state, content) {
  for (const t of content.trajectories) { if (evalCond(t.when, state)) return t; }
  const d = content.trajectories.find((t) => t.key === content.default_trajectory);
  if (!d) throw new Error('нема траєкторії за замовчуванням');
  return d;
}
function finishSeason(state, content) {
  const t = pickTrajectory(state, content);
  state.cursor.phase = 'season_end';
  state.done = true;
  state.result = {
    trajectory: t.key, title: t.title, text: t.text, coda: t.coda, teasers: t.teasers || [],
    season: { goals: state.season.goals, assists: state.season.assists, avg_rating: seasonAvgRating(state), matches: state.season.ratings.length },
  };
}

// ---------- допоміжне для хоста ----------
export function describeState(state) { return { phase: state.cursor.phase, ep: state.cursor.ep + 1, node: state.cursor.node, done: state.done }; }

// Які входи зараз допустимі (для ботів, fuzz, Monte-Carlo і валідатора досяжності).
export function legalInputs(state, content) {
  if (state.done) return [];
  const c = state.cursor;
  if (c.phase !== 'node') return [{ continue: true }];
  const node = getNode(state, content, c.node);
  return (node.options || []).filter((o) => evalCond(o.when, state)).map((o) => ({ choice: o.key }));
}
