n-cube-editor
=============
[![Build Status](https://travis-ci.org/jdereg/n-cube-editor.svg?branch=master)](https://travis-ci.org/jdereg/n-cube-editor)

n-cube-editor is a web-based GUI editor for editing and managing n-cubes.

#### Licensing
Copyright 2012-2016 Cedar Software, LLC
Licensed under the Apache License, Version 2.0
___

## Running Example
Visit http://ncube.io to see a running version of the NCUBE Editor.  Play around with it and send your feedback.  This project is very actively being developed.

## Getting Started

NCUBE Editor has been tested with MySQL, Oracle, HSQLDB, and MSSQL.  It will likely run on all other SQL databases.  NCUBE has been designed to allow other persisters to be added.  For example, it would not be that difficult to add a MongoDB persister for NCUBE.
  
### Step 1
Make sure to set the following environment variables (or -D system properties) in order to specify the connection to your database:
As Java system properties (using MySQL):

    -DNCE_JDBC_DRIVER="com.mysql.jdbc.Driver"
    -DNCE_JDBC_URL="jdbc:mysql://localhost:3306/ncube"
    -DNCE_JDBC_USER="ncube" 
    -DNCE_JDBC_PWD="ncube" 
    -DNCE_POOL_QUERY="/* ping */"

or environment variables (using MySQL):

    NCE_JDBC_DRIVER=com.mysql.jdbc.Driver
    NCE_JDBC_URL=jdbc:mysql://localhost:3306/ncube
    NCE_JDBC_USER=ncube
    NCE_JDBC_PWD=ncube
    NCE_POOL_QUERY="/* ping */"

### Step 2
Set up a database with a schema named 'ncube' and a single table named 'n_cube'.  For the DDL see [mysql-schema.ddl](https://github.com/jdereg/n-cube/blob/master/src/test/resources/ddl/mysql-schema.sql)

See [changelog.md](/changelog.md) for revision history.

