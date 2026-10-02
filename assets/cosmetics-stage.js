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
    ['glass_tunnel','Glass Tunnel','Прозора глибина'],
    ['pulse_core','Pulse Core','Енергетичне ядро']
  ];
  const EFFECTS=[
    ['none','Без ефекту','Чистий фон'],
    ['aurora_mist','Aurora Mist','М’які кольорові хмари'],
    ['velocity','Velocity','Швидкі лінії'],
    ['topography','Topography','Контурна карта'],
    ['particle_drift','Particle Drift','Світлові частинки'],
    ['scan_pulse','Scan Pulse','Сітка й сканування'],
    ['crystal_shards','Crystal Shards','Кристалічні грані']
  ];
  const SKINS=['default','titanium_wing','signature_rift'];
  const PREMIUM=['aegis_citadel','prism_forge','stadium_cathedral'];   // преміум-середовища сторінки
  // Теми сторінки (фаза 2). Перші три — базові, останні три — преміум-середовища (відкриті всім, рішення 01.10).
  const THEMES=[
    ['default','Стандартна','Без оформлення сторінки'],
    ['studio_frame','Studio Frame','Спокійний великий контейнер'],
    ['collector_vault','Collector Vault','Колекційна вітрина'],
    ['aegis_citadel','Aegis Citadel','Преміум · броня навколо сторінки'],
    ['prism_forge','Prism Forge','Преміум · заломлені площини'],
    ['stadium_cathedral','Stadium Cathedral','Преміум · арка й тунель поля']
  ];
  const ok=(list,id)=>list.some(x=>(Array.isArray(x)?x[0]:x)===id);

  const none=()=>({frame:'default',effect:'none',skin:'default',theme:'default'});
  function sanitize(c){
    c=c||{}; const d=none();
    return {
      frame: ok(FRAMES,c.frame)?c.frame:d.frame,
      effect:ok(EFFECTS,c.effect)?c.effect:d.effect,
      skin:  ok(SKINS,c.skin)?c.skin:d.skin,
      theme: ok(THEMES,c.theme)?c.theme:d.theme
    };
  }
  const same=(a,b)=>a.frame===b.frame&&a.effect===b.effect&&a.skin===b.skin&&a.theme===b.theme;

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
  // host — елемент шапки (.hero / .chead); opts.avatar — селектор аватара всередині; opts.accent — #rrggbb
  function apply(host,cfg,opts){
    if(!host) return;
    opts=opts||{}; cfg=sanitize(cfg);
    host.querySelectorAll(':scope > .bc-fx-layer').forEach(n=>n.remove());
    const av=opts.avatar?host.querySelector(opts.avatar):null;
    if(cfg.frame==='default'&&cfg.effect==='none'){
      host.classList.remove('bc-head'); host.removeAttribute('data-bc-frame'); host.removeAttribute('data-bc-fx');
      host.style.removeProperty('--bc-a'); host.style.removeProperty('--bc-a-rgb');
      if(av) av.classList.remove('bc-av');
      return;
    }
    const a=accent(opts.accent);
    host.classList.add('bc-head'); if(av) av.classList.add('bc-av');
    host.setAttribute('data-bc-frame',cfg.frame); host.setAttribute('data-bc-fx',cfg.effect);
    host.style.setProperty('--bc-a',a.hex); host.style.setProperty('--bc-a-rgb',a.rgb);
    if(opts.size) host.style.setProperty('--bc-av',opts.size+'px');
    if(opts.pad)  host.style.setProperty('--bc-pad',opts.pad+'px');
    if(cfg.effect!=='none'){
      ['c','b','a'].forEach(k=>{ const s=document.createElement('span'); s.className='bc-fx-layer '+k; s.setAttribute('aria-hidden','true'); host.insertBefore(s,host.firstChild); });
    }
  }

  // ── ФАЗА 2: оточення сторінки (тема + Full Sync) ──
  // host — контейнер шапки+вкладок+вмісту (профіль #screen-profile, спільнота #cenv); opts.content — селектор області
  // вмісту під вкладками (для studio_frame); opts.accent — #rrggbb. Усе обчислюється з cfg (колір+рамка+ефект+тема);
  // окремого поля для Full Sync НЕМАЄ (рішення Богдана). Усе вимкнено (рамка/ефект/тема дефолтні) → сторінка не змінюється.
  function applyEnv(host,cfg,opts){
    if(!host) return;
    opts=opts||{}; cfg=sanitize(cfg);
    host.querySelectorAll(':scope > .bc-env-layer').forEach(n=>n.remove());
    const content=opts.content?host.querySelector(opts.content):null;
    if(cfg.frame==='default'&&cfg.effect==='none'&&cfg.theme==='default'){
      host.classList.remove('bc-env');
      ['data-bc-theme','data-bc-pframe','data-bc-pfx','data-bc-prem'].forEach(a=>host.removeAttribute(a));
      host.style.removeProperty('--bc-a'); host.style.removeProperty('--bc-a-rgb');
      if(content) content.classList.remove('bc-content');
      return;
    }
    const a=accent(opts.accent);
    host.classList.add('bc-env');
    host.setAttribute('data-bc-theme',cfg.theme); host.setAttribute('data-bc-pframe',cfg.frame); host.setAttribute('data-bc-pfx',cfg.effect);
    // у преміум-середовищі Frame Echo вимкнено (воно має власну геометрію) — CSS стежить за цим атрибутом
    if(PREMIUM.indexOf(cfg.theme)>=0) host.setAttribute('data-bc-prem','1'); else host.removeAttribute('data-bc-prem');
    host.style.setProperty('--bc-a',a.hex); host.style.setProperty('--bc-a-rgb',a.rgb);
    if(opts.out!=null) host.style.setProperty('--bc-out',opts.out+'px');
    if(content) content.classList.add('bc-content');
    ['c','b','a'].forEach(k=>{ const s=document.createElement('span'); s.className='bc-env-layer '+k; s.setAttribute('aria-hidden','true'); host.insertBefore(s,host.firstChild); });
  }

  // ── дані ──
  const T={ profile:['profile_cosmetics','profile_id'], community:['community_cosmetics','community_id'] };
  async function load(sb,kind,id){
    const t=T[kind]; if(!t||!id) return none();
    try{
      const r=await sb.from(t[0]).select('frame_id,effect_id,skin_id,page_theme_id').eq(t[1],id).maybeSingle();
      if(r.error||!r.data) return none();
      return sanitize({frame:r.data.frame_id,effect:r.data.effect_id,skin:r.data.skin_id,theme:r.data.page_theme_id});
    }catch(e){ return none(); }
  }
  async function save(sb,kind,id,cfg){
    cfg=sanitize(cfg);
    const a={p_frame:cfg.frame,p_effect:cfg.effect,p_skin:cfg.skin,p_theme:cfg.theme};
    try{
      return kind==='community'
        ? await sb.rpc('set_community_cosmetics',Object.assign({p_community:id},a))
        : await sb.rpc('set_profile_cosmetics',a);
    }catch(e){ return {error:{message:(e&&e.message)||'Не вдалось зберегти оформлення'}}; }
  }

  // ── редактор «Оформлення шапки» ──
  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const group=(title,kind,list,cur)=>`<div class="bc-ed-h">${title}</div><div class="bc-opts" role="group" aria-label="${title}">`+
    list.map(([id,name,sub])=>`<button type="button" class="bc-opt" data-bc-kind="${kind}" data-bc-id="${id}" aria-pressed="${cur===id}"><b>${esc(name)}</b><small>${esc(sub)}</small></button>`).join('')+`</div>`;

  // o: { cfg, name, sub, initials, note } → HTML. Живе превʼю = та сама CSS-система, що й справжня шапка.
  function editorHtml(o){
    const c=sanitize(o.cfg);
    return `<div class="bc-ed" id="bc-ed">
      <div class="bc-ed-h">Оформлення шапки</div>
      <div class="bc-prev" id="bc-prev"><span class="bc-pav" id="bc-prev-av">${esc(o.initials||'?')}</span>
        <div class="bc-pt"><b>${esc(o.name||'')}</b><span>${esc(o.sub||'Так виглядатиме шапка')}</span></div></div>
      <div class="bc-note" id="bc-adj" hidden>Колір трохи підсвітлено для читабельності на темному фоні — збережений колір не змінюється.</div>
      ${o.note?`<div class="bc-note">${esc(o.note)}</div>`:''}
      ${group('Рамка','frame',FRAMES,c.frame)}
      ${group('Внутрішній ефект','effect',EFFECTS,c.effect)}
      ${group('Тема сторінки','theme',THEMES,c.theme)}
      <div class="bc-tprev" id="bc-tprev" aria-hidden="true">
        <div class="bc-tp-hero"><span class="bc-tp-av"></span><span class="bc-tp-l"><i></i><i></i></span></div>
        <div class="bc-tp-tabs"><u></u><u></u><u></u><u></u></div>
        <div class="bc-tp-grid"><span class="bc-tp-c"></span><span class="bc-tp-c"></span><span class="bc-tp-c"></span></div>
      </div>
      <div class="bc-note">Колір, рамка й ефект шапки автоматично віддзеркалюються у фоні сторінки (Full Sync).</div>
    </div>`;
  }

  // o: { cfg, getAccent:()=>'#rrggbb', colorInput?:HTMLInputElement, size, pad } → { get() }
  function wireEditor(root,o){
    const st={cfg:sanitize(o.cfg)};
    const prev=root.querySelector('#bc-prev'), adj=root.querySelector('#bc-adj'), tprev=root.querySelector('#bc-tprev');
    const paint=()=>{
      const a=accent(o.getAccent());
      apply(prev,st.cfg,{avatar:'.bc-pav',accent:o.getAccent(),size:o.size||64,pad:o.pad||22});
      if(tprev){
        apply(tprev.querySelector('.bc-tp-hero'),st.cfg,{avatar:'.bc-tp-av',accent:o.getAccent(),size:34,pad:14});
        applyEnv(tprev,st.cfg,{accent:o.getAccent(),content:'.bc-tp-grid',out:8});
      }
      // превʼю завжди показує ВИБРАНЕ (навіть дефолт): акцент для UI-стану кнопок
      root.style.setProperty('--bc-ui',a.hex);
      if(adj) adj.hidden=!a.changed;
      root.querySelectorAll('.bc-opt').forEach(b=>b.setAttribute('aria-pressed',String(st.cfg[b.dataset.bcKind]===b.dataset.bcId)));
    };
    root.querySelectorAll('.bc-opt').forEach(b=>b.addEventListener('click',()=>{
      st.cfg=sanitize(Object.assign({},st.cfg,{[b.dataset.bcKind]:b.dataset.bcId})); paint();
    }));
    if(o.colorInput) o.colorInput.addEventListener('input',paint);
    paint();
    return { get:()=>sanitize(st.cfg) };
  }

  global.BoCosmetics={ FRAMES,EFFECTS,SKINS,THEMES,none,sanitize,same,accent,apply,applyEnv,load,save,editorHtml,wireEditor };
})(window);
