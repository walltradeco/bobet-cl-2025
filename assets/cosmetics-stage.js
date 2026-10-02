/* BoOrbit · кастомізація шапок Профілю й Спільнот (STAGE) — assets/cosmetics-stage.js
 *
 * Спільний модуль для profile-stage.html і community-stage.html (рішення Богдана 01.10.2026).
 * Дані: SQL 492 (profile_cosmetics / community_cosmetics + set_*_cosmetics). Колір — наявні
 * profiles.avatar_color / communities.accent_color. Стилі — assets/cosmetics-stage.css.
 *
 * ПРАВИЛА:
 *  • У БД лише стабільні ID зі whitelist (дзеркало SQL _cosmetic_id_ok). Невідомий ID → дефолт (нічого не ламаємо).
 *  • Чемпіонські шари (supreme/victory_radiance/dynasty/champion_hall) тут НЕ кодуються як вибір — їх виводить
 *    сторінка з серверних даних (profile_overview.title_count/is_champion/show_champion). Фаза 3.
 *  • ФАЗА 3: преміум-скіни шапки (titanium_wing, signature_rift — ЗАМІНЮЮТЬ рамку й ефект ШАПКИ; рамка/ефект і далі керують
 *    фоном сторінки через Full Sync) + серверні чемпіонські шари: applyChamp() (supreme+victory_radiance / dynasty на шапці)
 *    і applyChampEnv() (champion_hall на сторінці). Чемпіонські шари НЕ вибираються, НЕ зберігаються й НЕ входять у
 *    whitelist (sanitize їх відкине) — сторінка виводить їх із profile_overview.title_count/is_champion/show_champion.
 *  • 493 (02.10): чемпіон обирає КОЖЕН чемпіонський елемент окремо (badge, caption, crown, frame, rays, hall) — cfg.parts,
 *    зберігається в profile_cosmetics.champ_parts. Вимкнений елемент → власний стиль у власному кольорі; увімкнені
 *    «золоті» елементи можуть поєднуватись з власною формою рамки/скіном, ефектом і темою у золотому виконанні.
 *  • ФАЗА 2: тема сторінки (studio_frame/collector_vault + преміум aegis_citadel/prism_forge/stadium_cathedral) і
 *    Full Sync — applyEnv() обчислює фон сторінки з кольору + рамки + ефекту + теми; НІЧОГО окремо не зберігається.
 *  • Відсутня таблиця (SQL ще не залитий) або мережева помилка → дефолтний вигляд, без помилок для людини.
 *  • Колір НЕ змінюємо в БД: для відмальовки підтягуємо яскравість, щоб рамки/світіння читались на темному фоні.
 */
