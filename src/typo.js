// Типографика: короткие слова не остаются в конце строки.
// После предлога, союза или частицы обычный пробел заменяется неразрывным —
// слово переносится на новую строку вместе со следующим. Тире не начинает строку.

const NBSP = ' ';

// Все слова из 1–2 русских букв (в, к, с, у, о, и, а, на, по, за, из, от, до, не…)
// и трёхбуквенные служебные слова.
const SHORT = '[а-яё]{1,2}|без|для|под|над|при|про|обо|изо|ото|или|что|как|чем|где';
const SHORT_WORD = new RegExp(`(?<=^|[\\s\\u00A0(«„"'])(${SHORT})\\s+(?=\\S)`, 'giu');

export function typo(text) {
  if (typeof text !== 'string' || !text.includes(' ')) return text;
  return text.replace(SHORT_WORD, `$1${NBSP}`).replace(/\s+([—–])/g, `${NBSP}$1`);
}

// Пройти по данным из data.js и обработать каждую строку.
// Ссылки и имена файлов не трогаем.
const SKIP_KEYS = new Set(['url', 'image', 'model']);

export function typoDeep(value) {
  if (typeof value === 'string') return typo(value);
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) value[i] = typoDeep(value[i]);
  } else if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) {
      if (!SKIP_KEYS.has(key)) value[key] = typoDeep(value[key]);
    }
  }
  return value;
}
