// Письмо-приветствие в правом верхнем углу, как уведомление в The Sims 4.
// Тексты — в data.js (welcome). Закрывается крестиком.

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

export function showWelcome(root, data, texts) {
  if (!data || !data.show) return;

  const note = el('div', 'notice skin-frame velvet');
  note.setAttribute('role', 'status');

  note.appendChild(el('div', 'notice-icon skin-round', data.icon));
  const body = el('div', 'notice-body');
  if (data.title) body.appendChild(el('div', 'notice-title', data.title));
  body.appendChild(el('div', 'notice-text', data.text));
  note.appendChild(body);

  const x = el('button', 'notice-x skin-close', '✕');
  x.type = 'button';
  x.title = texts.close;
  note.appendChild(x);

  // Закрытие: короткая анимация «уезжает вправо», потом элемент удаляется.
  x.addEventListener('click', () => {
    note.classList.add('leaving');
    note.addEventListener('animationend', () => note.remove(), { once: true });
  });

  setTimeout(() => root.appendChild(note), (data.delay || 0) * 1000);
}
