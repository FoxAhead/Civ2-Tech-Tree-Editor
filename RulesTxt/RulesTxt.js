import { Tech } from "./Tech.js";
import { UnitType } from "./UnitType.js";
import { TerrainType } from "./TerrainType.js";

const COSMIC_FIELDS = [
  'roadMovementMultiplier', 'triremeLostChance', 'foodPerCitizen', 'foodBoxRows',
  'shieldBoxRows', 'settlersEatLowGov', 'settlersEatHighGov', 'unhappinessSizeChieftain',
  'riotFactor', 'aqueductLimit', 'sewerLimit', 'techParadigm', 'transformTime',
  'monarchyFreeSupport', 'communismFreeSupport', 'fundamFreeSupport',
  'communismPalaceDistance', 'fundamSciencePenalty', 'productionChangePenalty',
  'paradropRange', 'spaceshipMassThrust', 'fundamMaxScience'
];

// Configuration for all supported sections

const SECTION_CONFIGS = {
  '@COSMIC': {
    expectedLines: 22,
    fields: COSMIC_FIELDS,
    parser: (line) => parseInt(line.split(';')[0]) || 0,
    serializer: (part) => {
      return COSMIC_FIELDS.map((field, i) => {
        const val = part.data[field];
        const comment = part.lines[i]?.includes(';') ? `\t; ${part.lines[i].split(';')[1].trim()}` : '';
        return `${val}${comment}`;
      });
    }
  },
  '@COSMIC2': {
    parser: (line) => {
      const [key, ...values] = line.split(',').map(s => s.trim());
      return { key, values: values.map(v => parseInt(v) || 0) };
    },
    serializer: (part) => part.lines
  },
  '@CIVILIZE': {
    expectedLines: 100,
    parser: (line, i, rules) => rules.parseTech(line, i),
    serializer: (part, rules) => part.data.map((tech, i) => rules.serializeTech(tech, part.lines[i])),
  },
  '@UNITS': {
    expectedLines: 62,
    parser: (line, i, rules) => rules.parseUnit(line, i),
    serializer: (part, rules) => part.data.map(unit => rules.serializeUnit(unit)),
  },
  '@TERRAIN': {
    expectedLines: 33,
    parser: (line, i, rules) => rules.parseTerrain(line, i)
  },
  '@DIFFICULTY': {
    expectedLines: 6,
    parser: (line, i, rules) => rules.parseDifficulty(line, i)
  },
};

