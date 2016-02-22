var sharedConfig = require('./karma.shared.conf.js');

var baseDir = '.';

module.exports = function(config) {
    sharedConfig(config);

    config.set({
        preprocessors:
        {
            'src/main/webapp/js/index.js': ['coverage']
        },

        // test results reporter to use
        // possible values: 'dots', 'progress', 'junit', 'growl', 'coverage'
        reporters: ['progress','coverage','junit'],

        coverageReporter: {
            type: 'cobertura',
            dir: baseDir + '/ui-tests/cobertura/js'
        },

        junitReporter: {
            outputDir: baseDir + '/ui-tests/junit',
            outputFile: 'TEST-nce.xml',
            suite: ''
        }
    });
};