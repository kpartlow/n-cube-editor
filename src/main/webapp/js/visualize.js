/**
 * Graphical representation of n-cubes
 *
 * @author Beata Heekin (bbheekin@gmail.com)
 *         <br>
 *         Copyright (c) Cedar Software LLC
 *         <br><br>
 *         Licensed under the Apache License, Version 2.0 (the "License");
 *         you may not use this file except in compliance with the License.
 *         You may obtain a copy of the License at
 *         <br><br>
 *         http://www.apache.org/licenses/LICENSE-2.0
 *         <br><br>
 *         Unless required by applicable law or agreed to in writing, software
 *         distributed under the License is distributed on an "AS IS" BASIS,
 *         WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *         See the License for the specific language governing permissions and
 *         limitations under the License.
 */

var Visualizer = (function ($) {

    var _network = null;
    var _nce = null;
    var _loadedCubeName = null;
    var _nodesAllLevels = null;
    var _edgesAllLevels = null;
    var _nodesAtLevel = null;
    var _edgesAtLevel = null;
    var _nodesAboveLevel = null;
    var _edgesAboveLevel = null;
    var _nodes = null;
    var _edges = null;
    var _networkData = null;
    var _scope = null;
    var _selectedGroups = null;
    var _availableGroupsAtLevel = null;
    var _availableGroupsAllLevels = null;
    var _allGroups = null;
    var _maxLevel = null;
    var _nodeCount = null;
    var _groupSuffix = null;
    var _startCube = null;
    var _hierarchical = false;
    var _selectedLevel = null;
    var _visualizerInfo = null;
    var _visualizerNetwork = null;
    var _visualizerContent = null;
    var _visualizerHtmlError = null;
    var TWO_LINE_BREAKS = '<BR><BR>';
    var _nodeTitle = null;
    var _nodeDesc = null;
    var _layout = null;
    var _scopeBuilderTable = null;
    var _scopeBuilderModal = null;
    var _savedScope = null;
    var _scopeInput = null;

    var init = function (info) {
        if (!_nce) {
            _nce = info;

            _layout = $('#visBody').layout({
                name: 'visLayout'
                ,	livePaneResizing:			true
                ,   east__minSize:              50
                ,   east__maxSize:              1000
                ,   east__size:                 250
                ,   east__closable:             true
                ,   east__resizeable:           true
                ,   east__initClosed:           true
                ,   east__slidable:             true
                ,   center__triggerEventsOnLoad: true
                ,   center__maskContents:       true
                ,   togglerLength_open:         60
                ,   togglerLength_closed:       '100%'
                ,	spacing_open:			    5  // ALL panes
                ,	spacing_closed:			    5 // ALL panes
            });

            _visualizerContent = $('#visualizer-content');
            _visualizerHtmlError = $('#visualizer-error');
            _visualizerInfo = $('#visualizer-info');
            _visualizerNetwork = $('#visualizer-network');
            _nodeTitle = $('#nodeTitle');
            _nodeDesc = $('#nodeDesc');
            _scopeBuilderTable = $('#scopeBuilderTable');
            _scopeBuilderModal = $('#scopeBuilderModal');
            _scopeInput = $('#scope');

            addScopeBuilderListeners();

            $(window).resize(function() {
                if (_network) {
                    _network.setSize('100%', getVisNetworkHeight());
                }
            });

            $('#selectedLevel-list').change(function () {
                reload($('#selectedLevel-list').val());
            });

            $('#hierarchical').change(function () {
                _hierarchical = this.checked;
                draw();
            });

            _scopeInput.change(function () {
                _scope = buildScopeFromText(this.value);
                load(true);
            });
        }
    };

    function buildScopeFromText(scopeString) {
        var newScope = {};
        var tuples = scopeString.split(',');
        for (var i = 0, iLen = tuples.length; i < iLen; i++) {
            var tuple = tuples[i].split(':');
            var key = tuple[0].trim();
            var value = tuple[1].trim();
            newScope[key] = value;
            var shouldInsertNewExpression = true;
            for (var j = 0, jLen = _savedScope.length; j < jLen; j++) {
                var expression = _savedScope[j];
                if (expression.isApplied && expression.key === key) {
                    expression.value = value;
                    shouldInsertNewExpression = false;
                    break;
                }
            }
            if (shouldInsertNewExpression) {
                _savedScope.push = {isApplied: true, key: key, value: value};
            }
        }
        saveScope();
        return newScope;
    }

    var reload = function (level) {
        trimNetworkData(level);
        draw();
        loadSelectedLevelListView();
        loadAvailableGroupsView();
        loadCountsView();
        _visualizerInfo.show();
        _visualizerNetwork.show();
    };

    var load = function (reloadJson)
    {
        var differentCube = _nce.getSelectedCubeName() !== _loadedCubeName;

        if (reloadJson || differentCube) {
            _nce.clearError();

            var info = _nce.getInfoDto();
            if (!info) {
                _visualizerContent.hide();
                _nce.showNote('Failed to load visualizer: ' + TWO_LINE_BREAKS + 'No cube selected.');
                return;
            }

            if (differentCube)
            {
                //TODO: Save off settings to local storage so they can be retrieved here and used in load of different cube.
                _selectedLevel = null;
                _selectedGroups = null;
                _scope = buildScopeFromText(buildScopeText());
                _hierarchical = false;
                _network = null;
            }

            var options =
            {
                selectedLevel: _selectedLevel,
                startCubeName: _nce.getSelectedCubeName(),
                scope: _scope,
                selectedGroups: _selectedGroups
            };


            var result = _nce.call('ncubeController.getVisualizerJson', [_nce.getSelectedTabAppId(), options]);
            if (result.status === false) {
                _nce.showNote('Failed to load visualizer: ' + TWO_LINE_BREAKS + result.data);
                return;
            }

            var json = result.data;

            if (json.status === 'success') {
                if (json.message !== null) {
                    _nce.showNote(json.message);
                }
                _loadedCubeName = _nce.getSelectedCubeName();
                loadNetworkData(json.map);
                trimNetworkData(null);
                draw();
                loadSelectedLevelListView();
                loadScopeView();
                loadHierarchicalView();
                loadAvailableGroupsView();
                loadCountsView();
                _visualizerContent.show();
                _visualizerInfo.show();
                _visualizerNetwork.show();
            }
            else if (json.status === 'missingScope') {
                _nce.showNote(json.message);
                _loadedCubeName = _nce.getSelectedCubeName();
                _scope = json.scope;
                loadScopeView();
                _visualizerContent.show();
                _visualizerInfo.hide();
                _visualizerNetwork.hide();
            }
            else {
                _visualizerContent.hide();
                var message = json.message;
                if (json.stackTrace != null) {
                    message = message + TWO_LINE_BREAKS + json.stackTrace
                }
                _nce.showNote('Failed to load visualizer: ' + TWO_LINE_BREAKS + message);
            }
        }
    };

    function loadHierarchicalView() {
        $('#hierarchical').prop('checked', _hierarchical);
    }

    function loadScopeView() {
        delete _scope['@type'];
        _scopeInput.val(getScopeString());
    }

    function loadAvailableGroupsView()
    {
        var div = $('#availableGroupsAllLevels');
        div.empty();

        _availableGroupsAllLevels.sort();
        for (var j = 0; j < _availableGroupsAllLevels.length; j++)
        {
            var groupName = _availableGroupsAllLevels[j];
            var id = groupName + _groupSuffix;
            var input = $('<input>').attr({type: 'checkbox', id: id});

            var selected = false;
            for (var k = 0; k < _selectedGroups.length; k++)
            {
                if (groupIdsEqual(id, _selectedGroups[k]))
                {
                    selected = true;
                    break;
                }
            }
            input.prop('checked', selected);

            input.change(function () {
                selectedGroupChangeEvent(this);
            });

            div.append(input);
            div.append(NBSP + _allGroups[groupName] + NBSP + NBSP);
        }
    }

    function getScopeString(){
        var scopeString = '';
        var keys = Object.keys(_scope);
        for (var i = 0, len = keys.length; i < len; i++) {
            var key = keys[i];
            scopeString += key + ':' + _scope[key] + ', ';
        }
        var scopeLen = scopeString.length;
        if (scopeLen > 1) {
            scopeString = scopeString.substring(0, scopeLen - 2);
        }
        return scopeString;
    }

    function selectedGroupChangeEvent(group)
    {
        if (group.checked) {
            for (var k = 0, kLen = _availableGroupsAllLevels.length; k < kLen; k++)
            {
                if (groupIdsEqual(group.id, _availableGroupsAllLevels[k])) {
                    _selectedGroups.push(_availableGroupsAllLevels[k]);
                    break;
                }
            }
        }
        else {
            for (var i = 0, len = _selectedGroups.length; i < len; i++) {
                if (groupIdsEqual(group.id, _selectedGroups[i])) {
                    _selectedGroups.splice(i, 1);
                    break;
                }
            }
        }

        if (groupCurrentlyAvailable(group)){
            reload(_selectedLevel);
        }
    }

    function groupCurrentlyAvailable(group){
        var currentlyIncluded = false;

        for (var l = 0; l < _availableGroupsAtLevel.length; l++)
        {
            if (groupIdsEqual(group.id, _availableGroupsAtLevel[l]))
            {
                currentlyIncluded = true;
                break;
            }
        }

        if (group.checked && !currentlyIncluded) {
            var groupIdPrefix = group.id.split(_groupSuffix)[0];
            var levelLabel = _selectedLevel === 1 ? 'level' : 'levels';
            _nce.showNote('The group ' + groupIdPrefix + ' is not included in the ' + _selectedLevel + ' ' + levelLabel + ' currently displayed. Increase the levels to include the group.', 'Note', 5000);
        }

        return currentlyIncluded
    }

    function groupIdsEqual(groupId1, groupId2)
    {
        var groupId1Prefix = groupId1.split(_groupSuffix)[0];
        var groupId2Prefix = groupId2.split(_groupSuffix)[0];
        return groupId1Prefix === groupId2Prefix;
    }

    function loadCountsView()
    {
        var maxLevelLabel = _maxLevel === 1 ? 'level' : 'levels';
        var nodeCountLabel = _nodeCount === 1 ? 'node' : 'nodes';
        $('#counts')[0].textContent = _nodeCount + ' ' + nodeCountLabel + ' over ' +  _maxLevel + ' ' + maxLevelLabel;
    }

    function loadSelectedLevelListView()
    {
        var select = $('#selectedLevel-list');
        select.empty();

        for (var j = 1; j <= _maxLevel; j++)
        {
            var option = $('<option/>');
            option[0].textContent = j.toString();
            select.append(option);
        }

        select.val('' + _selectedLevel);
    }

    function getVisNetworkHeight() {
        return  '' + ($(this).height() - $('#network').offset().top);
    }

    function trimNetworkData(level)
    {
        var selectedGroups = [];
        var availableGroupsAtLevel = [];
        var nodes = [];
        var edges = [];
        var nodesAtLevel = [];
        var edgesAtLevel = [];
        var nodesAboveLevel = [];
        var edgesAboveLevel = [];
        var nodesToProcess = [];
        var edgesToProcess = [];

        var levelInt = null;
        if (level !=null) {
            levelInt = parseInt(level);
        }
        var selectedLevelInt = parseInt(_selectedLevel);

        //determine which nodes and edges to process
        if (levelInt === null) {
            level =  _selectedLevel;
            levelInt =  selectedLevelInt;
            Array.prototype.push.apply(nodesToProcess, _nodesAllLevels);
            Array.prototype.push.apply(edgesToProcess, _edgesAllLevels);
        }
        else if (levelInt <= selectedLevelInt){
            Array.prototype.push.apply(nodesToProcess, _nodesAtLevel);
            Array.prototype.push.apply(edgesToProcess, _edgesAtLevel);
            Array.prototype.push.apply(nodesAboveLevel, _nodesAboveLevel);
            Array.prototype.push.apply(edgesAboveLevel, _edgesAboveLevel);
        }
        else if (levelInt > selectedLevelInt){
            Array.prototype.push.apply(nodesToProcess, _nodesAboveLevel);
            Array.prototype.push.apply(edgesToProcess, _edgesAboveLevel);
            Array.prototype.push.apply(nodes, _nodesAtLevel);
            Array.prototype.push.apply(edges, _edgesAtLevel);
            Array.prototype.push.apply(nodesAtLevel, _nodesAtLevel);
            Array.prototype.push.apply(edgesAtLevel, _edgesAtLevel);
        }

        //collect nodes
        for (var i = 0, iLen = nodesToProcess.length; i < iLen; i++)
        {
            var isSelectedGroup = false;
            var node  = nodesToProcess[i];

            for (var j = 0, jLen = _selectedGroups.length; j < jLen; j++)
            {
                if (groupIdsEqual(node.group, _selectedGroups[j])){
                    isSelectedGroup = true;
                    break;
                }
            }

            if (parseInt(node.level) <= levelInt) {
                nodesAtLevel.push(node);
                if (isSelectedGroup ) {
                    nodes.push(node);
                }
            } else {
                nodesAboveLevel.push(node);
            }
        }

        //collect edges
        for (var k = 0, kLen = edgesToProcess.length; k < kLen; k++)
        {
            var edge  = edgesToProcess[k];

            if (parseInt(edge.level) <= levelInt) {
                edges.push(edge);
                edgesAtLevel.push(edge);
            } else {
                edgesAboveLevel.push(edge);
            }
        }

        //collect available groups at level
        for (var l = 0, lLen = nodesAtLevel.length; l < lLen; l++) {
            var nodeAtLevel = nodesAtLevel[l];
            var groupNamePrefix = nodeAtLevel.group.replace(_groupSuffix, '');
            if (availableGroupsAtLevel.indexOf(groupNamePrefix) == -1) {
                availableGroupsAtLevel.push(groupNamePrefix);
            }
        }

        for (var m = 0, mLen = nodes.length; m < mLen; m++)
        {
            var node = nodes[m];
            var groupNamePrefix = node.group.replace(_groupSuffix, '');
            if (_selectedGroups.indexOf(groupNamePrefix) > -1 && selectedGroups.indexOf(groupNamePrefix) === -1) {
                selectedGroups.push(groupNamePrefix);
            }
        }

        _nodesAtLevel = nodesAtLevel;
        _edgesAtLevel = edgesAtLevel;
        _nodesAboveLevel = nodesAboveLevel;
        _edgesAboveLevel = edgesAboveLevel;

        _selectedGroups = selectedGroups;
        _availableGroupsAtLevel = availableGroupsAtLevel;
        _selectedLevel = level;

        _nodes = nodes;
        _edges = edges;
        _networkData = {nodes:nodes, edges:edges};
    }

    function loadNetworkData(jsonMap) {
        _allGroups = jsonMap.groups.allGroups;
        _availableGroupsAllLevels = jsonMap.groups.availableGroupsAllLevels;
        _selectedGroups = jsonMap.groups.selectedGroups;
        _selectedLevel = jsonMap.levels.selectedLevel;
        _groupSuffix = jsonMap.groups.groupSuffix;
        _scope = jsonMap.scope;
        _startCube = jsonMap.startCube.substring(jsonMap.startCube.lastIndexOf('.') + 1);
        _nodeCount = jsonMap.levels.nodeCount;
        _maxLevel = jsonMap.levels.maxLevel;
        _nodesAllLevels = jsonMap.nodes;
        _edgesAllLevels = jsonMap.edges;
    }

    var handleCubeSelected = function() {
        load();
    };

    function clusterDescendantsBySelectedNode(nodeId, immediateDescendantsOnly) {
        _network.clusteredNodeIds.push(nodeId);
        clusterDescendants(immediateDescendantsOnly)
    }

    function clusterDescendants(immediateDescendantsOnly) {
        _network.setData(_networkData);
        for (var i = 0; i < _network.clusteredNodeIds.length; i++) {
            var id = _network.clusteredNodeIds[i];
            clusterDescendantsByNodeId(id, immediateDescendantsOnly);
        }
    }

    function clusterDescendantsByNodeId(nodeId, immediateDescendantsOnly) {
        var clusterOptionsByData = getClusterOptionsByNodeId(nodeId);
        _network.clusterDescendants(nodeId, immediateDescendantsOnly, clusterOptionsByData, true)
    }

    function getClusterOptionsByNodeId(nodeId) {
        var clusterOptionsByData;
        return clusterOptionsByData = {
            processProperties: function (clusterOptions, childNodes) {
                var node = getNodeById(childNodes, nodeId);
                clusterOptions.label = node.label + ' cluster (double-click to expand)';
                clusterOptions.title = node.title + TWO_LINE_BREAKS + '(double-click to expand)';
                return clusterOptions;
            }
        };
    }

    function openClusterByClusterNodeId(clusterNodeId)  //TEMP: gets called when a clustered node is clicked
    {
        var nodesInCluster = _network.getNodesInCluster(clusterNodeId);
        for (var i = 0; i < nodesInCluster.length; i++)
        {
            var node = nodesInCluster[i];
            var indexNode = _network.clusteredNodeIds.indexOf(node);
            if (indexNode !== -1)
            {
                _network.clusteredNodeIds.splice(indexNode, 1);
            }
        }
        _network.openCluster(clusterNodeId)
    }

    function draw()
    {
        var container = document.getElementById('network');
        var options = {
            height: getVisNetworkHeight(),
            interaction: {
                navigationButtons: true,
                keyboard: {
                    enabled: false,
                    speed: {x: 5, y: 5, zoom: 0.02}
                },
                zoomView: true
            },
            nodes: {
                scaling: {
                    min: 16,
                    max: 32
                }
            },
            edges: {
                arrows: 'to',
                color: 'gray',
                smooth: true,
                hoverWidth: 3
            },
            physics: {
                barnesHut: {gravitationalConstant: -30000},
                stabilization: {iterations: 2500}
            },
            layout: {
                hierarchical: _hierarchical,
                improvedLayout : true,
                randomSeed:2
            },
            groups: {  //TODO: Add other bus types
                PRODUCT: {
                    shape: 'box',
                    color: '#FF9900' // orange
                },
                RISK: {
                    shape: 'square',
                    color: "#5A1E5C" // purple
                },
                COVERAGE: {
                    shape: 'star',
                    color: "#dbe92b" // yellow
                },
                CONTAINER: {
                    shape: 'star',
                    color: "#731d1d" // dark red
                },
                LIMIT: {
                    shape: 'diamond',
                    color: "#C5000B" // red
                },
                DEDUCTIBLE: {
                    shape: 'diamond',
                    color: "#ffc0cb " // pink
                },
                PREMIUM: {
                    shape: 'ellipse',
                    color: "#2be998" // green
                },
                RATE: {
                    shape: 'ellipse',
                    color: "#2B7CE9" // blue
                },
                RATEFACTOR: {
                    shape: 'ellipse',
                    color: "#2bdbe9" // light blue
                },
                PARTY: {
                    shape: 'box',
                    color: '#004000' // dark green
                },
                PLACE: {
                    shape: 'box',
                    color: '#481849' // dark purple
                },
                PRODUCT_ENUM : {
                    shape: 'dot',
                    color: 'gray'   // gray
                },
                RISK_ENUM : {
                    shape: 'dot',
                    color: 'gray'   // gray
                },
                COVERAGE_ENUM : {
                    shape: 'dot',
                    color: 'gray'   // gray
                },
                LIMIT_ENUM : {
                    shape: 'dot',
                    color: 'gray'   // gray
                },
                PREMIUM_ENUM : {
                    shape: 'dot',
                    color: 'gray'   // gray
                },
                RATE_ENUM : {
                    shape: 'dot',
                    color: 'gray'   // gray
                },
                RATEFACTOR_ENUM : {
                    shape: 'dot',
                    color: 'gray'   // gray
                },
                CONTAINER_ENUM: {
                    shape: 'dot',
                    color: 'gray'   // gray
                },
                DEDUCTIBLE_ENUM: {
                    shape: 'dot',
                    color: 'gray'   // gray
                },
                PARTY_ENUM: {
                    shape: 'dot',
                    color: 'gray'   // gray
                },
                PLACE_ENUM: {
                    shape: 'dot',
                    color: 'gray'   // gray
                }
            }
        };

        if (_network) { // clean up memory
            _network.destroy();
            _network = null;
        }
        _network = new vis.Network(container, _networkData, options);
        customizeNetworkForNce(_network);
        _network.clusteredNodeIds = [];

        _network.on('select', function(params) {
            var node = getNodeById(_nodes, params.nodes[0]);
            if (node) {
                var cubeName = node.name;
                var an = $('<a/>');
                an.addClass('nc-anc');
                an.html(cubeName);
                an.click(function (e) {
                    e.preventDefault();
                    _nce.selectCubeByName(cubeName);
                });
                _nodeTitle[0].innerHTML = 'Class ';
                _nodeTitle.append(an);
                _nodeDesc[0].innerHTML = node.desc;
                _layout.open('east');
            }
        });

        _network.on('doubleClick', function (params) {
            if (params.nodes.length === 1) {
                if (_network.isCluster(params.nodes[0])) {
                    openClusterByClusterNodeId(params.nodes[0]);
                } else {
                    clusterDescendantsBySelectedNode(params.nodes[0], false);
                }
            }
        });
    }

    function getNodeById(nodes, nodeId) {
        for (var i = 0, len = nodes.length; i < len; i++) {
            var node = nodes[i];
            if (node.id === nodeId) {
                return node;
            }
        }
    }

    function customizeNetworkForNce(network) {
        network.clustering.clusterDescendants = function(nodeId, immediateDescendantsOnly, options) {
            var collectDescendants = function(node, parentNodeId, childEdgesObj, childNodesObj, immediateDescendantsOnly, options, parentClonedOptions, _this) {

                // collect the nodes that will be in the cluster
                for (var i = 0; i < node.edges.length; i++) {
                    var edge = node.edges[i];
                    //if (edge.hiddenByCluster !== true) {  //BBH:: commented this line
                    if (edge.hiddenByCluster !== true && edge.toId != parentNodeId) { //BBH: added this line
                        var childNodeId = _this._getConnectedId(edge, parentNodeId);

                        // if the child node is not in a cluster (may not be needed now with the edge.hiddenByCluster check)
                        if (_this.clusteredNodes[childNodeId] === undefined) {
                            if (childNodeId !== parentNodeId) {
                                if (options.joinCondition === undefined) {
                                    childEdgesObj[edge.id] = edge;
                                    childNodesObj[childNodeId] = _this.body.nodes[childNodeId];
                                    if (immediateDescendantsOnly == false) {
                                        collectDescendants(_this.body.nodes[childNodeId], childNodeId, childEdgesObj, childNodesObj, immediateDescendantsOnly, options, parentClonedOptions, _this); //BBH: added this line
                                    }
                                } else {
                                    // clone the options and insert some additional parameters that could be interesting.
                                    var childClonedOptions = _this._cloneOptions(this.body.nodes[childNodeId]);
                                    if (options.joinCondition(parentClonedOptions, childClonedOptions) === true) {
                                        childEdgesObj[edge.id] = edge;
                                        childNodesObj[childNodeId] = _this.body.nodes[childNodeId];
                                        if (immediateDescendantsOnly == false) {
                                            collectDescendants(_this.body.nodes[childNodeId], childNodeId, childEdgesObj, childNodesObj, immediateDescendantsOnly, options, parentClonedOptions, _this); //BBH: added this line
                                        }
                                    }
                                }
                            } else {
                                // swallow the edge if it is self-referencing.
                                childEdgesObj[edge.id] = edge;
                            }
                        }
                    }
                }
            };

            var refreshData = arguments.length <= 3 || arguments[3] === undefined ? true : arguments[3];

            // kill conditions
            if (nodeId === undefined) {
                throw new Error('No nodeId supplied to clusterDescendants!');
            }
            if (this.body.nodes[nodeId] === undefined) {
                throw new Error('The nodeId given to clusterDescendants does not exist!');
            }

            var node = this.body.nodes[nodeId];
            options = this._checkOptions(options, node);
            if (options.clusterNodeProperties.x === undefined) {
                options.clusterNodeProperties.x = node.x;
            }
            if (options.clusterNodeProperties.y === undefined) {
                options.clusterNodeProperties.y = node.y;
            }
            if (options.clusterNodeProperties.fixed === undefined) {
                options.clusterNodeProperties.fixed = {};
                options.clusterNodeProperties.fixed.x = node.options.fixed.x;
                options.clusterNodeProperties.fixed.y = node.options.fixed.y;
            }

            var childNodesObj = {};
            var childEdgesObj = {};
            var parentNodeId = node.id;
            var parentClonedOptions = this._cloneOptions(node);
            childNodesObj[parentNodeId] = node;

            collectDescendants(node, parentNodeId, childEdgesObj, childNodesObj, immediateDescendantsOnly, options, parentClonedOptions, this);

            this._cluster(childNodesObj, childEdgesObj, options, refreshData);
        };

        network.clustering._cloneOptions = function(item, type) {
            var clonedOptions = {};
            var util = vis.util;
            if (type === undefined || type === 'node') {
                util.deepExtend(clonedOptions, item.options, true);
                clonedOptions.x = item.x;
                clonedOptions.y = item.y;
                clonedOptions.amountOfConnections = item.edges.length;
            } else {
                util.deepExtend(clonedOptions, item.options, true);
            }
            return clonedOptions;
        };

        network.clusterDescendants = function () {
            return this.clustering.clusterDescendants.apply(this.clustering, arguments);
        };
    }

    /*================================= BEGIN SCOPE BUILDER ==========================================================*/

    var availableScopeKeys = ['context','action','state','date','product','coverage','risk','classCode','programType','lob','businessUnit','producer','policyControlDate','quoteDate','LocationState'];

    function addScopeBuilderListeners() {
        var builderOptions = {
            title: 'Scope Builder',
            instructionsTitle: 'Instructions - Scope Builder',
            instructionsText: 'Add scoping for visualization.',
            columns: {
                isApplied: {
                    heading: 'Apply',
                    default: true,
                    type: PropertyBuilder.COLUMN_TYPES.CHECKBOX
                },
                key: {
                    heading: 'Key',
                    type: PropertyBuilder.COLUMN_TYPES.SELECT,
                    selectOptions: availableScopeKeys
                },
                value: {
                    heading: 'Value',
                    type: PropertyBuilder.COLUMN_TYPES.TEXT
                }
            },
            afterSave: function() {
                scopeBuilderSave();
            }
        };

        $('#scopeBuilderOpen').click(function() {
            PropertyBuilder.openBuilderModal(builderOptions, _savedScope);
        });
    }

    function scopeBuilderSave() {
        saveScope();
        var newScope = buildScopeText();
        _scopeInput.val(newScope);
        _scope = buildScopeFromText(newScope);
        load(true);
    }

    function getSavedScope() {
        var scopeMap = localStorage[getStorageKey(_nce, SCOPE_MAP)];
        return scopeMap ? JSON.parse(scopeMap) : DEFAULT_SCOPE;
    }

    function saveScope() {
        saveOrDeleteValue(_savedScope, getStorageKey(_nce, SCOPE_MAP));
    }

    function buildScopeText() {
        _savedScope = getSavedScope();
        var scopeText = '';
        for (var i = 0, len = _savedScope.length; i < len; i++) {
            var expression = _savedScope[i];
            if (expression.isApplied) {
                scopeText += expression.key + ':' + expression.value + ', ';
            }
        }
        scopeText = scopeText.substring(0, scopeText.length - 2);
        return scopeText;
    }

    /*================================= END SCOPE BUILDER ============================================================*/

// Let parent (main frame) know that the child window has loaded.
// The loading of all of the Javascript (deeply) is continuous on the main thread.
// Therefore, the setTimeout(, 1) ensures that the main window (parent frame)
// is called after all Javascript has been loaded.
    setTimeout(function() { window.parent.frameLoaded(); }, 1);

    return {
        init: init,
        handleCubeSelected: handleCubeSelected,
        load: load
    };

})(jQuery);

var tabActivated = function tabActivated(info)
{
    Visualizer.init(info);
    Visualizer.load();
};

var cubeSelected = function cubeSelected()
{
    Visualizer.handleCubeSelected();
};
