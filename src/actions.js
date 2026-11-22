// Выполнение действий из data.js как цепочки шагов:
// дойти → повернуться → анимация (сесть / помахать) → достать предмет → панель → завершение.
// Любой шаг можно прервать: крестиком в нижней панели, кликом по полу
// или новым действием. Тогда персонаж «прибирается»: панель закрывается,
// предмет убирается, он встаёт, место освобождается.
import { FACING_ANGLE, seatPoint } from './room.js';
import { typo } from './typo.js';

// Места, куда можно подойти для действия: [{ goTo, key }].
// key — чем занято место (для «занято»); null — место не занимается.
// У действия либо одна клетка goTo, либо несколько spots (например, два места на диване).
export function actionSpots(action, item) {
  const base = action.occupies ? action.sitOn || item?.id : null;
  if (action.spots) return action.spots.map((c) => ({ goTo: c, key: base && `${base}@${c.join(',')}` }));
  return [{ goTo: action.goTo, key: base }];
}

// Свободное для actor место (то, где он уже сидит, — тоже его) или null, если всё занято.
export function freeSpot(action, item, occupancy, actor) {
  const spots = actionSpots(action, item);
  return (
    spots.find((s) => s.key && occupancy.get(s.key) === actor) ||
    spots.find((s) => !s.key || !occupancy.get(s.key)) ||
    null
  );
}

// actor — кто выполняет; target — по кому кликнули (для действий с персонажем);
// item — предмет из data.js (для действий с предметом).
export function performAction({ actor, action, item, target, furniture, occupancy, panels, cameraYaw }) {
  const seatItem = action.sitOn ? furniture.find((f) => f.id === action.sitOn) : null;

  return actor.runTask({ icon: action.icon, label: action.label }, async (task) => {
    // 1. Выбрать и занять место (второй персонаж увидит «занято»). Выбираем здесь,
    // а не при клике: прежнее действие уже закончилось, и места не перепутаются.
    const spot = freeSpot(action, item, occupancy, actor);
    if (!spot) throw new Error('место занято');
    const { goTo, key: busyKey } = spot;
    if (busyKey) {
      occupancy.set(busyKey, actor);
      task.onCleanup(() => {
        if (occupancy.get(busyKey) === actor) occupancy.delete(busyKey);
      });
    }

    // 2. Дойти
    if (goTo) {
      task.onCleanup(() => {
        if (actor.isWalking) actor.stop();
      });
      await task.step(actor.walkToAsync(...goTo));
    }

    // 3. Повернуться (если куда — не сказано, а действие «на публику», — к зрителю)
    const yaw = action.face ? FACING_ANGLE[action.face] : action.who === 'target' ? cameraYaw : null;
    if (yaw !== null) await task.step(actor.faceTo(yaw));

    // 4. Анимация
    const sits = action.animation === 'sit' && seatItem;
    if (sits) {
      task.onCleanup(() => actor.standUp()); // «встать» — при любом завершении
      await task.step(actor.sitDown(seatPoint(seatItem, goTo)));
      // сидя — своё движение (например, печатает за макбуком), если оно есть у модели
      if (action.sitPose && actor.actions[actor.anim[action.sitPose]]) actor.play(action.sitPose, 0.4);
    } else if (action.animation === 'wave') {
      task.onCleanup(() => actor.stopWave());
      await task.step(actor.wave());
    } else if (action.animation) {
      actor.play(action.animation);
      task.onCleanup(() => actor.play('idle'));
    }

    // 5. Достать предмет (книгу, ноутбук)
    if (action.prop) {
      task.onCleanup(() => actor.putAway());
      await task.step(actor.takeProp(action.prop));
    }
    // …и повернуться ещё раз (например, с книгой — к зрителю, чтобы её было видно)
    if (action.thenFace) {
      await task.step(actor.faceTo(action.thenFace === 'viewer' ? cameraYaw : FACING_ANGLE[action.thenFace]));
    }

    // 6. Панель
    if (action.panel) {
      if (action.panelDelay) await task.step(actor.wait(action.panelDelay));
      const owner = action.who === 'target' && target ? target : actor; // чьи данные показывать
      const panel = panels.open(action.panel, owner.data);
      task.onCleanup(() => panel.close());
      const how = await task.step(panel.closed); // закрыли панель — действие закончено, дальше «уборка»
      // Панель вытеснил другой персонаж — этот продолжает сидеть / держать предмет.
      if (how === 'replaced' && (sits || action.prop)) await task.step(new Promise(() => {}));
    } else if (sits || action.prop) {
      // Без панели: сидит / держит предмет, пока действие не отменят.
      await task.step(new Promise(() => {}));
    }
  });
}

