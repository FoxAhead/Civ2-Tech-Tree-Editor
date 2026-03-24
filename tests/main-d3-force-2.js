import { RulesTxt } from "./RulesTxt.js";

window.onload = main;

async function main() {
  await RulesTxt.loadFromFile('RULES.TXT');

  const techs = RulesTxt.getTechs()

  const width = 1200;
  const height = 800;
  const nullValues = ['no', 'nil'];

  // Параметры узлов
  const nodeWidth = 100;
  const nodeHeight = 30;

  // 1. Подготовка данных
  const nodes = techs.map(d => ({ ...d }));
  const links = [];

  techs.forEach(tech => {
    if (tech.preq) {
      tech.preq.forEach(pId => {
        const cleanId = pId?.toString().toLowerCase().trim();
        if (cleanId && !nullValues.includes(cleanId)) {
          links.push({ source: pId, target: tech.id });
        }
      });
    }
  });

  // 2. Создание SVG
  const svg = d3.select("#mytree")
    .append("svg")
    .attr("width", "100%")
    .attr("height", "100%")
    .attr("viewBox", [0, 0, width, height]);

  // Контейнер для зума
  const g = svg.append("g");

  svg.call(d3.zoom().on("zoom", (event) => g.attr("transform", event.transform)));

  // Создаем временные счетчики для распределения связей
  const currentOut = {};
  const currentIn = {};

  links.forEach(l => {
    // Для узла-источника (откуда выходит)
    const sId = typeof l.source === 'string' ? l.source : l.source.id;
    currentOut[sId] = (currentOut[sId] || 0) + 1;
    l.sourceIdx = currentOut[sId];

    // Для узла-цели (куда входит)
    const tId = typeof l.target === 'string' ? l.target : l.target.id;
    currentIn[tId] = (currentIn[tId] || 0) + 1;
    l.targetIdx = currentIn[tId];
  });

  // Считаем входящие и исходящие связи для каждого узла
  const nodeDegree = {};
  nodes.forEach(d => nodeDegree[d.id] = { in: 0, out: 0 });

  links.forEach(l => {
    const sourceId = typeof l.source === 'string' ? l.source : l.source.id;
    const targetId = typeof l.target === 'string' ? l.target : l.target.id;

    if (nodeDegree[sourceId]) nodeDegree[sourceId].out++;
    if (nodeDegree[targetId]) nodeDegree[targetId].in++;
  });

  // 3. Настройка симуляции
  const simulation = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links).id(d => d.id).distance(150))
    .force("charge", d3.forceManyBody().strength(-300))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("x", d3.forceX(d => {
      const deg = nodeDegree[d.id];
      const weight = deg.in - deg.out;
      const baseStep = (d.epoch || 0) * 300 + 100;
      const fineTune = weight * 40;
      return baseStep + fineTune;
    }).strength(1))
    .force("y", d3.forceY(height / 2).strength(0.1))
    .force("collision", d3.forceCollide().radius(60));

  // 4. Отрисовка стрелок (маркеры)
  svg.append("defs").append("marker")
    .attr("id", "arrow")
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", 8) // Уменьшил, так как теперь линия подходит к границе
    .attr("refY", 0)
    .attr("markerWidth", 6)
    .attr("markerHeight", 6)
    .attr("orient", "auto")
    .append("path")
    .attr("fill", "#999")
    .attr("d", "M0,-5L10,0L0,5");

  // 5. Функция для расчета точки на границе прямоугольника
  function getIntersectionPoint(sourceX, sourceY, targetX, targetY, isSource = true) {
    const rectWidth = nodeWidth;
    const rectHeight = nodeHeight;

    // Центр прямоугольника
    const centerX = isSource ? sourceX : targetX;
    const centerY = isSource ? sourceY : targetY;

    // Точка, к которой ведем линию (центр другого прямоугольника)
    const otherX = isSource ? targetX : sourceX;
    const otherY = isSource ? targetY : sourceY;

    // Вектор направления от центра к другой точке
    let dx = otherX - centerX;
    let dy = otherY - centerY;

    // Защита от деления на ноль
    if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) {
      return { x: centerX, y: centerY };
    }

    // Половины размеров прямоугольника
    const halfWidth = rectWidth / 2;
    const halfHeight = rectHeight / 2;

    // Нормализуем вектор
    const length = Math.sqrt(dx * dx + dy * dy);
    const nx = dx / length;
    const ny = dy / length;

    // Определяем, с какой стороны будет пересечение
    // Используем параметрическое уравнение: center + t * (nx, ny)
    // Ищем t, при котором линия пересекает границу прямоугольника

    let t;
    if (Math.abs(nx) > 0.001) {
      // Проверяем пересечение с вертикальными сторонами
      const tX = halfWidth / Math.abs(nx);
      const yAtX = centerY + nx > 0 ? tX * ny : -tX * ny;

      if (Math.abs(yAtX - centerY) <= halfHeight) {
        t = tX;
      } else {
        // Если не попадает по вертикали, используем горизонтальные стороны
        t = halfHeight / Math.abs(ny);
      }
    } else {
      // Если dx почти 0, используем горизонтальные стороны
      t = halfHeight / Math.abs(ny);
    }

    // Вычисляем точку пересечения
    return {
      x: centerX + (nx > 0 ? t : -t) * Math.abs(nx),
      y: centerY + (ny > 0 ? t : -t) * Math.abs(ny)
    };
  }

  // 6. Генератор пути с учетом вертикального смещения для множественных связей
  function getLinkPath(d) {
    if (!d.source.x || !d.target.x) return null;

    // Получаем вертикальные смещения для источника и цели
    const totalOut = nodeDegree[d.source.id].out;
    const totalIn = nodeDegree[d.target.id].in;

    const sourceYOffset = totalOut > 1
      ? (d.sourceIdx / (totalOut + 1) - 0.5) * nodeHeight
      : 0;

    const targetYOffset = totalIn > 1
      ? (d.targetIdx / (totalIn + 1) - 0.5) * nodeHeight
      : 0;

    // Координаты центров узлов со смещениями
    const sourceCenter = {
      x: d.source.x,
      y: d.source.y + sourceYOffset
    };

    const targetCenter = {
      x: d.target.x,
      y: d.target.y + targetYOffset
    };

    // Получаем точки на границах прямоугольников
    const sourcePoint = getIntersectionPoint(
      sourceCenter.x, sourceCenter.y,
      targetCenter.x, targetCenter.y,
      true
    );

    const targetPoint = getIntersectionPoint(
      sourceCenter.x, sourceCenter.y,
      targetCenter.x, targetCenter.y,
      false
    );

    // Создаем путь с плавным изгибом
    // Используем кривую Безье для более красивых линий
    const midX = (sourcePoint.x + targetPoint.x) / 2;
    const midY = (sourcePoint.y + targetPoint.y) / 2;

    // Добавляем небольшой изгиб для лучшей визуализации
    const dx = targetPoint.x - sourcePoint.x;
    const dy = targetPoint.y - sourcePoint.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Контрольная точка для кривой (немного смещаем перпендикулярно)
    const offset = Math.min(50, distance * 0.2);
    const perpX = -dy / distance * offset;
    const perpY = dx / distance * offset;

    const ctrlX = midX + perpX;
    const ctrlY = midY + perpY;

    // Формируем путь
    return `M${sourcePoint.x},${sourcePoint.y} Q${ctrlX},${ctrlY} ${targetPoint.x},${targetPoint.y}`;
  }

  // 7. Отрисовка ребер
  const link = g.append("g")
    .attr("fill", "none")
    .selectAll("path")
    .data(links)
    .join("path")
    .attr("stroke", "#999")
    .attr("stroke-opacity", 0.6)
    .attr("stroke-width", 2)
    .attr("fill", "none")
    .attr("marker-end", "url(#arrow)");

  // 8. Отрисовка узлов
  const node = g.append("g")
    .selectAll("g")
    .data(nodes)
    .join("g")
    .call(drag(simulation))
    .on("mouseover", (event, d) => {
      link
        .transition().duration(200)
        .attr("stroke", l => (l.source.id === d.id || l.target.id === d.id) ? "#ff0000" : "#999")
        .attr("stroke-width", l => (l.source.id === d.id || l.target.id === d.id) ? 4 : 2)
        .attr("stroke-opacity", l => (l.source.id === d.id || l.target.id === d.id) ? 1 : 0.2);

      d3.select(event.currentTarget).select("rect")
        .transition().duration(200)
        .attr("stroke-width", 4)
        .attr("stroke", "#ff0000");
    })
    .on("mouseout", (event, d) => {
      link
        .transition().duration(200)
        .attr("stroke", "#999")
        .attr("stroke-width", 2)
        .attr("stroke-opacity", 0.6);

      d3.select(event.currentTarget).select("rect")
        .transition().duration(200)
        .attr("stroke-width", 1)
        .attr("stroke", "#2B7CE9");
    });

  const epochColors = { 0: '#D2E5FF', 1: '#FFFF00', 2: '#FB7E81', 3: '#C2FABC' };

  node.append("rect")
    .attr("width", nodeWidth)
    .attr("height", nodeHeight)
    .attr("x", -nodeWidth / 2)
    .attr("y", -nodeHeight / 2)
    .attr("rx", 5)
    .attr("fill", d => epochColors[d.epoch] || "#97C2FC")
    .attr("stroke", "#2B7CE9");

  node.append("text")
    .text(d => d.name)
    .attr("text-anchor", "middle")
    .attr("dy", ".35em")
    .attr("font-size", "10px")
    .attr("fill", d => d.enabled ? "#000" : "#777");

  // 9. Обновление позиций на каждом шаге симуляции
  simulation.on("tick", () => {
    link.attr("d", d => getLinkPath(d));
    node.attr("transform", d => `translate(${d.x},${d.y})`);
  });

  // Функция перетаскивания
  function drag(simulation) {
    return d3.drag()
      .on("start", (event) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
      })
      .on("drag", (event) => {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
      })
      .on("end", (event) => {
        if (!event.active) simulation.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
      });
  }
}