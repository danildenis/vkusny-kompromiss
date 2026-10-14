// Корзина: хранится в браузере, заказ уходит Елене в Telegram готовым текстом.
import { PRODUCTS, byId, CONTACTS, rub } from './products.js';

const KEY = 'vk-cart-v1';
let items = load();
const subs = new Set();

function load() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } }
function save() { try { localStorage.setItem(KEY, JSON.stringify(items)); } catch {} subs.forEach(f => f(items)); }

export const cart = {
  get items() { return items.filter(i => byId(i.id)); },
  count() { return this.items.reduce((s, i) => s + i.qty, 0); },
  total() { return this.items.reduce((s, i) => s + i.qty * byId(i.id).price, 0); },
  add(id, qty = 1) { const it = items.find(i => i.id === id); if (it) it.qty += qty; else items.push({ id, qty }); save(); },
  set(id, qty) { if (qty <= 0) items = items.filter(i => i.id !== id); else { const it = items.find(i => i.id === id); if (it) it.qty = qty; } save(); },
  clear() { items = []; save(); },
  on(f) { subs.add(f); f(items); },
};

const swatch = p => `radial-gradient(circle at 35% 30%, #fff8 0, transparent 38%), radial-gradient(circle at 50% 55%, ${p.accent}, ${p.tint} 120%)`;

