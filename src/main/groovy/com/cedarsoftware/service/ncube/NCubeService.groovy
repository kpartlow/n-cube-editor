package com.cedarsoftware.service.ncube

import com.cedarsoftware.ncube.ApplicationID
import com.cedarsoftware.ncube.Axis
import com.cedarsoftware.ncube.AxisType
import com.cedarsoftware.ncube.AxisValueType
import com.cedarsoftware.ncube.NCube
import com.cedarsoftware.ncube.NCubeInfoDto
import com.cedarsoftware.ncube.NCubeManager
import com.cedarsoftware.util.StringUtilities
import com.cedarsoftware.util.io.JsonObject
import com.cedarsoftware.util.io.JsonReader
import com.cedarsoftware.util.io.JsonWriter
import groovy.transform.CompileStatic

/**
 * RESTful Ajax/JSON API for editor application
 *
 * @author John DeRegnaucourt (jdereg@gmail.com)
 *         <br/>
 *         Copyright (c) Cedar Software LLC
 *         <br/><br/>
 *         Licensed under the Apache License, Version 2.0 (the "License")
 *         you may not use this file except in compliance with the License.
 *         You may obtain a copy of the License at
 *         <br/><br/>
 *         http://www.apache.org/licenses/LICENSE-2.0
 *         <br/><br/>
 *         Unless required by applicable law or agreed to in writing, software
 *         distributed under the License is distributed on an "AS IS" BASIS,
 *         WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *         See the License for the specific language governing permissions and
 *         limitations under the License.
 */
@CompileStatic
class NCubeService
{
    List<NCubeInfoDto> search(ApplicationID appId, String cubeNamePattern, String contentMatching, Map options)
    {
        if (!cubeNamePattern.startsWith('*'))
        {
            cubeNamePattern = '*' + cubeNamePattern
        }
        if (!cubeNamePattern.endsWith('*'))
        {
            cubeNamePattern = cubeNamePattern + '*'
        }

        return NCubeManager.search(appId, cubeNamePattern, contentMatching, options)
    }

    void restoreCube(ApplicationID appId, Object[] cubeNames, String username)
    {
        NCubeManager.restoreCube(appId, cubeNames, username)
    }

    List<NCubeInfoDto> getRevisionHistory(ApplicationID appId, String cubeName)
    {
        return NCubeManager.getRevisionHistory(appId, cubeName)
    }

    List<String> getAppNames(String tenant, String status, String branch)
    {
        return NCubeManager.getAppNames(tenant, status, branch)
    }

    List<String> getAppVersions(String tenant, String app, String status, String branch)
    {
        return NCubeManager.getAppVersions(tenant, app, status, branch)
    }

    void createBranch(ApplicationID appId)
    {
        NCubeManager.createBranch(appId)
    }

    Set<String> getBranches(String tenant)
    {
        return NCubeManager.getBranches(tenant)
    }

    List<NCubeInfoDto> getBranchChanges(ApplicationID appId)
    {
        return NCubeManager.getBranchChangesFromDatabase(appId)
    }

    List<NCubeInfoDto> commitBranch(ApplicationID appId, Object[] infoDtos, String username)
    {
        return NCubeManager.commitBranch(appId, infoDtos, username)
    }

    int rollbackBranch(ApplicationID appId, Object[] infoDtos)
    {
        return NCubeManager.rollbackBranch(appId, infoDtos)
    }

    List<NCubeInfoDto> updateBranch(ApplicationID appId, String username)
    {
        return NCubeManager.updateBranch(appId, username)
    }

    void deleteBranch(ApplicationID appId)
    {
        NCubeManager.deleteBranch(appId);
    }

    void acceptTheirs(ApplicationID appId, String cubeName, String branchSha1, String username)
    {
        NCubeManager.mergeOverwriteBranchCube(appId, cubeName, branchSha1, username)
    }

    void acceptMine(ApplicationID appId, String cubeName, String headSha1, String username)
    {
        NCubeManager.mergeOverwriteHeadCube(appId, cubeName, headSha1, username)
    }

    void createCube(ApplicationID appId, NCube ncube, String username)
    {
        NCubeManager.updateCube(appId, ncube, username)
    }

    boolean deleteCube(ApplicationID appId, String cubeName, String username)
    {
        return NCubeManager.deleteCube(appId, cubeName, username)
    }

    void duplicateCube(ApplicationID appId, ApplicationID destAppId, String cubeName, String newName, String username)
    {
        NCubeManager.duplicate(appId, destAppId, cubeName, newName, username)
    }

