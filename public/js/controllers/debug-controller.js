angular.module('MTMonitor').controller('DebugController', ['$scope', '$http', function (scope, http) {

    scope.params = {
        undef_t: 60, //0-600
        undef_d: 1000, //0-5000
        stop_s: 5, //0.0-20.0
        stop_d: 25, //0-1000
        move_s: 5, //0.0-20.0
        move_d: 90 //0-1000
    };

    scope.loadTracksWithParams = function () {
        scope.$emit('clearTracks');

        var q1 = 'http://192.168.9.242:3001/states?login=admin&pass=admin321&gid=631&from=1435708800&to=1437004800&' + getParamsStr(),
            q2 = 'http://192.168.9.242:3001/states?login=admin&pass=admin321&gid=713&from=1443484800&to=1443571200&' + getParamsStr();

        console.log('q1 = ' + q1);
        console.log('q2 = ' + q2);

        http.get(q1, {}).
            success(function (tracks) {
                console.log({data: tracks});
                scope.$emit('drawTracks', tracks);
            });

        http.get(q2, {}).
            success(function (tracks) {
                console.log({data: tracks});
                scope.$emit('drawTracks', tracks);
            });
    };

    function getParamsStr() {
        return "undef_t=" + scope.params.undef_t +
            "&undef_d=" + scope.params.undef_d +
            "&stop_s=" + scope.params.stop_s +
            "&stop_d=" + scope.params.stop_d +
            "&move_s=" + scope.params.move_s +
            "&move_d=" + scope.params.move_d;
    }

}]);