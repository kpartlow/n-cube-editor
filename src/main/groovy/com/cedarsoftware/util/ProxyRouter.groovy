package com.cedarsoftware.util

import com.cedarsoftware.ncube.ApplicationID
import com.cedarsoftware.ncube.Axis
import com.cedarsoftware.ncube.AxisType
import com.cedarsoftware.ncube.AxisValueType
import com.cedarsoftware.ncube.CommandCell
import com.cedarsoftware.ncube.NCube
import com.cedarsoftware.ncube.StringUrlCmd
import com.cedarsoftware.ncube.util.CdnRouter
import com.cedarsoftware.util.io.JsonReader
import groovy.transform.CompileStatic
import org.apache.logging.log4j.LogManager
import org.apache.logging.log4j.Logger

import javax.servlet.http.HttpServletRequest
import javax.servlet.http.HttpServletResponse

/**
 * Spring Transaction Based JDBC Connection Provider
 *
 * @author Raja Gade
 *         <br/>
 *         Copyright (c) Cedar Software LLC
 *         <br/><br/>
 *         Licensed under the Apache License, Version 2.0 (the "License");
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
class ProxyRouter
{
    private static final Logger LOG = LogManager.getLogger(ProxyRouter.class);

    /**
     * Route the given request based on configured routing within n-cube
     */
    public void route(HttpServletRequest request, HttpServletResponse response)
    {   // use n-cube
        Map<String, String[]> requestParams = request.getParameterMap()
        if (!requestParams.containsKey('appId'))
        {
            String msg = '"appId" parameter missing - it is required and should contain the ApplicationID fields app, verison, status, branch in JSON format.'
            LOG.error(msg)
            throw new IllegalArgumentException(msg)
        }

        try
        {
            // TODO: Should we attempt to route to http:// URLs here too, to get the advantage of the allowAllCerts?
            // Does www.google.com protect itself from running in an iframe on the Javascript side?
            ApplicationID appId = buildAppId(requestParams)
            NCube finder = new NCube('router')
            finder.setApplicationID(appId)
            Axis find = new Axis('dontcare', AxisType.DISCRETE, AxisValueType.STRING, true, Axis.DISPLAY, 1)
            finder.addAxis(find)
            String sysPath = request.getAttribute('ctx')
            String servletPath = request.getServletPath()
            CommandCell cmd = new StringUrlCmd(servletPath.substring(sysPath.length() + 2), false)  // +2 = leading and trailing slash
            Map input = [(CdnRouter.HTTP_REQUEST):request, (CdnRouter.HTTP_RESPONSE):response]
            finder.setCell(cmd, [:])
            finder.getCell(input)
        }
        catch (Exception e)
        {
            String msg = '"appId" parameter not parsing as valid JSON: ' + requestParams.appId
            LOG.error(msg, e)
            throw new IllegalArgumentException(msg, e)
        }
    }

    private ApplicationID buildAppId(Map<String, String[]> requestParams)
    {
        Map<String, String> appParam = JsonReader.jsonToMaps(requestParams.appId[0])
        new ApplicationID(ApplicationID.DEFAULT_TENANT, (String) appParam.app, (String) appParam.version, (String) appParam.status, (String) appParam.branch)
    }
}
