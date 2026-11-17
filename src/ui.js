// Интерфейс поверх 3D: колонка портретов слева и панель выбранного персонажа снизу.
// Нижняя панель — три блока, как в The Sims 2: портрет (под ним интересы и часы),
// работа и правый блок с вкладками (потребности, отношения).
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
    <div class="hud-block hud-me">
      <div class="hud-name"></div>
      <div class="hud-me-row">
        <div class="hud-portrait"><img alt=""></div>
        <div class="hud-action-col">
          <div class="hud-action">
            <span class="icon"></span>
            <button class="cancel" type="button"></button>
          </div>
          <div class="hud-action-label"></div>
        </div>
      </div>
      <div class="hud-interests"></div>
      <div class="hud-clock"><span class="date"></span><span class="time"></span></div>
    </div>
    <div class="hud-block hud-work">
      <div class="hud-title"></div>
      <div class="hud-well jobs"></div>
    </div>
    <div class="hud-block hud-side">
      <div class="side-tabs"></div>
      <div class="mood"><span class="mood-fill"></span></div>
      <div class="side-content">
        <div class="hud-title side-title"></div>
        <div class="side-body"></div>
      </div>
    </div>`;
  root.appendChild(panel);

  const $ = (s) => panel.querySelector(s);
  const bigPortrait = $('.hud-portrait img');
  const nameEl = $('.hud-name');
  const actionBox = $('.hud-action');
  const actionIcon = $('.hud-action .icon');
  const actionLabel = $('.hud-action-label');
  const cancelBtn = $('.cancel');
  const interestsEl = $('.hud-interests');
  const jobsEl = $('.jobs');
  const tabsEl = $('.side-tabs');
  const sideTitle = $('.side-title');
  const sideBody = $('.side-body');
  const moodEl = $('.mood');
  const moodFill = $('.mood-fill');
  const timeEl = $('.hud-clock .time');
  const dateEl = $('.hud-clock .date');
  $('.hud-work .hud-title').textContent = dossier.jobsTitle;
  cancelBtn.title = texts.cancel;
  cancelBtn.textContent = '✕';
  cancelBtn.addEventListener('click', () => onCancel());

  const portraits = {};
  let selectedId = null;
  let selectedData = null;
  let lastActivity = undefined;

  // ---------- Подсказка ----------
  // Мышью — при наведении, пальцем — по нажатию (повторное нажатие или нажатие мимо прячет).
  const tip = el('div', 'hud-tip');
  root.appendChild(tip);
  let tipOwner = null;

  function showTip(owner) {
    const { tipTitle, tipText } = owner.dataset;
    tip.replaceChildren(el('div', 'hud-tip-title', tipTitle));
    if (tipText) tip.appendChild(el('div', 'hud-tip-text', tipText));
    tip.classList.add('visible');
    tipOwner = owner;
    // Над значком, по центру, не вылезая за края экрана.
    const r = owner.getBoundingClientRect();
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    const x = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2));
    tip.style.left = `${x}px`;
    tip.style.top = `${Math.max(8, r.top - h - 10)}px`;
  }
  function hideTip() {
    tip.classList.remove('visible');
    tipOwner = null;
  }
  function withTip(node, title, text) {
    node.dataset.tipTitle = title;
    if (text) node.dataset.tipText = text;
    node.addEventListener('pointerenter', (e) => {
      if (e.pointerType === 'mouse') showTip(node);
    });
    node.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'mouse' && tipOwner === node) hideTip();
    });
    node.addEventListener('click', (e) => {
      if (e.pointerType === 'mouse') return; // мышью подсказка уже видна
      if (tipOwner === node) hideTip();
      else showTip(node);
    });
    return node;
  }
  document.addEventListener('pointerdown', (e) => {
    if (tipOwner && !tipOwner.contains(e.target)) hideTip();
  });

  // ---------- Правый блок: вкладки ----------
  let tab = dossier.tabs[0].id; // открытая вкладка не меняется при смене персонажа
  const tabButtons = {};
  for (const t of dossier.tabs) {
    const b = el('button', 'side-tab', t.icon);
    b.type = 'button';
    b.setAttribute('aria-label', t.label);
    withTip(b, t.label);
    b.addEventListener('click', () => {
      tab = t.id;
      renderSide();
    });
    tabsEl.appendChild(b);
    tabButtons[t.id] = b;
  }

  // Доля от 0 до 1 → цвет шкалы, как в The Sims: зелёный, жёлтый, красный.
  const level = (k) => (k >= 0.6 ? 'good' : k >= 0.3 ? 'mid' : 'low');

  const views = {
    // Две колонки шкал: подпись над полоской.
    needs(d) {
      const grid = el('div', 'needs');
      grid.style.gridTemplateRows = `repeat(${Math.ceil(dossier.needs.length / 2)}, auto)`; // половина слева, половина справа
      for (const n of dossier.needs) {
        const k = Math.max(0, Math.min(1, ((d.needs && d.needs[n.id]) || 0) / dossier.needsMax));
        const item = el('div', 'need');
        item.appendChild(el('div', 'need-label', n.label));
        const bar = el('div', 'need-bar');
        const fill = el('span', `need-fill ${level(k)}`);
        fill.style.width = `${k * 100}%`;
        bar.appendChild(fill);
        item.appendChild(bar);
        grid.appendChild(item);
      }
      return grid;
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

  function renderSide() {
    for (const [id, b] of Object.entries(tabButtons)) b.classList.toggle('active', id === tab);
    sideTitle.textContent = dossier.tabs.find((t) => t.id === tab).label;
    sideBody.replaceChildren(selectedData ? views[tab](selectedData) : '');
  }

  // Столбик настроения — среднее всех потребностей.
  function renderMood(d) {
    const values = dossier.needs.map((n) => (d.needs && d.needs[n.id]) || 0);
    const k = values.reduce((a, b) => a + b, 0) / (values.length * dossier.needsMax || 1);
    moodFill.style.height = `${Math.max(0, Math.min(1, k)) * 100}%`;
    moodFill.className = `mood-fill ${level(k)}`;
  }
  withTip(moodEl, dossier.moodLabel);

  function renderDossier(d) {
    interestsEl.replaceChildren(
      ...(d.interests || []).map((it) => {
        const b = el('button', 'interest', it.icon);
        b.type = 'button';
        b.setAttribute('aria-label', it.label);
        return withTip(b, it.label, it.description);
      }),
    );
    jobsEl.replaceChildren(
      ...(d.jobs || []).map((j) => {
        const item = el('div', 'job');
        item.appendChild(el('div', 'job-place', j.place));
        item.appendChild(el('div', 'job-role', j.role));
        return item;
      }),
    );
    renderMood(d);
    renderSide();
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
      if (tab === 'relationships') renderSide(); // портреты знакомых появляются после загрузки
    },

    setSelected(data) {
      selectedId = data.id;
      selectedData = data;
      hideTip();
      for (const [id, b] of Object.entries(portraitButtons)) b.classList.toggle('selected', id === data.id);
      panel.style.setProperty('--accent', data.color);
      bigPortrait.src = portraits[data.id] || '';
      nameEl.textContent = data.name;
      renderDossier(data);
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
