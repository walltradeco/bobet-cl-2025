// «Кар’єра гравця»: огляд активної історії.
import { ACHIEVEMENTS_PREVIEW, FINISHED_RUN, FRIENDS } from './demo.js';
import { achievementMini, disclaimer, esc, fullName, initials, medal, rule, shell, statePanel } from './kit.js';

export function render({ state, activeRun }) {
  const panel = statePanel(state.view);
  if (panel) return panel;
  const run = activeRun();
  if (!run) {
    return shell(`<div class="content"><article class="card state-panel">${medal('★', 'bronze', 'locked')}<span class="eyebrow">Початок історії</span><h2>Тут ще немає активної кар’єри</h2><p>Створи героя — і почни кар’єру з 17 років.</p><button type="button" class="button" data-go="#create/1">Нова кар’єра</button></article></div>`);
  }
  // Реальний шанс кар’єри — лише на Легко й Нормально.
  const chance = run.difficulty === 'Складно' ? ''
    : `<div class="career-chance-hint"><span>Реальний шанс цієї кар’єри</span><strong>${run.difficulty} · ${run.chance}%</strong><small>Одне стабільне число для всього шляху героя; це не прогноз окремого матчу.</small></div>`;

  return shell(`<div class="content compact"><a class="breadcrumb" href="#home">Головна Legacy Mode</a>
    <section class="mode-hero"><div><span class="eyebrow">Режим · футболіст</span><h1 class="display">Кар’єра гравця</h1><p class="lede">Від молодіжної команди до останнього матчу — одна історія, сотні рішень.</p></div><div class="mode-hero__mark"><div class="rating">${run.rating}<small>OVR</small></div><div><strong>Поточний пік</strong><span>Сезон ${run.season} · ${run.age} років</span></div><button type="button" class="icon-button" data-toast="Рейтинг — ціле число за шкалою від 0 до 100." aria-label="Що таке рейтинг">i</button></div></section>
    <section class="section"><div class="section-head"><div><span class="eyebrow">Моє проходження</span><h2 class="section-title">Продовжити історію</h2></div><span class="badge">1 активна максимум</span></div>
      <article class="card run-card"><div class="player-emblem">${esc(initials(run))}</div><div class="run-info"><span class="eyebrow">У грі · сезон ${run.season}</span><h2>${esc(fullName(run))}</h2><p class="muted">${run.position} · ${run.club} · ${run.age} років</p><div class="stat-list"><span><b>${run.rating}</b>рейтинг</span><span><b>${run.status}</b>в команді</span><span><b>${run.mentality}</b>ментальність</span><span><b>${run.titles}</b>титули</span></div>${chance}</div><div class="run-actions"><button type="button" class="button" data-toast="Сезон («Твій тиждень», сцени, матч) з’явиться в партії 2.">Продовжити</button><button type="button" class="button danger" data-drop>Кинути</button></div></article>
      <p class="tiny muted" style="margin-top:10px">Нова кар’єра стане доступною після завершення або відмови від активної.</p></section>
    <section class="section two-col"><article><div class="section-head"><div><span class="eyebrow">Завершені</span><h2 class="section-title">Попередні кар’єри</h2></div></div><div class="list"><div class="list-row"><div><strong>${FINISHED_RUN.name} · ${FINISHED_RUN.club}</strong><small>${FINISHED_RUN.position} · пік ${FINISHED_RUN.peak} · ${FINISHED_RUN.titles} титулів</small></div><span class="tag">${FINISHED_RUN.ending}</span><button type="button" class="button secondary" data-toast="Підсумок кар’єри з’явиться в партії 3.">Підсумок</button></div></div></article><article class="card"><span class="eyebrow">Друзі у цьому режимі</span><div class="rules-list">${FRIENDS.map(([name, text], i) => rule(`0${i + 1}`, name, text)).join('')}</div></article></section>
    <section class="section two-col"><article class="card"><div class="section-head"><div><span class="eyebrow">Прогрес режиму</span><h2 class="section-title">Ачівки футболіста</h2></div><button type="button" class="button secondary" data-toast="Екран ачівок з’явиться в партії 3.">Дивитися всі</button></div><div class="achievement-strip">${ACHIEVEMENTS_PREVIEW.map(achievementMini).join('')}</div></article><article class="card"><span class="eyebrow">Коротко</span><h2 class="section-title">Три кроки гри</h2><div class="rules-list">${rule('1', 'Обирай', 'Дії тижня, відповіді й підхід до матчу.')}${rule('2', 'Розвивай', 'Навички відкривають нові варіанти.')}${rule('3', 'Залиш слід', 'Титули й ачівки лишаються у профілі.')}</div></article></section>${disclaimer(state.hero.realNames)}</div>`);
}
