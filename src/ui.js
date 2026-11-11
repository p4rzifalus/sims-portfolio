// Интерфейс поверх 3D: колонка портретов слева и панель выбранного персонажа снизу.
// Все тексты берутся из data.js. Здесь только HTML и реакция на клики.

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

export function createUI({ characters, texts, onSelect, onCancel }) {
  const root = document.getElementById('ui');

  // ---------- Колонка портретов ----------
  const column = el('div', 'portraits');
  const portraitButtons = {};
  for (const ch of characters) {
    const b = el('button', 'portrait');
    b.type = 'button';
    b.title = ch.name;
    b.style.setProperty('--accent', ch.color);
    b.appendChild(el('img'));
    b.addEventListener('click', () => onSelect(ch.id));
    column.appendChild(b);
    portraitButtons[ch.id] = b;
  }
  root.appendChild(column);

  // ---------- Нижняя панель ----------
  const panel = el('div', 'hud');
  panel.innerHTML = `
    <div class="hud-who">
      <div class="hud-portrait"><img alt=""></div>
      <div class="hud-clock"><span class="time"></span><span class="date"></span></div>
    </div>
    <div class="hud-info">
      <div class="hud-name"></div>
      <div class="hud-action-row">
        <div class="hud-action">
          <span class="icon"></span>
          <button class="cancel" type="button"></button>
        </div>
        <div class="hud-action-label"></div>
      </div>
    </div>
    <div class="hud-traits">
      <div class="hud-traits-title"></div>
      <div class="hud-traits-list"></div>
    </div>`;
  root.appendChild(panel);

  const $ = (s) => panel.querySelector(s);
  const bigPortrait = $('.hud-portrait img');
  const nameEl = $('.hud-name');
  const actionBox = $('.hud-action');
  const actionIcon = $('.hud-action .icon');
  const actionLabel = $('.hud-action-label');
  const cancelBtn = $('.cancel');
  const traitsList = $('.hud-traits-list');
  const timeEl = $('.hud-clock .time');
  const dateEl = $('.hud-clock .date');
  $('.hud-traits-title').textContent = texts.traitsTitle;
  cancelBtn.title = texts.cancel;
  cancelBtn.textContent = '✕';
  cancelBtn.addEventListener('click', () => onCancel());

  const portraits = {};
  let selectedId = null;
  let lastActivity = undefined;

  // ---------- Часы ----------
  function tickClock() {
    const now = new Date();
    timeEl.textContent = now.toLocaleTimeString('ru-RU', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: !texts.clock24h,
    });
    dateEl.textContent = now.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' });
  }
  tickClock();
  setInterval(tickClock, 1000);

  return {
    setPortrait(id, url) {
      portraits[id] = url;
      portraitButtons[id].querySelector('img').src = url;
      if (id === selectedId) bigPortrait.src = url;
    },

    setSelected(data) {
      selectedId = data.id;
      for (const [id, b] of Object.entries(portraitButtons)) b.classList.toggle('selected', id === data.id);
      panel.style.setProperty('--accent', data.color);
      bigPortrait.src = portraits[data.id] || '';
      nameEl.textContent = data.name;
      traitsList.replaceChildren(
        ...data.traits.map((t) => {
          const item = el('div', 'trait');
          item.appendChild(el('span', 'trait-icon', t.icon));
          item.appendChild(el('span', 'trait-label', t.label));
          return item;
        }),
      );
      lastActivity = undefined;
    },

    // activity — { icon, label } или null, если персонаж ничем не занят.
    setActivity(activity) {
      const key = activity ? activity.icon + activity.label : null;
      if (key === lastActivity) return;
      lastActivity = key;
      actionBox.classList.toggle('empty', !activity);
      actionIcon.textContent = activity ? activity.icon : '';
      actionLabel.textContent = activity ? activity.label : texts.idle;
    },
  };
}
