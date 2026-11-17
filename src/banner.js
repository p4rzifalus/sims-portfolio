// Баннер взаимодействия сверху по центру: два портрета, значок между ними и текст
// («соня щекочет пашу, а паша хохочет»). Пока у персонажей нет движений для
// разговора, танца, щекотки и подарка, баннер показывает, что происходит.
// На экране один баннер: новый заменяет прежний.

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

export function createBanners(root, texts) {
  let current = null;

  function remove(b) {
    b.classList.add('leaving');
    b.addEventListener('animationend', () => b.remove(), { once: true });
    setTimeout(() => b.remove(), 400); // если анимации нет (скрытая вкладка)
  }

  // left, right — { portrait, color }; onClose — нажали крестик.
  // Возвращает close(): убрать баннер.
  function show({ icon, text, left, right, onClose }) {
    if (current) remove(current);
    const b = el('div', 'banner');
    b.setAttribute('role', 'status');

    const face = (who) => {
      const f = el('div', 'banner-face');
      f.style.setProperty('--accent', who.color);
      const img = el('img');
      img.src = who.portrait || '';
      img.alt = '';
      f.appendChild(img);
      return f;
    };

    b.appendChild(face(left));
    const mid = el('div', 'banner-body');
    mid.appendChild(el('div', 'banner-icon', icon));
    mid.appendChild(el('div', 'banner-text', text));
    b.appendChild(mid);
    b.appendChild(face(right));

    const x = el('button', 'banner-x', '✕');
    x.type = 'button';
    x.title = texts.cancel;
    x.addEventListener('click', () => onClose?.());
    b.appendChild(x);

    root.appendChild(b);
    current = b;
    return () => {
      if (current === b) current = null;
      if (b.isConnected) remove(b);
    };
  }

  return { show };
}
