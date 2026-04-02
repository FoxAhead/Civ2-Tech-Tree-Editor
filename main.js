import { RulesTxt } from './RulesTxt/RulesTxt.js';
import * as Utils from './utils.js';
import TechTree from './TechTree.js';

const { createApp, reactive, ref, onMounted, watch, computed } = Vue;

const RULES_LOAD_SECTIONS = ['@CIVILIZE', '@IMPROVE', '@UNITS', '@ENDWONDER'];
const WONDER_START_INDEX = 39;
const ICONS = {
  building: '&#127968;',
  wonder: '&#11088;',
  unit: '&#9823;',
  cancel: '&#128683;',
};

// console.log = function () { };

createApp({
  setup() {
    const sidebarVisible = ref(true);
    const searchDropdownContainer = ref(null);
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
      searchDropdownContainer.value.addEventListener('shown.bs.dropdown', searchFocus);
      searchDropdownContainer.value.addEventListener('hidden.bs.dropdown', searchReset);
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
            callback(techTree.canDeleteEdge(edgeData) ? edgeData : null);
          }
        },
        physics: {
          enabled: true,
          hierarchicalRepulsion: Utils.normalPhysics,
        },
      };

      network = new vis.Network(visContainer.value, { nodes: nodes, edges: edges }, options);

      network.on('afterDrawing', function (ctx) {
        // console.log('afterDrawing');
        Utils.drawPreqsPoints(ctx, network, nodes);
      });

      network.on('click', (params) => {
        // console.log('click:', params);
        // if (params.nodes.length === 1)
        //   console.log('node:', nodes.get(params.nodes[0]));
        // if (params.edges.length === 1)
        //   console.log('edge:', edges.get(params.edges[0]));
        state.selectedTech = params.nodes.length > 0 ? nodes.get(params.nodes[0]).tech : null;
      });

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
      Utils.smoothVerticalPositions(network, nodes, edges);
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
        const newRulesTxt = await RulesTxt.loadFromFile('RULES.TXT', RULES_LOAD_SECTIONS);
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
        const newRulesTxt = await RulesTxt.loadFromFile(file, RULES_LOAD_SECTIONS);
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

    const selectTechById = (id) => {
      focusNode(id);
      searchQuery.value = '';
    };

    const swapPreqs = () => {
      if (!state.selectedTech) return;
      techTree.swapPreqs(state.selectedTech);
      network.redraw();
    };

    const exportRules = async () => {
      rulesTxt.saveToFile(rulesTxt.currentFileName || 'RULES.TXT', ['@CIVILIZE', '@CIVILIZE2']);
    };

    const getLastModified = computed(() => {
      return document.lastModified;
    })

    // Related game objects
    const unlockedBuildings = computed(() => {
      if (!state.selectedTech || !rulesTxt?.improve?.data) return [];
      return rulesTxt.improve.data.filter(item => item.preq === state.selectedTech.id && item.index < WONDER_START_INDEX);
    });
    const unlockedWonders = computed(() => {
      if (!state.selectedTech || !rulesTxt?.improve?.data) return [];
      return rulesTxt.improve.data.filter(item => item.preq === state.selectedTech.id && item.index >= WONDER_START_INDEX);
    });
    const unlockedUnits = computed(() => {
      if (!state.selectedTech || !rulesTxt?.units?.data) return [];
      return rulesTxt.units.data.filter(item => item.preq === state.selectedTech.id);
    });
    const canceledWonders = computed(() => {
      if (!state.selectedTech || !rulesTxt?.endWonder?.data || !rulesTxt?.improve?.data) return [];
      return rulesTxt.endWonder.data
        .map((item, index) => ({ ...item, index }))
        .filter(item => item.techId === state.selectedTech.id)
        .map(item => {
          const wonderData = rulesTxt.improve.data[WONDER_START_INDEX + item.index];
          return wonderData ? wonderData.name : `Wonder #${item.index}`;
        });
    });

    // Search functionality
    const searchInputElement = ref(null);
    const searchQuery = ref('');
    const searchReset = () => {
      searchQuery.value = '';
    };
    const searchFocus = () => {
      if (searchInputElement.value) searchInputElement.value.focus();
    };
    const filteredTechs = computed(() => {
      const query = searchQuery.value.toLowerCase().trim();
      if (!query) return state.techs.map(tech => ({ tech: tech, matches: [] }));
      return state.techs.map(tech => {
        const matches = [];
        // 0. Technology
        const techMatches = tech.id.toLowerCase().includes(query) || tech.name.toLowerCase().includes(query);
        // 1. Unit Types
        if (rulesTxt?.units?.data) {
          rulesTxt.units.data.forEach(unit => {
            if (unit.preq === tech.id && unit.name.toLowerCase().includes(query)) {
              matches.push({ type: 'unit', name: unit.name, icon: ICONS.unit });
            }
          });
        }
        // 2. City Improvements
        if (rulesTxt?.improve?.data) {
          rulesTxt.improve.data.forEach((imp, index) => {
            if (imp.preq === tech.id && imp.name.toLowerCase().includes(query)) {
              const isWonder = index >= WONDER_START_INDEX;
              matches.push({
                type: isWonder ? 'wonder' : 'building',
                name: imp.name,
                icon: isWonder ? ICONS.wonder : ICONS.building
              });
            }
          });
        }
        // 3. Canceled Wonders
        if (rulesTxt?.endWonder?.data) {
          rulesTxt.endWonder.data.forEach((ew, index) => {
            if (ew.techId === tech.id) {
              const wonderData = rulesTxt.improve.data[WONDER_START_INDEX + index];
              const name = wonderData ? wonderData.name : `Wonder #${index}`;
              if (name.toLowerCase().includes(query)) {
                matches.push({ type: 'cancel', name: name, icon: ICONS.cancel });
              }
            }
          });
        }
        if (techMatches || matches.length > 0) {
          return { tech: tech, matches: matches };
        }
        return null;
      }).filter(Boolean);
    });
    const highlight = (text) => {
      if (!text) return '';
      const query = searchQuery.value?.trim();
      if (!query) return text;
      const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(${escapedQuery})`, 'gi');
      return String(text).replace(regex, '<mark class="p-0 bg-warning text-dark">$1</mark>');
    };

    return {
      ICONS,
      state,
      sidebarVisible,
      visContainer,
      handleFileUpload,
      getTechName,
      getPreqColorClass,
      setTechPreq,
      focusNode,
      selectTechById,
      swapPreqs,
      exportRules,
      currentFileName,
      // DragDrop file
      handleDrop,
      onDragOver,
      onDragLeave,
      isDragging,
      // Related game objects
      unlockedBuildings,
      unlockedWonders,
      unlockedUnits,
      canceledWonders,
      // Search functionality
      searchDropdownContainer,
      searchQuery,
      searchInputElement,
      filteredTechs,
      highlight,
      // Graph Issues
      errorModalContainer,
      errorMessage,
      // Version
      getLastModified,
    };
  },
}).mount('#app');
