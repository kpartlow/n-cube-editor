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

    var _tempNote = null;
    var _network = null;
    var _nodeDataSet = null;
    var _edgeDataSet = null;
    var _nce = null;
    var _visInfo = null;
    var _loadedAppId = null;
    var _okToLoad = true;
    var _nodes = [];
    var _edges = [];
    var _selectedNode = null;
    var _topNodeScope = null;
    var _keepCurrentScope = false;
    var _selectedGroups = null;
    var _availableGroupsAtLevel = null;
    var _availableGroupsAllLevels = null;
    var _selectedCubeName = null;
    var _selectedLevel = null;
    var _countNodesAtLevel = null;
    var _visualizerInfo = null;
    var _visualizerNetwork = null;
    var _visualizerContent = null;
    var TWO_LINE_BREAKS = '<BR><BR>';
    var _nodeDetailsTitle1 = null;
    var _nodeDetailsTitle2 = null;
    var _nodeCubeLink = null;
    var _resetNodeScopeLink = null;
    var _nodeVisualizer = null;
    var _nodeCellValues = null;
    var _nodeAddTypes = null;
    var _nodeDetails = null;
    var _layout = null;
    var _scopeButton = null;
    var _loadNoteId = null;
    var _findNode = null;
    var UNSPECIFIED = 'UNSPECIFIED';
    var COMPLETE = 'complete';
    var ITERATING = 'iterating...';
    var DOT_DOT_DOT = '...';
    var NA = 'n/a';
    var NO_GROUPS_SELECTED = 'NO GROUPS SELECTED';
    var LEVEL_PREFIX = 'Level ';
    var LOAD_NODE_DETAILS = 'loadNodeDetails';
    var LOAD_SCOPE_CHANGE = 'loadScopeChange';

    //Network layout parameters
    var _hierarchical = false;

    //Network physics
    var _networkOptionsButton = null;
    var _networkOptionsSection = null;
    var _basicStabilizationAfterNetworkUpdate = false;
    var _basicStabilizationAfterInitNetwork = false;
    var _fullStabilizationAfterBasic = false;
    var _networkOptionsVis = {};
    var _networkOptionsBasicStabilization = null;
    var _networkOptionsDefaults = null;
    var _networkOptionsInput = null;
    var _networkOptionsInputHold = null;
    var _networkOverridesBasic = null;
    var _networkOverridesFull = null;
    var _dataLoadStart = null;
    var _basicStabilizationStart = null;
    var _stabilizationStart = null;

    var EAST_MIN_SIZE = 50;
    var EAST_MAX_SIZE = 1000;
    var EAST_SIZE = 250;
    var EAST_LENGTH_OPEN = 60;
    
    function init(info) {
        if (!_nce) {
            _nce = info;

            _layout = $('#visBody').layout({
                name: 'visLayout'
                ,	livePaneResizing:			true
                ,   west__minSize:              EAST_MIN_SIZE
                ,   west__maxSize:              EAST_MAX_SIZE
                ,   west__size:                 EAST_SIZE
                ,   west__closable:             true
                ,   west__resizeable:           true
                ,   west__initClosed:           true
                ,   west__slidable:             true
                ,   center__triggerEventsOnLoad: true
                ,   center__maskContents:       true
                ,   togglerLength_open:         EAST_LENGTH_OPEN
                ,   togglerLength_closed:       '100%'
                ,	spacing_open:			    5  // ALL panes
                ,	spacing_closed:			    5 // ALL panes
            });

            _visualizerContent = $('#visualizer-content');
            _visualizerInfo = $('#visualizer-info');
            _visualizerNetwork = $('#visualizer-network');
            _nodeDetailsTitle1 = $('#nodeDetailsTitle1');
            _nodeDetailsTitle2 = $('#nodeDetailsTitle2');
            _nodeCubeLink = $('#nodeCubeLink');
            _resetNodeScopeLink = $('#resetNodeScopeLink');
            _nodeCellValues = $('#nodeCellValues');
            _nodeAddTypes = $('#nodeAddTypes');
            _nodeVisualizer = $('#nodeVisualizer');
            _nodeDetails = $('#nodeDetails');
            _scopeButton = $('#scopeButton');
            _findNode = $('#findNode');
            _networkOptionsSection = $('#networkOptionsSection');

             $('#selectedLevel-list').on('change', function () {
                 var selectedLevelString = $('#selectedLevel-list').val();
                _selectedLevel = Number(selectedLevelString);
                saveToLocalStorage(_selectedLevel, SELECTED_LEVEL);
                reload();
            });


            $('#hierarchical').on('change', function () {
                //Hierarchical mode is disabled due to what appears to be a bug in vis.js or because the
                //visualizer.js code is missing something. Tis problem started when converting to use
                //visjs DataSets for network data.
                //The problem is that when visjs creates the network.body nodes from the network.body.data
                //nodes, it doesn't set the level on the network.body nodes. This causes an exception
                //if hierarchical mode is selected since that mode requires either all or no nodes to
                //have a defined level. Attempted short-term fix in setLevelOnNetworkNodes() method, but it's not enough.
                //TODO: Keep investigating, submit question and possibly a bug fix to visjs.
                $('#hierarchical').prop('checked', false);
                _nce.showNote('Hierarchical mode is currently not available');
                //_hierarchical = this.checked;
                //saveToLocalStorage(_hierarchical, HIERARCHICAL);
                //updateNetworkOptions();
            });

            _findNode.on('change', function () {
                var nodeLabel, nodeLabelLowerCase, nodes, nodeId, note, k, kLen, node, linkText, sourceDescription;
                nodeLabel = _findNode.val();
                if (nodeLabel) {
                    nodeLabelLowerCase = nodeLabel.toLowerCase();
                    nodes = _nodeDataSet.get({
                        filter: function (node) {
                            return node.label && node.label.toLowerCase().indexOf(nodeLabelLowerCase) > -1;
                        }
                    });
                    if (0 === nodes.length) {
                        _nce.showNote(nodeLabel + ' not found');
                    }
                    else if (1 === nodes.length) {
                        _network.selectNodes([nodes[0].id], false);
                        networkSelectNodeEvent(nodes[0].id);
                    }
                    else {
                        note = 'Multiple nodes found: ';
                        note += TWO_LINE_BREAKS + '<pre><ul>';
                        for (k = 0, kLen = nodes.length; k < kLen; k++) {
                            node = nodes[k];
                            linkText = node.label;
                            sourceDescription = node.sourceDescription;
                            if (sourceDescription){
                                linkText += ' via ' + sourceDescription;
                            }
                            note += '<li><a class="findNode" id="' + node.id +  '" href="#">'  + linkText + '</a></li>';
                        }
                        note += '</ul></pre>';
                        _nce.showNote(note);
                    }
                }
                _findNode.val('');
            });

            addSelectAllNoneGroupsListeners();
            addNetworkOptionsListeners();
            addResetVisualizerListener();

            $(window).on('resize', function() {
                 if (_network) {
                    _network.setSize('100%', getVisNetworkHeight());
                }
            });
        }
    }

    function onNoteEvent(e) {
        var target = e.target;
        if ('click' === e.type && target.className.indexOf('findNode') > -1) {
            findNode(target);
        }
    }

    function scopeInputEvent(target) {
        var key, value;
        key = target.id;
        value = target.value;
        value = value ? value.trim() : value;
        scopeChange(key, value);
    }

    function scopeClickEvent(target) {
        var id, scopeParts, key, value;
        id = target.id;
        if (id) {
            scopeParts = id.split(':');
            key = scopeParts[0];
            value = scopeParts[1].trim();
            scopeChange(key, value);
        }
    }

    function setScopeValue(scope, key, value){
        if (value === null || value === 'Default' || value.length === 0){
            delete scope[key];
        }
        else{
            scope[key] = value;
        }
    }

    function findNode(target) {
        _network.selectNodes([target.id], false);
        networkSelectNodeEvent(target.id);
        _nce.clearNote();
    }

    function addNetworkOptionsListeners() {
        $('#networkOptionsButton').click(function () {
            var button = $('#networkOptionsButton');
            button.toggleClass('active');
            _networkOptionsButton = button.hasClass('active');
            saveToLocalStorage(_networkOptionsButton, NETWORK_OPTIONS_DISPLAY);
            _networkOptionsSection.toggle();
            loadNetworkOptionsSectionView();
        });

        $('#networkOptionsChangeSection').change(function (e) {
            var target, keys;
            target = e.target;
            keys = target.id.split('.');
            setNetworkOption(target, _networkOptionsInput, keys);
            networkChangeEvent();
        });
    }
    
    function addSelectAllNoneGroupsListeners() {
        $('#selectAll').on('click', function (e) {
            e.preventDefault();
            $('#groups').find('button').addClass('active');
            Array.prototype.push.apply(_selectedGroups, _availableGroupsAllLevels);
            saveToLocalStorage(_selectedGroups, SELECTED_GROUPS);
            reload();
        });

        $('#selectNone').on('click', function (e) {
            e.preventDefault();
            $('#groups').find('button').removeClass('active');
            _selectedGroups = [];
            saveToLocalStorage(NO_GROUPS_SELECTED, SELECTED_GROUPS);
            reload();
        });
    }

    function addResetVisualizerListener() {
        $('#resetVisualizer').on('click', function (e) {
            e.preventDefault();
            _loadedAppId = null;
            _selectedNode = null;
            _topNodeScope = null;
            _selectedGroups = null;
            _selectedLevel = null;
            _hierarchical = null;
            _networkOptionsButton = null;
            saveAllToLocalStorage();
            load();
        });

    }

    function setNetworkOption(inputOption, options, keys) {
        var key, value, errorMessage;
        if (keys) {
            key = keys[0];
            value = options[key];
            if (typeof value === OBJECT)
            {
                keys.splice(key, 1);
                setNetworkOption(inputOption, value, keys)
            }
            else if (BOOLEAN === typeof value)
            {
                options[key] = inputOption.checked;
            }
            else if (NUMBER === typeof value)
            {
                options[key] = Number(inputOption.value);
            }
            else if (FUNCTION === typeof value)
            {
                //Not currently supporting updating of netork options that are functions (only one).
            }
            else
            {
                options[key] = inputOption.value;
            }
        }
        else
        {
            errorMessage = 'Invalid state encountered while updating network options for parameter ' + inputOption.attr('id') + '.';
            _nce.showNote(errorMessage);
            throw new Error(errorMessage);
        }
    }

    function initNetworkOptions(container) {
        var emptyDataSet, emptyNetwork, copy;
        _basicStabilizationAfterInitNetwork  = true;
        _networkOptionsSection.hide();

        _networkOverridesBasic = $.extend(true, {}, _visInfo.networkOverridesBasic);
        _networkOverridesFull = $.extend(true, {}, _visInfo.networkOverridesFull);
        formatNetworkOverrides(_networkOverridesBasic);
        formatNetworkOverrides(_networkOverridesFull);
        _networkOverridesBasic.height = getVisNetworkHeight();

        emptyDataSet = new vis.DataSet({});
        emptyNetwork = new vis.Network(container, {nodes: emptyDataSet, edges: emptyDataSet}, {});
        _networkOptionsVis.physics = emptyNetwork.physics.defaultOptions;
        _networkOptionsVis.layout = emptyNetwork.layoutEngine.defaultOptions;
        _networkOptionsVis.nodes = emptyNetwork.nodesHandler.defaultOptions;
        _networkOptionsVis.edges = emptyNetwork.edgesHandler.defaultOptions;
        _networkOptionsVis.interaction = emptyNetwork.interactionHandler.defaultOptions;
        _networkOptionsVis.manipulation = emptyNetwork.manipulation.defaultOptions;
        _networkOptionsVis.groups = emptyNetwork.groups.defaultOptions;
        emptyNetwork.destroy();

        //TODO: Figure out why these keys throw "unknown" exception in vis when set on the network despite originating
        //TODO: from vis. Removing keys for now.
        delete _networkOptionsVis.physics.barnesHut['theta'];
        delete _networkOptionsVis.physics.forceAtlas2Based['theta'];
        delete _networkOptionsVis.physics.repulsion['avoidOverlap'];

        formatNetworkOverridesForSize();

        copy = $.extend(true, {}, _networkOptionsVis);
        _networkOptionsBasicStabilization = $.extend(true, copy, _networkOverridesBasic);
        _networkOptionsInput = $.extend(true, {}, _networkOptionsBasicStabilization);
    }

    function loadNetworkOptionsSectionView()
    {
        var button = $('#networkOptionsButton');
        var section =  $('#networkOptionsChangeSection');
        section.empty();
        button.prop('checked', _networkOptionsButton);
        if (_networkOptionsButton)
        {
            button.addClass('active');
            _networkOptionsSection.show();
            buildNetworkOptionsChangeSection( section, null, _networkOptionsInput, _networkOptionsDefaults, _networkOptionsVis);
        }
        else
        {
            button.removeClass('active');
            _networkOptionsSection.hide();
        }
    }

    function buildNetworkOptionsChangeSection(section, parentKey, networkOptions, networkOptionsDefaults, networkOptionsVis)
    {
        var rowBordersDiv, col1Div, col2Div, col3Div, col4Div, col5Div, col2Span, col2Input, col4Input, col5Input, fullKey,
            defaultValue, value, keys, key, k, kLen, keyVis, valueVis, highlightedClass, readOnly, readOnlyClass, functionTitle;

        keys = Object.keys(networkOptionsDefaults);
        for (k = 0, kLen = keys.length; k < kLen; k++) {
            key = keys[k];
            defaultValue = networkOptionsDefaults[key];
            value = networkOptions[key];
            if (networkOptionsVis)
            {
                keyVis =  key in networkOptionsVis ? key : null;
                valueVis = networkOptionsVis[key];
            }
            else
            {
                keyVis = null;
                valueVis = null;
            }

            fullKey = null === parentKey ? key : parentKey + '.' + key;

            if (typeof defaultValue === OBJECT)
            {
                buildNetworkOptionsChangeSection(section, fullKey, value, defaultValue, valueVis);
            }
            else
            {
                rowBordersDiv = $('<div/>').prop({class: "row borders"});
                col1Div = $('<div/>').prop({class: "col-md-4", align: "right"});
                col2Div = $('<div/>').prop({class: "col-md-1"});
                col3Div = $('<div/>').prop({class: "col-md-1"});
                col4Div = $('<div/>').prop({class: "col-md-2"});
                col5Div = $('<div/>').prop({class: "col-md-4"});

                highlightedClass = value === defaultValue ? '' : ' highlighted';
                if (typeof defaultValue === BOOLEAN) {
                    col2Span = $('<span/>').prop({class: highlightedClass});
                    col2Input = $('<input/>').prop({class: 'networkOption', id: fullKey, type: "checkbox" });
                    col2Input[0].checked = value;
                    col4Input = $('<input/>').prop({class: 'readOnly', id: fullKey + 'Default', type: "checkbox", readOnly: "true"});
                    col4Input[0].checked = defaultValue;
                }
                else {
                    readOnly = FUNCTION === typeof value;
                    readOnlyClass = readOnly ? ' readOnly' : '';
                    functionTitle = "Not currently supporting update of network options that are functions.";
                    col2Span = $('<span/>');
                    col2Input = $('<input/>').prop({class: 'networkOption' + highlightedClass + readOnlyClass, id: fullKey, type: "text", readOnly: readOnly, title: functionTitle});
                    col2Input[0].value = value;
                    col4Input = $('<input/>').prop({class: 'readOnly', id: fullKey + 'Default', type: "text", readOnly: "true"});
                    col4Input[0].value = defaultValue;
                }
                col1Div[0].innerHTML = fullKey;
                col2Span.append(col2Input);
                col2Div.append(col2Span);
                col3Div[0].innerHTML = NBSP;
                col4Div.append(col4Input);

                if (keyVis)
                {
                    if (valueVis === defaultValue)
                    {
                        col5Div[0].innerHTML = NBSP;
                    }
                    else if (BOOLEAN === typeof valueVis )
                    {
                        col5Input = $('<input/>').prop({class: 'readOnly', id: fullKey, type: "checkbox", readOnly: "true"});
                        col5Input[0].checked = valueVis;
                        col5Div.append(col5Input);
                    }
                    else
                    {
                        col5Input = $('<input/>').prop({class: 'readOnly', id: fullKey, type: "text", readOnly: "true"});
                        col5Input[0].value = valueVis;
                        col5Div.append(col5Input);
                    }
                }
                else
                {
                    col5Div[0].innerHTML = 'Parameter does not exist in Vis'
                }
                rowBordersDiv.append(col1Div);
                rowBordersDiv.append(col2Div);
                rowBordersDiv.append(col3Div);
                rowBordersDiv.append(col4Div);
                rowBordersDiv.append(col5Div);
            }
            section.append(rowBordersDiv);
        }
    }

    function scopeChange(key, value)
    {
        if ('1' === _selectedNode.id){
            setScopeValue(_topNodeScope, key, value);
            saveToLocalStorage(_topNodeScope, SCOPE);
        }
        setScopeValue(_selectedNode.availableScope, key, value);
        load(LOAD_SCOPE_CHANGE, 'Changing scope...');
    }

    function reload() {
        trimNetworkData();
        loadSelectedLevelListView();
        loadGroupsView();
        loadCountsView();
        _visualizerInfo.show();
        _visualizerNetwork.show();
     }

    function load(action, note) {
        if (_okToLoad) {
            _okToLoad = false;
            _dataLoadStart = performance.now();
            $("#dataLoadStatus").val('loading');
            $("#dataLoadDuration").val(DOT_DOT_DOT);
            setTimeout(function () {
                if (LOAD_NODE_DETAILS === action){
                    loadNodeDetails();
                }
                else if (LOAD_SCOPE_CHANGE === action){
                    loadScopeChange();
                }
                else{
                    loadGraph();
                }
            }, PROGRESS_DELAY);

            if (!note){
                note = 'Loading visualizer...';
            }
            showLoadNote(note);
        }
    }

    function loadGraph() {
        var options, result, selectedCubeName;
        destroyNetwork();

        if (!_nce.getSelectedCubeName()) {
             _visualizerContent.hide();
            _nce.clearNote();
            _nce.showNote('Failed to load visualizer: ' + TWO_LINE_BREAKS + 'No cube selected.');
            _okToLoad = true;
            return;
        }

        if (_loadedAppId && !appIdMatch(_loadedAppId, _nce.getSelectedTabAppId())) {
            _visInfo = null;
        }

        //TODO: The .replace is temporary until figured out why nce.getSelectedCubeName()
        //TODO: occasionally contains a cube name with "_" instead of "." (e.g. rpm_class_product instead of
        //TODO: rpm.class.product) after a page refresh.
        selectedCubeName = _nce.getSelectedCubeName().replace(/_/g, '.');
        if (selectedCubeName !== _selectedCubeName){
             _selectedNode = null;
        }
        _selectedCubeName = selectedCubeName;
        
        getAllFromLocalStorage();
        options = {startCubeName: _selectedCubeName, visInfo: _visInfo, scope: _topNodeScope};
        result = _nce.call('ncubeController.getVisualizerGraph', [_nce.getSelectedTabAppId(), options]);

        if (result.status) {
            _visInfo = result.data.visInfo;
            displayMessages(_visInfo.messages);
            populateDataForGraph();
            initNetwork();
            loadSelectedLevelListView();
            loadHierarchicalView();
            loadGroupsView();
            loadCountsView();
            saveAllToLocalStorage();
            _visualizerContent.show();
            _visualizerInfo.show();
            _visualizerNetwork.show();
            _network.selectNodes([_selectedNode.id], false);
            networkSelectNodeEvent(_selectedNode.id);
        }
        else{
            _nce.clearNote();
            _nce.showNote(result.data);
            _visualizerContent.hide();
        }
        $("#dataLoadStatus").val(COMPLETE);
        $("#dataLoadDuration").val(Math.round(performance.now() - _dataLoadStart));
        _okToLoad = true;
        _loadedAppId = _nce.getSelectedTabAppId();
    }

    function loadScopeChange() {
        var options, result;
        _visInfo.selectedNodeId = _selectedNode.id;
        _selectedNode = null;
        options = {startCubeName: _selectedCubeName, visInfo: _visInfo};
        result = _nce.call('ncubeController.getVisualizerScopeChange', [_nce.getSelectedTabAppId(), options]);

        if (result.status) {
            _visInfo = result.data.visInfo;
            _selectedNode = getNodeFromVisInfo(_visInfo.selectedNodeId.toString());
            displayMessages();
            populateDataForGraph();
            updateNetwork();
            loadSelectedLevelListView();
            loadHierarchicalView();
            loadGroupsView();
            loadCountsView();
            saveAllToLocalStorage();
            _network.selectNodes([_selectedNode.id], false);
            networkSelectNodeEvent(_selectedNode.id);
        }
        else{
            _nce.clearNote();
            _nce.showNote(result.data);
            _visualizerContent.hide();
        }

        $("#dataLoadStatus").val(COMPLETE);
        $("#dataLoadDuration").val(Math.round(performance.now() - _dataLoadStart));
        _okToLoad = true;
    }

    function loadNodeDetails()
    {
        var options, result;
        _visInfo.selectedNodeId = _selectedNode.id;
        _selectedNode = null;
        options =  {startCubeName: _selectedCubeName, visInfo: _visInfo};
        result = _nce.call('ncubeController.getVisualizerNodeDetails', [_nce.getSelectedTabAppId(), options]);

        if (result.status) {
            _visInfo = result.data.visInfo;
            displayMessages();
            populateDataForNode();
            loadDetailsSection();
        }
        else{
            _nce.clearNote();
            _nce.showNote('Failed to load details: ' + TWO_LINE_BREAKS + result.data);
        }
        $("#dataLoadStatus").val(COMPLETE);
        $("#dataLoadDuration").val(Math.round(performance.now() - _dataLoadStart));
        _okToLoad = true;
    }

    function populateDataForNode(){
        var dataSetNode;
        _nodes = _visInfo.nodes['@items'];
        _selectedNode = getNodeFromVisInfo(_visInfo.selectedNodeId.toString());
        if ('1' === _selectedNode.id){
            _topNodeScope = _selectedNode.availableScope;
        }

        dataSetNode = _nodeDataSet.get(_selectedNode.id);
        dataSetNode.details = _selectedNode.details;
        dataSetNode.showCellValuesLink = _selectedNode.showCellValuesLink;
        dataSetNode.showCellValues = _selectedNode.showCellValues;
        dataSetNode.cubeLoaded = _selectedNode.cubeLoaded;
        dataSetNode.executeCell = _selectedNode.executeCell;
        dataSetNode.executeCells = _selectedNode.executeCells;
        dataSetNode.scope = _selectedNode.scope;
        dataSetNode.availableScope = _selectedNode.availableScope;
        dataSetNode.availableScopeValues = _selectedNode.availableScopeValues;
        dataSetNode.scopeCubeNames = _selectedNode.scopeCubeNames;
        _nodeDataSet.update(dataSetNode);
    }

    function displayMessages(){
        var j, jLen, messages;
        messages = _visInfo.messages['@items'];
        if (messages) {
            _nce.clearNote();
            for (j = 0, jLen = messages.length; j < jLen; j++) {
                _nce.showNote(messages[j]);
            }
        }
    }

    function getNodeFromVisInfo(nodeId){
        var node, k, kLen;
        for (k = 0, kLen = _nodes.length; k < kLen; k++) {
            node = _nodes[k];
            if (node.id === nodeId){
                return node;
            }
        }
    }

    function appIdMatch(appIdA, appIdB)
    {
        return appIdA.appId === appIdB.appId &&
            appIdA.version === appIdB.version &&
            appIdA.status ===  appIdB.status &&
            appIdA.branch === appIdB.branch;
    }

    function clearVisLayoutWest(){
        _nodeDetailsTitle1[0].innerHTML = '';
        _nodeDetailsTitle2[0].innerHTML = '';
        _nodeCubeLink[0].innerHTML = '';
        _resetNodeScopeLink[0].innerHTML = '';
        _nodeVisualizer[0].innerHTML = '';
        _nodeCellValues[0].innerHTML = '';
        _nodeAddTypes.innerHTML = '';
        _nodeDetails[0].innerHTML = '';
        _selectedNode = null;
        _layout.close('west');
    }

    function loadHierarchicalView() {
        $('#hierarchical').prop('checked', _hierarchical);
    }
    
    function showLoadNote(message) {
        if (message){
            if (_loadNoteId && _nce.updateNote(_loadNoteId, 'loadMessage', message)){
                return;
            }
            _loadNoteId = _nce.showNote('<div id="loadMessage">' + message + '</div>', ' ', null);
        }
        else{
            _nce.clearNote();
        }

    }

    function loadGroupsView() {
        var groupName, id, available, label, title, input, selected, button, groups,
            background, fontMap, color, groupMap, boxShadow, j, jLen, k, kLen, divGroups, groupSuffix, allGroups;

        divGroups = $('#groups');
        divGroups.empty();
        groups = _networkOptionsInput.groups;
        groupSuffix =  _visInfo.groupSuffix;
        allGroups = _visInfo.allGroups;

        _availableGroupsAllLevels.sort();
        for (j = 0, jLen = _availableGroupsAllLevels.length; j < jLen; j++) {
            color = null;
            boxShadow = '';
            groupName = _availableGroupsAllLevels[j];
            id = groupName + groupSuffix;
            available = groupCurrentlyAvailable(id);
            label = allGroups[groupName];
            title = available ? "Show/hide " + label + " in the graph" : "Increase level to enable show/hide of " + label + " in the graph";
            selected = false;
            for (k = 0, kLen = _selectedGroups.length; k < kLen; k++) {
                if (groupIdsEqual(id, _selectedGroups[k])) {
                    selected = true;
                    break;
                }
            }

            groupMap = groups.hasOwnProperty(groupName) ? groups[groupName] : _networkOptionsInput.groups[UNSPECIFIED];
            background = groupMap.color.background;
            fontMap = groupMap.font;
            if (fontMap) {
                color = fontMap.hasOwnProperty('buttonColor') ? fontMap.buttonColor : fontMap.color;
            }
            if (!color) {
                color = '#000000';
            }

            button = $('<button/>').addClass('btn');
            if (selected) {
                button.addClass('active btn-primary-group');
                boxShadow = 'box-shadow: 0 4px #575757;';
            } else if (available) {
                button.addClass('btn-default-group');
            } else {
                button.addClass('btn-default-group');
                button.attr({disabled: 'disabled'});
            }
            button.attr({style:'background: ' +  background + '; color: ' + color + ';font-size: 12px; padding: 3px; margin-right: 3px; margin-bottom: 7px;border-radius: 15px;' + boxShadow});
            button.attr({'data-cat': label, 'data-toggle': "buttons", 'id': id, 'title': title});
            input = $('<input>').attr({type: 'checkbox', autocomplete: 'off'});
            button.append(input);
            button.append(label);
            button.click(function (e) {
                e.preventDefault();
                groupChangeEvent(this.id);
            });
            divGroups.append(button);
        }
    }
    
    function groupChangeEvent(groupId)
    {
        var button, i, len, k, kLen;

        $('#groups').find('button').each(function()
        {
            button = $(this);
            if(button.attr('id') === groupId){

                if  (button.hasClass('active'))
                {
                    for (i = 0, len = _selectedGroups.length; i < len; i++) {
                        if (groupIdsEqual(groupId, _selectedGroups[i])) {
                            _selectedGroups.splice(i, 1);
                            button.removeClass('active');
                            break;
                        }
                    }
                }
                else
                {
                    for (k = 0, kLen = _availableGroupsAllLevels.length; k < kLen; k++)
                    {
                        if (groupIdsEqual(groupId, _availableGroupsAllLevels[k])) {
                            _selectedGroups.push(_availableGroupsAllLevels[k]);
                            button.addClass('active');
                            break;
                        }
                    }
                }
                saveToLocalStorage(_selectedGroups, SELECTED_GROUPS);
                reload();
             }
        });
    }

    function groupCurrentlyAvailable(groupId)
    {
        var l;
        for ( l = 0; l < _availableGroupsAtLevel.length; l++)
        {
            if (groupIdsEqual(groupId, _availableGroupsAtLevel[l]))
            {
                return true;
            }
        }
        return false
    }

    function groupIdsEqual(groupId1, groupId2)
    {
        var groupSuffix = _visInfo.groupSuffix;
        var groupId1Prefix = groupId1.split(groupSuffix)[0];
        var groupId2Prefix = groupId2.split(groupSuffix)[0];
        return groupId1Prefix === groupId2Prefix;
    }

    function loadCountsView()
    {
        var  maxLevel, totalNodeCount, maxLevelLabel, nodeCountLabel, nodesDisplayingAtLevelCount, nodesAtLevelLabel;
        maxLevel = _visInfo.maxLevel;
        totalNodeCount = _nodes.length;
        maxLevelLabel = 1 === maxLevel ? 'level' : 'levels';
        nodeCountLabel = 1 === totalNodeCount ? 'node' : 'nodes';

        nodesDisplayingAtLevelCount = _network.body.data.nodes.length;
        nodesAtLevelLabel = 1 === nodesDisplayingAtLevelCount ? 'node' : 'nodes';

        $('#levelCounts')[0].textContent = nodesDisplayingAtLevelCount  + ' ' + nodesAtLevelLabel + ' of ' + _countNodesAtLevel + ' at current level';
        $('#totalCounts')[0].textContent = totalNodeCount + ' ' + nodeCountLabel + ' total over ' +  maxLevel + ' ' + maxLevelLabel ;
    }

    function loadSelectedLevelListView()
    {
        var option, j, select, levelNodeCounts, levelNodeCount, optionLabel, optionValue, nodeCountLabel ;
        select = $('#selectedLevel-list');
        select.empty();
        levelNodeCounts = _visInfo.levelCumulativeNodeCount['@items'];

        for (j = 1; j <= _visInfo.maxLevel; j++)
        {
            option = $('<option/>');
            optionValue = j.toString();
            levelNodeCount = levelNodeCounts[j - 1].value;
            nodeCountLabel = 1 === levelNodeCount ? ' node' : ' nodes';
            optionLabel = LEVEL_PREFIX + optionValue + ' - ' + levelNodeCount + nodeCountLabel;
            option[0].value = optionValue;
            option[0].textContent = optionLabel;
            select.append(option);
            if (j === _selectedLevel){
                select.val(j);
            }
        }
    }

    function getVisNetworkHeight() {
        return  '' + ($(this).height() - $('#network').offset().top);
    }
    
    function isSelectedGroup(node)
    {
        var j, jLen;
        if (_selectedGroups) {
            for (j = 0, jLen = _selectedGroups.length; j < jLen; j++) {
                if (groupIdsEqual(node.group, _selectedGroups[j])) {
                    return true;
                }
            }
        }
        return false;
    }

    function trimNetworkData()
    {
        trimNetworkDataNodes();
        trimNetworkDataEdges();
    }

    function trimNetworkDataNodes()
    {
        var node, selectedGroup, groupNamePrefix, i, iLen;
        var groupSuffix = _visInfo.groupSuffix;
        var nodeIdsToRemove = [];
        var nodesToAddBack = [];
        var level = _selectedLevel;
        var selectedGroups = [];
        var availableGroupsAtLevel = [];
        _countNodesAtLevel = 0;

        //given the selected level, determine nodes to exclude, nodes to add back, selected groups and available groups
        for (i = 0, iLen = _nodes.length; i < iLen; i++)
        {
            node  = _nodes[i];

            selectedGroup = isSelectedGroup(node);

            if (parseInt(node.level) > level)
            {
                nodeIdsToRemove.push(node.id);
            }
            else {
                if (selectedGroup) {
                    //collect selected groups at level
                    groupNamePrefix = node.group.replace(groupSuffix, '');
                    if (_selectedGroups.indexOf(groupNamePrefix) > -1 && selectedGroups.indexOf(groupNamePrefix) === -1) {
                        selectedGroups.push(groupNamePrefix);
                    }
                    if (!_nodeDataSet.get(node.id)){
                        nodesToAddBack.push(node);
                    }
                }
                else{
                    nodeIdsToRemove.push(node.id);
                }
                //collect available groups at level
                groupNamePrefix = node.group.replace(groupSuffix, '');
                if (availableGroupsAtLevel.indexOf(groupNamePrefix) === -1)
                {
                    availableGroupsAtLevel.push(groupNamePrefix)
                }
                _countNodesAtLevel++;
            }
        }
        _nodeDataSet.remove(nodeIdsToRemove);
        _nodeDataSet.add(nodesToAddBack);
        _selectedGroups = selectedGroups;
        _availableGroupsAtLevel = availableGroupsAtLevel;
    }

    function trimNetworkDataEdges()
    {
        var edge, k, kLen;
        var edgeIdsToRemove = [];
        var edgesToAddBack = [];

        //given the selected level, determine edges to exclude and edges to add back
        if (_edges) {
            for (k = 0, kLen = _edges.length; k < kLen; k++) {
                edge = _edges[k];

                if (parseInt(edge.level) > _selectedLevel) {
                    edgeIdsToRemove.push(edge.id);
                }
                else if (!_edgeDataSet.get(edge.id)) {
                    edgesToAddBack.push(edge);
                }
            }
        }
        _edgeDataSet.remove(edgeIdsToRemove);
        _edgeDataSet.add(edgesToAddBack);
    }

    function populateDataForGraph()
    {
        var maxLevel;

        _nodes = _visInfo.nodes['@items'];
        _edges = _visInfo.edges['@items'];
        _nodes =  _nodes ? _nodes : [];
        _edges = _edges ? _edges : [];

        _availableGroupsAllLevels = _visInfo.availableGroupsAllLevels['@items'];
        if (_selectedGroups === null || _selectedGroups.length === 1){
            _selectedGroups = _availableGroupsAllLevels;
        }
        maxLevel = _visInfo.maxLevel;
        if (_selectedLevel === null || _selectedLevel === 1){
            _selectedLevel = _visInfo.defaultLevel;
        }
        if (_selectedLevel > maxLevel){
            _selectedLevel = maxLevel;
        }

        _selectedNode = getNodeFromVisInfo(_visInfo.selectedNodeId.toString());
        if ('1' === _selectedNode.id){
            _topNodeScope = _selectedNode.availableScope;
        }
    }

    function formatNetworkOverridesForSize(){
        var k, kLen, group, basicGroupOverrides;
        if (_nodes.length > 50){
            for (k = 0, kLen = _availableGroupsAllLevels.length; k < kLen; k++) {
                group = _availableGroupsAllLevels[k];
                basicGroupOverrides = _networkOverridesBasic.groups[group];
                if ('image' === basicGroupOverrides.shape){
                    basicGroupOverrides.shape = basicGroupOverrides.altshape;
                }
                if (_nodes.length > 100) {
                    _networkOverridesFull.nodes.shadow.enabled = false;
                    _networkOverridesFull.edges.shadow.enabled = false;
                }
            }
        }
    }

    function formatNetworkOverrides(overrides){
        var keys,k, kLen, key, value, valueOfValue, type;
        delete overrides['@type'];
        keys = Object.keys(overrides);
        for (k = 0, kLen = keys.length; k < kLen; k++) {
            key = keys[k];
            value = overrides[key];
            if (OBJECT === typeof value){
                type = value['@type'];
                if (ARRAY_LIST === type){
                    valueOfValue = value['@items'].valueOf();
                    formatNetworkOverrides(valueOfValue);
                    overrides[key] = valueOfValue;
                    delete value['@items'];
                    delete value['@type'];
                }
                else{
                    valueOfValue = value.value;
                    delete value['@type'];
                    if (1 === Object.keys(value).length && undefined !== valueOfValue && OBJECT !== typeof valueOfValue)
                    {
                        if (BIG_DECIMAL === type){
                            overrides[key] = parseFloat(valueOfValue);
                        }
                        else if (NUMBER === typeof valueOfValue){
                            overrides[key] = Number(valueOfValue);
                        }
                        else{
                            overrides[key] = valueOfValue;
                        }
                    }
                    else{
                        formatNetworkOverrides(value);
                    }
                }
            }
            else{
                //primitive value
            }
        }
    }

    function handleCubeSelected() {
        load();
    }

    function destroyNetwork()
    {
        if (_network) {
            _network.destroy();
            _network = null;
        }
    }

    function initNetwork()
    {
        var container = document.getElementById('network');
        
        initNetworkOptions(container);
        _nodeDataSet = new vis.DataSet({});
        _nodeDataSet.add(_nodes);
        _edgeDataSet = new vis.DataSet({});
        _edgeDataSet.add(_edges);
        _network = new vis.Network(container, {nodes: _nodeDataSet, edges: _edgeDataSet}, _networkOptionsInput);
        trimNetworkData();

        _network.on('selectNode', function(params) {
            networkSelectNodeEvent(params.nodes[0]);
        });

        _network.on('deselectNode', function() {
            clearVisLayoutWest();
        });

        _network.on('dragStart', function () {
            networkChangeEvent()
        });

        _network.on('startStabilizing', function () {
            networkStartStabilizingEvent();
        });

        _network.on('stabilized', function (params) {
            networkStabilizedEvent(params);
        });

        _nodeDataSet.on('add', function () {
            networkChangeEvent()
        });

        _nodeDataSet.on('remove', function () {
            networkChangeEvent()
        });

        _edgeDataSet.on('add', function () {
            networkChangeEvent()
        });

        _edgeDataSet.on('remove', function () {
            networkChangeEvent()
        });
    }

    function updateNetwork()
    {
        if (_nodeDataSet.length === _nodes.length){
            _nodeDataSet.clear();
            _nodeDataSet.add(_nodes);
            _edgeDataSet.clear();
            _edgeDataSet.add(_edges);
            trimNetworkData();
        }
        else{
            destroyNetwork();
            initNetwork();
        }
    }

    function networkStartStabilizingEvent(){
        if (_basicStabilizationAfterInitNetwork || _basicStabilizationAfterNetworkUpdate) {
            _basicStabilizationStart = performance.now();
            $("#basicStabilizationStatus").val(ITERATING);
            $("#basicStabilizationIterations").val(DOT_DOT_DOT);
            $("#basicStabilizationDuration").val(DOT_DOT_DOT);
            $("#stabilizationStatus").val(DOT_DOT_DOT);
            $("#stabilizationIterations").val(DOT_DOT_DOT);
            $("#stabilizationDuration").val(DOT_DOT_DOT);
            showLoadNote('Stabilizing network...');
        }
        else if (_fullStabilizationAfterBasic) {
            _stabilizationStart = performance.now();
            $("#stabilizationStatus").val(ITERATING);
        }
        else{
            _stabilizationStart = performance.now();
            $("#basicStabilizationStatus").val(NA);
            $("#basicStabilizationIterations").val(NA);
            $("#basicStabilizationDuration").val(NA);
            $("#stabilizationStatus").val(ITERATING);
            $("#stabilizationIterations").val(DOT_DOT_DOT);
            $("#stabilizationDuration").val(DOT_DOT_DOT);
            showLoadNote('Stabilizing network...');
        }
    }

    function networkStabilizedEvent(params){
        var copy;
        if (_basicStabilizationAfterInitNetwork) {
            _basicStabilizationAfterInitNetwork = false;
            copy = $.extend(true, {}, _networkOptionsBasicStabilization);
            _networkOptionsDefaults = $.extend(true, copy, _networkOverridesFull);
            _networkOptionsInput = $.extend(true, {}, _networkOptionsDefaults);
            basicStabilizationComplete(params.iterations);
        }
        else if (_basicStabilizationAfterNetworkUpdate) {
            _basicStabilizationAfterNetworkUpdate = false;
            _networkOptionsInput = $.extend(true, {}, _networkOptionsInputHold);
            _networkOptionsInputHold = {};
            basicStabilizationComplete(params.iterations);
        }
        else if (_fullStabilizationAfterBasic) {
            _fullStabilizationAfterBasic = false;
             stabilizationComplete(params.iterations);
        }
        else{
            stabilizationComplete(params.iterations);
         }
    }
    
    function stabilizationComplete(iterations){
        showLoadNote();
        if (_tempNote) {
            _nce.showNote(_tempNote, 'Note', 5000);
        }
        _tempNote = null;
        $("#stabilizationStatus").val(COMPLETE);
        $("#stabilizationIterations").val(iterations);
        $("#stabilizationDuration").val(Math.round(performance.now() - _stabilizationStart));
    }
    
    function basicStabilizationComplete(iterations){
        _fullStabilizationAfterBasic = true;
        $("#basicStabilizationStatus").val(COMPLETE);
        $("#basicStabilizationIterations").val(iterations);
        $("#basicStabilizationDuration").val(Math.round(performance.now() - _basicStabilizationStart));
        updateNetworkOptions();
    }

    function networkChangeEvent(){
        if (!_basicStabilizationAfterInitNetwork && !_basicStabilizationAfterNetworkUpdate) {
            _basicStabilizationAfterNetworkUpdate = true;
            _networkOptionsInputHold = $.extend(true, {}, _networkOptionsInput);
            _networkOptionsInput = $.extend(true, {}, _networkOptionsBasicStabilization);
            updateNetworkOptions();
        }
    }

    function networkSelectNodeEvent(nodeId) {
        _selectedNode = getNodeFromVisInfo(nodeId);
        if (!_selectedNode.details) {
           load(LOAD_NODE_DETAILS, 'Loading details...');
        }
        else{
            loadDetailsSection();
        }
    }

    function loadDetailsSection(){
        var cubeName, appId, typesToAdd;
        cubeName = _selectedNode.cubeName;
        appId =_nce.getSelectedTabAppId();

        //Details
        _nodeDetails[0].innerHTML = _selectedNode.details;
        addNodeDetailsListeners();

        //Title
        populateNodeDetailsTitle();

        //Visualize from here link
        _nodeVisualizer[0].innerHTML = '';
        _nodeVisualizer.append(createVisualizeFromHereLink(appId, cubeName));

        //Open cube link
        _nodeCubeLink[0].innerHTML = '';
        _nodeCubeLink.append(createCubeLink(cubeName, appId));

        //Show cell values link
        if (_selectedNode.showCellValuesLink) {
            _nodeCellValues[0].innerHTML = '';
            _nodeCellValues.append(createCellValuesLink());
         }

         //Add link
        _nodeAddTypes[0].innerHTML = '';
        if (_selectedNode.typesToAdd && _selectedNode.showCellValuesLink) {
            typesToAdd = _selectedNode.typesToAdd['@items'];
            if (typeof typesToAdd === OBJECT && typesToAdd.length > 0) {
                createAddTypesDropdown(typesToAdd, _selectedNode.label);
            }
        }

       /* //Reset node scope link
        _resetNodeScopeLink[0].innerHTML = '';
        _resetNodeScopeLink.append(createResetNodeScopeLink());*/

        _layout.open('west');
    }

    function populateNodeDetailsTitle(){
        var title2;
        _nodeDetailsTitle1[0].innerHTML = _selectedNode.detailsTitle1;
        title2 = _selectedNode.detailsTitle2;
        if (typeof title2 === STRING){
            _nodeDetailsTitle2[0].innerHTML = title2;
            _nodeDetailsTitle1.addClass('title1');
        }
        else{
            _nodeDetailsTitle1.removeClass('title1');
            _nodeDetailsTitle2[0].innerHTML = '';
        }
    }


    function addNodeDetailsListeners()
    {
        var target;
        if (!_nodeDetails.hasClass(NOTE_CLASS.HAS_EVENT))
        {
            _nodeDetails.change(function (e) {
                target = e.target;
                if (target.className.indexOf('scopeInput') > -1) {
                    scopeInputEvent(target);
                }
            });
            _nodeDetails.click(function (e) {
                e.preventDefault();
                target = e.target;
                if (target.className.indexOf('scopeClick') > -1) {
                    scopeClickEvent(target);
                }
                else if (target.className.indexOf('resetNodeScope') > -1) {
                    resetNodeScopeEvent();
                }
                else if (target.className.indexOf('scope') === -1) {
                    executeCell(target);
                }
            });
            _nodeDetails.addClass(NOTE_CLASS.HAS_EVENT)
        }
    }

    function executeCell(target) {
        var coordinateId;
        if (target.className.indexOf('expandAll') > -1) {
            $('pre[class^="coord_"]').show();
        }
        else if (target.className.indexOf('collapseAll') > -1) {
            $('pre[class^="coord_"]').hide();
        }
        else if (target.className.indexOf('executedCell') > -1 ||
            target.className.indexOf('InvalidCoordinateException') > -1 ||
            target.className.indexOf('CoordinateNotFoundException') > -1 ||
            target.className.indexOf('Exception') > -1) {
            coordinateId = target.className.split(' ')[1];
            $('pre.' + coordinateId).toggle();
        }
     }

    function updateNetworkOptions()
    {
        loadNetworkOptionsSectionView();
       _network.setOptions(_networkOptionsInput);
    }

    function createVisualizeFromHereLink(appId, cubeName)
    {
        var visualizerLink = $('<a/>');
        visualizerLink.addClass('nc-anc');
        visualizerLink.html('New visual from here');
        visualizerLink.click(function (e) {
            e.preventDefault();
            if (_selectedNode.newVisualFromHereMessage){
                _nce.showNote(_selectedNode.newVisualFromHereMessage);
            }
            else {
                _keepCurrentScope = true;
                _topNodeScope = _selectedNode.availableScope;
                _selectedNode = null;
                _nce.selectCubeByName(cubeName, appId, TAB_VIEW_TYPE_VISUALIZER + PAGE_ID);
            }
        });
        return visualizerLink;
    }

    function createCubeLink(cubeName, appId)
    {
        var cubeLink = $('<a/>');
        cubeLink.addClass('nc-anc');
        cubeLink.html('Open n-cube');
        cubeLink.click(function (e) {
            e.preventDefault();
            _nce.selectCubeByName(cubeName, appId, TAB_VIEW_TYPE_NCUBE + PAGE_ID);
        });
        return cubeLink;
    }

    /*function createResetNodeScopeLink()
    {
        var cubeLink = $('<a/>');
        cubeLink.addClass('nc-anc resetNodeScope');
        cubeLink.html('Reset scope');
        cubeLink.click(function (e) {
            e.preventDefault();
            _selectedNode.scope = {};
            _selectedNode.availableScope = {};
            if ('1' === _selectedNode.id){
                _topNodeScope = null;
                saveToLocalStorage(_topNodeScope, SCOPE);
            }
            load();
        });
        return cubeLink;
    }*/

    function createCellValuesLink(node) {
        var cellValuesLink = $('<a/>');
        cellValuesLink.addClass('nc-anc');
        if (_selectedNode.showCellValues) {
            cellValuesLink.html('Hide ' + _visInfo.cellValuesLabel);
        }
        else {
            cellValuesLink.html('Show ' + _visInfo.cellValuesLabel);
        }
        cellValuesLink.click(function (e) {
            var note;
            e.preventDefault();
            if (_visInfo.cellValuesLabel === 'cell values'){
                _nce.showNote('Show cell values for n-cubes is currently not available.'); //TODO: Temporary
            }
            else{
                _selectedNode.showCellValues = !_selectedNode.showCellValues;
                _selectedNode.showingHidingCellValues = true;
                note = _selectedNode.showCellValues ? 'Loading ' + _visInfo.cellValuesLabel + '...' : 'Hiding ' + _visInfo.cellValuesLabel + '...';
                load(LOAD_NODE_DETAILS, note);
            }
        });
        return cellValuesLink;
    }

    function createAddTypesDropdown(typesToAdd) {
        var li, addLink, a, ul, i, len;

        addLink = $('<a/>');
        addLink.prop({class: 'nc-anc', id:"addLink" });
        addLink.attr("data-toggle", "dropdown");
        addLink.html('Add to ' + _visInfo.nodeLabel);

        ul = $('<ul/>');
        ul.addClass('dropdown-menu');

        for (i = 0, len = typesToAdd.length; i < len; i++) {
            li = $('<li/>');
            a = $('<a/>');
            a.prop({href: '#' });
            a.html(typesToAdd[i]);
            a.click(function (e) {
                e.preventDefault();
                _nce.showNote('Add ' + this.innerHTML + ' is not yet implemented.');
            });
            li.append(a);
            ul.append(li);
        }

        _nodeAddTypes.append(addLink);
        _nodeAddTypes.append(ul);
    }

    function getFromLocalStorage(key, defaultValue) {
        var local = localStorage[getStorageKey(_nce, key)];
        return local ? JSON.parse(local) : defaultValue;
    }

    function getAllFromLocalStorage() {
        if (_keepCurrentScope) {
            _keepCurrentScope = false;
        }
        else{
            _topNodeScope = getFromLocalStorage(SCOPE, null);
        }

        _selectedGroups = getFromLocalStorage(SELECTED_GROUPS, null);
        if (_selectedGroups === NO_GROUPS_SELECTED) {
            _selectedGroups = [];
        }
        _selectedLevel = getFromLocalStorage(SELECTED_LEVEL, null);
        _hierarchical = getFromLocalStorage(HIERARCHICAL, false);
        _networkOptionsButton = getFromLocalStorage(NETWORK_OPTIONS_DISPLAY, false);
    }

    //TODO: Temporarily override this function in index.js until figured out why nce.getSelectedCubeName()
    //TODO: occasionally contains a cube name with "_" instead of "." (e.g. rpm_class_product instead of
    //TODO: rpm.class.product) after a page refresh.
    function getStorageKey(nce, prefix) {
        //return prefix + ':' + nce.getSelectedTabAppId().app.toLowerCase() + ':' + nce.getSelectedCubeName().toLowerCase();
        return prefix + ':' + nce.getSelectedTabAppId().app.toLowerCase() + ':' + _selectedCubeName.toLowerCase();
    }

    function saveAllToLocalStorage() {
        saveToLocalStorage(_topNodeScope, SCOPE);
        saveToLocalStorage(_selectedGroups, SELECTED_GROUPS);
        saveToLocalStorage(_selectedLevel, SELECTED_LEVEL);
        saveToLocalStorage(_hierarchical, HIERARCHICAL);
        saveToLocalStorage(_networkOptionsButton, NETWORK_OPTIONS_DISPLAY);
    }

    function saveToLocalStorage(value, key) {
        saveOrDeleteValue(value, getStorageKey(_nce, key));
    }

    // Let parent (main frame) know that the child window has loaded.
    // The loading of all of the Javascript (deeply) is continuous on the main thread.
    // Therefore, the setTimeout(, 1) ensures that the main window (parent frame)
    // is called after all Javascript has been loaded.
    if (window.parent.frameLoaded) {
        setTimeout(function () {
            window.parent.frameLoaded(document);
        }, 1);
    }

    return {
        init: init,
        handleCubeSelected: handleCubeSelected,
        load: load,
        onNoteEvent: onNoteEvent
    };

})(jQuery);

function tabActivated(info) {
    Visualizer.init(info);
    Visualizer.load();
}

function cubeSelected() {
    Visualizer.handleCubeSelected();
}

function onNoteEvent(e, element) {
    Visualizer.onNoteEvent(e, element);
}
