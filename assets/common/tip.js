// ⓘ-поповер: миттєвий (замість title), працює і на дотик. Той самий патерн, що squad-stage.html (tipBtn / #tipPop).
// Використання: tipBtn('текст') повертає HTML кнопки; initTip() один раз вішає делегування подій.
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function tipBtn(text) {
  return `<button type="button" class="tipbtn" data-tip="${esc(text)}" aria-label="Пояснення">i</button>`;
}

let pop = null;
function hide() { if (pop) { pop.remove(); pop = null; } }
function show(btn) {
  hide();
  pop = document.createElement('div');
  pop.id = 'tipPop';
  pop.setAttribute('role', 'tooltip');
  pop.textContent = btn.dataset.tip;
  document.body.appendChild(pop);
  const r = btn.getBoundingClientRect(), pr = pop.getBoundingClientRect();
  let left = r.left + r.width / 2 - pr.width / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - pr.width - 8));
  let top = r.bottom + 8;
  if (top + pr.height > window.innerHeight - 8) top = Math.max(8, r.top - pr.height - 8);
  pop.style.left = left + 'px'; pop.style.top = top + 'px';
}

let inited = false;
export function initTip() {
  if (inited) return; inited = true;
  document.addEventListener('mouseover', (e) => { const b = e.target.closest && e.target.closest('.tipbtn'); if (b) show(b); });
  document.addEventListener('mouseout', (e) => { if (e.target.closest && e.target.closest('.tipbtn')) hide(); });
  document.addEventListener('focusin', (e) => { const b = e.target.closest && e.target.closest('.tipbtn'); if (b) show(b); });
  document.addEventListener('focusout', hide);
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('.tipbtn');
    if (b) { e.preventDefault(); e.stopPropagation(); if (pop && pop.textContent === b.dataset.tip) hide(); else show(b); }
    else hide();
  });
  window.addEventListener('scroll', hide, true);
}
