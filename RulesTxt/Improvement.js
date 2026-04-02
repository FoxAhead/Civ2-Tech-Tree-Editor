export class Improvement {
  constructor({ name, cost, upkeep, preq } = {}) {
    this.name = name;
    this.cost = cost;
    this.upkeep = upkeep;
    this.preq = preq;
  }
}
