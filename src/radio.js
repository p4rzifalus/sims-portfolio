// Радио: свои кнопки в стиле сайта поверх спрятанного плеера soundcloud.
// soundcloud даёт управлять своим плеером из страницы (Widget API):
// играть, пауза, следующая, громкость, название песни.
// Настройки и тексты — в data.js (radio).

import { typo } from './typo.js';

const API_URL = 'https://w.soundcloud.com/player/api.js';
const STORE_KEY = 'radio-volume';

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

function button(className, icon, label) {
  const b = el('button', className, icon);
  b.type = 'button';
  b.title = label;
  b.setAttribute('aria-label', label);
  return b;
}

// Скрипт soundcloud подключаем один раз и только когда он нужен.
let apiPromise = null;
function loadApi() {
  if (window.SC?.Widget) return Promise.resolve(window.SC);
  if (!apiPromise) {
    apiPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = API_URL;
      s.async = true;
      s.onload = () => (window.SC?.Widget ? resolve(window.SC) : reject(new Error('нет SC.Widget')));
      s.onerror = () => {
        apiPromise = null;
        s.remove();
        reject(new Error('скрипт soundcloud не загрузился'));
      };
      document.head.appendChild(s);
    });
  }
  return apiPromise;
}

function readVolume(fallback) {
  try {
    const v = Number(localStorage.getItem(STORE_KEY));
    if (localStorage.getItem(STORE_KEY) !== null && v >= 0 && v <= 100) return v;
  } catch {
    // память браузера недоступна — не страшно
  }
  return fallback;
}
function saveVolume(v) {
  try {
    localStorage.setItem(STORE_KEY, String(v));
  } catch {
    // ничего
  }
}

