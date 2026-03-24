export class UnitType {
  constructor({ name, until, domain, move, rng, att, def, hit, firepwr, cost, hold, role, preq, flags } = {}) {
    this.name = name;
    this.until = until;
    this.domain = domain;
    this.move = move;
    this.rng = rng;
    this.att = att;
    this.def = def;
    this.hit = hit;
    this.firepwr = firepwr;
    this.cost = cost;
    this.hold = hold;
    this.role = role;
    this.preq = preq;
    this.flags = flags;
  }
  submarineAdvantagesDisadvantages() {
    return (this.flags & 0b000000000001000) != 0;
  }
  canAttackAirUnitsFighter() {
    return (this.flags & 0b000000000010000) != 0;
  }
  negatesCityWallsHowitzer() {
    return (this.flags & 0b000000001000000) != 0;
  }
  canMakeParadrops() {
    return (this.flags & 0b000000100000000) != 0;
  }
  x2OnDefenseVersusHorsePikemen() {
    return (this.flags & 0b000010000000000) != 0;
  }
  destroyedAfterAttackingMissiles() {
    return (this.flags & 0b001000000000000) != 0;
  }
  x2OnDefenseVersusAirAEGIS() {
    return (this.flags & 0b010000000000000) != 0;
  }
}