const techIds = [
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

const langEncodings = {
  'TXT': 'windows-1252', 'RUS': 'windows-1251', 'POL': 'windows-1250'
};

class Section {
  constructor(name = null, lines = [], rules) {
    this.name = name;
    this.lines = lines;
    this.rules = rules;
    this.data = null;
  }
  parse() { this.data = this.lines; }
  getLines(rules, forceSerialize = false) {
    const config = SECTION_CONFIGS[this.name];
    if (forceSerialize && config?.serializer && this.data) {
      return config.serializer(this, rules);
    }
    return this.lines;
  }
}

class SectionCosmic extends Section {
  fields = COSMIC_FIELDS;
  parse() {
    this.data = {};
    this.fields.forEach((field, i) => {
      if (this.lines[i] !== undefined) this.data[field] = parseInt(this.lines[i].split(';')[0]) || 0;
    });
  }
}

class SectionCivilize extends Section {
  parse() {
    this.data = this.lines.map((line, i) => this.parseTech(line, i))
  }
  parseTech(line, index) {
    const tokens = line.split(';')[0].split(',').map(t => t.trim());
    return new Tech({
      id: techIds[index], // techIds нужно импортировать или объявить в файле
      index: index,
      name: tokens[0],
      aiValue: tokens[1],
      modifier: tokens[2],
      preq1: tokens[3],
      preq2: tokens[4],
      epoch: tokens[5],
      category: tokens[6]
    });
  }
}

const SECTION_CLASSES = {
  '@COSMIC': SectionCosmic,
  '@COSMIC2': Section,
  '@CIVILIZE': SectionCivilize,
  '@UNITS': Section,
  '@TERRAIN': Section,
  '@DIFFICULTY': Section,
}

export class RulesTxt {
  #parts = [];
  #sectionsMap = new Map();
  #lineSeparator = '\r\n';
  #enabledSections = [];
  currentFileName = '';
  version = 'MGE';

  constructor(text, fileName = '', enabledSections = []) {
    this.currentFileName = fileName;
    this.#enabledSections = enabledSections.map(s => s.toUpperCase());
    const match = text.match(/\r\n|\r|\n/);
    this.#lineSeparator = match ? match[0] : '\r\n';
    this.#parseToParts(text);
  }

  /**
   * Factory method to load and initialize RulesTxt
   */
  static async loadFromFile(source, enabledSections = Object.keys(SECTION_CONFIGS)) {
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
    return new RulesTxt(text, name, enabledSections);
  }

  #parseToParts(text) {
    const allLines = text.split(/\r\n|\r|\n/);
    let currentSectionName = null;
    let currentLines = [];

    const flush = (nextSectionName = null) => {
      if (currentLines.length === 0 && !currentSectionName) return;
      const sectionClass = SECTION_CLASSES[currentSectionName] || Section;
      const part = new sectionClass(currentSectionName, currentLines);
      if (currentSectionName) {
        if (this.#sectionsMap.has(currentSectionName)) {
          throw new Error(`Duplicate section found: ${currentSectionName}`);
        }
        this.#sectionsMap.set(currentSectionName, part);
      }
      part.parse();
      this.#parts.push(part);
      currentLines = [];
      currentSectionName = nextSectionName;
    };

    for (let line of allLines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('@')) {
        flush(trimmed.toUpperCase());
      } else if (currentSectionName && (trimmed === '' || trimmed.startsWith(';'))) {
        flush(null);
        currentLines.push(line);
      } else {
        currentLines.push(line);
      }
    }
    flush();
    this.#enabledSections.forEach(section => {
      if (!this.#sectionsMap.has(section)) {
        throw new Error(`Required section ${section} not found in file ${this.currentFileName}`);
      }
    });

    this.#parts.forEach(p => { if (p.name) this.#sectionsMap.set(p.name, p); });
    if (this.#sectionsMap.has('@COSMIC2')) {
      this.version = 'ToTPP';
    } else if (this.#sectionsMap.has('@CIVILIZE2')) {
      this.version = 'ToT';
    }
    // this.#parts.forEach(part => part.#processSectionData(part));
  }

  #processSectionData(part) {
    if (!this.#enabledSections.includes(part.name)) return;
    const config = SECTION_CONFIGS[part.name];
    if (!config) return;
    const lines = part.lines;
    if (config.expectedLines && lines.length !== config.expectedLines) {
      throw new Error(`Section ${part.name}: Expected ${config.expectedLines} lines, found ${lines.length}`);
    }
    if (config.fields) {
      // Named fields
      part.data = {};
      config.fields.forEach((field, i) => {
        if (lines[i] !== undefined) part.data[field] = config.parser(lines[i], i, this);
      });
    } else {
      // List of objects
      const count = config.expectedLines || lines.length;
      part.data = lines.slice(0, count).map((line, i) => config.parser(line, i, this));
    }
  }

  // --- Parsers ---



  parseUnit(line, index) {
    const tokens = line.split(';')[0].split(',').map(t => t.trim());
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

  parseTerrain(line, index) {
    const tokens = line.split(';')[0].split(',').map(t => t.trim());
    return new TerrainType({
      name: tokens[0],
      movecost: parseInt(tokens[1]),
      defense: parseInt(tokens[2]),
      food: parseInt(tokens[3]),
      shields: parseInt(tokens[4]),
      trade: parseInt(tokens[5])
    });
  }

  parseDifficulty(line, index) {
    return line;
  }

  // --- Serializers ---

  serializeTech(tech, originalLine) {
    const namePart = (tech.name + ",").padEnd(20);
    const params = `${tech.aiValue.toString().padStart(1)},${tech.modifier.toString().padStart(2)},`;
    const preqs = `${tech.preq1.padStart(5)},${tech.preq2.padStart(4)},`;
    const end = `${tech.epoch.toString().padStart(2)},${tech.category.toString().padStart(2)}`;
    const comment = originalLine?.includes(';') ? `${originalLine.split(';')[1]}` : '';
    return `${namePart}${params}${preqs}${end}    ;${comment}`;
  }

  serializeUnit(unit) {
    const flags = unit.flags.toString(2); // Convert back to binary string
    return [
      unit.name, unit.until, unit.domain, unit.move, unit.rng,
      unit.att, unit.def, unit.hit, unit.firepwr, unit.cost,
      unit.hold, unit.role, unit.preq, flags
    ].join(', ');
  }

  // Геттеры для удобного доступа к данным
  get cosmic() { return this.#sectionsMap.get('@COSMIC')?.data; }
  get cosmic2() { return this.#sectionsMap.get('@COSMIC2')?.data; }
  get techs() { return this.#sectionsMap.get('@CIVILIZE')?.data || []; }
  get unitTypes() { return this.#sectionsMap.get('@UNITS')?.data || []; }
  get terrainTypes() { return this.#sectionsMap.get('@TERRAIN')?.data || []; }


  stringify(sectionsToUpdate = this.#enabledSections) {
    return this.#parts.map(p => {
      const shouldUpdate = sectionsToUpdate.includes(p.name);
      const content = p.getLines(this, shouldUpdate).join(this.#lineSeparator);
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
      // Если символ вне диапазона 0-255, заменяем на '?' (код 63)
      buffer[i] = charCode < 256 ? charCode : 63;
    }
    // const blob = new Blob([text], { type: 'text/plain' });
    const blob = new Blob([buffer], { type: 'text/plain;charset=windows-1252' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(link.href);
  }

}
