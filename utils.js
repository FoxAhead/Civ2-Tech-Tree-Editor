export const defaultPhysics = {
  centralGravity: 0.0,
  springLength: 100,
  springConstant: 0.01,
  nodeDistance: 120,
  damping: 0.09,
  avoidOverlap: 0,
};
export const normalPhysics = {
  centralGravity: 0.0,
  springLength: 50,
  springConstant: 0.01,
  nodeDistance: 80,
  damping: 3.0,
  avoidOverlap: 1,
};
export const weakPhysics = {
  centralGravity: 0.0,
  springLength: 0,
  springConstant: 0.0,
  nodeDistance: 0,
  damping: 0.09,
  avoidOverlap: 0,
};

export const selColor = `#36F`;

export function generateEpochColors(count) {
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
};

export const epochColors = generateEpochColors(6);

export function countConnections(techs) {
  const counts = new Map();
  // Инициализируем счетчики для каждого ID
  techs.forEach((tech) => {
    counts.set(tech.id, { in: 0, out: 0, total: 0 });
  });
  techs.forEach((tech) => {
    tech.preq.forEach((preqId) => {
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
}

/**
 * Считает полные наборы предков для всех технологий сразу
 * @param {Array} techs - массив из RulesTxt.getTechs()
 * @returns {Object} - словарь { techId: Set(ancestorIds) }
 */
export function calculateAllAncestors(techs) {
  const ancestorCache = {}; // Кеш для хранения Set-ов предков
  const techMap = new Map(techs.map((t) => [t.id, t]));
  const nullValues = ["no", "nil"];

  function getAncestors(id) {
    // Если уже считали для этого ID — возвращаем из кеша
    if (ancestorCache[id]) return ancestorCache[id];

    const currentTech = techMap.get(id);
    const ancestors = new Set();

    if (currentTech && currentTech.preq && Array.isArray(currentTech.preq)) {
      currentTech.preq.forEach((pId) => {
        const cleanId = pId?.toString().trim();
        if (cleanId && !nullValues.includes(cleanId.toLowerCase())) {
          // Добавляем самого прямого родителя
          ancestors.add(cleanId);
          // Рекурсивно добавляем всех предков этого родителя
          const parentsAncestors = getAncestors(cleanId);
          parentsAncestors.forEach((a) => ancestors.add(a));
        }
      });
    }

    ancestorCache[id] = ancestors;
    return ancestors;
  }

  // Запускаем расчет для каждой технологии
  techs.forEach((t) => getAncestors(t.id));

  return ancestorCache;
}

export function calculateDenseLevels(techs) {
  const levelCache = {}; // Кеш для уровней
  const techMap = new Map(techs.map((t) => [t.id, t]));
  const nullValues = ["no", "nil"];

  function getLevel(id) {
    // Если уже считали — берем из кеша
    if (levelCache[id] !== undefined) return levelCache[id];

    const tech = techMap.get(id);
    if (!tech || !tech.preq || tech.preq.length === 0) {
      return (levelCache[id] = 0); // Корневая технология
    }

    let maxParentLevel = -1;
    let hasValidPreq = false;

    tech.preq.forEach((pId) => {
      const cleanId = pId?.toString().trim();
      if (cleanId && !nullValues.includes(cleanId.toLowerCase())) {
        hasValidPreq = true;
        // Уровень узла = Максимальный уровень родителя + 1
        maxParentLevel = Math.max(maxParentLevel, getLevel(cleanId));
      }
    });

    return (levelCache[id] = hasValidPreq ? maxParentLevel + 1 : 0);
  }

  // Считаем для всех
  techs.forEach((t) => getLevel(t.id));
  return levelCache;
}

export function Normalization(techs) {
  const allAncestorsMap = calculateAllAncestors(techs);
  const denseLevels = calculateDenseLevels(techs);

  // 1. Считаем "сырые" веса для каждой технологии
  const rawWeights = {};
  techs.forEach((tech) => {
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
  const uniqueSortedWeights = Array.from(
    new Set(Object.values(rawWeights))
  ).sort((a, b) => a - b);

  // 3. Создаем карту соответствия: [Сырой вес] -> [Порядковый номер уровня]
  const weightToLevelMap = {};
  uniqueSortedWeights.forEach((weight, index) => {
    weightToLevelMap[weight] = index;
  });

  // 4. Назначаем итоговый плотный уровень (level) узлам
  techs.forEach((tech) => {
    const myRawWeight = rawWeights[tech.id];
    tech.level = weightToLevelMap[myRawWeight];

    // Для отладки:
    // console.log(`${tech.name}: Вес ${myRawWeight} -> Уровень ${tech.level}`);
  });
}

export function builGraphFromTechs(g, techs) {
  g.nodes().forEach(n => g.removeNode(n));
  techs.forEach(tech => {
    g.setNode(tech.id, tech);
    tech.preq.forEach(pId => {
      if (pId && pId !== 'nil' && pId !== 'no') g.setEdge(pId, tech.id);
    });
  });
}

export function analizeTechs(techs) {

}

export function getNodeForTech(tech) {
  return {

  }
}

export function getNodeColorsForEpoch(epoch) {
  return epochColors[epoch] || { bg: "#97C2FC", border: "#2B7CE9", };
}

export function getEdgeColors() {
  return {
    hover: selColor,
    highlight: selColor,
  }
}

export function getVisNodesFromGraph(g) {
  return g.nodes().map((n) => {
    const tech = g.node(n);
    const colors = epochColors[tech.epoch] || { bg: "#97C2FC", border: "#2B7CE9", };
    return {
      id: tech.id,
      label: "<b>" + tech.id + "</b>" + "\n" + tech.name,
      // level: allAncestorsMap[tech.id].size,
      level: tech.level,
      color: {
        background: colors.background,
        border: colors.border,
        hover: colors.hover,
        highlight: colors.highlight,
      },
      font: {
        multi: true,
      },
      shape: "box",
      margin: 5,
      // physics: stat.total != 0,
      tech: tech,
    }
  });
}

export function getVisEdgesFromGraph(g) {
  return g.edges().map((e) => {
    return {
      from: e.v,
      to: e.w,
      color: {
        hover: selColor,
        highlight: selColor,
      },
    }
  });
}

export function smoothVerticalPositions(network, nodes, edges) {
  const allNodes = nodes.get();
  const allEdges = edges.get();
  for (let iter = 0; iter < 10; iter++) {
    allNodes.forEach(node => {
      const connectedEdges = allEdges.filter(e => e.from === node.id || e.to === node.id);
      if (connectedEdges.length === 0) return;
      let sumY = 0;
      let count = 0;
      connectedEdges.forEach(edge => {
        const otherId = (edge.from === node.id) ? edge.to : edge.from;
        const otherNode = nodes.get(otherId);
        const otherNodePos = network.getPosition(otherId);
        if (otherNode && otherNodePos.y !== undefined) {
          sumY += otherNodePos.y;
          count++;
        }
      });
      if (count > 0) {
        const avgY = sumY / count;
        const nodePos = network.getPosition(node.id);
        network.moveNode(node.id, nodePos.x, nodePos.y + (avgY - nodePos.y) * 0.5);
      }
    });
  }
}

export function drawPreqsPoints(ctx, network, nodes) {
  nodes.forEach(node => {
    const box = network.getBoundingBox(node.id);
    if (!box) return;
    const yCenter = (box.top + box.bottom) / 2;
    const xPos = box.left + 6;
    const drawSlot = (yOffset, pId) => {
      let style = {};
      if (pId === 'no')
        style = { fillColor: '#FFF', lineColor: '#C00', lineWidth: 2 };
      else if (pId === 'nil')
        style = { fillColor: '#FFF', lineColor: '#000', lineWidth: 1 };
      else
        style = { fillColor: nodes.get(pId) ? selColor : '#F00', lineColor: '#000', lineWidth: 1 };
      ctx.beginPath();
      ctx.arc(xPos, yCenter + yOffset, 5, 0, 2 * Math.PI);
      ctx.fillStyle = style.fillColor;
      ctx.fill();
      ctx.strokeStyle = style.lineColor;
      ctx.lineWidth = style.lineWidth;
      ctx.stroke();
    };
    drawSlot(-10, node.tech.preq[0]);
    drawSlot(10, node.tech.preq[1]);
  });
}