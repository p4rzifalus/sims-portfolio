// Панели с контентом: работы, ссылки, «о себе». Данные — из data.js.
// Панель не перекрывает всю сцену: можно переключить персонажа, пока она открыта.
import { typo } from './typo.js';

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

// Внешняя ссылка открывается в новой вкладке.
function link(url, className) {
  const a = el('a', className);
  a.href = url;
  if (!url.startsWith('mailto:')) {
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
  }
  return a;
}

export function createPanels(root, { panels: panelTexts, ui: texts, getPortrait }) {
  let current = null;

  const builders = {
    works(ch, body) {
      const grid = el('div', 'works-grid');
      ch.works.forEach((w, i) => {
        const card = w.url ? link(w.url, 'work-card skin-well') : el('div', 'work-card skin-well');
        const thumb = el('div', 'work-thumb');
        if (w.image) {
          const img = el('img');
          img.src = w.image;
          img.alt = w.title;
          thumb.appendChild(img);
        } else {
          thumb.appendChild(el('span', 'work-number', String(i + 1).padStart(2, '0')));
        }
        card.appendChild(thumb);
        card.appendChild(el('div', 'work-title', w.title));
        if (w.description) card.appendChild(el('div', 'work-desc', w.description));
        grid.appendChild(card);
      });
      body.appendChild(grid);
    },
    links(ch, body) {
      const list = el('div', 'links-list');
      for (const l of ch.links) {
        const a = link(l.url, 'link-pill pill');
        a.textContent = l.label;
        list.appendChild(a);
      }
      body.appendChild(list);
    },
    // Общая панель книжного шкафа: ссылки из data.js (panels.shelf.links), не из персонажа.
    shelf(_, body) {
      const list = el('div', 'links-list');
      for (const l of panelTexts.shelf?.links || []) {
        const a = link(l.url, 'link-pill pill link-row');
        a.appendChild(el('span', 'link-label', l.label));
        if (l.note) a.appendChild(el('span', 'link-note', l.note));
        list.appendChild(a);
      }
      body.appendChild(list);
    },
    about(ch, body) {
      const wrap = el('div', 'about');
      const p = el('div', 'about-portrait');
      const img = el('img');
      img.src = getPortrait(ch.id) || '';
      img.alt = '';
      p.appendChild(img);
      wrap.appendChild(p);
      wrap.appendChild(el('p', 'about-text', ch.about));
      body.appendChild(wrap);
    },
  };

  // how — почему закрыли: 'replaced' — панель вытеснила панель другого персонажа
  // (тот продолжает работать без панели); иначе — закрыли крестиком, кнопкой или Esc.
  function closeCurrent(how) {
    if (!current) return;
    const c = current;
    current = null;
    c.node.remove();
    c.resolve(how);
  }

  window.addEventListener('keydown', (e) => {
    // Если открыто радиальное меню, Esc закрывает только его (см. main.js).
    if (e.key === 'Escape' && !document.querySelector('.radial-overlay') && !document.body.classList.contains('closeup')) closeCurrent();
  });

  return {
    // Открыть панель kind ('works' | 'links' | 'about') с данными персонажа ch.
    // Возвращает { closed: Promise, close() }. Новая панель закрывает предыдущую:
    // её closed выполнится со значением 'replaced'.
    open(kind, ch) {
      closeCurrent('replaced');
      const node = el('div', 'panel skin-frame');
      node.style.setProperty('--accent', ch.color);
      const head = el('div', 'panel-head');
      const title = panelTexts[kind]?.title || kind;
      head.appendChild(el('div', 'panel-title', panelTexts[kind]?.shared ? title : typo(`${title} — ${ch.name}`)));
      const x = el('button', 'panel-x skin-close', '✕');
      x.type = 'button';
      x.title = texts.close;
      head.appendChild(x);
      node.appendChild(head);
      const body = el('div', 'panel-body skin-scroll');
      (builders[kind] || (() => {}))(ch, body);
      node.appendChild(body);
      const foot = el('div', 'panel-foot');
      const closeBtn = el('button', 'pill', texts.close);
      closeBtn.type = 'button';
      foot.appendChild(closeBtn);
      node.appendChild(foot);

      let resolve;
      const closed = new Promise((r) => (resolve = r));
      const entry = { node, resolve };
      const close = () => {
        if (current === entry) closeCurrent();
      };
      x.addEventListener('click', close);
      closeBtn.addEventListener('click', close);
      root.appendChild(node);
      current = entry;
      return { closed, close };
    },
  };
}
