// Страница-превью набора деталей (/kit.html, только dev): проверить швы рамок,
// состояния кнопок и тайлы до того, как переносить их в интерфейс сайта.
import '@fontsource/inter/cyrillic-600.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/old-standard-tt/cyrillic-700.css';
import '@fontsource/old-standard-tt/latin-700.css';
import './ui/kit.css';
import './kit-preview.css';

const css = getComputedStyle(document.documentElement);
const names = [...document.styleSheets]
  .flatMap((s) => [...s.cssRules])
  .filter((r) => r.selectorText === ':root')
  .flatMap((r) => [...r.style])
  .filter((p) => p.startsWith('--ui-') && !/-(size|slice|w)$/.test(p))
  .map((p) => p.slice(5));

const html = String.raw;
document.body.innerHTML = html`
  <h1 class="title">набор деталей</h1>

  <section>
    <h2 class="title">рамки тянутся</h2>
    <div class="row">
      <div class="frame" style="width: 300px; height: 180px"><h3 class="title">потребности</h3><span class="bone-bar"></span></div>
      <div class="frame" style="width: 520px; height: 230px"><h3 class="title">пара слов</h3><p>привет, ребята! рада с вами познакомиться</p></div>
      <div class="frame velvet" style="width: 380px; height: 140px"><h3 class="title">письмо</h3><p>это комната сони сурм и паши архангельского</p></div>
      <div class="frame" style="width: 200px; height: 200px"></div>
    </div>
    <div class="row">
      <div class="frame-small" style="width: 360px; height: 60px"><p>баннер: соня машет паше</p></div>
      <div class="frame-small" style="width: 200px; height: 90px"></div>
    </div>
  </section>

  <section>
    <h2 class="title">экранчики и шкалы</h2>
    <div class="row">
      <div class="well" style="width: 320px; height: 120px"><p>щелочь — препод курса ПИН</p></div>
      <div class="well" style="width: 160px; height: 60px"></div>
      <div class="clock">13:36</div>
      <div class="scroll"><i></i></div>
    </div>
    <div class="row bars">
      <div class="need"><span>голод</span><div class="bar"><i class="good" style="width: 70%"></i></div></div>
      <div class="need"><span>бодрость</span><div class="bar"><i class="mid" style="width: 40%"></i></div></div>
      <div class="need"><span>обстановка</span><div class="bar"><i class="low" style="width: 18%"></i></div></div>
      <div class="need wide"><span>длинная шкала</span><div class="bar"><i class="good" style="width: 55%"></i></div></div>
    </div>
  </section>

  <section>
    <h2 class="title">кнопки (наведи и нажми)</h2>
    <div class="row">
      <button class="pill">показать работы</button>
      <button class="pill">радио</button>
      <button class="pill" disabled>занято</button>
      <button class="pill toggle on">PS1: вкл</button>
      <button class="pill toggle">G — сетка</button>
    </div>
    <div class="row">
      <button class="round"><i class="icon play"></i></button>
      <button class="round"><i class="icon pause"></i></button>
      <button class="round"><i class="icon next"></i></button>
      <button class="round" disabled><i class="icon cross"></i></button>
      <button class="close" title="закрыть"></button>
      <button class="close" disabled></button>
    </div>
    <div class="row tabs">
      <button class="tab active">потребности</button>
      <button class="tab">работа</button>
      <button class="tab">пара слов</button>
    </div>
  </section>

  <section>
    <h2 class="title">портрет, меню, украшения</h2>
    <div class="row">
      <div class="portrait"><div class="face"></div></div>
      <div class="portrait selected"><div class="face"></div></div>
      <div class="ring-demo"><div class="face"></div><span class="ring"></span><i class="bead" style="--a: 200deg"></i><i class="bead" style="--a: 240deg"></i><i class="bead" style="--a: 280deg"></i></div>
      <div class="frame ornamented" style="width: 300px; height: 150px"><span class="thorns"></span><span class="horns"></span><span class="skull"></span></div>
      <span class="clamp-demo"><span class="frame-small" style="width: 120px; height: 70px"></span><span class="clamp"></span><span class="frame-small" style="width: 120px; height: 70px"></span></span>
    </div>
  </section>

  <section>
    <h2 class="title">все куски</h2>
    <div class="row all"></div>
  </section>
`;

const all = document.querySelector('.all');
for (const n of names) {
  const size = css.getPropertyValue(`--ui-${n}-size`).trim();
  const fig = document.createElement('figure');
  const tile = !size.includes(' ');
  fig.innerHTML = `<div class="piece" style="background-image: var(--ui-${n}); width: ${tile ? '256px' : size.split(' ')[0]}; height: ${tile ? '256px' : size.split(' ')[1]}; background-size: ${tile ? size : '100% 100%'}"></div><figcaption>${n}<br>${size}</figcaption>`;
  all.appendChild(fig);
}
