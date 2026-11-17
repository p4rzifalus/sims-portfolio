// Радиальное меню: кнопки-«таблетки» по кругу вокруг курсора,
// в центре — портрет выбранного персонажа. Клик мимо — закрывает.
const RADIUS = 74; // расстояние от центра до точек-соединителей, px
const GAP = 10; // от точки до края кнопки
const EDGE = 8; // отступ от краёв экрана
// Телефон (та же граница, что в style.css): круг сжат по горизонтали в овал,
// кнопки мельче — иначе меню из шести пунктов шире экрана.
const MOBILE = window.matchMedia('(max-width: 640px)');
const COMPACT = { rx: 46, ry: 78, gap: 7 };

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

export function createRadialMenu(root, texts) {
  let current = null;

  function close() {
    if (!current) return;
    const { overlay, onClose } = current;
    current = null;
    overlay.remove();
    onClose?.();
  }

  // items: [{ label, icon, disabled }]; onPick(item) — что делать при выборе.
  function open({ x, y, portrait, accent, items, onPick, onClose }) {
    close();
    const overlay = el('div', 'radial-overlay');
    const compact = MOBILE.matches;
    const rx = compact ? COMPACT.rx : RADIUS;
    const ry = compact ? COMPACT.ry : RADIUS;
    const gap = compact ? COMPACT.gap : GAP;
    const menu = el('div', 'radial measuring' + (compact ? ' compact' : ''));
    menu.style.setProperty('--accent', accent);

    const center = el('div', 'radial-center');
    const img = el('img');
    img.src = portrait || '';
    img.alt = '';
    center.appendChild(img);
    menu.appendChild(center);

    const n = items.length;
    items.forEach((item, i) => {
      // Кнопки по кругу, первая — сверху, дальше по часовой стрелке.
      const angle = ((-90 + (i * 360) / n) * Math.PI) / 180;
      const dx = Math.cos(angle) * rx;
      const dy = Math.sin(angle) * ry;

      const dot = el('span', 'radial-dot');
      dot.style.left = `${dx}px`;
      dot.style.top = `${dy}px`;
      dot.style.animationDelay = `${i * 35}ms`;
      menu.appendChild(dot);

      const pill = el('button', 'radial-pill' + (item.disabled ? ' disabled' : ''));
      pill.type = 'button';
      if (item.icon) pill.appendChild(el('span', 'radial-icon', item.icon));
      pill.appendChild(el('span', 'radial-label', item.label));
      if (item.disabled) pill.appendChild(el('span', 'radial-busy', texts.busy));
      // Кнопки справа растут вправо, слева — влево, сверху/снизу — по центру.
      const cos = Math.cos(angle);
      if (cos > 0.35) {
        pill.style.left = `${dx + gap}px`;
        pill.style.top = `${dy}px`;
        pill.style.translate = '0 -50%';
      } else if (cos < -0.35) {
        pill.style.left = `${dx - gap}px`;
        pill.style.top = `${dy}px`;
        pill.style.translate = '-100% -50%';
      } else {
        const up = Math.sin(angle) < 0;
        pill.style.left = `${dx}px`;
        pill.style.top = `${dy + (up ? -gap : gap)}px`;
        pill.style.translate = up ? '-50% -100%' : '-50% 0';
      }
      pill.style.animationDelay = `${i * 35}ms`;
      pill.addEventListener('click', (e) => {
        e.stopPropagation();
        if (item.disabled) return;
        close();
        onPick(item);
      });
      menu.appendChild(pill);
    });

    // Клик мимо меню — закрыть (и не пропустить клик в сцену).
    overlay.addEventListener('pointerdown', (e) => {
      if (e.target === overlay) close();
    });
    overlay.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      close();
    });

    overlay.appendChild(menu);
    root.appendChild(overlay);

    // Не вылезать за края экрана: измеряем меню целиком и сдвигаем.
    // Если оно шире или выше экрана — сначала уменьшаем целиком.
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    const bounds = () => {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const child of menu.children) {
        const r = child.getBoundingClientRect();
        minX = Math.min(minX, r.left);
        minY = Math.min(minY, r.top);
        maxX = Math.max(maxX, r.right);
        maxY = Math.max(maxY, r.bottom);
      }
      return { minX, minY, maxX, maxY };
    };
    let b = bounds();
    const fit = Math.min(
      1,
      (window.innerWidth - 2 * EDGE) / (b.maxX - b.minX),
      (window.innerHeight - 2 * EDGE) / (b.maxY - b.minY),
    );
    if (fit < 1) {
      menu.style.scale = String(fit); // меню нулевого размера — уменьшается вокруг центра
      b = bounds();
    }
    let sx = 0, sy = 0;
    if (b.minX < EDGE) sx = EDGE - b.minX;
    else if (b.maxX > window.innerWidth - EDGE) sx = window.innerWidth - EDGE - b.maxX;
    if (b.minY < EDGE) sy = EDGE - b.minY;
    else if (b.maxY > window.innerHeight - EDGE) sy = window.innerHeight - EDGE - b.maxY;
    menu.style.left = `${x + sx}px`;
    menu.style.top = `${y + sy}px`;
    menu.classList.remove('measuring'); // запускает анимацию появления

    current = { overlay, onClose };
  }

  return {
    open,
    close,
    get isOpen() {
      return Boolean(current);
    },
  };
}