(function(global){
  'use strict';

  // ── каталог (дзеркало SQL _cosmetic_id_ok; Фази 2-3 додають skin/theme групи в редактор) ──
  const FRAMES=[
    ['default','Стандартна','Без рамки'],
    ['fortress','Fortress','Товста матова броня'],
    ['split_rail','Split Rail','Асиметричні рейки'],
    ['obsidian_cut','Obsidian Cut','Гранована форма'],
    ['pulse_core','Pulse Core','Енергетичне ядро']
  ];
  const EFFECTS=[
    ['none','Без ефекту','Чистий фон'],
    ['aurora_mist','Aurora Mist','М’які кольорові хмари'],
    ['topography','Topography','Контурна карта'],
    ['particle_drift','Particle Drift','Світлові частинки'],
    ['crystal_shards','Crystal Shards','Кристалічні грані']
  ];
  // Преміум-скіни шапки (фаза 3). У редакторі це ВАРІАНТИ групи «Рамка» (скін замінює рамку; ефект сумісний зі скіном). У БД — skin_id.
  const SKINS=[
    ['default','Без скіна','Рамка й ефект на вибір'],
    ['titanium_wing','Titanium Wing','Преміум · механічні крила'],
    ['signature_rift','Signature Rift','Преміум · світловий розлом і підпис']
  ];
  const PREMIUM=['aegis_citadel','prism_forge','stadium_cathedral'];   // преміум-середовища сторінки
  // Теми сторінки (фаза 2). collector_vault — базова, решта — преміум-середовища (відкриті всім, рішення 01.10).
  // ⚠️ 02.10 (рішення Богдана): з UI прибрано glass_tunnel, velocity, scan_pulse, studio_frame (дублі/мало виразні). SQL-whitelist
  // навмисно ЛИШИВСЯ ширшим (не перезаливаємо 492): прибраний ID у старому рядку БД → sanitize() → дефолт.
  const THEMES=[
    ['default','Стандартна','Без оформлення сторінки'],
    ['collector_vault','Collector Vault','Колекційна вітрина'],
    ['aegis_citadel','Aegis Citadel','Преміум · броня навколо сторінки'],
    ['prism_forge','Prism Forge','Преміум · заломлені площини'],
    ['stadium_cathedral','Stadium Cathedral','Преміум · арка й тунель поля']
  ];
  const ok=(list,id)=>list.some(x=>(Array.isArray(x)?x[0]:x)===id);

  // Чемпіонські елементи на вибір (493). Дзеркало SQL _champ_parts_all(); PARTS_ALL — алфавітно (як дефолт і результат RPC).
  const CHAMP_PARTS=[
    ['badge','Бейдж','Мітка BOBET CHAMPION біля імені'],
    ['caption','Підпис','«Переможець N турнірів · …» у шапці'],
    ['crown','Корона','Корона біля аватара'],
    ['frame','Золота рамка','Золото на рамці шапки'],
    ['rays','Золоті промені','Промені з аватара'],
    ['hall','Зал чемпіона','Золоте середовище сторінки']
  ];
  const PARTS_ALL=['badge','caption','crown','frame','hall','rays'];
  const CHAMP_GOLD='#d9b45b';   // статусне золото (не палітра гравця)

  const none=()=>({frame:'default',effect:'none',skin:'default',theme:'default',parts:PARTS_ALL.slice()});
  function sanitize(c){
    c=c||{}; const d=none();
    return {
      frame: ok(FRAMES,c.frame)?c.frame:d.frame,
      effect:ok(EFFECTS,c.effect)?c.effect:d.effect,
      skin:  ok(SKINS,c.skin)?c.skin:d.skin,
      theme: ok(THEMES,c.theme)?c.theme:d.theme,
      // масив → лише відомі елементи, без дублів, алфавітно; немає масиву (старий рядок/нема колонки) → усі
      parts: Array.isArray(c.parts)?PARTS_ALL.filter(x=>c.parts.indexOf(x)>=0):PARTS_ALL.slice()
    };
  }
  const same=(a,b)=>a.frame===b.frame&&a.effect===b.effect&&a.skin===b.skin&&a.theme===b.theme&&a.parts.join()===b.parts.join();

  // ── колір: нормалізація під темний фон ──
  const FALLBACK='#7e9dbb';
  const lin=c=>{c/=255;return c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4)};
  const lum=([r,g,b])=>.2126*lin(r)+.7152*lin(g)+.0722*lin(b);
  const toRgb=h=>{const m=/^#([0-9a-fA-F]{6})$/.exec(h||'');if(!m)return null;const n=parseInt(m[1],16);return [(n>>16)&255,(n>>8)&255,n&255]};
  const toHex=([r,g,b])=>'#'+[r,g,b].map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');
  function rgb2hsl([r,g,b]){
    r/=255;g/=255;b/=255; const mx=Math.max(r,g,b),mn=Math.min(r,g,b); let h=0,s=0; const l=(mx+mn)/2;
    if(mx!==mn){ const d=mx-mn; s=l>.5?d/(2-mx-mn):d/(mx+mn);
      h=mx===r?(g-b)/d+(g<b?6:0):mx===g?(b-r)/d+2:(r-g)/d+4; h/=6; }
    return [h,s,l];
  }
  function hsl2rgb([h,s,l]){
    if(s===0){const v=l*255;return [v,v,v]}
    const q=l<.5?l*(1+s):l+s-l*s,p=2*l-q;
    const f=t=>{if(t<0)t+=1;if(t>1)t-=1;if(t<1/6)return p+(q-p)*6*t;if(t<1/2)return q;if(t<2/3)return p+(q-p)*(2/3-t)*6;return p};
    return [f(h+1/3)*255,f(h)*255,f(h-1/3)*255];
  }
  // мінімальна яскравість акценту: ≥3:1 до панелі #15191e (WCAG для не-тексту) → lum ≥ ~0.14.
  // Стеля світлоти .82: «білий» не дає сліпучих заливок. Відтінок і насиченість зберігаємо.
  const MIN_LUM=.14, MAX_L=.82;
  function accent(hex){
    const base=toRgb(hex)||toRgb(FALLBACK); let [h,s,l]=rgb2hsl(base);
    let cur=base, changed=false;
    if(l>MAX_L){ l=MAX_L; cur=hsl2rgb([h,s,l]); changed=true; }
    let guard=0;
    while(lum(cur)<MIN_LUM && guard++<60){ l=Math.min(MAX_L,l+.02); cur=hsl2rgb([h,s,l]); changed=true; if(l>=MAX_L) break; }
    const out=toHex(cur), r=toRgb(out);
    // колір тексту/іконок НА суцільній заливці акценту — той, що дає більший контраст (WCAG)
    const L=lum(r), cDark=(L+.05)/(lum([16,19,26])+.05), cLight=(lum([244,241,232])+.05)/(L+.05);
    return { hex:out, rgb:r.join(','), changed:changed, on: cDark>=cLight?'#10131a':'#f4f1e8' };
  }

  // ── застосування до шапки ──
  // host — елемент шапки (.hero / .chead); opts.avatar — селектор аватара всередині; opts.identity — селектор блоку імені
  // (для скіна signature_rift: підписна панель); opts.accent — #rrggbb
  function apply(host,cfg,opts){
    if(!host) return;
    opts=opts||{}; cfg=sanitize(cfg);
    host.querySelectorAll(':scope > .bc-fx-layer').forEach(n=>n.remove());
    const av=opts.avatar?host.querySelector(opts.avatar):null;
    const idn=opts.identity?host.querySelector(opts.identity):null;
    const skin=cfg.skin!=='default';
    if(idn) idn.classList.toggle('bc-id',skin);
    if(cfg.frame==='default'&&cfg.effect==='none'&&!skin){
      host.classList.remove('bc-head'); host.removeAttribute('data-bc-frame'); host.removeAttribute('data-bc-fx'); host.removeAttribute('data-bc-skin');
      host.style.removeProperty('--bc-a'); host.style.removeProperty('--bc-a-rgb');
      if(av) av.classList.remove('bc-av');
      return;
    }
    const a=accent(opts.accent);
    host.classList.add('bc-head'); if(av) av.classList.add('bc-av');
    // скін = варіант «Рамки»: CSS рамок інертний (frame=default), малює [data-bc-skin] (::before/::after хоста); ефект ЗАЛИШАЄТЬСЯ
    host.setAttribute('data-bc-frame',skin?'default':cfg.frame); host.setAttribute('data-bc-fx',cfg.effect);
    if(skin) host.setAttribute('data-bc-skin',cfg.skin); else host.removeAttribute('data-bc-skin');
    host.style.setProperty('--bc-a',a.hex); host.style.setProperty('--bc-a-rgb',a.rgb);
    if(opts.size) host.style.setProperty('--bc-av',opts.size+'px');
    if(opts.pad)  host.style.setProperty('--bc-pad',opts.pad+'px');
    if(cfg.effect!=='none'){
      ['c','b','a'].forEach(k=>{ const s=document.createElement('span'); s.className='bc-fx-layer '+k; s.setAttribute('aria-hidden','true'); host.insertBefore(s,host.firstChild); });
    }
  }

  // ── ФАЗА 3: серверні чемпіонські шари ШАПКИ (лише Профіль; Спільнотам не потрібні) ──
  // tier: 'supreme' (перший титул + victory_radiance) | 'dynasty' (2+ титули) | null (зняти). НЕ вибирається гравцем і НЕ
  // зберігається — сторінка передає tier, виведений із серверних даних. host — .hero; opts.size/pad — геометрія аватара.
  const champTier=n=>(n>=2?'dynasty':'supreme');
  // opts: size/pad — геометрія аватара; rays (за замовч. true) — шари променів/відблиску; gold (за замовч. true) — золота рамка шапки
  // (rule `data-bc-gold`: розмір/потрійне кільце dynasty лише з золотою рамкою).
  function applyChamp(host,tier,opts){
    if(!host) return;
    opts=opts||{};
    host.querySelectorAll(':scope > .bc-champ-layer').forEach(n=>n.remove());
    if(tier!=='supreme'&&tier!=='dynasty'){
      ['data-bc-champ','data-bc-gold'].forEach(a=>host.removeAttribute(a));
      host.style.removeProperty('--bc-pad'); host.style.removeProperty('--bc-av'); return;
    }
    host.setAttribute('data-bc-champ',tier);
    if(opts.gold!==false) host.setAttribute('data-bc-gold','1'); else host.removeAttribute('data-bc-gold');
    const big=(tier==='dynasty'&&opts.gold!==false);
    host.style.setProperty('--bc-av',(opts.size||(big?124:104))+'px'); host.style.setProperty('--bc-pad',(opts.pad||28)+'px');
    if(opts.rays===false) return;
    // dynasty має додатковий шар «d» — повільний золотий відблиск по шапці (видима відмінність від supreme)
    (tier==='dynasty'?['d','c','b','a']:['c','b','a']).forEach(k=>{ const s=document.createElement('span'); s.className='bc-champ-layer '+k; s.setAttribute('aria-hidden','true'); host.insertBefore(s,host.firstChild); });
  }

  // ── ФАЗА 2: оточення сторінки (тема + Full Sync) ──
  // host — контейнер шапки+вкладок+вмісту (профіль #screen-profile, спільнота #cenv); opts.content — селектор області
  // вмісту під вкладками (для studio_frame); opts.accent — #rrggbb. Усе обчислюється з cfg (колір+рамка+ефект+тема);
  // окремого поля для Full Sync НЕМАЄ (рішення Богдана). Усе вимкнено (рамка/ефект/тема дефолтні) → сторінка не змінюється.
  function mountEnv(host,theme,frame,fx,a,content,out){
    host.classList.add('bc-env');
    host.setAttribute('data-bc-theme',theme); host.setAttribute('data-bc-pframe',frame); host.setAttribute('data-bc-pfx',fx);
    // у преміум-середовищі Frame Echo вимкнено (воно має власну геометрію) — CSS стежить за цим атрибутом
    if(PREMIUM.indexOf(theme)>=0||theme==='champion_hall') host.setAttribute('data-bc-prem','1'); else host.removeAttribute('data-bc-prem');
    host.style.setProperty('--bc-a',a.hex); host.style.setProperty('--bc-a-rgb',a.rgb);
    if(out!=null) host.style.setProperty('--bc-out',out+'px');
    if(content) content.classList.add('bc-content');
    ['c','b','a'].forEach(k=>{ const s=document.createElement('span'); s.className='bc-env-layer '+k; s.setAttribute('aria-hidden','true'); host.insertBefore(s,host.firstChild); });
  }
  function clearEnv(host,content){
    host.querySelectorAll(':scope > .bc-env-layer').forEach(n=>n.remove());
    host.classList.remove('bc-env');
    ['data-bc-theme','data-bc-pframe','data-bc-pfx','data-bc-prem'].forEach(a=>host.removeAttribute(a));
    host.style.removeProperty('--bc-a'); host.style.removeProperty('--bc-a-rgb');
    if(content) content.classList.remove('bc-content');
  }
  function applyEnv(host,cfg,opts){
    if(!host) return;
    opts=opts||{}; cfg=sanitize(cfg);
    const content=opts.content?host.querySelector(opts.content):null;
    clearEnv(host,content);
    if(cfg.frame==='default'&&cfg.effect==='none'&&cfg.theme==='default') return;
    mountEnv(host,cfg.theme,cfg.frame,cfg.effect,accent(opts.accent),content,opts.out);
  }
  // ФАЗА 3: champion_hall — середовище сторінки лише для чемпіонів (серверний статус, золото = статусний колір, не палітра гравця)
  function applyChampEnv(host,opts){
    if(!host) return;
    opts=opts||{};
    const content=opts.content?host.querySelector(opts.content):null;
    clearEnv(host,content);
    // ефект чемпіона (за вибором) лягає на золотий зал як Effect Spill у золотому кольорі
    mountEnv(host,'champion_hall','default',ok(EFFECTS,opts.effect)?opts.effect:'none',accent(CHAMP_GOLD),content,opts.out);
  }

  // ── дані ──
  const T={ profile:['profile_cosmetics','profile_id'], community:['community_cosmetics','community_id'] };
  async function load(sb,kind,id){
    const t=T[kind]; if(!t||!id) return none();
    try{
      const base='frame_id,effect_id,skin_id,page_theme_id';
      let r=await sb.from(t[0]).select(kind==='profile'?base+',champ_parts':base).eq(t[1],id).maybeSingle();
      // SQL 493 (колонка champ_parts) може бути залитий пізніше за сайт → перечитуємо без неї, елементи = усі
      if(r.error && kind==='profile') r=await sb.from(t[0]).select(base).eq(t[1],id).maybeSingle();
      if(r.error||!r.data) return none();
      return sanitize({frame:r.data.frame_id,effect:r.data.effect_id,skin:r.data.skin_id,theme:r.data.page_theme_id,parts:r.data.champ_parts});
    }catch(e){ return none(); }
  }
  async function save(sb,kind,id,cfg){
    cfg=sanitize(cfg);
    const a={p_frame:cfg.frame,p_effect:cfg.effect,p_skin:cfg.skin,p_theme:cfg.theme};
    try{
      if(kind==='community') return await sb.rpc('set_community_cosmetics',Object.assign({p_community:id},a));
      let r=await sb.rpc('set_profile_cosmetics',Object.assign({p_champ_parts:cfg.parts},a));
      // SQL 493 ще не залитий (сайт випередив): функції з таким підписом нема → зберігаємо оформлення без чемпіонських елементів
      if(r&&r.error&&/PGRST202|Could not find the function/i.test((r.error.code||'')+' '+(r.error.message||''))) r=await sb.rpc('set_profile_cosmetics',a);
      return r;
    }catch(e){ return {error:{message:(e&&e.message)||'Не вдалось зберегти оформлення'}}; }
  }

  // ── редактор «Оформлення шапки» ──
  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  // items: [kind,id,name,sub,pressed]
  const groupItems=(title,items)=>`<div class="bc-ed-h">${title}</div><div class="bc-opts" role="group" aria-label="${title}">`+
    items.map(([kind,id,name,sub,on])=>`<button type="button" class="bc-opt" data-bc-kind="${kind}" data-bc-id="${id}" aria-pressed="${!!on}"><b>${esc(name)}</b><small>${esc(sub)}</small></button>`).join('')+`</div>`;
  const group=(title,kind,list,cur)=>groupItems(title,list.map(([id,name,sub])=>[kind,id,name,sub,cur===id]));
  // «Рамка» = класичні рамки + преміум-скіни (одна група, один вибір): обрав скін → рамка скидається, і навпаки
  const frameItems=(c,F)=>F.map(([id,name,sub])=>['frame',id,name,sub,c.skin==='default'&&c.frame===id])
    .concat(SKINS.filter(x=>x[0]!=='default').map(([id,name,sub])=>['skin',id,name,sub,c.skin===id]));
  const isOn=(c,kind,id)=>kind==='frame'?(c.skin==='default'&&c.frame===id)
    :kind==='part'?c.parts.indexOf(id)>=0
    :kind==='preset'?(id==='badge'?(c.parts.length===1&&c.parts[0]==='badge'):c.parts.join()===PARTS_ALL.join())
    :c[kind]===id;
  // чемпіон: список елементів + пресети («Нічого» = головний перемикач «Відзнаки чемпіона» на сторінці)
  const partsBlock=c=>`<div class="bc-ed-h">Чемпіонські елементи</div>
      <div class="bc-opts bc-presets" role="group" aria-label="Пресети">
        <button type="button" class="bc-opt" data-bc-kind="preset" data-bc-id="all" aria-pressed="${isOn(c,'preset','all')}"><b>Усе</b><small>Повний чемпіонський набір</small></button>
        <button type="button" class="bc-opt" data-bc-kind="preset" data-bc-id="badge" aria-pressed="${isOn(c,'preset','badge')}"><b>Лише бейдж</b><small>Решта — твій стиль</small></button>
      </div>
      <div class="bc-opts" role="group" aria-label="Чемпіонські елементи">`+
      CHAMP_PARTS.map(([id,name,sub])=>`<button type="button" class="bc-opt" data-bc-kind="part" data-bc-id="${id}" aria-pressed="${isOn(c,'part',id)}"><b>${esc(name)}</b><small>${esc(sub)}</small></button>`).join('')+`</div>
      <div class="bc-note">Вимкнений елемент замінюється твоїм стилем у твоєму кольорі. Увімкнену золоту рамку, ефект і тему можна поєднувати з власною формою. Усе чемпіонське разом вимикає перемикач «Відзнаки чемпіона» нижче.</div>`;

  // o: { cfg, name, sub, initials, note } → HTML. Живе превʼю = та сама CSS-система, що й справжня шапка.
  function editorHtml(o){
    const c=sanitize(o.cfg);
    // o.champ: чемпіон (відзнаки ввімкнені) — вибір працює у ЗОЛОТОМУ виконанні; дефолти = чемпіонська рамка й «Зал чемпіона»
    const F=o.champ?[['default','Чемпіонська','Золота рамка за титулами']].concat(FRAMES.slice(1)):FRAMES;
    const T=o.champ?[['default','Зал чемпіона','Золотий зал сторінки']].concat(THEMES.slice(1)):THEMES;
    return `<div class="bc-ed" id="bc-ed">
      <div class="bc-ed-h">Оформлення шапки</div>
      <div class="bc-prev" id="bc-prev"><span class="bc-pav" id="bc-prev-av">${esc(o.initials||'?')}</span>
        <div class="bc-pt"><b>${esc(o.name||'')}</b><span>${esc(o.sub||'Так виглядатиме шапка')}</span></div></div>
      <div class="bc-note" id="bc-adj" hidden>Колір трохи підсвітлено для читабельності на темному фоні — збережений колір не змінюється.</div>
      ${o.note?`<div class="bc-note">${esc(o.note)}</div>`:''}
      ${o.champ?partsBlock(c):''}
      ${groupItems('Рамка',frameItems(c,F))}
      ${group('Внутрішній ефект','effect',EFFECTS,c.effect)}
      ${group('Тема сторінки','theme',T,c.theme)}
      <div class="bc-tprev" id="bc-tprev" aria-hidden="true">
        <div class="bc-tp-hero"><span class="bc-tp-av"></span><span class="bc-tp-l"><i></i><i></i></span></div>
        <div class="bc-tp-tabs"><u></u><u></u><u></u><u></u></div>
        <div class="bc-tp-grid"><span class="bc-tp-c"></span><span class="bc-tp-c"></span><span class="bc-tp-c"></span></div>
      </div>
      <div class="bc-note">Колір, рамка й ефект шапки автоматично віддзеркалюються у фоні сторінки (Full Sync).</div>
    </div>`;
  }

  // o: { cfg, getAccent:()=>'#rrggbb', colorInput?:HTMLInputElement, size, pad, champ?:bool, masterOn?:()=>bool } → { get() }
  function wireEditor(root,o){
    const st={cfg:sanitize(o.cfg)};
    const prev=root.querySelector('#bc-prev'), adj=root.querySelector('#bc-adj'), tprev=root.querySelector('#bc-tprev');
    const master=()=>typeof o.masterOn==='function'?!!o.masterOn():true;
    const has=k=>st.cfg.parts.indexOf(k)>=0;
    const paint=()=>{
      // чемпіон із золотою рамкою (і ввімкненими відзнаками) бачить превʼю у ЗОЛОТІ; інакше — у власному кольорі
      const hdrCol=(o.champ&&master()&&has('frame'))?CHAMP_GOLD:o.getAccent();
      const hallOn=!!(o.champ&&master()&&has('hall'));
      const a=accent(hdrCol);
      apply(prev,st.cfg,{avatar:'.bc-pav',identity:'.bc-pt',accent:hdrCol,size:o.size||64,pad:o.pad||22});
      if(tprev){
        apply(tprev.querySelector('.bc-tp-hero'),st.cfg,{avatar:'.bc-tp-av',identity:'.bc-tp-l',accent:hdrCol,size:34,pad:14});
        if(hallOn&&st.cfg.theme==='default') applyChampEnv(tprev,{content:'.bc-tp-grid',effect:st.cfg.effect,out:8});
        else applyEnv(tprev,st.cfg,{accent:hallOn?CHAMP_GOLD:o.getAccent(),content:'.bc-tp-grid',out:8});
      }
      // превʼю завжди показує ВИБРАНЕ (навіть дефолт): акцент для UI-стану кнопок
      root.style.setProperty('--bc-ui',a.hex);
      if(adj) adj.hidden=!accent(o.getAccent()).changed;
      root.querySelectorAll('.bc-opt').forEach(b=>b.setAttribute('aria-pressed',String(isOn(st.cfg,b.dataset.bcKind,b.dataset.bcId))));
      if(o.champ){   // підписи дефолтних кнопок залежать від того, чи ввімкнено золоту рамку / зал
        const fb=root.querySelector('.bc-opt[data-bc-kind="frame"][data-bc-id="default"]');
        if(fb) fb.innerHTML=has('frame')?'<b>Чемпіонська</b><small>Золота рамка за титулами</small>':'<b>Стандартна</b><small>Без рамки</small>';
        const tb=root.querySelector('.bc-opt[data-bc-kind="theme"][data-bc-id="default"]');
        if(tb) tb.innerHTML=has('hall')?'<b>Зал чемпіона</b><small>Золотий зал сторінки</small>':'<b>Стандартна</b><small>Без оформлення сторінки</small>';
      }
    };
    root.querySelectorAll('.bc-opt').forEach(b=>b.addEventListener('click',()=>{
      const k=b.dataset.bcKind, id=b.dataset.bcId, nx=Object.assign({},st.cfg);
      if(k==='skin'){ nx.skin=id; nx.frame='default'; }           // скін = варіант «Рамки»: заміщує рамку
      else if(k==='frame'){ nx.frame=id; nx.skin='default'; }     // класична рамка (або «Стандартна») знімає скін
      else if(k==='part'){ const set=new Set(nx.parts); if(set.has(id)) set.delete(id); else set.add(id); nx.parts=Array.from(set); }
      else if(k==='preset'){ nx.parts=(id==='badge')?['badge']:PARTS_ALL.slice(); }
      else nx[k]=id;
      st.cfg=sanitize(nx); paint();
    }));
    if(o.colorInput) o.colorInput.addEventListener('input',paint);
    paint();
    return { get:()=>sanitize(st.cfg) };
  }

  global.BoCosmetics={ FRAMES,EFFECTS,SKINS,THEMES,CHAMP_PARTS,PARTS_ALL,CHAMP_GOLD,none,sanitize,same,accent,apply,applyChamp,champTier,applyEnv,applyChampEnv,load,save,editorHtml,wireEditor };
})(window);
