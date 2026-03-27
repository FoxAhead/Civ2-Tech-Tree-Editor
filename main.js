import { RulesTxt } from './RulesTxt/RulesTxt.js';
import * as Utils from './utils.js';
import TechTree from './TechTree.js';

const { createApp, reactive, ref, onMounted, watch, computed } = Vue;

// console.log = function () { };

createApp({
  setup() {
    const sidebarVisible = ref(true);
    const visContainer = ref(null);
    const errorModalContainer = ref(null);
    const errorMessage = ref('');
    const currentFileName = ref(RulesTxt.currentFileName);

    const state = reactive({
      techs: [],
      selectedTech: null,
      issues: [],
    });

    const nodes = new vis.DataSet([]);
    const edges = new vis.DataSet([]);
    const techTree = new TechTree(nodes, edges, state.issues);

    let errorModal = null;
    let network = null;
    let rulesTxt = null;

    const renderGraph = (techs) => {
      if (network) network.fit();
      focusNode('Alp');
    };

    onMounted(() => {
      errorModal = new bootstrap.Modal(errorModalContainer.value);

      const options = {
        // configure: {
        //   enabled: true,
        //   container: document.getElementById('visConfig'),
        // },
        edges: {
          arrows: { to: { enabled: true, scaleFactor: 1 } },
          smooth: {
            type: 'cubicBezier',
            forceDirection: 'horizontal',
          },
        },
        nodes: {
          labelHighlightBold: false,
        },
        layout: {
          hierarchical: {
            direction: 'LR',
            sortMethod: 'directed',
            shakeTowards: 'roots',
            nodeSpacing: 100,
            levelSeparation: 170,
            parentCentralization: false,
            treeSpacing: 0,
          },
        },
        interaction: {
          hover: true,
        },
        manipulation: {
          enabled: true,
          initiallyActive: true,
          addNode: false,
          deleteNode: false,
          addEdge: (edgeData, callback) => {
            callback(techTree.canChangeEdge(edgeData) ? edgeData : null);
          },
          editEdge: (edgeData, callback) => {
            callback(techTree.canChangeEdge(edgeData) ? edgeData : null);
          },
          deleteEdge: (edgeData, callback) => {
            // console.log('Can deleteEdge?', edgeData);
            callback(edgeData);
          }
        },
        physics: {
          enabled: true,
          hierarchicalRepulsion: Utils.normalPhysics,
        },
      };

      network = new vis.Network(visContainer.value, { nodes: nodes, edges: edges }, options);
      // techTree.network = network;

      network.on('afterDrawing', function (ctx) {
        // console.log('afterDrawing');
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
              style = { fillColor: nodes.get(pId) ? Utils.selColor : '#F00', lineColor: '#000', lineWidth: 1 };
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
      });

      network.on('click', (params) => {
        // console.log('click:', params);
        // if (params.nodes.length === 1)
        //   console.log('node:', nodes.get(params.nodes[0]));
        // if (params.edges.length === 1)
        //   console.log('edge:', edges.get(params.edges[0]));
        state.selectedTech = params.nodes.length > 0 ? nodes.get(params.nodes[0]).tech : null;
      });

      // Сохраняем ID узлов, которые мы "подсветили", чтобы быстро их сбросить
      // let highlightedNodes = [];
      // let highlightedEdges = [];

      // network.on('select', (params) => {
      //   console.log('select:', params);
      // });
      // network.on('selectNode', (params) => {
      //   console.log('selectNode:', params);
      // });
      // network.on('deselectNode', (params) => {
      //   console.log('deselectNode:', params);
      // });
      // network.on('selectEdge', (params) => {
      //   console.log('selectEdge:', params);
      // });
      // network.on('deselectEdge', (params) => {
      //   console.log('deselectEdge:', params);
      // });

      network.on('dragStart', (params) => {
        // console.log('dragStart', params);
        if (params.nodes.length)
          network.setOptions({ physics: { enabled: false } });
      });

      // network.on('dragging', (params) => {
      //   console.log('dragging', params);
      // });

      network.on('dragEnd', (params) => {
        // console.log('dragEnd:', params);
        const selectedNodes = network.getSelectedNodes();
        // console.log('getSelectedNodes():', selectedNodes);
        if (selectedNodes.length) {
          if (!state.selectedTech)
            state.selectedTech = nodes.get(selectedNodes[0]).tech
          else if (selectedNodes[0] !== state.selectedTech.id)
            state.selectedTech = nodes.get(selectedNodes[0]).tech;
          // network.selectNodes([state.selectedTech.id]);
        }
        network.setOptions({ physics: { enabled: true } });
      });

      // network.on('controlNodeDragging', (params) => {
      //   console.log('controlNodeDragging', params);
      // });

      // network.on('controlNodeDragEnd', (params) => {
      //   console.log('controlNodeDragEnd', params);
      //   network.setOptions({ physics: { enabled: true } });
      // });

      // network.on('controlNodeDragging', function (params) {
      //   console.log('controlNodeDragging:', params.controlEdge);
      // });

      // network.on('stabilizationProgress', (params) => {
      //   console.log('stabilizationProgress', params);
      // });

      // network.once('stabilized', () => {
      //   // Выключаем иерархию, чтобы разрешить свободное движение по Y
      //   // network.setOptions({ layout: { hierarchical: false } });
      //   console.log('stabilized');
      //   // smoothVerticalPositions();
      //   lineUpUnusedNodes();
      // });

      // network.once('startStabilizing', () => {
      //   console.log('startStabilizing');
      //   smoothVerticalPositions();
      // });

      network.on('stabilized', () => {
        // console.log('stabilized');
        if (techTree.needLineUp) {
          lineUpUnusedNodes();
          techTree.needLineUp = false;
        }
      });
      // network.on('animationFinished', () => {
      //   console.log('animationFinished');
      // });

      loadDefaultRules();
    });

    const lineUpUnusedNodes = () => {
      let maxY = -Infinity;
      const unusedNodes = new Set();
      nodes.forEach((node) => {
        const links = node.from.size + node.to.size;
        if (links || node.enabled) {
          const nodePos = network.getPosition(node.id);
          maxY = Math.max(nodePos.y, maxY);
        } else {
          unusedNodes.add(node.id);
        }
      });
      unusedNodes.forEach((nodeId) => {
        const nodePos = network.getPosition(nodeId);
        network.moveNode(nodeId, nodePos.x, maxY + 200);
      });
    }

    const smoothVerticalPositions = () => {
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
            // Плавно двигаем узел к средней точке (коэффициент 0.5 для стабильности)
            const nodePos = network.getPosition(node.id);
            network.moveNode(node.id, nodePos.x, nodePos.y + (avgY - nodePos.y) * 0.5);
            // node.y = node.y + (avgY - node.y) * 0.5;
          }
        });
      }

      // Применяем обновленные координаты
      // nodes.update(allNodes);
    }

    watch(() => state.selectedTech, (newTech, oldTech) => {
      if (newTech && oldTech && newTech.id === oldTech.id) {
        techTree.techUpdated(newTech);
      }
    }, { deep: true });

    // Loading RULES.TXT
    const getAndRenderTechsFromRulesTxt = () => {
      state.techs = rulesTxt.civilize.data;
      techTree.build(state.techs);
      renderGraph(state.techs);
    };
    const loadDefaultRules = async () => {
      try {
        const newRulesTxt = await RulesTxt.loadFromFile('RULES.TXT', ['@CIVILIZE']);
        rulesTxt = newRulesTxt;
        errorMessage.value = '';
        getAndRenderTechsFromRulesTxt();
      } catch (error) {
        errorMessage.value = error.message;
        errorModal.show();
      }
    };
    // Custom RULES.TXT
    const loadCustomRulesTxt = async (file) => {
      try {
        const newRulesTxt = await RulesTxt.loadFromFile(file, ['@CIVILIZE']);
        currentFileName.value = newRulesTxt.currentFileName;
        rulesTxt = newRulesTxt;
        errorMessage.value = '';
        getAndRenderTechsFromRulesTxt();
      } catch (error) {
        // alert(error.message);
        errorMessage.value = error.message;
        errorModal.show();
      }
    }
    const handleFileUpload = async (event) => {
      loadCustomRulesTxt(event.target.files[0]);
    };
    const isDragging = ref(false);
    const handleDrop = async (event) => {
      isDragging.value = false;
      event.preventDefault();
      loadCustomRulesTxt(event.dataTransfer.files[0]);
    };
    const onDragOver = (event) => {
      event.preventDefault();
      isDragging.value = true;
    };
    const onDragLeave = () => {
      isDragging.value = false;
    };

    const getTechName = (val) => {
      const tech = state.techs.find(t => t.id === val);
      return tech ? tech.name : '';
    };

    const getPreqColorClass = (id) => {
      if (id === 'no') return 'bg-light border-danger';
      if (id === 'nil') return 'bg-light';
      const name = getTechName(id);
      if (!name || name.trim() === '') return 'text-light bg-danger';
      return 'text-light bg-primary';
    };

    const setTechPreq = (index, value) => {
      const tech = state.selectedTech;
      techTree.changePreqLink(tech, index, value);
    };

    const focusNode = (nodeId) => {
      if (!nodeId || ['nil', 'no'].includes(nodeId)) return;
      const canvas = network.canvas.frame.canvas;
      const offsetX = canvas.clientWidth * 0.25;
      const offsetY = canvas.clientHeight * 0.25;
      network.focus(nodeId, {
        scale: 0.8,
        offset: { x: -offsetX, y: -offsetY },
        animation: {
          duration: 1000,
          easingFunction: 'easeInOutQuad'
        }
      });
      network.selectNodes([nodeId]);
      state.selectedTech = nodes.get(nodeId).tech;
    };

    const swapPreqs = () => {
      if (!state.selectedTech) return;
      techTree.swapPreqs(state.selectedTech);
      network.redraw();
    };

    const exportRules = async () => {
      rulesTxt.saveToFile(rulesTxt.currentFileName || 'RULES.TXT', ['@CIVILIZE', '@CIVILIZE2']);
    };

    const exportRulesBak = async () => {
      if (!state.techs) return;

      const header = "@CIVILIZE\r\n";
      const body = state.techs.map(t => t.serialize()).join('\r\n');
      const fullText = header + body;

      // Проверяем, поддерживает ли браузер новое API
      if ('showSaveFilePicker' in window) {
        try {
          const handle = await window.showSaveFilePicker({
            suggestedName: 'RULES.TXT',
            types: [{
              description: 'Civ2 Rules File',
              accept: { 'text/plain': ['.TXT'] },
            }],
          });
          const writable = await handle.createWritable();
          await writable.write(fullText);
          await writable.close();
        } catch (err) {
          console.log('Пользователь отменил сохранение или произошла ошибка');
        }
      } else {
        // Фолбэк для старых браузеров (просто скачивание)
        const blob = new Blob([fullText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'RULESOUT.TXT';
        link.click();
        URL.revokeObjectURL(url);
      }
    };

    const getLastModified = computed(() => {
      return document.lastModified;
    })

    return {
      state,
      sidebarVisible,
      visContainer,
      errorModalContainer,
      handleFileUpload,
      handleDrop,
      onDragOver,
      onDragLeave,
      isDragging,
      getTechName,
      getPreqColorClass,
      setTechPreq,
      focusNode,
      swapPreqs,
      exportRules,
      currentFileName,
      errorMessage,
      getLastModified,
    };
  },
}).mount('#app');
