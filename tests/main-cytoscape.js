import { RulesTxt } from "./RulesTxt.js";

cytoscape.use(cytoscapeDagre);

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

  // 2. Инициализация Cytoscape
  const cy = cytoscape({
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
      name: 'dagre',
      rankDir: 'LR', // Слева направо
      nodeSep: 20,
      rankSep: 30,
      edgeSep: 5,
      fit: true,
      padding: 10
    }
    // layout: {
    //   name: 'dagre',
    //   rankDir: 'LR',
    //   spacingFactor: 0.7,        // 0.7 = на 30% компактнее, 1 = стандарт
    //   nodeDimensionsIncludeLabels: true, // Учитываем реальный размер узлов
    //   fit: true,
    //   padding: 10
    // }
    // layout: {
    //   name: 'dagre',
    //   rankDir: 'TB',
    //   nodeSep: 15,               // Минимальное расстояние между узлами
    //   rankSep: 20,               // Минимальное расстояние между рядами
    //   edgeSep: 3,                // Минимальное расстояние между ребрами
    //   spacingFactor: 0.6,        // Дополнительное сжатие
    //   nodeDimensionsIncludeLabels: true,
    //   fit: true,
    //   padding: 5
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
}