// Створення героя: 9 кроків (№447–452, №432, №434, №501, №517).
import { CHARACTERS, CLUBS, DIFFICULTIES, DURATIONS, EVENT_RATES, PEOPLE, PHYSICAL_COPY, POSITIONS, POSITION_ROLES, REAL_PLAYER_EXAMPLE, SUBPOSITIONS, THREE_CLUBS, clubFit } from './demo.js';
import { disclaimer, esc, fullName, heroSvg, shell } from './kit.js';

const LABELS = ['Ім’я', 'Позиція', 'Підпозиція', 'Фізичний акцент', 'Характер', 'Клуб', 'Довжина', 'Складність', 'Налаштування'];
const TITLES = ['Як звати героя?', 'Яка група позиції?', 'Яка його роль на полі?', 'У чому фізичний акцент?', 'Який у нього характер?', 'Де почнеться історія?', 'Скільки триватиме кар’єра?', 'Скільки інформації бачиш?', 'Яким буде його світ?'];
const LEADS = ['Ім’я обов’язкове; прізвище можна не вказувати.', 'Позиція задає загальну групу ролей.', 'Підпозиція визначає техніку, інтелект і пару фізичних акцентів.', 'Один із двох рівноцінних фізичних акцентів стає третьою вершиною радара.', 'Вісім однаково сильних стилів із клубною сумісністю.', 'Випадковий клуб, вибір із трьох або весь список.', 'Окремо обери фінал історії та темп керування.', 'Складність змінює видимість чисел, шансів і наслідків.', 'Особисті сцени, частота подій та реальні імена.'];
export const STEPS = LABELS.length;

const pressName = (h) => h.lastName.trim() || h.firstName.trim() || 'Герой';

// Тихий рядок під прев’ю імені: повний збіг із реальним футболістом (№501) або невпевнені форми (№503).
function nameNote(state) {
  const h = state.hero;
  if (h.realNames && fullName(h).toLowerCase() === REAL_PLAYER_EXAMPLE.toLowerCase()) {
    return `<div class="name-system-state collision"><b>Збіг із реальним футболістом</b><span>У світі є реальний ${REAL_PLAYER_EXAMPLE} — у цій історії його замінить вигаданий футболіст.</span></div>`;
  }
  if (state.nameUncertain) return '<div class="name-system-state uncertain"><b>Форми імені невпевнені</b><span>Звертання буде без імені.</span></div>';
  return '';
}

function pick(h, key, value, sub, disabled = false) {
  const selected = h[key] === value;
  return `<button type="button" class="pick ${selected ? 'selected' : ''}" data-choice="${key}" data-value="${value}" aria-pressed="${selected}" ${disabled ? 'disabled' : ''}><strong>${value}</strong><span>${sub}</span></button>`;
}

function radar(subposition, accent) {
  const profile = SUBPOSITIONS[subposition];
  const points = profile[2].indexOf(accent) === 1 ? '150,53 246,119 213,235 83,220 62,112' : '150,68 234,125 221,221 92,236 55,120';
  return `<div class="profile-radar"><svg viewBox="-34 0 368 286" role="img" aria-label="П’ять вершин профілю: ${profile[0]}, ${profile[1]}, ${accent}, Форма, Ментальність"><g class="profile-radar-grid"><polygon points="150,30 270,116 224,256 76,256 30,116"/><polygon points="150,78 222,130 194,214 106,214 78,130"/><line x1="150" y1="150" x2="150" y2="30"/><line x1="150" y1="150" x2="270" y2="116"/><line x1="150" y1="150" x2="224" y2="256"/><line x1="150" y1="150" x2="76" y2="256"/><line x1="150" y1="150" x2="30" y2="116"/></g><polygon class="profile-radar-value" points="${points}"/><g class="profile-radar-labels"><text x="150" y="18" text-anchor="middle">${profile[0]}</text><text x="332" y="55" text-anchor="end">${profile[1]}</text><text x="236" y="278" text-anchor="middle">${accent}</text><text x="64" y="278" text-anchor="middle">Форма</text><text x="-30" y="55">Ментальність</text></g></svg><div class="radar-profile-note"><span>${subposition}</span><strong>${profile[0]} · ${profile[1]} · ${accent}</strong><small>Підпозиція задає перші дві вершини, фізичний акцент — третю.</small></div></div>`;
}

