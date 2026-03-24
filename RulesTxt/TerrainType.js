export class TerrainType {
  constructor({ name, movecost, defense, food, shields, trade } = {}) {
    this.name = name;
    this.movecost = movecost;
    this.defense = defense;
    this.food = food;
    this.shields = shields;
    this.trade = trade;
  }
}