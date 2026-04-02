import { Tech } from "./Tech.js";
import { UnitType } from "./UnitType.js";
import { TerrainType } from "./TerrainType.js";
import { Improvement } from "./Improvement.js";

const langEncodings = {
  'TXT': 'windows-1252', 'RUS': 'windows-1251', 'POL': 'windows-1250'
};

class Section {
  constructor(name = null, lines = [], rules) {
    this.name = name;
    this.lines = lines;
    this.rules = rules;
    this.data = null;
    this.ready = false;
    this.doParse = false;
  }
  validateAndParse() {
    if (this.ready) return;
    this.preValidate();
    if (this.doParse)
      this.parse()
    else
      this.data = this.lines;
    this.postValidate?.();
    this.ready = true;
  }
  preValidate() {
    const expectedLines = this.expectedLines?.[this.rules.version] ?? this.expectedLines?.default;
    if (expectedLines && this.lines.length !== expectedLines) {
      throw new Error(`Section ${this.name}: Expected ${expectedLines} lines, found ${this.lines.length}`);
    }
  }
  parse() {
    this.data = this.lines.map((line, i) => {
      const tokens = line.split(';')[0].split(',').map(t => t.trim());
      return this.parseLine(line, i, tokens)
    })
  }
  parseLine(line, index, tokens) {
    return line;
  }
  getLines(doSerialize = false) {
    this.preSerialize?.();
    if (doSerialize && typeof this.serializeLine === 'function' && this.data) {
      return this.data.map((item, i) => this.serializeLine(item, this.lines[i]))
    } else {
      return this.lines;
    }
  }
}

class SectionCosmic extends Section {
  static fields = [
    'roadMovementMultiplier', 'triremeLostChance', 'foodPerCitizen', 'foodBoxRows',
    'shieldBoxRows', 'settlersEatLowGov', 'settlersEatHighGov', 'unhappinessSizeChieftain',
    'riotFactor', 'aqueductLimit', 'sewerLimit', 'techParadigm', 'transformTime',
    'monarchyFreeSupport', 'communismFreeSupport', 'fundamFreeSupport',
    'communismPalaceDistance', 'fundamSciencePenalty', 'productionChangePenalty',
    'paradropRange', 'spaceshipMassThrust', 'fundamMaxScience',
    // ToT
    'scoreCitizenValue', 'scoreWonderValue', 'scoreSpaceshipMultiplier', 'scorePollutionPenalty',
    'scorePeaceKeepBonus', 'scoreFutureTechValue', 'scoreBetrayalPenalty', 'scoreUnitLossPenalty',
    'goodieHutMask', 'helicoptersPickUpHuts'
  ];
  expectedLines = { MGE: 22, ToT: 32, ToTPP: 32 };
  parse() {
    this.data = {};
    this.lines.forEach((line, i) => {
      const field = SectionCosmic.fields[i];
      if (field !== undefined) this.data[field] = parseInt(line.split(';')[0]) || 0;
    });
  }
}

class SectionCosmic2 extends Section {
  parse() {
    this.data = Object.fromEntries(
      this.lines
        .map(line => this.parseLine(line))
        .filter(item => item !== null)
        .map(item => [item.key, item.value])
    );
  }
  parseLine(line) {
    const cleanLine = line.split(';')[0].trim();
    if (!cleanLine) return null;
    const [key, ...rawValues] = cleanLine.split(',').map(s => s.trim());
    const parsedValues = rawValues.map(v => (v !== "" && !isNaN(v) ? Number(v) : v));
    return {
      key,
      value: parsedValues.length > 1 ? parsedValues : parsedValues[0]
    };
  }
  postValidate() {
    const n = this.data.NumberOfTechs;
    if (n < 100 || n > 253) throw new Error(`ToTPP parametr NumberOfTechs is out of range: ${n}`);
  }
}

