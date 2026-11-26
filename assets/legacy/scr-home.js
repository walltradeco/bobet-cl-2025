// Головна Football Legacy: з активною кар’єрою, без неї та для нового гравця.
import { ACHIEVEMENTS_PREVIEW, FINISHED_RUN } from './demo.js';
import { achievementMini, difficultyClass, disclaimer, esc, fullName, heroSvg, initials, medal, rule, shell, soonCard, statePanel } from './kit.js';

function newcomer(realNames) {
  return shell(`<div class="content"><section class="hero newcomer-hero"><div><span class="eyebrow">Перший вхід</span><h1 class="display">У тебе все попереду.</h1><p class="lede">Створи 17-річного футболіста й проведи його від молодіжної команди до останнього матчу.</p><div class="hero-actions"><button type="button" class="button" data-go="#create/1">Створити героя</button><button type="button" class="button secondary" data-scroll="next-steps">Як це працює</button></div></div><article class="card newcomer-card">${heroSvg()}<div><span class="eyebrow">Перша кар’єра</span><h2>Твоя історія почнеться тут</h2><p>Клуб, позиція, характер і складність — перед стартом.</p></div></article></section>
    <section><div class="section-head"><div><span class="eyebrow">01 · Почни тут</span><h2 class="section-title">Режим кар’єри</h2></div></div><div class="mode-grid newcomer-modes"><article class="card mode-card active"><div class="mode-icon">17</div><span class="eyebrow">Доступно зараз</span><h3>Футболіст</h3><p>Кар’єра гравця з нуля: сюжетні вибори, матчі, сезони, трансфери й фінал.</p><div class="empty-promise"><span>Крок 1</span><strong>Створи героя</strong></div><button type="button" class="button" data-go="#create/1">Нова кар’єра</button></article>${soonCard('▦', 'Тренер', 'Склад, тактика, роздягальня')}${soonCard('✦', 'Premium «What If»', 'Готові авторські історії: що було б, якби…')}</div></section>
    <section class="section two-col"><article class="card empty-achievements">${medal('★', 'bronze', 'locked')}<div><span class="eyebrow">Твоя колекція</span><h2 class="section-title">Отримай першу ачівку</h2><p class="section-copy">Прогрес ведеться окремо на Легко, Нормально й Складно. Перший результат з’явиться після старту кар’єри.</p><div class="difficulty-context"><span class="difficulty-badge easy">Легко</span><span class="difficulty-badge normal">Нормально</span><span class="difficulty-badge hard">Складно</span></div></div></article><article class="card" id="next-steps"><span class="eyebrow">За 60 секунд</span><h2 class="section-title">Що буде далі</h2><div class="rules-list">${rule('01', 'Створи героя', 'Обери клуб, позицію, характер і складність.')}${rule('02', 'Проживай сезон', 'Тижневі дії, сюжетні рішення й ключові моменти матчів.')}${rule('03', 'Залиш спадщину', 'Титули, кінцівки й окремі ачівки кожної складності.')}</div></article></section>${disclaimer(realNames)}</div>`);
}

