import * as Utils from './utils.js';
import MultiSet from './MultiSet.js';

const emptyPreqValues = ['no', 'nil'];

export default class TechTree {
  constructor(nodes, edges, issues) {
    this.nodes = wrapDataSet(nodes);
    this.edges = edges;
    // this.nodes.on('update', (event, properties, senderId) => this._onNodesChange(event, properties, senderId));
    this.edges.on('*', (event, properties, senderId) => this._onEdgesChange(event, properties, senderId));
    this.needLineUp = false;
    this.issues = issues;
  }

  _onNodesChange(event, properties, senderId) {
    // if (this._isBuilding) return;
    console.log('_onNodesChange:', 'event:', event, 'properties:', properties, 'senderId:', senderId);
  }

  _onEdgesChange(event, properties, senderId) {
    // console.log('_onEdgesChange:', 'event:', event, 'properties:', properties, 'senderId:', senderId);
    let needRecalc = false;
    if (event === 'add') {
      properties.items.forEach(edgeId => {
        const edge = this.edges.get(edgeId);
        this._updateTechPreqFromEdge(event, edge);
        this._toggleNodeLink(edge.from, { add: { to: edge.to } });
        this._toggleNodeLink(edge.to, { add: { from: edge.from } });
      })
      needRecalc = true;
    } else if (event === 'update') {
      properties.data.forEach((item, i) => {
        if ('from' in item || 'to' in item) {
          const oldEdge = properties.oldData[i];
          const newEdge = this.edges.get(properties.items[i]);
          if (newEdge.to !== oldEdge.to) {
            this._updateTechPreqFromEdge('remove', oldEdge);
            this._updateTechPreqFromEdge('add', newEdge);
          }
          this._toggleNodeLink(oldEdge.to, { delete: { from: oldEdge.from } });
          this._toggleNodeLink(newEdge.to, { add: { from: newEdge.from } });
          this._toggleNodeLink(oldEdge.from, { delete: { to: oldEdge.to } });
          this._toggleNodeLink(newEdge.from, { add: { to: newEdge.to } });
          needRecalc = true;
        }
      });
    } else if (event === 'remove') {
      properties.oldData.forEach(oldEdge => {
        this._updateTechPreqFromEdge(event, oldEdge);
        this._toggleNodeLink(oldEdge.from, { delete: { to: oldEdge.to } });
        this._toggleNodeLink(oldEdge.to, { delete: { from: oldEdge.from } });
      });
      needRecalc = true;
    }
    if (!this._isBuilding && needRecalc) this._analyzeGraph();
  }

  _toggleNodeLink(nodeId, actionMap) {
    // console.log('_toggleNodeLink');
    const node = this.nodes.get(nodeId);
    if (!node) return;
    for (const [method, link] of Object.entries(actionMap)) {
      for (const [key, targetId] of Object.entries(link)) {
        node[key][method](targetId);
      }
    }
    this.needLineUp = true;
  }

  _updateTechPreqFromEdge(event, edge) {
    if (this._isBuilding) return;
    // console.log('_updateTechPreqFromEdge');
    const tech = this.nodes.get(edge.to).tech;
    if (event === 'add') {
      tech.setPreq(edge.targetSlot, edge.from);
    } else if (event === 'remove') {
      tech.setPreq(edge.targetSlot, 'nil');
    }
  }

  _findCycles2() {
    const nodes = this.nodes.get();
    const visited = new Set();
    const recStack = new Set();
    const cycles = [];
    const dfs = (nodeId, path) => {
      visited.add(nodeId);
      recStack.add(nodeId);
      path.push(nodeId);
      const node = this.nodes.get(nodeId);
      if (node.to) {
        for (let neighbourId of node.to) {
          if (!visited.has(neighbourId)) {
            if (dfs(neighbourId, [...path])) return true;
          } else if (recStack.has(neighbourId)) {
            const cyclePath = path.slice(path.indexOf(neighbourId));
            cycles.push(cyclePath);
            return true;
          }
        }
      }
      recStack.delete(nodeId);
      return false;
    };
    for (let node of nodes) {
      if (!visited.has(node.id)) {
        dfs(node.id, []);
      }
    }
    return cycles;
  }

