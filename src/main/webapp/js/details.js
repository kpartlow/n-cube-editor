/**
 * Details display / Default cube-level cell editor
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

var DetailEditor = (function ($)
{
    var nce = null;
    var _urlDropdown = null;
    var _valueDropdown = null;
    var _isUrl = null;
    var _isCached = null;
    var _defCellValue = null;

    var init = function(info)
    {
        if (!nce)
        {
            nce = info;

            _urlDropdown = $('#datatypes-url');
            _valueDropdown = $('#datatypes-value');
            _isUrl = $('#isURL');
            _isCached = $('#isCached');
            _defCellValue = $('#cube_defValue');

            _isUrl.change(function()
            {
                var isUrl = isUrlChecked();
                _urlDropdown.toggle(isUrl);
                _valueDropdown.toggle(!isUrl);
            });

            _urlDropdown.change(function()
            {
                enableDisableCheckboxes();
            });

            _valueDropdown.change(function()
            {
                enableDisableCheckboxes();
            });

            $('#defaultCellClear').click(function()
            {
                if (!nce.ensureModifiable('Default cell cannot be cleared.'))
                {
                    return;
                }

                var result = nce.call("ncubeController.clearDefaultCell", [nce.getAppId(), nce.getSelectedCubeName()]);
                if (result.status === true)
                {
                    $('#cube_defValue').val('');
                    _isUrl.find('input').attr('checked', false);
                    _isCached.find('input').attr('checked', false);
                    _urlDropdown.toggle(false);
                    _valueDropdown.toggle(true);
                    nce.showNote('Default cell cleared.', 'Note', 2000);
                }
                else
                {
                    nce.showNote('Unable to clear default cell:<hr class="hr-small"/>' + result.data);
                }
            });

            $('#defaultCellUpdate').click(function()
            {
                if (!nce.ensureModifiable('Default cell cannot be updated.'))
                {
                    return;
                }

                var cellInfo = {'@type':'com.cedarsoftware.ncube.CellInfo'};
                cellInfo.isUrl = _isUrl.find('input').is(':checked');
                cellInfo.value = _defCellValue.val();
                cellInfo.dataType = cellInfo.isUrl ? _urlDropdown.val() : _valueDropdown.val();
                cellInfo.isCached = _isCached.find('input').is(':checked');

                var result = nce.call("ncubeController.updateDefaultCell", [nce.getAppId(), nce.getSelectedCubeName(), cellInfo]);

                if (result.status === true)
                {
                    nce.showNote('Default cell updated successfully.', 'Note', 2000);
                }
                else
                {
                    nce.showNote('Unable to update default cell:<hr class="hr-small"/>' + result.data);
                }
            });
        }

        $(window).scroll(function() {
            clearTimeout($.data(this, 'scrollTimer'));
            $.data(this, 'scrollTimer', setTimeout(function() {
                var scrollTop = $(this).scrollTop();
                var scrollLeft = $(this).scrollLeft();
                nce.saveViewPosition({scrollTop:scrollTop, scrollLeft:scrollLeft});
            }, 250));
        });
    };

    var scrollToSavedPosition = function() {
        var pos = nce.getViewPosition();
        if (typeof pos === 'object') {
            $(window).scrollTop(pos.scrollTop);
            $(window).scrollLeft(pos.scrollLeft);
        }
    };

    var isUrlChecked = function()
    {
        return _isUrl.find('input').is(':checked');
    };

    var enableDisableCheckboxes = function()
    {
        var selDataType = isUrlChecked() ? _urlDropdown.val() : _valueDropdown.val();
        var urlEnabled = selDataType == 'string' || selDataType == 'binary' || selDataType == 'exp' || selDataType == 'method' || selDataType == 'template';
        var cacheEnabled = selDataType == 'string' || selDataType == 'binary' || selDataType == 'exp' || selDataType == 'method' || selDataType == 'template';

        // Enable / Disable [x] URL
        _isUrl.find('input').prop("disabled", !urlEnabled);

        if (urlEnabled)
        {
            _isUrl.removeClass('disabled');
        }
        else
        {
            _isUrl.addClass('disabled');
        }

        // Enable / Disable [x] Cache
        _isCached.find('input').prop("disabled", !cacheEnabled);

        if (cacheEnabled)
        {
            _isCached.removeClass('disabled');
        }
        else
        {
            _isCached.addClass('disabled');
        }
    };

    var load = function()
    {
        if (!nce.getCubeMap() || !nce.doesCubeExist())
        {
            clearFields();
            return;
        }

        var info = nce.getCubeMap()[(nce.getSelectedCubeName() + '').toLowerCase()];
        if (!info)
        {
            clearFields();
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

        var result = nce.call("ncubeController.getDefaultCell", [nce.getAppId(), nce.getSelectedCubeName()]);

        if (result.status === false)
        {
            nce.showNote('Unable to fetch default cell information: ' + result.data);
            return;
        }

        var cellInfo = result.data;

        _defCellValue.val(cellInfo.value || "");
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
        _isUrl.find('input').prop('checked', cellInfo.isUrl);

        // Set the Cache check box state
        _isCached.find('input').prop('checked', cellInfo.isCached);

        scrollToSavedPosition();
    };

    var clearFields = function()
    {
        $('#cube_name').val('');
        $('#cube_revision').val('');
        $('#cube_createDate').val('');
        $('#cube_createHid').val('');
        $('#cube_notes').val('');
        $('#cube_id').val('');
        $('#cube_sha1').val('');
        $('#cube_headSha1').val('');
    };

    var handleCubeSelected = function()
    {
        load();
    };

    return {
        init: init,
        handleCubeSelected: handleCubeSelected,
        load: load
    };

})(jQuery);

var tabActivated = function tabActivated(info)
{
    DetailEditor.init(info);
    DetailEditor.load();
};

var cubeSelected = function cubeSelected()
{
    DetailEditor.handleCubeSelected();
};