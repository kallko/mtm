angular.module('acp').controller('AnalyzerIndexController', ['$scope', '$http', function (scope, http) {
    scope.params = {};
    scope.map = {};
    scope.points = {};

    scope.loadData = function () {
        console.log('loadData');
        scope.data = jsonData2;
        scope.map.clearMap();
        scope.points.reinit(scope.data);
    };

    scope.analyzeData = function () {
        console.log('analyzeData');

        var aBtn,
            bBtn,
            maxCount,
            sum;
        for (var i = 0; i < scope.data.length; i++) {
            for (var j = 0; j < scope.data[i].coords.length; j++) {
                aBtn = scope.data[i].coords[j];
                aBtn.closePointsCount = 0;
                for (var k = 0; k < scope.data[i].coords.length; k++) {
                    bBtn = scope.data[i].coords[k];
                    if (getDistanceFromLatLonInKm(aBtn.lat, aBtn.lon, bBtn.lat, bBtn.lon) * 1000 <=
                        scope.params.mobilePushRadius) {
                        aBtn.closePointsCount++;
                    }
                }
            }
        }

        for (i = 0; i < scope.data.length; i++) {
            maxCount = -1;
            for (j = 0; j < scope.data[i].coords.length; j++) {
                aBtn = scope.data[i].coords[j];
                if (aBtn.closePointsCount > maxCount) {
                    maxCount = aBtn.closePointsCount;
                }
            }

            for (j = 0; j < scope.data[i].coords.length; j++) {
                aBtn = scope.data[i].coords[j];
                if (aBtn.closePointsCount == maxCount) {
                    sum = {
                        count: 0,
                        lat: 0,
                        lon: 0
                    };

                    for (k = 0; k < scope.data[i].coords.length; k++) {
                        bBtn = scope.data[i].coords[k];
                        bBtn.inRadius = getDistanceFromLatLonInKm(aBtn.lat, aBtn.lon, bBtn.lat, bBtn.lon) * 1000 <=
                            scope.params.mobilePushRadius;
                        if (bBtn.inRadius) {
                            sum.count++;
                            sum.lat += parseFloat(bBtn.lat);
                            sum.lon += parseFloat(bBtn.lon);
                        }
                    }

                    sum.lat /= sum.count;
                    sum.lon /= sum.count;

                    //scope.map.drawMarker(sum, '!', 'CENTER', 14, 'white', 'black');
                    scope.data[i].center_lat = sum.lat.toFixed(5);
                    scope.data[i].center_lon = sum.lon.toFixed(5);
                    break;
                }
            }
        }

        scope.points.reinit(scope.data);
    };

    function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
        var R = 6371; // Radius of the earth in km
        var dLat = deg2rad(lat2 - lat1);  // deg2rad below
        var dLon = deg2rad(lon2 - lon1);
        var a =
                Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2)
            ;
        var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        var d = R * c; // Distance in km
        return d;
    }

    function deg2rad(deg) {
        return deg * (Math.PI / 180)
    }

}]);