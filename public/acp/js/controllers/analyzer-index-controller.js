angular.module('acp').controller('AnalyzerIndexController', ['$scope', '$http', 'Track', 'Sensor',
    '$timeout', 'Solution', 'Plan', function (scope, http, Track, Sensor, timeout, Solution, Plan) {
        scope.params = {};
        scope.map = {};
        scope.points = {};

        var pointsCounter = 0,
            saving = false;

        toLogDiv('Загружаем данные...');
        timeout(function () {
            loadData();
        }, 1200);

        function loadData() {
            console.log('loadData');

            //var from = 1444435200,
            //    to = 1445385600;

            //var from = 1433116800,
            //    to = 1446595200; //1446076800; //1439596800
            //scope.plans = [];
            //loadPlans(from, to);

            if (true) {
                Solution.load().success(function (data) {
                    scope.data = data;
                    groupButtonsByRadius();
                    scope.map.clearMap();
                    scope.points.reinit(scope.data);
                    //loadSensorsAndStops();
                });
            } else {
                scope.data = jsonData2;
                groupButtonsByRadius();
                Solution.merge(jsonData2).success(function (data) {
                    console.log('Merge complete!');
                });
            }


            //scope.map.clearMap();
            //scope.points.reinit(scope.data);
        }

        function loadSensorsAndStops() {
            var from = 1433116800,
                to = 1446076800;

            Sensor.all().success(function (sensors) {
                console.log({sensors: sensors});
                for (var i = 0; i < scope.data.length; i++) {
                    for (var j = 0; j < scope.data[i].coords.length; j++) {
                        for (var k = 0; k < sensors.length; k++) {
                            if (scope.data[i].coords[j].transportid == sensors[k].TRANSPORT) {
                                scope.data[i].coords[j].gid = sensors[k].GID;
                                sensors[k].need_data = true;
                                //console.log('connected');
                                break;
                            }
                        }
                    }
                }

                scope.stopsCollection = {};
                var counter = 0;
                for (i = 0; i < sensors.length; i++) {
                    if (sensors[i].need_data) {

                        (function (ii) {
                            counter++;
                            //console.log('GO #', ii);
                            Track.stops(sensors[ii].GID, from, to).success(function (stops) {
                                for (var i = 0; i < stops.data.length; i++) {
                                    stops.data[i].transportid = sensors[ii].TRANSPORT;
                                }

                                scope.stopsCollection[stops.gid] = stops.data;
                                counter--;

                                if (counter == 0) {
                                    console.log('all stops downloaded!');
                                    console.log({stops: scope.stopsCollection});
                                    //loadPlans(from, to);
                                }
                            });
                        })(i);
                    }
                }
            });
        }

        function loadPlans(from, to) {
            console.log('loadPlans');
            Plan.all(from).success(function (data) {
                console.log(data);
                console.log(new Date(from * 1000));
                scope.plans.push(data);

                if (data.status == 'no plan') {
                    startNewLoadCycle(from, to);
                    return;
                }

                for (var i = 0; i < data.sensors.length; i++) {
                    for (var j = 0; j < data.transports.length; j++) {
                        if (data.sensors[i].TRANSPORT == data.transports[j].ID) {
                            data.transports[j].gid = data.sensors[i].GID;
                        }
                    }
                }

                for (i = 0; i < data.routes.length; i++) {
                    for (j = 0; j < data.transports.length; j++) {
                        if (data.routes[i].TRANSPORT == data.transports[j].ID) {
                            data.routes[i].transport = data.transports[j];
                            break;
                        }
                    }

                    //data.routes[i].waypoints = [];
                    for (var j = 0; j < data.routes[i].points.length; j++) {
                        for (var k = 0; k < data.waypoints.length; k++) {
                            if (data.routes[i].points[j].END_WAYPOINT == data.waypoints[k].ID) {
                                data.routes[i].points[j].waypoint = data.waypoints[k];

                                //var idInArr = false;
                                //for (var l = 0; l < data.routes[i].waypoints.length; l++) {
                                //    if (data.routes[i].waypoints[l].ID == data.waypoints[k].ID) {
                                //        idInArr = true;
                                //        break;
                                //    }
                                //}
                                //
                                //if (!idInArr) {
                                //    data.routes[i].waypoints.push(data.waypoints[k].ID);
                                //}

                                pointsCounter++;
                                break;
                            }
                        }
                    }
                }

                var counter = 0;
                for (var i = 0; i < data.routes.length; i++) {
                    if (data.routes[i].transport == undefined) {
                        counter++;
                        continue;
                    }

                    (function (ii) {
                        Track.stops(data.routes[ii].transport.gid, from, from + 86400)
                            .success(function (stops) {
                                //console.log(stops);
                                data.routes[ii].stops = stops.data;
                                bindPlanStopsToPoints(data.routes[ii]);
                                counter++;
                                if (counter == data.routes.length) {
                                    console.log('stops loaded!');
                                    startNewLoadCycle(from, to);
                                }
                            });
                    })(i);
                }

            });
        }

        function bindPlanStopsToPoints(route) {
            var result = {
                    jobs: {
                        len: 0
                    },
                    stops: {}
                },
                point,
                stop,
                tmpKey,
                tmpStopId = 0,
                tmpTaskId,
                stopsArr,
                goodPoint;

            for (var i = 0; i < route.points.length; i++) {
                point = route.points[i];
                if (point.waypoint == undefined) continue;
                for (var j = 0; j < route.stops.length; j++) {
                    stop = route.stops[j];
                    if (stop.state == "ARRIVAL" &&
                        getDistanceFromLatLonInKm(parseFloat(point.waypoint.LAT), parseFloat(point.waypoint.LON),
                            stop.lat, stop.lon) * 1000 <= 60) {

                        // 120 - 41990
                        // 100 - 46502
                        // 80 - 50330
                        // 70 - 51832
                        // 60 - 52510
                        // 55 - 52503
                        // 50 - 52182
                        // 45 - 51419

                        tmpKey = 'task#' + point.TASK_NUMBER;
                        if (result.jobs[tmpKey] == undefined) {
                            result.jobs[tmpKey] = [];
                            result.jobs.len++;
                        }

                        if (stop.id == undefined) {
                            tmpStopId++;
                            stop.id = tmpStopId;
                        }

                        result.jobs[tmpKey].push(stop);
                    }
                }
            }

            result.jobs.find_coef = result.jobs.len / route.points.length * 100;
            route.linked_jobs = result.jobs;

            for (var key in result.jobs) {
                if (result.jobs.hasOwnProperty(key) && key.substr(0, 5) == 'task#') {

                    stopsArr = result.jobs[key];
                    for (var i = 0; i < stopsArr.length; i++) {
                        tmpKey = 'stop#' + stopsArr[i].id;
                        if (result.stops[tmpKey] == undefined) {
                            result.stops[tmpKey] = [];
                        }

                        result.stops[tmpKey].push(key);
                    }
                }
            }

            route.linked_stops = result.stops;
            route.good_points = [];
            if (scope.good_points == undefined) {
                scope.good_points = [];
            }

            for (var key in result.jobs) {
                if (result.jobs.hasOwnProperty(key) && key.substr(0, 5) == 'task#') {
                    stopsArr = result.jobs[key];
                    if (stopsArr.length == 1
                        && route.linked_stops['stop#' + stopsArr[0].id] != undefined
                        && route.linked_stops['stop#' + stopsArr[0].id].length == 1) {

                        tmpTaskId = key.substr(5, key.length - 5);
                        for (var i = 0; i < route.points.length; i++) {
                            if (route.points[i].TASK_NUMBER == tmpTaskId) {
                                point = route.points[i];
                                break;
                            }
                        }

                        goodPoint = {
                            task_id: tmpTaskId,
                            timestamp: stopsArr[0].t1,
                            duration: stopsArr[0].time,
                            waypoint_id: point.waypoint.ID,
                            transport_id: route.TRANSPORT,
                            driver_id: route.DRIVER,
                            weight: point.WEIGHT,
                            volume: point.VOLUME,
                            packages: 1,
                            scu: 1
                        };
                        route.good_points.push(goodPoint);
                        scope.good_points.push(goodPoint);
                    }
                }
            }

        }

        function startNewLoadCycle(from, to) {
            from += 86400;
            if (to > from) {
                loadPlans(from, to);
            } else {
                console.log('All plans loaded!');
                replaceDataID();

                Solution.saveBig(scope.good_points)
                    .success(function (data) {
                        console.log(data);
                    });

                console.log({good_points: scope.good_points, pointsCounter: pointsCounter});
            }
        }

        function replaceDataID() {
            var point;

            for (var i = 0; i < scope.good_points.length; i++) {
                point = scope.good_points[i];

                for (var j = 0; j < driversJson.length; j++) {
                    if (driversJson[j].old_id == point.driver_id) {
                        point.driver_id = driversJson[j].new_id;
                        break;
                    }
                }

                for (var j = 0; j < transportsJson.length; j++) {
                    if (transportsJson[j].old_id == point.transport_id) {
                        point.transport_id = transportsJson[j].new_id;
                        break;
                    }
                }

                for (var j = 0; j < jsonWaypoints.length; j++) {
                    if (jsonWaypoints[j].old_id == point.waypoint_id) {
                        point.waypoint_id = jsonWaypoints[j].new_id;
                        break;
                    }
                }

            }
        }

        scope.saveData = function () {
            if (saving) {
                toLogDiv('Всё ещё сохраняю...');
                return;
            }

            console.log('saveData');
            var toSave = [];

            for (var i = 0; i < scope.data.length; i++) {
                if (scope.data[i].needSave) {
                    toSave.push(scope.data[i]);
                }
            }

            if (toSave.length == 0) {
                toLogDiv('Последняя версия данных уже сохранена.');
                return;
            }
            toLogDiv(' Сохраняю...');
            saving = true;

            console.log('toSave.length', toSave.length);
            timeout(function () {
                Solution.save(toSave)
                    .success(function (data) {
                        saving = false;
                        toLogDiv('Сохранено!');
                        for (var i = 0; i < toSave.length; i++) {
                            delete toSave[i].needSave;
                        }
                    })
                    .error(function (data) {
                        console.log('Error while saving.')
                        saving = false;
                    });
            }, 100);
        };

        //scope.saveData = function () {
        //    console.log('saveData');
        //    var toSave = [];
        //    toLogDiv(' Сохраняю...');
        //
        //    for (var i = 0; i < scope.data.length; i++) {
        //        if (scope.data[i].needSave) {
        //            delete scope.data[i].needSave;
        //            toSave.push(scope.data[i]);
        //        }
        //    }
        //
        //    timeout(function () {
        //        Solution.save(toSave).success(function (data) {
        //            toLogDiv('Сохранено!');
        //        });
        //    }, 100);
        //};

        scope.toggleChanged = function () {
            $('#toggle-edited-btn').toggleClass('btn-default').toggleClass('btn-success');
            scope.points.showHidden = !scope.points.showHidden;
        };

        scope.analyzeData = function () {
            console.log('analyzeData');
            //console.log({stops: scope.stopsCollection});
            groupButtonsByRadius();
            //bindStopsToButtons();
            //getTracksForStops();
            scope.points.reinit(scope.data);
        };

        function groupButtonsByRadius() {
            var aBtn,
                bBtn,
                maxCount,
                sum,
                tmpLat,
                tmpLon,
                coodsToSort,
                totalCount = 0,
                hiddenCount = 0,
                changedCount = 0,
                doneCount = 0;

            for (var i = 0; i < scope.data.length; i++) {
                if (scope.data[i].changed) continue;

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

                    bBtn = scope.data[i];
                    if (getDistanceFromLatLonInKm(aBtn.lat, aBtn.lon, bBtn.lat, bBtn.lon) * 1000 <=
                        scope.params.mobilePushRadius) {
                        aBtn.closePointsCount++;
                    }
                }
            }

            for (i = 0; i < scope.data.length; i++) {
                if (scope.data[i].hide) hiddenCount++;
                if (scope.data[i].done) doneCount++;

                if (scope.data[i].changed) {
                    changedCount++;
                    continue;
                }

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

                        coodsToSort = [];
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

                                coodsToSort.push(bBtn);
                            }
                        }

                        bBtn = scope.data[i];
                        bBtn.inRadius = getDistanceFromLatLonInKm(aBtn.lat, aBtn.lon, bBtn.lat, bBtn.lon) * 1000 <=
                            scope.params.mobilePushRadius;
                        if (bBtn.inRadius) {
                            tmpLat = parseFloat(bBtn.lat);
                            tmpLon = parseFloat(bBtn.lon);

                            sum.count++;
                            sum.lat += tmpLat;
                            sum.lon += tmpLon;

                            coodsToSort.push(bBtn);
                        }

                        sum.lat /= sum.count;
                        sum.lon /= sum.count;

                        scope.data[i].median = findMedianForPoints(coodsToSort);
                        scope.data[i].grouped_coords_length = sum.count;
                        scope.data[i].outGroupPrc = parseFloat(((scope.data[i].coords.length - sum.count) / scope.data[i].coords.length * 100).toFixed(2));
                        scope.data[i].solved = scope.data[i].grouped_coords_length > 1 && scope.data[i].outGroupPrc <= 50;

                        if (!scope.data[i].solved) {
                            totalCount++;
                        }

                        scope.data[i].center = {};
                        scope.data[i].center.lat = sum.lat.toFixed(5);
                        scope.data[i].center.lon = sum.lon.toFixed(5);
                        scope.data[i].new_position = scope.data[i].median;
                        break;
                    }
                }
            }

            //console.log('Проблемных точек', totalCount);
            //console.log('Решенных точек', scope.data.length - totalCount);
            toLogDiv('Данные загружены. Точек требующих вмешательства - ' + totalCount
                + ', автоматически решенных точек - ' + (scope.data.length - totalCount)
                + ', готовых - ' + doneCount
                + ', изменено - ' + changedCount
                + ', скрыто - ' + hiddenCount);
            console.log('изменено', changedCount);
            console.log('готово', doneCount);
        }

        function toLogDiv(msg) {
            $('#log-div').text(msg);
        }

        function strToTstamp(strDate) {
            var parts = strDate.split(' '),
                _date = parts[0].split('.'),
                _time = parts[1].split(':');

            return new Date(_date[2], _date[1] - 1, _date[0], _time[0], _time[1], _time[2]).getTime() / 1000;
        }

        function bindStopsToButtons() {
            if (scope.stopsCollection == undefined) return;
            console.log({scopedata: scope.data})

            var stop,
                stopsArr,
                button,
                buttonPush,
                timeShift = 1 * 60 * 60,
                stopRadius = 150,
                undefCounter = 0;

            for (var i = 0; i < scope.data.length; i++) {
                if (i % 100 == 0) console.log("I: " + i + " out of " + scope.data.length + ", undef = " + undefCounter);

                button = scope.data[i];
                button.stops = [];
                for (var j = 0; j < scope.data[i].coords.length; j++) {
                    //if(j % 500 == 0) console.log("J: " + j + " out of " + scope.data[i].coords.length);
                    buttonPush = scope.data[i].coords[j];
                    stopsArr = scope.stopsCollection[buttonPush.gid];

                    if (stopsArr == undefined) {
                        //console.log("buttonPush", buttonPush);
                        //console.log("buttonPush.gid", buttonPush.gid);
                        //console.log("buttonPush.gid = undefined ");
                        undefCounter++;
                        continue;
                    }

                    for (var k = 0; k < stopsArr.length; k++) {
                        //if(k % 100 == 0) console.log("K: " + k + " out of " + stopsArr.length);
                        stop = stopsArr[k];

                        if (buttonPush.time_ts == undefined) {
                            buttonPush.time_ts = strToTstamp(buttonPush.time);
                        }

                        if (buttonPush.time_ts + timeShift > stop.t1 &&
                            buttonPush.time_ts - timeShift < stop.t1 &&
                            getDistanceFromLatLonInKm(stop.lat, stop.lon,
                                button.new_position.lat, button.new_position.lon) * 1000 <= stopRadius) {

                            if (buttonPush.stops == null) buttonPush.stops = [];
                            if (stop.pushes == null) stop.pushes = [];

                            buttonPush.stops.push(stop);
                            button.stops.push(stop);
                            stop.pushes.push(buttonPush);
                        }
                    }
                }
            }
        }

        function getTracksForStops() {
            var counter = 0;
            for (var i = 0; i < scope.data.length; i++) {
                for (var j = 0; j < scope.data[i].stops.length; j++) {
                    (function (ii, jj) {
                        var stop = scope.data[ii].stops[jj];
                        counter++;
                        Track.track(stop.gid, stop.t1, stop.t2).success(function (track) {
                            stop.track = track.data;
                            stop.median = findMedianForPoints(track.data);
                            counter--;

                            if (counter == 0) {
                                console.log('all tracks downloaded!');
                                findRealPointPosition();
                            }
                        });
                    })(i, j);
                }
            }
        }

        function findMedianForPoints(points) {
            var coodsToSort = {
                    lat: [],
                    lon: []
                },
                tmpLen,
                median = {};

            for (var i = 0; i < points.length; i++) {
                coodsToSort.lat.push(points[i].lat);
                coodsToSort.lon.push(points[i].lon);
            }

            coodsToSort.lat.sort();
            coodsToSort.lon.sort();

            tmpLen = coodsToSort.lat.length;
            if (tmpLen % 2 == 1) {
                tmpLen = parseInt(tmpLen / 2);
                median.lat = coodsToSort.lat[tmpLen];
                median.lon = coodsToSort.lon[tmpLen];
            } else if (tmpLen > 0) {
                tmpLen = parseInt(tmpLen / 2);
                median.lat = (parseFloat(coodsToSort.lat[tmpLen - 1]) + parseFloat(coodsToSort.lat[tmpLen])) / 2;
                median.lon = (parseFloat(coodsToSort.lon[tmpLen - 1]) + parseFloat(coodsToSort.lon[tmpLen])) / 2;
            }

            if (coodsToSort.lat.length > 0) {
                median.lat = parseFloat(median.lat).toFixed(5);
                median.lon = parseFloat(median.lon).toFixed(5);
            }

            return median;
        }

        function findRealPointPosition() {
            var points;
            console.log('findRealPointPosition', scope.data);

            for (var i = 0; i < scope.data.length; i++) {
                points = [];
                for (var j = 0; j < scope.data[i].stops.length; j++) {
                    points.push(scope.data[i].stops[j].median);
                }

                for (j = 0; j < scope.data[i].coords.length; j++) {
                    points.push(scope.data[i].coords[j]);
                }

                scope.data[i].new_position = findMedianForPoints(points);
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