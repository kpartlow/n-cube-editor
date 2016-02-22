exports.config = {
    // refer to protractor docs for more options: https://github.com/angular/protractor/blob/master/docs/referenceConf.js

    seleniumServerJar: 'node_modules/selenium-server-standalone-jar/jar/selenium-server-standalone-2.47.1.jar',
    //seleniumArgs: ['-browserTimeout=60'],

    capabilities: {
        browserName: 'phantomjs',
        'phantomjs.binary.path': require('phantomjs').path,
        'phantomjs.cli.args': ['--ignore-ssl-errors=true',  '--web-security=false', '--debug=true']
    },

    specs: ['src/test/js/base-spec.js'],

    // The timeout in milliseconds for each script run on the browser. This should
    // be longer than the maximum time your application needs to stabilize between
    // tasks. (default 11000)
    allScriptsTimeout: 61000,

    // How long to wait for a page to load. (default 10000)
    getPageTimeout: 60000,

    jasmineNodeOpts: {
        // If true, display spec names.
        isVerbose: true,
        // If true, print colors to the terminal.
        showColors: true,
        // If true, include stack traces in failures.
        includeStackTrace: true,
        // default time to wait in ms before a test fails (defaults to 30000)
        defaultTimeoutInterval: 180000
    }
};