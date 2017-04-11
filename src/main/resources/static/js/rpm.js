/**
 * RPM Editor
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

var RpmEditor = (function($)
{
    var hot = null;
    var nce = null;
    var traitMetaInfo = null;
    var traitTable = null;
    var fieldNames = null;

    var init = function(info)
    {
        if (!nce)
        {
            nce = info;

            $(window).resize(function ()
            {
                RpmEditor.render();
            });

            loadTraitMetaInfo();
            buildTraitButtons();
        }
    };

    var loadTraitMetaInfo = function()
    {
        var result = nce.exec('RpmController.getTraitCategoriesDeep', [nce.getSelectedTabAppId(), {}]);
        if (result.status === false || !result.data.return)
        {
            showRpmError('Unable to fetch trait categories for all traits.  The rpm.meta.traits cubes are not loading:<hr class="hr-small"/>' + result.data);
            return;
        }

        traitMetaInfo = result.data.return;
    };

    var buildTraitButtons = function()
    {
        var div = $('#traitFilter');
        div.empty();
        var result = nce.exec('RpmController.getTraitCategories', [nce.getSelectedTabAppId(), {}]);
        if (result.status === false)
        {
            showRpmError('Unable to fetch rpm.meta.traits n-cube.');
            return;
        }
        var traitList = result.data.return['@items'];
        var i = 0;
        $.each(traitList, function(index, item)
        {
            var label = $('<label/>');
            label.attr({class:'btn'});
            if (i == 0)
            {
                label.addClass('active');
            }
            label.attr({style:'border-color:#999;color:' + item.metaProps['css:color'] + ';background-color:' + item.metaProps['css:background-color'] + ' !important'});
            label.attr({'data-cat': item.value, 'data-toggle': "buttons"});
            var input = $('<input>').attr({type:'checkbox', autocomplete:'off'});
            i++;
            label.append(input);
            var btnText = item.metaProps['shortDesc'] || item.value;
            label.append(' ' + btnText);
            label.click(function(e)
            {
                e.preventDefault();
                label.toggleClass('active');
                load();
            });
            div.append(label);
        });

        $('#selectAll').click(function(e)
        {
            e.preventDefault();
            $('#traitFilter').find('label').each(function()
            {
                $(this).addClass('active');
            });
            load();
        });

        $('#selectNone').click(function(e)
        {
            e.preventDefault();
            $('#traitFilter').find('label').each(function()
            {
                $(this).removeClass('active');
            });
            load();
        });
    };

    var showRpmError = function(msg)
    {
        $('#rpmErrorPanel').removeAttr('hidden');
        $('#viewRpmInfo').attr('hidden', true);
        $('#rpmErrorMsg').html(msg);
    };

    var clearRpmError = function()
    {
        $('#rpmErrorPanel').attr('hidden', true);
        $('#viewRpmInfo').removeAttr('hidden');
    };

    var buildTraitTable = function()
    {
        traitTable = {names:['Traits >']};
        traitTable['css:color'] = ['#fff'];
        traitTable['css:background-color'] = ['#777'];

        var i = 1;

        $('#traitFilter').find('label').each(function(index, element)
        {
            var elem = $(element);

            if (elem.hasClass('active'))
            {
                var category = elem.attr('data-cat');
                var catInfo = traitMetaInfo[category];
                var catMeta = catInfo.info.metaProps;

                if (!catMeta)
                {   // No meta props for trait category, create empty map.
                    catMeta = {};
                }

                $.each(catInfo.traits['@items'], function(key1, val1)
                {
                    traitTable.names[i] = val1.value;

                    // Blast all category level CSS metaProperties onto traitTable.
                    $.each(catMeta, function(key)
                    {
                        if (key.startsWith('css:'))
                        {
                            traitTable[key][i] = catMeta[key];
                        }
                    });

                    // Blast all trait level CSS metaProperties onto traitTable (these override category level settings)
                    if (!val1.metaProps)
                    {   // No meta props for specific trait within trait category, create empty map.
                        val1.metaProps = {};
                    }

                    $.each(val1.metaProps, function(key, value)
                    {
                        if (key.startsWith('css:'))
                        {
                            if (!traitTable[key])
                            {   // First time this specific CSS trait is seen, make space for it.
                                traitTable[key] = [];
                            }
                            traitTable[key][i] = value;
                        }
                    });

                    if (!traitTable['css:color'][i])
                    {   // Color not set on trait category, default to dark gray.
                        traitTable['css:color'][i] = ['#444'];
                    }

                    if (!traitTable['css:background-color'][i])
                    {   // Background color not set on trait category, default to white.
                        traitTable['css:background-color'][i] = ['#fff'];
                    }

                    i++;
                });
            }
        });
    };

    var load = function()
    {
        if (hot)
        {
            hot.destroy();
            hot = null;
        }

        var info = nce.getInfoDto();
        if (!info)
        {
            showRpmError('No cube selected.');
            return;
        }

        var loName = nce.getSelectedCubeName().toLowerCase();

        if (loName.indexOf('rpm.class') != 0 && loName.indexOf('rpm.enum') != 0)
        {
            showRpmError('<b>' + info.name + '</b> is not an RPM Class.');
            return;
        }

        var result = nce.exec('RpmController.getFields', [nce.getSelectedTabAppId(), {'cube':nce.getSelectedCubeName()}]);
        if (result.status === false || !result.data.return || !result.data.return['@items'])
        {
            showRpmError('<b>' + info.name + '</b> is not an RPM Class:<hr class="hr-small"/>It has no fields');
            return;
        }

        var rpmClassName;
        if (nce.getSelectedCubeName().startsWith('rpm.class'))
        {
            rpmClassName = nce.getSelectedCubeName().replace(/^rpm.class./, '');
        }
        else if (nce.getSelectedCubeName().startsWith('rpm.enum'))
        {
            rpmClassName = nce.getSelectedCubeName().replace(/^rpm.enum./, '');
        }
        else
        {
            showRpmError('<b>' + info.name + '</b> is not an RPM Class.');
            return;
        }
        buildTraitTable();

        $('#rpmClassName').html(rpmClassName);
        var rpmClass = result.data.return['@items'];
        fieldNames = [];
        var rowNums = [];
        var row = 0;
        $.each(rpmClass, function(index, col)
        {
            fieldNames.push(col.value);
            rowNums.push(++row);
        });

        clearRpmError();

        var container = document.getElementById('rpmTable'),
            settings = {
                autoColumnSize: true,
                enterBeginsEditing: false,
                enterMoves: {row: 1, col: 0},
                tabMoves : {row: 0, col: 1},
                colHeaders: traitTable.names,
                rowHeaders: rowNums,
                startCols: traitTable.names.length,
                startRows: rowNums.length,
                //contextMenu: true,
                manualColumnResize: true,
                manualRowResize: true,
                fixedColumnsLeft: 1,
                height:500,
                cells: function (row, col, prop)
                {
                    return {renderer:categoryRenderer};
                }
            };

        hot = new Handsontable(container, settings);
        hot.render();
    };

    var categoryRenderer = function(instance, td, row, col, prop, value, cellProperties)
    {
        Handsontable.renderers.TextRenderer.apply(this, arguments);
        if (col == 0)
        {
            td.innerHTML = fieldNames[row];
        }

        $.each(traitTable, function(item)
        {
            if (item.startsWith('css:') && traitTable[item][col])
            {
                var style = item.replace(/^css:/, '');
                td.style[style] = traitTable[item][col];
            }
        });
    };

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

    // API
    return {
        init: init,
        load: load,
        render: render,
        handleCubeSelected: handleCubeSelected
    };

})(jQuery);

// Event handlers for events from NCE Frame
var tabActivated = function tabActivated(info)
{
    RpmEditor.init(info);
    RpmEditor.load();
};

var cubeSelected = function cubeSelected()
{
    RpmEditor.handleCubeSelected();
};

var onNoteEvent = function onNoteEvent(e, element){};