  _findCycles() {
    const nodes = this.nodes.get();
    const visited = new Set();
    const recStack = new Set();
    const cycles = [];
    const dfs = (nodeId, path) => {
      visited.add(nodeId);
      recStack.add(nodeId);
      path.push(nodeId);
      const node = this.nodes.get(nodeId);
      if (node.to) {
        for (let neighbourId of node.to) {
          if (!visited.has(neighbourId)) {
            dfs(neighbourId, [...path]);
          } else if (recStack.has(neighbourId)) {
            const cyclePath = path.slice(path.indexOf(neighbourId));
            cycles.push(cyclePath);
          }
        }
      }
      recStack.delete(nodeId);
    };
    for (let node of nodes) {
      if (!visited.has(node.id)) {
        dfs(node.id, []);
      }
    }
    return cycles;
  }

  _analyzeCycles() {
    const cycles = this._findCycles(); // Предполагаем, возвращает массив массивов: [[id1, id2, id1], ...]
    // console.log('_analyzeCycles', cycles);
    cycles.forEach((cyclePath) => {
      const pathString = cyclePath.join(' → ');
      this.issues.push({
        techId: cyclePath[0],
        message: `Cycle: ${pathString}`
      });
    });
  }

  _formatNode(tech) {
    return {
      id: tech.id,
      label: `<b>${tech.id}</b>\n${tech.name}`,
      color: Utils.getNodeColorsForEpoch(tech.epoch),
    };
  }

  _formatEdgeTargetSlot(index) {
    return {
      targetSlot: index,
      smooth: { roundness: 0.8 - index / 5 },
    };
  }

  _smartUpdate(nodesDataSet, updates) {
    const optimizedUpdates = updates.filter(update => {
      const currentNode = nodesDataSet.get(update.id);

      // Если узла нет, это добавление — пропускаем
      if (!currentNode) return true;

      // Проверяем, есть ли хотя бы одно отличие в переданных полях
      return Object.keys(update).some(key => update[key] !== currentNode[key]);
    });

    if (optimizedUpdates.length > 0) {
      nodesDataSet.update(optimizedUpdates);
    }
  }

  _patchNodes(nodesDataSet, updates) {
    const finalUpdates = updates.reduce((acc, update) => {
      const currentNode = nodesDataSet.get(update.id);

      if (!currentNode) {
        // Если узла нет в DataSet, добавляем его целиком
        acc.push(update);
        return acc;
      }

      // Собираем только изменившиеся поля
      const diff = Object.keys(update).reduce((patch, key) => {
        if (update[key] !== currentNode[key]) {
          patch[key] = update[key];
        }
        return patch;
      }, {});

      // Если кроме id (который всегда есть в diff) изменилось что-то еще
      if (Object.keys(diff).length > 1) {
        // Обязательно оставляем id, чтобы vis-network понял, кого обновлять
        diff.id = update.id;
        acc.push(diff);
      }

      return acc;
    }, []);

    if (finalUpdates.length > 0) {
      nodesDataSet.update(finalUpdates);
    }
  }

  _analyzeGraph() {
    // console.log('_analyzeGraph');
    this.issues.length = 0;
    this._analyzeAvailability();
    this._calculateLevels();
    this._analyzeCycles();
    this.nodes.flush();
    // console.log('Issues:', this.issues);
  }

  _analyzeAvailability() {
    const edgeUpdates = [];
    const nodesQueue = [];
    // 1. Initialize nodes status from Technology
    this.nodes.forEach(node => {
      node.enabled = node.tech.enabled;
      if (!node.enabled) {
        nodesQueue.push(node);
      }
    });
    // 2. Propagate disabled state
    const visitedNodes = new Set();
    while (nodesQueue.length > 0) {
      const node = nodesQueue.shift();
      if (visitedNodes.has(node.id)) continue;
      visitedNodes.add(node.id);
      for (const targetId of node.to) {
        const targetNode = this.nodes.get(targetId);
        if (targetNode && targetNode.enabled) {
          targetNode.enabled = false;
          nodesQueue.push(targetNode);
        }
      }
    }
    // 3. Prerpare nodes update
    this.nodes.forEach(node => {
      // Enabled
      node.shapeProperties = { borderDashes: node.enabled ? false : [4, 4] };
      const font = { ...node.font };
      if (!node.enabled) {
        if (node.id === 'FT') {
          font.color = '#F00';
          this.issues.push({ techId: node.id, message: 'Future Technology unreachable' });
        } else {
          font.color = '#AAA';
        }
      } else {
        font.color = undefined;
      };
      node.font = font;
      // Double link
      const hasDuplicates = Array.from(node.from._map.values()).some(count => count > 1);
      if (hasDuplicates)
        this.issues.push({ techId: node.id, message: 'Duplicate prerequisite' });
      // Non-existent prerequisite
      const badIds = node.tech.preq.filter(pId => !this.nodes.get(pId) && !emptyPreqValues.includes(pId));
      if (badIds.length) {
        this.issues.push({
          techId: node.id,
          message: `Non-existent prerequisites: ${badIds.join(', ')}`
        });
      }
    });
    // 4. Edges
    this.edges.forEach(edge => {
      const sourceNode = this.nodes.get(edge.from);
      const targetNode = this.nodes.get(edge.to);
      const isDashed = sourceNode && !sourceNode.enabled || targetNode && !targetNode.enabled;
      edgeUpdates.push({
        id: edge.id,
        dashes: isDashed,
      });
    });

    // 5. Update vis network visuals
    this.edges.update(edgeUpdates);
  }

