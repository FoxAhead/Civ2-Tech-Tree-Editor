import { Tech } from "./Tech.js";
import { UnitType } from "./UnitType.js";
import { TerrainType } from "./TerrainType.js";

const cosmic = {
  roadMovementMultiplier: 0
};
const techs = [];
const unitTypes = [];
const terrainTypes = [];
const difficulty = [];
const sectionParsers = {
  '@COSMIC': parseSectionCosmic,
  '@CIVILIZE': parseSectionCivilize,
  '@UNITS': parseSectionUnits,
  '@TERRAIN': parseSectionTerrain,
  '@DIFFICULTY': parseSectionDifficulty,
};

export class RulesTxt {

  static currentFileName = '';

  static async loadFromFile(file) {
    const rulesTxt = await readTextFile(file);
    parseRulesTxt(rulesTxt);
  }

  static getCosmic() {
    return cosmic;
  }

  static getTechs() {
    return techs;
  }

  static getUnitType(type) {
    return unitTypes[type];
  }

  static getTerrainType(type) {
    return terrainTypes[type];
  }

  static getStrengthRadios() {
    const rmm = cosmic.roadMovementMultiplier;
    let radios = [];
    for (let index = rmm; index > 0; index--) {
      radios.push({
        text: (index == rmm) ? 'Full strength' : `${index}/${rmm}`,
        value: index,
        checked: (index == rmm)
      });
    }
    return radios;
  }

  static getUnitTypesOptions() {
    let options = [];
    for (const [index, unit] of unitTypes.entries()) {
      options.push({
        text: `${unit.name} - ${unit.att}a/${unit.def}d/${unit.hit}h/${unit.firepwr}f`,
        value: index,
      });
    }
    return options;
  }
  static getTerrainTypesOptions() {
    let options = [];
    for (const [index, terrain] of terrainTypes.entries()) {
      options.push({
        text: `${terrain.name} - ${terrain.defense}d (${terrain.defense * 50}%)`,
        value: index,
      });
    }
    return options;
  }
}

const langEncodings = {
  'TXT': 'windows-1252',
  'FRE': 'windows-1252',
  'GER': 'windows-1252',
  'ITA': 'windows-1252',
  'SPA': 'windows-1252',
  'RUS': 'windows-1251',
  'POL': 'windows-1250'
};

function decodeBuffer(buffer, fileName) {
  const ext = fileName.split('.').pop().toUpperCase();
  const encoding = langEncodings[ext] || 'windows-1252';
  const decoder = new TextDecoder(encoding);
  return decoder.decode(buffer);
}

export async function readTextFile(source) {
  if (typeof source === 'string') {
    const response = await fetch(source);
    const buffer = await response.arrayBuffer();
    RulesTxt.currentFileName = source;
    return decodeBuffer(buffer, source);
  }
  if (source instanceof Blob) {
    const buffer = await source.arrayBuffer();
    RulesTxt.currentFileName = source.name;
    return decodeBuffer(buffer, source.name || '');
  }
  throw new Error('Unsupported source type');
}

export function saveTextFile() {

}

/**
 * @param {string} text 
 */
function parseRulesTxt(text) {
  const lines = text.split(/\r?\n/);
  techs.length = 0;
  unitTypes.length = 0;
  terrainTypes.length = 0;
  difficulty.length = 0;
  let currentSection = '';
  let index = 0;
  for (let line of lines) {
    if (currentSection) {
      if (!line || line.startsWith(';')) {
        currentSection = ''
      } else {
        if (sectionParsers[currentSection] != undefined) { sectionParsers[currentSection](line, index) };
        index++;
      }
    } else {
      if (line.startsWith('@')) {
        currentSection = line.toUpperCase();
        index = 0;
      }
    }
    continue;
  }
}

/**
 * 
 * @param {string} line 
 * @param {number} index 
 */
function parseSectionCosmic(line, index) {
  let tokens = line.split(';').map(item => item.trim());
  switch (index) {
    case 0:
      cosmic.roadMovementMultiplier = tokens[0];
      break;
  }
}

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
/**
 * @param {string} line 
 * @param {line} index 
 */
function parseSectionCivilize(line, index) {
  let tokens1 = line.split(';').map(item => item.trim());
  let tokens = tokens1[0].split(',').map(item => item.trim());
  const techId = techIds[index];
  techs.push(
    new Tech({
      id: techId,
      index: index,
      name: tokens[0],
      aiValue: tokens[1],
      modifier: tokens[2],
      preq1: tokens[3],
      preq2: tokens[4],
      epoch: tokens[5],
      category: tokens[6],
      // enabled: tokens[3] != 'no'
    })
  )
}

function parseSectionUnits(line, index) {
  let tokens = line.split(',').map(item => item.trim());
  if (tokens[12] != 'no') {
    unitTypes.push(
      new UnitType({
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
        flags: parseInt(tokens[13], 2),
      })
    );
  }
}

function parseSectionTerrain(line, index) {
  let tokens = line.split(',').map(item => item.trim());
  terrainTypes.push(
    new TerrainType({
      name: tokens[0],
      movecost: parseInt(tokens[1]),
      defense: parseInt(tokens[2]),
      food: parseInt(tokens[3]),
      shields: parseInt(tokens[4]),
      trade: parseInt(tokens[5]),
    })
  );
}

function parseSectionDifficulty(line, index) {
  difficulty.push(line);
}