/**
 * Web Worker thread
 *
 *     This thread is used to call heartBeat on the nCubeController without tying up
 *     the browser during sync checks.  Accepts an object map, the keys being the
 *     tab's cubeinfo (app, version, status, branch, cube)
 *
 * @return map of cubeinfo with modifiers for out of sync or conflict
 * @author Tym Pollack
 */

onmessage = function(e) {
    var obj = e.data.obj;
    var req = new XMLHttpRequest();

    req.open('POST', getHeartBeatUrl(), false);
    req.send(JSON.stringify([obj]));

    if (req.response) {
        var result = JSON.parse(req.response);
        if (result.status === true) {
            var data = result.data.compareResults;
            var beforeKeys = Object.keys(obj);
            var statuses = [];
            for (var i = 0, len = beforeKeys.length; i < len; i++) {
                var key = beforeKeys[i];
                var afterResult = data[key];

                var status = null;
                if (afterResult === null) {
                    status = 'conflict';
                }
                else if (afterResult === false) {
                    status = 'out-of-sync';
                }
                statuses.push({key:key, status:status});
            }
            var retObj = {obj:statuses, aBuffer:new ArrayBuffer(1024 * 1024)};
            postMessage(retObj, [retObj.aBuffer]);
        }
    }

    function getHeartBeatUrl() {
        var regexp = /\/([^\/]+)\//g;
        var match = regexp.exec(location.pathname);
        var url;

        if (match == null || match.length != 2) {
            url = location.protocol + '//' + location.hostname + ":" + location.port;
        } else {
            var ctx = match[1];
            url = location.protocol + '//' + location.hostname + ":" + location.port + "/" + ctx;
        }
        url += '/cmd/ncubeController/heartBeat';
        return url;
    }
};
