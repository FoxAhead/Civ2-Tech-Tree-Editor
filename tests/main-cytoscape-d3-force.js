import { RulesTxt } from "./RulesTxt.js";

// cytoscape.use(d3Force);

window.onload = main;

async function main() {
  await RulesTxt.loadFromFile('RULES.TXT');

  const techs = RulesTxt.getTechs()

  const epochColors = {
    0: { bg: '#D2E5FF', border: '#2B7CE9' }, // Древность
    1: { bg: '#FFFF00', border: '#E6E600' }, // Средневековье
    2: { bg: '#FB7E81', border: '#FA0A10' }, // Ренессанс
    3: { bg: '#C2FABC', border: '#399E05' }  // Промышленность
  };
  // 1. Формируем элементы для Cytoscape
  const elements = [];

  // Узлы
  techs.forEach(tech => {
    const colors = epochColors[tech.epoch] || { bg: '#97C2FC', border: '#2B7CE9' };
    elements.push({
      data: {
        id: tech.id,
        label: tech.name,
        bgColor: colors.bg,
        borderColor: colors.border,
        textColor: tech.enabled ? '#000' : '#fff'
      }
    });
    const nullValues = ['no', 'nil'];
    // Добавляем ребра с проверкой
    if (tech.preq && Array.isArray(tech.preq)) {
      tech.preq.forEach(pId => {
        // Проверяем: pId не должен быть пустым или содержать "no"/"nil"
        if (pId && !nullValues.includes(pId.toString().toLowerCase().trim())) {
          elements.push({
            data: {
              id: `${pId}-${tech.id}`,
              source: pId,
              target: tech.id
            }
          });
        }
      });
    }
  });

  // 1. Считаем степени узлов заранее (на основе массива elements)
  const nodeDegree = {};
  elements.filter(el => el.data.id && !el.data.source).forEach(n => {
    nodeDegree[n.data.id] = { in: 0, out: 0 };
  });

  elements.filter(el => el.data.source).forEach(e => {
    if (nodeDegree[e.data.source]) nodeDegree[e.data.source].out++;
    if (nodeDegree[e.data.target]) nodeDegree[e.data.target].in++;
  });

  // 2. Инициализация Cytoscape
  const cy = window.cy = cytoscape({
    container: document.getElementById('mytree'),
    elements: elements,
    style: [
      {
        selector: 'node',
        style: {
          'label': 'data(label)',
          'shape': 'round-rectangle',
          'background-color': 'data(bgColor)',
          'border-width': 2,
          'border-color': 'data(borderColor)',
          'color': 'data(textColor)',
          'text-valign': 'center',
          'text-halign': 'center',
          'width': 'label',
          'height': 'label',
          'padding': '5px',
          'font-size': '12px'
        }
      },
      {
        selector: 'edge',
        style: {
          'width': 2,
          'line-color': '#848484',
          'target-arrow-color': '#848484',
          'target-arrow-shape': 'triangle',
          'curve-style': 'bezier', // или 'taxi' для Г-образных линий
          'taxi-direction': 'horizontal'
        }
      },
      // Стили при наведении (Hover)
      {
        selector: 'node.highlight',
        style: {
          'border-width': 4,
          'border-color': '#ffff00'
        }
      },
      {
        selector: 'edge.highlight',
        style: {
          'width': 4,
          'line-color': '#2B7CE9',
          'target-arrow-color': '#2B7CE9'
        }
      }
    ],
    layout: {
      name: 'd3-force',
      animate: true,
      fixedAfterDragging: false,
      linkId: function id(d) {
        return d.id;
      },
      linkDistance: 80,
      manyBodyStrength: -300,
      ready: function () { },
      stop: function () { },
      randomize: false,
      infinite: true,
      // Кастомные силы через d3X и d3Y
      d3X: (d) => {
        const deg = nodeDegree[d.id] || { in: 0, out: 0 };
        const weight = deg.in - deg.out;

        // d.epoch берем из исходных данных (в cytoscape-d3-force d — это объект с данными узла)
        const epoch = d.epoch || 0;
        const baseStep = epoch * 500 + 100;
        const fineTune = weight * 150;

        return baseStep + fineTune;
      },
      // Сила притяжения (strength) для X
      xStrength: 1,

      // d3Y: (d) => {
      //   const deg = nodeDegree[d.id] || { in: 0, out: 0 };
      //   const total = deg.in + deg.out;
      //   const height = window.innerHeight; // Или фиксированная высота контейнера

      //   if (total <= 2) {
      //     // Используем индекс из d3 или id для детерминированного разброса
      //     return (parseInt(d.id) % 2 === 0) ? height * 0.2 : height * 0.8;
      //   }
      //   return height / 2;
      // },
      // // Динамическая сила для Y
      // yStrength: (d) => {
      //   const deg = nodeDegree[d.id] || { in: 0, out: 0 };
      //   const total = deg.in + deg.out;
      //   return Math.min(0.5, total * 0.05);
      // },
    }
  });

  // Подсветка всех ребер узла (входящие и исходящие)
  cy.on('mouseover', 'node', (e) => {
    const node = e.target;

    // Получаем ВСЕ ребра, связанные с узлом
    const allEdges = node.connectedEdges();

    node.addClass('highlight');
    allEdges.addClass('highlight');
  });

  // Снятие подсветки
  cy.on('mouseout', 'node', (e) => {
    const node = e.target;
    const allEdges = node.connectedEdges();

    node.removeClass('highlight');
    allEdges.removeClass('highlight');
  });

  cy.on('mouseout', 'node', (e) => {
    const node = e.target;
    cy.elements().removeClass('highlight');
  });
}