angular.module('acp').controller('AnalyzerIndexController', ['$scope', '$http', 'Track', 'Sensor',
    function (scope, http, Track, Sensor) {
        scope.params = {};
        scope.map = {};
        scope.points = {};

        scope.loadData = function () {
            console.log('loadData');
            scope.data = jsonData3;
            scope.stops = [];
            scope.map.clearMap();
            scope.points.reinit(scope.data);

            if (scope.params.fromDate != '' && scope.params.fromDate != null) {
                var from = parseInt(scope.params.fromDate.getTime() / 1000),
                    to = (scope.params.toDate == '' || scope.params.toDate == null) ? parseInt(Date.now() / 1000)
                        : parseInt(scope.params.toDate.getTime() / 1000);

                Sensor.all().success(function (sensors) {
                    console.log({sensors: sensors});
                    for (var i = 0; i < scope.data.length; i++) {
                        for (var j = 0; j < scope.data[i].coords.length; j++) {
                            for (var k = 0; k < sensors.length; k++) {
                                if (scope.data[i].coords[j].transportid == sensors[k].TRANSPORT) {
                                    scope.data[i].coords[j].gid = sensors[k].GID;
                                    sensors[k].need_data = true;
                                    console.log('connected');
                                    break;
                                }
                            }
                        }
                    }

                    scope.stopsCollection = [];
                    for (i = 0; i < sensors.length; i++) {
                        if (sensors[i].need_data) {

                            (function (ii) {
                                Track.stops(sensors[ii].GID, from, to).success(function (stops) {
                                    scope.stops.push(stops);
                                    sensors[ii].need_data = false;
                                    scope.stopsCollection = scope.stopsCollection.concat(stops.data);

                                    var haveMore = false;
                                    for (j = 0; j < sensors.length; j++) {
                                        if (sensors[j].need_data) {
                                            haveMore = true;
                                            break;
                                        }
                                    }

                                    if (!haveMore) {
                                        console.log('all stops downloaded!');
                                    }
                                });
                            })(i);
                        }
                    }
                });
            }
        };

        scope.analyzeData = function () {
            console.log('analyzeData');
            console.log(scope.stopsCollection);
            groupButtonsByRadius();
            bindStopsToButtons();
            scope.points.reinit(scope.data);
        };

        function groupButtonsByRadius() {
            var aBtn,
                bBtn,
                maxCount,
                sum,
                tmpLat,
                tmpLon,
                tmpLen,
                coodsToSort = {};
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

                        coodsToSort.lat = [];
                        coodsToSort.lon = [];

                        for (k = 0; k < scope.data[i].coords.length; k++) {
                            bBtn = scope.data[i].coords[k];
                            bBtn.inRadius = getDistanceFromLatLonInKm(aBtn.lat, aBtn.lon, bBtn.lat, bBtn.lon) * 1000 <=
                                scope.params.mobilePushRadius;
                            if (bBtn.inRadius) {
                                tmpLat = parseFloat(bBtn.lat);
                                tmpLon = parseFloat(bBtn.lon);

                                sum.count++;
                                sum.lat += tmpLat;
                                sum.lon += tmpLon;

                                coodsToSort.lat.push(tmpLat);
                                coodsToSort.lon.push(tmpLon);
                            }
                        }

                        sum.lat /= sum.count;
                        sum.lon /= sum.count;

                        coodsToSort.lat.sort();
                        coodsToSort.lon.sort();

                        tmpLen = coodsToSort.lat.length;
                        if (tmpLen % 2 == 1) {
                            tmpLen = parseInt(tmpLen / 2);
                            scope.data[i].median_lat = coodsToSort.lat[tmpLen];
                            scope.data[i].median_lon = coodsToSort.lon[tmpLen];
                        } else if (tmpLen > 0) {
                            tmpLen = parseInt(tmpLen / 2);
                            scope.data[i].median_lat = (coodsToSort.lat[tmpLen - 1] + coodsToSort.lat[tmpLen]) / 2;
                            scope.data[i].median_lon = (coodsToSort.lon[tmpLen - 1] + coodsToSort.lon[tmpLen]) / 2;
                        }

                        if (coodsToSort.lat.length > 0) {
                            scope.data[i].median_lat = scope.data[i].median_lat.toFixed(5);
                            scope.data[i].median_lon = scope.data[i].median_lon.toFixed(5);
                        }
                        scope.data[i].grouped_coords_length = coodsToSort.lat.length;

                        scope.data[i].center_lat = sum.lat.toFixed(5);
                        scope.data[i].center_lon = sum.lon.toFixed(5);
                        break;
                    }
                }
            }
        }

        function strToTstamp(strDate) {
            var parts = strDate.split(' '),
                _date = parts[0].split('.'),
                _time = parts[1].split(':');

            return new Date(_date[2], _date[1] - 1, _date[0], _time[0], _time[1], _time[2]).getTime() / 1000;
        }

        function bindStopsToButtons() {
            if (scope.stopsCollection == undefined) return;

            var stop,
                button,
                buttonPush,
                timeShift = 120 * 60;

            for (var i = 0; i < scope.data.length; i++) {
                haveStop = false;
                lastStop = undefined;
                button = scope.data[i];
                button.stops = [];
                for (var j = 0; j < scope.stopsCollection.length; j++) {
                    if (scope.stopsCollection[j].state == 'MOVE') continue;
                    stop = scope.stopsCollection[j];
                    if (getDistanceFromLatLonInKm(stop.lat, stop.lon, button.median_lat, button.median_lon) * 1000 <=
                        scope.params.stopRadius) {
                        for (var k = 0; k < button.coords.length; k++) {
                            buttonPush = button.coords[k];
                            if (buttonPush.time_ts == undefined) {
                                buttonPush.time_ts = strToTstamp(buttonPush.time);
                            }

                            if (buttonPush.time_ts + timeShift > stop.t1 &&
                                buttonPush.time_ts - timeShift < stop.t1) {
                                button.stops.push(stop);
                            }
                        }
                    }
                }
            }
        }

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