  _calculateLevels() {
    const allNodes = this.nodes.get();
    const nodeMap = new Map(allNodes.map(n => [n.id, n]));
    const memo = new Map();

    const getLevel = (nodeId, path = new Set()) => {
      if (memo.has(nodeId)) return memo.get(nodeId);
      if (path.has(nodeId)) return 0; // Защита от циклов

      const node = nodeMap.get(nodeId);
      const parentIds = Array.from(node.from._map.keys());
      const childIds = Array.from(node.to._map.keys());

      // Случай 1: Абсолютно одинокий узел
      if (parentIds.length === 0 && childIds.length === 0) {
        memo.set(nodeId, 1);
        return 1;
      }

      // Случай 2: Корень (есть дети, нет родителей)
      if (parentIds.length === 0) {
        memo.set(nodeId, 1);
        return 1;
      }

      // Случай 3: Есть родители — ищем самый длинный путь до них
      path.add(nodeId);
      let maxParentLevel = 0;
      for (const pId of parentIds) {
        maxParentLevel = Math.max(maxParentLevel, getLevel(pId, path));
      }
      path.delete(nodeId);
      const finalLevel = maxParentLevel + 1;
      memo.set(nodeId, finalLevel);
      return finalLevel;
    };

    let count = 0;
    allNodes.forEach((node) => {
      const links = node.from.size + node.to.size;
      const newPhysics = Boolean(links) || node.enabled;
      node.level = newPhysics ? getLevel(node.id) : ++count;
      if (node.physics !== newPhysics) {
        node.physics = newPhysics;
        this.needLineUp = true;
      }
    });

  }

  /**
   * @param {any[]} techs
  */
  build(techs) {
    this._isBuilding = true;
    this.nodes.clear();
    this.edges.clear();
    const newNodes = [];
    const newEdges = [];
    techs.forEach((tech) => {
      newNodes.push({
        ...this._formatNode(tech),
        font: {
          multi: true,
        },
        shape: 'box',
        margin: 5,
        tech: tech,
        from: new MultiSet(),
        to: new MultiSet(),
        borderWidth: 1.5,
      });
    });
    this.nodes.add(newNodes);
    techs.forEach((tech) => {
      tech.preq.forEach((pId, i) => {
        const node = this.nodes.get(pId);
        if (node && !emptyPreqValues.includes(pId)) newEdges.push(
          {
            from: pId,
            to: tech.id,
            color: Utils.getEdgeColors(),
            ...this._formatEdgeTargetSlot(i),
          }
        );
      });
    });
    this.edges.add(newEdges);
    this._isBuilding = false;
    this._analyzeGraph();
  }

  /**
   * @param {{ id: string; from: string; to: string; }} newEdge
   */
  canChangeEdge(newEdge) {
    // console.log("canChangeEdge? new:", newEdge);
    // if (newEdge.from === newEdge.to) // Check for self reference
    //   return false;
    const node = this.nodes.get(newEdge.to);
    // Add
    if (!newEdge.id) {
      const freePreqSlot = node.tech.getFreePreqSlot();
      Object.assign(newEdge, this._formatEdgeTargetSlot(freePreqSlot));
      Object.assign(newEdge, { color: Utils.getEdgeColors() });
      return (node.from.size < 2 && freePreqSlot !== -1);
    }
    // Edit
    const oldEdge = this.edges.get(newEdge.id);
    // console.log("canChangeEdge? old:", oldEdge);
    if (newEdge.to === oldEdge.to) // Changing From
      return newEdge.from !== oldEdge.from
    else {                         // Changing To
      const freePreqSlot = node.tech.getFreePreqSlot();
      Object.assign(newEdge, this._formatEdgeTargetSlot(freePreqSlot));
      return (node.from.size < 2 && freePreqSlot !== -1);
    }
  }

