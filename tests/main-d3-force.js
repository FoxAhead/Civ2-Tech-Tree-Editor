import { RulesTxt } from "./RulesTxt.js";

window.onload = main;

async function main() {
  await RulesTxt.loadFromFile('RULES.TXT');

  const techs = RulesTxt.getTechs()

  const width = 1200;
  const height = 800;
  const nullValues = ['no', 'nil'];

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

  // Создаем временные счетчики
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
    // В D3 после инициализации ссылки становятся объектами, 
    // но на этапе подсчета это еще ID строк
    const sourceId = typeof l.source === 'string' ? l.source : l.source.id;
    const targetId = typeof l.target === 'string' ? l.target : l.target.id;

    if (nodeDegree[sourceId]) nodeDegree[sourceId].out++;
    if (nodeDegree[targetId]) nodeDegree[targetId].in++;
  });

  // 3. Настройка симуляции
  const simulation = d3
    .forceSimulation(nodes)
    .force("link", d3.forceLink(links).id(d => d.id).distance(150))
    .force("charge", d3.forceManyBody().strength(-500))
    .force("center", d3.forceCenter(width / 2, height / 2))
    // Сила иерархии: притягиваем узлы к X в зависимости от их эпохи
    // .force("x", d3.forceX(d => (d.epoch || 0) * 250 + 100).strength(1))
    .force("x", d3.forceX(d => {
      const deg = nodeDegree[d.id];
      const weight = deg.in - deg.out;

      const baseStep = (d.epoch || 0) * 500 + 100;
      const fineTune = weight * 150; // Смещение внутри эпохи

      return baseStep + fineTune;
    }).strength(1))
    // .force("y", d3.forceY(height / 2).strength(0.1))
    .force("y", d3.forceY(d => {
      const deg = nodeDegree[d.id];
      const totalConnections = deg.in + deg.out;

      // Если связей много (например > 4), тянем строго в центр
      // Если мало (1-2), позволяем узлу "всплывать" выше или ниже
      // Мы можем задать разные целевые Y для "слабых" узлов
      if (totalConnections <= 2) {
        // Четные улетают вверх, нечетные вниз (для симметрии)
        return (d.index % 2 === 0) ? height * 0.2 : height * 0.8;
      }

      return height / 2; // "Важные" узлы — в центр
    }).strength(d => {
      const deg = nodeDegree[d.id];
      const totalConnections = deg.in + deg.out;

      // Сила притяжения к центру растет вместе с количеством связей
      // Хабы (много связей) стоят мертво в центре, слабые узлы гуляют свободнее
      return Math.min(0.5, totalConnections * 0.05);
    }))
    .force("collision", d3.forceCollide().radius(50));

  // 4. Отрисовка стрелок (маркеры)
  svg.append("defs").append("marker")
    .attr("id", "arrow")
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", 10) // Точно в край линии
    .attr("refY", 0)
    .attr("markerWidth", 6)
    .attr("markerHeight", 6)
    .attr("orient", "auto")
    .append("path")
    .attr("fill", "#999")
    .attr("d", "M0,-5L10,0L0,5");

  // 5. Отрисовка ребер
  // const linkGenerator = d3.linkHorizontal()
  //   .source(d => [d.source.x, d.source.y])
  //   .target(d => [d.target.x, d.target.y]);
  const linkGenerator = d3.linkHorizontal()
    .source(d => [
      d.source.x + (d.source.bboxWidth / 2 || 50),
      d.source.y
    ])
    .target(d => [
      // Линия обрывается на левом краю:
      d.target.x - (d.target.bboxWidth / 2 || 50),
      d.target.y
    ]);
  const link = g.append("g")
    .attr("fill", "none") // Пути не должны закрашиваться внутри
    .selectAll("path")
    .data(links)
    .join("path")
    .attr("stroke", "#999")
    .attr("stroke-opacity", 0.6)
    .attr("stroke-width", 2)
    .attr("marker-end", "url(#arrow)");


  // 6. Отрисовка узлов
  const node = g.append("g")
    .selectAll("g")
    .data(nodes)
    .join("g")
    .call(drag(simulation))
    .on("mouseover", (event, d) => {
      // 1. Подсвечиваем все связанные ребра (и входящие, и исходящие)
      link
        .transition().duration(200) // Добавим немного плавности
        .attr("stroke", l => (l.source.id === d.id || l.target.id === d.id) ? "#ff0000" : "#999")
        .attr("stroke-width", l => (l.source.id === d.id || l.target.id === d.id) ? 4 : 2)
        .attr("stroke-opacity", l => (l.source.id === d.id || l.target.id === d.id) ? 1 : 0.2); // Остальные приглушаем

      // 2. Можно также подсветить сам узел
      d3.select(event.currentTarget).select("rect")
        .transition().duration(200)
        .attr("stroke-width", 4)
        .attr("stroke", "#ff0000");
    })
    .on("mouseout", (event, d) => {
      // Возвращаем всё в исходное состояние
      link
        .transition().duration(200)
        .attr("stroke", "#999")
        .attr("stroke-width", 2)
        .attr("stroke-opacity", 0.6);

      d3.select(event.currentTarget).select("rect")
        .transition().duration(200)
        .attr("stroke-width", 1)
        .attr("stroke", "#2B7CE9");
    })
    ;


  const epochColors = { 0: '#D2E5FF', 1: '#FFFF00', 2: '#FB7E81', 3: '#C2FABC' };

  node.append("rect")
    .attr("width", 100)
    .attr("height", 30)
    .attr("x", -50)
    .attr("y", -15)
    .attr("rx", 5)
    .attr("fill", d => epochColors[d.epoch] || "#97C2FC")
    .attr("stroke", "#2B7CE9");

  node.append("text")
    .text(d => d.name)
    .attr("text-anchor", "middle")
    .attr("dy", ".35em")
    .attr("font-size", "12px")
    .style("pointer-events", "none") // <--- ВОТ ЭТА СТРОКА
    .attr("fill", d => d.enabled ? "#000" : "#CCC");

  // 7. Обновление позиций на каждом шаге симуляции
  simulation.on("tick", () => {
    link.attr("d", d => {
      if (d.source.x != null && d.target.x != null) {
        return linkGenerator(d);
      }
      return null;
    });
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