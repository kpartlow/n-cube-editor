/**
 * JSON Editor
 *     Edit n-cubes in JSON format
 *
 * @author John DeRegnaucourt
 */

var NCubeJsonEditor = (function ($)
{
    var nce = null;
    var _editor = null;

    var init = function(info)
    {
        // Create JSON Editor (http://jsoneditoronline.org/downloads/)
        if (!nce)
        {
            nce = info;
            var container = document.getElementById('jsoneditor');
            var options =
            {
                mode: 'code',
                change: function ()
                {
                    updateDirtyStatus();
                }
            };

            _editor = new JSONEditor(container, options);
            addSaveButton();
        }
    };

    var addSaveButton = function()
    {
        var editCtrl = $('#jsoneditor');
        var menu = editCtrl.find('.menu');
        var save = $("<button/>").attr(
        {
            id: 'saveButton',
            style: 'background-image:none;width:64px',
            title: 'Save changes'
        });
        menu.append(save);           // Add 'Save' button to toolbar
        menu.find('a').remove();

        // Attach listener
        $('#saveButton').click(function ()
        {
            nce.clearError();
            if (nce.isHeadSelected())
            {
                nce.selectBranch();
                return;
            }

            clearDirtyStatus();
            updateDirtyStatus();
            var result = nce.call("ncubeController.saveJson", [nce.getAppId(), nce.getSelectedCubeName(), _editor.getText()]);
            if (result.status !== true)
            {
                nce.showNote('Error saving JSON n-cube:<hr class="hr-small"/>' + result.data);
            }
        });
    };

    var isDirty = function()
    {
        if (_editor.editor)
        {
            return !_editor.editor.getSession().getUndoManager().isClean();
        }
        return false;
    };

    var clearDirtyStatus = function()
    {
        if (_editor.editor)
        {
            var undoMgr = _editor.editor.getSession().getUndoManager();
            undoMgr.reset();
            undoMgr.markClean();
        }
    };

    var updateDirtyStatus = function()
    {
        var saveButton = $('#saveButton');
        if (saveButton.length == 0)
        {
            return;
        }
        var dirty = isDirty();
        saveButton.prop('disabled', !dirty);
        var text = 'Save';
        if (dirty)
        {
            text += '*';
        }
        saveButton.html(text);
    };

    var load = function()
    {
        if (!nce.getSelectedCubeName() || !nce.getSelectedApp() || !nce.getSelectedVersion() || !nce.getSelectedStatus())
        {
            _editor.setText('No n-cube to load');
            clearDirtyStatus();
            updateDirtyStatus();
            return;
        }
        var result = nce.call("ncubeController.getJson", [nce.getAppId(), nce.getSelectedCubeName(), {mode:"json"}], {noResolveRefs:true});
        if (result.status === true)
        {
            try {
                _editor.setText(result.data);
                _editor.format();
            }
            catch (e)
            {
                nce.showNote('JSON content too large for the JSON Text Editor.  Capture the JSON from the "Revision History" option.');
                console.log(e);
            }
        }
        else
        {
            _editor.setText("Unable to load '" + nce.getSelectedCubeName() + "'. " + result.data);
        }

        clearDirtyStatus();
        updateDirtyStatus();
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
    NCubeJsonEditor.init(info);
    NCubeJsonEditor.load();
};

var cubeSelected = function cubeSelected()
{
    NCubeJsonEditor.handleCubeSelected();
};
