var sharedConfig = require('./karma.shared.conf.js');

module.exports = function(config) {
    sharedConfig(config);

    config.set({
        autoWatch: true,
        singleRun: false,
    });
};