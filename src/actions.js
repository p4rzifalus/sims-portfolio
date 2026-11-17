// Выполнение действий из data.js как цепочки шагов:
// дойти → повернуться → анимация (сесть / помахать) → достать предмет → панель → завершение.
// Любой шаг можно прервать: крестиком в нижней панели, кликом по полу
// или новым действием. Тогда персонаж «прибирается»: панель закрывается,
// предмет убирается, он встаёт, место освобождается.
import { FACING_ANGLE, seatPoint } from './room.js';

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
