package com.cedarsoftware.controller

import com.cedarsoftware.ncube.NCubeManager
import groovy.transform.CompileStatic
import org.junit.Test

@CompileStatic
class TestNCubeController
{
    @Test
    void testGetVisualizerJson()
    {
        NCubeManager.setNCubePersister(TestingNCubeManagerHelper.persister)
        println('test')
//        Map options = [scope: [:], startCubeName: '']
//        rule.input.options.scope = createScope()
//        rule.input.options.scope.policyControlDate = '2015-01-01'
//        rule.input.options.scope.quoteDate = '2015-01-01'
//        rule.input.options.startCubeName = 'rpm.class.coverage.WorkersCompensationProduct.WCOps.StopGapCoverage'
    }
}
