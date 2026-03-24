export class Tech {
  constructor({ id, index, aiValue, modifier, name, preq1, preq2, epoch, category } = {}) {
    this.id = id;
    this.index = index;
    this.name = name;
    this.aiValue = aiValue;
    this.modifier = modifier;
    this.preq1 = preq1;
    this.preq2 = preq2;
    this.epoch = epoch;
    this.category = category;
  }
  set name(value) {
    this._name = value ? value.substring(0, 49) : "";;
  }
  get name() {
    return this._name;
  }
  get preq() {
    return [this.preq1, this.preq2];
  }
  setPreq(index, value) {
    this['preq' + (index + 1)] = value;
  }
  getFreePreqSlot() {
    const emptyValues = ['no', 'nil'];
    return this.preq.findIndex(val => emptyValues.includes(val));
  }
  get enabled() {
    return !this.preq.includes('no');
    // return this.preq1 !== 'no';
  }
  serialize() {
    const namePart = (this.name + ",").padEnd(20);
    const params = `${this.aiValue.toString().padStart(2)},${this.modifier.toString().padStart(2)},`;
    const preqs = ` ${this.preq1.padStart(3)}, ${this.preq2.padStart(3)},`;
    const end = ` ${this.epoch}, ${this.category}`;
    return `${namePart} ${params} ${preqs} ${end}    ; ${this.id}`;
  }
}