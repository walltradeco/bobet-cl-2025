// Каталог сценарних світів (№514, №515).
import { esc, fullName } from './kit.js';

const soonWorld = (cls, sign, title) => `<button type="button" class="lwf-world ${cls}" disabled><span>${sign}</span><strong>${title}</strong><b>Скоро</b></button>`;

export function render({ activeRun }) {
  // Рядок останньої історії є лише тоді, коли історія справді є.
  const run = activeRun();
  const last = run ? `<div class="lwf-last"><span>Моя остання історія</span><strong>${esc(fullName(run))} · ${run.club} · сезон ${run.season}</strong><button type="button" data-go="#career">Продовжити</button></div>` : '';
  return `<div id="legacy-worlds-featured"><div class="lwf-shell">
    <header class="lwf-topbar">
      <div class="lwf-brand"><span>BO</span><b>Legacy Mode</b></div>
      <nav aria-label="Режими BoOrbit"><div class="lwf-pill"><a href="test.html"><span>BoBet</span></a><a href="psl/stage.html"><span>PSuper League</span></a></div><button type="button" class="lwf-legacy" aria-current="page">Legacy</button></nav>
      <span class="stage-badge">STAGE</span>
    </header>
    <main class="lwf-main">
      <div class="lwf-heading"><div><small>СЦЕНАРНІ СВІТИ</small><h1>Одна платформа. Різні життя.</h1><p>Футбол залишається головним активним світом, а нові всесвіти поступово відкриваються поруч.</p></div></div>
      <div class="lwf-layout">
        <button type="button" class="lwf-football" data-go="#home" aria-label="Відкрити Football Legacy">
          <div class="lwf-pitch"><i></i><i></i><i></i><span>17</span></div>
          <div class="lwf-copy"><small>ДОСТУПНО ЗАРАЗ</small><h2>Football Legacy</h2><p>Два окремі варіанти кар’єри: гравець і тренер.</p><div><span>Кар’єра гравця</span><span>Кар’єра тренера · скоро</span></div><b>Відкрити</b></div>
        </button>
        <div class="lwf-side">
          ${soonWorld('ninja', '忍', 'Ninja Legacy')}
          ${soonWorld('lwf-hero', '✦', 'Hero Legacy')}
          ${soonWorld('wrestling', 'W', 'Wrestling Legacy')}
        </div>
      </div>
      ${last}
    </main>
  </div></div>`;
}
