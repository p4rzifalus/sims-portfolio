// Интерфейс поверх 3D: колонка портретов слева и панель выбранного персонажа снизу.
// Все тексты берутся из data.js. Здесь только HTML и реакция на клики.

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

export function createUI({ characters, texts, dossier, onSelect, onCancel }) {
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
    <div class="hud-dossier">
      <div class="dossier-tabs"></div>
      <div class="dossier-body"></div>
    </div>`;
  root.appendChild(panel);

  const $ = (s) => panel.querySelector(s);
  const bigPortrait = $('.hud-portrait img');
  const nameEl = $('.hud-name');
  const actionBox = $('.hud-action');
  const actionIcon = $('.hud-action .icon');
  const actionLabel = $('.hud-action-label');
  const cancelBtn = $('.cancel');
  const tabsEl = $('.dossier-tabs');
  const body = $('.dossier-body');
  const timeEl = $('.hud-clock .time');
  const dateEl = $('.hud-clock .date');
  cancelBtn.title = texts.cancel;
  cancelBtn.textContent = '✕';
  cancelBtn.addEventListener('click', () => onCancel());

  const portraits = {};
  let selectedId = null;
  let selectedData = null;
  let lastActivity = undefined;

  // ---------- Досье: вкладки ----------
  let tab = dossier.tabs[0].id; // открытая вкладка не меняется при смене персонажа
  const tabButtons = {};
  for (const t of dossier.tabs) {
    const b = el('button', 'dossier-tab');
    b.type = 'button';
    b.appendChild(el('span', 'dossier-tab-icon', t.icon));
    b.appendChild(el('span', 'dossier-tab-label', t.label));
    b.addEventListener('click', () => {
      tab = t.id;
      renderDossier();
    });
    tabsEl.appendChild(b);
    tabButtons[t.id] = b;
  }

  // Значок и подпись (интересы).
  function iconItem({ icon, label }) {
    const item = el('div', 'icon-item');
    item.appendChild(el('span', 'icon-item-icon', icon));
    item.appendChild(el('span', 'icon-item-label', label));
    return item;
  }

  const views = {
    // 5 шкал по 10 делений
    personality(d) {
      const list = el('div', 'scales');
      for (const s of dossier.personality) {
        const row = el('div', 'scale');
        row.appendChild(el('span', 'scale-label', s.label));
        const cells = el('span', 'scale-cells');
        const value = (d.personality && d.personality[s.id]) || 0;
        for (let i = 0; i < dossier.personalityMax; i++) {
          cells.appendChild(el('span', i < value ? 'cell on' : 'cell'));
        }
        row.appendChild(cells);
        list.appendChild(row);
      }
      return list;
    },
    interests(d) {
      const list = el('div', 'icon-list');
      list.append(...(d.interests || []).map(iconItem));
      return list;
    },
    // «место — роль», место крупнее, роль под ним
    jobs(d) {
      const list = el('div', 'jobs');
      for (const j of d.jobs || []) {
        const item = el('div', 'job');
        item.appendChild(el('div', 'job-place', j.place));
        item.appendChild(el('div', 'job-role', j.role));
        list.appendChild(item);
      }
      return list;
    },
    // Портрет знакомого (клик — выбрать его) и цифра дружбы со шкалой от −100 до 100.
    relationships(d) {
      const list = el('div', 'relations');
      for (const r of d.relationships || []) {
        const other = characters.find((c) => c.id === r.who);
        if (!other) continue;
        const item = el('div', 'relation');
        item.style.setProperty('--other', other.color);
        const face = el('button', 'relation-portrait');
        face.type = 'button';
        face.title = other.name;
        const img = el('img');
        img.alt = '';
        if (portraits[other.id]) img.src = portraits[other.id];
        face.appendChild(img);
        face.addEventListener('click', () => onSelect(other.id));
        item.appendChild(face);

        const info = el('div', 'relation-info');
        info.appendChild(el('div', 'relation-name', other.name));
        const f = Math.max(-100, Math.min(100, r.friendship));
        const line = el('div', 'relation-score');
        line.appendChild(el('span', 'relation-label', dossier.friendshipLabel));
        line.appendChild(el('span', 'relation-value', String(f)));
        info.appendChild(line);
        const bar = el('div', 'friend-bar');
        const fill = el('span', f < 0 ? 'friend-fill neg' : 'friend-fill');
        fill.style.width = `${Math.abs(f) / 2}%`;
        bar.appendChild(fill);
        info.appendChild(bar);
        item.appendChild(info);
        list.appendChild(item);
      }
      return list;
    },
  };

  function renderDossier() {
    for (const [id, b] of Object.entries(tabButtons)) b.classList.toggle('active', id === tab);
    body.replaceChildren(selectedData ? views[tab](selectedData) : '');
  }

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
      if (tab === 'relationships') renderDossier(); // портреты знакомых появляются после загрузки
    },

    setSelected(data) {
      selectedId = data.id;
      for (const [id, b] of Object.entries(portraitButtons)) b.classList.toggle('selected', id === data.id);
      panel.style.setProperty('--accent', data.color);
      bigPortrait.src = portraits[data.id] || '';
      nameEl.textContent = data.name;
      selectedData = data;
      renderDossier();
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