// ---------- Взаимодействия персонажей (social в data.js) ----------
// actor подходит к target, оба поворачиваются друг к другу, сверху — баннер.
// Движений пока нет: их сделаем, когда появятся новые модели.
// Второй персонаж на это время тоже «занят»: если его отвлечь (клик по полу,
// крестик, другое действие), взаимодействие заканчивается у обоих.

// {actor}, {target.acc}, {gift} → имена в нужном падеже и выбранный подарок.
function fillBanner(template, actor, target, choice) {
  const name = (ch, form) => ch.data.forms?.[form || 'nom'] || ch.data.name;
  return typo(
    template.replace(/\{(actor|target|gift)(?:\.(\w+))?\}/g, (_, who, form) => {
      if (who === 'gift') return choice?.label || '';
      return name(who === 'actor' ? actor : target, form);
    }),
  );
}

// Свободная клетка рядом с target (сначала по сторонам, потом по диагонали), ближайшая к actor.
function spotNear(grid, actor, target) {
  const [tc, tr] = grid.worldToCell(target.position.x, target.position.z);
  const [ac, ar] = grid.worldToCell(actor.position.x, actor.position.z);
  const near = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const c = tc + dc, r = tr + dr;
      if ((dc || dr) && grid.isFree(c, r)) near.push({ c, r, diag: dc && dr ? 1 : 0, d: Math.hypot(c - ac, r - ar) });
    }
  }
  near.sort((a, b) => a.diag - b.diag || a.d - b.d);
  return near[0] ? [near[0].c, near[0].r] : null;
}

const yawTo = (from, to) => Math.atan2(to.position.x - from.position.x, to.position.z - from.position.z);

export function performSocial({ actor, target, action, choice, grid, banners, getPortrait, duration }) {
  return actor.runTask({ icon: action.icon, label: action.actorStatus || action.label }, async (task) => {
    // 1. Второй бросает своё дело (встаёт со стула, останавливается)…
    await task.step(target.cancelTask());
    if (target.isWalking) target.stop();
    // …и ждёт, пока взаимодействие не кончится. Его задачу отменит «уборка» первого.
    const targetTask = await task.step(
      new Promise((resolve) => {
        target.runTask({ icon: action.icon, label: action.targetStatus || action.label }, (t) => {
          resolve(t);
          if (task.cancelled) return; // первого уже отменили, пока второй вставал
          t.onCleanup(() => task.cancel()); // второго отвлекли — первый тоже перестаёт
          return t.step(new Promise(() => {}));
        });
      }),
    );
    task.onCleanup(() => targetTask.cancel());

    // 2. Подойти (если ещё не рядом)
    const close = Math.hypot(target.position.x - actor.position.x, target.position.z - actor.position.z) < 1.6;
    if (!close) {
      const spot = spotNear(grid, actor, target);
      if (!spot) throw new Error('рядом со вторым персонажем нет свободной клетки');
      task.onCleanup(() => {
        if (actor.isWalking) actor.stop();
      });
      await task.step(actor.walkToAsync(...spot));
    }

    // 3. Повернуться друг к другу
    await task.step(Promise.all([actor.faceTo(yawTo(actor, target)), target.faceTo(yawTo(target, actor))]));

    // 4. Баннер
    const closeBanner = banners.show({
      icon: choice?.icon || action.icon,
      text: fillBanner(action.banner, actor, target, choice),
      left: { portrait: getPortrait(actor.id), color: actor.data.color },
      right: { portrait: getPortrait(target.id), color: target.data.color },
      onClose: () => task.cancel(),
    });
    task.onCleanup(closeBanner);
    await task.step(actor.wait(action.duration || duration));
  });
}