export function mountCart() {
  const el = document.createElement('div');
  el.innerHTML = `
  <div class="drawer-backdrop" data-close></div>
  <aside class="drawer" role="dialog" aria-modal="true" aria-label="Корзина">
    <header class="drawer-head">
      <h2>Корзина</h2>
      <button class="icon-btn" data-close aria-label="Закрыть">
        <svg viewBox="0 0 24 24" width="22" height="22"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
      </button>
    </header>
    <div class="drawer-body">
      <ul class="cart-list"></ul>
      <div class="cart-empty">
        <p class="cart-empty-title">Пока пусто</p>
        <p>Загляните в каталог — десерты раскрываются, если навести на них курсор.</p>
        <a class="btn" href="catalog.html">Открыть каталог <span class="arr">→</span></a>
      </div>
      <form class="order-form" novalidate>
        <h3>Оформление</h3>
        <label>Ваше имя<input name="name" autocomplete="name" required></label>
        <label>Телефон или ник в Telegram<input name="contact" autocomplete="tel" required></label>
        <label>Когда нужен заказ<input name="date" type="date"></label>
        <label>Комментарий<textarea name="comment" rows="2" placeholder="Например: соберите в подарочную коробку"></textarea></label>
      </form>
      <div class="order-done" hidden>
        <p class="cart-empty-title">Заказ почти у Елены</p>
        <p>Мы скопировали текст заказа. Откройте чат в Telegram и вставьте сообщение — Елена ответит и подтвердит детали.</p>
        <pre class="order-text"></pre>
        <div class="order-done-actions">
          <a class="btn" target="_blank" rel="noopener" href="https://t.me/${CONTACTS.primary}">Открыть чат @${CONTACTS.primary}</a>
          <button class="btn ghost" type="button" data-copy>Скопировать ещё раз</button>
        </div>
        <p class="muted small">Второй контакт для заказов: <a target="_blank" rel="noopener" href="https://t.me/${CONTACTS.secondary}">@${CONTACTS.secondary}</a></p>
      </div>
    </div>
    <footer class="drawer-foot">
      <div class="cart-total"><span>Итого</span><strong></strong></div>
      <button class="btn wide" data-checkout>Отправить заказ в Telegram</button>
      <p class="muted small">Оплата и детали — после подтверждения в переписке.</p>
    </footer>
  </aside>`;
  el.className = 'cart-root';
  document.body.appendChild(el);

  const list = el.querySelector('.cart-list'), empty = el.querySelector('.cart-empty'), form = el.querySelector('.order-form');
  const foot = el.querySelector('.drawer-foot'), done = el.querySelector('.order-done'), totalEl = el.querySelector('.cart-total strong');
  let lastText = '';

  function render() {
    const its = cart.items;
    list.innerHTML = its.map(i => {
      const p = byId(i.id);
      return `<li class="cart-item" data-id="${p.id}">
        <span class="cart-swatch"><img src="${p.thumb}" alt=""></span>
        <div class="cart-item-info"><b>${p.name}</b><span>${rub(p.price)} за десерт</span></div>
        <div class="stepper"><button type="button" data-dec aria-label="Меньше">−</button><span>${i.qty}</span><button type="button" data-inc aria-label="Больше">+</button></div>
        <b class="cart-item-sum">${rub(p.price * i.qty)}</b>
      </li>`;
    }).join('');
    const has = its.length > 0;
    empty.hidden = has || !done.hidden; form.hidden = !has || !done.hidden; foot.hidden = !has || !done.hidden; list.hidden = !done.hidden;
    totalEl.textContent = rub(cart.total());
    document.querySelectorAll('[data-cart-count]').forEach(b => { b.textContent = cart.count(); b.parentElement.classList.toggle('has-items', has); });
  }
  cart.on(render);

  list.addEventListener('click', e => {
    const li = e.target.closest('.cart-item'); if (!li) return;
    const it = cart.items.find(i => i.id === li.dataset.id);
    if (e.target.closest('[data-inc]')) cart.set(it.id, it.qty + 1);
    if (e.target.closest('[data-dec]')) cart.set(it.id, it.qty - 1);
  });

  const open = () => { done.hidden = true; render(); document.documentElement.classList.add('cart-open'); };
  const close = () => document.documentElement.classList.remove('cart-open');
  el.addEventListener('click', e => { if (e.target.closest('[data-close]')) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  document.querySelectorAll('[data-open-cart]').forEach(b => b.addEventListener('click', open));

  const copy = async t => { try { await navigator.clipboard.writeText(t); return true; } catch { return false; } };
  el.querySelector('[data-copy]').addEventListener('click', () => copy(lastText));
  el.querySelector('[data-checkout]').addEventListener('click', async () => {
    const f = new FormData(form);
    const bad = ['name', 'contact'].filter(k => !String(f.get(k) || '').trim());
    form.querySelectorAll('input').forEach(i => i.classList.toggle('invalid', bad.includes(i.name)));
    if (bad.length) { form.querySelector('.invalid')?.focus(); return; }
    const lines = cart.items.map(i => { const p = byId(i.id); return `— ${p.name} × ${i.qty} = ${rub(p.price * i.qty)}`; });
    const date = f.get('date') ? new Date(f.get('date')).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) : 'обсудим';
    lastText = ['Здравствуйте! Хочу заказать корпусные десерты:', ...lines, `Итого: ${rub(cart.total())}`, '',
      `Имя: ${f.get('name')}`, `Контакт: ${f.get('contact')}`, `Дата: ${date}`, f.get('comment') ? `Комментарий: ${f.get('comment')}` : ''].filter(Boolean).join('\n');
    el.querySelector('.order-text').textContent = lastText;
    await copy(lastText);
    done.hidden = false; render();
    window.open(`https://t.me/${CONTACTS.primary}`, '_blank', 'noopener');
  });

  return { open, close };
}

// летящая точка от кнопки к корзине
export function flyToCart(fromEl, product) {
  const target = document.querySelector('.cart-btn'); if (!target) return;
  const a = fromEl.getBoundingClientRect(), b = target.getBoundingClientRect();
  const dot = document.createElement('span');
  dot.className = 'fly-dot'; dot.innerHTML = `<img src="${product.thumb}" alt="">`;
  dot.style.left = a.left + a.width / 2 - 20 + 'px'; dot.style.top = a.top + a.height / 2 - 20 + 'px';
  document.body.appendChild(dot);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
  dot.animate([
    { transform: 'translate(0,0) scale(1)' },
    { transform: `translate(${dx * .5}px, ${dy * .5 - 80}px) scale(1.15)`, offset: .5 },
    { transform: `translate(${dx}px, ${dy}px) scale(.35)`, opacity: .6 },
  ], { duration: 750, easing: 'cubic-bezier(.5,0,.3,1)' }).onfinish = () => {
    dot.remove(); target.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.18)' }, { transform: 'scale(1)' }], { duration: 320 });
  };
}

export { PRODUCTS };
