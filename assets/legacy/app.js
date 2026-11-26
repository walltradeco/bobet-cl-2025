// Переходи між екранами, стан і спільні дії Legacy Mode (тестова сторінка, лише приклад).
import { DEMO_RUN, NEW_HERO } from './demo.js';
import * as career from './scr-career.js';
import * as catalog from './scr-catalog.js';
import * as create from './scr-create.js';
import * as home from './scr-home.js';
import { mountTestMenu } from './testmenu.js';

// «key» — мітка для кольорів екрана (як у макеті).
const SCREENS = {
  catalog: { key: 'catalog', module: catalog },
  home: { key: 'hub', module: home },
  career: { key: 'mode', module: career },
  create: { key: 'create', module: create },
};

const freshState = () => ({
  hero: { ...NEW_HERO },
  run: { ...DEMO_RUN, realNames: true },
  newcomer: false,
  view: 'ready', // ready | loading | error
  nameUncertain: false,
  nameError: false,
  extraOpen: false,
});

const state = freshState();
const app = document.getElementById('app');
const toastBox = document.getElementById('toast');
const modal = document.getElementById('modal');
let shownRoute = '';
let toastTimer = 0;
let modalReturn = null;

const activeRun = () => (state.newcomer ? null : state.run);

function parseRoute() {
  const [name, arg] = location.hash.replace(/^#/, '').split('/');
  if (name === 'create') {
    const step = Math.min(create.STEPS, Math.max(1, Number.parseInt(arg, 10) || 1));
    return { name, step, id: `create/${step}` };
  }
  const known = Object.hasOwn(SCREENS, name) ? name : 'catalog';
  return { name: known, id: known };
}

// Щоб після перемальовування клавіатурний фокус лишався на тій самій кнопці.
function focusSelector(el) {
  if (!el || !app.contains(el)) return null;
  if (el.id) return `#${CSS.escape(el.id)}`;
  const { choice, value, clubMode, flag } = el.dataset;
  if (choice) return `[data-choice="${CSS.escape(choice)}"][data-value="${CSS.escape(value)}"]`;
  if (clubMode) return `[data-club-mode="${CSS.escape(clubMode)}"]`;
  if (flag) return `[data-flag="${CSS.escape(flag)}"]`;
  return null;
}

function render() {
  const route = parseRoute();
  const screen = SCREENS[route.name];
  const sameRoute = route.id === shownRoute;
  const keepFocus = sameRoute ? focusSelector(document.activeElement) : null;
  const keepScroll = window.scrollY;
  const context = { state, activeRun, step: route.step, go, rerender: render, startCareer };

  document.body.dataset.screen = screen.key;
  app.innerHTML = screen.module.render(context);
  screen.module.bind?.(app, context);

  if (sameRoute) {
    window.scrollTo(0, keepScroll);
    if (keepFocus) app.querySelector(keepFocus)?.focus({ preventScroll: true });
  } else {
    window.scrollTo(0, 0);
    if (shownRoute) app.focus({ preventScroll: true });
    hideToast();
  }
  shownRoute = route.id;
  menu.refresh();
}

function go(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}

function hideToast() {
  window.clearTimeout(toastTimer);
  toastBox.classList.remove('show');
}

// Довший текст висить довше, щоб встигнути прочитати.
function toast(text) {
  hideToast();
  toastBox.textContent = text;
  toastBox.classList.add('show');
  toastTimer = window.setTimeout(hideToast, Math.max(3500, text.length * 70));
}

function startCareer() {
  const h = state.hero;
  state.run = {
    firstName: h.firstName.trim(), lastName: h.lastName.trim(), position: h.position, subposition: h.subposition,
    physicalAccent: h.physicalAccent, character: h.character, club: h.club, difficulty: h.difficulty,
    realNames: h.realNames, age: 17, season: 1, rating: 56, status: 'Резерв', mentality: 'Добре', titles: 0,
    chance: DEMO_RUN.chance,
  };
  state.newcomer = false;
  go('#career');
  // Тост — після переходу, бо перехід ховає попередній.
  window.setTimeout(() => toast('Героя створено. Це приклад: нічого не зберігається, після перезавантаження сторінки все скинеться.'), 60);
}

function openDropDialog(trigger) {
  modalReturn = trigger;
  modal.innerHTML = '<section class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle"><button type="button" class="icon-button modal-close" data-close-modal aria-label="Закрити">×</button><span class="eyebrow danger-text">Незворотна дія</span><h2 id="modalTitle">Точно кинути кар’єру?</h2><p>Активне проходження завершиться без фінальної кінцівки. Вже отримані ачівки лишаться у профілі.</p><div class="modal-actions"><button type="button" class="button danger" data-confirm-drop>Так, кинути</button><button type="button" class="button secondary" data-close-modal>Скасувати</button></div></section>';
  modal.hidden = false;
  app.inert = true;
  modal.querySelector('.modal-actions [data-close-modal]').focus();
}

function closeDialog() {
  if (modal.hidden) return;
  modal.hidden = true;
  modal.innerHTML = '';
  app.inert = false;
  if (modalReturn?.isConnected) modalReturn.focus();
  modalReturn = null;
}

document.addEventListener('click', (event) => {
  if (event.target === modal) { closeDialog(); return; }
  const target = event.target.closest('[data-go],[data-toast],[data-scroll],[data-retry],[data-drop],[data-close-modal],[data-confirm-drop]');
  if (!target) return;
  const data = target.dataset;
  if (data.go !== undefined) go(data.go);
  else if (data.toast !== undefined) toast(data.toast);
  else if (data.scroll !== undefined) {
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById(data.scroll)?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
  } else if (data.retry !== undefined) { state.view = 'ready'; render(); }
  else if (data.drop !== undefined) openDropDialog(target);
  else if (data.closeModal !== undefined) closeDialog();
  else if (data.confirmDrop !== undefined) {
    closeDialog();
    state.run = null;
    state.hero = { ...NEW_HERO };
    render();
    toast('Кар’єру кинуто. Тепер можна почати нову.');
  }
});

document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeDialog(); });
toastBox.addEventListener('click', hideToast);
// Звичайний перехід за «#app» зламав би маршрути, тому лише переносимо фокус.
document.querySelector('.skip-link').addEventListener('click', (event) => { event.preventDefault(); app.focus(); });

const menu = mountTestMenu(document.getElementById('testMenu'), {
  state,
  activeRun,
  go,
  rerender: render,
  steps: create.STEPS,
  reset() { Object.assign(state, freshState()); closeDialog(); go('#catalog'); },
});

window.addEventListener('hashchange', () => { closeDialog(); render(); });
render();