    void releaseCubes(ApplicationID appId, String newSnapVer)
    {
        NCubeManager.releaseCubes(appId, newSnapVer)
    }

    void changeVersionValue(ApplicationID appId, String newSnapVer)
    {
        NCubeManager.changeVersionValue(appId, newSnapVer)
    }

    void addAxis(ApplicationID appId, String cubeName, String axisName, String type, String valueType, String username)
    {
        if (StringUtilities.isEmpty(axisName))
        {
            throw new IllegalArgumentException("Axis name cannot be empty.")
        }

        NCube ncube = NCubeManager.getCube(appId, cubeName)
        if (ncube == null)
        {
            throw new IllegalArgumentException("Could not add axis '" + axisName + "', NCube '" + cubeName + "' not found for app: " + appId)
        }

        long maxId = -1
        Iterator<Axis> i = ncube.getAxes().iterator()
        while (i.hasNext())
        {
            Axis axis = i.next()
            if (axis.id > maxId)
            {
                maxId = axis.id
            }
        }
        Axis axis = new Axis(axisName, AxisType.valueOf(type), AxisValueType.valueOf(valueType), false, Axis.DISPLAY, maxId + 1)
        ncube.addAxis(axis)
        NCubeManager.updateCube(appId, ncube, username)
    }

    /**
     * Delete the specified axis.
     */
    void deleteAxis(ApplicationID appId, String name, String axisName, String username)
    {
        NCube ncube = NCubeManager.getCube(appId, name)
        if (ncube == null)
        {
            throw new IllegalArgumentException("Could not delete axis '" + axisName + "', NCube '" + name + "' not found for app: " + appId)
        }

        if (ncube.getNumDimensions() == 1)
        {
            throw new IllegalArgumentException("Could not delete axis '" + axisName + "' - at least one axis must exist on n-cube.")
        }

        ncube.deleteAxis(axisName)
        NCubeManager.updateCube(appId, ncube, username)
    }

    /**
     * Update the 'informational' part of the Axis (not the columns).
     */
    void updateAxis(ApplicationID appId, String name, String origAxisName, String axisName, boolean hasDefault, boolean isSorted, boolean fireAll, String username)
    {
        NCube ncube = NCubeManager.getCube(appId, name)
        if (ncube == null)
        {
            throw new IllegalArgumentException("Could not update axis '" + origAxisName + "', NCube '" + name + "' not found for app: " + appId)
        }

        // Rename axis
        if (!origAxisName.equalsIgnoreCase(axisName))
        {
            ncube.renameAxis(origAxisName, axisName)
        }

        // Update default column setting (if changed)
        Axis axis = ncube.getAxis(axisName)
        if (axis.hasDefaultColumn() && !hasDefault)
        {   // If it went from having default column to NOT having default column...
            ncube.deleteColumn(axisName, null)
        }
        else if (!axis.hasDefaultColumn() && hasDefault)
        {
            if (axis.type != AxisType.NEAREST)
            {
                ncube.addColumn(axisName, null)
            }
        }

        // update preferred column order
        if (axis.type == AxisType.RULE)
        {
            axis.setFireAll(fireAll)
        }
        else
        {
            axis.setColumnOrder(isSorted ? Axis.SORTED : Axis.DISPLAY)
        }

        NCubeManager.updateCube(appId, ncube, username)
    }

    /**
     * Update the indicated column (by ID) with the passed in String value.  The String value
     * is parsed into DISCRETE, RANGE, SET, NEAREST, or RULE, and to the proper axis value type
     * for the axis.  This allows Strings like "[10, 25]" to be passed into a Range axis, for
     * example, and it will be added as a Range(10, 25) and will go through all the proper
     * "up promotion" before being set into the column.
     */
    void updateColumnCell(ApplicationID appId, String cubeName, String colId, String value, String username)
    {
        NCube ncube = NCubeManager.getCube(appId, cubeName)
        if (ncube == null)
        {
            throw new IllegalArgumentException("Could not update Column, cube: " + cubeName + " not found for app: " + appId)
        }

        long id
        try
        {
            id = Long.parseLong(colId)
        }
        catch (NumberFormatException e)
        {
            throw new IllegalArgumentException("Column ID passed in (" + colId + ") is not a number, attempting to update column on NCube '" + cubeName + "'")
        }

        Axis axis = ncube.getAxisFromColumnId(id)
        if (axis == null)
        {
            throw new IllegalArgumentException("Column ID passed in (" + colId + ") does not match any axis on NCube '" + cubeName + "'")
        }

        ncube.updateColumn(id, axis.convertStringToColumnValue(value))
        NCubeManager.updateCube(appId, ncube, username)
    }

