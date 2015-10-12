package com.cedarsoftware.controller

import com.cedarsoftware.ncube.*
import com.cedarsoftware.ncube.exception.BranchMergeException
import com.cedarsoftware.ncube.formatters.NCubeTestReader
import com.cedarsoftware.ncube.formatters.NCubeTestWriter
import com.cedarsoftware.ncube.formatters.TestResultsFormatter
import com.cedarsoftware.service.ncube.NCubeService
import com.cedarsoftware.servlet.JsonCommandServlet
import com.cedarsoftware.util.*
import com.cedarsoftware.util.io.JsonReader
import com.cedarsoftware.util.io.JsonWriter
import groovy.transform.CompileStatic
import org.apache.logging.log4j.LogManager
import org.apache.logging.log4j.Logger

import javax.servlet.http.HttpServletRequest
import java.util.regex.Pattern

/**
 * NCubeController API.
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
class NCubeController extends BaseController
{
    private static final Pattern VERSION_REGEX = ~/[.]/
    private static final Pattern IS_NUMBER_REGEX = ~/^[\d,.e+-]+$/
    private static final Pattern NO_QUOTES_REGEX = ~/"/
    private NCubeService nCubeService;
    private static final Logger LOG = LogManager.getLogger(NCubeController.class)

    NCubeController(NCubeService service)
    {
        nCubeService = service;
        System.err = new ThreadAwarePrintStreamErr()
        System.out = new ThreadAwarePrintStream()
    }

    private String getUserForDatabase()
    {
        String user = getUser()
        return StringUtilities.length(user) > 10 ? user.substring(0, 10) : user;
    }

    private static String getUser()
    {
        String user = null
        HttpServletRequest request = JsonCommandServlet.servletRequest.get()
        Enumeration e = request.headerNames
        while (e.hasMoreElements())
        {
            String headerName = (String) e.nextElement()
            if ("smuser".equalsIgnoreCase(headerName))
            {
                user = request.getHeader(headerName)
                break;
            }
        }

        if (StringUtilities.isEmpty(user))
        {
            user = System.getProperty("user.name")
        }

        return user
    }

    // TODO: This API will look into sys.permissions cube for determination of access
    private static boolean isAllowed(ApplicationID appId, String cubeName, Delta.Type operation)
    {
        if (false)
        {   // permissions checks
            markRequestFailed("You do not have permissions to make changes in " + appId.cacheKey(cubeName))
            return false
        }

//        if (operation != null)
//        {
//            if (appId.isRelease())
//            {
//                markRequestFailed("Release cubes cannot be edited, cube: " + appId.cacheKey(cubeName))
//                return false
//            }
//
//            if ("HEAD".equalsIgnoreCase(appId.branch) || StringUtilities.isEmpty(appId.branch))
//            {
//                markRequestFailed("A branch must be selected or created before you can edit: " + appId.cacheKey(cubeName))
//                return false
//            }
//        }
        return true
    }

    // ============================================= Begin API =========================================================

    Object[] search(ApplicationID appId, String cubeNamePattern, String content, boolean active)
    {
        try
        {
            appId = addTenant(appId)
            if (!isAllowed(appId, null, null))
            {
                return null
            }

            Map options = [:]
            if (active)
            {
                options[(NCubeManager.SEARCH_ACTIVE_RECORDS_ONLY)] = true
            }
            else
            {
                options[(NCubeManager.SEARCH_DELETED_RECORDS_ONLY)] = true
            }

            List<NCubeInfoDto> cubeInfos = nCubeService.search(appId, cubeNamePattern, content, options)

            Collections.sort(cubeInfos, new Comparator<NCubeInfoDto>() {
                public int compare(NCubeInfoDto info1, NCubeInfoDto info2)
                {
                    return info1.name.compareToIgnoreCase(info2.name)
                }
            })

            return cubeInfos.toArray()
        }
        catch (Exception e)
        {
            fail(e)
            return null
        }
    }

    void restoreCube(ApplicationID appId, Object[] cubeNames)
    {
        try
        {
            appId = addTenant(appId)
            if (!isAllowed(appId, null, Delta.Type.ADD))
            {
                return
            }
            nCubeService.restoreCube(appId, cubeNames, getUserForDatabase())
        }
        catch (Exception e)
        {
            fail(e)
        }
    }

    Object[] getRevisionHistory(ApplicationID appId, String cubeName)
    {
        try
        {
            appId = addTenant(appId)
            if (!isAllowed(appId, cubeName, null))
            {
                return null
            }
            List<NCubeInfoDto> cubeInfos = nCubeService.getRevisionHistory(appId, cubeName)
            return cubeInfos.toArray()
        }
        catch (Exception e)
        {
            fail(e)
            return null
        }
    }

    String getHtml(ApplicationID appId, String cubeName)
    {
        try
        {
            appId = addTenant(appId)
            if (!isAllowed(appId, cubeName, null))
            {
                return null
            }
            NCube ncube = nCubeService.getCube(appId, cubeName)
            // The Strings below are hints to n-cube to tell it which axis to place on top
            String html = ncube.toHtml('trait', 'traits', 'businessDivisionCode', 'bu', 'month', 'months', 'col', 'column', 'cols', 'columns')
            return html;
        }
        catch (Exception e)
        {
            fail(e)
            return null
        }
    }

    String getJson(ApplicationID appId, String cubeName)
    {
        try
        {
            appId = addTenant(appId)
            if (!isAllowed(appId, cubeName, null))
            {
                return null
            }
            NCube ncube = nCubeService.getCube(appId, cubeName)
            return ncube.toFormattedJson()
        }
        catch (Exception e)
        {
            fail(e)
            return null
        }
    }

    Object[] getAppNames(String status, String branch)
    {
        try
        {
            String tenant = getTenant()
            ApplicationID.validateTenant(tenant)
            ApplicationID.validateStatus(status)
            ApplicationID.validateBranch(branch)
            // TODO: Custom isAllowed() may ne needed
            List<String> appNames = nCubeService.getAppNames(tenant, status, branch)
            Object[] appNameArray = appNames.toArray()
            caseInsensitiveSort(appNameArray)
            return appNameArray
        }
        catch (Exception e)
        {
            fail(e)
            return null
        }
    }

    Object[] getAppVersions(String app, String status, String branchName)
    {
        try
        {
            String tenant = getTenant();
            ApplicationID.validateTenant(tenant);
            ApplicationID.validateApp(app);
            ApplicationID.validateStatus(status);
            ApplicationID.validateBranch(branchName);
            // TODO: Custom isAllowed() may be needed
            List<String> appVersions = nCubeService.getAppVersions(tenant, app, status, branchName)

            // Sort by version number (1.1.0, 1.2.0, 1.12.0, ...) not String order (1.1.0, 1.12.0, 1.2.0, ...)
            Collections.sort(appVersions, new Comparator<Object>() {
                public int compare(Object o1, Object o2)
                {
                    String s1 = (String) o1
                    String s2 = (String) o2
                    return getVersionValue(s1) - getVersionValue(s2)
                }

                int getVersionValue(String v)
                {
                    String[] pieces = VERSION_REGEX.split(v)
                    if (pieces.length != 3)
                    {
                        return 0
                    }
                    int major = Integer.valueOf(pieces[0]) * 1000 * 1000
                    int minor = Integer.valueOf(pieces[1]) * 1000
                    int rev = Integer.valueOf(pieces[2])
                    return major + minor + rev
                }
            })
            return appVersions.toArray()
        }
        catch (Exception e)
        {
            fail(e)
            return null
        }
    }

    /**
     * Create an n-cube (SNAPSHOT only).
     */
    void createCube(ApplicationID appId, String cubeName)
    {
        try
        {
            appId = addTenant(appId)
            if (!isAllowed(appId, cubeName, Delta.Type.ADD))
            {
                return
            }

            NCube ncube = new NCube(cubeName)
            Axis cols = new Axis("Column", AxisType.DISCRETE, AxisValueType.STRING, false, Axis.DISPLAY, 1)
            cols.addColumn("A")
            cols.addColumn("B")
            cols.addColumn("C")
            cols.addColumn("D")
            cols.addColumn("E")
            cols.addColumn("F")
            cols.addColumn("G")
            cols.addColumn("H")
            cols.addColumn("I")
            cols.addColumn("J")
            Axis rows = new Axis("Row", AxisType.DISCRETE, AxisValueType.LONG, false, Axis.DISPLAY, 2)
            rows.addColumn(1)
            rows.addColumn(2)
            rows.addColumn(3)
            rows.addColumn(4)
            rows.addColumn(5)
            rows.addColumn(6)
            rows.addColumn(7)
            rows.addColumn(8)
            rows.addColumn(9)
            rows.addColumn(10)
            ncube.addAxis(cols)
            ncube.addAxis(rows)
            nCubeService.createCube(appId, ncube, getUserForDatabase())
        }
        catch (Exception e)
        {
            fail(e)
        }
    }

    /**
     * Delete an n-cube (SNAPSHOT only).
     * @return boolean true if successful, otherwise a String error message.
     */
    boolean deleteCube(ApplicationID appId, String cubeName)
    {
        try
        {
            appId = addTenant(appId)
            if (!isAllowed(appId, cubeName, Delta.Type.DELETE))
            {
                return false
            }

            if (!nCubeService.deleteCube(appId, cubeName, getUserForDatabase()))
            {
                markRequestFailed("Cannot delete RELEASE n-cube.")
            }
            return true
        }
        catch (Exception e)
        {
            fail(e)
            return false
        }
    }

    /**
     * Find all references to an n-cube.  This is an expensive method, as all cubes within the
     * app (version and status) must be checked.
     * @return Object[] of String cube names that reference the named cube, otherwise a String
     * error message.
     */
    Object[] getReferencesTo(ApplicationID appId, String cubeName)
    {
        try
        {
            appId = addTenant(appId)
            if (!isAllowed(appId, cubeName, null))
            {
                return null
            }
            Set<String> references = new CaseInsensitiveSet<>()
            List<NCubeInfoDto> ncubes = nCubeService.search(appId, "*", null, [(NCubeManager.SEARCH_ACTIVE_RECORDS_ONLY):true])

            for (NCubeInfoDto info : ncubes)
            {
                NCube loadedCube = nCubeService.getCube(appId, info.name)
                if (loadedCube.getReferencedCubeNames().contains(cubeName))
                {
                    references.add(info.name)
                }
            }
            references.remove(cubeName)    // do not include reference to self.
            Object[] refs = references.toArray()
            caseInsensitiveSort(references.toArray())
            return refs
        }
        catch (Exception e)
        {
            fail(e)
            return null
        }
    }

    /**
     * Find all references from (out going) an n-cube.
     * @return Object[] of String cube names that the passed in (named) cube references,
     * otherwise a String error message.
     */
    Object[] getReferencesFrom(ApplicationID appId, String cubeName)
    {
        try
        {
            appId = addTenant(appId)
            if (!isAllowed(appId, cubeName, null))
            {
                return null
            }
            Set<String> references = new CaseInsensitiveSet<>()
            nCubeService.getReferencedCubeNames(appId, cubeName, references)
            Object[] refs = references.toArray()
            caseInsensitiveSort(refs)
            return refs
        }
        catch (Exception e)
        {
            fail(e)
            return null
        }
    }

    /**
     * Find all referenced input variables for a given n-cube (and through any n-cubes it
     * references).
     * @return Object[] of String names of each scope variable, otherwise a String error message.
     */
    Object[] getRequiredScope(ApplicationID appId, String cubeName)
    {
        try
        {
            appId = addTenant(appId)
            if (!isAllowed(appId, cubeName, null))
            {
                return null
            }

            NCube ncube = nCubeService.getCube(appId, cubeName)
            Set<String> refs = ncube.getRequiredScope()
            Object[] scopeKeys = refs.toArray()
            caseInsensitiveSort(scopeKeys)
            return scopeKeys
        }
        catch (Exception e)
        {
            fail(e)
            return null
        }
    }

    /**
     * Duplicate the passed in cube, but change the name to newName AND the status of the new
     * n-cube will be SNAPSHOT.
     */
    void duplicateCube(ApplicationID appId, ApplicationID destAppId, String cubeName, String newName)
    {
        try
        {
            appId = addTenant(appId)
            destAppId = addTenant(destAppId)
            if (!isAllowed(appId, cubeName, null))
            {
                return
            }
            if (!isAllowed(destAppId, newName, Delta.Type.ADD))
            {
                return
            }
            nCubeService.duplicateCube(appId, destAppId, cubeName, newName, getUserForDatabase())
        }
        catch (Exception e)
        {
            fail(e)
        }
    }

    /**
     * Release the passed in SNAPSHOT version (update their status_cd to RELEASE), and then
     * duplicate all the n-cubes in the release, creating new ones in SNAPSHOT status with
     * the version number set to the newSnapVer.
     */
    void releaseCubes(ApplicationID appId, String newSnapVer)
    {
        try
        {
            appId = addTenant(appId)
            if (!isAllowed(appId, null, Delta.Type.UPDATE))
            {
                return
            }
            nCubeService.releaseCubes(appId, newSnapVer)
        }
        catch (Exception e)
        {
            fail(e)
        }
    }

    /**
     * Change the SNAPSHOT version number of an n-cube.
     */
    void changeVersionValue(ApplicationID appId, String newSnapVer)
    {
        try
        {
            appId = addTenant(appId)
            if (!isAllowed(appId, null, Delta.Type.UPDATE))
            {
                return
            }
            nCubeService.changeVersionValue(appId, newSnapVer)
        }
        catch (Exception e)
        {
            fail(e)
        }
    }

    /**
     * Add axis to an existing SNAPSHOT n-cube.
     */
    void addAxis(ApplicationID appId, String cubeName, String axisName, String type, String valueType)
    {
        try
        {
            appId = addTenant(appId)
            if (!isAllowed(appId, cubeName, Delta.Type.ADD))
            {
                return
            }
            nCubeService.addAxis(appId, cubeName, axisName, type, valueType, getUserForDatabase())
        }
        catch (Exception e)
        {
            fail(e)
        }
    }

    /**
     * Return the requested axis.  The returned axis has some 'massaging' applied to it before
     * being returned.  First, it is being returned using the 'map-of-maps' format from json-io
     * so that the column IDs can be converted from Longs to Strings, because Javascript cannot
     * process a 64-bit long value (it stores numbers using a double, which means it can only
     * reliably process 53-bits of a long).  Converting the longs to Strings first, allows the
     * column ID to round-trip to the UI and back, and json-io will 'mash' the String column ID
     * into the Long column ID (within the JsonCommandServlet) as it receives the String.  It
     * senses the data-type mismatch (json-io does) and then attempts to convert the String to a
     * numeric value (which succeeds).  This allows the full 64-bit id to make it round trip.
     */
    Map getAxis(ApplicationID appId, String cubeName, String axisName)
    {
        try
        {
            appId = addTenant(appId)
            if (!isAllowed(appId, cubeName, null))
            {
                return null
            }
            NCube ncube = nCubeService.getCube(appId, cubeName)
            Axis axis = ncube.getAxis(axisName)
            return convertAxis(axis)
        }
        catch (Exception e)
        {
            fail(e)
            return null
        }
    }

    /**
     * Delete the passed in axis.
     */
    void deleteAxis(ApplicationID appId, String cubeName, String axisName)
    {
        try
        {
            appId = addTenant(appId)
            if (!isAllowed(appId, cubeName, Delta.Type.DELETE))
            {
                return
            }
            nCubeService.deleteAxis(appId, cubeName, axisName, getUserForDatabase())
        }
        catch (Exception e)
        {
            fail(e)
        }
    }

    void updateAxis(ApplicationID appId, String cubeName, String origAxisName, String axisName, boolean hasDefault, boolean isSorted, boolean fireAll)
    {
        try
        {
            appId = addTenant(appId)
            if (!isAllowed(appId, cubeName, Delta.Type.UPDATE))
            {
                return
            }

            nCubeService.updateAxis(appId, cubeName, origAxisName, axisName, hasDefault, isSorted, fireAll, getUserForDatabase())
        }
        catch (Exception e)
        {
            fail(e)
        }
    }

    /**
     * Update an entire set of columns on an axis at one time.  The updatedAxis is not a real axis,
     * but treated like an Axis-DTO where the list of columns within the axis are in display order.
     */
    void updateAxisColumns(ApplicationID appId, String cubeName, Axis updatedAxis)
    {
        try
        {
            appId = addTenant(appId)
            if (!isAllowed(appId, cubeName, Delta.Type.UPDATE))
            {
                return
            }

            NCube ncube = nCubeService.getCube(appId, cubeName)
            ncube.updateColumns(updatedAxis)
            nCubeService.updateNCube(ncube, getUserForDatabase())
        }
        catch (Exception e)
        {
            fail(e)
        }
    }

    void renameCube(ApplicationID appId, String oldName, String newName)
    {
        try
        {
            appId = addTenant(appId)
            if (!isAllowed(appId, oldName, Delta.Type.UPDATE))
            {
                return
            }
            nCubeService.renameCube(appId, oldName, newName, getUserForDatabase())
        }
        catch(Exception e)
        {
            fail(e)
        }
    }

    void saveJson(ApplicationID appId, String cubeName, String json)
    {
        try
        {
            appId = addTenant(appId)
            if (!isAllowed(appId, cubeName, Delta.Type.UPDATE))
            {
                return
            }
            nCubeService.updateCube(appId, cubeName, json, getUserForDatabase())
        }
        catch (Exception e)
        {
            fail(e)
        }
    }

    Map runTest(ApplicationID appId, String cubeName, NCubeTest test)
    {
        try
        {
            appId = addTenant(appId)
            if (!isAllowed(appId, cubeName, null))
            {
                return null
            }
            NCube ncube = nCubeService.getCube(appId, cubeName)
            Map<String, Object> coord = test.createCoord()
            boolean success = true
            Map output = new LinkedHashMap()
            Map args = [input:coord, output:output, ncube:ncube]
            Map<String, Object> copy = new LinkedHashMap(coord)

            // If any of the input values are a CommandCell, execute them.  Use the fellow (same) input as input.
            // In other words, other key/value pairs on the input map can be referenced in a CommandCell.
            copy.each { key, value ->
                if (value instanceof CommandCell)
                {
                    CommandCell cmd = (CommandCell) value
                    coord[key] = cmd.execute(args)
                }
            }

            Set<String> errors = new LinkedHashSet<>()
            ncube.getCell(coord, output)               // Execute test case

            RuleInfo ruleInfoMain = (RuleInfo) output[(NCube.RULE_EXEC_INFO)]
            ruleInfoMain.setSystemOut(ThreadAwarePrintStream.getContent())
            ruleInfoMain.setSystemErr(ThreadAwarePrintStreamErr.getContent())

            List<GroovyExpression> assertions = test.createAssertions()
            int i = 0;

            for (GroovyExpression exp : assertions)
            {
                i++

                try
                {
                    Map assertionOutput = new LinkedHashMap<>(output)
                    RuleInfo ruleInfo = new RuleInfo()
                    assertionOutput[(NCube.RULE_EXEC_INFO)] = ruleInfo
                    args.output = assertionOutput
                    if (!NCube.isTrue(exp.execute(args)))
                    {
                        errors.add('[assertion ' + i + ' failed]: ' + exp.getCmd())
                        success = false
                    }
                }
                catch (Exception e)
                {
                    errors.add('[exception]')
                    errors.add('\n')
                    errors.add(getCauses(e))
                    success = false
                }
            }

            ruleInfoMain.setAssertionFailures(errors)
            ['_message': new TestResultsFormatter(output).format(),
             '_result' : success]
        }
        catch(Exception e)
        {
            fail(e)
            ThreadAwarePrintStream.getContent()
            ThreadAwarePrintStreamErr.getContent()
            return null
        }
    }

    Object[] getTests(ApplicationID appId, String cubeName)
    {
        try
        {
            appId = addTenant(appId)
            if (!isAllowed(appId, cubeName, null))
            {
                return null
            }
            String s = nCubeService.getTestData(appId, cubeName)
            if (StringUtilities.isEmpty(s))
            {
                return null
            }
            return NCubeTestReader.convert(s).toArray()
        }
        catch (Exception e)
        {
            fail(e)
            return null
        }
    }

    void saveTests(ApplicationID appId, String cubeName, Object[] tests)
    {
        try
        {
            appId = addTenant(appId)
            if (!isAllowed(appId, cubeName, Delta.Type.UPDATE))
            {
                return
            }
            String data = new NCubeTestWriter().format(tests)
            nCubeService.updateTestData(appId, cubeName, data)
        }
        catch (Exception e)
        {
            fail(e)
        }
    }

    /**
     * In-place update of a cell.  'Value' is the final (converted) object type to be stored
     * in the indicated (by colIds) cell.
     */
    Object[] generateTests(ApplicationID appId, String cubeName)
    {
        try
        {
            appId = addTenant(appId)
            if (!isAllowed(appId, cubeName, Delta.Type.UPDATE))
            {
                return null
            }
            NCube ncube = nCubeService.getCube(appId, cubeName)
            Object[] list = ncube.generateNCubeTests().toArray()
            nCubeService.updateTestData(appId, cubeName, new NCubeTestWriter().format(list))
            return list
        }
        catch (Exception e)
        {
            fail(e)
            return null
        }
    }

    /**
     * In-place update of a cell.  'Value' is the final (converted) object type to be stored
     * in the indicated (by colIds) cell.
     */
    NCubeTest createNewTest(ApplicationID appId, String cubeName, String testName)
    {
        try
        {
            appId = addTenant(appId)
            if (!isAllowed(appId, cubeName, Delta.Type.ADD))
            {
                return null
            }

            NCube ncube = nCubeService.getCube(appId, cubeName)

            if (StringUtilities.isEmpty(testName))
            {
                throw new IllegalArgumentException("Test name cannot be empty, cube: " + cubeName + ", app: " + appId)
            }

            Set<String> items = ncube.getRequiredScope()
            int size = items == null ? 0 : items.size()

            StringValuePair<CellInfo>[] coords = new StringValuePair[size]
            if (size > 0)
            {
                int i = 0;
                for (String s : items)
                {
                    coords[i++] = new StringValuePair(s, null)
                }
            }

            CellInfo[] assertions = [ new CellInfo("exp", "output.return", false, false) ] as CellInfo[]
            NCubeTest test = new NCubeTest(testName, coords, assertions)
            return test
        }
        catch (Exception e)
        {
            fail(e)
            return null
        }
    }

    /**
     * In-place update of a cell.
     */
    boolean updateCell(ApplicationID appId, String cubeName, Object[] ids, CellInfo cellInfo)
    {
        try
        {
            appId = addTenant(appId)
            if (!isAllowed(appId, cubeName, Delta.Type.UPDATE))
            {
                return false
            }

            NCube ncube = nCubeService.getCube(appId, cubeName)
            Set<Long> colIds = getCoordinate(ids)

            if (cellInfo == null)
            {
                ncube.removeCellById(colIds)
            }
            else
            {
                Object cellValue = cellInfo.isUrl ?
                        CellInfo.parseJsonValue(null, cellInfo.value, cellInfo.dataType, cellInfo.isCached) :
                        CellInfo.parseJsonValue(cellInfo.value, null, cellInfo.dataType, cellInfo.isCached)
                ncube.setCellById(cellValue, colIds)
            }
            nCubeService.updateNCube(ncube, getUserForDatabase())
            return true
        }
        catch(Exception e)
        {
            fail(e)
            return false
        }
    }

    Object getCellNoExecute(ApplicationID appId, String cubeName, Object[] ids)
    {
        try
        {
            appId = addTenant(appId)
            if (!isAllowed(appId, cubeName, null))
            {
                return null
            }
            NCube ncube = nCubeService.getCube(appId, cubeName)
            Set<Long> colIds = getCoordinate(ids)
            Object cell = ncube.getCellByIdNoExecute(colIds)
            CellInfo cellInfo = new CellInfo(cell)
            cellInfo.collapseToUiSupportedTypes()
            return cellInfo
        }
        catch (Exception e)
        {
            fail(e)
            return null
        }
    }

    boolean clearCells(ApplicationID appId, String cubeName, Object[] ids)
    {
        try
        {
            appId = addTenant(appId)
            if (!isAllowed(appId, cubeName, Delta.Type.UPDATE))
            {
                return false
            }

            if (ids == null || ids.length == 0)
            {
                markRequestFailed("No IDs of cells to cut/clear were given.")
                return false
            }

            NCube ncube = nCubeService.getCube(appId, cubeName)

            for (Object id : ids)
            {
                Object[] cellId = (Object[]) id;
                if (ArrayUtilities.isEmpty(cellId))
                {
                    continue;
                }
                Set<Long> colIds = getCoordinate(cellId)
                ncube.removeCellById(colIds)
            }
            nCubeService.updateNCube(ncube, getUserForDatabase())
            return true
        }
        catch (Exception e)
        {
            fail(e)
            return false
        }
    }

    boolean pasteCells(ApplicationID appId, String cubeName, Object[] values, Object[] coords)
    {
        try
        {
            if (!isAllowed(appId, cubeName, Delta.Type.UPDATE))
            {
                return false
            }

            if (values == null || values.length == 0 || coords == null || coords.length == 0)
            {
                markRequestFailed("Values and coordinates must not be empty or length of 0.")
                return false
            }

            NCube ncube = nCubeService.getCube(appId, cubeName)
            if (ncube == null)
            {
                markRequestFailed("Cube: " + cubeName + " not found for app: " + appId)
                return false
            }
            for (int i=0; i < coords.length; i++)
            {
                Object[] row = (Object[]) coords[i]
                if (ArrayUtilities.isEmpty(row))
                {
                    break
                }

                for (int j=0; j < row.length; j++)
                {
                    Object[] ids = (Object[]) row[j]
                    Set<Long> cellId = getCoordinate(ids)
                    Object value = convertStringToValue(getValueRepeatIfNecessary(values, i, j))
                    if (value == null)
                    {
                        ncube.removeCellById(cellId)
                    }
                    else
                    {
                        ncube.setCellById(value, cellId)
                    }
                }
            }
            nCubeService.updateNCube(ncube, getUserForDatabase())
            return true
        }
        catch (Exception e)
        {
            fail(e)
            return false
        }
    }

    String resolveRelativeUrl(ApplicationID appId, String relativeUrl)
    {
        try
        {
            appId = addTenant(appId)
            if (!isAllowed(appId, null, null))
            {
                return null
            }
            String absUrl = nCubeService.resolveRelativeUrl(appId, relativeUrl)
            return absUrl
        }
        catch (Exception e)
        {
            fail(e)
            return null
        }
    }

    void clearCache(ApplicationID appId)
    {
        try
        {
            appId = addTenant(appId)
            if (!isAllowed(appId, null, null))
            {
                return
            }
            nCubeService.clearCache(appId)
        }
        catch (Exception e)
        {
            fail(e)
        }
    }

    void createBranch(ApplicationID appId)
    {
        try
        {
            appId = addTenant(appId)
            if (!isAllowed(appId, null, Delta.Type.ADD))
            {
                return
            }
            nCubeService.createBranch(appId)
        }
        catch (Exception e)
        {
            fail(e)
        }
    }

    Object[] getBranches()
    {
        try
        {
            // TODO: Snag tenant based on authentication
            String tenant = "NONE";

            Set<String> branches = nCubeService.getBranches(tenant)
            if (branches == null && branches.isEmpty())
            {
                return [ApplicationID.HEAD] as Object[]
            }
            branches.remove(ApplicationID.HEAD);
            Object[] branchNames = branches.toArray()
            caseInsensitiveSort(branchNames)
            def head = ['HEAD'] as Object[]
            return head.plus(branchNames)
        }
        catch (Exception e)
        {
            fail(e)
            return null
        }
    }

    Object[] getBranchChanges(ApplicationID appId)
    {
        try
        {
            appId = addTenant(appId)
            if (!isAllowed(appId, null, null))
            {
                return null
            }
            List<NCubeInfoDto> branchChanges = nCubeService.getBranchChanges(appId)
            return branchChanges.toArray()
        }
        catch (Exception e)
        {
            fail(e)
            return null
        }
    }

    Object commitBranch(ApplicationID appId, Object[] infoDtos)
    {
        try
        {
            appId = addTenant(appId)
            if (!isAllowed(appId, null, Delta.Type.UPDATE))
            {
                return [] as Object[]
            }
            List<NCubeInfoDto> committedCubes = nCubeService.commitBranch(appId, infoDtos, getUserForDatabase())
            return committedCubes.toArray()
        }
        catch (BranchMergeException e)
        {
            markRequestFailed(e.getMessage())
            return e.getErrors()
        }
        catch (Exception e)
        {
            fail(e)
            return new HashMap()
        }
    }

    int rollbackBranch(ApplicationID appId, Object[] infoDtos)
    {
        try
        {
            appId = addTenant(appId)
            if (!isAllowed(appId, null, Delta.Type.UPDATE))
            {
                return 0
            }
            return nCubeService.rollbackBranch(appId, infoDtos)
        }
        catch (Exception e)
        {
            fail(e)
            return 0
        }
    }

    Object updateBranch(ApplicationID appId)
    {
        try
        {
            appId = addTenant(appId)
            if (!isAllowed(appId, null, null))
            {
                return null
            }
            List<NCubeInfoDto> updatedCubes = nCubeService.updateBranch(appId, getUserForDatabase())
            return updatedCubes.toArray()
        }
        catch (BranchMergeException e)
        {
            markRequestFailed(e.getMessage())
            return e.getErrors()
        }
        catch (Exception e)
        {
            fail(e)
            return null
        }
    }

    void deleteBranch(ApplicationID appId)
    {
        try
        {
            appId = addTenant(appId);
            if (!isAllowed(appId, null, Delta.Type.DELETE))
            {
                return;
            }
            nCubeService.deleteBranch(appId);
        }
        catch(Exception e)
        {
            fail(e)
        }
    }

    void acceptTheirs(ApplicationID appId, String cubeName, String branchSha1)
    {
        try
        {
            appId = addTenant(appId)
            if (!isAllowed(appId, cubeName, Delta.Type.UPDATE))
            {
                return
            }
            nCubeService.acceptTheirs(appId, cubeName, branchSha1, getUserForDatabase())
        }
        catch (Exception e)
        {
            fail(e)
        }
    }

    void acceptMine(ApplicationID appId, String cubeName, String headSha1)
    {
        try
        {
            appId = addTenant(appId)
            if (!isAllowed(appId, cubeName, Delta.Type.UPDATE))
            {
                return
            }
            nCubeService.acceptMine(appId, cubeName, headSha1, getUserForDatabase())
        }
        catch (Exception e)
        {
            fail(e)
        }
    }

    String getCubeRevisionAs(ApplicationID appId, String cubeName, long revision, String mode)
    {
        try
        {
            appId = addTenant(appId)
            if (!isAllowed(appId, cubeName, null))
            {
                return
            }
            NCube ncube = nCubeService.getCubeRevision(appId, cubeName, revision)

            switch(mode)
            {
                case "json":
                    return ncube.toFormattedJson()
                case "json-pretty":
                    return JsonWriter.formatJson(ncube.toFormattedJson())
                case "html":
                    return ncube.toHtml()
                default:
                    throw new IllegalArgumentException("getCubeRevisionAs() - unknown mode: " + mode);
            }
        }
        catch (Exception e)
        {
            fail(e)
        }
    }

    /**
     * @return Map of HTTP headers for debugging display.
     */
    Map getHeaders()
    {
        HttpServletRequest request = JsonCommandServlet.servletRequest.get()
        Enumeration e = request.headerNames
        Map<String, String> headers = [:]

        while (e.hasMoreElements())
        {
            String headerName = (String) e.nextElement()
            headers[(headerName)] = request.getHeader(headerName)
        }

        return headers
    }

    Map execute(ApplicationID appId, Map args, String command)
    {
        try
        {
            appId = addTenant(appId)
            int dot = command.indexOf('.')
            String controller = command.substring(0, dot)
            String method = command.substring(dot + 1)

            if (!isAllowed(appId, controller, null))
            {
                return null
            }
            Map coordinate = ['method' : method, 'service': nCubeService]
            coordinate.putAll(args);
            NCube cube = nCubeService.getCube(appId, controller)
            Map output = [:]
            cube.getCell(coordinate, output)    // return value is set on 'return' key of output Map
            output.remove('_rule')  // remove execution meta information (too big to send - add special API if needed)
            return output
        }
        catch (Exception e)
        {
            fail(e)
            return null
        }
    }

    Map getMenu(ApplicationID appId)
    {
        try
        {
            appId = addTenant(appId)

            if (!isAllowed(appId, 'sys.menu', null))
            {
                return null
            }
            NCube menuCube = nCubeService.getCube(appId, 'sys.menu')
            return menuCube.getCell([:])
        }
        catch (Exception e)
        {
            LOG.info("Unable to load sys.menu (sys.menu cube likely not in appId: " + appId.toString() + ", exception: " + e.getMessage())
            return ['~Title':'Title Goes Here',
                    'n-cube':[html:'html/ncube.html'],
                    JSON:[html:'html/jsonEditor.html'],
                    Details:[html:'html/details.html'],
                    Test:[html:'html/test.html']
            ]
        }
    }

    Object getDefaultCell(ApplicationID appId, String cubeName)
    {
        try
        {
            appId = addTenant(appId)

            if (!isAllowed(appId, cubeName, null))
            {
                return null
            }
            NCube menuCube = nCubeService.getCube(appId, cubeName)
            CellInfo cellInfo = new CellInfo(menuCube.getDefaultCellValue())
            cellInfo.collapseToUiSupportedTypes()
            return cellInfo
        }
        catch (Exception e)
        {
            fail(e)
            return null
        }
    }

    boolean clearDefaultCell(ApplicationID appId, String cubeName)
    {
        try
        {
            appId = addTenant(appId)

            if (!isAllowed(appId, cubeName, Delta.Type.UPDATE))
            {
                return false
            }
            NCube ncube = nCubeService.getCube(appId, cubeName)
            ncube.setDefaultCellValue(null)
            nCubeService.updateNCube(ncube, getUserForDatabase())
            return true
        }
        catch (Exception e)
        {
            fail(e)
            return false
        }
    }

    boolean updateDefaultCell(ApplicationID appId, String cubeName, CellInfo cellInfo)
    {
        try
        {
            appId = addTenant(appId)

            if (!isAllowed(appId, cubeName, Delta.Type.UPDATE))
            {
                return false
            }

            Object cellValue = cellInfo.isUrl ?
                    CellInfo.parseJsonValue(null, cellInfo.value, cellInfo.dataType, cellInfo.isCached) :
                    CellInfo.parseJsonValue(cellInfo.value, null, cellInfo.dataType, cellInfo.isCached)

            NCube ncube = nCubeService.getCube(appId, cubeName)
            ncube.setDefaultCellValue(cellValue)
            nCubeService.updateNCube(ncube, getUserForDatabase())
            return true
        }
        catch (Exception e)
        {
            fail(e)
            return false
        }
    }

    // ============================================= End API ===========================================================

    // ===================================== utility (non-API) methods =================================================

    private static void markRequestFailed(Object data)
    {
        JsonCommandServlet.servletRequest.get().setAttribute(JsonCommandServlet.ATTRIBUTE_STATUS, false)
        JsonCommandServlet.servletRequest.get().setAttribute(JsonCommandServlet.ATTRIBUTE_FAIL_MESSAGE, data)
    }

    /**
     * Indicate to the Ajax servlet (JsonCommandServlet) that the 'status' field should
     * be set to 'false', and then set the 'data' field to the String of exception
     * text.
     * @param e Exception that occurred when calling the service.
     */
    private static void fail(Exception e)
    {
        markRequestFailed(getCauses(e))
        LOG.warn("error occurred", e)
    }

    private static String getCauses(Throwable t)
    {
        StringBuilder s = new StringBuilder()
        while (t != null)
        {
            if (t.message == null)
            {
                s.append(t.toString())
            }
            else
            {
                s.append(t.message)
            }
            t = t.cause
            if (t != null)
            {
                s.append("<hr class=\"hr-small\"/>")
            }
        }

        return s.toString()
    }

    private static String getValueRepeatIfNecessary(Object[] values, int row, int col)
    {
        if (row > (values.length - 1))
        {
            row %= values.length
        }
        Object[] valueRow = (Object[]) values[row]
        if (ArrayUtilities.isEmpty(valueRow))
        {
            return null
        }
        if (col > (valueRow.length - 1))
        {
            col %= valueRow.length
        }
        return (String) valueRow[col]
    }

    private static Object convertStringToValue(String origValue)
    {
        if (origValue == null || StringUtilities.isEmpty(origValue))
        {
            return null
        }

        String value = origValue.trim()
        if (StringUtilities.isEmpty(value))
        {
            return null
        }

        if ("0".equals(value))
        {
            return 0L
        }
        else if ("true".equalsIgnoreCase(value))
        {
            return true
        }
        else if ("false".equalsIgnoreCase(value))
        {
            return false
        }

        if (isNumeric(value))
        {
            value = removeCommas(value)
            if (!value.contains("."))
            {
                try
                {
                    return Long.parseLong(value)
                }
                catch (Exception ignored) { }
            }

            try
            {
                return new BigDecimal(value)
            }
            catch (Exception ignored) { }
        }

        // Try as a date (the code below supports numerous different date formats)
        try
        {
            return DateUtilities.parseDate(value)
        }
        catch (Exception ignored) { }

        // OK, if all else fails, return it as the string it was
        return origValue
    }

    /**
     * Convert Axis to Map of Map representation (using json-io) and modify the
     * column ID to a String in the process.  This allows the column ID to work on
     * clients (like Javascript) that cannot support 64-bit values.
     */
    static Map convertAxis(Axis axis) throws IOException
    {
        String json = JsonWriter.objectToJson(axis)
        Map axisConverted = JsonReader.jsonToMaps(json)
        Map cols = (Map) axisConverted.columns
        Object[] items = (Object[]) cols["@items"]
        if (items != null)
        {
            for (Object item : items)
            {
                Map col = (Map) item
                Column actualCol= axis.getColumnById((Long)col.id)
                col.id = String.valueOf(col.id)
                String value = new CellInfo(actualCol.getValue()).value

                if (axis.valueType == AxisValueType.DATE)
                {
                    value = NO_QUOTES_REGEX.matcher(value).replaceAll("")
                }
                col.value = value
            }
        }
        return axisConverted
    }

    public static boolean isNumeric(String str)
    {
        return IS_NUMBER_REGEX.matcher(str).matches()  // match a number with optional '-' and decimal.
    }

    private static String removeCommas(String str)
    {
        StringBuilder s = new StringBuilder()
        final int len = str.length()
        for (int i=0; i < len; i++)
        {
            char x = str.charAt(i)
            if (x != ',')
            {
                s.append(x)
            }
        }
        return s.toString()
    }

    private static Set<Long> getCoordinate(Object[] ids)
    {
        // 3. Locate columns on each axis
        Set<Long> colIds = new HashSet<>()
        for (Object id : ids)
        {
            colIds.add(Long.parseLong((String)id))
        }
        return colIds;
    }

    private ApplicationID addTenant(ApplicationID appId)
    {
        String tenant = getTenant()
        return new ApplicationID(tenant, appId.app, appId.version, appId.status, appId.branch)
    }

    private String getTenant()
    {
        return ApplicationID.DEFAULT_TENANT
    }

    private static Object[] caseInsensitiveSort(Object[] items)
    {
        Arrays.sort(items, new Comparator<Object>() {
            public int compare(Object o1, Object o2)
            {
                ((String) o1)?.toLowerCase() <=> ((String) o2)?.toLowerCase()
            }
        })
        return items
    }
}
