angular.module('MTMonitor').controller('DebugController', ['$scope', '$http', function (scope, http) {

    scope.params = {
        undef_t: 60,
        undef_d: 1000,
        stop_s: 5,
        stop_d: 25,
        move_s: 5,
        move_d: 90
    };

    scope.loadTracksWithParams = function () {
        scope.$emit('clearTracks');

        var q1 = '/tracks/631&1435708800&1437004800&' + getParamsStr(),
            q2 = '/tracks/713&1443484800&1443571200&' + getParamsStr();

        http.get(q1, {}).
            success(function (tracks) {
                console.log({'track': tracks});
                scope.$emit('drawTracks', tracks);
            });

        http.get(q2, {}).
            success(function (tracks) {
                console.log({'track': tracks});
                scope.$emit('drawTracks', tracks);
            });
    };

    function getParamsWithNameStr() {
        return "undef_t=" + scope.params.undef_t +
            "&undef_d=" + scope.params.undef_d +
            "&stop_s=" + scope.params.stop_s +
            "&stop_d=" + scope.params.stop_d +
            "&move_s=" + scope.params.move_s +
            "&move_d=" + scope.params.move_d;
    }

    function getParamsStr() {
        return scope.params.undef_t +
            "&" + scope.params.undef_d +
            "&" + scope.params.stop_s +
            "&" + scope.params.stop_d +
            "&" + scope.params.move_s +
            "&" + scope.params.move_d;
    }

}]);