    /**
     * In-place update of a cell.  'Value' is the final (converted) object type to be stored
     * in the indicated (by colIds) cell.
     */
    void updateNCube(NCube ncube, String username)
    {
        ApplicationID appId = ncube.getApplicationID()
        NCubeManager.updateCube(appId, ncube, username)
    }

    boolean renameCube(ApplicationID appId, String oldName, String newName, String username)
    {
        return NCubeManager.renameCube(appId, oldName, newName, username)
    }

    /**
     * Update / Save a single n-cube -or- create / update a batch of n-cubes, represented as a JSON
     * array [] of n-cubes.
     */
    void updateCube(ApplicationID appId, String name, String json, String username)
    {
        json = json.trim()
        List cubes
        boolean checkName
        if (json.startsWith("["))
        {
            checkName = false
            cubes = getCubes(json)
        }
        else
        {
            checkName = true
            cubes = new ArrayList()
            cubes.add(NCube.fromSimpleJson(json))
        }

        for (Object object : cubes)
        {
            if (object instanceof NCube)
            {
                NCube ncube = (NCube) object
                if (checkName)
                {
                    if (!StringUtilities.equalsIgnoreCase(name, ncube.name))
                    {
                        throw new IllegalArgumentException("The n-cube name cannot be different than selected n-cube.  Use Rename n-cube option from n-cube menu to rename the cube.")
                    }
                }

                NCubeManager.updateCube(appId, ncube, username)
            }
            else
            {
                JsonObject map = (JsonObject) object
                String cubeName = (String) map.ncube
                String cmd = (String) map.action

                if ("delete".equalsIgnoreCase(cmd))
                {
                    NCubeManager.deleteCube(appId, cubeName, username)
                }
            }
        }
    }

    /**
     * In-place update of a cell.  'Value' is the final (converted) object type to be stored
     * in the indicated (by colIds) cell.
     */
    String getTestData(ApplicationID appId, String cubeName)
    {
        return NCubeManager.getTestData(appId, cubeName)
    }

    /**
     * In-place update of a cell.  'Value' is the final (converted) object type to be stored
     * in the indicated (by colIds) cell.
     */
    boolean updateTestData(ApplicationID appId, String cubeName, String tests)
    {
        return NCubeManager.updateTestData(appId, cubeName, tests)
    }

    NCube getCube(ApplicationID appId, String name)
    {
        NCube cube = NCubeManager.getCube(appId, name)
        if (cube == null)
        {
            throw new IllegalArgumentException("Unable to load cube: " + name + " for app: " + appId)
        }
        return cube
    }

    NCube getCubeRevision(ApplicationID appId, String name, long revision)
    {
        NCube cube = NCubeManager.getCubeRevision(appId, name, revision)
        if (cube == null)
        {
            throw new IllegalArgumentException("Unable to load cube: " + name + ", app: " + appId + ", revision: " + revision)
        }
        return cube
    }

    void getReferencedCubeNames(ApplicationID appId, String cubeName, Set<String> references)
    {
        NCubeManager.getReferencedCubeNames(appId, cubeName, references)
    }

    String resolveRelativeUrl(ApplicationID appId, String relativeUrl)
    {
        return NCubeManager.resolveRelativeUrl(appId, relativeUrl)
    }

    void clearCache(ApplicationID appId)
    {
        NCubeManager.clearCache(appId)
    }

    // =========================================== Helper methods ======================================================

    static List getCubes(String json)
    {
        String lastSuccessful = ""
        try
        {
            JsonObject ncubes = (JsonObject) JsonReader.jsonToMaps(json)
            Object[] cubes = ncubes.getArray()
            List cubeList = new ArrayList(cubes.length)

            for (Object cube : cubes)
            {
                JsonObject ncube = (JsonObject) cube
                if (ncube.containsKey("action"))
                {
                    cubeList.add(ncube)
                    lastSuccessful = (String) ncube.get("ncube")
                }
                else
                {
                    String json1 = JsonWriter.objectToJson(ncube)
                    NCube nCube = NCube.fromSimpleJson(json1)
                    cubeList.add(nCube)
                    lastSuccessful = nCube.getName()
                }
            }

            return cubeList
        }
        catch (Exception e)
        {
            String s = "Failed to load n-cubes from passed in JSON, last successful cube read: " + lastSuccessful
            throw new IllegalArgumentException(s, e)
        }
    }
}