  techUpdated(tech) {
    // console.log("techUpdated");
    const node = this.nodes.get(tech.id);
    Object.assign(node, this._formatNode(tech));
    this.nodes.flush();
  }

  changePreqLink(tech, index, newValue) {
    const oldValue = tech.preq[index];
    if (oldValue === newValue) return;
    if (!emptyPreqValues.includes(oldValue)) {
      const edgeId = this.edges.getIds({
        filter: (e) => e.from === oldValue && e.to === tech.id && e.targetSlot === index
      });
      if (edgeId.length > 0) this.edges.remove(edgeId);
    };
    if (!emptyPreqValues.includes(newValue)) {
      const newEdge = { from: newValue, to: tech.id };
      if (this.canChangeEdge(newEdge))
        this.edges.add(newEdge);
    } else {
      tech['preq' + (index + 1)] = newValue;
    };
    this._analyzeGraph();
  }

  swapPreqs(tech) {
    const techEnabledBefore = tech.enabled;
    const updates = tech.preq.map((pId, index) => {
      tech.setPreq(1 - index, pId);
      const [edge] = this.edges.get({
        filter: (e) => e.to === tech.id && e.targetSlot === index
      });
      return edge ? { id: edge.id, ...this._formatEdgeTargetSlot(1 - edge.targetSlot) } : null;
    }).filter(Boolean);
    if (updates.length)
      this.edges.update(updates, 'swapPreqs');
    if (tech.enabled !== techEnabledBefore) {
      this._analyzeGraph();
    }
    // this.nodes.update(this.nodes.get(tech.id));
  }

}

function wrapDataSet(dataSet) {
  const pendingChanges = new Map(); // id -> { id, ...изменения }

  const wrapItem = (item, itemId) => {
    if (!item) return item;

    return new Proxy(item, {
      get(target, prop) {
        // Сначала проверяем, есть ли свежее "черновое" значение
        const entry = pendingChanges.get(itemId);
        if (entry && prop in entry) {
          return entry[prop];
        }
        // Если нет — берем оригинал из DataSet
        return target[prop];
      },

      set(target, prop, newValue) {
        // Сравниваем новое значение напрямую с тем, что лежит в DataSet
        const originalValue = target[prop];

        const isSameAsOriginal = (typeof newValue === 'object' && newValue !== null)
          ? JSON.stringify(originalValue) === JSON.stringify(newValue)
          : originalValue === newValue;

        if (isSameAsOriginal) {
          // Если вернули к исходному — удаляем из черновика
          if (pendingChanges.has(itemId)) {
            delete pendingChanges.get(itemId)[prop];
            // Если правок по узлу больше нет (кроме id) — удаляем запись целиком
            if (Object.keys(pendingChanges.get(itemId)).length <= 1) {
              pendingChanges.delete(itemId);
            }
          }
        } else {
          // Если значение новое — пишем ТОЛЬКО в черновик
          if (!pendingChanges.has(itemId)) {
            pendingChanges.set(itemId, { id: itemId });
          }
          pendingChanges.get(itemId)[prop] = newValue;
        }
        return true;
      }
    });
  };

  return new Proxy(dataSet, {
    get(target, prop) {
      if (prop === 'flush') {
        return () => {
          if (pendingChanges.size === 0) return;
          const updatesArray = Array.from(pendingChanges.entries()).map(([id, item]) => {
            const update = { ...item };
            if (!('level' in update)) {
              update.level = target.get(id)?.level;
            }
            return update;
          });
          target.update(updatesArray);
          pendingChanges.clear();
        };
      }

      // Проброс стандартных методов (forEach, get и т.д.)
      if (prop === 'forEach' || prop === 'map') {
        return (cb) => target[prop]((item, id) => cb(wrapItem(item, id), id));
      }
      if (prop === 'get') {
        return (id, opt) => {
          const res = target.get(id, opt);
          return Array.isArray(res) ? res.map(i => wrapItem(i, i.id)) : wrapItem(res, res?.id);
        };
      }
      if (prop in target) {
        const val = target[prop];
        return typeof val === 'function' ? val.bind(target) : val;
      }

      const item = target.get(prop);
      return item ? wrapItem(item, item.id) : undefined;
    }
  });
}

