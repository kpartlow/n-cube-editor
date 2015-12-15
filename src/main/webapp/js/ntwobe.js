var NCubeEditor2 = (function ($)
{
    var headerAxisNames = ['trait','traits','businessDivisionCode','bu','month','months','col','column','cols','columns'];
    var nce = null;
    var hot = null;
    var cols = null;
    var rowNums = null;
    var data = null;
    var cubeName = null;
    var axes = null;
    var mergedCellInfo = null;

    var init = function(info) {
        if (!nce) {
            nce = info;

            $(window).resize(function () {
                NCubeEditor2.render();
            });

        }
    };

    var load = function() {
        if (hot) {
            hot.destroy();
            hot = null;
        }

        if (!nce.getCubeMap() || !nce.doesCubeExist()) {
            $('#ncube-content')[0].innerHTML = '';
            return;
        }

        var info = nce.getCubeMap()[(nce.getSelectedCubeName() + '').toLowerCase()];
        if (!info) {
            $('#ncube-content')[0].innerHTML = '';
            return;
        }

        var result = nce.call("ncubeController.getJson", [nce.getAppId(), nce.getSelectedCubeName()], {noResolveRefs:true});
        if (result.status === false) {
            return;
        }

        handleCubeData(JSON.parse(result.data));

        hot = new Handsontable(document.getElementById('hot-container'), getHotSettings());
        hot.render();
    };

    var handleCubeData = function(cubeData) {

        var determineAxesOrder = function(axes) {
            var horizontal;
            axes.sort(function(a, b) {
                return b.columns.length - a.columns.length;
            });

            var delta;
            var smallestDelta = Number.MAX_VALUE;
            for (var i = 0; i < axes.length; i++) {
                var axis = axes[i];
                if (headerAxisNames.indexOf(axis.name) > -1) {
                    horizontal = i;
                    break;
                }
                delta = Math.abs(axis.columns.length - 12);
                if (delta < smallestDelta) {
                    smallestDelta = delta;
                    horizontal = i;
                }
            }

            horizontal = axes.splice(horizontal, 1);
            axes.push(horizontal[0]);
            return axes;
        };

        var setUpDataTable = function() {
            cubeName = cubeData.ncube;
            data = [];
            rowNums = ['',''];
            cols = [''];
            mergedCellInfo = [];

            data[0] = [cubeName];
            var totalRows = 1;
            var rowOffset = 2;
            var numAxes = axes.length;

            if (numAxes > 1) {
                var horizAxis = axes[numAxes - 1];

                if (numAxes > 2) {
                    for (var i = 0; i < numAxes - 2; i++) {
                        data[0].push('');
                        cols.push('');
                    }
                }
                data[0].push(horizAxis.name);
                var columns = horizAxis.columns;
                for (var columnIndex = 0; columnIndex < columns.length; columnIndex++) {
                    var col = columns[columnIndex];
                    cols.push({coords: [col.id], value: col.value});
                    data[0].push('');
                }
                if (horizAxis.hasDefault) {
                    cols.push({coords: [horizAxis.name + '_default'], value: 'Default'});
                } else {
                    data[0].splice(data[0].length - 1);
                }

                for (var axisNum = 0; axisNum < numAxes - 1; axisNum++) {
                    var axis = axes[axisNum];
                    var numCols = axis.columns.length;
                    if (axis.hasDefault) {
                        numCols++;
                    }
                    totalRows *= numCols;
                }

                data[1] = JSON.parse(JSON.stringify(cols));
                var newBlankRow = [];
                for (var col = 0; col < cols.length; col++) {
                    newBlankRow.push({coords: [], value: ''});
                }

                for (var rowNum = 1; rowNum <= totalRows; rowNum++) {
                    rowNums.push(rowNum.toString());
                    data.push(JSON.parse(JSON.stringify(newBlankRow)));
                }

                var remainingAxesColumnCount = totalRows;
                for (var axisNum = 0; axisNum < numAxes - 1; axisNum++) {
                    var axis = axes[axisNum];
                    data[1][axisNum] = axis.name;
                    var axisColAmt = axis.columns.length;
                    if (axis.hasDefault) {
                        axisColAmt++;
                    }
                    var curColNum = -1;
                    remainingAxesColumnCount = remainingAxesColumnCount / axisColAmt;
                    var currentMergeStart = rowOffset;
                    var currentMergeSpan = 1;

                    for (var rowNum = 0; rowNum < totalRows; rowNum++) {
                        var cell = {coords: [], value: ''};

                        var isNewColumnIteration = rowNum % remainingAxesColumnCount === 0;
                        if (isNewColumnIteration) {
                            curColNum++;
                            if (currentMergeSpan > 1) {
                                mergedCellInfo.push({
                                    row: currentMergeStart,
                                    col: axisNum,
                                    rowspan: currentMergeSpan,
                                    colspan: 1
                                });
                                currentMergeSpan = 1;
                                currentMergeStart = rowNum + rowOffset;
                            }

                            if (curColNum >= axisColAmt) {
                                curColNum = 0;
                            }
                        } else {
                            currentMergeSpan++;
                        }

                        if (axisNum > 0) {
                            cell.coords = JSON.parse(JSON.stringify(data[rowNum + rowOffset][axisNum - 1].coords));
                        }
                        if (curColNum < axis.columns.length) {
                            var curCol = axis.columns[curColNum];
                            cell.coords.push(curCol.id);
                            if (isNewColumnIteration) {
                                cell.value = curCol.value;
                            }
                        } else {
                            cell.coords.push(axis.name + '_default');
                            cell.value = 'Default';
                        }
                        data[rowNum + rowOffset][axisNum] = cell;
                    }
                    if (currentMergeSpan > 1) {
                        mergedCellInfo.push({
                            row: currentMergeStart,
                            col: axisNum,
                            rowspan: currentMergeSpan,
                            colspan: 1
                        });
                    }
                }

                for (var y = 2; y < data.length; y++) {
                    var rowCoords = data[y][numAxes - 2].coords;
                    for (var x = numAxes - 1, len = data[0].length; x < len; x++) {
                        var newCoords = JSON.parse(JSON.stringify(rowCoords));
                        var colCoords = data[1][x].coords;
                        newCoords.push(colCoords[0]);
                        data[y][x].coords = newCoords;
                    }
                }
            } else {
                data[0].push('');
                var axis = axes[0];
                var columns = axis.columns;
                data[1] = [axis.name, ''];

                for (var columnNum = 0; columnNum < columns.length; columnNum++) {
                    var dataRowNum = columnNum + rowOffset;
                    var column = columns[columnNum];
                    rowNums.push(dataRowNum.toString());
                    data[dataRowNum] = [{coords:[column.id], value:column.value},{coords:[column.id], value:''}];
                }
                if (axis.hasDefault) {
                    var defaultId = axis.name + '_default';
                    data.push([{coords:[defaultId], value:'Default'},{coords:[defaultId], value:''}]);
                }
            }
        };

        var handleCellData = function(cells) {
            var findDataCellFromCoords = function(coords) {
                if (axes.length > 1) {
                    var findColumnFromCoords = function () {
                        var headerRow = data[1];
                        for (var x = axes.length - 1; x < headerRow.length; x++) {
                            var colCoord = headerRow[x].coords[0];
                            if (coords.indexOf(colCoord) > -1 || colCoord.toString().indexOf('_default') > -1) {
                                return x;
                            }
                        }
                    };

                    var findRowFromCoords = function () {
                        var headerColNum = axes.length - 2;
                        for (var y = 2; y < data.length; y++) {
                            var rowCoords = data[y][headerColNum].coords;
                            var found = true;
                            for (var i = 0; i < rowCoords.length; i++) {
                                var rowCoord = rowCoords[i];
                                if (coords.indexOf(rowCoord) < 0 && rowCoord.toString().indexOf('_default') < 0) {
                                    found = false;
                                    break;
                                }
                            }
                            if (found) {
                                return y;
                            }
                        }
                    };

                    var columnNum = findColumnFromCoords();
                    var rowNum = findRowFromCoords();
                    return data[rowNum][columnNum];
                } else {
                    for (var rowNum = 2; rowNum < data.length; rowNum++) {
                        var coord = data[rowNum][1].coords[0];
                        if (coords.indexOf(coord) > -1 || coord.toString().indexOf('_default') > -1) {
                            return data[rowNum][1];
                        }
                    }
                }
            };

            for (var i = 0; i < cells.length; i++) {
                var cell = cells[i];
                var dataCell = findDataCellFromCoords(cell.id);
                dataCell.value = cell.value;
            }
        };

        axes = determineAxesOrder(cubeData.axes);
        setUpDataTable();
        handleCellData(cubeData.cells);
    };

    var getHotSettings = function() {
        return {
            data: data,
            autoColumnSize: true,
            enterBeginsEditing: false,
            enterMoves: {row: 1, col: 0},
            tabMoves : {row: 0, col: 1},
            rowHeaders: rowNums,
            startCols: cols.length,
            startRows: rowNums.length,
            contextMenu: false,
            manualColumnResize: true,
            manualRowResize: true,
            fixedColumnsLeft: axes.length - 1,
            fixedRowsTop: 2,
            currentRowClassName: 'handsonCurrentRow',
            currentColClassName: 'handsonCurrentCol',
            outsideClickDeselects: false,
            mergeCells: mergedCellInfo,
            autoColumnSize: true,
            cells: function (row, col, prop) {
                return {renderer:categoryRenderer};
            }
            ,
            afterSelectionEnd: function(r, c, r2, c2) {
                console.log(hot.getDataAtCell(r, c));
            }
        };
    };

    var categoryRenderer = function(instance, td, row, col, prop, value, cellProperties) {
        Handsontable.renderers.TextRenderer.apply(this, arguments);

        // cube name
        if (row === 0 && (col < axes.length - 1 || col === 0)) {
            td.style.background = '#6495ED';
            td.style.color = 'white';
            td.style.opacity = '1';
            cellProperties.readOnly = true;
            if (col < axes.length - 2) {
                td.style.borderRight = 'none';
            }
        }

        // horizontal axis metadata area
        else if (row === 0 || (row === 1 && (col < axes.length - 1 || col === 0))) {
            td.style.background = '#4D4D4D';
            td.style.color = 'white';
            td.style.opacity = '1';
            cellProperties.readOnly = true;

            // rest of the top row
            if (row === 0 && col > 0) {
                td.style.borderRight = 'none';
            }
        }

        // axis headers
        else if (row === 1 || col < axes.length - 1) {
            td.style.background = '#929292';
            td.style.color = 'white';
            if (col < axes.length - 1) {
                td.className = "htMiddle";
            }
        }

        // otherwise odd rows
        else if (row % 2 != 0) {
            td.style.background = '#e0e0e0';
        }

        // to maintain meta data, cell data is passed as an object, with the displayable data stored as value
        if (typeof value === 'object') {
            td.innerHTML = value.value;
        }
    };

    // =============================================== End Cell Editing ================================================

    var render = function()
    {
        if (!hot)
        {
            return;
        }
        hot.render();
    };

    var handleCubeSelected = function()
    {
        load();
    };

    // Let parent (main frame) know that the child window has loaded.
    // The loading of all of the Javascript (deeply) is continuous on the main thread.
    // Therefore, the setTimeout(, 1) ensures that the main window (parent frame)
    // is called after all Javascript has been loaded.
    setTimeout(function() { window.parent.frameLoaded(); }, 1);

    // API
    return {
        init: init,
        handleCubeSelected: handleCubeSelected,
        load: load,
        render: render
    };

})(jQuery);

var tabActivated = function tabActivated(info)
{
    NCubeEditor2.init(info);
    NCubeEditor2.load();
};

var cubeSelected = function cubeSelected()
{
    NCubeEditor2.handleCubeSelected();
};