function body(step, state) {
  const h = state.hero;
  if (step === 1) {
    return `<div class="name-grid"><div class="field"><div class="field-head"><h3>Ім’я</h3><small id="firstNameCount">${h.firstName.length} / 20</small></div><input id="heroFirstName" class="text-input" maxlength="20" autocomplete="off" value="${esc(h.firstName)}" placeholder="Марко" aria-describedby="nameError"><small id="nameError" class="field-error" ${state.nameError ? '' : 'hidden'}>Введи ім’я героя</small></div><div class="field"><div class="field-head"><h3>Прізвище</h3><small>необов’язково</small></div><input id="heroLastName" class="text-input" maxlength="24" autocomplete="off" value="${esc(h.lastName)}" placeholder="Черненко"></div></div><article class="name-preview"><span class="eyebrow">Так тебе називатимуть</span><div><span>Особисті сцени</span><b id="sceneNamePreview">${esc(h.firstName.trim() || 'Ім’я')}</b></div><div><span>Преса й коментатор</span><b id="pressNamePreview">${esc(pressName(h))}</b></div></article><div id="nameNote">${nameNote(state)}</div>`;
  }
  if (step === 2) return `<div class="field"><div class="field-head"><h3>Позиція</h3><small>визначає стартові скіли</small></div><div class="pick-grid">${POSITIONS.map(([v, sub]) => pick(h, 'position', v, sub)).join('')}</div></div>`;
  if (step === 3) {
    const roles = POSITION_ROLES[h.position];
    return `<div class="field"><div class="field-head"><h3>Підпозиція</h3><small>${h.position}: ${roles.length > 1 ? 'обери одну з двох ролей' : 'роль одна, вже обрана'}</small></div><div class="subposition-grid">${roles.map((name) => [name, SUBPOSITIONS[name]]).map(([name, p]) => `<button type="button" class="subposition-card ${h.subposition === name ? 'selected' : ''}" data-choice="subposition" data-value="${name}" aria-pressed="${h.subposition === name}"><strong>${name}</strong><span><b>Техніка</b>${p[0]}</span><span><b>Інтелект</b>${p[1]}</span><span><b>Фізика</b>${p[2].join(' / ')}</span></button>`).join('')}</div></div>${radar(h.subposition, h.physicalAccent)}`;
  }
  if (step === 4) {
    return `<div class="field"><div class="field-head"><h3>Фізичний акцент</h3><small>обери третю вершину радара</small></div><div class="physical-choice-grid">${SUBPOSITIONS[h.subposition][2].map((name) => `<button type="button" class="physical-card ${h.physicalAccent === name ? 'selected' : ''}" data-choice="physicalAccent" data-value="${name}" aria-pressed="${h.physicalAccent === name}"><strong>${name}</strong><span>${PHYSICAL_COPY[name]}</span><small>Рівноцінний вибір · без «краще / гірше»</small></button>`).join('')}</div></div>${radar(h.subposition, h.physicalAccent)}`;
  }
  if (step === 5) {
    return `<div class="field"><div class="field-head"><h3>Характер</h3><small>стиль, а не сила · усі рівноцінні</small></div><div class="character-grid detailed">${CHARACTERS.map(([name, text, up, down, own, foreign]) => `<div class="character-item"><button type="button" class="character-card ${h.character === name ? 'selected' : ''}" data-choice="character" data-value="${name}" aria-pressed="${h.character === name}"><strong>${name}</strong><p>${text}</p><div class="character-effects">${up.map((x) => `<span class="up">▲ ${x}</span>`).join('')}${down.map((x) => `<span class="down">▼ ${x}</span>`).join('')}</div><div class="club-fit-line"><span>свій у <b>${own.join(' · ')}</b></span><span>чужий у <b>${foreign.join(' · ')}</b></span></div></button><button type="button" class="detail-link" data-toast="${name}: ${text.toLowerCase()}. Характер змінює тип сцен, сумісність із клубом і стиль розвитку, а не силу героя." aria-label="Детальніше про характер «${name}»">Детальніше</button></div>`).join('')}</div></div>`;
  }
  if (step === 6) {
    const visible = h.clubMode === 'random' ? CLUBS.filter((c) => c[0] === h.club) : h.clubMode === 'three' ? THREE_CLUBS.map((n) => CLUBS.find((c) => c[0] === n)) : CLUBS;
    const modes = [['random', 'Випадковий'], ['three', 'Один із трьох'], ['all', 'Обрати самому']];
    return `<div class="field"><div class="field-head"><h3>Як обираємо клуб?</h3><small>пул рівно 8 клубів</small></div><div class="club-mode-tabs">${modes.map(([id, label]) => `<button type="button" class="${h.clubMode === id ? 'active' : ''}" aria-pressed="${h.clubMode === id}" data-club-mode="${id}">${label}</button>`).join('')}</div><div class="pick-grid club-grid ${h.clubMode === 'all' ? 'all' : ''}">${visible.map(([name, league, text]) => { const fit = clubFit(h.character, name); return `<button type="button" class="pick club-pick ${h.club === name ? 'selected' : ''}" data-choice="club" data-value="${name}" aria-pressed="${h.club === name}"><span class="fit-badge ${fit[1]}">${fit[0]}</span><strong>${name}</strong><span>${league}</span><p>${text}</p></button>`; }).join('')}</div>${h.clubMode === 'random' ? '<p class="field-hint">Клуб визначила випадковість. Натисни «Випадковий» ще раз, щоб побачити інший приклад.</p>' : ''}</div>`;
  }
  if (step === 7) {
    const quick = h.duration === 'Дебют'
      ? '<button type="button" class="pick" disabled><strong>Швидко</strong><span>Для «Дебюту» не застосовується</span></button>'
      : pick(h, 'tempo', 'Швидко', 'План сезону на старті · паузи автоматично · нижча стеля');
    return `<div class="field"><div class="field-head"><h3>Відрізок</h3><small>скільки сезонів проживаємо</small></div><div class="duration-grid">${DURATIONS.map(([v, sub]) => pick(h, 'duration', v, sub)).join('')}</div></div><div class="field"><div class="field-head"><h3>Темп</h3><small>скільки рішень контролюєш</small></div><div class="tempo-grid">${pick(h, 'tempo', 'Крок за кроком', '4 паузи «Твій тиждень» щосезону · найвища стеля')}${quick}</div></div><article class="difficulty-note"><strong>${h.duration} · ${h.tempo}</strong><span>Кожен відрізок має власний фінал — історія не обривається.</span></article>`;
  }
  if (step === 8) {
    const current = DIFFICULTIES.find((d) => d[0] === h.difficulty);
    return `<div class="field"><div class="field-head"><h3>Складність</h3><small>рекомендовано: Нормально</small></div><div class="pick-grid three">${DIFFICULTIES.map(([v, sub]) => pick(h, 'difficulty', v, sub)).join('')}</div></div><article class="difficulty-note"><strong>${h.difficulty}</strong><span>${current[2]}</span></article>`;
  }
  const flag = (key, title, text) => `<label class="rule-row"><input type="checkbox" data-flag="${key}" ${h[key] ? 'checked' : ''}><div><strong>${title}</strong><p>${text}</p></div></label>`;
  const quickHard = h.tempo === 'Швидко' && h.difficulty === 'Складно';
  return `<div class="field"><div class="field-head"><h3>Близька людина</h3><small>впливає на особисті сцени</small></div><div class="pick-grid">${PEOPLE.map(([v, sub]) => pick(h, 'person', v, sub)).join('')}</div></div><div class="field"><div class="field-head"><h3>Події між матчами</h3><small>за замовчуванням: Помірно</small></div><div class="pick-grid">${EVENT_RATES.map(([v, sub]) => pick(h, 'events', v, sub)).join('')}</div></div><label class="switch-row"><input type="checkbox" data-flag="realNames" ${h.realNames ? 'checked' : ''}><span><strong>Реальні імена</strong><small>Увімкнено за замовчуванням; вимкнено — усі люди вигадані</small></span></label><details class="field" ${state.extraOpen ? 'open' : ''}><summary>Додатково</summary><div class="rules-list">${flag('personal', 'Особисте', 'Сцени поза футболом')}${flag('injuries', 'Травми', 'Вимкнено за замовчуванням')}${flag('scandals', 'Скандали-приколи', 'Легші випадкові події')}</div></details><article class="review-box"><span class="eyebrow">Перед стартом</span><strong>${esc(fullName(h) || 'Твій герой')} · ${h.subposition}</strong><p>${h.club} · ${h.character} · ${h.duration} · ${h.tempo} · ${h.difficulty}</p></article>${quickHard ? '<article class="quick-hard-warning"><span>Важливо перед стартом</span><strong>Швидко на Складно складніше, ніж здається: близько 1 з 3 кар’єр не складається.</strong></article>' : ''}`;
}

