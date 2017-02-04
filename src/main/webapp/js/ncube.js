/**
 * Main NCube editor
 *
 * @author John DeRegnaucourt (jdereg@gmail.com)
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

var NCubeEditor = (function ($)
{
    var nce = null;
    var _columnList = null;
    var _editCellModal = null;
    var _editCellValue = null;
    var _editCellCache = null;
    var _editCellRadioURL = null;
    var _valueDropdown = null;
    var _urlDropdown = null;
    var _axisName;
    var _cellId = null;
    var _uiCellId = null;
    var _clipboard = null;
    var _colIds = -1;   // Negative and gets smaller (to differentiate on server side what is new)
    var _clipFormat = CLIP_NCE;

    var init = function(info)
    {
        if (!nce)
        {
            nce = info;

            _columnList = $('#editColumnsList');
            _editCellModal = $('#editCellModal');
            _editCellValue = $('#editCellValue');
            _editCellCache = $('#editCellCache');
            _editCellRadioURL = $('#editCellRadioURL');
            _valueDropdown = $('#datatypes-value');
            _urlDropdown = $('#datatypes-url');
            _clipboard = $('#cell-clipboard');

            addColumnEditListeners();
            addEditCellListeners();

            _editCellRadioURL.change(function()
            {
                var isUrl = _editCellRadioURL.find('input').is(':checked');
                _urlDropdown.toggle(isUrl);
                _valueDropdown.toggle(!isUrl);
            });

            _urlDropdown.change(function()
            {
                enabledDisableCheckBoxes()
            });

            _valueDropdown.change(function()
            {
                enabledDisableCheckBoxes()
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
            _editCellModal.on('shown.bs.modal', function ()
            {
                $('#editCellValue').focus();
            });

            $(window).scroll(function() {
                clearTimeout($.data(this, 'scrollTimer'));
                $.data(this, 'scrollTimer', setTimeout(function() {
                    var scrollTop = $(this).scrollTop();
                    var scrollLeft = $(this).scrollLeft();
                    nce.saveViewPosition({scrollTop:scrollTop, scrollLeft:scrollLeft});
                }, 250));
            });

            $(document).keydown(function(e)
            {
                var isModalDisplayed = $('body').hasClass('modal-open');
                var focus = $(':focus');

                if (!isModalDisplayed && focus && focus.attr('id') != 'cube-search' && focus.attr('id') != 'cube-search-content')
                {
                    if (e.metaKey || e.ctrlKey)
                    {   // Control Key (command in the case of Mac)
                        if (e.keyCode == 88)
                        {
                            editCutCopy(true);  // true = isCut
                        }
                        else if (e.keyCode == 67)
                        {   // Ctrl-C or Ctrl-X
                            if (CLIP_NCE == _clipFormat)
                            {   // NCE
                                editCutCopy(false); // false = copy
                            }
                            else
                            {   // Excel
                                excelCopy();
                            }
                        }
                        else if (e.keyCode == 75)
                        {   // Toggle clipboard format to copy (NCE versus Excel)
                            if (CLIP_NCE == _clipFormat)
                            {
                                _clipFormat = 'EXCEL';
                                nce.showNote('Use generic format (Excel support)', 'Note', 2000);
                            }
                            else
                            {
                                _clipFormat = CLIP_NCE;
                                nce.showNote('Use N-Cube Editor format (NCE support)', 'Note', 2000);
                            }
                        }
                        else if (e.keyCode == 86)
                        {   // Ctrl-V
                            // Point focus to hidden text area so that it will receive the pasted content
                            editPaste();
                        }
                    }
                }
            });
        }
    };

    var load = function()
    {
        loadCubeHtml();

        $('.dropdown-toggle').click(function () {
            var button = $(this);
            var offset = button.offset();
            var dropDownTop = offset.top + button.outerHeight();
            var dropDownLeft = offset.left;

            var modal = button.closest('.modal-content');
            if (modal[0]) {
                var modalOffset = modal.offset();
                dropDownTop -= modalOffset.top;
                dropDownLeft -= modalOffset.left;
            }

            button.parent().find('ul').css({top: dropDownTop + 'px', left: dropDownLeft + 'px'});
        });
    };

    var loadCubeHtml = function()
    {
        var result = nce.call("ncubeController.getHtml", [nce.getSelectedTabAppId(), nce.getSelectedCubeName()], {noResolveRefs:true});
        if (result.status === true)
        {
            document.getElementById('ncube-content').innerHTML = result.data;

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
                an[0].innerHTML = "Update Axis...";
                an.click(function (e)
                {
                    e.preventDefault();
                    updateAxis(axisName)
                });
                li.append(an);
                ul.append(li);
                li = $('<li/>');
                an = $('<a href="#">');
                an[0].innerHTML = "Add Axis...";
                an.click(function (e)
                {
                    e.preventDefault();
                    addAxis();
                });
                li.append(an);
                ul.append(li);
                li = $('<li/>');
                an = $('<a href="#">');
                an[0].innerHTML = "Delete Axis...";
                an.click(function (e)
                {
                    e.preventDefault();
                    deleteAxis(axisName)
                });
                li.append(an);
                ul.append(li);
                li = $('<div/>').prop({'class': 'divider'});
                ul.append(li);
                li = $('<li/>');
                an = $('<a href="#">');
                an[0].innerHTML = "Edit " + axisName + " columns...";
                an.click(function (e)
                {
                    e.preventDefault();
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
            nce.showNote('Unable to load ' + nce.getSelectedCubeName() + ':<hr class="hr-small"/>' + result.data);
        }

        $('.cell-url a, .column-url a').each(function()
        {
            var anchor = $(this);
            anchor.click(function(event)
            {
                nce.clearNote();
                var link = anchor[0].innerHTML;
                if (link.indexOf('http:') == 0 || link.indexOf('https:') == 0 || link.indexOf('file:') == 0)
                {
                    window.open(link);
                }
                else
                {
                    var result = nce.call("ncubeController.resolveRelativeUrl", [nce.getSelectedTabAppId(), link], {noResolveRefs:true});
                    if (result.status === true && result.data)
                    {
                        link = result.data;
                        window.open(link);
                    }
                    else
                    {
                        var msg = result.data ? result.data : "Unable to resolve relative URL against entries in sys.classpath";
                        nce.showNote('Unable to open ' + link + ':<hr class="hr-small"/>' + msg);
                    }
                }
                event.preventDefault();
            });
        });

        processCellClicks();
        if (nce.getSelectedCubeName().indexOf('erne.') != 0)
        {
            buildCubeNameLinks();
        }

        scrollToSavedPosition();
    };

    var scrollToSavedPosition = function() {
        var pos = nce.getViewPosition();
        if (typeof pos === OBJECT) {
            $(window).scrollTop(pos.scrollTop);
            $(window).scrollLeft(pos.scrollLeft);
        }
    };

    var processCellClicks = function()
    {
        var ncubeTable = $('.table-ncube');

        // Install double-click handler on columns for easy access to 'edit columns' modal.
        ncubeTable.on('dblclick', 'th', function (e)
        {
            var col = $(e.target);
            if (col.hasClass('column'))
            {
                editColumns(col.attr('data-axis'));
            }
        });

        // Install double-click handle on the td tags for pop-up cell editing
        ncubeTable.on('dblclick', 'td', function (e)
        {
            _uiCellId = $(e.target);
            if (_uiCellId.hasClass('cell'))
            {
                _cellId = _uiCellId.attr('data-id').split("_");
                editCell();
            }
        });

        // Install click handler for selection rectangle support
        ncubeTable.on('click', 'td', function (e)
        {
            var cell = $(e.target);
            if (!cell.hasClass('cell'))
            {
                return;
            }

            if (event.altKey)
            {
                _uiCellId = $(e.target);
                _cellId = _uiCellId.attr('data-id').split("_");
                var result = nce.call("ncubeController.getCellCoordinate", [nce.getSelectedTabAppId(), nce.getSelectedCubeName(), _cellId]);
                if (result.status === true)
                {
                    nce.clearNote();
                    nce.displayMap(result.data, 'Coordinate');
                }
            }
            else if (event.shiftKey || event.ctrlKey)
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

        // Add ability for the user to double-click axis and pop-up the 'Update Axis' modal
        $('.ncube-head').each(function()
        {   // Only 1 per dimension, so no big deal adding listener this way.
            $(this).dblclick(function()
            {
                var div = $(this).find('div');
                var axisName = div.attr('data-id');
                updateAxis(axisName);
            });
        });
    };

    var countTH = function(row)
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
    };

    var getCol = function(cell)
    {
        var col = cell.parent().children().index(cell);
        return col;
    };

    var getRow = function(cell)
    {
        var row = cell.parent().parent().children().index(cell.parent());
        return row;
    };

    var clearSelectedCells = function()
    {
        $(".cell-selected").each(function()
        {
            $(this).removeClass('cell-selected');
        });
    };

    var buildCubeNameLinks = function()
    {
        // Step 1: Build giant cube list names string for pattern matching
        var s = "";
        var prefixes = ['rpm.class.', 'rpm.enum.', ''];
        var cubeMap = nce.getCubeMap();

        $.each(cubeMap, function (key)
        {
            if (key.length > 2)
            {   // 1. Only support n-cube names with 3 or more characters in them (too many false replaces will occur otherwise)
                // 2. Chop off accepted prefixes.
                for (var i=0; i < prefixes.length; i++)
                {
                    if (key.indexOf(prefixes[i]) == 0)
                    {
                        key = key.replace(prefixes[i], '');
                        break;
                    }
                }
                // 3. Reverse the cube list order (comes from server alphabetically case-insensitively sorted) to match
                // longer strings before shorter strings.
                // 4. Replace '.' with '\.' so that they are only matched against dots (period), not any character.
                s = escapeRegExp(key) + '|' + s;
            }
        });

        if (s.length > 0)
        {
            s = s.substring(0, s.length - 1);
        }
        s = '\\b(' + s + ')\\b';
        var regex = new RegExp(s, 'gi');

        // Step 2: Iterate through all columns and cells, replace matches with anchor tags

        $('.column:not(.column-url), .cell:not(.cell-url, .cell-code-def, .cell-def)').each(function ()
        {
            var cell = $(this);
            var html;
            if (cell.hasClass('column-code'))
            {
                html = cell[0].innerHTML;
            }
            else
            {
                html = cell[0].textContent;  // WAY faster than JQuery .html() or .text()
            }
            if (html && html.length > 2)
            {
                var found = false;

                html = html.replace(regex, function (matched)
                {
                    found = true;
                    return '<a class="nc-anc">' + matched + '</a>';
                });

                if (found)
                {   // substitute new text with anchor tag
                    cell[0].innerHTML = html;       // Much faster than JQuery .html('') or .text('')

                    // Add click handler that opens clicked cube names
                    cell.find('a').each(function ()
                    {
                        var link = $(this);
                        link.click(function (e)
                        {
                            e.preventDefault();
                            var cubeName = link[0].textContent.toLowerCase();

                            for (var i=0; i < prefixes.length; i++)
                            {
                                if (cubeMap[prefixes[i] + cubeName])
                                {
                                    nce.selectCubeByName(nce.getProperCubeName(prefixes[i] + link[0].textContent));
                                    break;
                                }
                            }
                        });
                    });
                }
            }
        });
    };

    var addAxis = function()
    {
        if (!nce.ensureModifiable('Axis cannot be added.'))
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
    };

    var addAxisOk = function()
    {
        $('#addAxisModal').modal('hide');
        var axisName = $('#addAxisName').val();
        var axisType = $('#addAxisTypeName').val();
        var axisValueType = $('#addAxisValueTypeName').val();
        var result = nce.call("ncubeController.addAxis", [nce.getSelectedTabAppId(), nce.getSelectedCubeName(), axisName, axisType, axisValueType]);
        if (result.status === true)
        {
            nce.loadCube();
        }
        else
        {
            nce.showNote("Unable to add axis '" + axisName + "':<hr class=\"hr-small\"/>" + result.data);
        }
    };

    var deleteAxis = function(axisName)
    {
        if (!nce.ensureModifiable('Axis cannot be deleted.'))
        {
            return;
        }

        $('#deleteAxisName').val(axisName);
        $('#deleteAxisModal').modal();
    };

    var deleteAxisOk = function()
    {
        $('#deleteAxisModal').modal('hide');
        var axisName = $('#deleteAxisName').val();
        var result = nce.call("ncubeController.deleteAxis", [nce.getSelectedTabAppId(), nce.getSelectedCubeName(), axisName]);
        if (result.status === true)
        {
            nce.loadCube();
        }
        else
        {
            nce.showNote("Unable to delete axis '" + axisName + "':<hr class=\"hr-small\"/>" + result.data);
        }
    };

    var updateAxis = function(axisName)
    {
        if (!nce.ensureModifiable('Axis cannot be updated.'))
        {
            return false;
        }

        var result = nce.call("ncubeController.getAxis", [nce.getSelectedTabAppId(), nce.getSelectedCubeName(), axisName]);
        var axis;
        if (result.status === true)
        {
            axis = result.data;
        }
        else
        {
            nce.showNote("Could not retrieve axes for ncube '" + nce.getSelectedCubeName() + "':<hr class=\"hr-small\"/>" + result.data);
            return;
        }
        var isRule = axis.type.name == 'RULE';
        var isNearest = axis.type.name == 'NEAREST';
        $('#updateAxisLabel')[0].textContent = 'Update Axis';
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
    };

    var showAxisSortOption = function(axis)
    {
        $('#updateAxisSortOrderRow').show();
        $('#updateAxisSortOrder').prop({'checked': axis.preferredOrder == 0, 'disabled': false});
    };

    var hideAxisSortOption = function()
    {
        $('#updateAxisSortOrderRow').hide();
    };

    var showAxisDefaultColumnOption = function(axis)
    {
        $('#updateAxisDefaultColRow').show();
        $('#updateAxisDefaultCol').prop({'checked': axis.defaultCol != null, 'disabled': false});
    };

    var hideAxisDefaultColumnOption = function()
    {
        $('#updateAxisDefaultColRow').hide();
    };

    var showAxisFireAllOption = function(axis)
    {
        $('#updateAxisFireAllRow').show();
        $('#updateAxisFireAll').prop({'checked': axis.fireAll == true, 'disabled': false});
    };

    var hideAxisFireAllOption = function()
    {
        $('#updateAxisFireAllRow').hide();
    };

    var updateAxisOk = function()
    {
        $('#updateAxisModal').modal('hide');
        var axisName = $('#updateAxisName').val();
        var hasDefault = $('#updateAxisDefaultCol').prop('checked');
        var sortOrder = $('#updateAxisSortOrder').prop('checked');
        var fireAll = $('#updateAxisFireAll').prop('checked');
        var result = nce.call("ncubeController.updateAxis", [nce.getSelectedTabAppId(), nce.getSelectedCubeName(), _axisName, axisName, hasDefault, sortOrder, fireAll]);
        if (result.status === true)
        {
            nce.loadCube();
        }
        else
        {
            nce.showNote("Unable to update axis '" + axisName + "':<hr class=\"hr-small\"/>" + result.data);
        }
    };

    var loadColumns = function(axis)
    {
        var insTitle = $('#editColInstTitle');
        var inst = $('#editColInstructions');
        if ('DISCRETE' == axis.type.name)
        {
            insTitle[0].textContent = 'Instructions - Discrete Column';
            inst[0].innerHTML = "<i>Discrete</i> column has a single value per column. Values are matched with '='. \
            Strings are matched case-sensitively.  Look ups are indexed and run \
            in <a href=\"http://en.wikipedia.org/wiki/Time_complexity\" target=\"_blank\">O(log n)</a>. \
        <ul><li>Examples: \
        <ul> \
        <li>Enter string values as is, no quotes: <code>OH</code></li> \
        <li>Valid number: <code>42</code></li> \
        <li>Valid date: <code>2015/02/14</code> (or <code>14 Feb 2015</code>, <code>Feb 14, 2015</code>, <code>February 14th, 2015</code>, <code>2015-02-14</code>)</li> \
        <li>Do not use mm/dd/yyyy or dd/mm/yyyy. \
        </li></ul></li></ul>";
        }
        else if ('RANGE' == axis.type.name)
        {
            insTitle[0].textContent = 'Instructions - Range Column';
            inst[0].innerHTML = "A <i>Range</i> column contains a <i>low</i> and <i>high</i> value.  It matches when \
            <i>value</i> is within the range: value >= <i>low</i> and value < <i>high</i>. Look ups are indexed \
            and run in <a href=\"http://en.wikipedia.org/wiki/Time_complexity\" target=\"_blank\">O(log n)</a>.\
        <ul><li>Enter low value, high value. Treated [inclusive, exclusive).</li> \
        <li>Examples: \
        <ul> \
        <li><i>Number range</i>: <code>25, 75</code> (meaning x >= 25 AND x < 75)</li> \
        <li><i>Number range</i>: <code>[100, 1000]</code> (brackets optional)</li> \
        <li><i>Date range</i>: <code>2015/01/01, 2017-01-01</code> (date >= 2015-01-01 AND date < 2017-01-01) \
        </li></ul></li></ul>";
        }
        else if ('SET' == axis.type.name)
        {
            insTitle[0].textContent = 'Instructions - Set Column';
            inst[0].innerHTML = "A <i>Set</i> column can contain unlimited discrete values and ranges. Discrete values \
            match with '=' and ranges match when value is within the range [inclusive, exclusive).  Overlapping\
            ranges and values are <b>not</b> allowed.  If you need that capability, use a <i>Rule</i> axis.\
            Look ups are indexed and run in <a href=\"http://en.wikipedia.org/wiki/Time_complexity\" target=\"_blank\">O(log n)</a>.\
        <ul><li>Examples: \
        <ul> \
        <li><i>Numbers</i>: <code>6, 10, [20, 30], 45</code></li> \
        <li><i>Strings</i>: <code>\"TX\", \"OH\", \"GA\"</code></li> \
        <li><i>Dates</i>: <code>\"2016-01-01\"</code></li> \
        <li><i>Date range</i>: <code>[\"2010/01/01\", \"2012/12/31\"]</code></li> \
        <li><i>Date ranges</i>: <code>[\"2015-01-01\", \"2016-12-31\"], [\"2019/01/01\", \"2020/12/31\"]</code> \
        </li></ul></li></ul>";
        }
        else if ('NEAREST' == axis.type.name)
        {
            insTitle[0].textContent = 'Instructions - Nearest Column';
            inst[0].innerHTML = "A <i>Nearest</i> column has a single value per column.  The <i>closest</i> column on the \
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
        <li>Do not use mm/dd/yyyy or dd/mm/yyyy for dates.</li></ul></li></ul>";
        }
        else if ('RULE' == axis.type.name)
        {
            insTitle[0].textContent = 'Instructions - Rule Column';
            inst[0].innerHTML = "A <i>Rule condition</i> column is entered as a rule name and condition.  All rule conditions \
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
        </ul></li></ul>";
        }
        else
        {
            insTitle[0].textContent = 'Instructions';
            inst[0].innerHTML = 'Unknown axis type';
        }

        var axisList = axis.columns;
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

                // For rules with URL to conditions, support URL: (or url:) in front of URL - then store as URL
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

                var prefix = '';
                if (item.isUrl)
                {
                    prefix += 'url|';
                }
                if (item.isCached)
                {
                    prefix += 'cache|';
                }

                inputText.val(prefix + item.value);
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
    };

    // ============================================== Column functions =================================================
    var addColumnEditListeners = function()
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
    };

    var editColumns = function(axisName)
    {
        if (!nce.ensureModifiable('Columns cannot be edited.'))
        {
            return false;
        }

        var result = nce.call("ncubeController.getAxis", [nce.getSelectedTabAppId(), nce.getSelectedCubeName(), axisName]);
        var axis;
        if (result.status === true)
        {
            axis = result.data;
            if (!axis.columns)
            {
                axis.columns = [];
            }
            if (axis.defaultCol)
            {   // Remove actual Default Column object (not needed, we can infer it from Axis.defaultCol field being not null)
                axis.columns.splice(axis.columns.length - 1, 1);
            }
        }
        else
        {
            nce.showNote("Could not retrieve axes for n-cube '" + nce.getSelectedCubeName() + "':<hr class=\"hr-small\"/>" + result.data);
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
        $('#editColumnsLabel')[0].innerHTML = 'Edit ' + axisName;
        $('#editColumnsModal').modal();
    };

    var sortColumns = function(axis)
    {
        if (axis.preferredOrder == 1)
        {
            axis.columns.sort(function(a, b)
            {
                return a.displayOrder - b.displayOrder;
            });
        }
    };

    var getUniqueId = function()
    {
        return _colIds--;
    };

    var editColAdd = function()
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
            axis.columns.push(newCol);
            loc = input.length - 1;
        }
        else
        {
            axis.columns.splice(loc + 1, 0, newCol);
        }
        loadColumns(axis);

        // Select newly added column name, so user can just type over it.
        input = _columnList.find('.form-control');
        input[loc + 1].select();
    };

    var editColDelete = function()
    {
        var axis = _columnList.prop('model');
        var input = $('.editColCheckBox');
        var cols = axis.columns;
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
    };

    var editColUp = function()
    {
        var axis = _columnList.prop('model');
        var cols = axis.columns;
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
    };

    var editColDown = function()
    {
        var axis = _columnList.prop('model');
        var cols = axis.columns;
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
    };

    var editColCancel = function()
    {
        $('#editColumnsModal').modal('hide');
    };

    var editColSave = function()
    {
        var axis = _columnList.prop('model');
        _columnList.find('input[data-type=cond]').each(function(index, elem)
        {
            axis.columns[index].value = elem.value;
        });
        _columnList.find('input[data-type=name]').each(function(index, elem)
        {
            var col = axis.columns[index];
            if (col.metaProp)
            {
                col.metaProp.name = elem.value;
            }
        });
        axis.defaultCol = null;
        var result = nce.call("ncubeController.updateAxisColumns", [nce.getSelectedTabAppId(), nce.getSelectedCubeName(), axis.name, axis.columns]);

        if (result.status !== true)
        {
            nce.showNote("Unable to update columns for axis '" + axis.name + "':<hr class=\"hr-small\"/>" + result.data);
            return;
        }
        $('#editColumnsModal').modal('hide');
        nce.reloadCube();
    };

    // =============================================== End Column Editing ==============================================

    // ==================================== Everything to do with Cell Editing =========================================

    var addEditCellListeners = function()
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
    };

    var editCell = function()
    {
        if (!nce.ensureModifiable('Cell cannot be updated.'))
        {
            return;
        }

        var result = nce.call("ncubeController.getCellNoExecute", [nce.getSelectedTabAppId(), nce.getSelectedCubeName(), _cellId]);

        if (result.status === false)
        {
            nce.showNote('Unable to fetch the cell contents: ' + result.data);
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

        // Set the Cache check box state
        _editCellCache.find('input').prop('checked', cellInfo.isCached);

        //_editCellModal.modal('show');
        _editCellModal.modal('show');
    };

    var editCellClear = function()
    {
        _editCellModal.modal('hide');
        var result = nce.call("ncubeController.updateCell", [nce.getSelectedTabAppId(), nce.getSelectedCubeName(), _cellId, null]);

        if (result.status === false)
        {
            _cellId = null;
            nce.showNote('Unable to clear cell:<hr class="hr-small"/>' + result.data);
            return;
        }

        _uiCellId[0].textContent = '';
        _uiCellId.attr({'class':'cell'});
        _cellId = null;
    };

    var editCellCancel = function()
    {
        _cellId = null;
        _editCellModal.modal('hide');
    };

    var editCellOK = function()
    {
        var cellInfo = {'@type':'com.cedarsoftware.ncube.CellInfo'};
        cellInfo.isUrl = _editCellRadioURL.find('input').prop('checked');
        cellInfo.value = _editCellValue.val();
        cellInfo.dataType = cellInfo.isUrl ? _urlDropdown.val() : _valueDropdown.val();
        cellInfo.isCached = _editCellCache.find('input').prop('checked');
        _editCellModal.modal('hide');

        var result = nce.call("ncubeController.updateCell", [nce.getSelectedTabAppId(), nce.getSelectedCubeName(), _cellId, cellInfo]);

        if (result.status === false)
        {
            _cellId = null;
            nce.showNote('Unable to update cell:<hr class="hr-small"/>' + result.data);
            return;
        }

        _uiCellId[0].textContent = cellInfo.value;
        if (cellInfo.isUrl)
        {
            _uiCellId.attr({'class':'cell cell-url'});
        }
        else if (cellInfo.dataType == "exp" || cellInfo.dataType == "method")
        {
            _uiCellId.attr({'class':'cell cell-code'});
        }
        else
        {
            _uiCellId.attr({'class':'cell'});
        }
        _cellId = null;

        nce.reloadCube();
    };

    var enabledDisableCheckBoxes = function()
    {
        var isUrl = _editCellRadioURL.find('input').is(':checked');
        var selDataType = isUrl ? _urlDropdown.val() : _valueDropdown.val();
        var urlEnabled = selDataType == 'string' || selDataType == 'binary' || selDataType == 'exp' || selDataType == 'method' || selDataType == 'template';
        var cacheEnabled = selDataType == 'string' || selDataType == 'binary' || selDataType == 'exp' || selDataType == 'method' || selDataType == 'template';

        // Enable / Disable [x] URL
        _editCellRadioURL.find('input').prop("disabled", !urlEnabled);

        if (urlEnabled)
        {
            _editCellRadioURL.removeClass('disabled');
        }
        else
        {
            _editCellRadioURL.addClass('disabled');
        }

        // Enable / Disable [x] Cache
        _editCellCache.find('input').prop("disabled", !cacheEnabled);

        if (cacheEnabled)
        {
            _editCellCache.removeClass('disabled');
        }
        else
        {
            _editCellCache.addClass('disabled');
        }
    };

    var getCellId = function(cell)
    {
        var cellId = cell.attr('data-id');
        if (cellId)
        {
            return cellId.split("_");
        }
        return null;
    };

    var getDomCellId = function(cell)
    {
        var cellId = cell.getAttribute('data-id');
        if (cellId)
        {
            return cellId.split("_");
        }
        return null;
    };

    var excelCopy = function()
    {
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
                if (lastRow != -1)
                {
                    clipData += '\n';
                }
                lastRow = cellRow;
            }
            var content = cell[0].textContent;

            if (content.indexOf('\n') > -1)
            {   // Must quote if newline (and double any quotes inside)
                clipData = clipData + '"' + content.replace(/"/g, '""') + '"';
            }
            else
            {
                clipData = clipData + content;
            }
        });
        clipData += '\n';
        _clipboard.val(clipData);
        _clipboard.focusin();
        _clipboard.select();
    };

    var editCutCopy = function(isCut)
    {
        if (isCut && !nce.ensureModifiable('Cannot cut / copy cells.'))
        {
            return;
        }

        var cells = [];
        var lastRow = -1;

        $('td.cell-selected').each(function ()
        {   // Visit selected cells in spreadsheet
            var cell = $(this);
            var cellRow = getRow(cell);
            if (lastRow != cellRow)
            {
                if (lastRow != -1)
                {
                    cells.push(null);   // Mark end of line
                }
                lastRow = cellRow;
            }
            var cellId = getCellId(cell);
            if (cellId)
            {
                cells.push(cellId);
                if (isCut)
                {
                    cell[0].textContent = '';
                }
            }
        });

        // Get clipboard ready string + optionally clear cells from database
        var result = nce.call("ncubeController.copyCells", [nce.getSelectedTabAppId(), nce.getSelectedCubeName(), cells, isCut]);
        if (!result.status)
        {
            nce.showNote('Error copying/cutting cells:<hr class="hr-small"/>' + result.data);
        }

        var clipData = result.data;
        _clipboard.val(CLIP_NCE + clipData);
        _clipboard.focusin();
        _clipboard.select();
    };

    var editPaste = function()
    {
        _clipboard.val('');
        _clipboard.focus();

        if (!nce.ensureModifiable('Cannot paste cells.'))
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

        setTimeout(function() {
            var content = _clipboard.val();
            if (!content || content == "")
            {
                return;
            }

            // Parse the clipboard content and build-up coordinates where this content will be pasted.
            var values = [];
            var firstRow = row;
            var numTH, colIdx, domCell, result, r, c = null;

            if (content.indexOf(CLIP_NCE) == 0)
            {   // NCE clipboard data (allows us to handle all cell types)
                content = content.slice(CLIP_NCE.length);
                var clipboard = JSON.parse(content);
                var colNum = 0;

                if (onlyOneCellSelected)
                {   // Paste full clipboard data to cube (if it fits, otherwise clip to edges)
                    for (var line=0; line < clipboard.length; line++)
                    {
                        var cellInfo = clipboard[line];
                        if (cellInfo == null)
                        {
                            row++;
                            colNum = 0;
                        }
                        else
                        {
                            numTH = countTH(tableRows[row].cells);
                            colIdx = col + colNum + numTH;
                            if (colIdx < tableRows[row].cells.length)
                            {   // Do attempt to read past edge of 2D grid
                                domCell = tableRows[row].cells[colIdx]; // This is a DOM "TD" element
                                cellInfo.push(getDomCellId(domCell));
                            }
                            colNum++;
                        }
                        if (row >= tableRows.length)
                        {   // Do not go past bottom of grid
                            break;
                        }
                    }
                }
                else
                {   // Repeat / Clip case: multiple cells are selected when PASTE invoked, clip pasting to selected
                    // range. This is the 'fill-mode' of paste (repeating clipboard data to fill selected rectangle)
                    var clipRect = [[]];  // 2D array
                    var clipCol = 0;
                    var clipRow = 0;

                    // Refashion linear clipboard (with nulls as column boundaries) to 2D
                    for (var k=0; k < clipboard.length; k++)
                    {
                        if (clipboard[k])
                        {
                            clipRect[clipRow][clipCol] = clipboard[k];
                            clipCol++;
                        }
                        else
                        {
                            clipCol = 0;
                            clipRow++;
                            clipRect[clipRow] = [];
                        }
                    }
                    clipRow++;  // count of rows (not 0 based), e.g. 4 for rows 0-3 (needed for modulo below)

                    row = firstRow;
                    var clipboard2 = [];

                    for (r = firstRow; r <= lastRow; r++)
                    {
                        for (c = col; c <= lastCol; c++)
                        {
                            numTH = countTH(tableRows[row].cells);
                            domCell = tableRows[row].cells[c + numTH]; // This is a DOM "TD" element
                            var info = clipRect[(r - firstRow) % clipRow][(c - col) % clipCol];
                            var cloneCellInfo = info.slice(0);
                            cloneCellInfo.push(getDomCellId(domCell));
                            clipboard2.push(cloneCellInfo);
                        }
                        row++;
                    }
                    clipboard = clipboard2;
                }
                // Paste cells from database
                result = nce.call("ncubeController.pasteCellsNce", [nce.getSelectedTabAppId(), nce.getSelectedCubeName(), clipboard]);
            }
            else
            {   // Normal clipboard data, from Excel, for example
                var lines = parseExcelClipboard(content);
                var coords = [];
                var rowCoords = [];

                // If more than one cell is selected, create coords for all selected cells.
                // Server will repeat values, properly throughout the selected 'clip' region.
                for (var i = 0; i < lines.length; i++)
                {
                    rowCoords = [];
                    values.push(lines[i]);  // push a whole line of values at once.

                    for (var j=0; j < lines[i].length; j++)
                    {
                        numTH = countTH(tableRows[row].cells);
                        colIdx = col + j + numTH;
                        if (colIdx < tableRows[row].cells.length)
                        {   // Do attempt to read past edge of 2D grid
                            domCell = tableRows[row].cells[colIdx]; // This is a DOM "TD" element
                            rowCoords.push(getDomCellId(domCell));
                        }
                    }
                    coords.push(rowCoords);
                    row++;

                    if (row >= tableRows.length)
                    {   // Do not go past bottom of grid
                        break;
                    }
                }

                if (!onlyOneCellSelected)
                {   // Multiple cells are selected when PASTE invoked, clip pasting to selected range.
                    coords = [];
                    row = firstRow;
                    for (r = firstRow; r <= lastRow; r++)
                    {
                        rowCoords = [];
                        for (c = col; c <= lastCol; c++)
                        {
                            numTH = countTH(tableRows[row].cells);
                            domCell = tableRows[row].cells[c + numTH]; // This is a DOM "TD" element
                            rowCoords.push(getDomCellId(domCell));
                        }
                        coords.push(rowCoords);
                        row++;
                    }
                }

                // Paste cells from database
                result = nce.call("ncubeController.pasteCells", [nce.getSelectedTabAppId(), nce.getSelectedCubeName(), values, coords]);
            }

            if (result.status)
            {
                nce.reloadCube();
            }
            else
            {
                nce.clearNote();
                nce.showNote('Error pasting cells:<hr class="hr-small"/>' + result.data);
            }
        }, 100);
    };

    // =============================================== End Cell Editing ================================================

    var handleCubeSelected = function()
    {
        load();
    };

    // Let parent (main frame) know that the child window has loaded.
    // The loading of all of the Javascript (deeply) is continuous on the main thread.
    // Therefore, the setTimeout(, 1) ensures that the main window (parent frame)
    // is called after all Javascript has been loaded.
    if (window.parent.frameLoaded) {
        setTimeout(function () {
            window.parent.frameLoaded(document);
        }, 1);
    }

    // API
    return {
        init: init,
        handleCubeSelected: handleCubeSelected,
        load: load
    };

})(jQuery);

var tabActivated = function tabActivated(info)
{
    NCubeEditor.init(info);
    NCubeEditor.load();
};

var cubeSelected = function cubeSelected()
{
    NCubeEditor.handleCubeSelected();
};

function onNoteEvent(e, element){};

function closeChildMenu() {
    $('.open').removeClass('open');
    $('div.dropdown-backdrop').hide();
}