class SectionCivilize extends Section {
  static techIds = [
    'AFl', 'Alp', 'Amp', 'Ast', 'Ato', 'Aut', 'Ban', 'Bri', 'Bro', 'Cer',
    'Che', 'Chi', 'CoL', 'CA', 'Cmb', 'Cmn', 'Cmp', 'Csc', 'Cst', 'Cor',
    'Cur', 'Dem', 'Eco', 'E1', 'E2', 'Eng', 'Env', 'Esp', 'Exp', 'Feu',
    'Fli', 'Fun', 'FP', 'Gen', 'Gue', 'Gun', 'Hor', 'Ind', 'Inv', 'Iro',
    'Lab', 'Las', 'Ldr', 'Lit', 'Too', 'Mag', 'Map', 'Mas', 'MP', 'Mat',
    'Med', 'Met', 'Min', 'Mob', 'Mon', 'MT', 'Mys', 'Nav', 'NF', 'NP',
    'Phi', 'Phy', 'Pla', 'Plu', 'PT', 'Pot', 'Rad', 'RR', 'Rec', 'Ref',
    'Rfg', 'Rep', 'Rob', 'Roc', 'San', 'Sea', 'SFl', 'Sth', 'SE', 'Stl',
    'Sup', 'Tac', 'The', 'ToG', 'Tra', 'Uni', 'War', 'Whe', 'Wri', 'FT',
    'U1', 'U2', 'U3', 'X1', 'X2', 'X3', 'X4', 'X5', 'X6', 'X7'];
  static {
    const MAX_TOTAL = 253;
    const currentLength = this.techIds.length;
    for (let i = currentLength; i < MAX_TOTAL; i++) {
      this.techIds.push('X' + i.toString(16).toUpperCase());
    }
  }
  static fields = ['<name', '>aiValue', '>modifier', '<preq1', '<preq2', '>epoch', '>category'];
  get expectedLines() {
    return {
      MGE: 100,
      ToT: 100,
      ToTPP: this.rules.cosmic2?.data?.NumberOfTechs ?? 100
    };
  }
  parseLine(line, index, tokens) {
    return new Tech({
      id: SectionCivilize.techIds[index],
      index: index,
      name: tokens[0],
      aiValue: tokens[1],
      modifier: tokens[2],
      preq1: tokens[3],
      preq2: tokens[4],
      epoch: tokens[5],
      category: tokens[6],
      group: this.rules.civilize2?.data[index]?.group,
    });
  }
  preSerialize() {
    this.pads = {};
    SectionCivilize.fields.forEach(field => {
      this.pads[field] = Math.max(...this.data.map(tech => tech[field.slice(1)].toString().length))
    });
  }
  serializeLine(tech, originalLine) {
    const parts = SectionCivilize.fields.map((field, index) => {
      const isLast = index === SectionCivilize.fields.length - 1;
      const align = field[0] === '>' ? 'padStart' : 'padEnd';
      const key = field.slice(1);
      const val = String(tech[key] ?? '') + (isLast ? '' : ',');
      return val[align](isLast ? this.pads[field] : this.pads[field] + 1);
    });
    const comment = originalLine?.includes(';') ? `${originalLine.split(';')[1]}` : '';
    return `${parts.join(' ')}    ;${comment}`;
  }
}

class SectionCivilize2 extends Section {
  get expectedLines() {
    return {
      MGE: 100,
      ToT: 100,
      ToTPP: this.rules.cosmic2?.data?.NumberOfTechs ?? 100
    };
  }
  parseLine(line, index, tokens) {
    return {
      id: SectionCivilize.techIds[index],
      index: index,
      group: tokens[0],
    };
  }
  serializeLine(item, originalLine) {
    const group = this.rules.civilize.data[item.index].group;
    const comment = originalLine?.includes(';') ? `${originalLine.split(';')[1]}` : '';
    return `${group}\t\t;${comment}`;
  }
}

class SectionImprove extends Section {
  parseLine(line, index, tokens) {
    return new Improvement({
      name: tokens[0],
      cost: tokens[1],
      upkeep: tokens[2],
      preq: tokens[3],
    });
  }
}

class SectionEndWonder extends Section {
  parseLine(line, index, tokens) {
    return {
      techId: tokens[0],
    };
  }
}

class SectionUnits extends Section {
  parseLine(line, index, tokens) {
    return new UnitType({
      name: tokens[0],
      until: tokens[1],
      domain: parseInt(tokens[2]),
      move: parseInt(tokens[3]),
      rng: parseInt(tokens[4]),
      att: parseInt(tokens[5]),
      def: parseInt(tokens[6]),
      hit: parseInt(tokens[7]),
      firepwr: parseInt(tokens[8]),
      cost: parseInt(tokens[9]),
      hold: parseInt(tokens[10]),
      role: parseInt(tokens[11]),
      preq: tokens[12],
      flags: parseInt(tokens[13], 2)
    });
  }
  serializeLine(unit) {
    const flags = unit.flags.toString(2); // Convert back to binary string
    return [
      unit.name, unit.until, unit.domain, unit.move, unit.rng,
      unit.att, unit.def, unit.hit, unit.firepwr, unit.cost,
      unit.hold, unit.role, unit.preq, flags
    ].join(', ');
  }
}

class SectionTerrain extends Section {
  parseLine(line, index, tokens) {
    return new TerrainType({
      name: tokens[0],
      movecost: parseInt(tokens[1]),
      defense: parseInt(tokens[2]),
      food: parseInt(tokens[3]),
      shields: parseInt(tokens[4]),
      trade: parseInt(tokens[5])
    });
  }
}

class SectionDifficulty extends Section {
  expectedLines = { default: 6 };
}

const SECTION_CLASSES = {
  '@COSMIC': SectionCosmic,
  '@COSMIC2': SectionCosmic2,
  '@CIVILIZE': SectionCivilize,
  '@CIVILIZE2': SectionCivilize2,
  '@IMPROVE': SectionImprove,
  '@ENDWONDER': SectionEndWonder,
  '@UNITS': SectionUnits,
  '@TERRAIN': SectionTerrain,
  '@DIFFICULTY': SectionDifficulty,
}

