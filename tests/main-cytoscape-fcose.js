import { RulesTxt } from "./RulesTxt.js";

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
  const constraints = [];

  // Узлы
  techs.forEach(tech => {
    const colors = epochColors[tech.epoch] || { bg: '#97C2FC', border: '#2B7CE9' };
    elements.push({
      data: {
        id: tech.id,
        label: tech.name,
        bgColor: colors.bg,
        borderColor: colors.border,
        textColor: tech.enabled ? '#000' : '#fff',
      },
      group: "nodes",
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
              target: tech.id,
            },
            group: "edges",
          });
          constraints.push({
            left: pId, // Родитель слева
            right: tech.id,      // Текущая технология справа
            gap: 100             // Расстояние между ними
          });
        }
      });
    }
  });

  // // 1. Считаем степени узлов заранее (на основе массива elements)
  // const nodeDegree = {};
  // elements.filter(el => el.data.id && !el.data.source).forEach(n => {
  //   nodeDegree[n.data.id] = { in: 0, out: 0 };
  // });

  // elements.filter(el => el.data.source).forEach(e => {
  //   if (nodeDegree[e.data.source]) nodeDegree[e.data.source].out++;
  //   if (nodeDegree[e.data.target]) nodeDegree[e.data.target].in++;
  // });

  const fcoseOptions = {
    name: 'fcose',
    randomize: false,
    relativePlacementConstraint: constraints,
    fit: false,
    // step: 'all',

    quality: "proof",
    nodeDimensionsIncludeLabels: true,
    // nodeSeparation: 100,
    nodeRepulsion: 1000500,
  }
  // 2. Инициализация Cytoscape
  const cy = window.cy = cytoscape({
    container: document.getElementById('cy'),

    ready: function () {
      // let layoutUtilities = this.layoutUtilities({
      //   desiredAspectRatio: this.width() / this.height()
      // });
      // this.nodes().forEach(function (node) {
      //   let size = Math.random() * 120 + 30;
      //   node.css("width", size);
      //   node.css("height", size);
      // });
      this.layout(fcoseOptions).run();
    },

    elements: elements,
    // wheelSensitivity: 1.0,
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
          'padding': '25px',
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
          // 'curve-style': 'unbundled-bezier',// 'round-taxi',// 'bezier', // или 'taxi' для Г-образных линий
          'curve-style': 'round-taxi',
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
    // layout: {
    //   // name: 'fcose',
    //   name: 'grid',
    //   // animate: true,
    //   // animationEasing: 'ease-out',
    //   // fit: true,
    // }
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

  cy.on('free', 'node', (evt) => {
    const layout = cy.layout(fcoseOptions);
    layout.run();
  });

  document.getElementById("fcoseButton").addEventListener("click", function () {
    var layout = cy.layout(fcoseOptions);

    layout.run();
  });

}