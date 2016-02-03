package com.cedarsoftware.controller

import com.cedarsoftware.ncube.ApplicationID
import com.cedarsoftware.ncube.Axis
import com.cedarsoftware.ncube.AxisType
import com.cedarsoftware.ncube.AxisValueType
import com.cedarsoftware.ncube.CellInfo
import com.cedarsoftware.ncube.Column
import com.cedarsoftware.ncube.CommandCell
import com.cedarsoftware.ncube.Delta
import com.cedarsoftware.ncube.DeltaProcessor
import com.cedarsoftware.ncube.GroovyExpression
import com.cedarsoftware.ncube.NCube
import com.cedarsoftware.ncube.NCubeInfoDto
import com.cedarsoftware.ncube.NCubeManager
import com.cedarsoftware.ncube.NCubeTest
import com.cedarsoftware.ncube.RuleInfo
import com.cedarsoftware.ncube.StringValuePair
import com.cedarsoftware.ncube.exception.AxisOverlapException
import com.cedarsoftware.ncube.exception.BranchMergeException
import com.cedarsoftware.ncube.exception.CommandCellException
import com.cedarsoftware.ncube.exception.CoordinateNotFoundException
import com.cedarsoftware.ncube.exception.RuleJump
import com.cedarsoftware.ncube.exception.RuleStop
import com.cedarsoftware.ncube.formatters.NCubeTestReader
import com.cedarsoftware.ncube.formatters.NCubeTestWriter
import com.cedarsoftware.ncube.formatters.TestResultsFormatter
import com.cedarsoftware.service.ncube.NCubeService
import com.cedarsoftware.servlet.JsonCommandServlet
import com.cedarsoftware.util.ArrayUtilities
import com.cedarsoftware.util.CaseInsensitiveSet
import com.cedarsoftware.util.Converter
import com.cedarsoftware.util.InetAddressUtilities
import com.cedarsoftware.util.StringUtilities
import com.cedarsoftware.util.ThreadAwarePrintStream
import com.cedarsoftware.util.ThreadAwarePrintStreamErr
import com.cedarsoftware.util.io.JsonReader
import com.cedarsoftware.util.io.JsonWriter
import com.googlecode.concurrentlinkedhashmap.ConcurrentLinkedHashMap
import groovy.transform.CompileStatic
import org.apache.logging.log4j.LogManager
import org.apache.logging.log4j.Logger

