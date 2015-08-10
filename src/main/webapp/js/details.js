function tabActivated(_cubeList, _selectedCubeName)
{
    // TODO: Need to see what !doesCubeExist() is doing
    // TODO: Ensure cubeList is complete (not search filtered)
    if (!_cubeList)// || !doesCubeExist())
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