export function render({ state, step }) {
  const h = state.hero;
  const summary = [['Клуб', h.club], ['Позиція', h.position], ['Підпозиція', h.subposition], ['Фізичний акцент', h.physicalAccent], ['Характер', h.character], ['Відрізок', h.duration], ['Темп', h.tempo], ['Складність', h.difficulty]];
  const back = step > 1
    ? `<button class="button secondary" type="button" data-go="#create/${step - 1}">Назад</button>`
    : '<button class="button ghost" type="button" data-go="#home">Скасувати</button>';
  return shell(`<div class="content compact"><a class="breadcrumb" href="#career">Кар’єра гравця</a><div class="section-head"><div><span class="eyebrow">Нова кар’єра · крок ${step} з ${STEPS}</span><h1 class="section-title create-title">${TITLES[step - 1]}</h1><p class="section-copy">${LEADS[step - 1]}</p></div></div><nav class="wizard-tabs nine" aria-label="9 кроків створення">${LABELS.map((label, i) => `<button type="button" class="wizard-tab ${step === i + 1 ? 'active' : step > i + 1 ? 'done' : ''}" data-go="#create/${i + 1}" ${step === i + 1 ? 'aria-current="step"' : ''}><span>${i + 1}</span>${label}</button>`).join('')}</nav><div class="create-layout"><form class="card form-card" id="heroForm" novalidate>${body(step, state)}<div class="wizard-actions">${back}<button class="button" type="submit">${step === STEPS ? 'Почати кар’єру' : 'Далі'}</button></div></form><aside class="card summary-card"><span class="eyebrow">Картка героя</span><div class="hero-silhouette">${heroSvg()}</div><h2 class="card-title" id="previewName">${esc(fullName(h) || 'Твій герой')}</h2><p class="muted tiny">17 років · молодіжна команда</p><div class="summary-list">${summary.map(([k, v]) => `<div class="summary-item"><span>${k}</span><b>${v}</b></div>`).join('')}</div><p class="tiny muted">Характер задає стиль, але не робить героя сильнішим або слабшим.</p></aside></div>${disclaimer(h.realNames)}</div>`);
}

