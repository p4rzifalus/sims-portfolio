// Выполнение действий из data.js как цепочки шагов:
// дойти → повернуться → анимация (сесть / помахать) → панель → завершение.
// Любой шаг можно прервать: крестиком в нижней панели, кликом по полу
// или новым действием. Тогда персонаж «прибирается»: панель закрывается,
// он встаёт, место освобождается.
import { FACING_ANGLE, seatPoint } from './room.js';

// actor — кто выполняет; target — по кому кликнули (для действий с персонажем);
// item — предмет из data.js (для действий с предметом).
export function performAction({ actor, action, item, target, furniture, occupancy, panels, cameraYaw }) {
  const seatItem = action.sitOn ? furniture.find((f) => f.id === action.sitOn) : null;
  const busyKey = action.occupies ? action.sitOn || item?.id : null;

  return actor.runTask({ icon: action.icon, label: action.label }, async (task) => {
    // 1. Занять место (второй персонаж увидит «Занято»)
    if (busyKey) {
      const holder = occupancy.get(busyKey);
      if (holder && holder !== actor) throw new Error('место занято');
      occupancy.set(busyKey, actor);
      task.onCleanup(() => {
        if (occupancy.get(busyKey) === actor) occupancy.delete(busyKey);
      });
    }

    // 2. Дойти
    if (action.goTo) {
      task.onCleanup(() => {
        if (actor.isWalking) actor.stop();
      });
      await task.step(actor.walkToAsync(...action.goTo));
    }

    // 3. Повернуться (если куда — не сказано, а действие «на публику», — к зрителю)
    const yaw = action.face ? FACING_ANGLE[action.face] : action.who === 'target' ? cameraYaw : null;
    if (yaw !== null) await task.step(actor.faceTo(yaw));

    // 4. Анимация
    if (action.animation === 'sit' && seatItem) {
      task.onCleanup(() => actor.standUp()); // «встать» — при любом завершении
      await task.step(actor.sitDown(seatPoint(seatItem, action.goTo)));
    } else if (action.animation === 'wave') {
      task.onCleanup(() => actor.stopWave());
      await task.step(actor.wave());
    } else if (action.animation) {
      actor.play(action.animation);
      task.onCleanup(() => actor.play('idle'));
    }

    // 5. Панель
    if (action.panel) {
      if (action.panelDelay) await task.step(actor.wait(action.panelDelay));
      const owner = action.who === 'target' && target ? target : actor; // чьи данные показывать
      const panel = panels.open(action.panel, owner.data);
      task.onCleanup(() => panel.close());
      await task.step(panel.closed); // закрыли панель — действие закончено, дальше «уборка»
    }
  });
}
