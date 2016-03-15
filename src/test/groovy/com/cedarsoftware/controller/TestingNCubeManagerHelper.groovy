package com.cedarsoftware.controller

import com.cedarsoftware.ncube.ApplicationID
import com.cedarsoftware.ncube.JdbcConnectionProvider
import com.cedarsoftware.ncube.NCubeJdbcPersisterAdapter
import com.cedarsoftware.ncube.NCubeManager
import com.cedarsoftware.ncube.NCubePersister
import groovy.transform.CompileStatic

import java.sql.Connection

@CompileStatic
class TestingNCubeManagerHelper {

    static class TestingConnectionProvider implements JdbcConnectionProvider
    {
        @Override
        Connection getConnection() {
            return null
        }

        @Override
        void releaseConnection(Connection c) {

        }
    }

    static NCubePersister getPersister()
    {
        return new NCubeJdbcPersisterAdapter(createJdbcConnectionProvider())
    }

    static JdbcConnectionProvider createJdbcConnectionProvider()
    {
        return new TestingConnectionProvider()
    }

    static void setupEnvironment()
    {
        NCubeManager.setNCubePersister(getPersister())
    }

    static void loadCubes(List<String> ncubeNames)
    {
        ncubeNames.each {String nCubeName ->
            NCubeManager.getNCubeFromResource(ApplicationID.testAppId, nCubeName)
        }
    }
}
