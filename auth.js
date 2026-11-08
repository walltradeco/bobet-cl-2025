// Вхід за кодом з пошти — той самий шлях, що в BoBet/PSL/Squad: signInWithOtp → verifyOtp (перебір типів) → bind_me.
// Модуль не знає про конкретну сторінку: рендерить форму в переданий елемент і викликає onDone() після входу.
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export async function getSession(sb) {
  const { data } = await sb.auth.getSession();
  return (data && data.session) || null;
}

export async function bindMe(sb) {
  try { await sb.rpc('bind_me'); } catch (e) { /* самолікування: ковтаємо, як на інших сторінках */ }
}

export function renderLogin(host, sb, { title = 'Вхід', lead = '', onDone }) {
  host.innerHTML = `
    <div class="login">
      <h1>${esc(title)}</h1>
      ${lead ? `<p class="dim">${esc(lead)}</p>` : ''}
      <div id="lg-email">
        <label class="lbl" for="in-email">Пошта</label>
        <input id="in-email" type="email" inputmode="email" autocomplete="email" placeholder="you@example.com">
        <button id="btn-send" class="btn primary" type="button">Надіслати код</button>
      </div>
      <div id="lg-code" class="hide">
        <label class="lbl" for="in-code">Код з листа</label>
        <input id="in-code" type="text" inputmode="numeric" autocomplete="one-time-code" placeholder="123456">
        <button id="btn-verify" class="btn primary" type="button">Увійти</button>
        <button id="btn-back" class="btn ghost" type="button">Змінити пошту</button>
      </div>
      <div id="lg-msg" class="lg-msg" role="status"></div>
    </div>`;
  const $ = (id) => host.querySelector('#' + id);
  const msg = (t) => { $('lg-msg').textContent = t || ''; };
  let email = '';
  $('btn-send').onclick = async () => {
    email = $('in-email').value.trim().toLowerCase();
    if (!email) return msg('Вкажи пошту');
    $('btn-send').disabled = true; $('btn-send').textContent = 'надсилаю…';
    const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    $('btn-send').disabled = false; $('btn-send').textContent = 'Надіслати код';
    if (error) return msg(/не.*доступ|not allowed|Database error/i.test(error.message) ? 'Немає доступу — цієї пошти немає в списку учасників' : error.message);
    msg(''); $('lg-email').classList.add('hide'); $('lg-code').classList.remove('hide'); $('in-code').focus();
  };
  $('btn-verify').onclick = async () => {
    const token = $('in-code').value.trim();
    if (token.length < 4) return msg('Код закороткий');
    $('btn-verify').disabled = true;
    let error = null;
    for (const type of ['email', 'signup', 'magiclink']) {
      const res = await sb.auth.verifyOtp({ email, token, type });
      if (!res.error) { error = null; break; } error = res.error;
    }
    $('btn-verify').disabled = false;
    if (error) return msg('Не вийшло: ' + (error.message || ''));
    await bindMe(sb);
    onDone();
  };
  $('btn-back').onclick = () => { $('lg-code').classList.add('hide'); $('lg-email').classList.remove('hide'); msg(''); };
  $('in-email').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btn-send').click(); });
  $('in-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btn-verify').click(); });
}
