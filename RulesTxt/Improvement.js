export class Improvement {
  constructor({ index, name, cost, upkeep, preq } = {}) {
    this.index = index;
    this.name = name;
    this.cost = cost;
    this.upkeep = upkeep;
    this.preq = preq;
  }
}