export function createRadio(parent, data) {
  if (!data || !data.show || !data.url) return null;

  // ---------- Внешний вид ----------
  const root = el('div', 'radio idle skin-frame small');
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', data.station);

  const playBtn = button('radio-play', '', data.play);
  playBtn.appendChild(el('span', 'radio-icon play'));
  playBtn.appendChild(el('span', 'radio-label', data.title));

  const info = el('div', 'radio-info skin-well');
  const station = el('div', 'radio-station', data.station);
  const titleBox = el('div', 'radio-title-box');
  const title = el('a', 'radio-title', data.tuning);
  title.target = '_blank';
  title.rel = 'noopener';
  title.title = data.source;
  titleBox.appendChild(title);
  const progress = el('div', 'radio-progress');
  const progressFill = el('i');
  progress.appendChild(progressFill);
  info.append(station, titleBox, progress);

  const nextBtn = button('radio-next', '', data.next);
  nextBtn.appendChild(el('span', 'radio-icon next'));

  const volume = el('input', 'radio-volume');
  volume.type = 'range';
  volume.min = 0;
  volume.max = 100;
  volume.step = 1;
  volume.value = readVolume(data.volume ?? 60);
  volume.title = data.volumeLabel;
  volume.setAttribute('aria-label', data.volumeLabel);
  const paintVolume = () => root.style.setProperty('--vol', `${volume.value}%`);
  paintVolume();

  root.append(playBtn, info, nextBtn, volume);
  parent.prepend(root);

  // Спрятанный плеер soundcloud. Не display:none — иначе некоторые браузеры его не запускают.
  const params = new URLSearchParams({
    url: data.url,
    auto_play: 'false',
    visual: 'false',
    show_artwork: 'false',
    show_comments: 'false',
    show_user: 'false',
    show_reposts: 'false',
    show_teaser: 'false',
    buying: 'false',
    sharing: 'false',
    download: 'false',
  });
  let iframe = null;
  let widget = null;
  let ready = null; // Promise: плеер готов
  let sounds = [];
  let playing = false;
  let started = false;
  let wantPlay = false;
  let lastIndex = -1;

  // ---------- Состояние на экране ----------
  function setState(state) {
    root.classList.remove('idle', 'tuning', 'playing', 'paused', 'error');
    root.classList.add(state);
    const isPlaying = state === 'playing' || state === 'tuning';
    playBtn.title = isPlaying ? data.pause : data.play;
    playBtn.setAttribute('aria-label', playBtn.title);
    playBtn.querySelector('.radio-icon').className = `radio-icon ${isPlaying ? 'pause' : 'play'}`;
  }

  function setTitle(text, href) {
    title.textContent = typo(text);
    if (href) title.href = href;
    else title.removeAttribute('href');
    // Длинное название бежит строкой.
    titleBox.classList.remove('scroll');
    requestAnimationFrame(() => {
      const extra = title.scrollWidth - titleBox.clientWidth;
      if (extra > 2) {
        titleBox.style.setProperty('--shift', `${-extra - 12}px`);
        titleBox.style.setProperty('--dur', `${Math.max(6, extra / 18 + 4)}s`);
        titleBox.classList.add('scroll');
      }
    });
  }

  function showCurrent() {
    widget.getCurrentSound((s) => {
      if (!s) return;
      const name = data.lowercase ? s.title.toLowerCase() : s.title;
      setTitle(name, s.permalink_url);
    });
  }

  // ---------- Плеер soundcloud ----------
  function prepare() {
    if (ready) return ready;
    ready = loadApi().then(
      (SC) =>
        new Promise((resolve, reject) => {
          iframe = document.createElement('iframe');
          iframe.className = 'radio-frame';
          iframe.allow = 'autoplay; encrypted-media';
          iframe.title = data.station;
          iframe.tabIndex = -1;
          iframe.setAttribute('aria-hidden', 'true');
          iframe.src = `https://w.soundcloud.com/player/?${params}`;
          document.body.appendChild(iframe);
          widget = SC.Widget(iframe);
          const timer = setTimeout(() => reject(new Error('soundcloud не ответил')), 15000);
          const E = SC.Widget.Events;
          widget.bind(E.READY, () => {
            clearTimeout(timer);
            widget.setVolume(Number(volume.value));
            widget.getSounds((list) => {
              sounds = list || [];
              resolve();
            });
          });
          widget.bind(E.PLAY, () => {
            playing = true;
            started = true;
            setState('playing');
            widget.setVolume(Number(volume.value));
            showCurrent();
          });
          widget.bind(E.PAUSE, () => {
            playing = false;
            if (!wantPlay) setState('paused');
          });
          widget.bind(E.FINISH, () => {
            playing = false;
            // По порядку soundcloud сам включает следующую песню — кроме последней.
            if (data.shuffle || lastIndex >= sounds.length - 1) playNext();
            else lastIndex++;
          });
          widget.bind(E.PLAY_PROGRESS, (p) => {
            progressFill.style.width = `${(p.relativePosition || 0) * 100}%`;
          });
          widget.bind(E.ERROR, () => {
            if (wantPlay) fail(new Error('soundcloud не смог включить песню'));
          });
        }),
    );
    // Не получилось — в следующий раз попробуем заново.
    ready.catch(() => {
      ready = null;
      iframe?.remove();
    });
    return ready;
  }

  function fail(err) {
    if (err) console.warn('Радио:', err.message || err);
    wantPlay = false;
    setState('error');
    setTitle(data.error);
  }

  function pickIndex() {
    const n = sounds.length;
    if (n <= 1) return 0;
    if (!data.shuffle) return (lastIndex + 1) % n;
    let i;
    do i = Math.floor(Math.random() * n);
    while (i === lastIndex);
    return i;
  }

  function playIndex(i) {
    lastIndex = i;
    wantPlay = true;
    setState('tuning');
    setTitle(data.tuning);
    progressFill.style.width = '0';
    widget.skip(i); // skip сам включает песню
  }

  function playNext() {
    if (!widget) return;
    if (sounds.length) playIndex(pickIndex());
    else widget.next();
  }

  function toggle() {
    if (playing || wantPlay) {
      wantPlay = false;
      widget?.pause();
      setState('paused');
      return;
    }
    wantPlay = true;
    setState('tuning');
    if (!started) setTitle(data.tuning);
    prepare().then(() => {
      if (!wantPlay) return;
      if (!started) playIndex(data.shuffle ? pickIndex() : 0);
      else widget.play();
    }, fail);
  }

  playBtn.addEventListener('click', toggle);
  nextBtn.addEventListener('click', () => {
    if (!widget) return;
    playNext();
  });
  volume.addEventListener('input', () => {
    paintVolume();
    widget?.setVolume(Number(volume.value));
    saveVolume(volume.value);
  });

  // Плеер готовим заранее, когда страница уже загрузилась и свободна:
  // тогда по нажатию песня включается сразу (и браузеры охотнее разрешают звук).
  const warmUp = () => prepare().catch(() => {});
  if ('requestIdleCallback' in window) requestIdleCallback(warmUp, { timeout: 4000 });
  else setTimeout(warmUp, 2000);

  return {
    toggle,
    next: playNext,
    get playing() {
      return playing;
    },
    get widget() {
      return widget;
    },
  };
}