export function render({ state, activeRun }) {
  const panel = statePanel(state.view);
  if (panel) return panel;
  if (state.newcomer) return newcomer(state.hero.realNames);

  const run = activeRun();
  const name = run ? esc(fullName(run)) : '';
  const heroButtons = run
    ? '<button type="button" class="button" data-go="#career">Продовжити кар’єру</button>'
    : '<button type="button" class="button" data-go="#create/1">Нова кар’єра</button>';
  const activeCard = run
    ? `<article class="card lift"><p class="card-kicker">Активна кар’єра · ${run.difficulty} · сезон ${run.season}</p><div class="active-run"><div class="avatar">${esc(initials(run))}</div><div class="run-meta"><strong>${name}</strong><span>${run.position} · ${run.club} · ${run.age} років</span></div></div><div class="progress-row"><span class="mono tiny">${run.rating} OVR</span><div class="progress-track"><div class="progress-fill" style="width:${run.rating}%"></div></div><span class="tag">${run.status}</span></div></article>`
    : `<article class="card newcomer-card">${heroSvg()}<div><span class="eyebrow">Немає активної кар’єри</span><h2>Почни нову історію</h2><p>Клуб, позиція, характер і складність — перед стартом.</p></div></article>`;
  const modeRun = run
    ? `<div class="active-run"><div class="avatar">${esc(initials(run))}</div><div class="run-meta"><strong>Продовжити сезон ${run.season}</strong><span>${run.club} · ${run.difficulty} · ${run.rating} OVR</span></div></div><button type="button" class="button" data-go="#career">Відкрити режим</button>`
    : '<button type="button" class="button" data-go="#create/1">Нова кар’єра</button>';
  const difficulty = run ? run.difficulty : state.hero.difficulty;
  const activeRow = run
    ? `<div class="list-row"><div><strong>${name}</strong><small>${run.position} · сезон ${run.season}</small></div><span class="tag">У грі</span><button type="button" class="button secondary" data-go="#career">Продовжити</button></div>`
    : '';

  return shell(`<div class="content">
    <section class="hero"><div><span class="eyebrow">Твоя футбольна історія</span><h1 class="display">Кар’єра, яку пам’ятатимуть.</h1><p class="lede">Почни у 17. Роби вибір. Вигравай трофеї. Ачівки назавжди лишаться у твоєму профілі BoOrbit.</p><div class="hero-actions">${heroButtons}<button type="button" class="button secondary" data-scroll="achievements">Мої ачівки</button></div></div>
      ${activeCard}
    </section>
    <section><div class="section-head"><div><span class="eyebrow">01 · Обери шлях</span><h2 class="section-title">Режими кар’єри</h2></div></div>
      <div class="mode-grid">
        <article class="card mode-card active"><div class="mode-icon">10</div><span class="eyebrow">Доступно зараз</span><h3>Футболіст</h3><p>Кар’єра гравця з нуля: від 17 років до фіналу кар’єри.</p>${modeRun}</article>
        ${soonCard('▦', 'Тренер', 'Склад, тактика, роздягальня')}${soonCard('✦', 'Premium «What If»', 'Готові авторські історії: що було б, якби…')}
      </div>
    </section>
    <section class="section two-col" id="achievements"><article class="card"><div class="section-head"><div><span class="eyebrow">02 · Лишається назавжди</span><h2 class="section-title">Ачівки</h2></div><button type="button" class="button secondary" data-toast="Екран ачівок з’явиться в партії 3.">Усі ачівки</button></div>
      <div class="difficulty-context"><span class="difficulty-badge ${difficultyClass(difficulty)}">${difficulty}</span><span class="muted tiny">окрема колекція цієї складності</span></div>
      <div class="achievement-strip">${ACHIEVEMENTS_PREVIEW.map(achievementMini).join('')}</div></article>
      <article class="card"><span class="eyebrow">03 · За 60 секунд</span><h2 class="section-title">Як це працює</h2><div class="rules-list">${rule('01', 'Твій тиждень', 'Обери рівно 2 дії: тренування, розмова або заява.')}${rule('02', 'Епізод і матч', 'Рішення змінюють історію, а навички — шанси.')}${rule('03', 'Сезон за сезоном', 'Титули, трансфери, статуси й фінал кар’єри.')}</div></article>
    </section>
    <section class="section"><div class="section-head"><div><span class="eyebrow">Останні проходження</span><h2 class="section-title">Мої історії</h2></div></div><div class="list">${activeRow}<div class="list-row"><div><strong>${FINISHED_RUN.name}</strong><small>${FINISHED_RUN.position} · завершено</small></div><span class="tag">${FINISHED_RUN.ending}</span><button type="button" class="button secondary" data-toast="Підсумок кар’єри з’явиться в партії 3.">Підсумок</button></div></div></section>${disclaimer(state.hero.realNames)}
  </div>`);
}
