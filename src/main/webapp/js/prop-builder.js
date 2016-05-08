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
        _data = data;
        _options = options;
        var container = buildModalContainer();
        container.append(buildModalHeader());
        container.append(buildModalContent());
        container.append(buildModalFooter());

        container.find('input,textarea,select').attr('disabled', _options.readonly);

        _modal.modal();
    }

    function buildModalContainer() {
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

        var innerDiv = $('<div/>').addClass('modal-dialog modal-lg');
        var contentDiv = $('<div/>').addClass('modal-content');

        innerDiv.append(contentDiv);
        _modal.append(innerDiv);
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
        var body = $('<div/>')
            .addClass('modal-body')
            .css({'overflow-y':'auto', height:'500px'});

        if (_options.hasOwnProperty('instructionsTitle') && _options.hasOwnProperty('instructionsText')) {
            var panelGroup = $('<div/>').addClass('panel-group');
            var panel = $('<div/>').addClass('panel panel-default');
            var panelHeading = $('<div/>').addClass('panel-heading');
            var panelTitle = $('<h4/>').addClass('panel-title').html(_options.instructionsTitle);
            var panelCollapse = $('<div/>').addClass('panel-collapse collapse in');
            var instructionsText = $('<div/>')
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
        _table = $('<table/>').css({margin: '0 auto'});

        var columns = _options.columns;
        var columnKeys = Object.keys(columns);
        _options.columnKeys = columnKeys;
        var headingRow = $('<tr/>');
        for (var c = 0, cLen = columnKeys.length; c < cLen; c++) {
            var column = columns[columnKeys[c]];
            headingRow.append($('<td/>').html(column.heading).css(TD_CSS));
        }
        _table.append(headingRow);

        if (_data.length === 0) {
            addTableRow(); //start with empty row
        } else {
            for (var d = 0, dLen = _data.length; d < dLen; d++) {
                addTableRow(_data[d]);
            }
        }

        return _table;
    }

    function addTableRow(dataRow) {
        var tr = $('<tr/>').addClass(TR_CLASS);
        var columnKeys = _options.columnKeys;
        var columns = _options.columns;
        for (var c = 0, cLen = columnKeys.length; c < cLen; c++) {
            var key = columnKeys[c];
            var column = columns[key];
            var dataVal = null;
            var inputElement = null;
            if (dataRow) {
                dataVal = dataRow[key];
            } else if (column.hasOwnProperty('default')) {
                dataVal = column.default;
            }

            var type = column.type;
            if (type === COLUMN_TYPES.CHECKBOX) {
                inputElement = $('<input/>').prop({type:'checkbox', checked:dataVal});
            } else if (type === COLUMN_TYPES.READONLY) {
                inputElement = $('<span/>').html(dataVal);
            } else if (type === COLUMN_TYPES.SELECT) {
                inputElement = $('<select/>');
                var selectOptions = column.selectOptions;
                for (var o = 0, oLen = selectOptions.length; o < oLen; o++) {
                    var optEl = $('<option/>');
                    var curOption = selectOptions[o];

                    if (typeof curOption === 'object') {
                        optEl.val(curOption.key);
                        optEl.text(curOption.value);
                    } else {
                        optEl.text(selectOptions[o]);
                    }

                    inputElement.append(optEl);
                }
                inputElement.val(dataVal);
            } else if (type === COLUMN_TYPES.TEXT) {
                inputElement = $('<input/>').prop('type','text').val(dataVal);
            }

            inputElement.addClass(key);
            tr.append($('<td/>').append(inputElement).css(TD_CSS));
        }

        var closeBtn = $('<span/>').addClass('glyphicon glyphicon-remove tab-close-icon');
        closeBtn.click(function() {
            tr.remove();
        });
        tr.append($('<td/>').append(closeBtn));

        _table.append(tr);
        tr.find('input').first().focus();
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
        _data.splice(0, _data.length);
        var trs = findTableRows();
        var columnKeys = _options.columnKeys;
        var columns = _options.columns;
        for (var trIdx = 0, trLen = trs.length; trIdx < trLen; trIdx++) {
            var dataRow = {};
            var tr = $(trs[trIdx]);
            for (var c = 0, cLen = columnKeys.length; c < cLen; c++) {
                var key = columnKeys[c];
                var column = columns[key];
                var type = column.type;
                var inputElement = tr.find('.' + key);
                var dataVal = null;

                if (type === COLUMN_TYPES.CHECKBOX) {
                    dataVal = inputElement.prop('checked');
                } else if (type === COLUMN_TYPES.READONLY) {
                    dataVal = inputElement[0].innerHTML;
                } else if (type === COLUMN_TYPES.SELECT || type === COLUMN_TYPES.TEXT) {
                    dataVal = inputElement.val();
                }

                dataRow[key] = dataVal;
            }
            _data.push(dataRow);
        }
    }

    return {
        openBuilderModal: openBuilderModal,
        COLUMN_TYPES: COLUMN_TYPES
    };

})(jQuery);