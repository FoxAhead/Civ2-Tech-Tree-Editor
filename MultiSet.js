export default class MultiSet {
  constructor() {
    this._map = new Map(); // Храним: edgeId -> количество
    this.size = 0;         // Общая сумма всех связей
  }
  *[Symbol.iterator]() {
    yield* this._map.keys();
  }
  add(value) {
    const count = this._map.get(value) || 0;
    this._map.set(value, count + 1);
    this.size++;
  }
  delete(value) {
    const count = this._map.get(value);
    if (!count) return;
    if (count === 1) {
      this._map.delete(value);
    } else {
      this._map.set(value, count - 1);
    }
    this.size--;
  }
  has(value) {
    return this._map.has(value);
  }
}