import javax.management.MBeanServer
import javax.management.ObjectName
import javax.servlet.http.HttpServletRequest
import java.lang.management.ManagementFactory
import java.util.concurrent.ConcurrentMap
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
    private static final Logger LOG = LogManager.getLogger(NCubeController.class)
    private static final Pattern VERSION_REGEX = ~/[.]/
    private static final Pattern IS_NUMBER_REGEX = ~/^[\d,.e+-]+$/
    private static final Pattern NO_QUOTES_REGEX = ~/"/
    private NCubeService nCubeService;
    private static String servletHostname = null
    private static String inetHostname = null

    // Bind to ConcurrentLinkedHashMap because some plugins will need it.
    private ConcurrentMap<String, Object> futureCache = new ConcurrentLinkedHashMap.Builder<String, Object>()
            .maximumWeightedCapacity(100)
            .build()

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
        String action = operation != null ? operation.toString() : 'read'
        if (false)
        {   // permissions checks
            String msg = 'You do not have ' + action + ' access'
            if (StringUtilities.hasContent(cubeName) && appId != null)
            {
                msg += ' to ' + appId.cacheKey(cubeName)
            }
            else
            {
                if (appId)
                {
                    msg += ' to ' + appId
                }
                else if (cubeName)
                {
                    msg += ' to ' + cubeName
                }
                else
                {
                    msg += '.'
                }
            }
            markRequestFailed(msg)
            throw new SecurityException(msg)
        }

        return true
    }

    // ============================================= Begin API =========================================================

    Object[] search(ApplicationID appId, String cubeNamePattern, String content, boolean active)
    {
        try
        {
            appId = addTenant(appId)
            isAllowed(appId, cubeNamePattern, null)
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

    void restoreCubes(ApplicationID appId, Object[] cubeNames)
    {
        try
        {
            appId = addTenant(appId)
            isAllowed(appId, null, Delta.Type.ADD)
            nCubeService.restoreCubes(appId, cubeNames, getUserForDatabase())
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
            isAllowed(appId, cubeName, null)
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
            isAllowed(appId, cubeName, null)
            NCube ncube = nCubeService.loadCube(appId, cubeName)
            // The Strings below are hints to n-cube to tell it which axis to place on top
            String html = toHtmlWithColumnHints(ncube)
            return html
        }
        catch (Exception e)
        {
            fail(e)
            return null
        }
    }

    private String toHtmlWithColumnHints(NCube ncube)
    {
        ncube.toHtml('trait', 'traits', 'businessDivisionCode', 'bu', 'month', 'months', 'col', 'column', 'cols', 'columns')
    }

    String getJson(ApplicationID appId, String cubeName)
    {
        return getJson(appId, cubeName, [mode:"json-index"])
    }

    String getJson(ApplicationID appId, String cubeName, Map options)
    {
        try
        {
            appId = addTenant(appId)
            isAllowed(appId, cubeName, null)
            NCube ncube = nCubeService.loadCube(appId, cubeName)
            String mode = options.mode
            switch(mode)
            {
                case "json":
                    return ncube.toFormattedJson()
                case "json-pretty":
                    return JsonWriter.formatJson(ncube.toFormattedJson())
                case "json-index":
                    return ncube.toFormattedJson([indexFormat:true] as Map)
                case "json-index-pretty":
                    return JsonWriter.formatJson(ncube.toFormattedJson([indexFormat:true] as Map))
                case "html":
                    return ncube.toHtml()
                default:
                    throw new IllegalArgumentException("getJson() - unknown mode: " + mode)
            }
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
            // TODO: Filter APP names
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
            String tenant = getTenant()
            ApplicationID.validateTenant(tenant)
            ApplicationID.validateApp(app)
            ApplicationID.validateStatus(status)
            ApplicationID.validateBranch(branchName)
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
            isAllowed(appId, cubeName, Delta.Type.ADD)

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
    boolean deleteCubes(ApplicationID appId, Object[] cubeNames)
    {
        try
        {
            if (ArrayUtilities.isEmpty(cubeNames))
            {
                throw new IllegalArgumentException('Must send at least one cube name')
            }
            appId = addTenant(appId)
            for (int i=0; i < cubeNames.length; i++)
            {
                isAllowed(appId, (String)cubeNames[i], Delta.Type.DELETE)
            }

            if (!nCubeService.deleteCubes(appId, cubeNames, getUserForDatabase()))
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
     * Find all references from (out going) an n-cube.
     * @return Object[] of String cube names that the passed in (named) cube references,
     * otherwise a String error message.
     */
    Object[] getReferencesFrom(ApplicationID appId, String cubeName)
    {
        try
        {
            appId = addTenant(appId)
            isAllowed(appId, cubeName, null)
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
            isAllowed(appId, cubeName, null)

            NCube ncube = nCubeService.getCube(appId, cubeName)
            Set<String> refs = ncube.getRequiredScope([:], [:])
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
            isAllowed(appId, cubeName, null)
            isAllowed(destAppId, newName, Delta.Type.ADD)
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
            isAllowed(appId, null, Delta.Type.UPDATE)
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
            isAllowed(appId, null, Delta.Type.UPDATE)
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
            isAllowed(appId, cubeName, Delta.Type.ADD)
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
            isAllowed(appId, cubeName, null)
            NCube ncube = nCubeService.loadCube(appId, cubeName)
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
            isAllowed(appId, cubeName, Delta.Type.DELETE)
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
            isAllowed(appId, cubeName, Delta.Type.UPDATE)
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
    void updateAxisColumns(ApplicationID appId, String cubeName, String axisName, Object[] cols)
    {
        try
        {
            appId = addTenant(appId)
            isAllowed(appId, cubeName, Delta.Type.UPDATE)
            Set<Column> columns = new LinkedHashSet<>()

            if (cols != null)
            {
                cols.each {
                    Column column ->
                        Object value = column.value
                        if (value == null || "".equals(value))
                        {
                            throw new IllegalArgumentException('Column cannot have empty value, n-cube: ' + cubeName + ', axis: ' + axisName)
                        }
                        columns.add(column)
                }
            }

            NCube ncube = nCubeService.loadCube(appId, cubeName)
            ncube.updateColumns(axisName, columns)
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
            isAllowed(appId, oldName, Delta.Type.UPDATE)
            nCubeService.renameCube(appId, oldName, newName, getUserForDatabase())
        }
        catch(Exception e)
        {
            fail(e)
        }
    }

    void promoteRevision(ApplicationID appId, long cubeId)
    {
        try
        {
            appId = addTenant(appId)

            NCube ncube = nCubeService.loadCubeById(cubeId)

            isAllowed(appId, ncube.getName(), Delta.Type.UPDATE)
            saveJson(appId, ncube.getName(), ncube.toFormattedJson())
        }
        catch (Exception e)
        {
            fail(e);
        }
    }

    void saveJson(ApplicationID appId, String cubeName, String json)
    {
        try
        {
            appId = addTenant(appId)
            isAllowed(appId, cubeName, Delta.Type.UPDATE)
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
            isAllowed(appId, cubeName, null)
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
                    errors.add(getTestCauses(e))
                    success = false
                }
            }

            ruleInfoMain.setAssertionFailures(errors)
            return ['_message': new TestResultsFormatter(output).format(), '_result' : success]
        }
        catch(Exception e)
        {
            markRequestFailed(getTestCauses(e))
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
            isAllowed(appId, cubeName, null)
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
            isAllowed(appId, cubeName, Delta.Type.UPDATE)
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
            isAllowed(appId, cubeName, Delta.Type.UPDATE)
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
            isAllowed(appId, cubeName, Delta.Type.ADD)

            NCube ncube = nCubeService.getCube(appId, cubeName)

            if (StringUtilities.isEmpty(testName))
            {
                throw new IllegalArgumentException("Test name cannot be empty, cube: " + cubeName + ", app: " + appId)
            }

            Set<String> items = ncube.getRequiredScope([:], [:])
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
            isAllowed(appId, cubeName, Delta.Type.UPDATE)

            NCube ncube = nCubeService.getCube(appId, cubeName)
            Set<Long> colIds = getCoordinate(ids)

            if (cellInfo == null)
            {
                ncube.removeCellById(colIds)
            }
            else
            {
                ncube.setCellById(cellInfo.recreate(), colIds)
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
            isAllowed(appId, cubeName, null)
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

    Map getCellCoordinate(ApplicationID appId, String cubeName, Object[] ids)
    {
        try
        {
            appId = addTenant(appId)
            isAllowed(appId, cubeName, null)
            NCube ncube = nCubeService.getCube(appId, cubeName)
            Set<Long> colIds = getCoordinate(ids)
            Map<String, Comparable> coord = ncube.getDisplayCoordinateFromIds(colIds)
            Map<String, Comparable> niceCoord = [:]
            coord.each {
                k, v ->
                    niceCoord[k] = CellInfo.formatForDisplay(v)
            }
            return niceCoord
        }
        catch (Exception e)
        {
            fail(e)
            return null
        }
    }

    String copyCells(ApplicationID appId, String cubeName, Object[] ids, boolean isCut)
    {
        try
        {
            appId = addTenant(appId)
            isAllowed(appId, cubeName, isCut ? Delta.Type.UPDATE : null)

            if (ids == null || ids.length == 0)
            {
                markRequestFailed("No IDs of cells to cut/clear were given.")
                return null
            }

            NCube ncube = nCubeService.loadCube(appId, cubeName)
            List<Object[]> cells = new ArrayList<>()

            for (Object id : ids)
            {
                Object[] cellId = (Object[]) id;
                if (ArrayUtilities.isEmpty(cellId))
                {
                    cells.add(null)
                    continue;
                }
                Set<Long> colIds = getCoordinate(cellId)
                Object content = ncube.getCellByIdNoExecute(colIds)
                CellInfo cellInfo = new CellInfo(content)
                cells.add([cellInfo.value, cellInfo.dataType, cellInfo.isUrl, cellInfo.isCached] as Object[])

                if (isCut)
                {
                    ncube.removeCellById(colIds)
                }
            }

            nCubeService.updateNCube(ncube, getUserForDatabase())
            return JsonWriter.objectToJson(cells.toArray())
        }
        catch (Exception e)
        {
            fail(e)
            return null
        }
    }

    boolean pasteCellsNce(ApplicationID appId, String cubeName, Object[] clipboard)
    {
        try
        {
            isAllowed(appId, cubeName, Delta.Type.UPDATE)
            if (ArrayUtilities.isEmpty(clipboard))
            {
                markRequestFailed("Could not paste cells, no data available on clipboard.")
                return false
            }

            NCube ncube = nCubeService.loadCube(appId, cubeName)
            if (ncube == null)
            {
                markRequestFailed("Could not paste cells, cube: " + cubeName + " not found for app: " + appId)
                return false
            }

            int len = clipboard.length;
            for (int i=0; i < len; i++)
            {
                Object[] cell = clipboard[i] as Object[]
                if (ArrayUtilities.isEmpty(cell))
                {   // null is EOL marker
                    continue
                }

                Object lastElem = cell[cell.length - 1]

                if (lastElem instanceof Object[])
                {   // If last element is an Object[], we have a coordinate (destination cell)
                    Object[] ids = lastElem as Object[]
                    Set<Long> cellId = getCoordinate(ids)
                    CellInfo info = new CellInfo(cell[1] as String, cell[0] as String, cell[2], cell[3])
                    Object value = info.recreate()
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

    boolean pasteCells(ApplicationID appId, String cubeName, Object[] values, Object[] coords)
    {
        try
        {
            isAllowed(appId, cubeName, Delta.Type.UPDATE)

            if (values == null || values.length == 0 || coords == null || coords.length == 0)
            {
                markRequestFailed("Could not paste cells, values and coordinates must not be empty or length of 0.")
                return false
            }

            NCube ncube = nCubeService.loadCube(appId, cubeName)
            if (ncube == null)
            {
                markRequestFailed("Could not paste cells, cube: " + cubeName + " not found for app: " + appId)
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
            isAllowed(appId, null, null)
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
            isAllowed(appId, null, null)
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
            isAllowed(appId, null, Delta.Type.ADD)
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
            branches.remove(ApplicationID.HEAD)
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
            isAllowed(appId, null, null)
            List<NCubeInfoDto> branchChanges = nCubeService.getBranchChanges(appId)
            return branchChanges.toArray()
        }
        catch (Exception e)
        {
            fail(e)
            return null
        }
    }

    Object commitCube(ApplicationID appId, String cubeName)
    {
        try
        {
            appId = addTenant(appId)
            isAllowed(appId, cubeName, Delta.Type.UPDATE)
            Object[] infoDtos = search(appId, cubeName, null, true);
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
            return [:]
        }
    }

    Object commitBranch(ApplicationID appId, Object[] infoDtos)
    {
        try
        {
            appId = addTenant(appId)
            isAllowed(appId, null, Delta.Type.UPDATE)
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
            return [:]
        }
    }

    int rollbackBranch(ApplicationID appId, Object[] cubeNames)
    {
        try
        {
            appId = addTenant(appId)
            isAllowed(appId, null, Delta.Type.UPDATE)
            return nCubeService.rollbackCubes(appId, cubeNames, getUserForDatabase())
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
            isAllowed(appId, null, Delta.Type.UPDATE)
            Map<String, Object> result = nCubeService.updateBranch(appId, getUserForDatabase())
            return result
        }
        catch (Exception e)
        {
            fail(e)
            return null
        }
    }

    Object updateBranchCube(ApplicationID appId, String cubeName, String sourceBranch)
    {
        try
        {
            appId = addTenant(appId)
            isAllowed(appId, cubeName, Delta.Type.UPDATE)
            Map<String, Object> result = nCubeService.updateBranchCube(appId, cubeName, sourceBranch, getUserForDatabase())
            return result
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
            appId = addTenant(appId)
            isAllowed(appId, null, Delta.Type.DELETE)
            nCubeService.deleteBranch(appId)
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
            isAllowed(appId, cubeName, Delta.Type.UPDATE)
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
            isAllowed(appId, cubeName, Delta.Type.UPDATE)
            nCubeService.acceptMine(appId, cubeName, getUserForDatabase())
        }
        catch (Exception e)
        {
            fail(e)
        }
    }

    String loadCubeById(ApplicationID appId, long id, String mode)
    {
        try
        {
            appId = addTenant(appId)
            isAllowed(appId, null, null)

            NCube ncube = nCubeService.loadCubeById(id)

            switch(mode)
            {
                case "json":
                    return ncube.toFormattedJson()
                case "json-pretty":
                    return JsonWriter.formatJson(ncube.toFormattedJson())
                case "json-index":
                    return ncube.toFormattedJson([indexFormat:true] as Map)
                case "json-index-pretty":
                    return JsonWriter.formatJson(ncube.toFormattedJson([indexFormat:true] as Map))
                case "html":
                    return ncube.toHtml()
                default:
                    throw new IllegalArgumentException("loadCubeById() - unknown mode: " + mode)
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
            isAllowed(appId, controller, null)

            Map coordinate = ['method' : method, 'service': nCubeService]
            coordinate.putAll(args)
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
            isAllowed(appId, 'sys.menu', null)
            NCube menuCube = nCubeService.getCube(appId, 'sys.menu')
            return menuCube.getCell([:])
        }
        catch (SecurityException e)
        {
            return null
        }
        catch (Exception e)
        {
            LOG.info("Unable to load sys.menu (sys.menu cube likely not in appId: " + appId.toString() + ", exception: " + e.getMessage(), e)
            return ['~Title':'Configuration Editor',
                    'n-cube':[html:'html/ntwobe.html',img:'img/letter-n.png'],
                    'n-cube-old':[html:'html/ncube.html',img:'img/letter-o.png'],
                    'JSON':[html:'html/jsonEditor.html',img:'img/letter-j.png'],
                    'Details':[html:'html/details.html',img:'img/letter-d.png'],
                    'Test':[html:'html/test.html',img:'img/letter-t.png']
            ]
        }
    }

    Object getDefaultCell(ApplicationID appId, String cubeName)
    {
        try
        {
            appId = addTenant(appId)
            isAllowed(appId, cubeName, null)

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
            isAllowed(appId, cubeName, Delta.Type.UPDATE)
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
            isAllowed(appId, cubeName, Delta.Type.UPDATE)

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

    Map<String, Object> fetchRevDiffs(long cubeId1, long cubeId2)
    {
        try
        {
            Map<String, Object> ret = [left:[''], right:[''], leftHtml: '', rightHtml: '', delta:'']
            NCube leftCube = null
            try
            {
                leftCube = nCubeService.loadCubeById(cubeId1)
                ApplicationID appId = leftCube.getApplicationID()
                appId = addTenant(appId)
                isAllowed(appId, leftCube.name, null)
                ret.left = jsonToLines(leftCube.toFormattedJson())
                ret.leftHtml = toHtmlWithColumnHints(leftCube)
            }
            catch (Exception ignored) { }

            NCube rightCube = null
            try
            {
                rightCube = nCubeService.loadCubeById(cubeId2)
                ApplicationID appId = rightCube.getApplicationID()
                appId = addTenant(appId)
                isAllowed(appId, rightCube.name, null)
                ret.right = jsonToLines(rightCube.toFormattedJson())
                ret.rightHtml = toHtmlWithColumnHints(rightCube)
            }
            catch (Exception ignored) { }

            return addDeltaDescription(leftCube, rightCube, ret)
        }
        catch (Exception e)
        {
            fail(e)
            return null
        }
    }

    Map<String, Object> fetchBranchDiffs(NCubeInfoDto leftInfoDto, NCubeInfoDto rightInfoDto)
    {
        try
        {
            leftInfoDto.tenant = getTenant()
            rightInfoDto.tenant = getTenant()
            ApplicationID leftAppId = leftInfoDto.applicationID
            isAllowed(leftAppId, leftInfoDto.name, null)
            ApplicationID rightAppId = rightInfoDto.applicationID
            isAllowed(rightAppId, rightInfoDto.name, null)

            Map<String, Object> ret = [left:[''], right:[''], leftHtml: '', rightHtml: '', delta:'']
            NCube leftCube = null
            try
            {
                leftCube = nCubeService.loadCube(leftAppId, leftInfoDto.name)
                ret.left = jsonToLines(leftCube.toFormattedJson())
                ret.leftHtml = toHtmlWithColumnHints(leftCube)
            }
            catch (Exception ignored) { }

            NCube rightCube = null
            try
            {
                rightCube = nCubeService.loadCube(rightAppId, rightInfoDto.name)
                ret.right = jsonToLines(rightCube.toFormattedJson())
                ret.rightHtml = toHtmlWithColumnHints(rightCube)
            }
            catch (Exception ignored) { }

            return addDeltaDescription(leftCube, rightCube, ret)
        }
        catch (Exception e)
        {
            fail(e)
            return null
        }
    }

    /**
     * Add the n-cube delta description between the two passed in cubes to the passed in Map.
     */
    private static LinkedHashMap<String, Object> addDeltaDescription(NCube leftCube, NCube rightCube, LinkedHashMap<String, Object> ret)
    {
        if (leftCube && rightCube)
        {
            List<Delta> delta = DeltaProcessor.getDeltaDescription(rightCube, leftCube)
            StringBuilder s = new StringBuilder()
            delta.each {
                Delta d ->
                    s.append(d.description)
                    s.append('\n')
            }
            ret.delta = s.toString()
        }
        return ret
    }

    List<String> jsonToLines(String json)
    {
        JsonWriter.formatJson(json).readLines()
    }

    Map heartBeat(Map openCubes)
    {
        // If remotely accessing server, use the following to get the MBeanServerConnection...
//        JMXServiceURL url = new JMXServiceURL("service:jmx:rmi:///jndi/rmi://localhost:/jmxrmi")
//        JMXConnector jmxc = JMXConnectorFactory.connect(url, null)
//
//        MBeanServerConnection conn = jmxc.getMBeanServerConnection()
//        String[] domains = conn.getDomains()
//        Set result = conn.queryMBeans(null, "Catalina:type=DataSource,path=/appdb,host=localhost,class=javax.sql.DataSource")
//        jmxc.close()

        Map results = [:]

        // Force session creation / update (only for statistics - we do NOT want to use a session - must...remain...stateless)
        JsonCommandServlet.servletRequest.get().getSession()

        // Snag the platform mbean server (singleton)
        MBeanServer mbs = ManagementFactory.getPlatformMBeanServer()

        // App server name and version
        Map serverStats = [:]
        putIfNotNull(serverStats, 'Server Info', getAttribute(mbs, 'Catalina:type=Server', 'serverInfo'))
        putIfNotNull(serverStats, 'JVM Route', getAttribute(mbs, 'Catalina:type=Engine', 'jvmRoute'))

        putIfNotNull(serverStats, 'hostname, servlet', getServletHostname())
        putIfNotNull(serverStats, 'hostname, OS', getInetHostname())
        putIfNotNull(serverStats, 'Context', JsonCommandServlet.servletRequest.get().getContextPath())
        putIfNotNull(serverStats, 'Sessions, active', getAttribute(mbs, 'Catalina:type=Manager,host=localhost,context=' + serverStats.Context, 'activeSessions'))
        putIfNotNull(serverStats, 'Sessions, peak', getAttribute(mbs, 'Catalina:type=Manager,host=localhost,context=' + serverStats.Context, 'maxActive'))

        Set<ObjectName> set = mbs.queryNames(new ObjectName('Catalina:type=ThreadPool,name=*'), null)
        Set<String> connectors = [] as LinkedHashSet
        set.each {
            ObjectName objName ->
                connectors << objName.getKeyProperty('name')
        }

        for (String conn : connectors)
        {
            String cleanKey = cleanKey(conn)
            putIfNotNull(serverStats, cleanKey + ' t-pool max', getAttribute(mbs, 'Catalina:type=ThreadPool,name=' + conn, 'maxThreads'))
            putIfNotNull(serverStats, cleanKey + ' t-pool cur', getAttribute(mbs, 'Catalina:type=ThreadPool,name=' + conn, 'currentThreadCount'))
            putIfNotNull(serverStats, cleanKey + ' busy thread', getAttribute(mbs, 'Catalina:type=ThreadPool,name=' + conn, 'currentThreadsBusy'))
            putIfNotNull(serverStats, cleanKey + ' max conn', getAttribute(mbs, 'Catalina:type=ThreadPool,name=' + conn, 'maxConnections'))
            putIfNotNull(serverStats, cleanKey + ' curr conn', getAttribute(mbs, 'Catalina:type=ThreadPool,name=' + conn, 'connectionCount'))
        }

        // OS
        putIfNotNull(serverStats, 'OS', getAttribute(mbs, 'java.lang:type=OperatingSystem', 'Name'))
        putIfNotNull(serverStats, 'OS version', getAttribute(mbs, 'java.lang:type=OperatingSystem', 'Version'))
        putIfNotNull(serverStats, 'CPU', getAttribute(mbs, 'java.lang:type=OperatingSystem', 'Arch'))
        putIfNotNull(serverStats, 'CPU Process Load', getAttribute(mbs, 'java.lang:type=OperatingSystem', 'ProcessCpuLoad'))
        putIfNotNull(serverStats, 'CPU System Load', getAttribute(mbs, 'java.lang:type=OperatingSystem', 'SystemCpuLoad'))
        putIfNotNull(serverStats, 'CPU Cores', getAttribute(mbs, 'java.lang:type=OperatingSystem', 'AvailableProcessors'))
        double machMem = (long) getAttribute(mbs, 'java.lang:type=OperatingSystem', 'TotalPhysicalMemorySize')
        long K = 1024L
        long MB = K * 1024L
        long GB = MB * 1024L
        machMem = machMem / GB
        putIfNotNull(serverStats, 'Physical Memory', (machMem.round(2)) + ' GB')

        // JVM
        putIfNotNull(serverStats, 'Java version', getAttribute(mbs, 'JMImplementation:type=MBeanServerDelegate', 'ImplementationVersion'))
        putIfNotNull(serverStats, 'Loaded class count', getAttribute(mbs, 'java.lang:type=ClassLoading', 'LoadedClassCount'))

        // JVM Memory
        Runtime rt = Runtime.getRuntime()
        double maxMem = rt.maxMemory() / MB
        double freeMem = rt.freeMemory() / MB
        double usedMem = maxMem - freeMem
        putIfNotNull(serverStats, 'Heap size (-Xmx)', (maxMem.round(1)) + ' MB')
        putIfNotNull(serverStats, 'Used memory', (usedMem.round(1)) + ' MB')
        putIfNotNull(serverStats, 'Free memory', (freeMem.round(1)) + ' MB')

        putIfNotNull(results, 'serverStats', serverStats)

        Map compareResults = [:]
        openCubes.each { key, nothing ->
            if (key != null)
            {
                String cubeId = key.toString()
                String[] pieces = cubeId.split('~')
                if (pieces != null && pieces.length > 4)
                {
                    ApplicationID appId = new ApplicationID("x", pieces[0], pieces[1], pieces[2], pieces[3])
                    appId = addTenant(appId)
                    String cubeName = pieces[4]
                    Object status = nCubeService.getUpToDateStatus(appId, cubeName)
                    putIfNotNull(compareResults, cubeId, status)
                }
            }
        }
        putIfNotNull(results, 'compareResults', compareResults)

        return results
    }

    // ============================================= End API ===========================================================

    // ===================================== utility (non-API) methods =================================================

    private static String cleanKey(String key)
    {
        return key.replace('"','')
    }

    private static void markRequestFailed(Object data)
    {
        JsonCommandServlet.servletRequest.get().setAttribute(JsonCommandServlet.ATTRIBUTE_STATUS, false)
        JsonCommandServlet.servletRequest.get().setAttribute(JsonCommandServlet.ATTRIBUTE_FAIL_MESSAGE, data)
    }

    private static Object getAttribute(MBeanServer mbs, String beanName, String attribute)
    {
        try
        {
            ObjectName objectName = new ObjectName(beanName)
            mbs.getAttribute(objectName, attribute)
        }
        catch (Exception ignored)
        {
//            LOG.info('Unable to fetch attribute: ' + attribute + ' from mbean: ' + beanName)
            null
        }
    }

    private static void putIfNotNull(Map map, String key, Object value)
    {
        if (value != null)
        {
            if (value instanceof Number)
            {
                value = value.longValue()
            }
            map[key] = value
        }
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
        if (e instanceof AxisOverlapException ||
            e instanceof BranchMergeException ||
            e instanceof CommandCellException ||
            e instanceof CoordinateNotFoundException ||
            e instanceof RuleJump ||
            e instanceof RuleStop)
        {
            Throwable t = e
            while (t.getCause() != null)
            {
                t = t.getCause()
            }
            String msg = t.message
            if (StringUtilities.isEmpty(msg))
            {
                msg = t.getClass().getName()
            }
            LOG.info('user runtime error: ' + msg)
        }
        else
        {
            LOG.warn("error occurred", e)
        }
    }

    private static String getTestCauses(Throwable t)
    {
        LinkedList<Map<String, Object>> stackTraces = new LinkedList<>()

        while (true)
        {
            stackTraces.push([msg: t.getLocalizedMessage(), trace: t.getStackTrace()])
            t = t.getCause()
            if (t == null)
            {
                break
            }
        }

        // Convert from LinkedList to direct access list
        List<Map<String, Object>> stacks = new ArrayList<>(stackTraces)
        StringBuilder s = new StringBuilder()
        int len = stacks.size()

        for (int i=0; i < len; i++)
        {
            Map<String, Object> map = stacks[i]
            s.append('<b style="color:darkred">')
            s.append(map.msg)
            s.append('</b><br>')

            if (i != len - 1)
            {
                Map nextStack = stacks[i + 1]
                StackTraceElement[] nextStackElementArray = (StackTraceElement[]) nextStack.trace
                s.append(trace(map.trace as StackTraceElement[], nextStackElementArray))
                s.append('<hr style="border-top: 1px solid #aaa;margin:8px"><b>Called by:</b><br>')
            }
            else
            {
                s.append(trace(map.trace as StackTraceElement[], null))
            }
        }

        return '<pre>' + s + '</pre>'
    }

    private static String trace(StackTraceElement[] stackTrace, StackTraceElement[] nextStrackTrace)
    {
        StringBuilder s = new StringBuilder()
        int len = stackTrace.length
        for (int i=0; i < len; i++)
        {
            s.append('&nbsp;&nbsp;')
            StackTraceElement element = stackTrace[i]
            if (alreadyExists(element, nextStrackTrace))
            {
                s.append('...continues below<br>')
                return s.toString()
            }
            else
            {
                s.append(element.className)
                s.append('.')
                s.append(element.methodName)
                s.append('()&nbsp;<small><b class="pull-right">')
                if (element.nativeMethod)
                {
                    s.append('Native Method')
                }
                else
                {
                    if (element.fileName)
                    {
                        s.append(element.fileName)
                        s.append(':')
                        s.append(element.lineNumber)
                    }
                    else
                    {
                        s.append('source n/a')
                    }
                }
                s.append('</b></small><br>')
            }
        }

        return s.toString()
    }

    private static boolean alreadyExists(StackTraceElement element, StackTraceElement[] stackTrace)
    {
        if (ArrayUtilities.isEmpty(stackTrace))
        {
            return false
        }

        for (StackTraceElement traceElement : stackTrace)
        {
            if (element.equals(traceElement))
            {
                return true
            }
        }
        return false
    }

//    private void printStackTrace(Throwable t, StringBuilder s) {
//        // Guard against malicious overrides of Throwable.equals by
//        // using a Set with identity equality semantics.
//        Set<Throwable> dejaVu = Collections.newSetFromMap(new IdentityHashMap<Throwable, Boolean>())
//        dejaVu.add(t)
//
//        synchronized (s) {
//            // Print our stack trace
//            s.println(this);
//            StackTraceElement[] trace = getOurStackTrace();
//            for (StackTraceElement traceElement : trace)
//                s.println("\tat " + traceElement);
//
//            // Print suppressed exceptions, if any
//            for (Throwable se : getSuppressed())
//                se.printEnclosedStackTrace(s, trace, SUPPRESSED_CAPTION, "\t", dejaVu);
//
//            // Print cause, if any
//            Throwable ourCause = getCause();
//            if (ourCause != null)
//                ourCause.printEnclosedStackTrace(s, trace, CAUSE_CAPTION, "", dejaVu);
//        }
//    }
//
//    /**
//     * Print our stack trace as an enclosed exception for the specified
//     * stack trace.
//     */
//    private void printEnclosedStackTrace(PrintStreamOrWriter s,
//                                         StackTraceElement[] enclosingTrace,
//                                         String caption,
//                                         String prefix,
//                                         Set<Throwable> dejaVu) {
//        assert Thread.holdsLock(s.lock());
//        if (dejaVu.contains(this)) {
//            s.println("\t[CIRCULAR REFERENCE:" + this + "]");
//        } else {
//            dejaVu.add(this);
//            // Compute number of frames in common between this and enclosing trace
//            StackTraceElement[] trace = getOurStackTrace();
//            int m = trace.length - 1;
//            int n = enclosingTrace.length - 1;
//            while (m >= 0 && n >=0 && trace[m].equals(enclosingTrace[n])) {
//                m--; n--;
//            }
//            int framesInCommon = trace.length - 1 - m;
//
//            // Print our stack trace
//            s.println(prefix + caption + this);
//            for (int i = 0; i <= m; i++)
//                s.println(prefix + "\tat " + trace[i]);
//            if (framesInCommon != 0)
//                s.println(prefix + "\t... " + framesInCommon + " more");
//
//            // Print suppressed exceptions, if any
//            for (Throwable se : getSuppressed())
//                se.printEnclosedStackTrace(s, trace, SUPPRESSED_CAPTION,
//                        prefix +"\t", dejaVu);
//
//            // Print cause, if any
//            Throwable ourCause = getCause();
//            if (ourCause != null)
//                ourCause.printEnclosedStackTrace(s, trace, CAUSE_CAPTION, prefix, dejaVu);
//        }
//    }

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
                s.append('<hr style="border-top: 1px solid #aaa;margin:8px">')
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
                    return Converter.convert(value, Long.class)
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
            return Converter.convert(value, Date.class)
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
        String json = JsonWriter.objectToJson(axis, [(JsonWriter.TYPE): false] as Map)
        Map axisConverted = JsonReader.jsonToMaps(json)
        axisConverted.'@type' = axis.getClass().getName()
        Object[] cols = (Object[]) axisConverted.columns

        for (Object item : cols)
        {
            Map col = (Map) item
            col.'@type' = Column.class.getName()
            Column actualCol = axis.getColumnById((Long)col.id)
            col.id = String.valueOf(col.id) // Stringify Long ID (Javascript safe if quoted)
            CellInfo cellInfo = new CellInfo(actualCol.getValue())
            String value = cellInfo.value
            if (axis.valueType == AxisValueType.DATE && axis.type != AxisType.SET)
            {
                value = NO_QUOTES_REGEX.matcher(value).replaceAll("")
            }
            col.value = value   // String version for Discrete, Range, or Set support
            col.isUrl = cellInfo.isUrl
            col.dataType = cellInfo.dataType
            col.isCached = cellInfo.isCached
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
        // Convert String column IDs to Longs
        Set<Long> colIds = new HashSet<>()
        for (Object id : ids)
        {
            colIds.add((Long)Converter.convert(id, Long.class))
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

    private static String getInetHostname()
    {
        if (inetHostname == null)
        {
            inetHostname = InetAddressUtilities.getHostName()
        }
        return inetHostname
    }

    private static String getServletHostname()
    {
        if (servletHostname == null)
        {
            servletHostname = JsonCommandServlet.servletRequest.get().getServerName()
        }
        return servletHostname
    }
}
