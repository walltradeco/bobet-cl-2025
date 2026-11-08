// BoBet Stories — шар даних: розмова з базою (RPC stories_*) + відновлення стану. Без DOM.
// Контракт сервера: bobet/sql/608 (stories_start_run / apply / rollback / finish / abandon / my_runs / friends_results).
// Довірений клієнт: гру рахує рушій у браузері, сервер лише зберігає журнал і перевіряє власника, послідовність і розмір.
import * as E from './engine.js';

export const ROLE = 'player';
export const CHAPTER = 'debut';
const DECISION_KINDS = ['card', 'moment', 'approach']; // події-рішення: до них можна відкотитись

export class StoryError extends Error {
  constructor(message, { conflict = false } = {}) { super(message); this.conflict = conflict; }
}
function mkErr(error) {
  const m = String((error && error.message) || error || 'невідома помилка').replace(/^Stories:\s*/, '');
  return new StoryError(m, { conflict: /Конфлікт послідовності/.test(m) });
}

export function createStore(sb) {
  const contentCache = new Map();

  async function rpc(name, args) {
    const { data, error } = await sb.rpc(name, args);
    if (error) throw mkErr(error);
    return data;
  }

  // Пакет контенту: за версією (для відновлення старої гри) або поточний live.
  async function loadContent(version) {
    const key = version == null ? 'live' : 'v' + version;
    if (contentCache.has(key)) return contentCache.get(key);
    let q = sb.from('stories_content').select('chapter_key,role,version,status,bundle').eq('role', ROLE).eq('chapter_key', CHAPTER);
    q = version == null ? q.eq('status', 'live') : q.eq('version', version);
    const { data, error } = await q.order('version', { ascending: false }).limit(1);
    if (error) throw mkErr(error);
    const row = data && data[0];
    if (!row) throw new StoryError(version == null ? 'Для цього розділу ще немає опублікованого контенту' : 'Не знайдено версію контенту ' + version);
    const bundle = row.bundle;
    contentCache.set(key, bundle);
    contentCache.set('v' + row.version, bundle);
    return bundle;
  }

  // Рядок з бази → проходження в памʼяті. Початковий стан (seq 0) на сервері не зберігається ({}): відновлюємо з героя й зерна.
  function hydrate(row, content) {
    const settings = row.settings || {};
    const hero = settings.hero;
    let state = row.state;
    if (!state || !Object.keys(state).length) {
      if (!hero) throw new StoryError('У грі немає героя — відновити неможливо');
      state = E.newRun({ content, hero, settings, seed: row.seed });
    }
    return { id: row.id, status: row.status, seq: row.seq, seed: row.seed, settings, hero, state, contentVersion: row.content_version, summary: row.summary || null, trajectory: row.trajectory_key || null };
  }

  async function myRuns() {
    const rows = (await rpc('stories_my_runs')) || [];
    return rows.filter((r) => r.role === ROLE && r.chapter_key === CHAPTER);
  }

  async function startRun(hero, settings) {
    const content = await loadContent();
    const full = { ...settings, hero };
    const r = await rpc('stories_start_run', { p_role: ROLE, p_chapter: CHAPTER, p_settings: full, p_hero: hero });
    const c = await loadContent(r.content_version);
    const state = E.newRun({ content: c, hero, settings: full, seed: r.seed });
    return { content: c, run: { id: r.run_id, status: 'active', seq: 0, seed: r.seed, settings: full, hero, state, contentVersion: r.content_version, summary: null, trajectory: null } };
  }

  async function openRun(row) {
    const content = await loadContent(row.content_version);
    return { content, run: hydrate(row, content) };
  }

  // Один крок гри: рушій → збереження. Стан у памʼяті змінюємо лише після успішного збереження.
  async function step(run, content, input) {
    const { state, result } = E.step(run.state, content, input);
    const payload = {};
    if (result.roll) payload.roll = result.roll;
    if (result.delta) payload.delta = result.delta;
    const seq = run.seq + 1;
    await rpc('stories_apply', { p_run: run.id, p_seq: seq, p_kind: result.kind, p_card: result.card || null, p_choice: result.choice || null, p_payload: payload, p_state: state });
    const next = { ...run, seq, state };
    if (state.done) {
      const res = state.result;
      // Назву підставляємо ТУТ (res.title — шаблон, напр. «Надійна опора {youth.gen}»): у списках «Мої проходження» й «Як зіграли друзі»
      // стану й контенту нема, і шаблон світився б сирим. Екран кінцівки рендерить його сам через E.view.
      const summary = { trajectory: res.trajectory, title: E.renderText(res.title, state, content), season: res.season, hero: { name: state.hero.name, pos: state.hero.pos, archetype: state.hero.archetype, club: state.hero.club } };
      await rpc('stories_finish', { p_run: run.id, p_ending: res.trajectory, p_trajectory: res.trajectory, p_summary: summary, p_state: null });
      next.status = 'finished'; next.summary = summary; next.trajectory = res.trajectory;
    }
    return { run: next, result };
  }

  // Назад = відкат до стану перед останнім рішенням (картка / момент / підхід у матчі).
  async function back(run, content) {
    const { data, error } = await sb.from('stories_run_events').select('seq,kind').eq('run_id', run.id).order('seq', { ascending: false }).limit(60);
    if (error) throw mkErr(error);
    const last = (data || []).find((e) => DECISION_KINDS.includes(e.kind));
    if (!last) return null;
    const to = last.seq - 1;
    const r = await rpc('stories_rollback', { p_run: run.id, p_to_seq: to });
    let state = r.state;
    if (!state || !Object.keys(state).length) state = E.newRun({ content, hero: run.hero, settings: run.settings, seed: run.seed });
    return { ...run, seq: r.seq, state };
  }

  async function abandon(runId) { await rpc('stories_abandon', { p_run: runId }); }
  async function friendsResults() { return (await rpc('stories_friends_results', { p_role: ROLE, p_chapter: CHAPTER })) || []; }

  return { loadContent, hydrate, myRuns, startRun, openRun, step, back, abandon, friendsResults };
}

export function canGoBack(run) {
  return run.status === 'active' && (run.state.settings || {}).rollback_mode !== 'none' && run.seq >= 2;
}