export function bind(root, { state, step, go, rerender, startCareer }) {
  const h = state.hero;
  const form = root.querySelector('#heroForm');
  if (!form) return;

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if ((step === 1 || step === STEPS) && !h.firstName.trim()) {
      state.nameError = true;
      if (step === 1) { rerender(); root.querySelector('#heroFirstName')?.focus(); } else go('#create/1');
      return;
    }
    if (step === STEPS) startCareer();
    else go(`#create/${step + 1}`);
  });

  form.querySelectorAll('[data-choice]').forEach((button) => button.addEventListener('click', () => {
    h[button.dataset.choice] = button.dataset.value;
    if (!POSITION_ROLES[h.position].includes(h.subposition)) h.subposition = POSITION_ROLES[h.position][0];
    if (!SUBPOSITIONS[h.subposition][2].includes(h.physicalAccent)) h.physicalAccent = SUBPOSITIONS[h.subposition][2][0];
    if (h.duration === 'Дебют') h.tempo = 'Крок за кроком';
    rerender();
  }));

  form.querySelectorAll('[data-club-mode]').forEach((button) => button.addEventListener('click', () => {
    h.clubMode = button.dataset.clubMode;
    if (h.clubMode === 'random') {
      const others = CLUBS.filter((c) => c[0] !== h.club);
      h.club = others[Math.floor(Math.random() * others.length)][0];
    } else if (h.clubMode === 'three' && !THREE_CLUBS.includes(h.club)) {
      h.club = THREE_CLUBS[0];
    }
    rerender();
  }));

  form.querySelectorAll('[data-flag]').forEach((box) => box.addEventListener('change', () => {
    h[box.dataset.flag] = box.checked;
    state.extraOpen = Boolean(form.querySelector('details')?.open);
    rerender();
  }));
  form.querySelector('details')?.addEventListener('toggle', (event) => { state.extraOpen = event.target.open; });

  // Ім’я оновлюємо на місці, щоб не губити курсор.
  [['#heroFirstName', 'firstName'], ['#heroLastName', 'lastName']].forEach(([selector, key]) => {
    form.querySelector(selector)?.addEventListener('input', (event) => {
      h[key] = event.target.value;
      if (h.firstName.trim()) state.nameError = false;
      const set = (id, text) => { const el = root.querySelector(id); if (el) el.textContent = text; };
      set('#firstNameCount', `${h.firstName.length} / 20`);
      set('#sceneNamePreview', h.firstName.trim() || 'Ім’я');
      set('#pressNamePreview', pressName(h));
      set('#previewName', fullName(h) || 'Твій герой');
      const error = root.querySelector('#nameError');
      if (error) error.hidden = !state.nameError;
      const note = root.querySelector('#nameNote');
      if (note) note.innerHTML = nameNote(state);
    });
  });
}
