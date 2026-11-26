// Меню «Тест»: лише для тестової сторінки. Перед перенесенням на звичайний сайт прибрати цей файл і виклик в app.js.
import { DEMO_RUN, REAL_PLAYER_EXAMPLE } from './demo.js';

const DIFFICULTY_NAMES = ['Легко', 'Нормально', 'Складно'];
const SCREEN_LINKS = [['#catalog', 'Каталог'], ['#home', 'Головна'], ['#career', 'Кар’єра']];
const VIEWS = [['ready', 'Звичайний'], ['loading', 'Завантаження'], ['error', 'Помилка']];

export function mountTestMenu(box, { state, activeRun, go, rerender, reset, steps }) {
  box.innerHTML = '<button type="button" class="test-toggle" aria-expanded="false" aria-controls="testPanel">Тест</button><div class="test-panel" id="testPanel" hidden></div>';
  const toggle = box.querySelector('.test-toggle');
  const panel = box.querySelector('.test-panel');

  const setOpen = (open) => {
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? 'Закрити' : 'Тест';
  };

  const button = (action, value, label, pressed) => `<button type="button" data-test="${action}" data-value="${value}"${pressed === undefined ? '' : ` aria-pressed="${pressed}"`}>${label}</button>`;

  function refresh() {
    const difficulty = activeRun()?.difficulty ?? state.hero.difficulty;
    const here = location.hash || '#catalog';
    panel.innerHTML = `
      <h4>Екрани</h4><div>${SCREEN_LINKS.map(([hash, label]) => button('go', hash, label, here === hash)).join('')}</div>
      <h4>Кроки створення</h4><div>${Array.from({ length: steps }, (_, i) => button('go', `#create/${i + 1}`, i + 1, here === `#create/${i + 1}`)).join('')}</div>
      <h4>Складність</h4><div>${DIFFICULTY_NAMES.map((name) => button('difficulty', name, name, difficulty === name)).join('')}</div>
      <h4>Гравець</h4><div>${button('player', 'run', 'Є кар’єра', Boolean(activeRun()))}${button('player', 'new', 'Новий гравець', state.newcomer)}</div>
      <h4>Стан (головна й кар’єра)</h4><div>${VIEWS.map(([id, label]) => button('view', id, label, state.view === id)).join('')}</div>
      <h4>Крок «Ім’я»</h4><div>${button('collision', '', 'Збіг із реальним')}${button('uncertain', '', 'Невпевнені форми', state.nameUncertain)}</div>
      <h4>Усе</h4><div>${button('reset', '', 'Скинути приклад')}</div>
      <p>Меню лише для тестової сторінки. Дані вигадані й не зберігаються.</p>`;
  }

  toggle.addEventListener('click', () => setOpen(panel.hidden));

  panel.addEventListener('click', (event) => {
    const target = event.target.closest('[data-test]');
    if (!target) return;
    // Власні кнопки меню не мають долітати до загальних обробників сторінки.
    event.stopPropagation();
    const { test, value } = target.dataset;
    if (test === 'go') { setOpen(false); go(value); return; }
    if (test === 'reset') { setOpen(false); reset(); return; }
    if (test === 'collision') {
      const [firstName, lastName] = REAL_PLAYER_EXAMPLE.split(' ');
      Object.assign(state.hero, { firstName, lastName, realNames: true });
      state.nameUncertain = false;
      state.nameError = false;
      setOpen(false);
      go('#create/1');
      return;
    }
    if (test === 'difficulty') {
      state.hero.difficulty = value;
      if (state.run) state.run.difficulty = value;
    }
    if (test === 'player') {
      state.newcomer = value === 'new';
      if (value === 'run' && !state.run) state.run = { ...DEMO_RUN, realNames: true };
    }
    if (test === 'view') state.view = value;
    if (test === 'uncertain') state.nameUncertain = !state.nameUncertain;
    rerender();
    panel.querySelector(`[data-test="${test}"][data-value="${CSS.escape(value)}"]`)?.focus();
  });

  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !panel.hidden) setOpen(false); });

  return { refresh };
}
