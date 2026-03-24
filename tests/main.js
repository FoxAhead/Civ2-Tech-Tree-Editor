import { RulesTxt } from "./RulesTxt.js";

window.onload = main;

async function main() {
  await RulesTxt.loadFromFile('RULES.TXT');

  const techs = RulesTxt.getTechs()
  const stats = countConnections(techs);
  const allAncestorsMap = calculateAllAncestors(techs);
  const denseLevels = calculateDenseLevels(techs);
  Normalization(techs);

  // const epochColors = {
  //   0: { bg: 'hsl(210, 75%, 85%)', border: 'hsl(210, 80%, 54%)' }, // Ancient
  //   1: { bg: 'hsl(60, 75%, 85%)', border: 'hsl(60, 100%, 45%)' },  // Renaissance
  //   2: { bg: 'hsl(0, 75%, 85%)', border: 'hsl(0, 96%, 51%)' },      // Industrial Revolution
  //   3: { bg: 'hsl(114, 75%, 85%)', border: 'hsl(92, 94%, 32%)' }    // Modern
  // };
  const selColor = `#36F`

  function generateEpochColors(count) {
    const colors = {};
    for (let i = 0; i < count; i++) {
      // Рассчитываем Hue (оттенок)
      const hue = Math.floor(i * (360 / count));
      const background = `hsl(${hue}, 80%, 90%)`;
      colors[i] = {
        background: background,
        border: `hsl(${hue}, 70%, 40%)`,
        hover: { border: selColor, background: background },
        highlight: { border: selColor, background: background },
      };
    }
    return colors;
  }
  const epochColors = generateEpochColors(6);

  // Формируем узлы (Nodes)
  const nodes = new vis.DataSet(
    techs
      .filter(tech => {
        return stats.get(tech.id).total > 0;
      })
      .map(tech => {
        const colors = epochColors[tech.epoch] || { bg: '#97C2FC', border: '#2B7CE9' };
        const stat = stats.get(tech.id)
        return {
          id: tech.id,
          label: '<b>' + tech.id + '</b>' + '\n' + tech.name,
          // level: allAncestorsMap[tech.id].size,
          // level: tech.level,
          // Условие: если enabled == false, то красный
          color: {
            background: colors.background,
            border: colors.border,
            hover: colors.hover,
            highlight: colors.highlight,
          },
          font: {
            multi: true,
            // color: tech.enabled ? '#000' : '#fff'
          },
          shape: 'box',
          margin: 5,
          physics: (stat.total != 0)
        }
      }));

  // Формируем связи (Edges)
  const edgesArray = [];
  techs.forEach(tech => {
    tech.preq.forEach(pId => {
      edgesArray.push({
        from: pId,
        to: tech.id,
        color: {
          hover: selColor,
          highlight: selColor,
        }
      });
    });
  });
  const edges = new vis.DataSet(edgesArray);

  // Сохраняем стандартные настройки, чтобы знать, к чему возвращаться
  const normalPhysics = {
    centralGravity: 0.0,
    springLength: 50,
    springConstant: 0.01,
    nodeDistance: 60,
    damping: 0.5,
    avoidOverlap: 1
  };

  const weakPhysics = {
    centralGravity: 0.0,
    springLength: 0,
    springConstant: 0.0,
    nodeDistance: 0,
    damping: 0.09,
    avoidOverlap: 0
  };

  // Настройки отображения
  const container = document.getElementById('mytree');
  const data = { nodes: nodes, edges: edges };
  const options = {
    // configure: { enabled: true },
    edges: {
      arrows: { to: { enabled: true, scaleFactor: 1 } },
      smooth: { type: 'cubicBezier', forceDirection: 'horizontal', roundness: 0.7 }
    },
    nodes: {
      labelHighlightBold: false,
    },
    layout: {
      hierarchical: {
        direction: "LR",
        sortMethod: "directed",
        shakeTowards: "roots",
        nodeSpacing: 100,
        levelSeparation: 150,
        // blockShifting: false,
        // edgeMinimization: false,
        // parentCentralization: false,
      }
    },
    interaction: {
      hover: true,
      // hoverConnectedEdges: false, // Отключаем стандартную подсветку, сделаем свою
      // selectConnectedEdges: true
    },
    manipulation: {
      enabled: true,
      initiallyActive: true,
      addNode: false,
      deleteNode: false,
      // addEdge: function (edgeData, callback) {
      //   edgeData.color = {
      //     hover: selColor,
      //     highlight: selColor,
      //   };
      //   callback(edgeData);
      // },
    },
    physics: {
      enabled: true, // Выключаем физику для жесткой иерархии
      hierarchicalRepulsion: normalPhysics,
    },
  };

  // Инициализация
  const network = new vis.Network(container, data, options);

  // network.on("stabilizationIterationsDone", function () {
  //   network.setOptions({ physics: false });
  // });

  // // 2. Обработчик наведения мыши
  // network.on("hoverNode", function (params) {
  //   const nodeId = params.node;

  //   // Получаем все ребра, которые входят в этот узел (родительские связи)
  //   const connectedEdges = network.getConnectedEdges(nodeId);
  //   const parentEdges = connectedEdges.filter(edgeId => {
  //     const edge = edges.get(edgeId);
  //     return edge.to === nodeId; // Оставляем только те, что ведут К нам
  //   });

  //   // Подсвечиваем узел и родительские ребра
  //   network.setSelection({
  //     nodes: [nodeId],
  //     edges: parentEdges
  //   }, { unselectAll: true });
  // });

  // // 3. Снимаем выделение, когда уводим мышь
  // network.on("blurNode", function (params) {
  //   network.unselectAll();
  // });

  // Событие начала перетаскивания
  network.on("dragStart", function () {
    console.log('dragStart');
    network.setOptions({
      physics: {
        enabled: false
        // hierarchicalRepulsion: weakPhysics 
      },
      // layout: {
      //   hierarchical: {
      //     enabled: false
      //   }
      // },
    });
  });

  // Событие окончания
  network.on("dragEnd", function () {
    console.log('dragEnd');
    // network.unselectAll();
    network.setOptions({
      physics: {
        enabled: true
      },
    });
  });








  function countConnections(techs) {
    const counts = new Map();
    // Инициализируем счетчики для каждого ID
    techs.forEach(tech => {
      counts.set(tech.id, { in: 0, out: 0, total: 0 });
    });
    techs.forEach(tech => {
      tech.preq.forEach(preqId => {
        // Если пререквизит существует в списке технологий
        if (counts.has(preqId)) {
          const preqStat = counts.get(preqId);
          const techStat = counts.get(tech.id);
          preqStat.out++;
          preqStat.total++;
          techStat.in++;
          techStat.total++;
        }
      });
    });
    return counts;
  };

  /**
   * Считает полные наборы предков для всех технологий сразу
   * @param {Array} techs - массив из RulesTxt.getTechs()
   * @returns {Object} - словарь { techId: Set(ancestorIds) }
   */
  function calculateAllAncestors(techs) {
    const ancestorCache = {}; // Кеш для хранения Set-ов предков
    const techMap = new Map(techs.map(t => [t.id, t]));
    const nullValues = ['no', 'nil'];

    function getAncestors(id) {
      // Если уже считали для этого ID — возвращаем из кеша
      if (ancestorCache[id]) return ancestorCache[id];

      const currentTech = techMap.get(id);
      const ancestors = new Set();

      if (currentTech && currentTech.preq && Array.isArray(currentTech.preq)) {
        currentTech.preq.forEach(pId => {
          const cleanId = pId?.toString().trim();
          if (cleanId && !nullValues.includes(cleanId.toLowerCase())) {
            // Добавляем самого прямого родителя
            ancestors.add(cleanId);
            // Рекурсивно добавляем всех предков этого родителя
            const parentsAncestors = getAncestors(cleanId);
            parentsAncestors.forEach(a => ancestors.add(a));
          }
        });
      }

      ancestorCache[id] = ancestors;
      return ancestors;
    }

    // Запускаем расчет для каждой технологии
    techs.forEach(t => getAncestors(t.id));

    return ancestorCache;
  };

  function calculateDenseLevels(techs) {
    const levelCache = {}; // Кеш для уровней
    const techMap = new Map(techs.map(t => [t.id, t]));
    const nullValues = ['no', 'nil'];

    function getLevel(id) {
      // Если уже считали — берем из кеша
      if (levelCache[id] !== undefined) return levelCache[id];

      const tech = techMap.get(id);
      if (!tech || !tech.preq || tech.preq.length === 0) {
        return levelCache[id] = 0; // Корневая технология
      }

      let maxParentLevel = -1;
      let hasValidPreq = false;

      tech.preq.forEach(pId => {
        const cleanId = pId?.toString().trim();
        if (cleanId && !nullValues.includes(cleanId.toLowerCase())) {
          hasValidPreq = true;
          // Уровень узла = Максимальный уровень родителя + 1
          maxParentLevel = Math.max(maxParentLevel, getLevel(cleanId));
        }
      });

      return levelCache[id] = hasValidPreq ? maxParentLevel + 1 : 0;
    }

    // Считаем для всех
    techs.forEach(t => getLevel(t.id));
    return levelCache;
  };
  function Normalization(techs) {
    const allAncestorsMap = calculateAllAncestors(techs);
    const denseLevels = calculateDenseLevels(techs);

    // 1. Считаем "сырые" веса для каждой технологии
    const rawWeights = {};
    techs.forEach(tech => {
      if (allAncestorsMap[tech.id].size) {
        const denseCount = denseLevels[tech.id];
        const ancestorsCount = allAncestorsMap[tech.id]?.size || 0;
        const epochBonus = (tech.epoch || 0) * 1000;
        rawWeights[tech.id] = denseCount + epochBonus;
      } else {
        rawWeights[tech.id] = 0;
      }
    });

    // 2. Получаем список всех уникальных весов и сортируем их по возрастанию
    const uniqueSortedWeights = Array.from(new Set(Object.values(rawWeights)))
      .sort((a, b) => a - b);

    // 3. Создаем карту соответствия: [Сырой вес] -> [Порядковый номер уровня]
    const weightToLevelMap = {};
    uniqueSortedWeights.forEach((weight, index) => {
      weightToLevelMap[weight] = index;
    });

    // 4. Назначаем итоговый плотный уровень (level) узлам
    techs.forEach(tech => {
      const myRawWeight = rawWeights[tech.id];
      tech.level = weightToLevelMap[myRawWeight];

      // Для отладки:
      // console.log(`${tech.name}: Вес ${myRawWeight} -> Уровень ${tech.level}`);
    });
  };
}

