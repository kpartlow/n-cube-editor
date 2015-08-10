/**
 * NCube Editor
 *     IDE for building and editing NCubes
 *
 * @author John DeRegnaucourt
 */

$(function ()
{
    var head = 'HEAD';
    var _searchThread;
    var _padding = ["", "0", "00", "000", "0000", "00000", "000000", "0000000", "00000000", "000000000", "0000000000" ];
    var _cubeList = {};
    var _apps = [];
    var _statuses = ['RELEASE', 'SNAPSHOT'];
    var _versions = [];
    var _selectedCubeName = localStorage[SELECTED_CUBE];
    var _selectedApp = localStorage[SELECTED_APP];
    var _selectedVersion = localStorage[SELECTED_VERSION];
    var _selectedBranch;
    if (localStorage.getItem(SELECTED_BRANCH) == null)
    {
        localStorage[SELECTED_BRANCH] = head;
        _selectedBranch = head;
    }
    else
    {
        _selectedBranch = localStorage[SELECTED_BRANCH];
    }
    var _testSelectionAnchor = -1;
    var _testData = null;
    var _selectedStatus = "SNAPSHOT";
    var _axisName;
    var _errorId = null;
    var _colIds = -1;   // Negative and gets smaller (to differentiate on server side what is new)
    var _columnList = $('#editColumnsList');
    var _editor;
    var _activeTab = 'ncubeTab';
    var _jsonEditorMode = 'format';
    var _cellId = null;
    var _uiCellId = null;
    var _urlDropdown = $('#datatypes-url');
    var _valueDropdown = $('#datatypes-value');
    var _editCellCache = $('#editCellCache');
    var _editCellValue = $('#editCellValue');
    var _editCellRadioURL = $('#editCellRadioURL');
    var _clipboard = $('#cell-clipboard');
    var _searchNames = $('#cube-search');
    var _searchContent = $('#cube-search-content');
    var _cubeCount = $('#ncubeCount');
    var _listOfCubes= $('#ncube-list');
    var _mergeCubeName = null;
    var _mergeSha1 = null;
    var _mergeHeadSha1 = null;
    var _searchLastKeyTime = Date.now();
    var _searchKeyPressed = false;

    //  modal dialogs
    var _editCellModal = $('#editCellModal');
    var _addParameterModal = $('#addParameterModal');
    var _deleteParameterModal = $('#deleteParameterModal');
    var _createNewTestModal = $('#createNewTestModal');
    var _renameTestModal = $('#renameTestModal');
    var _duplicateTestModal = $('#duplicateTestModal');
    var _deleteTestModal = $('#deleteTestmodal');
    var _selectBranchModal = $('#selectBranchModal');
    var _commitModal = $('#commitRollbackModal');

    //  locations
    var _testResultsDiv = $('#testResultsDiv');
    var _testListWarning = $('#testListWarning');
    var _focusedElement = null;

    initialize();

    function initialize()
    {
        startWorker();
        showActiveBranch();
        loadAppNames();
        loadVersions();
        loadNCubes();
        loadAppListView();
        loadStatusListView();
        loadVersionListView();
        clearSearch();
        buildMenu();
        loop();

        // Set up back button support (base a page on a app, version, status, branch, and cube name)
        $(window).on("popstate", function(e)
        {
            if (e.originalEvent.state !== null)
            {
                var state = e.originalEvent.state;
                _selectedApp = state.app;
                _selectedVersion = state.version;
                _selectedStatus = state.status;
                _selectedCubeName = state.cube;
                _selectedBranch = state.branch;
                showActiveBranch();
                loadAppNames();
                loadVersions();
                loadNCubes();
                loadAppListView();
                loadStatusListView();
                loadVersionListView();
                selectCubeByName(_selectedCubeName);
            }
        });

        $.fn.selectRange = function (start, end)
        {
            if (!end)
            {
                end = start;
            }
            return this.each(function ()
            {
                if (this.setSelectionRange)
                {
                    this.focus();
                    this.setSelectionRange(start, end);
                }
                else if (this.createTextRange)
                {
                    var range = this.createTextRange();
                    range.collapse(true);
                    range.moveEnd('character', end);
                    range.moveStart('character', start);
                    range.select();
                }
            });
        };
        var west = $('#west');
        var appListDiv = $('#app-list-div');
        var appListPanel = appListDiv.find('> .panel-body');
        appListPanel.height(60);

        var statListDiv = $('#status-list-div');
        var statListPanel = statListDiv.find('> .panel-body');
        statListPanel.height(36);

        var verListDiv = $('#version-list-div');
        var verListPanel = verListDiv.find('> .panel-body');
        verListPanel.height(60);

        var ncubeListPanel = $('#ncube-list-div').find('> .panel-body');

        var hApp = appListDiv.height();
        var hStat = statListDiv.height();
        var hVer = verListDiv.height();

        initJsonEditor();
        addListeners();

        var myLayout;
        var secondaryLayout;

        secondaryLayout = $('div#tests').layout({
            name: "secondaryLayout"
            ,   closable:					true	// pane can open & close
            ,	resizable:					true	// when open, pane can be resized
            ,	slidable:					true	// when closed, pane can 'slide' open over other panes - closes on mouse-out
            ,	livePaneResizing:			true
            ,	east__minSize:				170
            ,   togglerLength_open:         60
            ,   togglerLength_closed:       "100%"
            ,	spacing_open:			5  // ALL panes
            ,	spacing_closed:			5 // ALL panes
            //            ,	south__spacing_open:			5  // ALL panes
            //,	south__spacing_closed:			5 // ALL panes
            ,  east__onresize: function()
            {
                calculateTestPanelSize();
            }
        });

        myLayout = $('body').layout({
            name:   "BodyLayout"
            //	reference only - these options are NOT required because 'true' is the default
            ,   closable:					true	// pane can open & close
            ,	resizable:					true	// when open, pane can be resized
            ,	slidable:					true	// when closed, pane can 'slide' open over other panes - closes on mouse-out
            ,	livePaneResizing:			true
            ,   togglerLength_open:         60
            ,   togglerLength_closed:       "100%"
            //	some pane animation settings
            ,	west__animatePaneSizing:	false
            ,   west__fxName_open:          "none"
            ,	west__fxName_close:			"none"	// NO animation when closing west-pane
            ,   spacing_open:         5
            ,   spacing_closed:       5
            ,   west__resizeable:           true
            ,   west__size:                 250
            ,   west__minSize:              140
            //	enable showOverflow on west-pane so CSS popups will overlap north pane
            ,	west__showOverflowOnHover:	true
            ,   center__triggerEventsOnLoad: true
            //	enable state management
            ,	stateManagement__enabled:	false // automatic cookie load & save enabled by default
            //           ,	showDebugMessages:			true // log and/or display messages from debugging & testing code
            //,  west__onresize:		"secondaryLayout.resizeAll" // resize ALL visible layouts nested inside
            ,  west__onresize: function()
            {
                ncubeListPanel.height(west.height() - hApp - hStat - hVer - 158);
                secondaryLayout.resizeAll();
                //                _editor.resize();
            }
        });

        ncubeListPanel.height(west.height() - hApp - hStat - hVer - 158);
        $(document).on( 'shown.bs.tab', 'a[data-toggle="tab"]', function (e)
        {
            secondaryLayout.resizeAll();
            calculateTestPanelSize();
        });

        $(document).keydown(function(e)
        {
            var isModalDisplayed = $('body').hasClass('modal-open');

            var focus = $('input:focus');
            if (_activeTab == 'ncubeTab' && !isModalDisplayed && focus && focus.attr('id') != 'cube-search' && focus.attr('id') != 'cube-search-content')
            {
                if (e.metaKey || e.ctrlKey)
                {   // Control Key (command in the case of Mac)
                    if (e.keyCode == 88 || e.keyCode == 67)
                    {   // Ctrl-C or Ctrl-X
                        editCutCopy(e.keyCode == 88);
                    }
                    else if (e.keyCode == 86)
                    {   // Ctrl-V
                        editPaste();
                    }
                }
            }
        });

        myLayout.resizeAll();
        buildNCubeEditMenu();
    }

    function startWorker()
    {
        if (typeof(Worker) !== "undefined")
        {
            _searchThread = new Worker("js/loadCubeList.js");
            _searchThread.onmessage = function(event)
            {
                var list = event.data;
                loadFilteredNCubeListView(list);
            };
        }
        else
        {
            alert('Sorry! No Web Worker support. Try using the Chrome browser.');
        }
    }

    function buildMenu()
    {
        var result = call('ncubeController.getMenu',[getAppId()])
        if (result.status !== true)
        {
            _errorId = showNote('Unable to load menu.' + result.data);
            return;
        }
        var menu = result.data;
        $('#appTitle').html(menu['~Title']);
        var ul = $('#menuList');
        $.each(menu, function (key, value)
        {
            if (!key.startsWith('~') && !key.startsWith('@'))
            {
                var li = $('<li/>');
                var a = $('<a/>').prop({'id': value['menuId'], 'href': '#' + value['pageId']});
                a.attr({'data-toggle':'tab'});
                a.html(key);
                li.append(a);
                ul.append(li);

                var tabContentDiv = $('#ncubeTabContent');
                var div = $('<div/>').prop({class:'tab-pane', id:value['pageId']});
                div.attr({style:'overflow:hidden;height:100%'});
                tabContentDiv.append(div);

                var iframeId = 'iframe' + value['pageId'];
                var iframe = $('<iframe id="' + iframeId + '"/>');
                div.append(iframe);

                var html = value['html'];
                if (!html.startsWith('http:') && !html.startsWith('https:'))
                {
                    html += '?appId=' + JSON.stringify(getAppId());
                }
                iframe.attr({style:'position:relative;height:100%;width:100%', src:html});

                $('#' + value['menuId']).click(function ()
                {
                    clearError();
                    _activeTab = value['menuId'];
                    loadCube();

                    document.getElementById(iframeId).contentWindow.tabActivated(_cubeList, _selectedCubeName);
                });
            }
        });
    }

    function editPaste()
    {
        if (!ensureModifiable('Cannot paste cells.'))
        {
            return;
        }
        var firstCell = $('td.cell-selected');
        if (!firstCell || firstCell.length < 1)
        {
            return;
        }
        var lastCell = $(firstCell[firstCell.length - 1]);
        firstCell = $(firstCell[0]);

        var table = $(".table-ncube")[0];
        var tableRows = table.rows;

        // Location of first selected cell in 2D spreadsheet view.
        var row = getRow(firstCell);
        var col = getCol(firstCell) - countTH(tableRows[row].cells);

        // Location of the last selected cell in 2D spreadsheet view.
        var lastRow = getRow(lastCell);
        var lastCol = getCol(lastCell) - countTH(tableRows[lastRow].cells);

        var onlyOneCellSelected = row == lastRow && col == lastCol;

        // Point focus to hidden text area so that it will receive the pasted content
        _focusedElement = $(':focus');
        _clipboard.focusin();
        _clipboard.select();

        var content = _clipboard.val();
        if (!content || content == "")
        {
            return;
        }

        // Parse the clipboard content and build-up coordinates where this content will be pasted.
        var values = [];
        var coords = [];
        var firstRow = row;
        var lines = content.split('\n');

        for (var i = 0; i < lines.length; i++)
        {
            if (lines[i] && lines[i] != "")
            {
                var strValues = lines[i].split('\t');
                values.push(strValues);
                var rowCoords = [];
                for (var j = 0; j < strValues.length; j++)
                {
                    var numTH = countTH(tableRows[row].cells);
                    var colIdx = col + j + numTH;
                    if (colIdx < tableRows[row].cells.length)
                    {   // Do attempt to read past edge of 2D grid
                        var domCell = tableRows[row].cells[colIdx]; // This is a DOM "TD" element
                        var jqCell = $(domCell);                    // Now it's a jQuery object.
                        rowCoords[j] = getCellId(jqCell);
                    }
                }
                coords.push(rowCoords);
                row++;

                if (row >= tableRows.length)
                {   // Do not go past bottom of grid
                    break;
                }
            }
        }

        // If more than one cell is selected, create coords for all selected cells.
        // Server will repeat values, properly throughout the selected 'clip' region.
        if (!onlyOneCellSelected)
        {
            coords = [];
            row = firstRow;
            for (var r = firstRow; r <= lastRow; r++)
            {
                rowCoords = [];
                for (var c = col; c <= lastCol; c++)
                {
                    numTH = countTH(tableRows[row].cells);
                    domCell = tableRows[row].cells[c + numTH]; // This is a DOM "TD" element
                    jqCell = $(domCell);                    // Now it's a jQuery object.
                    rowCoords[c - col] = getCellId(jqCell);
                }
                coords.push(rowCoords);
                row++;
            }
        }

        // Paste cells from database
        var result = call("ncubeController.pasteCells", [getAppId(), _selectedCubeName, values, coords]);

        if (result.status)
        {
            reloadCube();
        }
        else
        {
            clearError();
            _errorId = showNote('Error pasting cells:<hr class="hr-small"/>' + result.data);
        }
    }

    function reloadCube()
    {
        var doc = document.documentElement;
        var left = (window.pageXOffset || doc.scrollLeft) - (doc.clientLeft || 0);
        var top = (window.pageYOffset || doc.scrollTop) - (doc.clientTop || 0);
        loadCube();
        window.scrollTo(left, top);
    }

    function getCellId(cell)
    {
        var cellId = cell.attr('data-id');
        if (cellId)
        {
            return cellId.split("_");
        }
        return null;
    }

    function editCutCopy(isCut)
    {
        if (isCut && !ensureModifiable('Cannot cut / copy cells.'))
        {
            return;
        }
        _focusedElement = $(':focus');
        var cells = [];
        var lastRow = -1;
        var clipData = "";

        $('td.cell-selected').each(function ()
        {   // Visit selected cells in spreadsheet
            var cell = $(this);
            var cellRow = getRow(cell);
            if (lastRow == cellRow)
            {
                clipData += '\t';
            }
            else
            {
                if (lastRow != -1) clipData += '\n';
                lastRow = cellRow;
            }
            clipData = clipData + cell.text();
            var cellId = getCellId(cell);
            if (cellId)
            {
                cells.push(cellId);
            }
            if (isCut)
            {
                cell.empty();
            }
        });
        clipData += '\n';
        // TODO: Talk to Ryan, see if there is a non-JQuery way to put the clipData in the text area
        _clipboard.val(clipData);
        _clipboard.focusin();
        _clipboard.select();

        // Clear cells from database
        if (isCut)
        {
            var result = call("ncubeController.clearCells", [getAppId(), _selectedCubeName, cells]);
            if (!result.status)
            {
                _errorId = showNote('Error cutting cells:<hr class="hr-small"/>' + result.data);
            }
        }
    }

    function buildNCubeEditMenu()
    {
        // TODO: Add when we can invoke cut, copy, and paste from the drop down
    }

    function calculateTestPanelSize()
    {
        var east = $('#testLayoutEast');
        var testList = $('#testList').find('> .panel-body');
        testList.height(east.height() - 47);
    }

    function initJsonEditor()
    {
        // create the editor
        var container = document.getElementById('jsoneditor');
        // TODO: Uncomment 'modes:' below when you figure out how to detect when the drop-down changes, so that
        // you can add back the Save button and remove the 'PoweredBy'

        var options =
        {
            mode: 'code',
            //            modes:['code','tree','view','form','text'],
            change: function()
            {
                setDirtyStatus(true);
            }
        };

        // Create JSON Editor (http://jsoneditoronline.org/downloads/)
        _editor = new JSONEditor(container, options);
        var editCtrl = $('#jsoneditor');
        var menu = editCtrl.find('.menu');
        var save = $("<button/>").attr({id:'saveButton', style:'background-image:none;width:64px',title:'Save changes'});
        save.html('Save');
        menu.append(save);           // Add 'Save' button to toolbar
        menu.find('a').remove();     // Get rid of 'Powered by Ace' link
    }

    function setDirtyStatus(dirty)
    {
        var saveButton = $('#saveButton');
        saveButton.prop('disabled', !dirty);
        if (dirty === true)
        {
            saveButton.html('Save*');
        }
        else
        {
            saveButton.html('Save');
        }
    }

    function clearSearch()
    {
        _searchNames.val('');
        _searchContent.val('');
        loadNCubeListView();
        setListSelectedStatus(_selectedCubeName, '#ncube-list');
        loadCube(); // load spreadsheet side
        _searchNames.val('');
        _searchContent.val('');
        _cubeCount.html(Object.keys(_cubeList).length);
    }


    function selectCubeByName(cubeName)
    {
        _selectedCubeName = getProperCubeName(cubeName);
        localStorage[SELECTED_CUBE] = cubeName;
        loadCube(); // load spreadsheet side
    }

    function runSearch()
    {
        _searchThread.postMessage(
        [
            _searchNames.val(),
            _searchContent.val(),
            {"app": _selectedApp, "version": _selectedVersion, "status": _selectedStatus, "branch": _selectedBranch}
        ]);
    }

    function addListeners()
    {
        var editor = $('#jsoneditor');
        editor.find(".format").click(function()
        {
            _jsonEditorMode = 'format';
        });

        editor.find('.compact').click(function()
        {
            _jsonEditorMode = 'compact';
        });

        var saveButton = $('#saveButton');
        saveButton.click(function()
        {
            clearError();
            if (isHeadSelected())
            {
                selectBranch();
                return;
            }

            var result = call("ncubeController.saveJson", [getAppId(), _selectedCubeName, _editor.getText()]);
            if (result.status === true)
            {
                setDirtyStatus(false);
                loadNCubes();
                loadNCubeListView();
                loadCube();
            }
            else
            {
                _errorId = showNote('Error saving JSON n-cube:<hr class="hr-small"/>' + result.data);
            }
        });

        // Send to background Web Worker thread
        _searchNames.on('input', function (event)
        {
            _searchKeyPressed = true;
            _searchLastKeyTime = Date.now();
        });
        _searchContent.on('input', function (event)
        {
            _searchKeyPressed = true;
            _searchLastKeyTime = Date.now();
        });

        _searchNames.keyup(function (e)
        {
            if (e.keyCode == 27)
            {   // ESCape key
                clearSearch();
            }
        });

        _searchContent.keyup(function (e)
        {
            if (e.keyCode == 27)
            {   // ESCape key
                clearSearch();
            }
        });

        $('#cube-search-reset').click(function()
        {
            clearSearch();
        });

        $('#newCubeMenu').click(function ()
        {
            newCube()
        });
        $('#newCubeSave').click(function ()
        {
            newCubeSave()
        });
        $('#renameCubeMenu').click(function ()
        {
            renameCube();
        });
        $('#renameCubeOk').click(function ()
        {
            renameCubeOk();
        });
        $('#renameTestOk').click(function ()
        {
            renameTestOk();
        });
        $('#dupeCubeMenu').click(function ()
        {
            dupeCube();
        });
        $('#dupeCubeCopy').click(function ()
        {
            dupeCubeCopy();
        });
        $('#deleteCubeMenu').click(function ()
        {
            deleteCube();
        });
        $('#deleteCubeOk').click(function ()
        {
            deleteCubeOk();
        });
        $('#restoreCubeMenu').click(function ()
        {
            restoreCube();
        });
        $('#restoreCubeOk').click(function ()
        {
            restoreCubeOk();
        });
        $('#restoreSelectAll').click(function()
        {
            checkAll(true, 'input[type="checkbox"]');
        });
        $('#restoreSelectNone').click(function()
        {
            checkAll(false, 'input[type="checkbox"]');
        });
        $('#revisionHistoryMenu').click(function ()
        {
            revisionHistory();
        });
        $('#revisionHistoryOk').click(function ()
        {
            revisionHistoryOk();
        });
        $('#deleteParameterOk').click(function ()
        {
            deleteParameterOk();
        });
        $('#addParameterMenu').click(function ()
        {
            addParameterMenu();
        });
        $('#addAssertionMenu').click(function ()
        {
            addNewAssertion();
        });
        $('#addParameterOk').click(function ()
        {
            addParameterOk();
        });
        $('#showRefsToMenu').click(function ()
        {
            showRefsToCube();
        });
        $('#showRefsToClose').click(function ()
        {
            showRefsToCubeClose()
        });
        $('#showRefsFromMenu').click(function ()
        {
            showRefsFromCube()
        });
        $('#showRefsFromClose').click(function ()
        {
            showRefsFromCubeClose()
        });
        $('#showReqScopeMenu').click(function ()
        {
            showReqScope()
        });
        $('#showReqScopeClose').click(function ()
        {
            showReqScopeClose()
        });
        $('#releaseCubesMenu').click(function ()
        {
            releaseCubes()
        });
        $('#releaseCubesOk').click(function ()
        {
            releaseCubesOk()
        });
        $('#changeVerMenu').click(function ()
        {
            changeVersion()
        });
        $('#changeVerOk').click(function ()
        {
            changeVersionOk()
        });
        $('#addAxisOk').click(function ()
        {
            addAxisOk()
        });
        $('#deleteAxisOk').click(function ()
        {
            deleteAxisOk()
        });
        $('#updateAxisMenu').click(function ()
        {
            updateAxis()
        });
        $('#updateAxisOk').click(function ()
        {
            updateAxisOk()
        });
        $('#createTestsLink').click(function ()
        {
            createNewTestMenu();
        });
        $('#generateTestsLink').click(function ()
        {
            if (ensureModifiable("Unable to generate tests."))
            {
                loadTestListView("ncubeController.generateTests");
            }
        });
        $('#dataChangeType').click(function()
        {
            changeType();
        });
        $('#clearCache').click(function()
        {
            clearCache();
        });
        addColumnEditListeners();
        addEditCellListeners();
        addBranchListeners();

        //  Set focused field when dialog appears so user can just start typing.
        _addParameterModal.on('shown.bs.modal', function () {
            $('#addParameterField').focus();
        });

        _createNewTestModal.on('shown.bs.modal', function () {
            $('#createNewTestField').focus();
        });

        _renameTestModal.on('shown.bs.modal', function () {
            $('#renameTestNewName').focus();
        });

        _duplicateTestModal.on('shown.bs.modal', function () {
            $('#duplicateTestNameField').focus();
        });

        //  Set default button clicked when <enter> is hit.
        _addParameterModal.on( 'keypress', function( e ) {
            if( e.keyCode === 13 ) {
                e.preventDefault();
                $('#addParameterOk').click();
            }
        });

        _renameTestModal.on( 'keypress', function( e ) {
            if( e.keyCode === 13 ) {
                e.preventDefault();
                $('#renameTestOk').click();
            }
        });

        _deleteParameterModal.on( 'keypress', function( e ) {
            if( e.keyCode === 13 ) {
                e.preventDefault();
                $('#deleteParameterOk').click();
            }
        });

        _duplicateTestModal.on( 'keypress', function( e ) {
            if( e.keyCode === 13 ) {
                e.preventDefault();
                $('#duplicateCurrentTestOk').click();
            }
        });

        _deleteTestModal.on( 'keypress', function( e ) {
            if( e.keyCode === 13 ) {
                e.preventDefault();
                $('#deleteTestOk').click();
            }
        });

        _createNewTestModal.on( 'keypress', function( e ) {
            if( e.keyCode === 13 ) {
                e.preventDefault();
                $('#addParameterOk').click();
            }
        });

        $('#runAllTestsMenu').click(function ()
        {
            $(this).css({'cursor':'wait'});
            runAllTests();
            $(this).css({'cursor':'default'})
        });

        $('#runAllTestsButton').click(function ()
        {
            $(this).css({'cursor':'wait'});
            runAllTests();
            $(this).css({'cursor':'default'})
        });

        $('#runCurrentTestMenu').click(function ()
        {
            $(this).css({'cursor':'wait'});
            runCurrentTest();
            $(this).css({'cursor':'default'})
        });

        $('#runTestButton').click(function ()
        {
            $(this).css({'cursor':'wait'});
            runCurrentTest();
            $(this).css({'cursor':'default'})
        });

        $('#runTestMenu').click(function ()
        {
            $(this).css({'cursor':'wait'});
            runCurrentTest();
            $(this).css({'cursor':'default'})
        });

        $('#renameCurrentTestMenu').click(function ()
        {
            renameCurrentTestMenu();
        });

        $('#renameTestMenu').click(function ()
        {
            renameCurrentTestMenu();
        });

        $('#deleteCurrentTestMenu').click(function ()
        {
            deleteCurrentTestMenu();
        });

        $('#deleteTestMenu').click(function ()
        {
            deleteCurrentTestMenu();
        });

        $('#deleteTestOk').click(function ()
        {
            deleteTestOk();
        });

        $('#createNewTestMenu').click(function ()
        {
            createNewTestMenu();
        });

        $('#createNewTestOk').click(function ()
        {
            createNewTestOk();
        });

        $('#duplicateCurrentTestMenu').click(function ()
        {
            duplicateCurrentTestMenu();
        });

        $('#duplicateTestMenu').click(function ()
        {
            duplicateCurrentTestMenu();
        });

        $("#duplicateCurrentTestOk").click(function ()
        {
            duplicateCurrentTestOk();
        });

        $('#deleteAllTestsMenu').click(function ()
        {
            deleteAllTestsMenu();
        });

        $('#deleteAllTestsOk').click(function ()
        {
            deleteAllTestsOk();
        });

        _editCellRadioURL.change(function()
        {
            var isUrl = _editCellRadioURL.find('input').is(':checked');
            _urlDropdown.toggle(isUrl);
            _valueDropdown.toggle(!isUrl);
            showHideCacheCheckbox(isUrl);
        });
        _urlDropdown.change(function()
        {
            var isUrl = _editCellRadioURL.find('input').is(':checked');
            showHideCacheCheckbox(isUrl)
        });
    }

    function showHideCacheCheckbox(isUrl)
    {
        var selDataType = _urlDropdown.val();
        var isGroovy = selDataType == 'exp' || selDataType == 'method';
        _editCellCache.toggle(!isGroovy && isUrl);
    }

    function loadAppListView()
    {
        $('#appCount').html(_apps.length);
        var list = $('#app-list');
        list.empty();
        $.each(_apps, function (index, value)
        {
            var li = $("<li/>");
            var anchor = $('<a href="#"/>');
            anchor.click(function ()
            {
                var appName = anchor.text();
                setListSelectedStatus(appName, '#app-list');
                localStorage[SELECTED_APP] = appName;
                _selectedApp = appName;
                loadVersions();
                loadVersionListView();
                loadNCubes();
                loadNCubeListView();
                loadCube();
            });
            anchor.html(value);
            if (value == _selectedApp)
            {
                anchor.attr('class', 'ncube-selected');
            }
            else
            {
                anchor.attr('class', 'ncube-notselected');
            }
            li.append(anchor);
            list.append(li);
        });
        setListSelectedStatus(_selectedApp, '#app-list');
    }

    function saveState()
    {
        var title = (_selectedCubeName ? _selectedCubeName : '') + ':' + (_selectedApp ? _selectedApp : '') + '/' + (_selectedVersion ? _selectedVersion : '') + '/' + (_selectedStatus ? _selectedStatus : '') + '/' + (_selectedBranch ? _selectedBranch : '');
        document.title = title;
        var state = history.state;
        if (state && state.app == _selectedApp &&
            state.version == _selectedVersion &&
            state.status == _selectedStatus &&
            state.branch == _selectedBranch &&
            state.cube == _selectedCubeName)
        {   // Don't save redundant selection
            return;
        }
        history.pushState({app: _selectedApp,
            version: _selectedVersion,
            status: _selectedStatus,
            branch: _selectedBranch,
            cube: _selectedCubeName}, title);
    }

    function loadTestListView(funcName)
    {
        if (!_selectedApp || !_selectedVersion || !_selectedCubeName || !_selectedStatus)
        {
            $('#selectedTestName').html('No n-cube selected.');
            return false;
        }

        _testData = null;
        _testSelectionAnchor = -1;

        enableTestItems();

        var testListResult = call(funcName, [getAppId(), _selectedCubeName]);

        if (testListResult.status === true)
        {
            _testData = testListResult.data;
            _testSelectionAnchor = 0;
            refreshTestList();
        }
        else
        {
            var msg = 'Error fetching test data for: ' + _selectedCubeName;
            if (testListResult.data != null)
            {
                msg += (':<hr class="hr-small"/>' + testListResult.data);
            }
            _errorId = showNote(msg);
        }
    }

    function refreshTestList() {

        var testListItems = $('#testListItems');
        testListItems.empty();

        if (_testData != null && _testData.length > 0) {
            _testListWarning.hide();
            $("#testCount").html(_testData.length);

            $.each(_testData, function (index, value) {
                var anchor = $("<a/>").attr({'class':'list-group-item'});
                anchor.html('<span class="glyphicon" style="vertical-align: -1px;"></span>&nbsp;&nbsp;' + value['name']);

                if (index == _testSelectionAnchor) {

                    anchor.toggleClass("selected");
                }

                anchor.click(function(e) {

                        var link = $(e.currentTarget);
                        _testSelectionAnchor = index;
                        clearTestSelection();
                        link.addClass("selected");
                        enableTestItems();
                        loadTestView();
                    }
                );
                testListItems.append(anchor);
            });
            $('#testList').fadeIn("fast");
        } else {
            $('#testList').hide();
            _testListWarning.fadeIn("fast");
        }
        loadTestView();
        enableTestItems();
    }

    function loadStatusListView()
    {
        var list = $('#status-list');
        list.empty();
        $.each(_statuses, function (index, value)
        {
            var li = $("<li/>");
            var anchor = $('<a href="#"/>');
            anchor.click(function ()
            {
                var status = anchor.text();
                setListSelectedStatus(status, '#status-list');
                _selectedStatus = status;
                loadVersions();
                loadVersionListView();
                loadNCubes();
                loadNCubeListView();
                loadCube();
            });
            anchor.html(value);
            if (value == _selectedStatus)
            {
                anchor.attr('class', 'ncube-selected');
            }
            else
            {
                anchor.attr('class', 'ncube-notselected');
            }
            li.append(anchor);
            list.append(li);
        });
        setListSelectedStatus(_selectedStatus, '#status-list');
    }

    function loadVersionListView()
    {
        $('#verCount').html(_versions.length);
        var list = $('#version-list');
        list.empty();
        $.each(_versions, function (index, value)
        {
            var li = $("<li/>");
            var anchor = $('<a href="#"/>');
            anchor.click(function ()
            {
                var version = anchor.text();
                setListSelectedStatus(version, '#version-list');
                localStorage[SELECTED_VERSION] = version;
                _selectedVersion = version;
                loadNCubes();
                loadNCubeListView();
                loadCube();
            });
            anchor.html(value);
            if (value == _selectedVersion)
            {
                anchor.attr('class', 'ncube-selected');
            }
            else
            {
                anchor.attr('class', 'ncube-notselected');
            }
            li.append(anchor);
            list.append(li);
        });
        setListSelectedStatus(_selectedVersion, '#version-list');
    }

    function clearTestSelection()
    {
        $("#testListItems").find("a.selected").each(function (index, elem)
        {
            $(elem).removeClass("selected");
        });
        enableTestItems();
    }

    function selectAllTests()
    {
        $("#testListItems").find("a").each(function (index, elem)
        {
            var a = $(elem);
            var span = a.find("span");
            a.addClass("selected");
        });
        enableTestItems();
    }

    function enableTestItems() {
        var count = $("#testListItems").find("a.selected").length;

        $("#renameCurrentTestMenu").parent().toggleClass('disabled', count != 1);
        $("#runCurrentTestMenu").parent().toggleClass('disabled', count != 1);
        $("#duplicateCurrentTestMenu").parent().toggleClass('disabled', count != 1);
        $("#deleteCurrentTestMenu").parent().toggleClass('disabled', count != 1);

        $("#renameTestMenu").parent().toggleClass('disabled', count != 1);
        $("#duplicateTestMenu").parent().toggleClass('disabled', count != 1);
        $("#runTestMenu").parent().toggleClass('disabled', count != 1);
        $("#deleteTestMenu").parent().toggleClass('disabled', count != 1);

        if (count != 1) {
            clearTestView();
        }
    }

    function findTestByName(name) {
        if (_testData == null) {
            return null;
        }

        for (var i=0; i<_testData.length; i++) {
            if (name == _testData[i]["name"]) {
                return _testData[i];
            }
        }
        return null;
    }

    function createNewTestMenu()
    {
        if (!ensureModifiable("Unable to create a test."))
        {
            return;
        }

        if ($('#createNewTestMenu').parent().hasClass('disabled'))
        {
            return;
        }

        $('#createNewTestField').val('');
        _createNewTestModal.modal({
            keyboard: true
        });
    }

    function deleteAllTestsMenu() {
        clearError();

        if ($('#deleteAllTestsMenu').parent().hasClass('disabled')) {
            return;
        }

        if (!_selectedApp || !_selectedVersion || !_selectedCubeName || !_selectedStatus)
        {
            _errorId = showNote('No n-cube is currently selected. You cannot delete all tests.');
            return;
        }

        $('#deleteAllTestsModal').modal({
            keyboard: true
        });
    }

    function deleteAllTestsOk() {
        $('#deleteAllTestsModal').modal('hide');

        _testData = [];
        _testSelectionAnchor = -1;

        saveAllTests(true);
        refreshTestList();
    }

    function createNewTestOk() {
        var newName = $('#createNewTestField').val().trim();

        if (findTestByName(newName) != null)
        {
            _errorId = showNote('There is already a test named \'' + newName + '\'.  Please choose a new name.');
            return;
        }

        var result = call("ncubeController.createNewTest", [getAppId(), _selectedCubeName, newName]);

        if (result.status === true)
        {
            if (_testData == null) {
                _testData = [];
            }
            _testData.push(result.data);
            _testSelectionAnchor = _testData.length-1;

            refreshTestList();
            saveAllTests(true);

            _createNewTestModal.modal('hide');

            $('#testList div.panel-body').animate({
                scrollTop: $('#testListItems a.selected').offset().top
            }, 200);
        }
        else {
            var msg = 'Error creating new test for ' + _selectedCubeName + ' (' + _selectedVersion + ', ' + _selectedStatus + ')';
            if (result.data != null) {
                msg += (':<hr class="hr-small"/>' + result.data);
            }
            _errorId = showNote(msg);
        }
    }

    function duplicateCurrentTestMenu() {
        clearError();

        if ($('#duplicateCurrentTestMenu').parent().hasClass('disabled')) {
            return;
        }

        if (!_selectedApp || !_selectedVersion || !_selectedCubeName || !_selectedStatus)
        {
            _errorId = showNote('No n-cube is currently selected. There is no test to duplicate.');
            return;
        }

        var list = getSelectedTestList();

        if (list.length != 1)
        {
            if (list.length == 0) {
                _errorId = showNote('No test is currently selected. Select a test to duplicate.');
            } else {
                _errorId = showNote('More than one test is selected. There can only be one test selected to duplicate.');
            }
            return;
        }

        $('#duplicateTestTitle').html('Duplicate \'' + $(list[0]).text().trim() + '\' ?');
        $('#duplicateTestNameField').val('');
        $('#duplicateTestModal').modal();
    }

    function getSelectedTestList() {
        return $("#testListItems a.selected");
    }

    function getSelectedTestCount() {
        return getSelectedTestList().length;
    }

    function getSelectedTestFromModel() {
        var list = getSelectedTestList();
        return findTestByName($(list[0]).text().trim());
    }

    function duplicateCurrentTestOk() {
        // see if name already exists in tests?

        var newName = $('#duplicateTestNameField').val().trim();

        if (findTestByName(newName) != null)
        {
            _errorId = showNote('There is already a test named \'' + newName + '\'.  Please choose a new name.');
            return;
        }

        $('#duplicateTestModal').modal('hide');

        var newTest = duplicateTest(getSelectedTestFromModel(), newName);

        // scroll to item we just added.
        _testData.push(newTest);
        _testSelectionAnchor = _testData.length-1;
        refreshTestList();
        saveAllTests(true);

        $('#testList').find('div.panel-body').animate({
            scrollTop: $('#testListItems').find('a.selected').offset().top
        }, 200);
    }

    function duplicateTest(test, newTestName) {
        var newTest = {};
        newTest["@type"] = "com.cedarsoftware.ncube.NCubeTest";
        newTest["name"] = newTestName;

        var parameters = [];

        $.each(test["coord"], function(index, item) {
            var pair = {};

            pair["key"] = item["key"];

            var cell = item["value"];
            var newCell = {};

            if (!cell) {
                pair["value"] = null;
            } else {
                $.each(cell, function(key, value) {
                    newCell[key] = value;
                });
                pair["value"] = newCell;
            }

            parameters.push(pair);
        });

        newTest["coord"] = parameters;

        var result = [];

        $.each(test["expected"], function(index, item) {
            var newCell = {};

            if (!item) {
                newCell = null;
            } else {
                $.each(item, function (key, value) {
                    newCell[key] = value;
                });
            }

            result.push(newCell);
        });

        newTest["expected"] = result;
        return newTest;
    }

    function loadNCubeListView()
    {
        loadFilteredNCubeListView(_cubeList);
    }

    function loadFilteredNCubeListView(cubes)
    {
        var filter = _searchNames.val();
        _listOfCubes.empty();
        var count = 0;
        $.each(cubes, function buildCubeList(loName, infoDto)
        {
            count++;
            var cubeName = infoDto.name;
            var li = $("<li/>");
            var a = $('<a href="#"/>');
            a.click(function clickAction()
            {
                selectCubeByName(loName);
            });
            if (_selectedCubeName == cubeName)
            {
                a.attr('class', 'ncube-selected');
            }
            else
            {
                a.attr('class', 'ncube-notselected');
            }
            a.attr('itemName', loName);
            li.append(a);
            _listOfCubes.append(li);

            if (filter && infoDto.pos != null)
            {
                var nameHtml = cubeName.substring(0, infoDto.pos);
                nameHtml += '<span class="search-hilite">';
                nameHtml += cubeName.substring(infoDto.pos, infoDto.pos + filter.length);
                nameHtml += '</span>';
                nameHtml += cubeName.substring(infoDto.pos + filter.length);
                a.html(nameHtml);
            }
            else
            {
                a.html(cubeName);
            }

            if (!isHeadSelected())
            {
                if (!infoDto.headSha1)
                {
                    if (infoDto.sha1)
                    {
                        a.addClass('cube-added');
                    }
                    else if (infoDto.changeType == 'R')
                    {
                        a.addClass('cube-restored');
                    }
                }
                else
                {
                    if (infoDto.headSha1 != infoDto.sha1)
                    {
                        a.addClass('cube-modified');
                    }
                    else if (infoDto.changeType == 'R')
                    {
                        a.addClass('cube-restored');
                    }
                }
            }
        });

        _cubeCount.html(count);
    }

    function loadCubeHtml()
    {
        if (!_selectedCubeName || !_selectedApp || !_selectedVersion || !_selectedStatus)
        {
            $('#ncube-content').html('No n-cubes to load');
            return;
        }
        var result = call("ncubeController.getHtml", [getAppId(), _selectedCubeName]);
        if (result.status === true)
        {
            $('#ncube-content').html(result.data);

            // Disallow any selecting within the table
            var table = $('table');
            table.addClass('noselect');

            $(".axis-menu").each(function ()
            {
                var element = $(this);
                var axisName = element.attr('data-id');
                var ul = $('<ul/>').prop({'class': 'dropdown-menu', 'role': 'menu'});
                var li = $('<li/>');
                var an = $('<a href="#">');
                an.html("Update Axis...");
                an.click(function ()
                {
                    updateAxis(axisName)
                });
                li.append(an);
                ul.append(li);
                li = $('<li/>');
                an = $('<a href="#">');
                an.html("Add Axis...");
                an.click(function ()
                {
                    addAxis();
                });
                li.append(an);
                ul.append(li);
                li = $('<li/>');
                an = $('<a href="#">');
                an.html("Delete Axis...");
                an.click(function ()
                {
                    deleteAxis(axisName)
                });
                li.append(an);
                ul.append(li);
                li = $('<div/>').prop({'class': 'divider'});
                ul.append(li);
                li = $('<li/>');
                an = $('<a href="#">');
                an.html("Edit " + axisName + " columns...");
                an.click(function ()
                {
                    editColumns(axisName)
                });
                li.append(an);
                ul.append(li);
                element.append(ul);
            });
        }
        else
        {
            $('#ncube-content').empty();
            _errorId = showNote('Unable to load ' + _selectedCubeName + ':<hr class="hr-small"/>' + result.data);
        }

        $('.column').each(function ()
        {
            $(this).dblclick(function()
            {   // On double click, bring up column value editor modal
                var col = $(this);
                editColumns(col.attr('data-axis'));
            });
        });

        $('.cmd-url').each(function()
        {
            var anchor = $(this);
            anchor.click(function()
            {
                clearError();
                var link = anchor.html();
                if (link.indexOf('http:') == 0 || link.indexOf('https:') == 0 || link.indexOf('file:') == 0)
                {
                    window.open(link);
                }
                else
                {
                    var result = call("ncubeController.resolveRelativeUrl", [getAppId(), link]);
                    if (result.status === true && result.data)
                    {
                        link = result.data;
                        window.open(link);
                    }
                    else
                    {
                        var msg = result.data ? result.data : "Unable to resolve relative URL against entries in sys.classpath";
                        _errorId = showNote('Unable to open ' + link + ':<hr class="hr-small"/>' + msg);
                    }
                }
            });
        });
        processCellClicks();
        buildCubeNameLinks();
    }

    function processCellClicks()
    {
        // Add ability for the user to double-click axis and pop-up the 'Update Axis' modal
        $('.ncube-head').each(function()
        {
            $(this).dblclick(function()
            {
                var div = $(this).find('div');
                var axisName = div.attr('data-id');
                updateAxis(axisName);
            });
        });

        // Add support for individual and shift-selection of cells within the table cell area
        $('td.cell').each(function ()
        {
            var cell = $(this);
            cell.click(function (event)
            {
                if (event.shiftKey || event.ctrlKey)
                {
                    var selectedCell = $('td.cell-selected');
                    if (!selectedCell || selectedCell.length == 0)
                    {
                        clearSelectedCells();
                        cell.addClass('cell-selected');
                        cell.children().addClass('cell-selected');
                    }
                    else
                    {
                        var table = $(".table-ncube")[0];
                        var minRow = 10000000000;
                        var minCol = 10000000000;
                        var maxRow = -1;
                        var maxCol = -1;
                        var tableRows = table.rows;

                        selectedCell.each(function()
                        {
                            var iCell = $(this);
                            var iRow = getRow(iCell);
                            var iCol = getCol(iCell) - countTH(tableRows[iRow].cells);
                            if (iRow < minRow) minRow = iRow;
                            if (iRow > maxRow) maxRow = iRow;
                            if (iCol < minCol) minCol = iCol;
                            if (iCol > maxCol) maxCol = iCol;
                        });
                        var aRow = getRow(cell);
                        var aCol = getCol(cell) - countTH(tableRows[aRow].cells);

                        // Ensure that the rectangle goes from top left to lower right
                        if (aCol > maxCol) maxCol = aCol;
                        if (aCol < minCol) minCol = aCol;
                        if (aRow > maxRow) maxRow = aRow;
                        if (aRow < minRow) minRow = aRow;

                        for (var column = minCol; column <= maxCol; column++)
                        {
                            for (var row = minRow; row <= maxRow; row++)
                            {
                                var numTH = countTH(tableRows[row].cells);
                                var domCell = tableRows[row].cells[column + numTH]; // This is a DOM "TD" element
                                var jqCell = $(domCell);                             // Now it's a jQuery object.
                                jqCell.addClass('cell-selected');
                                jqCell.children().addClass('cell-selected');
                            }
                        }
                    }
                }
                else
                {   // On a straight-up click, nuke any existing selection.
                    clearSelectedCells();
                    cell.addClass('cell-selected');
                    cell.children().addClass('cell-selected');
                }
            });

            // Add ability for user to double-click and get the edit cell modal
            cell.dblclick(function ()
            {   // On double click open Edit Cell modal
                _uiCellId = cell;
                _cellId = _uiCellId.attr('data-id').split("_");
                editCell();
            });
        });
    }

    function countTH(row)
    {
        var count = 0;
        for (var i=0; i < row.length; i++)
        {
            if (row[i].tagName == "TH")
            {
                count++;
            }
        }
        return count;
    }

    function getCol(cell)
    {
        var col = cell.parent().children().index(cell);
        return col;
    }

    function getRow(cell)
    {
        var row = cell.parent().parent().children().index(cell.parent());
        return row;
    }

    function clearSelectedCells()
    {
        $(".cell-selected").each(function()
        {
            $(this).removeClass('cell-selected');
        });
    }

    function buildCubeNameLinks()
    {
        // Build cube list names
        var cubeLowerNames = {};
        var s = "";
        var word = '(\\b)';
        $.each(_cubeList, function (key)
        {
            if (key.length > 2)
            {   // Only support n-cube names with 3 or more characters in them (too many false replaces will occur otherwise)
                cubeLowerNames[key] = true;
                s += word + key.replace('.', '\\.') + word + '|';
            }
        });

        if (s.length > 0)
        {
            s = s.substring(0, s.length - 1);
        }

        var failedCheck = {};
        var regex = new RegExp(s, "gi");

        $('.column, .cell').each(function ()
        {
            var cell = $(this);
            var html = cell.html();
            if (html && html.length > 2)
            {
                var found = false;

                html = html.replace(regex, function (matched)
                {
                    found = true;
                    return '<a class="ncube-anchor" href="#">' + matched + '</a>';
                });

                if (found)
                {   // substitute new text with anchor tag
                    cell.html(html);
                }
                else
                {
                    var loHtml = html.toLowerCase();
                    if (!failedCheck[html] && (cubeLowerNames['rpm.class.' + loHtml] || cubeLowerNames['rpm.enum.' + loHtml]))
                    {
                        html = '<a class="ncube-anchor" href="#">' + html + '</a>';
                        cell.html(html);
                    }
                    else
                    {
                        failedCheck[html] = true;
                    }
                }
            }
        });

        failedCheck = null;

        // Add click handler that opens clicked cube names
        $('.ncube-anchor').each(function ()
        {
            var link = $(this);
            link.click(function ()
            {
                var cubeName = link.html().toLowerCase();
                if (cubeLowerNames[cubeName])
                {
                    _selectedCubeName = getProperCubeName(link.html());
                }
                else
                {
                    if (cubeLowerNames['rpm.class.' + cubeName])
                    {
                        _selectedCubeName = getProperCubeName('rpm.class.' + link.html());
                    }
                    else if (cubeLowerNames['rpm.enum.' + cubeName])
                    {
                        _selectedCubeName = getProperCubeName('rpm.enum.' + link.html());
                    }
                }
                loadCube();
            });
        });
    }

    function getProperCubeName(cubeName)
    {
        var nameToChk = (cubeName + '').toLowerCase();
        var info = _cubeList[nameToChk];
        return info ? info.name : null;
    }

    function loadCubeJson()
    {
        if (!_selectedCubeName || !_selectedApp || !_selectedVersion || !_selectedStatus)
        {
            _editor.setText('No n-cube to load');
            setDirtyStatus(false);
            return;
        }
        var result = call("ncubeController.getJson", [getAppId(), _selectedCubeName]);
        if (result.status === true)
        {
            _editor.setText(result.data);
        }
        else
        {
            _editor.setText("Unable to load '" + _selectedCubeName + "'. " + result.data);
        }

        var editCtrl = $('#jsoneditor');
        if (_jsonEditorMode == 'format')
        {
            editCtrl.find('.format').click();
        }
        else
        {
            editCtrl.find('.compact').click();
        }
        setDirtyStatus(false);
    }

    function loadCubeDetails()
    {
        if (!_cubeList || !doesCubeExist())
        {
            return;
        }

        var info = _cubeList[(_selectedCubeName + '').toLowerCase()];
        if (!info)
        {
            return;
        }

        $('#cube_name').val(info.name);
        $('#cube_revision').val(info.revision);
        var date = '';
        if (info.createDate != undefined)
        {
            date = new Date(info.createDate).format('yyyy-mm-dd HH:MM:ss');
        }
        $('#cube_createDate').val(date);
        $('#cube_createHid').val(info.createHid);
        $('#cube_notes').val(info.notes);
        $('#cube_id').val(info.id);
        $('#cube_sha1').val(info.sha1);
        $('#cube_headSha1').val(info.headSha1);
    }

    function clearTestView() {
        $('#testParametersDiv').hide();
        $('#testAssertionsDiv').hide();
        $('#testNameDiv').hide();
        $('#testButtonGroupDiv').hide();
        _testResultsDiv.hide();

        $('#testParameters').empty();
        $('#testAssertions').empty();
        $('#testResults').empty();
    }

    function loadTestView()
    {
        clearTestView();

        if (!_testData || _testData.length == 0 || _testSelectionAnchor >= _testData.length || _testSelectionAnchor < 0) {
            _testSelectionAnchor = -1;
            return;
        }

        var testData = _testData[_testSelectionAnchor];
        var testParameters = $('#testParameters');
        var testAssertions = $('#testAssertions');

        try
        {
            $('#selectedTestName').html(testData['name']);
            var coordinate = testData['coord'];

            if (coordinate != null  && coordinate)
            {
                $.each(coordinate, function (index, item)
                {
                    var key = item['key'];
                    if (key.substring(0, 1) != "@")
                    {
                        var value = item['value'];
                        var isUrl = (value == null || value.isUrl == null) ? false : value.isUrl;
                        var v = (value == null || value.value == null) ? null : value.value;
                        var dataType = (value == null || value.dataType == null) ? null : value.dataType;
                        testParameters.append(buildParameter(key, dataType, isUrl, v, true, false, deleteParameter));
                    }
                });
            }

            var assertions = testData['expected'];
            if (assertions != null  && assertions)
            {
                $.each(assertions, function (index, value)
                {
                    var isUrl = value['isUrl'] == null ? null : value['isUrl'];
                    var v = value.value == null ? null : value.value;
                    var dataType = value.dataType == null ? null : value.dataType;
                    testAssertions.append(buildParameter(index + 1, "exp", isUrl, v, false, true, deleteAssertion));
                });
            }
        }
        catch (e)
        {
            console.log(e);
            _errorId = showNote('Unable to load test view:<hr class="hr-small"/>' + e.message);
        }

        $('#testParametersDiv').fadeIn('fast');
        $('#testAssertionsDiv').fadeIn('fast');
        $('#testNameDiv').fadeIn('fast');
        $('#testButtonGroupDiv').fadeIn('fast');
    }

    function createTypeSelector(typeStr, url) {
        if (typeStr == null) {
            typeStr = 'string';
        }
        var selector = $("<select/>").attr({'class': 'selectpicker show-tick show-menu-arrow', 'data-width':'auto', 'data-style': 'btn-default'});
        return fillTypeSelector(selector, typeStr, url);
    }

    function fillTypeSelector(selector, typeStr, url) {

        if (selector == null) {
            return;
        }
        selector.empty();

        var options = null;

        if (url) {
            options = $('#datatypes-url').find('option');
        } else {
            options = $('#datatypes-value').find('option');
        }

        $.each(options, function (i, value)
        {
            var item = $(value);
            var opt = $("<option/>").attr({'value': item.val()});
            opt.text(item.text());

            if (typeStr != null && typeStr == item.val())
            {
                opt.prop({'selected' : true});
            }
            selector.append(opt);
        });

        return selector;
    }

    function leftPad (str, length) {
        var pad = length - str.length;

        if (pad < 1 || pad > 11) {
            return str;
        }

        return _padding[pad] + str;
    }

    // these are just temporary to use as an id
    function generateRandomId() {
        return leftPad(Math.random().toString(36).substring(7), 11);
    }

    function buildParameter(labelText, type, isUrl, value, hasSelector, isRenumberable, deleteFunc)
    {
        var ident = generateRandomId();

        var labelGroup = $("<div/>").attr({'class': 'form-group', 'parameter-id':labelText, 'id':ident});

        var cat = ident + "-value";
        var label = $("<label/>").attr({'for': cat, 'class': 'control-label'}).html(labelText);

        var deleteParamButton = $("<a/>").attr({'class':'red-item pull-right', 'font-size':'9px', 'style':'padding: 1px 3px; font-size: 12px; line-height: 1.5; border-radius: 3px;'});
        var glyph = $("<span/>").attr({'class':'glyphicon glyphicon-remove', 'style':'vertical-align: -1px;' });
        deleteParamButton.append(glyph);
        deleteParamButton.click(deleteFunc);

        labelGroup.append(label);
        labelGroup.append(deleteParamButton);

        var inputGroupAddon = $("<span/>").attr({'class':'input-group-btn'});
        var controls = $("<div/>").attr({'class': 'controls'});
        var inputGroup = $("<div/>").attr({'class':'input-group input-group-sm'});

        var urlButton = $("<button/>").attr({'type':'button', 'class':'btn btn-default', 'value':'url'});

        if (isUrl) {
            urlButton.html("&nbsp;URL&nbsp;");
        } else {
            urlButton.html("Value");
        }

        urlButton.click(function ()
        {
            var txt = urlButton.text();
            if (txt == "Value") {
                urlButton.html("&nbsp;URL&nbsp;");
            } else {
                urlButton.html("Value");
            }
        });

        inputGroupAddon.append(urlButton);
        inputGroup.append(inputGroupAddon);
        inputGroup.append($("<input/>").attr({'class': 'form-control', 'type': 'text', 'id': cat}).val(value));

        if (hasSelector) {
            var selector = createTypeSelector(type, isUrl);
            inputGroup.append(selector);
            selector.selectpicker();
        }

        controls.append(inputGroup);
        labelGroup.append(controls);

        return labelGroup;
    }

    function loadCube()
    {
        saveState();
        if (_activeTab == 'ncubeTab')
        {
            loadCubeHtml();
        }
        else if (_activeTab == 'jsonTab')
        {
            loadCubeJson();
        }
        else if (_activeTab == 'detailsTab')
        {
            loadCubeDetails();
        }
        else if (_activeTab == 'testTab')
        {
            loadTestListView("ncubeController.getTests");
        }
        else
        {
            console.log('Unknown tab selected: ' + _activeTab);
        }

        setListSelectedStatus(_selectedCubeName, '#ncube-list');
    }

    /**
     * Tweak the class name of the selected / non-selected items
     * to match what was selected.
     */
    function setListSelectedStatus(itemName, listId)
    {
        var items = $(listId).find('li a');
        var saveSelected = null;
        $.each(items, function (index, value)
        {
            var anchor = $(value);
            var text = anchor.html();
            var elemName = anchor.attr('itemName');
            if (itemName == text || itemName == elemName)
            {
                saveSelected = anchor;
                anchor.removeClass('ncube-selected');
                anchor.removeClass('ncube-notselected');
                anchor.addClass('ncube-selected');
            }
            else
            {
                anchor.removeClass('ncube-selected');
                anchor.removeClass('ncube-notselected');
                anchor.addClass('ncube-notselected');
            }
        });

        if (saveSelected)
        {
            saveSelected.scrollintoview();
        }
    }

    /**
     * Load NCube List from Database
     */
    function loadNCubes()
    {
        _cubeList = {};
        if (!_selectedApp)
        {
            return;
        }
        if (!_selectedVersion)
        {
            return;
        }
        if (!_selectedStatus)
        {
            return;
        }
        var result = call("ncubeController.search", [getAppId(), '*', null, true]);
        var first = null;
        if (result.status === true)
        {
            $.each(result.data, function (index, value)
            {
                var name = value.name;
                _cubeList[name.toLowerCase()] = value;
                if (!first)
                {
                    first = name;
                }
            });
        }
        else
        {
            _errorId = showNote('Unable to load n-cubes:<hr class="hr-small"/>' + result.data);
        }

        // If there is no _selectedCubeName, establish one if possible (choose 1st cube in list)
        if (!_selectedCubeName || !doesCubeExist())
        {
            if (first)
            {
                _selectedCubeName = (_cubeList && first) ? _cubeList[first.toLowerCase()].name : null;
            }
            else
            {
                _selectedCubeName = null;
            }
        }
    }

    function doesCubeExist()
    {
        var nameToChk = (_selectedCubeName + '').toLowerCase();
        return nameToChk in _cubeList;
    }

    function loadVersions()
    {
        _versions = [];
        clearError();
        if (!_selectedApp)
        {
            _errorId = showNote('Unable to load versions, no n-cube App selected.');
            return;
        }
        if (!_selectedStatus)
        {
            _errorId = showNote('Unable to load versions, no n-cube Status selected.');
            return;
        }
        if (!_selectedBranch)
        {
            _errorId = showNote('Unable to load versions, no branch selected.');
            return;
        }

        var result = call("ncubeController.getAppVersions", [_selectedApp, _selectedStatus, _selectedBranch]);
        if (result.status === true)
        {
            $.each(result.data, function (index, value)
            {
                _versions[index] = value;
            });
        }
        else
        {
            _errorId = showNote('Unable to load versions:<hr class="hr-small"/>' + result.data);
        }
        if (!_selectedVersion || !doesVersionExist(_selectedVersion))
        {
            _selectedVersion = (_versions && _versions.length > 0) ? _versions[_versions.length - 1] : null;
        }
    }

    function doesVersionExist(selVer)
    {
        for (var i=0; i < _versions.length; i++)
        {
            if (_versions[i] == selVer)
            {
                return true;
            }
        }
        return false;
    }

    function loadAppNames()
    {
        _apps = [];
        clearError();
        var result = call("ncubeController.getAppNames", [_selectedStatus, _selectedBranch]);
        if (result.status === true)
        {
            $.each(result.data, function (index, value)
            {
                _apps[index] = value;
            });
        }
        else
        {
            _errorId = showNote('Unable to load n-cube Apps:<hr class="hr-small"/>' + result.data);
        }
        if (!_selectedApp && _apps)
        {
            _selectedApp = _apps[0];
            localStorage[SELECTED_APP] = _selectedApp;
        }
        if (!_apps)
        {
            _selectedApp = localStorage[SELECTED_APP] = null;
        }
        else if (!doesItemExist(_selectedApp, _apps) && _apps.length > 0)
        {
            _selectedApp = _apps[0];
        }
    }

    function newCube()
    {
        if (isHeadSelected())
        {
            selectBranch();
            return false;
        }

        clearError();
        $('#newCubeAppName').val(_selectedApp);
        $('#newCubeStatus').val('SNAPSHOT');
        $('#newCubeVersion').val(_selectedVersion);
        $('#newCubeName').val('');
        buildDropDown('#newCubeAppList', '#newCubeAppName', _apps, function (app)
        {
            var result = call("ncubeController.getAppVersions", [getAppId()]);
            if (result.status === true)
            {
                buildDropDown('#existVersionList', '#newCubeVersion', result.data, function ()
                {
                });
            }
            else
            {
                _errorId = showNote('Failed to load App versions:<hr class="hr-small"/>' + result.data);
            }
        });
        buildDropDown('#existVersionList', '#newCubeVersion', _versions, function ()
        {
        });
        $('#newCubeModal').modal();
    }

    function newCubeSave()
    {
        $('#newCubeModal').modal('hide');
        var appName = $('#newCubeAppName').val();
        var cubeName = $('#newCubeName').val();
        var version = $('#newCubeVersion').val();
        if (!version)
        {
            _errorId = showNote("Note", "Version must be x.y.z")
            return;
        }
        var appId = getAppId();
        appId.version = version;
        appId.app = appName;
        var result = call("ncubeController.createCube", [appId, cubeName]);
        if (result.status === true)
        {
            _selectedApp = appName;
            _selectedVersion = appId.version;
            loadAppNames();
            loadNCubes();
            loadVersions();
            loadAppListView();
            loadStatusListView();
            loadVersionListView();
            loadNCubeListView();
            selectCubeByName(cubeName)
        }
        else
        {
            _errorId = showNote("Unable to create n-cube '" + cubeName + "':<hr class=\"hr-small\"/>" + result.data);
        }
    }

    function renameAssertions()
    {
        $("#testAssertions .form-group").each(function (index, value)
        {
            var v = $(value);
            var count = index + 1;
            v.attr('parameter-id', count);
            v.find('label.control-label').html("" + count + ".");
            v.find('a[parameter-id]').attr('parameter-id', count);
        });
    }

    function deleteParameter(e)
    {
        var parent = $(e.currentTarget).parent("div.form-group");
        var param = parent.attr('parameter-id');
        var test = $('#selectedTestName').html();

        var title = "Delete Parameter?";
        var label = "Delete parameter '" + param + "' from '" + test + "'?";

        deleteTestItem(title, label, false, parent.attr('id'));
    }

    function deleteAssertion(e)
    {
        var parent = $(e.currentTarget).parent("div.form-group");
        var param = parent.attr('parameter-id');
        var test = $('#selectedTestName').html();
        var title = "Delete Assertion?";
        var label = "Delete assertion '" + param + "' from '" + test + "'?";

        deleteTestItem(title, label, true, parent.attr('id'));
    }

    function deleteTestItem(title, label, isRenumberable, paramId)
    {
        clearError();
        if (!_selectedApp || !_selectedVersion || !_selectedCubeName || !_selectedStatus)
        {
            _errorId = showNote('No n-cube selected. Nothing to delete.');
            return;
        }

        $('#deleteParameterTitle').html(title);
        $('#deleteParameterLabel').html(label);
        $('#deleteParameterHiddenId').val(paramId);
        $('#deleteParameterOk').attr({'isRenumberable': isRenumberable});
        _deleteParameterModal.modal({
            keyboard: true
        });
    }

    function deleteParameterOk()
    {
        _deleteParameterModal.modal('hide');

        var id = $('#deleteParameterHiddenId').val();
        var isRenumberable = $('#deleteParameterOk').attr('isRenumberable')

        $('#' + id).remove();

        if (isRenumberable == "true") {
            renameAssertions();
        }

        saveAllTests(false);
    }

    function deleteCube()
    {
        if (!ensureModifiable('Cannot delete n-cube.'))
        {
            return;
        }

        $('#deleteCubeLabel').html("Delete '" + _selectedCubeName + "' ?");
        $('#deleteCubeModal').modal();
    }

    function deleteCubeOk()
    {
        $('#deleteCubeModal').modal('hide');
        var result = call("ncubeController.deleteCube", [getAppId(), _selectedCubeName]);
        if (result.status === true)
        {
            loadNCubes();
            clearSearch();
        }
        else
        {
            _errorId = showNote("Unable to delete n-cube '" + _selectedCubeName + "':<hr class=\"hr-small\"/>" + result.data);
        }
    }

    function restoreCube()
    {
        clearError();
        if (!_selectedApp || !_selectedVersion || !_selectedStatus)
        {
            _errorId = showNote('Need to have an application, version, and status selected first.');
            return;
        }
        if (isHeadSelected())
        {
            selectBranch();
            return;
        }

        var ul = $('#deletedCubeList');
        ul.empty();
        $('#restoreCubeLabel').html('Restore Cubes in ' + _selectedVersion + ', ' + _selectedStatus);
        var result = call("ncubeController.search", [getAppId(), "*", null, false]);
        if (result.status === true)
        {
            $.each(result.data, function (index, value)
            {
                var li = $('<li/>').prop({class: 'list-group-item skinny-lr'});
                var div = $('<div/>').prop({class:'container-fluid'});
                var checkbox = $('<input>').prop({class:'restoreCheck', type:'checkbox'});
                var label = $('<label/>').prop({class: 'checkbox no-margins'}).text(value.name);
                checkbox.prependTo(label); // <=== create input without the closing tag
                div.append(label);
                li.append(div);
                ul.append(li);
            });
            $('#restoreCubeModal').modal();
        }
        else
        {
            _errorId = showNote('Error fetching deleted cubes (' + _selectedVersion + ', ' + _selectedStatus + '):<hr class="hr-small"/>' + result.data);
        }
    }

    function restoreCubeOk()
    {
        $('#restoreCubeModal').modal('hide');

        var input = $('.restoreCheck');
        var cubesToRestore = [];
        $.each(input, function (index, label)
        {
            if ($(this).is(':checked'))
            {
                cubesToRestore.push($(this).parent().text());
            }
        });

        var result = call("ncubeController.restoreCube", [getAppId(), cubesToRestore]);
        if (result.status === true)
        {
            loadNCubes();
            loadNCubeListView();
            var cubeName = _selectedCubeName;
            if (cubesToRestore.length == 1)
            {
                cubeName = cubesToRestore[0];
                selectCubeByName(cubeName);
            }
            else
            {
                clearSearch();
            }
        }
        else
        {
            _errorId = showNote("Unable to restore n-cube '" + _selectedCubeName + "':<hr class=\"hr-small\"/>" + result.data);
        }
    }

    function revisionHistory()
    {
        clearError();
        if (!_selectedApp || !_selectedVersion || !_selectedCubeName || !_selectedStatus)
        {
            _errorId = showNote('No n-cube selected. No revision history to show.');
            return;
        }
        var ul = $('#revisionHistoryList');
        ul.empty();
        $('#revisionHistoryLabel').html('Revision History for ' + _selectedCubeName);
        $('#revisionHistoryModal').modal();
        var result = call("ncubeController.getRevisionHistory", [getAppId(), _selectedCubeName]);
        if (result.status === true)
        {
            $.each(result.data, function (index, value)
            {
                var li = $("<li/>").attr({'class': 'list-group-item skinny-lr'});
                var anchorHtml = $('<a href="#"/>');
                var anchorJson = $('<a href="#"/>');
                var anchorDiff = $('<a href="#"/>');

                var kbd1 = $('<kbd/>');
                kbd1.html('HTML');
                anchorHtml.append(kbd1);

                var kbd2 = $('<kbd/>');
                kbd2.html('JSON');
                anchorJson.append(kbd2);

                var kbd3 = $('<kbd/>');
                kbd3.html('Compare');
                anchorDiff.append(kbd3);

                var date = '';
                if (value.createDate != undefined)
                {
                    date = new Date(value.createDate).format('yyyy-mm-dd HH:MM:ss');
                }
                li.append(anchorHtml);
                li.append('&nbsp;&nbsp;&nbsp;');
                li.append(anchorJson);
                li.append('&nbsp;&nbsp;&nbsp;');
                li.append(anchorDiff);
                li.append('&nbsp;&nbsp;&nbsp;');
                li.append('rev: ' + value.revision + '&nbsp;&nbsp;&nbsp;' + date + '&nbsp;&nbsp;&nbsp;' + value.createHid);
                anchorHtml.click(function ()
                {
                    var title = value.name + '.rev.' + value.revision;
                    var oldHtml = window.open('', title + '.html');
                    var htmlReq = call("ncubeController.getCubeRevisionAs", [getAppId(), _selectedCubeName, value.revision, "html"]);
                    if (htmlReq.status === true)
                    {
                        oldHtml.document.removeChild(oldHtml.document.documentElement);
                        oldHtml.document.write(htmlReq.data);
                        oldHtml.document.title = title + '.html';
                    }
                });
                anchorJson.click(function ()
                {
                    var title = value.name + '.rev.' + value.revision;
                    var oldJson = window.open('', title + '.json');
                    var prettyJsonReq = call("ncubeController.getCubeRevisionAs", [getAppId(), _selectedCubeName, value.revision, "json-pretty"]);
                    if (prettyJsonReq.status === true)
                    {
                        oldJson.document.removeChild(oldJson.document.documentElement);
                        oldJson.document.write('<html><pre>');
                        oldJson.document.write(prettyJsonReq.data);
                        oldJson.document.write('</pre></html>');
                        oldJson.document.title = title + '.json';
                    }
                });
                anchorDiff.click(function ()
                {
                    var title = value.name + '.rev.' + value.revision;
                    window.open('http://www.prettydiff.com/', title);
                });
                ul.append(li);
            });
        }
        else
        {
            _errorId = showNote('Error fetching revision history (' + _selectedVersion + ', ' + _selectedStatus + '):<hr class="hr-small"/>' + result.data);
        }
    }

    function revisionHistoryOk()
    {
        $('#revisionHistoryModal').modal('hide');
    }

    function deleteCurrentTestMenu()
    {
        clearError();
        if (!_selectedApp || !_selectedVersion || !_selectedCubeName || !_selectedStatus)
        {
            _errorId = showNote('No n-cube is currently selected. There is nothing to rename.');
            return;
        }

        var list = $("#testListItems a.selected");

        if (list.length != 1)
        {
            if (list.length == 0) {
                _errorId = showNote('No test is currently selected. Select a test to delete.');
            } else {
                _errorId = showNote('More than one test is selected. There can only be one test selected to delete.');
            }
            return;
        }

        var test = _testData[_testSelectionAnchor]["name"];

        $('#deleteTestTitle').html("Delete Test");
        $('#deleteTestLabel').html("Are you sure you want to delete the test '" + test + "'?");
        $('#deleteTestModal').modal({
            keyboard: true
        });

    }

    function deleteTestOk()
    {
        clearError();

        var list = $("#testListItems a.selected");

        $('#deleteTestModal').modal('hide');

        _testData.splice(_testSelectionAnchor, 1);
        _testSelectionAnchor = -1;

        refreshTestList();
        saveAllTests(true);
    }

    function renameCurrentTestMenu()
    {
        clearError();
        if (!_selectedApp || !_selectedVersion || !_selectedCubeName || !_selectedStatus)
        {
            _errorId = showNote('No n-cube is currently selected. There is nothing to rename.');
            return;
        }

        var list = $("#testListItems a.selected");

        if (list.length != 1)
        {
            if (list.length == 0) {
                _errorId = showNote('No test is currently selected. Select a test to duplicate.');
            } else {
                _errorId = showNote('More than one test is selected. There can only be one test selected to duplicate.');
            }
            return;
        }

        var test = _testData[_testSelectionAnchor]["name"];


        $('#renameTestOldName').val(test);
        $('#renameTestNewName').val('');
        $('#renameTestLabel').html('Rename \'' + test + '\'?');

        _renameTestModal.modal({
            keyboard: true
        });
    }

    function renameCube()
    {
        if (!ensureModifiable('Unable to rename cube.'))
        {
            return;
        }

        $('#renameCubeAppName').val(_selectedApp);
        $('#renameCubeVersion').val(_selectedVersion);
        $('#renameCubeName').val(_selectedCubeName);
        $('#renameNewCubeName').val('');
        $('#renameCubeLabel').html('Rename');
        $('#renameCubeModal').modal();
    }

    function renameCubeOk()
    {
        $('#renameCubeModal').modal('hide');
        var oldName = $('#renameCubeName').val();
        var newName = $('#renameNewCubeName').val();
        var result = call("ncubeController.renameCube", [getAppId(), oldName, newName]);
        if (result.status === true)
        {
            loadNCubes();
            _selectedCubeName = newName;
            loadNCubeListView();
            loadCube();
        }
        else
        {
            _errorId = showNote("Unable to rename n-cube '" + _selectedCubeName + "':<hr class=\"hr-small\"/>" + result.data);
        }
    }

    function testNameAlreadyExists(name) {

        if (_testData == null) {
            return false;
        }

        var found = false;
        $.each(_testData, function (index, value)
        {
            if (value['name'] == name) {
                found = true;
            }
        });

        return found;
    }

    function validateTestName(name) {
        var nameRegex = /^([A-Za-z0-9-.]{3,64})$/g;

        if (!nameRegex.test(name)) {
            _errorId = showNote("Test name is invalid. Test names can only contain letters, numbers, and, ., and -");
            return false;
        }

        if (testNameAlreadyExists(name)) {
            _errorId = showNote("There is already a test with that name.  Please rename and try again.");
            return false;
        }

        return true;
    }


    function renameTestOk()
    {
        clearError();
        var oldName = $('#renameTestOldName').val();
        var newName = $('#renameTestNewName').val();

        if (!validateTestName(newName)) {
            return;
        }

        _renameTestModal.modal('hide');

        // change name of selected test
        $('#selectedTestName').html(newName);

        // change currently selected model item
        var test = _testData[_testSelectionAnchor];
        test["name"] = newName;

        // change in our list.
        refreshTestList();
    }

    function dupeCube()
    {
        clearError();
        if (!_selectedApp || !_selectedVersion || !_selectedCubeName || !_selectedStatus)
        {
            _errorId = showNote('No n-cube selected. Nothing to duplicate.');
            return;
        }
        if (isHeadSelected())
        {
            selectBranch();
            return false;
        }

        $('#dupeCubeAppName').val(_selectedApp);
        $('#dupeCubeVersion').val(_selectedVersion);
        $('#dupeCubeName').val(_selectedCubeName);
        $('#dupeCubeLabel').html('Duplicate: ' + _selectedCubeName + ' ?');
        buildDropDown('#dupeCubeAppList', '#dupeCubeAppName', _apps, function (app)
        {
            var appId = {
                'app':app,
                'status':'SNAPSHOT',
                'branch':_selectedBranch
            };
            var result = call("ncubeController.getAppVersions", [appId]);
            if (result.status === true)
            {
                buildDropDown('#dupeCubeVersionList', '#dupeCubeVersion', result.data, function ()
                {
                });
            }
            else
            {
                _errorId = showNote('Unable to load App versions:<hr class="hr-small"/>' + result.data);
            }
        });
        buildDropDown('#dupeCubeVersionList', '#dupeCubeVersion', _versions, function ()
        {
        });
        $('#dupeCubeModal').modal();
    }

    function dupeCubeCopy()
    {
        $('#dupeCubeModal').modal('hide');
        var newName = $('#dupeCubeName').val();
        var newApp = $('#dupeCubeAppName').val();
        var newVersion = $('#dupeCubeVersion').val();
        var destAppId = {
            'app':newApp,
            'version':newVersion,
            'status':'SNAPSHOT',
            'branch':_selectedBranch
        };
        var result = call("ncubeController.duplicateCube", [getAppId(), destAppId, _selectedCubeName, newName]);
        if (result.status === true)
        {
            loadAppNames();
            _selectedApp = newApp;
            loadAppListView();
            _selectedStatus = 'SNAPSHOT';
            setListSelectedStatus('SNAPSHOT', '#status-list');
            loadVersions();
            _selectedVersion = newVersion;
            loadVersionListView();
            loadNCubes();
            selectCubeByName(newName);
        }
        else
        {
            _errorId = showNote("Unable to duplicate n-cube '" + _selectedCubeName + "':<hr class=\"hr-small\"/>" + result.data);
        }
    }

    function showRefsToCube()
    {
        clearError();
        if (!_selectedApp || !_selectedVersion || !_selectedCubeName || !_selectedStatus)
        {
            _errorId = showNote('No n-cube selected. No (inbound) references to show.');
            return;
        }
        $('#showRefsToLabel').html('Inbound refs to: ' + _selectedCubeName);
        var ul = $('#refsToCubeList');
        ul.empty();
        $('#showRefsToCubeModal').modal();
        var result = call("ncubeController.getReferencesTo", [getAppId(), _selectedCubeName]);
        if (result.status === true)
        {
            $.each(result.data, function (index, value)
            {
                var li = $("<li/>").attr({'class': 'list-group-item skinny-lr'});
                var anchor = $('<a href="#"/>');
                anchor.html(value);
                anchor.click(function ()
                {
                    showRefsToCubeClose();
                    _selectedCubeName = getProperCubeName(value);
                    loadCube();
                });
                li.append(anchor);
                ul.append(li);
            });
        }
        else
        {
            _errorId = showNote('Error fetching inbound references to ' + _selectedCubeName + ' (' + _selectedVersion + ', ' + _selectedStatus + '):<hr class="hr-small"/>' + result.data);
        }
    }

    function showRefsToCubeClose()
    {
        $('#showRefsToCubeModal').modal('hide');
    }

    function showRefsFromCube()
    {
        clearError();
        if (!_selectedApp || !_selectedVersion || !_selectedCubeName || !_selectedStatus)
        {
            _errorId = showNote('No n-cube selected. No (outbound) references to show.');
            return;
        }
        $('#showRefsFromLabel').html('Outbound refs of: ' + _selectedCubeName);
        var ul = $('#refsFromCubeList');
        ul.empty();
        $('#showRefsFromCubeModal').modal();
        var result = call("ncubeController.getReferencesFrom", [getAppId(), _selectedCubeName]);
        if (result.status === true)
        {
            $.each(result.data, function (index, value)
            {
                var li = $("<li/>").attr({'class': 'list-group-item skinny-lr'});
                var anchor = $('<a href="#"/>');
                anchor.html(value);
                anchor.click(function ()
                {
                    showRefsFromCubeClose();
                    _selectedCubeName = getProperCubeName(value);
                    loadCube();
                });
                li.append(anchor);
                ul.append(li);
            });
        }
        else
        {
            _errorId = showNote('Error fetching outbound references for ' + _selectedCubeName + '):<hr class="hr-small"/>' + result.data);
        }
    }

    function showRefsFromCubeClose()
    {
        $('#showRefsFromCubeModal').modal('hide');
    }

    function showReqScope()
    {
        clearError();
        if (!_selectedApp || !_selectedVersion || !_selectedCubeName || !_selectedStatus)
        {
            _errorId = showNote('No n-cube selected. No required scope to show.');
            return;
        }
        $('#showReqScopeLabel').html("Scope for '" + _selectedCubeName + "'");
        var ul = $('#reqScopeList');
        ul.empty();
        $('#showReqScopeModal').modal();
        var result = call("ncubeController.getRequiredScope", [getAppId(), _selectedCubeName]);
        if (result.status === true)
        {
            $.each(result.data, function (index, value)
            {
                var li = $("<li/>").attr({'class': 'list-group-item skinny-lr'});
                li.html(value);
                ul.append(li);
            });
        }
        else
        {
            _errorId = showNote('Error fetching required scope for: ' + _selectedCubeName + '):<hr class="hr-small"/>' + result.data);
        }
    }

    function showReqScopeClose()
    {
        $('#showReqScopeModal').modal('hide');
    }

    function releaseCubes()
    {
        if (!isHeadSelected())
        {
            _errorId = showNote('HEAD branch must be selected to release a version.');
            return;
        }

        $('#releaseCubesLabel').html('Release ' + _selectedApp + ' ' + _selectedVersion + ' SNAPSHOT ?');
        $('#releaseCubesAppName').val(_selectedApp);
        $('#releaseCubesModal').modal();
    }

    function releaseCubesOk()
    {
        $('#releaseCubesModal').modal('hide');
        var newSnapVer = $('#releaseCubesVersion').val();
        var result = call("ncubeController.releaseCubes", [getAppId(), newSnapVer]);
        if (result.status === true)
        {
            var saveSelectedVersion = _selectedVersion;
            loadVersions();
            _selectedVersion = doesItemExist(saveSelectedVersion, _versions) ? saveSelectedVersion : _selectedVersion;
            loadVersionListView();
            loadNCubes();
            loadNCubeListView();
            loadCube();
        }
        else
        {
            _errorId = showNote("Unable to release version '" + _selectedVersion + "':<hr class=\"hr-small\"/>" + result.data);
        }
    }

    function changeVersion()
    {
        if (!ensureModifiable('Version cannot be changed.'))
        {
            return;
        }

        $('#changeVerLabel').html('Change ' + _selectedApp + ' ' + _selectedVersion + ' ?');
        $('#changeVerModal').modal();
    }

    function changeVersionOk()
    {
        $('#changeVerModal').modal('hide');
        var newSnapVer = $('#changeVerValue').val();
        var result = call("ncubeController.changeVersionValue", [getAppId(), newSnapVer]);
        if (result.status === true)
        {
            loadVersions();
            _selectedVersion = doesItemExist(newSnapVer, _versions) ? newSnapVer : _selectedVersion;
            loadVersionListView();
            loadNCubes();
            loadNCubeListView();
            loadCube();
        }
        else
        {
            _errorId = showNote("Unable to change SNAPSHOT version to value '" + newSnapVer + "':<hr class=\"hr-small\"/>" + result.data);
        }
    }

    function addAxis()
    {
        if (!ensureModifiable('Axis cannot be added.'))
        {
            return;
        }

        var generalTypes = ['STRING', 'LONG', 'BIG_DECIMAL', 'DOUBLE', 'DATE', 'COMPARABLE'];
        var ruleTypes = ['EXPRESSION'];
        buildDropDown('#addAxisTypeList', '#addAxisTypeName', ['DISCRETE', 'RANGE', 'SET', 'NEAREST', 'RULE'], function (selected)
        {
            if ("RULE" == selected)
            {
                buildDropDown('#addAxisValueTypeList', '#addAxisValueTypeName', ruleTypes, function () { });
                $('#addAxisValueTypeName').val('EXPRESSION');
            }
            else
            {
                buildDropDown('#addAxisValueTypeList', '#addAxisValueTypeName', generalTypes, function () { });
                $('#addAxisValueTypeName').val('STRING');
            }
        });
        buildDropDown('#addAxisValueTypeList', '#addAxisValueTypeName', generalTypes, function () { });
        $('#addAxisName').val('');
        $('#addAxisModal').modal();
    }

    function addAxisOk()
    {
        $('#addAxisModal').modal('hide');
        var axisName = $('#addAxisName').val();
        var axisType = $('#addAxisTypeName').val();
        var axisValueType = $('#addAxisValueTypeName').val();
        var result = call("ncubeController.addAxis", [getAppId(), _selectedCubeName, axisName, axisType, axisValueType]);
        if (result.status === true)
        {
            loadCube();
        }
        else
        {
            _errorId = showNote("Unable to add axis '" + axisName + "':<hr class=\"hr-small\"/>" + result.data);
        }
    }

    function deleteAxis(axisName)
    {
        if (!ensureModifiable('Axis cannot be deleted.'))
        {
            return;
        }

        $('#deleteAxisName').val(axisName);
        $('#deleteAxisModal').modal();
    }

    function deleteAxisOk()
    {
        $('#deleteAxisModal').modal('hide');
        var axisName = $('#deleteAxisName').val();
        var result = call("ncubeController.deleteAxis", [getAppId(), _selectedCubeName, axisName]);
        if (result.status === true)
        {
            loadCube();
        }
        else
        {
            _errorId = showNote("Unable to delete axis '" + axisName + "':<hr class=\"hr-small\"/>" + result.data);
        }
    }


    function runAllTests() {
        _errorId = showNote('Functionality not implemented yet.');
    }

    function saveAllTests(modelIsUpToDate)
    {
        if (!ensureModifiable("Unable to save all tests."))
        {
            return;
        }

        if (_testData == null)
        {
            _errorId = showNote('No test selected.  There are no tests to save.');
            return;
        }

        if (!modelIsUpToDate) {
            var test = getActiveTest();

            //  If a test is currently selected
            if (test != null) {
                //  locate test in list to add it in...and add it before saving.
                _testData[_testSelectionAnchor] = test;
            }
        }

        var result = call("ncubeController.saveTests", [getAppId(), _selectedCubeName, _testData]);

        if (!result.status)
        {
            _errorId = showNote("Unable to save TestData:<hr class=\"hr-small\"/>" + result.data);
        }
    }

    function getActiveTest()
    {
        var test = {};
        var name = $("#selectedTestName").html();

        if (name == null)
        {
            return null;
        }

        test["name"] = name;
        test["@type"] = "com.cedarsoftware.ncube.NCubeTest";
        test["coord"] = retrieveParameters();
        test["expected"] = retrieveAssertions();
        return test;
    }

    function retrieveParameters() {
        var parameters = $("#testParameters > div[parameter-id]");
        var coord = new Array(parameters.length);

        $.each(parameters, function (index, value)
        {
            var pair = {};
            var v = $(value);
            pair['key'] = v.attr("parameter-id");
            pair['value'] = retrieveCellInfo(v, true);
            coord[index] = pair;
        });

        return coord;
    }

    function retrieveAssertions() {
        var assertions = $('#testAssertions > div[parameter-id]');
        var array = new Array(assertions.length);

        $.each(assertions, function(index, value) {
            array[index] = retrieveCellInfo($(value), false);
        });

        return array;
    }

    function retrieveCellInfo(group, hasSelector) {
        var cell = {"@type":"com.cedarsoftware.ncube.CellInfo"};

        cell["value"] = group.find('input').val();
        cell["isUrl"] = group.find('button[value]').text() != "Value";

        if (hasSelector) {
            cell["dataType"] = group.find('select').val();
        } else {
            cell["dataType"] = "exp";
        }

        return cell;
    }

    function addParameterMenu() {
        clearError();
        if (!_selectedApp || !_selectedVersion || !_selectedCubeName || !_selectedStatus)
        {
            _errorId = showNote('No n-cube selected. Nothing to delete.');
            return;
        }

        $('#addParameterField').val('');

        _addParameterModal.modal({
            keyboard: true
        });

    }

    function addParameterOk() {
        _addParameterModal.modal('hide');

        var id = $('#addParameterField').val();

        // check to see if parameter already exists in parameter-key of #testAssertions .form-group
        var param = buildParameter(id, "string", false, '', true, false, deleteParameter);

        if ($('#testParameters .form-group').length > 0) {
            param.insertAfter('#testParameters .form-group:last');
        } else {
            $('#testParameters').append(param);
        }

        saveAllTests(false);
    }

    function addNewAssertion() {
        var count = $('#testAssertions .form-group').length;
        var param = buildParameter(count+1, "exp", false, 'output.return', false, true, deleteAssertion);

        if (count > 0) {
            param.insertAfter('#testAssertions .form-group:last');
        } else {
            $('#testAssertions').append(param);
        }

        saveAllTests(false);
    }

    function runCurrentTest() {
        clearError();
        if (!_selectedApp || !_selectedVersion || !_selectedCubeName || !_selectedStatus) {
            _errorId = showNote('No n-cube selected. Test cannot be run.');
            return;
        }

        if (_testData == null || _testSelectionAnchor == -1) {
            _errorId = showNote('No test selected.  Test cannot be run.');
            return;
        }

        try {
            var test = getActiveTest();
            _testData[_testSelectionAnchor] = test;

            var result = call("ncubeController.runTest", [getAppId(), _selectedCubeName, test]);
            saveAllTests(true);

            if (result.status != true) {
                showTestResult(false, "Could not run test:  " + result.data);

                $('#testLayoutCenter > .well').animate({
                    scrollTop: _testResultsDiv.offset().top
                }, 200);

                return;
            }

            showTestResult(result.data["_result"], result.data["_message"]);


            $('#testLayoutCenter > .well').animate({
                scrollTop: _testResultsDiv.offset().top
            }, 200);

        } catch (e) {
            _errorId = showNote("Could not run cube test:<hr class=\"hr-small\"/>" + e.message);
        }
    }

    function showTestResult(success, message)
    {
        _testResultsDiv.hide();

        var testResults = $('#testResults');
        testResults.empty();

        if (success)
        {
            _testResultsDiv.addClass("panel-success");
            _testResultsDiv.removeClass("panel-danger");
        }
        else
        {
            _testResultsDiv.addClass("panel-danger");
            _testResultsDiv.removeClass("panel-success");
        }

        testResults.html(message);
        _testResultsDiv.fadeIn("fast");
    }

    function updateAxis(axisName)
    {
        if (!ensureModifiable('Axis cannot be updated.'))
        {
            return false;
        }

        var result = call("ncubeController.getAxis", [getAppId(), _selectedCubeName, axisName]);
        var axis;
        if (result.status === true)
        {
            axis = result.data;
        }
        else
        {
            _errorId = showNote("Could not retrieve axes for ncube '" + _selectedCubeName + "':<hr class=\"hr-small\"/>" + result.data);
            return;
        }
        var isRule = axis.type.name == 'RULE';
        var isNearest = axis.type.name == 'NEAREST';
        $('#updateAxisLabel').html('Update Axis');
        $('#updateAxisName').val(axisName);
        $('#updateAxisTypeName').val(axis.type.name);
        $('#updateAxisValueTypeName').val(axis.valueType.name);
        $('#updateAxisDefaultCol').prop({'checked': axis.defaultCol != null});
        if (isRule)
        {
            hideAxisSortOption();
            showAxisDefaultColumnOption(axis);
            showAxisFireAllOption(axis);
        }
        else if (isNearest)
        {
            hideAxisSortOption();
            hideAxisDefaultColumnOption();
            hideAxisFireAllOption();
        }
        else
        {
            showAxisSortOption(axis);
            showAxisDefaultColumnOption(axis);
            hideAxisFireAllOption();
        }
        _axisName = axisName;
        $('#updateAxisModal').modal({
            keyboard: true
        });
    }

    function showAxisSortOption(axis)
    {
        $('#updateAxisSortOrderRow').show();
        $('#updateAxisSortOrder').prop({'checked': axis.preferredOrder == 0, 'disabled': false});
    }

    function hideAxisSortOption()
    {
        $('#updateAxisSortOrderRow').hide();
    }

    function showAxisDefaultColumnOption(axis)
    {
        $('#updateAxisDefaultColRow').show();
        $('#updateAxisDefaultCol').prop({'checked': axis.defaultCol != null, 'disabled': false});
    }

    function hideAxisDefaultColumnOption()
    {
        $('#updateAxisDefaultColRow').hide();
    }

    function showAxisFireAllOption(axis)
    {
        $('#updateAxisFireAllRow').show();
        $('#updateAxisFireAll').prop({'checked': axis.fireAll == true, 'disabled': false});
    }

    function hideAxisFireAllOption()
    {
        $('#updateAxisFireAllRow').hide();
    }

    function updateAxisOk()
    {
        $('#updateAxisModal').modal('hide');
        var axisName = $('#updateAxisName').val();
        var hasDefault = $('#updateAxisDefaultCol').prop('checked');
        var sortOrder = $('#updateAxisSortOrder').prop('checked');
        var fireAll = $('#updateAxisFireAll').prop('checked');
        var result = call("ncubeController.updateAxis", [getAppId(), _selectedCubeName, _axisName, axisName, hasDefault, sortOrder, fireAll]);
        if (result.status === true)
        {
            loadCube();
        }
        else
        {
            _errorId = showNote("Unable to update axis '" + axisName + "':<hr class=\"hr-small\"/>" + result.data);
        }
    }

    function loadColumns(axis)
    {
        var insTitle = $('#editColInstTitle');
        var inst = $('#editColInstructions');
        if ('DISCRETE' == axis.type.name)
        {
            insTitle.html('Instructions - Discrete Column');
            inst.html("<i>Discrete</i> column has a single value per column. Values are matched with '='. \
            Strings are matched case-sensitively.  Look ups are indexed and run \
            in <a href=\"http://en.wikipedia.org/wiki/Time_complexity\" target=\"_blank\">O(log n)</a>. \
        <ul><li>Examples: \
        <ul> \
        <li>Enter string values as is, no quotes: <code>OH</code></li> \
        <li>Valid number: <code>42</code></li> \
        <li>Valid date: <code>2015/02/14</code> (or <code>14 Feb 2015</code>, <code>Feb 14, 2015</code>, <code>February 14th, 2015</code>, <code>2015-02-14</code>)</li> \
        <li>Do not use mm/dd/yyyy or dd/mm/yyyy. \
        </li></ul></li></ul>");
        }
        else if ('RANGE' == axis.type.name)
        {
            insTitle.html('Instructions - Range Column');
            inst.html("A <i>Range</i> column contains a <i>low</i> and <i>high</i> value.  It matches when \
            <i>value</i> is within the range: value >= <i>low</i> and value < <i>high</i>. Look ups are indexed \
            and run in <a href=\"http://en.wikipedia.org/wiki/Time_complexity\" target=\"_blank\">O(log n)</a>.\
        <ul><li>Enter low value, high value. Treated [inclusive, exclusive).</li> \
        <li>Examples: \
        <ul> \
        <li><i>Number range</i>: <code>25, 75</code> (meaning x >= 25 AND x < 75)</li> \
        <li><i>Number range</i>: <code>[100, 1000]</code> (brackets optional)</li> \
        <li><i>Date range</i>: <code>2015/01/01, 2017-01-01</code> (date >= 2015-01-01 AND date < 2017-01-01) \
        </li></ul></li></ul>");
        }
        else if ('SET' == axis.type.name)
        {
            insTitle.html('Instructions - Set Column');
            inst.html("A <i>Set</i> column can contain unlimited discrete values and ranges. Discrete values \
            match with '=' and ranges match when value is within the range [inclusive, exclusive).  Overlapping\
            ranges and values are <b>not</b> allowed.  If you need that capability, use a <i>Rule</i> axis.\
            Look ups are indexed and run in <a href=\"http://en.wikipedia.org/wiki/Time_complexity\" target=\"_blank\">O(log n)</a>.\
        <ul><li>Examples: \
        <ul> \
        <li><i>Numbers</i>: <code>6, 10, [20, 30], 45</code></li> \
        <li><i>Strings</i>: <code>TX, OH, GA</code></li> \
        <li><i>Strings (3) with spaces</i>: <code>brown fox, jumps honey badger, is eaten</code></li> \
        <li><i>Date range</i>: <code>[2010/01/01, 2012/12/31]</code></li> \
        <li><i>Date ranges</i>: <code>[2015-01-01, 2016-12-31], [2019/01/01, 2020/12/31]</code> \
        </li></ul></li></ul>");
        }
        else if ('NEAREST' == axis.type.name)
        {
            insTitle.html('Instructions - Nearest Column');
            inst.html("A <i>Nearest</i> column has a single value per column.  The <i>closest</i> column on the \
            axis to the passed in value is matched.  Strings are compared similar to spell-check \
            (See <a href=\"http://en.wikipedia.org/wiki/Levenshtein_distance\" target=\"_blank\">Levenshtein</a> algorithm). \
            Lat/Lon's column values are compared using earth curvature in distance calculation \
            (See <a href=\"http://en.wikipedia.org/wiki/Haversine_formula\" target=\"_blank\">Haversine</a> forumla). \
            Numbers compared using abs(column - value).  Look ups scan all columns and run in \
            <a href=\"http://en.wikipedia.org/wiki/Time_complexity\" target=\"_blank\">O(n)</a>. \
        <ul><li>Examples: \
        <ul> \
        <li>With columns <code>Alpha, Bravo, Charlie</code>, <i>value</i> <code>alfa</code> will match column <code>Alpha</code>.  It has the closest 'edit' distance.</li> \
        <li>With columns <code>1, 10, 100, 1000</code>, <i>value</i> <code>400</code> will match column <code>100</code>. (Distance of 300 is smallest).</li> \
        <li>Dates are entered in the same formats in Discrete column instructions (many formats supported).</li> \
        <li>Do not use mm/dd/yyyy or dd/mm/yyyy for dates.</li></ul></li></ul>");
        }
        else if ('RULE' == axis.type.name)
        {
            insTitle.html('Instructions - Rule Column');
            inst.html("A <i>Rule condition</i> column is entered as a rule name and condition.  All rule conditions \
            that evaluate to <i>true</i> have their associated statement cells executed.  By default all <i>true</i> \
            conditions will fire. (See our definition of <a href=\"http://groovy.codehaus.org/Groovy+Truth\" target=\"_blank\">true</a>). \
            The Rule axis can be set so that only the first <i>true</i> condition fires.  When running a rule-cube, \
            if the name of a rule is bound to the rule axis, execution will start on the named rule.  A rule axis can \
            have a <i>Default</i> column. Just like all other axis types, at least one condition on a rule axis must fire, \
            otherwise a CoordinateNotFound exception will be thrown.  Look ups scan all columns (except when fire once is indicated) \
            and run in <a href=\"http://en.wikipedia.org/wiki/Time_complexity\" target=\"_blank\">O(n)</a>. \
        <ul><li>Notes: \
        <ul> \
        <li>Enter the [optional] rule name in the top line (no quotes).</li> \
        <li>Enter <i>condition</i> in <a href=\"http://groovy.codehaus.org/\" target=\"_blank\">Groovy</a> on the second line.</li> \
        <li>The <i>input</i> and <i>output</i> Maps and <i>ncube</i> are available in the condition and statements (cells).</li> \
        <li><i>Example condition</i>: <code>input.state == 'OH'</code></li> \
        </ul></li></ul>");
        }
        else
        {
            insTitle.html('Instructions');
            inst.html('Unknown axis type');
        }

        var axisList = axis.columns['@items'];
        _columnList.empty();
        _columnList.prop('model', axis);
        var displayOrder = 0;
        $.each(axisList, function (key, item)
        {
            if (!item.displayOrder || item.displayOrder < 2147483647)
            {   // Don't add default column in
                item.displayOrder = displayOrder++;
                var rowDiv = $('<div/>').prop({class: "row", "model": item});
                var div = $('<div/>').prop({class: "input-group"});
                var span = $('<span/>').prop({class: "input-group-addon"});
                var inputBtn = $('<input/>').prop({class: "editColCheckBox", "type": "checkbox"});
                if (item.checked === true)
                {
                    inputBtn[0].checked = true;
                }

                if (axis.type.name == 'RULE')
                {
                    if (!item.metaProps)
                    {
                        item.metaProps = {"name": "Condition " + displayOrder};
                    }
                    var inputName = $('<input/>').prop({class: "form-control", "type": "text"});
                    inputName.attr({"data-type": "name"});
                    inputName.blur(function ()
                    {
                        item.metaProps.name = inputName.val();
                    });
                    inputName.val(item.metaProps.name);
                }

                var inputText = $('<input/>').prop({class: "form-control", "type": "text"});
                inputText.attr({"data-type":"cond"});
                inputText.blur(function()
                {
                    item.value = inputText.val();
                });

                inputText.val(item.value);
                span.append(inputBtn);
                div.append(span);
                if (axis.type.name == 'RULE')
                {
                    div.append(inputName);
                }
                div.append(inputText);
                rowDiv.append(div);
                _columnList.append(rowDiv);
            }
        });
    }

    function ensureModifiable(operation)
    {
        clearError();
        if (!_selectedApp || !_selectedVersion || !_selectedCubeName || !_selectedStatus)
        {
            _errorId = showNote(operation + ' No n-cube selected.');
            return false;
        }
        if (_selectedStatus == "RELEASE")
        {
            _errorId = showNote(operation + ' Only a SNAPSHOT version can be modified.');
            return false;
        }
        if (isHeadSelected())
        {
            selectBranch();
            return false;
        }

        return true;
    }

    function changeType()
    {
        if (!ensureModifiable('Cell types cannot be changed.'))
        {
            return;
        }

        // TODO: Turn off field value, then pop-up edit cell modal.
        // Set flag in modal so that it handles OK differently, has no clear.
        // In editCell() make sure to turn on appropriate fields.

        alert('Change type not yet implemented.');
    }

    function clearCache()
    {
        var result = call("ncubeController.clearCache", [getAppId()]);

        if (result.status === false)
        {
            _errorId = showNote('Unable to fetch the cell contents: ' + result.data);
        }
    }

    // =========================== Everything to do with Column Editing ===============================
    function addColumnEditListeners()
    {
        $('#editColSelectAll').click(function ()
        {
            checkAll(true, '.editColCheckBox')
        });
        $('#editColSelectNone').click(function ()
        {
            checkAll(false, '.editColCheckBox')
        });
        $('#editColAdd').click(function ()
        {
            editColAdd()
        });
        $('#editColDelete').click(function ()
        {
            editColDelete()
        });
        $('#editColUp').click(function ()
        {
            editColUp()
        });
        $('#editColDown').click(function ()
        {
            editColDown()
        });
        $('#editColumnsCancel').click(function ()
        {
            editColCancel()
        });
        $('#editColumnsSave').click(function ()
        {
            editColSave()
        });
    }

    function editColumns(axisName)
    {
        if (!ensureModifiable('Columns cannot be edited.'))
        {
            return false;
        }

        var result = call("ncubeController.getAxis", [getAppId(), _selectedCubeName, axisName]);
        var axis;
        if (result.status === true)
        {
            axis = result.data;
            if (!axis.columns['@items'])
            {
                axis.columns['@items'] = [];
            }
            if (axis.defaultCol)
            {   // Remove actual Default Column object (not needed, we can infer it from Axis.defaultCol field being not null)
                axis.columns["@items"].splice(axis.columns["@items"].length - 1, 1);
            }
        }
        else
        {
            _errorId = showNote("Could not retrieve axes for n-cube '" + _selectedCubeName + "':<hr class=\"hr-small\"/>" + result.data);
            return;
        }
        sortColumns(axis);
        loadColumns(axis);
        var moveBtnAvail = axis.preferredOrder == 1;
        if (moveBtnAvail === true)
        {
            $('#editColUp').show();
            $('#editColDown').show();
        }
        else
        {
            $('#editColUp').hide();
            $('#editColDown').hide();
        }
        $('#editColumnsLabel').html('Edit ' + axisName);
        $('#editColumnsModal').modal();
    }

    function sortColumns(axis)
    {
        if (axis.preferredOrder == 1)
        {
            axis.columns['@items'].sort(function(a, b)
            {
                return a.displayOrder - b.displayOrder;
            });
        }
    }

    function editColAdd()
    {
        var input = $('.editColCheckBox');
        var loc = -1;
        $.each(input, function (index, btn)
        {
            if ($(this).prop('checked'))
            {
                loc = index;
            }
        });
        var axis = _columnList.prop('model');
        var newCol = {
            '@type': 'com.cedarsoftware.ncube.Column',
            'value': 'newValue',
            'id': getUniqueId()
        };

        if (loc == -1 || axis.preferredOrder == 0)
        {
            axis.columns['@items'].push(newCol);
            loc = input.length - 1;
        }
        else
        {
            axis.columns['@items'].splice(loc + 1, 0, newCol);
        }
        loadColumns(axis);

        // Select newly added column name, so user can just type over it.
        input = _columnList.find('.form-control');
        input[loc + 1].select();
    }

    function editColDelete()
    {
        var axis = _columnList.prop('model');
        var input = $('.editColCheckBox');
        var cols = axis.columns['@items'];
        var colsToDelete = [];
        $.each(input, function (index, btn)
        {
            if ($(this).prop('checked'))
            {
                colsToDelete.push(index);
            }
        });

        // Walk through in reverse order, deleting from back to front so that
        // the correct elements are deleted.
        for (var i=colsToDelete.length - 1; i >= 0; i--)
        {
            cols.splice(colsToDelete[i], 1);
        }
        loadColumns(axis);
    }

    function editColUp()
    {
        var axis = _columnList.prop('model');
        var cols = axis.columns['@items'];
        var input = $('.editColCheckBox');

        if (cols && cols.length > 0 && input[0].checked)
        {   // Top one checked, cannot move any items up
            return;
        }

        for (var i=0; i < input.length - 1; i++)
        {
            var tag = input[i];
            cols[i].checked = tag.checked;
            if (!tag.checked)
            {
                var nextTag = input[i + 1];
                cols[i + 1].checked = nextTag.checked;
                if (nextTag.checked)
                {
                    tag.checked = true;
                    nextTag.checked = false;

                    var temp = cols[i];
                    cols[i] = cols[i + 1];
                    cols[i + 1] = temp;

                    cols[i].checked = true;
                    cols[i + 1].checked = false;
                }
            }
        }

        loadColumns(axis);
    }

    function editColDown()
    {
        var axis = _columnList.prop('model');
        var cols = axis.columns['@items'];
        var input = $('.editColCheckBox');

        if (cols && cols.length > 0 && input[cols.length - 1].checked)
        {   // Bottom one checked, cannot move any items down
            return;
        }

        for (var i=input.length - 1; i > 0; i--)
        {
            var tag = input[i];
            cols[i].checked = tag.checked;
            if (!tag.checked)
            {
                var nextTag = input[i - 1];
                cols[i - 1].checked = nextTag.checked;
                if (nextTag.checked)
                {
                    tag.checked = true;
                    nextTag.checked = false;

                    var temp = cols[i];
                    cols[i] = cols[i - 1];
                    cols[i - 1] = temp;

                    cols[i].checked = true;
                    cols[i - 1].checked = false;
                }
            }
        }

        loadColumns(axis);
    }

    function editColCancel()
    {
        $('#editColumnsModal').modal('hide');
    }

    function editColSave()
    {
        var axis = _columnList.prop('model');
        _columnList.find('input[data-type=cond]').each(function(index, elem)
        {
            axis.columns['@items'][index].value = elem.value;
        });
        _columnList.find('input[data-type=name]').each(function(index, elem)
        {
            var col = axis.columns['@items'][index];
            if (col.metaProp)
            {
                col.metaProp.name = elem.value;
            }
        });
        $('#editColumnsModal').modal('hide');
        axis.defaultCol = null;
        var result = call("ncubeController.updateAxisColumns", [getAppId(), _selectedCubeName, axis]);

        if (result.status !== true)
        {
            _errorId = showNote("Unable to update columns for axis '" + axis.name + "':<hr class=\"hr-small\"/>" + result.data);
        }
        reloadCube();
    }

    // =========================== Everything to do with Cell Editing ===============================

    function addEditCellListeners()
    {
        $('#editCellClear').click(function()
        {
            editCellClear();
        });
        $('#editCellCancel').click(function()
        {
            editCellCancel();
        });
        $('#editCellOk').click(function()
        {
            editCellOK();
        });
    }

    function editCell(value)
    {
        if (!ensureModifiable('Cell cannot be updated.'))
        {
            return;
        }

        var result = call("ncubeController.getCellNoExecute", [getAppId(), _selectedCubeName, _cellId]);

        if (result.status === false)
        {
            _errorId = showNote('Unable to fetch the cell contents: ' + result.data);
            return;
        }

        var cellInfo = result.data;
        // Set the cell value (String)
        _editCellValue.val(cellInfo.value ? cellInfo.value : "");
        if (cellInfo.dataType == "null" || !cellInfo.dataType)
        {
            cellInfo.dataType = "string";
        }

        // Set the correct entry in the drop-down
        if (cellInfo.isUrl)
        {
            _urlDropdown.val(cellInfo.dataType);
        }
        else
        {
            _valueDropdown.val(cellInfo.dataType);
        }

        // Choose the correct data type drop-down (show/hide the other)
        _urlDropdown.toggle(cellInfo.isUrl);
        _valueDropdown.toggle(!cellInfo.isUrl);

        // Set the URL check box
        _editCellRadioURL.find('input').prop('checked', cellInfo.isUrl);

        // Show/Hide the Cache check box
        _editCellCache.toggle(cellInfo.isUrl && cellInfo.dataType != "exp" && cellInfo.dataType != "model");

        // Set the Cache check box state
        _editCellCache.find('input').prop('checked', cellInfo.isCached);

        _editCellModal.modal('show');
    }

    function editCellClear()
    {
        _editCellModal.modal('hide');
        var result = call("ncubeController.updateCell", [getAppId(), _selectedCubeName, _cellId, null]);

        if (result.status === false)
        {
            _cellId = null;
            _errorId = showNote('Unable to clear cell:<hr class="hr-small"/>' + result.data);
            return;
        }

        _uiCellId.html('');
        _uiCellId.attr({'class':'cell'});
        _cellId = null;
    }

    function editCellCancel()
    {
        _cellId = null;
        _editCellModal.modal('hide');
    }

    function editCellOK()
    {
        var cellInfo = {'@type':'com.cedarsoftware.ncube.CellInfo'};
        cellInfo.isUrl = _editCellRadioURL.find('input').is(':checked');
        cellInfo.value = _editCellValue.val();
        cellInfo.dataType = cellInfo.isUrl ? _urlDropdown.val() : _valueDropdown.val();
        cellInfo.isCached = _editCellCache.find('input').is(':checked');
        _editCellModal.modal('hide');

        var result = call("ncubeController.updateCell", [getAppId(), _selectedCubeName, _cellId, cellInfo]);

        if (result.status === false)
        {
            _cellId = null;
            _errorId = showNote('Unable to update cell:<hr class="hr-small"/>' + result.data);
            return;
        }

        if (cellInfo.isUrl)
        {
            _uiCellId.html(cellInfo.value);
            _uiCellId.attr({'class':'cell cell-url'});
        }
        else if (cellInfo.dataType == "exp" || cellInfo.dataType == "method")
        {
            var pre2 = $('<pre/>').attr({'class':'ncube-pre'});
            pre2.html(cellInfo.value);
            _uiCellId.html('');
            _uiCellId.append(pre2);
            _uiCellId.attr({'class':'cell cell-code'});
        }
        else
        {
            _uiCellId.html(cellInfo.value);
            _uiCellId.attr({'class':'cell'});
        }
        _cellId = null;
        reloadCube();
    }

    // =============================================== End Cell Editing ================================================

    // ======================================== Everything to do with Branching ========================================

    function addBranchListeners()
    {
        // Main menu options
        $('#branchSelect').click(function()
        {
            selectBranch();
        });
        $('#branchCommit').click(function()
        {
            commitBranch(true);
        });
        $('#commitRollbackSelectAll').click(function()
        {
            checkAll(true, 'input[type="checkbox"]')
        });
        $('#commitRollbackSelectNone').click(function()
        {
            checkAll(false, 'input[type="checkbox"]')
        });
        $('#commitOk').click(function()
        {
            commitOk();
        });
        $('#rollbackOk').click(function()
        {
            rollbackOk();
        });
        $('#branchRollback').click(function()
        {
            commitBranch(false);
        });
        $('#branchUpdate').click(function()
        {
            updateBranch();
        });
        $('#branchDelete').click(function()
        {
            deleteBranch();
        });
        $('#deleteBranchOk').click(function()
        {
            deleteBranchOk();
        });
        // From 'Select / Create Branch' Modal
        $('#createBranch').click(function()
        {
            createBranch();
        });
        $('#branchNameWarning').find('button').click(function()
        {
            $('#branchNameWarning').hide();
        });
        $('#acceptTheirs').click(function()
        {
            acceptTheirs();
        });
        $('#acceptMine').click(function()
        {
            acceptMine();
        });
    }

    function showActiveBranch()
    {
        $('#BranchMenu').html('Branch:&nbsp;<button class="btn-primary">&nbsp;' + (_selectedBranch || head) + '&nbsp;<b class="caret"></b></button>');
    }

    function selectBranch()
    {
        clearError();
        $('#newBranchName').val("");
        $('#branchNameWarning').hide();

        var result = call("ncubeController.getBranches", []);

        if (!result.status)
        {
            _errorId = showNote('Unable to get branches:<hr class="hr-small"/>' + result.data);
            return;
        }

        var branchNames = result.data;
        var ul = $('#branchList');
        ul.empty();

        $.each(branchNames, function (index, name)
        {
            if (!name)
            {
                name = head;
            }
            var li = $('<li/>').attr({'class': 'list-group-item skinny-lr'});
            var anchor = $('<a href="#"/>');
            anchor.html('<kbd> ' + name + ' </kbd>');
            anchor.click(function ()
            {
                changeBranch(name);
            });
            li.append(anchor);
            ul.append(li);
        });

        _selectBranchModal.modal('show');
    }

    function createBranch()
    {
        clearError();

        var branchName = $('#newBranchName').val();
        var validName = /^[a-zA-Z_][0-9a-zA-Z_.-]*$/i;

        if (!branchName || !validName.test(branchName) || head.toLowerCase() == branchName.toLowerCase())
        {
            $('#branchNameWarning').show();
            return;
        }

        var appId = getAppId();
        appId.branch = branchName;
        if (!_selectedApp || !_selectedVersion || !_selectedStatus)
        {
            changeBranch(branchName);
            return;
        }

        var result = call("ncubeController.createBranch", [appId]);
        if (!result.status)
        {
            _errorId = showNote('Unable to create branch:<hr class="hr-small"/>' + result.data);
            return;
        }

        changeBranch(branchName);
    }

    function changeBranch(branchName)
    {
         if (head.toLowerCase() == branchName.toLowerCase())
         {
             branchName = head;
         }
        _selectedBranch = branchName;
        localStorage[SELECTED_BRANCH] = branchName;
        _selectBranchModal.modal('hide');

        showActiveBranch();
        loadAppNames();
        loadVersions();
        loadNCubes();
        loadAppListView();
        loadStatusListView();
        loadVersionListView();
        loadNCubeListView();
        loadCube();

        _errorId = showNote('<kbd>' + (branchName || head) + '</kbd>', 'Active Branch', 2000);
    }

    function commitBranch(state)
    {
        clearError();

        var errMsg;
        var title;
        var btnLabel;
        if (state)
        {
            errMsg = 'commit to';
            title = 'Commit changes';
            btnLabel = 'Commit';
            $('#commitOk').show();
            $('#rollbackOk').hide();
        }
        else
        {
            errMsg = 'rollback in';
            title = 'Rollback changes';
            btnLabel = 'Rollback';
            $('#commitOk').hide();
            $('#rollbackOk').show();
        }

        if (isHeadSelected())
        {
            _errorId = showNote('You cannot ' + errMsg + ' HEAD.');
            return;
        }

        var result = call("ncubeController.getBranchChanges", [getAppId()]);

        if (!result.status || !result.data)
        {
            _errorId = showNote('Unable to get branch changes:<hr class="hr-small"/>' + result.data);
            return;
        }

        $('#commitRollbackLabel').html(title);
        $('#commitRollbackOk').text(btnLabel);

        var branchChanges = result.data;

        _commitModal.prop('changes', branchChanges);
        var ul = $('#commitRollbackList');
        ul.empty();

        $.each(branchChanges, function (index, infoDto)
        {
            var li = $('<li/>').prop({class: 'list-group-item skinny-lr'});
            var div = $('<div/>').prop({class:'container-fluid'});
            var checkbox = $('<input>').prop({class:'commitCheck', type:'checkbox'});
            var label = $('<label/>').prop({class: 'checkbox no-margins'}).text(infoDto.name);

            if (!infoDto.headSha1)
            {
                if (infoDto.sha1)
                {
                    label.addClass('cube-added');
                }
                else
                {
                    if (infoDto.changeType == 'D')
                    {
                        label.addClass('cube-deleted');
                    }
                    else if (infoDto.changeType == 'R')
                    {
                        label.addClass('cube-restored');
                    }
                }
            }
            else
            {
                if (infoDto.headSha1 != infoDto.sha1)
                {
                    label.addClass('cube-modified');
                }
                else if (infoDto.changeType == 'D')
                {
                    label.addClass('cube-deleted');
                }
                else if (infoDto.changeType == 'R')
                {
                    label.addClass('cube-restored');
                }
            }
            checkbox.prependTo(label); // <=== create input without the closing tag
            div.append(label);
            li.append(div);
            ul.append(li);
        });

        checkAll(true, 'input[type="checkbox"]');

        //TODO: After Axis, column, or cell modifications, mark _selectedCubeName as modified (blue)
        //TODO: Break up this JS file into sections separated by functionality
        //TODO: Eliminate scan through cubes 2nd time to set selected / not-selected (remember selected?)
        _commitModal.modal('show');
    }

    function commitOk()
    {
        var branchChanges = _commitModal.prop('changes');
        var input = $('.commitCheck');
        var changes = [];
        $.each(input, function (index, label)
        {
            if ($(this).is(':checked'))
            {
                changes.push(branchChanges[index]);
            }
        });

        _commitModal.modal('hide');
        var result = call("ncubeController.commitBranch", [getAppId(), changes]);

        if (result.status === false)
        {
            _cellId = null;
            mergeBranch(result.data);
            return;
        }

        _errorId = showNote('Successfully committed ' + changes.length + ' cube(s).', 'Note', 5000);
        // TODO: Modify cubeList - don't call back to server for full list - use return value.
        loadNCubes();
        loadNCubeListView();
        reloadCube();
    }

    function rollbackOk()
    {
        var branchChanges = _commitModal.prop('changes');
        var input = $('.commitCheck');
        var changes = [];
        $.each(input, function (index, label)
        {
            if ($(this).is(':checked'))
            {
                changes.push(branchChanges[index]);
            }
        });

        _commitModal.modal('hide');
        var result = call("ncubeController.rollbackBranch", [getAppId(), changes]);

        if (result.status === false)
        {
            _cellId = null;
            _errorId = showNote('Unable to rollback cubes:<hr class="hr-small"/>' + result.data);
            return;
        }

        _errorId = showNote('Successfully rolled back ' + changes.length + ' cube(s).', 'Note', 5000);
        loadNCubes();
        loadNCubeListView();
        reloadCube();
    }

    function updateBranch()
    {
        clearError();

        var result = call('ncubeController.updateBranch', [getAppId()]);
        if (!result.status)
        {
            mergeBranch(result.data);
            return;
        }

        _errorId = showNote('Branch Updated');
        loadNCubes();
        loadNCubeListView();
        reloadCube();
    }

    function deleteBranch()
    {
        if (isHeadSelected())
        {
            _errorId = showNote('HEAD branch cannot be deleted.');
            return;
        }

        $('#deleteBranchLabel').html("Delete '" + _selectedBranch + "' ?");
        $('#deleteBranchModal').modal();
    }

    function deleteBranchOk()
    {
        $('#deleteBranchModal').modal('hide');
        clearError();

        var result = call('ncubeController.deleteBranch', [getAppId()]);
        changeBranch(head);
        if (!result.status)
        {
            _errorId = showNote('Unable to delete branch:<hr class="hr-small"/>' + result.data);
        }
    }

    function mergeBranch(data)
    {
        var ul = $('#mergeList');
        ul.empty();
        $('#deltaDesc').val('');
        $.each(data, function(key, value)
        {
            if ('@type' != key)
            {
                var li = $('<li/>').prop({class: 'list-group-item skinny-lr'});
                var div = $('<div/>').prop({class:'container-fluid'});
                var checkbox = $('<input>').prop({type:'radio'});
                checkbox.click(function ()
                {
                    markMutuallyExclusive(checkbox);
                    var msg = data[key].message;
                    var diff = data[key].diff;
                    _mergeCubeName = key;
                    _mergeSha1 = data[key].sha1;
                    _mergeHeadSha1 = data[key].headSha1;

                    if (diff && diff['@items'] && diff['@items'].length > 0)
                    {
                        msg += '\n';
                        var len = diff['@items'].length;

                        for (var i=0; i < len; i++)
                        {
                            var delta = diff['@items'][i];
                            msg += (i + 1) + ': ' + delta.loc.name + ' ' + delta.type.name + ': ' + delta.desc + '\n';
                        }
                    }
                    $('#deltaDesc').val(msg);
                });
                var label = $('<label/>').prop({class: 'radio no-margins'}).text(key);
                checkbox.prependTo(label); // <=== create input without the closing tag
                div.append(label);
                li.append(div);
                ul.append(li);

            }
        });
        $('#mergeBranchModal').modal('show');
    }

    function markMutuallyExclusive(checkbox)
    {
        var inputs = $('#mergeList').find('input');
        $.each(inputs, function (key, value)
        {
            $(value).prop('checked', false);
        });
        checkbox.prop('checked', true );
    }

    function acceptTheirs()
    {
        $('#mergeBranchModal').modal('hide');

        if (_mergeCubeName == null)
        {
            _errorId = showNote('No cube selected, nothing to merge.');
            return;
        }
        var result = call('ncubeController.acceptTheirs', [getAppId(), _mergeCubeName, _mergeSha1]);
        if (result.status === true)
        {
            _errorId = showNote('Cube: ' + _mergeCubeName + ' updated in your branch with cube from HEAD');
        }
        else
        {
            _errorId = showNote('Unable to update your branch cube: ' + _mergeCubeName + ' with cube from HEAD:<hr class="hr-small"/>' + result.data);
        }
        _mergeCubeName = null;
        _mergeSha1 = null;
        _mergeHeadSha1 = null;
        loadNCubes();
        loadNCubeListView();
        reloadCube();
    }

    function acceptMine()
    {
        $('#mergeBranchModal').modal('hide');

        if (_mergeCubeName == null)
        {
            _errorId = showNote('No cube selected, nothing to merge.');
            return;
        }
        var result = call('ncubeController.acceptMine', [getAppId(), _mergeCubeName, _mergeHeadSha1]);
        if (result.status === true)
        {
            _errorId = showNote('Cube: ' + _mergeCubeName + ' updated in HEAD with cube from your branch');
        }
        else
        {
            _errorId = showNote('Unable to update HEAD cube: ' + _mergeCubeName + ' with cube from your branch:<hr class="hr-small"/>' + result.data);
        }
        _mergeCubeName = null;
        _mergeSha1 = null;
        _mergeHeadSha1 = null;
        loadNCubes();
        loadNCubeListView();
        reloadCube();
    }

    // =============================================== End Branching ===================================================

    // ============================================= General Utilities =================================================
    function loop()
    {
        setInterval(function()
        {
            var now = Date.now();
            if (now - _searchLastKeyTime > 150 && _searchKeyPressed)
            {
                _searchKeyPressed = false;
                runSearch();
            }
        }, 500);
    }

    function checkAll(state, queryStr)
    {
        var input = $(queryStr);
        $.each(input, function (index, btn)
        {
            $(this).prop('checked', state);
        });
    }

    function buildDropDown(listId, inputId, list, callback)
    {
        var ul = $(listId);
        ul.empty();
        $.each(list, function (key, value)
        {
            var li = $("<li/>");
            var anchor = $('<a href="#"/>');
            anchor.html(value);
            anchor.click(function ()
            {   // User clicked on a dropdown entry, copy its text to input field
                $(inputId).val(anchor.html());
                callback(anchor.html());
            });
            li.append(anchor);
            ul.append(li);
        });
    }

    function doesItemExist(item, list)
    {
        if (!item)
        {
            return false;
        }
        var found = false;
        $.each(list, function (index, value)
        {
            if (item.toLowerCase() === value.toLowerCase())
            {
                found = true;
                return;
            }
        });
        return found;
    }

    function showNote(msg, title, millis)
    {
        return $.gritter.add({
            title: (title || 'Note'),
            text: msg,
            image: './img/cube-logo.png',
            sticky: !millis,
            time: (millis || 0)
        });
    }

    function clearError()
    {
        if (_errorId)
        {
            $.gritter.remove(_errorId);
            _errorId = null;
        }
    }

    function getUniqueId()
    {
        return _colIds--;
    }

    function isHeadSelected()
    {
        return head == _selectedBranch;
    }
    /**
     * Get the ApplicationID based on the user's selections.  Tenant is sent not sent (server will fill
     * that in based on authentication.
     * @returns {app: *, version: *, status: string, branch: *}
     */
    function getAppId()
    {
        return {
            'app':_selectedApp,
            'version':_selectedVersion,
            'status':_selectedStatus,
            'branch':_selectedBranch
        }
    }
});
