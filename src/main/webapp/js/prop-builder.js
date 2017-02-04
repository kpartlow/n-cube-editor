/**
 * Created by tpollack on 3/17/2016.
 *
 * options:
 *      title               - title of modal dialog
 *      instructionsTitle   - title of instructions area (omit for no instructions box)
 *      instructionsText    - text of instructions area (omit for no instructions box)
 *      afterSave           - callback fires upon clicking save button
 *      readonly            - should the user be able to edit or only view
 *      columns             - columns to show on modal
 *          heading         - heading for column
 *          type            - type of input for column, use constant COLUMN_TYPES
 *          default         - used if column has a default value (such as true for checkbox) for new rows
 *          selectOptions   - if type is SELECT, use for list of options for select input
 */

var PropertyBuilder = (function ($) {

    // constants
    var COLUMN_TYPES = {
        CHECKBOX: 'checkbox',
        READONLY: 'readonly',
        SELECT: 'select',
        TEXT: 'text'
    };
    //noinspection MagicNumberJS
    var TD_CSS = {
        'padding-right': 25,
        'text-align':'center'
    };
    var TR_CLASS = 'builder-data-row';

    // elements;
    var _btnAdd = null;
    var _btnCancel = null;
    var _btnClear = null;
    var _btnSave = null;
    var _modal = null;
    var _table = null;

    // external variables
    var _data = null;
    var _options = null;

    // public
    function openBuilderModal(options, data) {
        var container;
        _data = data;
        _options = options;
        container = buildModalContainer();
        container.append(buildModalHeader());
        container.append(buildModalContent());
        container.append(buildModalFooter());

        container.find('input,textarea,select').attr('disabled', _options.readonly);

        _modal.modal();
    }

    function buildModalContainer() {
        var innerDiv, contentDiv;
        _modal = $('<div/>')
            .prop('tabindex','-1')
            .data({
                role: 'dialog',
                backdrop: 'static'
            })
            .addClass('modal fade')
            .on('hidden', function() {
                $(this).remove();
            })
            .keyup(function(e) {
                if (e.keyCode === KEY_CODES.ENTER) {
                    addTableRow();
                }
            });
        makeModalDraggable(_modal, true);

        innerDiv = $('<div/>').addClass('modal-dialog modal-lg');
        contentDiv = $('<div/>').addClass('modal-content');

        _modal.append(innerDiv);
        innerDiv.append(contentDiv);
        return contentDiv;
    }

    function buildModalHeader() {
        var header = $('<div/>').addClass('modal-header');
        var closeButton = $('<button/>')
            .addClass('close')
            .html('&times;')
            .click(function() {
                closeBuilderModal(false);
            });
        var title = $('<h3/>')
            .addClass('modal-title')
            .html(_options.title);

        header.append(closeButton);
        header.append(title);
        return header;
    }

    function buildModalContent() {
        var panelGroup, panel, panelHeading, panelTitle, panelCollapse, instructionsText;
        var body = $('<div/>')
            .addClass('modal-body')
            .css({'overflow-y':'auto', height:'500px'});

        if (_options.hasOwnProperty('instructionsTitle') && _options.hasOwnProperty('instructionsText')) {
            panelGroup = $('<div/>').addClass('panel-group');
            panel = $('<div/>').addClass('panel panel-default');
            panelHeading = $('<div/>').addClass('panel-heading');
            panelTitle = $('<h4/>').addClass('panel-title').html(_options.instructionsTitle);
            panelCollapse = $('<div/>').addClass('panel-collapse collapse in');
            instructionsText = $('<div/>')
                .addClass('panel-body')
                .html(_options.instructionsText);

            body.append(panelGroup);
            panelGroup.append(panel);
            panel.append(panelHeading);
            panel.append(panelCollapse);
            panelHeading.append(panelTitle);
            panelCollapse.append(instructionsText);
        }

        body.append(buildTable());
        return body;
    }

    function buildTable() {
        var columns, columnKeys, headingRow, c, cLen, column;
        _table = $('<table/>').css({margin: '0 auto'});

        columns = _options.columns;
        columnKeys = Object.keys(columns);
        _options.columnKeys = columnKeys;
        headingRow = $('<tr/>');
        _table.append(headingRow);
        for (c = 0, cLen = columnKeys.length; c < cLen; c++) {
            column = columns[columnKeys[c]];
            headingRow.append($('<td/>').html(column.heading).css(TD_CSS));
        }
        addTableRows();
        return _table;
    }

    function addTableRows() {
        var d, dLen;
        dLen = _data.length;
        if (dLen) {
            for (d = 0; d < dLen; d++) {
                addTableRow(_data[d]);
            }
        } else {
            addTableRow(); //start with empty row
        }
    }

    function addTableRow(dataRow) {
        var c, cLen, key, column, dataVal, inputElement, closeBtn;
        var tr = $('<tr/>').addClass(TR_CLASS);
        var columnKeys = _options.columnKeys;
        var columns = _options.columns;
        for (c = 0, cLen = columnKeys.length; c < cLen; c++) {
            key = columnKeys[c];
            column = null;
            column = columns[key];
            if (dataRow) {
                dataVal = dataRow[key];
            } else if (column.hasOwnProperty('default')) {
                dataVal = column.default;
            } else {
                dataVal = null;
            }

            inputElement = null;
            inputElement = getDataRowInput(column, dataVal);
            inputElement.addClass(key);
            tr.append($('<td/>').append(inputElement).css(TD_CSS));
        }

        closeBtn = $('<span/>').addClass('glyphicon glyphicon-remove tab-close-icon');
        closeBtn.click(function() {
            tr.remove();
        });
        _table.append(tr);
        tr.append($('<td/>').append(closeBtn));
        tr.find('input').first().focus();
    }
    
    function getDataRowInput(column, dataVal) {
        var inputElement, selectOptions, o, oLen, optEl, curOption;
        switch (column.type) {
            case COLUMN_TYPES.CHECKBOX:
                inputElement = $('<input/>').prop({type:'checkbox', checked:dataVal});
                break;
            case COLUMN_TYPES.READONLY:
                inputElement = $('<span/>').html(dataVal);
                break;
            case COLUMN_TYPES.SELECT:
                inputElement = $('<select/>');
                selectOptions = column.selectOptions;
                for (o = 0, oLen = selectOptions.length; o < oLen; o++) {
                    optEl = $('<option/>');
                    curOption = selectOptions[o];
    
                    if (typeof curOption === 'object') {
                        optEl.val(curOption.key);
                        optEl.text(curOption.value);
                    } else {
                        optEl.text(selectOptions[o]);
                    }
    
                    inputElement.append(optEl);
                }
                inputElement.val(dataVal);
                break;
            case COLUMN_TYPES.TEXT:
                inputElement = $('<input/>').prop('type','text').val(dataVal);
                break;
        }
        return inputElement;
    }

    function clearTableRows() {
        findTableRows().remove();
    }

    function findTableRows() {
        return _table.find('tr.' + TR_CLASS);
    }

    function buildModalFooter() {
        var footer = $('<div/>').addClass('modal-footer');
        _btnAdd = $('<button/>')
            .addClass('btn btn-success btn-sm')
            .html('Add New')
            .click(function() {
                addTableRow();
            });

        _btnClear = $('<button/>')
            .addClass('btn btn-danger btn-sm')
            .html('Clear')
            .click(function() {
                clearTableRows();
            });

        _btnCancel = $('<button/>')
            .addClass('btn btn-default btn-sm')
            .html('Cancel')
            .click(function() {
                closeBuilderModal(false);
            });

        _btnSave = $('<button/>')
            .addClass('btn btn-primary btn-sm')
            .html('Save')
            .click(function() {
                closeBuilderModal(true);
            });

        if (_options.readonly) {
            footer.append(_btnCancel);
        } else {
            footer.append(_btnAdd);
            footer.append(_btnClear);
            footer.append(_btnCancel);
            footer.append(_btnSave);
        }
        return footer;
    }

    function closeBuilderModal(shouldSave) {
        if (shouldSave) {
            copyTableDataToModel();
            if (_options.hasOwnProperty('afterSave')) {
                _options.afterSave();
            }
        }
        _modal.modal('hide');
    }

    function copyTableDataToModel() {
        var trs, columnKeys, columns, trIdx, trLen, tr;
        _data.splice(0, _data.length);
        trs = findTableRows();
        columnKeys = _options.columnKeys;
        columns = _options.columns;
        for (trIdx = 0, trLen = trs.length; trIdx < trLen; trIdx++) {
            tr = null;
            tr = $(trs[trIdx]);
            _data.push(getDataRow(columns, columnKeys, tr));
        }
    }

    function getDataRow(columns, columnKeys, tr) {
        var c, cLen, key, inputElement, dataVal;
        var dataRow = {};
        for (c = 0, cLen = columnKeys.length; c < cLen; c++) {
            key = columnKeys[c];
            inputElement = null;
            inputElement = tr.find('.' + key);

            switch (columns[key].type) {
                case COLUMN_TYPES.CHECKBOX:
                    dataVal = inputElement[0].checked;
                    break;
                case COLUMN_TYPES.READONLY:
                    dataVal = inputElement[0].innerHTML;
                    break;
                case COLUMN_TYPES.SELECT:
                case COLUMN_TYPES.TEXT:
                    dataVal = inputElement.val();
                    break;
            }
            dataRow[key] = dataVal;
        }
        return dataRow;
    }

    return {
        openBuilderModal: openBuilderModal,
        COLUMN_TYPES: COLUMN_TYPES
    };

})(jQuery);