export class RulesTxt {
  #parts = [];
  #sectionsMap = new Map();
  #lineSeparator = '\r\n';
  #requiredSections = new Set();
  currentFileName = '';
  version = 'MGE';

  constructor(text, fileName = '', requiredSections = []) {
    this.currentFileName = fileName;
    this.#requiredSections = new Set(requiredSections);
    const match = text.match(/\r\n|\r|\n/);
    this.#lineSeparator = match ? match[0] : '\r\n';
    this.#parseToParts(text);
  }

  /**
   * Factory method to load and initialize RulesTxt
   */
  static async loadFromFile(source, requiredSections = Object.keys(SECTION_CLASSES)) {
    let buffer, name;
    if (typeof source === 'string') {
      const response = await fetch(source);
      buffer = await response.arrayBuffer();
      name = source;
    } else {
      buffer = await source.arrayBuffer();
      name = source.name || '';
    }
    const ext = name.split('.').pop().toUpperCase();
    const encoding = langEncodings[ext] || 'windows-1252';
    const text = new TextDecoder(encoding).decode(buffer);
    return new RulesTxt(text, name, requiredSections);
  }

  #parseToParts(text) {
    const allLines = text.split(/\r\n|\r|\n/);
    let currentSectionName = null;
    let currentLines = [];

    const flush = (nextSectionName = null) => {
      if (currentLines.length === 0 && !currentSectionName) return;
      const sectionClass = SECTION_CLASSES[currentSectionName] || Section;
      const part = new sectionClass(currentSectionName, currentLines, this);
      if (currentSectionName) {
        if (this.#sectionsMap.has(currentSectionName)) {
          throw new Error(`Duplicate section found: ${currentSectionName}`);
        }
        this.#sectionsMap.set(currentSectionName, part);
      }
      this.#parts.push(part);
      currentLines = [];
      currentSectionName = nextSectionName;
    };

    for (let line of allLines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('@')) {
        flush(trimmed.toUpperCase());
      } else if (currentSectionName && (trimmed === '' || trimmed.startsWith(';') && currentSectionName !== '@COSMIC2')) {
        flush(null);
        currentLines.push(line);
      } else {
        currentLines.push(line);
      }
    }
    flush();

    // Detect game version
    if (this.#sectionsMap.has('@COSMIC2')) {
      this.version = 'ToTPP';
    } else if (this.#sectionsMap.has('@CIVILIZE2')) {
      this.version = 'ToT';
    }
    // Add dependent sections
    if (this.#requiredSections.has('@CIVILIZE')) {
      if (this.version.startsWith('ToT')) this.#requiredSections.add('@CIVILIZE2');
      if (this.version === 'ToTPP') this.#requiredSections.add('@COSMIC2');
    }
    // Check sections existence and mark for parsing
    this.#requiredSections.forEach(sectionName => {
      const section = this.#sectionsMap.get(sectionName);
      if (!section) {
        throw new Error(`Required section ${sectionName} not found in file ${this.currentFileName}`);
      }
      section.doParse = true;
    });

    // Validate and Parse
    const priorityNames = ['@COSMIC2', '@CIVILIZE2'];
    priorityNames.forEach(name => this.#sectionsMap.get(name)?.validateAndParse());
    this.#parts.forEach(part => part.validateAndParse());
  }

  // Геттеры для удобного доступа к данным
  get cosmic() { return this.#sectionsMap.get('@COSMIC') }
  get cosmic2() { return this.#sectionsMap.get('@COSMIC2') }
  get civilize() { return this.#sectionsMap.get('@CIVILIZE') }
  get civilize2() { return this.#sectionsMap.get('@CIVILIZE2') }
  get improve() { return this.#sectionsMap.get('@IMPROVE') }
  get endWonder() { return this.#sectionsMap.get('@ENDWONDER') }
  get units() { return this.#sectionsMap.get('@UNITS') }
  get terrainTypes() { return this.#sectionsMap.get('@TERRAIN') }
  get difficulty() { return this.#sectionsMap.get('@DIFFICULTY') }

  stringify(sectionsToUpdate = this.#requiredSections) {
    return this.#parts.map(p => {
      const shouldUpdate = sectionsToUpdate.includes(p.name);
      const content = p.getLines(shouldUpdate).join(this.#lineSeparator);
      return p.name ? `${p.name}${this.#lineSeparator}${content}` : content;
    }).join(this.#lineSeparator);
  }

  /**
   * Triggers a file download in the browser
   */
  saveToFile(fileName = 'RULES.TXT', sectionsToUpdate = []) {
    const text = this.stringify(sectionsToUpdate);
    const buffer = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      buffer[i] = charCode < 256 ? charCode : 63;
    }
    const blob = new Blob([buffer], { type: 'text/plain;charset=windows-1252' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(link.href);
  }

}
