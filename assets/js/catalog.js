import { initPage, cardHTML, bindCard } from './ui.js';
import { PRODUCTS, FILTERS } from './products.js';

const { stage, modal, watch } = initPage();

const grid = document.querySelector('.catalog-grid');
const chips = document.querySelector('.chips');
grid.innerHTML = PRODUCTS.map((p, i) => cardHTML(p, i)).join('');
grid.querySelectorAll('.card').forEach(c => bindCard(c, stage, modal));
watch();

chips.innerHTML = FILTERS.map((f, i) => `<button class="chip${i ? '' : ' on'}" data-f="${f.id}">${f.label}<span class="c">${f.id === 'all' ? PRODUCTS.length : PRODUCTS.filter(p => p.tags.includes(f.id)).length}</span></button>`).join('');
chips.addEventListener('click', e => {
  const b = e.target.closest('.chip'); if (!b) return;
  chips.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c === b));
  const f = b.dataset.f;
  grid.querySelectorAll('.card').forEach(c => {
    const p = PRODUCTS.find(x => x.id === c.dataset.id);
    c.hidden = !(f === 'all' || p.tags.includes(f));
    c.classList.add('in');
  });
});

const hash = location.hash.slice(1);
if (hash && PRODUCTS.some(p => p.id === hash)) setTimeout(() => modal.open(hash), 300);
