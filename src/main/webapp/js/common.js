/**
 * NCube Editor
 *     Common Javascript utilities for all tabs to use.
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

/**
 * return number of 'own' keys in object
 */
function countKeys(object)
{
    var count = 0;
    for (var key in object)
    {
        if (object.hasOwnProperty(key))
        {
            count++;
        }
    }
    return count;
}

/**
 * Convert strings containing DOS-style '*' or '?' to a regex String.
 */
function wildcardToRegexString(wildcard)
{
    var s = '';

    for (var i = 0, is = wildcard.length; i < is; i++)
    {
        var c = wildcard.charAt(i);
        switch (c)
        {
            case '*':
                s += '.*?';
                break;

            case '?':
                s += '.';
                break;

            // escape special regexp-characters
            case '(':
            case ')':
            case '[':
            case ']':
            case '$':
            case '^':
            case '.':
            case '{':
            case '}':
            case '|':
            case '\\':
                s += '\\';
                s += c;
                break;

            default:
                s += c;
                break;
        }
    }
    return s;
}

/**
 * Escape regex characters in source String.  For example, period (.) becomes \.
 */
function escapeRegExp(string)
{
    return string.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
}

/**
 * Check all the inputs in a list.
 */
function checkAll(state, queryStr)
{
    var input = $(queryStr).filter(':visible');
    $.each(input, function (index, btn)
    {
        $(this).prop('checked', state);
    });
}

function keyCount(obj)
{
    var size = 0, key;
    for (key in obj)
    {
        if (obj.hasOwnProperty(key))
        {
            size++;
        }
    }
    return size;
}

/**
 * Fill the list identified by listId, with items from the list 'list',
 * where the list is an array of Strings.  A click listener will be
 * added to each item, so that when the user clicks on an itemin the list,
 * the input identified by inputId, will be filled with the selected text,
 * and the passed in callback function will be called on the click (selection).
 */
function buildDropDown(listId, inputId, list, callback)
{
    var ul = $(listId);
    ul.empty();
    $.each(list, function (key, value)
    {
        var li = $('<li/>');
        var anchor = $('<a href="#"/>');
        anchor.html(value);
        anchor.click(function (e)
        {   // User clicked on a dropdown entry, copy its text to input field
            e.preventDefault();
            $(inputId).val(anchor.html());
            callback(anchor.html());
        });
        li.append(anchor);
        ul.append(li);
    });
}

/**
 * SheetClip - Spreadsheet Clipboard Parser
 * version 0.2
 *
 * This tiny library transforms JavaScript arrays to strings that are pasteable by LibreOffice, OpenOffice,
 * Google Docs and Microsoft Excel.
 *
 * Copyright 2012, Marcin Warpechowski
 * Licensed under the MIT license.
 * http://github.com/warpech/sheetclip/
 */

function countQuotes(str)
{
    return str.split('"').length - 1;
}

function parseExcelClipboard(str)
{
    var r, rlen, rows, arr = [], a = 0, c, clen, multiline, last;
    rows = str.split('\n');
    if (rows.length > 1 && rows[rows.length - 1] === '')
    {
        rows.pop();
    }

    for (r = 0, rlen = rows.length; r < rlen; r += 1)
    {
        rows[r] = rows[r].split('\t');
        for (c = 0, clen = rows[r].length; c < clen; c += 1)
        {
            if (!arr[a])
            {
                arr[a] = [];
            }

            if (multiline && c === 0)
            {
                last = arr[a].length - 1;
                arr[a][last] = arr[a][last] + '\n' + rows[r][0];
                if (multiline && (countQuotes(rows[r][0]) & 1)) { //& 1 is a bitwise way of performing mod 2
                    multiline = false;
                    arr[a][last] = arr[a][last].substring(0, arr[a][last].length - 1).replace(/""/g, '"');
                }
            }
            else
            {
                if (c === clen - 1 && rows[r][c].indexOf('"') === 0 && (countQuotes(rows[r][c]) & 1))
                {
                    arr[a].push(rows[r][c].substring(1).replace(/""/g, '"'));
                    multiline = true;
                }
                else
                {
                    arr[a].push(rows[r][c].replace(/""/g, '"'));
                    multiline = false;
                }
            }
        }
        if (!multiline)
        {
            a += 1;
        }
    }

    return arr;
}