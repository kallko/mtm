angular.module('MTMonitor').controller('PointIndexController', ['$scope', '$http', '$timeout', '$interval', '$filter',
    function (scope, http, timeout, interval, filter) {

        var pointTableHolder,
            pointContainer,
            pointTable,
            _data,
            rawData,
            dataUpdateInterval = 120,
            stopUpdateInterval = 60,
            updateTrackInterval = 30,
            radius = 0.15,
            controlledWindow = 600,
            promisedWindow = 3600,
            STATUS = {
                FINISHED: 0,
                FINISHED_LATE: 1,
                FINISHED_TOO_EARLY: 2,
                IN_PROGRESS: 3,
                ARRIVED_LATE: 4,
                DELAY: 5,
                //FOCUS_L1: 5,
                //FOCUS_L2: 6,
                SCHEDULED: 7,
                CANCELED: 8
            },

            WINDOW_TYPE = {
                OUT_WINDOWS: 0,
                IN_ORDERED: 1,
                IN_PROMISED: 2
            },


            aggregatorError = "invalid parameter 'gid'. ",
            loadParts = false,
            enableDynamicUpdate = false;

        setListeners();
        init();
        loadDailyData(false);

        if (enableDynamicUpdate) {
            //setDynamicDataUpdate(dataUpdateInterval);
            setRealTrackUpdate(stopUpdateInterval);
        }

        function init() {
            scope.rowCollection = [];
            scope.displayCollection = [].concat(scope.rowCollection);
            scope.filters = {};
            scope.filters.statuses = [
                {name: 'все статусы', value: -1, class: 'all-status'},
                {name: 'доставлено', value: STATUS.FINISHED, class: 'delivered-status'},
                {
                    name: 'доставлено с опозданием',
                    table_name: 'доставлено',
                    value: STATUS.FINISHED_LATE,
                    class: 'delivered-late-status'
                },
                {
                    name: 'доставлено слишком рано',
                    table_name: 'доставлено',
                    value: STATUS.FINISHED_TOO_EARLY,
                    class: 'delivered-too-early-status'
                },
                {name: 'выполняется', value: STATUS.IN_PROGRESS, class: 'performed-status'},
                {name: 'опоздал', value: STATUS.ARRIVED_LATE, class: 'arrived-late-status'},
                {name: 'опаздывает', value: STATUS.DELAY, class: 'delay-status'},
                //{name: 'под контролем', value: 4, class: 'controlled-status'},
                //{name: 'ожидают выполнения', value: 5, class: 'awaiting-status'},
                {name: 'запланирован', value: STATUS.SCHEDULED, class: 'scheduled-status'},
                {name: 'отменен', value: STATUS.CANCELED, class: 'canceled-status'}
            ];

            scope.filters.window_types = [
                {name: 'Вне окон', value: WINDOW_TYPE.OUT_WINDOWS, class: 'out-windows'},
                {name: 'В заказанном', value: WINDOW_TYPE.IN_ORDERED, class: 'in-ordered'},
                {name: 'В обещанном', value: WINDOW_TYPE.IN_PROMISED, class: 'in-promised'}
            ];

            scope.filters.status = scope.filters.statuses[0].value;
            scope.filters.drivers = [{name: 'все машины', value: -1}];
            scope.filters.driver = scope.filters.drivers[0].value;
            scope.filters.problem_index = -1;
            scope.filters.promised_15m = -1;
            scope.draw_modes = [
                {name: 'комбинированный трек', value: 0},
                {name: 'фактический трек', value: 1},
                {name: 'плановый трек', value: 2},
                {name: 'фактический + плановый трек', value: 3}
            ];
            scope.draw_mode = scope.draw_modes[0].value;

            scope.recalc_modes = [
                {name: 'по большим окнам', value: 0},
                {name: 'по заданным окнам', value: 1},
                {name: 'по увеличенному заданному окну', value: 2}
            ];
            scope.recalc_mode = scope.recalc_modes[0].value;

            scope.selectedRow = -1;
        }

        function setDynamicDataUpdate(seconds) {
            interval(function () {
                console.log('setDynamicDataUpdate()');
                if (_data == null) return;
                _data.server_time += seconds;
                updateData();
            }, seconds * 1000);
        }

        function setRealTrackUpdate(seconds) {
            interval(function () {
                console.log('setRealTrackUpdate()');
                if (_data == null) return;
                _data.server_time += seconds;
                loadTrackParts();
            }, seconds * 1000);
        }

        function loadTrackParts() {
            if (_data == null) return;

            if (_data.trackUpdateTime == undefined) {
                _data.trackUpdateTime = _data.server_time;
            }

            var _now = Date.now() / 1000,
                url = './trackparts/' + parseInt(_data.trackUpdateTime) + '/' + parseInt(_now);

            http.get(url)
                .success(function (trackParts) {
                    console.log('loaded track parts');
                    //console.log(new Date(_data.trackUpdateTime * 1000));
                    //console.log(new Date(_now * 1000));
                    //console.log(trackParts);

                    for (var i = 0; i < trackParts.length; i++) {
                        if (trackParts[i].data == undefined ||
                            trackParts[i].data.length == 0 ||
                            trackParts[i].data == aggregatorError) {
                            continue;
                        }

                        for (var j = 0; j < _data.routes.length; j++) {
                            if (_data.routes[j].transport.gid == trackParts[i].gid) {
                                if (trackParts[i].data.length > 0) {
                                    //for (var k = 0; k < trackParts[i].data.length; k++) {
                                    //    if (trackParts[i].data[k].coords.length == 0) {
                                    //        trackParts[i].data.splice(k, 1);
                                    //        k--;
                                    //    }
                                    //}

                                    if (trackParts[i].data.length > 0) {
                                        trackParts[i].data[0].state = 'MOVE';
                                        _data.routes[j].real_track = _data.routes[j].real_track || [];
                                        _data.routes[j].real_track = _data.routes[j].real_track.concat(trackParts[i].data);
                                        if (_data.routes[j].real_track[0].lastTrackUpdate != undefined) {
                                            _data.routes[j].real_track[0].lastTrackUpdate -= updateTrackInterval * 2;
                                        }

                                        var len = _data.routes[j].real_track.length - 1;
                                        _data.routes[j].car_position = _data.routes[j].real_track[len];

                                        if (_data.routes[i] != undefined && _data.routes[i].real_track != undefined &&
                                            _data.routes[i].real_track.length > 0) {
                                            _data.routes[i].real_track.splice(len, 1);
                                        }
                                    }
                                }
                                break;
                            }
                        }
                    }
                    _data.trackUpdateTime = _now;
                    updateData();
                });
        }

        scope.forceLoad = function () {
            console.log('forceLoad');
            loadDailyData(true);
        };

        function loadDailyData(force) {
            var url = './dailydata';
            if (force) {
                url += '?force=true';
            }

            http.get(url, {})
                .success(function (data) {
                    linkDataParts(data);
                    if (loadParts) {
                        loadTrackParts();
                    }
                });
        }

        function strToTstamp(strDate) {
            var parts = strDate.split(' '),
                _date = parts[0].split('.'),
                _time = parts[1].split(':');

            return new Date(_date[2], _date[1] - 1, _date[0], _time[0], _time[1], _time[2]).getTime() / 1000;
        }

        function getTstampAvailabilityWindow(strWindows) {
            if (!strWindows) {
                //console.log('Invalid strWindows!');
                return;
            }

            var windows = strWindows.split(' ; '),
                resWindows = [];

            for (var i = 0; i < windows.length; i++) {
                var parts = windows[i].split(' '),
                    timeStart = parts[0].split(':'),
                    timeFinish = parts[2].split(':'),
                    startDate = new Date(),
                    finishDate = new Date();

                startDate.setHours(timeStart[0]);
                startDate.setMinutes(timeStart[1]);

                finishDate.setHours(timeFinish[0]);
                finishDate.setMinutes(timeFinish[1]);

                resWindows.push({
                    start: parseInt(startDate.getTime() / 1000),
                    finish: parseInt(finishDate.getTime() / 1000)
                });
            }

            return resWindows;
        }

        function linkDataParts(data) {
            console.log('Start linking ...', new Date(data.server_time * 1000));
            rawData = JSON.parse(JSON.stringify(data));
            init();

            var tmpPoints,
                rowId = 0,
                driverId = 0,
                len = 0,
                tPoint,
                roundingNumb = 300;
            scope.rowCollection = [];

            for (var i = 0; i < data.sensors.length; i++) {
                for (var j = 0; j < data.transports.length; j++) {
                    if (data.sensors[i].TRANSPORT == data.transports[j].ID) {
                        data.transports[j].gid = data.sensors[i].GID;
                        data.transports[j].real_track = data.sensors[i].real_track;
                    }
                }
            }

            for (i = 0; i < data.routes.length; i++) {
                for (j = 0; j < data.transports.length; j++) {
                    if (data.routes[i].TRANSPORT == data.transports[j].ID) {
                        data.routes[i].transport = data.transports[j];
                        data.routes[i].real_track = data.transports[j].real_track;

                        if (data.transports[j].real_track != undefined &&
                            data.routes[i].real_track.length > 0 &&
                            data.routes[i].real_track != aggregatorError) {
                            len = data.routes[i].real_track.length - 1;
                            //console.log('NOT NULL', data.routes[i].real_track.length);
                            data.routes[i].car_position = data.routes[i].real_track[len];
                            data.routes[i].real_track.splice(len, 1);
                        }
                        break;
                    }
                }

                for (j = 0; j < data.drivers.length; j++) {
                    if (data.routes[i].DRIVER == data.drivers[j].ID) {
                        data.routes[i].driver = data.drivers[j];
                        break;
                    }
                }

                tmpPoints = data.routes[i].points;
                for (j = 0; j < tmpPoints.length; j++) {
                    tPoint = tmpPoints[j];
                    tPoint.driver = data.routes[i].driver;
                    tPoint.in_plan = true;
                    if (data.routes[i].driver._id == null) {
                        data.routes[i].driver._id = driverId;
                        scope.filters.drivers.push({
                            name: data.routes[i].transport.NAME + ' - ' + data.routes[i].driver.NAME,
                            value: data.routes[i].driver._id
                        });
                        driverId++;
                    }

                    tPoint.driver_indx = data.routes[i].driver._id;
                    tPoint.transport = data.routes[i].transport;
                    tPoint.arrival_time_hhmm = tPoint.ARRIVAL_TIME.substr(11, 8);
                    tPoint.arrival_time_ts = strToTstamp(tPoint.ARRIVAL_TIME);
                    tPoint.base_arrival_ts = strToTstamp(tPoint.base_arrival);
                    tPoint.controlled_window = {
                        start: tPoint.arrival_time_ts - controlledWindow,
                        finish: tPoint.arrival_time_ts + controlledWindow
                    };

                    tPoint.end_time_hhmm = tPoint.END_TIME.substr(11, 8);
                    tPoint.end_time_ts = strToTstamp(tPoint.END_TIME);
                    tPoint.row_id = rowId;
                    tPoint.arrival_prediction = 0;
                    tPoint.arrival_left_prediction = 0;
                    if (j == 0) {
                        tPoint.status = STATUS.FINISHED;
                        tPoint.confirmed = true;
                        tPoint.havePush = true;
                        tPoint.haveStop = true;
                    } else {
                        tPoint.status = STATUS.SCHEDULED;
                    }

                    tPoint.route_id = i;
                    rowId++;

                    //for (var k = 0; k < data.waypoints.length; k++) {
                    //    if (tPoint.START_WAYPOINT == data.waypoints[k].ID) {
                    //        tPoint.waypoint = data.waypoints[k];
                    //        tPoint.LAT = data.waypoints[k].LAT;
                    //        tPoint.LON = data.waypoints[k].LON;
                    //        break;
                    //    }
                    //}

                    tPoint.windows = getTstampAvailabilityWindow(tPoint.AVAILABILITY_WINDOWS);
                    if (tPoint.promised_window == undefined && tPoint.windows != undefined) {
                        for (k = 0; k < tPoint.windows.length; k++) {
                            if (tPoint.windows[k].finish + 120 > tPoint.arrival_time_ts &&
                                tPoint.windows[k].start - 120 < tPoint.arrival_time_ts) {
                                if (tPoint.arrival_time_ts + promisedWindow / 2 > tPoint.windows[k].finish) {
                                    tPoint.promised_window = {
                                        start: tPoint.windows[k].finish - promisedWindow,
                                        finish: tPoint.windows[k].finish
                                    };
                                } else if (tPoint.arrival_time_ts - promisedWindow / 2 < tPoint.windows[k].start) {
                                    tPoint.promised_window = {
                                        start: tPoint.windows[k].start,
                                        finish: tPoint.windows[k].start + promisedWindow
                                    };
                                }

                                break;
                            }
                        }
                    }

                    if (tPoint.promised_window == undefined) {
                        tPoint.promised_window = {
                            start: tPoint.arrival_time_ts - promisedWindow / 2,
                            finish: tPoint.arrival_time_ts + promisedWindow / 2
                        };

                        tPoint.promised_window.start -= tPoint.promised_window.start % roundingNumb - roundingNumb;
                        tPoint.promised_window.finish = tPoint.promised_window.start + promisedWindow;
                        for (k = 0; tPoint.windows != undefined && k < tPoint.windows.length; k++) {
                            if (tPoint.windows[k].finish + 120 > tPoint.arrival_time_ts &&
                                tPoint.windows[k].start - 120 < tPoint.arrival_time_ts) {
                                if (tPoint.windows[k].finish < tPoint.promised_window.finish) {
                                    tPoint.windows[k].finish -= roundingNumb;
                                }
                            }
                        }

                    }

                    if (tPoint.promised_window_changed == undefined) {
                        tPoint.promised_window_changed = JSON.parse(JSON.stringify(tPoint.promised_window));
                    }

                }

                scope.rowCollection = scope.rowCollection.concat(data.routes[i].points);
            }

            _data = data;
            updateData();
            scope.$emit('saveForDebug', {
                'rowCollection': scope.rowCollection,
                'data': data
            });

            console.log('Finish linking', data);
            //console.log({'data': scope.rowCollection});
            scope.displayCollection = [].concat(scope.rowCollection);

            setColResizable();
            prepareFixedHeader();
        }

        function updateData() {
            statusUpdate();
            predicationArrivalUpdate();
            promised15MUpdate();
        }

        function promised15MUpdate() {
            var now = _data.server_time;
            for (var i = 0; i < _data.routes.length; i++) {
                for (var j = 0; j < _data.routes[i].points.length; j++) {
                    if ((_data.routes[i].points[j].status == STATUS.SCHEDULED ||
                        _data.routes[i].points[j].status == STATUS.ARRIVED_LATE ||
                        _data.routes[i].points[j].status == STATUS.DELAY ||
                        _data.routes[i].points[j].status == STATUS.IN_PROGRESS) &&
                        _data.routes[i].points[j].promised_window_changed.finish - 900 < now &&
                        _data.routes[i].points[j].promised_window_changed.finish > now) {
                        _data.routes[i].points[j].promised_15m = true;
                    } else {
                        _data.routes[i].points[j].promised_15m = false;
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

        function statusUpdate() {
            var route,
                tmpPoint,
                tmpArrival,
                timeOffset = 3600 * 1.5,
                buttonTimeOffset = 3600,
                LAT,
                LON,
                lat,
                lon,
                _time,
                focus_l1_time = 60 * 30,
                focus_l2_time = 60 * 120,
                now = _data.server_time,
                lastPoint,
                lastIndex;

            for (var i = 0; i < _data.routes.length; i++) {
                for (var j = 0; j < _data.routes[i].points.length; j++) {
                    if (j == 0) {
                        _data.routes[i].points[j].status = STATUS.FINISHED;
                    } else {
                        _data.routes[i].points[j].status = STATUS.SCHEDULED;
                    }
                }
            }

            for (i = 0; i < _data.routes.length; i++) {
                route = _data.routes[i];
                route.lastPointIndx = 0;
                if (route.real_track != undefined) {
                    for (j = 0; j < route.real_track.length; j++) {
                        if (route.real_track[j].state == "ARRIVAL") {
                            tmpArrival = route.real_track[j];
                            lastIndex = 0;
                            for (var k = 0; k < route.points.length; k++) {
                                tmpPoint = route.points[k];
                                LAT = parseFloat(tmpPoint.LAT);
                                LON = parseFloat(tmpPoint.LON);
                                lat = parseFloat(tmpArrival.lat);
                                lon = parseFloat(tmpArrival.lon);

                                if (tmpPoint.status != STATUS.FINISHED
                                    && tmpPoint.status != STATUS.CANCELED
                                    && tmpPoint.status != STATUS.FINISHED_LATE
                                    && tmpPoint.status != STATUS.FINISHED_TOO_EARLY
                                    && getDistanceFromLatLonInKm(lat, lon, LAT, LON) < radius) {

                                    tmpPoint.windowType = WINDOW_TYPE.OUT_WINDOWS;
                                    if (tmpPoint.promised_window_changed.start < tmpArrival.t1
                                        && tmpPoint.promised_window_changed.finish > tmpArrival.t1) {
                                        tmpPoint.windowType = WINDOW_TYPE.IN_PROMISED;
                                    } else {
                                        for (var l = 0; tmpPoint.windows != undefined && l < tmpPoint.windows.length; l++) {
                                            if (tmpPoint.windows[l].start < tmpArrival.t1
                                                && tmpPoint.windows[l].finish > tmpArrival.t1) {
                                                tmpPoint.windowType = WINDOW_TYPE.IN_ORDERED;
                                                break;
                                            }
                                        }
                                    }

                                    route.lastPointIndx = k > route.lastPointIndx ? k : route.lastPointIndx;
                                    tmpPoint.real_arrival_time = tmpArrival.t1;

                                    if (tmpPoint.rawConfirmed !== -1) {
                                        if (tmpPoint.real_arrival_time > tmpPoint.promised_window_changed.finish) {
                                            tmpPoint.status = STATUS.FINISHED_LATE;
                                        } else if (tmpPoint.real_arrival_time < tmpPoint.promised_window_changed.start) {
                                            tmpPoint.status = STATUS.FINISHED_TOO_EARLY;
                                        } else {
                                            tmpPoint.status = STATUS.FINISHED;
                                        }
                                        lastIndex = tmpPoint.NUMBER;
                                    }

                                    tmpPoint.haveStop = true;
                                    //break;
                                }
                            }
                        }
                    }

                    lastPoint = route.points[route.lastPointIndx];
                    if (lastPoint != null) {
                        if (lastPoint.arrival_time_ts + parseInt(lastPoint.TASK_TIME) > now
                            && getDistanceFromLatLonInKm(route.car_position.lat, route.car_position.lon,
                                lastPoint.LAT, lastPoint.LON) < radius) {
                            lastPoint.status = STATUS.IN_PROGRESS;
                        }
                    }

                    //for (j = 0; j < route.points.length; j++) {
                    //    tmpPoint = route.points[j];
                    //    if (tmpPoint.status != STATUS.FINISHED &&
                    //        tmpPoint.status != STATUS.CANCELED) {
                    //        if (now + focus_l2_time > tmpPoint.arrival_time_ts) {
                    //            if (now + focus_l1_time > tmpPoint.arrival_time_ts) {
                    //                tmpPoint.status = STATUS.FOCUS_L1;
                    //            } else {
                    //                tmpPoint.status = STATUS.FOCUS_L2;
                    //            }
                    //        }
                    //    }
                    //}}
                }
            }

            if (parentForm == undefined) {
                return;
            }

            //console.log([_data.ID, getTodayStrFor1C()]);
            _data.mobile_buttons = parentForm._call('getDriversActions', [_data.ID, getTodayStrFor1C()]);
            console.log('_data.mobile_buttons', _data.mobile_buttons);

            if (_data.mobile_buttons == undefined
                || Object.keys(_data.mobile_buttons).length == 0) {
                console.log('no mobile buttons push');
                return;
            }

            var buttonsStr = _data.mobile_buttons[Object.keys(_data.mobile_buttons)[0]];
            if (buttonsStr == '[]') {
                console.log('no mobile buttons push');
                return;
            }

            _data.mobile_buttons = JSON.parse(buttonsStr.substr(1, buttonsStr.length - 2));
            console.log('_data.mobile_buttons array', _data.mobile_buttons);
            console.log({pushes: JSON.stringify(_data.mobile_buttons)});

            //_data.mobile_buttons = [
            //    {
            //    "number": "4400465536",
            //    "time": "16.11.2015 05:07:10",
            //    "canceled": false,
            //    "cancel_reason": "",
            //    "lat": 50.52071,
            //    "lon": 30.493614,
            //    "gps_time": "16.11.2015 05:07:01"
            //}, {
            //    "number": "4400468048",
            //    "time": "16.11.2015 05:19:39",
            //    "canceled": false,
            //    "cancel_reason": "",
            //    "lat": 50.508354,
            //    "lon": 30.497778,
            //    "gps_time": "16.11.2015 05:19:36"
            //}, {
            //    "number": "4400468393",
            //    "time": "16.11.2015 04:52:43",
            //    "canceled": false,
            //    "cancel_reason": "",
            //    "lat": 50.51783,
            //    "lon": 30.485174,
            //    "gps_time": "16.11.2015 04:52:34"
            //}, {
            //    "number": "4400468058",
            //    "time": "16.11.2015 05:19:46",
            //    "canceled": false,
            //    "cancel_reason": "",
            //    "lat": 50.50838,
            //    "lon": 30.49784,
            //    "gps_time": "16.11.2015 05:19:43"
            //}, {
            //    "number": "4400468496",
            //    "time": "16.11.2015 05:18:34",
            //    "canceled": false,
            //    "cancel_reason": "",
            //    "lat": 50.52127,
            //    "lon": 30.497011,
            //    "gps_time": "16.11.2015 05:18:25"
            //}, {
            //    "number": "4400468596",
            //    "time": "16.11.2015 05:23:46",
            //    "canceled": false,
            //    "cancel_reason": "",
            //    "lat": 50.504387,
            //    "lon": 30.494738,
            //    "gps_time": "16.11.2015 05:23:42"
            //}, {
            //    "number": "4400468280",
            //    "time": "16.11.2015 06:02:38",
            //    "canceled": false,
            //    "cancel_reason": "",
            //    "lat": 50.526035,
            //    "lon": 30.491737,
            //    "gps_time": "16.11.2015 06:02:30"
            //}, {
            //    "number": "4400467851",
            //    "time": "16.11.2015 05:26:38",
            //    "canceled": false,
            //    "cancel_reason": "",
            //    "lat": 50.527355,
            //    "lon": 30.516329,
            //    "gps_time": "16.11.2015 05:26:29"
            //}, {
            //    "number": "4400468624",
            //    "time": "16.11.2015 06:27:54",
            //    "canceled": false,
            //    "cancel_reason": "",
            //    "lat": 50.52405,
            //    "lon": 30.498234,
            //    "gps_time": "16.11.2015 06:27:46"
            //}, {
            //    "number": "4400467817",
            //    "time": "16.11.2015 06:12:39",
            //    "canceled": false,
            //    "cancel_reason": "",
            //    "lat": 50.49105,
            //    "lon": 30.506496,
            //    "gps_time": "16.11.2015 06:12:35"
            //}, {
            //    "number": "4400467025",
            //    "time": "16.11.2015 07:11:31",
            //    "canceled": false,
            //    "cancel_reason": "",
            //    "lat": 50.511326,
            //    "lon": 30.508133,
            //    "gps_time": "16.11.2015 07:11:21"
            //}, {
            //    "number": "4400468256",
            //    "time": "16.11.2015 05:42:38",
            //    "canceled": false,
            //    "cancel_reason": "",
            //    "lat": 50.52036,
            //    "lon": 30.511639,
            //    "gps_time": "16.11.2015 05:42:29"
            //}, {
            //    "number": "4400468187",
            //    "time": "16.11.2015 04:45:43",
            //    "canceled": false,
            //    "cancel_reason": "",
            //    "lat": 50.497673,
            //    "lon": 30.519863,
            //    "gps_time": "16.11.2015 04:45:40"
            //}, {
            //    "number": "4400468333",
            //    "time": "16.11.2015 07:25:17",
            //    "canceled": false,
            //    "cancel_reason": "",
            //    "lat": 50.5242,
            //    "lon": 30.51775,
            //    "gps_time": "16.11.2015 07:25:07"
            //}, {
            //    "number": "4400467829",
            //    "time": "16.11.2015 07:08:11",
            //    "canceled": false,
            //    "cancel_reason": "",
            //    "lat": 50.50965,
            //    "lon": 30.512205,
            //    "gps_time": "16.11.2015 07:08:02"
            //}, {
            //    "number": "4400467801",
            //    "time": "16.11.2015 06:35:47",
            //    "canceled": false,
            //    "cancel_reason": "",
            //    "lat": 50.49708,
            //    "lon": 30.520111,
            //    "gps_time": "16.11.2015 06:32:02"
            //}, {
            //    "number": "4400467797",
            //    "time": "16.11.2015 07:11:44",
            //    "canceled": false,
            //    "cancel_reason": "",
            //    "lat": 50.51132,
            //    "lon": 30.508112,
            //    "gps_time": "16.11.2015 07:11:35"
            //}, {
            //    "number": "4400467654",
            //    "time": "16.11.2015 04:38:56",
            //    "canceled": false,
            //    "cancel_reason": "",
            //    "lat": 50.496716,
            //    "lon": 30.517195,
            //    "gps_time": "16.11.2015 04:38:53"
            //}, {
            //    "number": "4400467144",
            //    "time": "16.11.2015 06:55:34",
            //    "canceled": false,
            //    "cancel_reason": "",
            //    "lat": 50.513657,
            //    "lon": 30.51047,
            //    "gps_time": "16.11.2015 06:55:25"
            //}, {
            //    "number": "4400468190",
            //    "time": "16.11.2015 06:02:36",
            //    "canceled": false,
            //    "cancel_reason": "",
            //    "lat": 50.492165,
            //    "lon": 30.521233,
            //    "gps_time": "16.11.2015 06:02:32"
            //}, {
            //    "number": "4400467787",
            //    "time": "16.11.2015 07:11:50",
            //    "canceled": false,
            //    "cancel_reason": "",
            //    "lat": 50.51128,
            //    "lon": 30.50809,
            //    "gps_time": "16.11.2015 07:11:41"
            //}, {
            //    "number": "4400468491",
            //    "time": "16.11.2015 05:53:31",
            //    "canceled": false,
            //    "cancel_reason": "",
            //    "lat": 50.492607,
            //    "lon": 30.520077,
            //    "gps_time": "16.11.2015 05:53:27"
            //}, {
            //    "number": "4400468163",
            //    "time": "16.11.2015 05:53:40",
            //    "canceled": false,
            //    "cancel_reason": "",
            //    "lat": 50.4926,
            //    "lon": 30.520267,
            //    "gps_time": "16.11.2015 05:53:36"
            //}, {
            //    "number": "4400467810",
            //    "time": "16.11.2015 07:11:57",
            //    "canceled": false,
            //    "cancel_reason": "",
            //    "lat": 50.51125,
            //    "lon": 30.50809,
            //    "gps_time": "16.11.2015 07:11:47"
            //}, {
            //    "number": "4400467821",
            //    "time": "16.11.2015 05:52:24",
            //    "canceled": false,
            //    "cancel_reason": "",
            //    "lat": 50.49325,
            //    "lon": 30.51844,
            //    "gps_time": "16.11.2015 05:52:19"
            //}, {
            //    "number": "4400467606",
            //    "time": "16.11.2015 07:12:03",
            //    "canceled": false,
            //    "cancel_reason": "",
            //    "lat": 50.511234,
            //    "lon": 30.508078,
            //    "gps_time": "16.11.2015 07:11:54"
            //}, {
            //    "number": "4400468528",
            //    "time": "16.11.2015 04:19:19",
            //    "canceled": false,
            //    "cancel_reason": "",
            //    "lat": 50.49086,
            //    "lon": 30.508877,
            //    "gps_time": "16.11.2015 04:19:16"
            //}, {
            //    "number": "4400468407",
            //    "time": "16.11.2015 07:12:09",
            //    "canceled": false,
            //    "cancel_reason": "",
            //    "lat": 50.511265,
            //    "lon": 30.50802,
            //    "gps_time": "16.11.2015 07:12:00"
            //}, {
            //    "number": "4400468136",
            //    "time": "16.11.2015 04:10:07",
            //    "canceled": false,
            //    "cancel_reason": "",
            //    "lat": 50.494083,
            //    "lon": 30.506413,
            //    "gps_time": "16.11.2015 04:10:03"
            //}, {
            //    "number": "4400468287",
            //    "time": "16.11.2015 07:56:24",
            //    "canceled": false,
            //    "cancel_reason": "",
            //    "lat": 50.517715,
            //    "lon": 30.50039,
            //    "gps_time": "16.11.2015 07:56:15"
            //}, {
            //    "number": "4400468144",
            //    "time": "16.11.2015 04:24:20",
            //    "canceled": false,
            //    "cancel_reason": "",
            //    "lat": 50.497505,
            //    "lon": 30.50747,
            //    "gps_time": "16.11.2015 04:24:16"
            //}, {
            //    "number": "4400468191",
            //    "time": "16.11.2015 08:05:30",
            //    "canceled": false,
            //    "cancel_reason": "",
            //    "lat": 50.521446,
            //    "lon": 30.499674,
            //    "gps_time": "16.11.2015 08:05:20"
            //}, {
            //    "number": "4400465114",
            //    "time": "16.11.2015 05:41:43",
            //    "canceled": false,
            //    "cancel_reason": "",
            //    "lat": 50.504284,
            //    "lon": 30.5054,
            //    "gps_time": "16.11.2015 05:41:40"
            //}, {
            //    "number": "4400467910",
            //    "time": "16.11.2015 06:14:56",
            //    "canceled": false,
            //    "cancel_reason": "",
            //    "lat": 50.520653,
            //    "lon": 30.486189,
            //    "gps_time": "16.11.2015 06:14:48"
            //}, {
            //    "number": "4400468233",
            //    "time": "16.11.2015 05:36:49",
            //    "canceled": false,
            //    "cancel_reason": "",
            //    "lat": 50.50245,
            //    "lon": 30.500797,
            //    "gps_time": "16.11.2015 05:36:45"
            //}, {
            //    "number": "4400467249",
            //    "time": "16.11.2015 05:30:38",
            //    "canceled": false,
            //    "cancel_reason": "",
            //    "lat": 50.503002,
            //    "lon": 30.500732,
            //    "gps_time": "16.11.2015 05:30:35"
            //}, {
            //    "number": "4400467827",
            //    "time": "16.11.2015 06:14:36",
            //    "canceled": false,
            //    "cancel_reason": "",
            //    "lat": 50.520584,
            //    "lon": 30.486115,
            //    "gps_time": "16.11.2015 06:14:27"
            //}, {
            //    "number": "4400468369",
            //    "time": "16.11.2015 06:17:45",
            //    "canceled": false,
            //    "cancel_reason": "",
            //    "lat": 50.52059,
            //    "lon": 30.486074,
            //    "gps_time": "16.11.2015 06:17:37"
            //}, {
            //    "number": "4400467214",
            //    "time": "16.11.2015 08:20:52",
            //    "canceled": false,
            //    "cancel_reason": "",
            //    "lat": 50.511127,
            //    "lon": 30.487156,
            //    "gps_time": "16.11.2015 08:20:43"
            //}, {
            //    "number": "4400468594",
            //    "time": "16.11.2015 07:24:59",
            //    "canceled": false,
            //    "cancel_reason": "",
            //    "lat": 50.503193,
            //    "lon": 30.49967,
            //    "gps_time": "16.11.2015 07:24:56"
            //}, {
            //    "number": "4400468375",
            //    "time": "16.11.2015 07:13:31",
            //    "canceled": false,
            //    "cancel_reason": "",
            //    "lat": 50.49891,
            //    "lon": 30.51024,
            //    "gps_time": "16.11.2015 07:13:28"
            //}, {
            //    "number": "4400467080",
            //    "time": "16.11.2015 05:11:18",
            //    "canceled": false,
            //    "cancel_reason": "",
            //    "lat": 50.52091,
            //    "lon": 30.493633,
            //    "gps_time": "16.11.2015 05:11:10"
            //}, {
            //    "number": "4400467853",
            //    "time": "16.11.2015 07:04:52",
            //    "canceled": false,
            //    "cancel_reason": "",
            //    "lat": 50.50484,
            //    "lon": 30.508207,
            //    "gps_time": "16.11.2015 07:04:49"
            //}, {
            //    "number": "4400468443",
            //    "time": "16.11.2015 06:53:44",
            //    "canceled": false,
            //    "cancel_reason": "",
            //    "lat": 50.49968,
            //    "lon": 30.517368,
            //    "gps_time": "16.11.2015 06:53:40"
            //}, {
            //    "number": "4400468081",
            //    "time": "16.11.2015 07:25:30",
            //    "canceled": false,
            //    "cancel_reason": "",
            //    "lat": 50.524143,
            //    "lon": 30.517706,
            //    "gps_time": "16.11.2015 07:25:21"
            //}, {
            //    "number": "4400467766",
            //    "time": "16.11.2015 06:42:48",
            //    "canceled": false,
            //    "cancel_reason": "",
            //    "lat": 50.52335,
            //    "lon": 30.521683,
            //    "gps_time": "16.11.2015 06:42:38"
            //}, {
            //    "number": "4400468402",
            //    "time": "16.11.2015 06:27:00",
            //    "canceled": false,
            //    "cancel_reason": "",
            //    "lat": 50.496017,
            //    "lon": 30.521841,
            //    "gps_time": "16.11.2015 06:26:56"
            //}, {
            //    "number": "4400468399",
            //    "time": "16.11.2015 06:18:00",
            //    "canceled": false,
            //    "cancel_reason": "",
            //    "lat": 50.495464,
            //    "lon": 30.522156,
            //    "gps_time": "16.11.2015 06:17:56"
            //}, {
            //    "number": "4400468382",
            //    "time": "16.11.2015 07:32:00",
            //    "canceled": false,
            //    "cancel_reason": "",
            //    "lat": 50.52568,
            //    "lon": 30.513088,
            //    "gps_time": "16.11.2015 07:31:50"
            //}, {
            //    "number": "4400468486",
            //    "time": "16.11.2015 08:21:51",
            //    "canceled": false,
            //    "cancel_reason": "",
            //    "lat": 50.49477,
            //    "lon": 30.522402,
            //    "gps_time": "16.11.2015 08:21:47"
            //}, {
            //    "number": "4400468529",
            //    "time": "16.11.2015 05:42:17",
            //    "canceled": false,
            //    "cancel_reason": "",
            //    "lat": 50.52032,
            //    "lon": 30.511679,
            //    "gps_time": "16.11.2015 05:42:08"
            //}, {
            //    "number": "4400468177",
            //    "time": "16.11.2015 08:21:05",
            //    "canceled": false,
            //    "cancel_reason": "",
            //    "lat": 50.51112,
            //    "lon": 30.48716,
            //    "gps_time": "16.11.2015 08:20:56"
            //}, {
            //    "number": "4400465386",
            //    "time": "16.11.2015 08:16:29",
            //    "canceled": false,
            //    "cancel_reason": "",
            //    "lat": 50.49316,
            //    "lon": 30.524307,
            //    "gps_time": "16.11.2015 08:16:26"
            //}, {
            //    "number": "4400467422",
            //    "time": "16.11.2015 06:41:28",
            //    "canceled": false,
            //    "cancel_reason": "",
            //    "lat": 50.497475,
            //    "lon": 30.518923,
            //    "gps_time": "16.11.2015 06:39:36"
            //}, {
            //    "number": "4400468050",
            //    "time": "16.11.2015 06:36:02",
            //    "canceled": false,
            //    "cancel_reason": "",
            //    "lat": 50.49708,
            //    "lon": 30.520111,
            //    "gps_time": "16.11.2015 06:32:02"
            //}, {
            //    "number": "4400467973",
            //    "time": "16.11.2015 08:09:15",
            //    "canceled": false,
            //    "cancel_reason": "",
            //    "lat": 50.499977,
            //    "lon": 30.517548,
            //    "gps_time": "16.11.2015 08:09:11"
            //}, {
            //    "number": "4400468211",
            //    "time": "16.11.2015 07:45:13",
            //    "canceled": false,
            //    "cancel_reason": "",
            //    "lat": 50.5142,
            //    "lon": 30.493261,
            //    "gps_time": "16.11.2015 07:45:04"
            //}, {
            //    "number": "4400468324",
            //    "time": "16.11.2015 06:54:04",
            //    "canceled": false,
            //    "cancel_reason": "",
            //    "lat": 50.49968,
            //    "lon": 30.517368,
            //    "gps_time": "16.11.2015 06:53:40"
            //}, {
            //    "number": "4400465518",
            //    "time": "16.11.2015 07:41:22",
            //    "canceled": true,
            //    "cancel_reason": "никого нет дома",
            //    "lat": 50.518673,
            //    "lon": 30.502995,
            //    "gps_time": "16.11.2015 07:41:18"
            //}, {
            //    "number": "4400467996",
            //    "time": "16.11.2015 07:51:21",
            //    "canceled": false,
            //    "cancel_reason": "",
            //    "lat": 50.52196,
            //    "lon": 30.505692,
            //    "gps_time": "16.11.2015 07:51:18"
            //}, {
            //    "number": "4400465730",
            //    "time": "16.11.2015 07:58:38",
            //    "canceled": false,
            //    "cancel_reason": "",
            //    "lat": 50.519238,
            //    "lon": 30.513428,
            //    "gps_time": "16.11.2015 07:58:35"
            //}];
            //console.log(_data.mobile_buttons);
            // return;

            // TODO FIX если есть проверка по кнопкам, не совсем корректно работает пересчет
            // TODO перенести сюда логику проверки типа окна

            if (_data.mobile_buttons == undefined) return;

            for (var i = 0; i < _data.mobile_buttons.length; i++) {
                if (_data.mobile_buttons[i].canceled) continue;

                for (var j = 0; j < _data.routes.length; j++) {
                    for (var k = 0; k < _data.routes[j].points.length; k++) {
                        tmpPoint = _data.routes[j].points[k];
                        LAT = parseFloat(tmpPoint.LAT);
                        LON = parseFloat(tmpPoint.LON);
                        lat = _data.mobile_buttons[i].lat;
                        lon = _data.mobile_buttons[i].lon;
                        _data.mobile_buttons[i].gps_time_ts = strToTstamp(_data.mobile_buttons[i].gps_time);

                        if (_data.mobile_buttons[i].number == tmpPoint.TASK_NUMBER
                            && getDistanceFromLatLonInKm(lat, lon, LAT, LON) < radius
                        ) {
                            //console.log('detect by button push', tmpPoint.row_id);
                            tmpPoint.mobile_push = _data.mobile_buttons[i];
                            tmpPoint.havePush = true;
                            tmpPoint.mobile_arrival_time = _data.mobile_buttons[i].time;
                            tmpPoint.confirmed = tmpPoint.confirmed || tmpPoint.haveStop;

                            if (tmpPoint.status != STATUS.FINISHED
                                && tmpPoint.status != STATUS.FINISHED_TOO_EARLY
                                && tmpPoint.status != STATUS.FINISHED_LATE
                                && tmpPoint.status != STATUS.CANCELED) {
                                //console.log('detect NEW point by button push');
                                if (tmpPoint.rawConfirmed !== -1) {
                                    if (tmpPoint.mobile_arrival_time > tmpPoint.promised_window_changed.finish) {
                                        tmpPoint.status = STATUS.FINISHED_LATE;
                                    } else {
                                        tmpPoint.status = STATUS.FINISHED;
                                    }
                                }
                                _data.routes[j].lastPointIndx = k > _data.routes[j].lastPointIndx ? k : _data.routes[j].lastPointIndx;
                            }
                            break;
                        }
                    }
                }
            }

            //console.log(_data, scope.rowCollection);

        }

        function getTodayStrFor1C() {
            var date = new Date();
            return date.getFullYear() +
                ("0" + (date.getMonth() + 1)).slice(-2) +
                ( ("0" + date.getDate())).slice(-2);
        }

        function updateProblemIndex(route) {
            var point,
                lateMinutesCoef = 1.0,
                volumeCoef = 0,
                weightCoef = 0,
                valueCoef = 0,
                outClientWindowCoef = 2.0,
                timeThreshold = 3600 * 6,
                timeMin = 0.25,
                timeCoef;

            for (var j = 0; j < route.points.length; j++) {
                point = route.points[j];

                if (point.overdue_time > 0) {
                    point.problem_index = parseInt(point.overdue_time * lateMinutesCoef);
                    point.problem_index += parseInt(point.WEIGHT) * weightCoef;
                    point.problem_index += parseInt(point.VOLUME) * volumeCoef;
                    point.problem_index += parseInt(point.VALUE) * valueCoef;

                    if (point.windows != undefined) {
                        for (var k = 0; k < point.windows.length; k++) {
                            if (point.windows[k].finish > point.arrival_time_ts &&
                                point.windows[k].start < point.arrival_time_ts &&
                                point.arrival_time_ts + point.overdue_time > point.windows[k].finish) {
                                point.problem_index += ((point.arrival_time_ts + point.overdue_time) - point.windows[k].finish)
                                    * outClientWindowCoef;
                                break;
                            }
                        }
                    }

                    timeCoef = (timeThreshold - point.arrival_left_prediction) / timeThreshold;
                    timeCoef = timeCoef >= timeMin ? timeCoef : timeMin;
                    point.problem_index = parseInt(point.problem_index * timeCoef);

                    //if (route.ID == '11') {
                    //    console.log('b: ' + point.problem_index);
                    //    console.log('a: ' + parseInt(point.problem_index * timeCoef));
                    //}
                } else {
                    point.problem_index = 0;
                }
            }
        }

        function predicationArrivalUpdate() {
            var route,
                url,
                point,
                tmpPred,
                now = _data.server_time; //Date.now();

            for (var i = 0; i < _data.routes.length; i++) {
                route = _data.routes[i];
                if (route.real_track == undefined ||
                    route.real_track.length == 0 ||
                    route.real_track == aggregatorError) {
                    route.real_track = undefined;
                    continue;
                }

                point = route.car_position;
                //console.log({car: route.car_position, real_track: route.real_track});
                url = './findtime2p/' + point.lat + '&' + point.lon + '&'
                    + route.points[route.lastPointIndx].LAT + '&' + route.points[route.lastPointIndx].LON;

                (function (_route) {
                    http.get(url).
                        success(function (data) {
                            var lastPoint = _route.lastPointIndx + 1,
                                nextPointTime = parseInt(data.time_table[0][1][0] / 10),
                                totalWorkTime = 0,
                                totalTravelTime = 0,
                                tmpTime;

                            for (var j = 0; j < _route.points.length; j++) {
                                if (j < lastPoint) {
                                    _route.points[j].arrival_prediction = 0;
                                    _route.points[j].overdue_time = 0;
                                    if (_route.points[j].status == STATUS.SCHEDULED) {
                                        if (now > _route.points[j].promised_window_changed.finish) {
                                            _route.points[j].status = STATUS.ARRIVED_LATE;
                                        }

                                        _route.points[j].overdue_time = now - _route.points[j].arrival_time_ts;
                                    } else if (_route.points[j].status == STATUS.IN_PROGRESS) {
                                        totalWorkTime = parseInt(_route.points[j].TASK_TIME) - (now - _route.points[j].real_arrival_time);
                                    }
                                } else {
                                    tmpTime = _route.time_matrix.time_table[0][j - 1][j];
                                    totalTravelTime += tmpTime == 2147483647 ? 0 : tmpTime / 10;
                                    tmpPred = now + nextPointTime + totalWorkTime + totalTravelTime;
                                    _route.points[j].arrival_prediction = now + nextPointTime + totalWorkTime + totalTravelTime;

                                    _route.points[j].in_plan = true;
                                    if (_route.points[j].arrival_prediction == null) {
                                        _route.points[j].arrival_prediction = tmpPred;
                                    } else {
                                        if (tmpPred + 300 < _route.points[j].arrival_prediction) {
                                            _route.points[j].in_plan = false;
                                        }

                                        _route.points[j].arrival_prediction = tmpPred;
                                    }

                                    _route.points[j].arrival_left_prediction = parseInt(_route.points[j].arrival_prediction - now);
                                    if (_route.points[j].arrival_prediction > _route.points[j].arrival_time_ts) {
                                        _route.points[j].overdue_time = parseInt(_route.points[j].arrival_prediction -
                                            _route.points[j].promised_window_changed.finish);

                                        if (_route.points[j].overdue_time > 0) {
                                            if (_route.points[j].promised_window_changed.finish < now) {
                                                _route.points[j].status = STATUS.ARRIVED_LATE;
                                            } else {
                                                _route.points[j].status = STATUS.DELAY;
                                            }
                                        }

                                    } else {
                                        _route.points[j].overdue_time = 0;
                                    }

                                    //if (_route.ID == '3') {
                                    //    console.log(_route.points[j].overdue_time);
                                    //}

                                    totalWorkTime += parseInt(_route.points[j].TASK_TIME);
                                }
                            }

                            updateProblemIndex(_route);
                        });
                })(route);
            }
        }

        function setColResizable() {
            $("#point-table-tbl").colResizable({
                //headerOnly: true
                //fixed: false
                onResize: function () {
                    resizeHead(pointTable);
                }
            });
        }

        function setListeners() {
            $(window).resize(function () {
                console.log('height', $(window).height());
                console.log('width', $(window).width());
                resetHeight();
                if (pointTable == null) {
                    pointTableHolder = $('#point-table');
                }
                resizeHead(pointTable);
            });
            resetHeight();

            if (pointTableHolder == null) {
                pointTableHolder = $('#point-table');
                pointContainer = $('#point-controller-container');
                pointTable = $('#point-table > table');
            }

            myLayout.on('stateChanged', function (e) {
                var pointMenuPanel = $('#point-menu-panel');
                pointTableHolder.height(pointContainer.height() - 27 - pointMenuPanel.height());
                pointTableHolder.width(pointContainer.width() - 10);

                if ($('.lm_dragProxy').length == 0) {
                    $('.header-copy').show();
                    updateHeaderClip();
                } else {
                    $('.header-copy').hide();
                }

                updateFixedHeaderPos();
            });

            scope.$watch(function () {
                return scope.filters.driver + scope.filters.status + scope.filters.problem_index;
            }, function () {
                timeout(function () {
                    updateResizeGripHeight();
                }, 1);
            });

            scope.$on('ngRepeatFinished', function () {
                updateResizeGripHeight();

                $('.delivery-point-row').contextmenu({
                    target: '#context-menu',
                    onItem: deliveryRowConextMenu
                });
            });
        }

        function deliveryRowConextMenu(context, e) {
            var option = $(e.target).data("menuOption");
            console.log(option);
            var contextJ = $(context)[0],
                row = scope.rowCollection[parseInt(contextJ.id.substr(6))],
                point = rawData.routes[row.route_id].points[row.NUMBER - 1],
                needChanges = !(row.confirmed && (row.status == STATUS.FINISHED
                || row.status == STATUS.FINISHED_LATE || row.status == STATUS.FINISHED_TOO_EARLY));

            //console.log(point);
            //console.log(row);

            console.log(row.confirmed);
            switch (option) {
                case 'sort':
                    sortByDriver(row.driver_indx);
                    return;
                case 'confirm-status':
                    if (!needChanges) return;
                    row.confirmed = true;
                    point.rawConfirmed = 1;
                    break;
                case 'not-delivered-status':
                    if (!needChanges) return;
                    row.status = STATUS.DELAY;
                    point.rawConfirmed = -1;
                    break;
                case 'cancel-point':
                    row.status = STATUS.CANCELED;
                    break;
            }

            point.checkedStatus = row.status;
            scope.$apply();


            // TODO: посчитать реальный статус
            // TODO: подсветить строку под меню
        }

        function sortByDriver(indx) {
            if (scope.filters.driver == indx) {
                scope.filters.driver = -1;
            } else {
                scope.filters.driver = indx;
            }

            scope.$apply();
        }

        function updateResizeGripHeight() {
            var height = pointTable.height();
            $('div.JCLRgrip').height(height);
            $('div.jcolresizer').height(height);
        }

        function prepareFixedHeader() {
            var header = $('.header'),
                table = $('#point-table > table'),
                headerCopy = header.clone().removeClass('header').addClass('header-copy').insertAfter(header),
                protoStatusTH = header.find('.status-col'),
                protoProblemIndexTH = header.find('.problem-index-col'),
                timeLeftTH = header.find('.prediction-arrival-left-col');

            headerCopy.find('.status-col').on('click', function () {
                protoStatusTH.trigger('click');
            });

            headerCopy.find('.problem-index-col').on('click', function () {
                protoProblemIndexTH.trigger('click');
            });

            headerCopy.find('.prediction-arrival-left-col').on('click', function () {
                timeLeftTH.trigger('click');
            });

            resizeHead(table);
            pointTableHolder.on("scroll", updateHeaderClip);
            updateHeaderClip();
            updateFixedHeaderPos();
        }

        function updateHeaderClip() {
            var x = pointTableHolder.scrollLeft(),
                width = pointContainer.width() - 24;

            pointTableHolder.find('.header-copy').css({
                'margin-left': -x - 1,
                clip: 'rect(0, ' + (width + x) + 'px, auto, ' + x + 'px)'
            });
        }

        function resizeHead($table) {
            $table.find('thead.header > tr:first > th').each(function (i, h) {
                $table.find('thead.header-copy > tr > th:eq(' + i + ')').css({
                    'max-width': $(h).outerWidth(),
                    width: $(h).outerWidth(),
                    display: $(h).css('display')
                });
            });
            $table.find('thead.header-copy').css('width', $table.outerWidth());
        }

        function updateFixedHeaderPos() {
            $('.header-copy').offset(pointTableHolder.position());
        }

        function resetHeight() {
            var tableHeight = $(window).height() - $("#menu-holder").height()
                - $("#tab-selector").height() - 22;
            $('#point-table').height(tableHeight);
        }

        scope.rowClick = function (id) {
            //console.log(scope.displayCollection[id]);
            $('.selected-row').removeClass('selected-row');

            if (scope.selectedRow == id) {
                scope.selectedRow = -1;
            } else {
                scope.selectedRow = id;
                $('#point-' + id).addClass('selected-row');
                scope.$emit('setMapCenter', {
                    lat: scope.displayCollection[id].LAT,
                    lon: scope.displayCollection[id].LON
                });
            }
        };

        scope.getTextStatus = function (statusCode, row_id, confirmed) {
            for (var i = 0; i < scope.filters.statuses.length; i++) {
                if (scope.filters.statuses[i].value == statusCode) {
                    var object = $('#status-td-' + row_id);
                    object.removeClass();
                    var unconfirmed = !confirmed && (statusCode == STATUS.FINISHED ||
                        statusCode == STATUS.FINISHED_LATE || statusCode == STATUS.FINISHED_TOO_EARLY);
                    if (unconfirmed) {
                        object.addClass('yellow-status');
                    }
                    object.addClass(scope.filters.statuses[i].class);
                    if (scope.filters.statuses[i].table_name != undefined) {
                        return scope.filters.statuses[i].table_name + (unconfirmed ? '?' : '');
                    }

                    return scope.filters.statuses[i].name + (unconfirmed ? '?' : '');
                }
            }

            console.log(statusCode);
            return 'неизвестный статус';
        };

        scope.getTextWindow = function (windowCode, row_id) {
            for (var i = 0; i < scope.filters.window_types.length; i++) {
                if (scope.filters.window_types[i].value == windowCode) {
                    var object = $('#window-td-' + row_id);
                    object.removeClass();
                    object.addClass(scope.filters.window_types[i].class);
                    if (scope.filters.window_types[i].table_name != undefined) {
                        return scope.filters.window_types[i].table_name;
                    }

                    return scope.filters.window_types[i].name;
                }
            }

            return '';
        };

        scope.statusFilter = function (row) {
            return (scope.filters.status == -1 || row.status == scope.filters.status);
        };

        scope.driverFilter = function (row) {
            return (scope.filters.driver == -1 || row.driver_indx == scope.filters.driver);
        };

        scope.problemFilter = function (row) {
            return (scope.filters.problem_index == -1 || row.problem_index > 0);
        };

        scope.promise15MFilter = function (row) {
            return (scope.filters.promised_15m == -1 || row.promised_15m);
        };

        scope.drawPlannedRoute = function () {
            if (scope.selectedRow != -1) {
                scope.$emit('drawPlannedTrack',
                    _data.routes[scope.displayCollection[scope.selectedRow].route_id]);
            } else if (scope.filters.driver != -1) {
                scope.$emit('drawPlannedTrack', _data.routes[scope.filters.driver]);
            }
        };

        scope.drawRoute = function () {
            var indx,
                route,
                draw = function (route) {
                    scope.$emit('clearMap');
                    switch (scope.draw_mode) {
                        case scope.draw_modes[0].value: // комбинированный
                            scope.$emit('drawCombinedTrack', route);
                            break;
                        case scope.draw_modes[1].value: // фактический
                            scope.$emit('drawRealTrack', route);
                            break;
                        case scope.draw_modes[2].value: // плановый
                            scope.$emit('drawPlannedTrack', route);
                            break;
                        case scope.draw_modes[3].value: // плановый + фактический
                            scope.$emit('drawRealAndPlannedTrack', route);
                            break;
                    }
                };

            if (scope.filters.driver != -1) {
                indx = scope.filters.driver;
            } else if (scope.selectedRow != -1) {
                indx = scope.displayCollection[scope.selectedRow].route_id;
            } else {
                return;
            }

            route = _data.routes[indx];

            if (route.real_track == undefined) return;

            if (route.real_track[0].lastTrackUpdate == undefined ||
                route.real_track[0].lastTrackUpdate + updateTrackInterval < Date.now() / 1000) {
                console.log('donwload tracks');
                http.post('gettracksbystates', {
                    states: route.real_track,
                    gid: route.transport.gid
                })
                    .success(function (data) {
                        console.log({data: data});
                        route.real_track = data;
                        route.real_track[0].lastTrackUpdate = parseInt(Date.now() / 1000);

                        console.log('before', route.real_track.length);
                        for (var k = 0; k < route.real_track.length; k++) {
                            if (route.real_track[k].coords == undefined ||
                                route.real_track[k].coords.length == 0) {
                                route.real_track.splice(k, 1);
                                k--;
                            }
                        }
                        console.log('after', route.real_track.length);

                        draw(route);
                    });
            } else {
                console.log('load tracks from cache');
                draw(route);
            }
        };

        scope.checkPoint = function () {
            var checkedObj = $('.point-checkbox:checked'),
                checkedIdArr = [];

            console.log(checkedObj.length);
            for (var i = 0; i < checkedObj.length; i++) {
                checkedIdArr.push(checkedObj[i].id);
            }

            //scope.$emit('drawCheckedPoints', {} );
        };

        scope.toggleProblemPoints = function () {
            $('#problem-index-btn').toggleClass('btn-default').toggleClass('btn-success');
            if (scope.filters.problem_index == -1) {
                scope.filters.problem_index = 1;
            } else {
                scope.filters.problem_index = -1;
            }

        };

        scope.togglePromised15MPoints = function () {
            $('#promised-15m-btn').toggleClass('btn-default').toggleClass('btn-success');
            if (scope.filters.promised_15m == -1) {
                scope.filters.promised_15m = 1;
            } else {
                scope.filters.promised_15m = -1;
            }
        };

        Array.prototype.move = function (old_index, new_index) {
            if (new_index >= this.length) {
                var k = new_index - this.length;
                while ((k--) + 1) {
                    this.push(undefined);
                }
            }
            this.splice(new_index, 0, this.splice(old_index, 1)[0]);
            return this;
        };

        // http://192.168.122.247:20000/
        scope.changePromisedWindow = function (row_id) {
            var start = $('#edit-promised-start-' + row_id).val().split(':'),
                finish = $('#edit-promised-finish-' + row_id).val().split(':'),
                point = scope.displayCollection[row_id],
                oldStart = new Date(point.promised_window_changed.start * 1000),
                clearOldDate = new Date(oldStart.getFullYear(), oldStart.getMonth(), oldStart.getDate()).getTime();

            point.promised_window_changed = {
                start: clearOldDate / 1000 + start[0] * 3600 + start[1] * 60,
                finish: clearOldDate / 1000 + finish[0] * 3600 + finish[1] * 60
            };

            var rawPoints = rawData.routes[point.route_id].points;
            for (var i = 0; i < rawPoints.length; i++) {
                if (rawPoints[i].TASK_NUMBER == point.TASK_NUMBER) {
                    console.log('Change promised window in rawData');
                    rawPoints[i].promised_window = JSON.parse(JSON.stringify(point.promised_window));
                    rawPoints[i].promised_window_changed = JSON.parse(JSON.stringify(point.promised_window_changed));
                    break;
                }
            }

            //point.arrival_time_ts = (point.promised_window.start +
            //    point.promised_window.finish) / 2;

            console.log(_data);
            updateData();
        };

        function showPopup(text) {
            scope.$emit('showNotification', text);
        }

        scope.recalculateRoute = function () {
            var route;

            if (scope.filters.driver != -1) {
                route = _data.routes[scope.filters.driver];
            } else if (scope.selectedRow != -1) {
                route = _data.routes[scope.displayCollection[scope.selectedRow].route_id];
            }

            if (route != undefined) {
                route.recalcIter = route.recalcIter || 0;
                route.recalcIter++;
                console.log('route.recalcIter', route.recalcIter);

                var mathInput = {
                        "margin_of_safety": 1,
                        "garbage": false,
                        "one_car_recalc": true,
                        "etaps": 1,
                        "parent_id": "",
                        "points": [],
                        "cargo_list": [],
                        "trList": [],
                        "jobList": [],
                        "depotList": [],
                        "inn_list": []
                    },
                    point,
                    pt,
                    job,
                    timeWindow,
                    late;

                for (var i = 0; i < route.points.length; i++) {
                    if (mathInput.depotList.length == 0 && route.points[i].waypoint.TYPE == 'WAREHOUSE') {
                        timeWindow = getTstampAvailabilityWindow(route.points[i].waypoint.AVAILABILITY_WINDOWS);
                        mathInput.depotList.push({
                            "id": "1",
                            "point": "-2",
                            "window": {
                                "start": timeWindow[0].start,  //END_TIME: "30.10.2015 19:50:02"
                                "finish": timeWindow[0].finish  //START_TIME: "30.10.2015 06:30:00"
                            }
                        });
                        break;
                    }
                }

                var trWindow = getTstampAvailabilityWindow('03:00 - ' +
                        route.transport.END_OF_WORK.substr(0, 5)),
                    jobWindows,
                    timeStep = 600;

                console.log(trWindow);

                for (i = 0; i < route.points.length; i++) {

                    if (route.points[i].status != STATUS.FINISHED && route.points[i].status != STATUS.FINISHED_LATE
                        && route.points[i].status != STATUS.FINISHED_TOO_EARLY) {
                        pt = route.points[i];
                        point = {
                            "lat": parseFloat(pt.waypoint.LAT),
                            "lon": parseFloat(pt.waypoint.LON),
                            "ID": pt.waypoint.gIndex + '', //pt.waypoint.ID,
                            "servicetime": 0, //parseInt(pt.waypoint.QUEUING_TIME),
                            "add_servicetime": 0, // parseInt(pt.waypoint.EXTRA_DURATION_FOR_NEW_DRIVER),
                            "max_height_transport": 0,
                            "max_length_transport": 0,
                            "only_pallets": false,
                            "ramp": false,
                            "need_refrigerator": false,
                            "temperature_control": false,
                            "ignore_cargo_incompatibility": false,
                            "ignore_pallet_incompatibility": false,
                            "region": "-1"
                        };

                        mathInput.points.push(point);

                        late = route.points[i].status == STATUS.ARRIVED_LATE ||
                            route.points[i].status == STATUS.DELAY;

                        jobWindows = [];
                        switch (scope.recalc_mode) {
                            case scope.recalc_modes[0].value:   // пересчет по большим окнам
                                jobWindows = [
                                    {
                                        "start": late ? _data.server_time : pt.promised_window_changed.start,
                                        "finish": late ? trWindow[0].finish : pt.promised_window_changed.finish
                                    }
                                ];
                                break;
                            case scope.recalc_modes[1].value:   // пересчет по заданным окнам
                                jobWindows = [
                                    {
                                        "start": pt.promised_window_changed.start,
                                        "finish": pt.promised_window_changed.finish
                                    }
                                ];
                                break;
                            case scope.recalc_modes[2].value:   // пересчетпри рекрусивном увелечении окон
                                jobWindows = [
                                    {
                                        "start": pt.promised_window_changed.start - timeStep,
                                        "finish": pt.promised_window_changed.finish + timeStep
                                    }
                                ];
                                pt.promised_window_changed = jobWindows[0];
                                break;
                        }

                        job = {
                            "id": i.toString(),
                            "weigth": parseInt(pt.WEIGHT),
                            "volume": parseInt(pt.VOLUME),
                            "value": parseInt(pt.VALUE),
                            "servicetime": parseInt(pt.TASK_TIME),
                            "cargo_type": "-1",
                            "vehicle_required": "",
                            "penalty": 0,
                            "rest": false,
                            "backhaul": false,
                            "point": pt.waypoint.gIndex + '',
                            "windows": jobWindows
                        };
                        mathInput.jobList.push(job);
                    }
                }

                point = {
                    "lat": parseFloat(route.car_position.lat),
                    "lon": parseFloat(route.car_position.lon),
                    "ID": "-2",
                    "servicetime": 0,
                    "add_servicetime": 0,
                    "max_height_transport": 0,
                    "max_length_transport": 0,
                    "only_pallets": false,
                    "ramp": false,
                    "need_refrigerator": false,
                    "temperature_control": false,
                    "ignore_cargo_incompatibility": false,
                    "ignore_pallet_incompatibility": false,
                    "region": "-1"
                };

                mathInput.points.push(point);

                mathInput.trList.push({
                    "id": "-1",
                    "cost_per_hour": parseInt(route.transport.COST_PER_HOUR),
                    "cost_per_km": parseInt(route.transport.COST_PER_KILOMETER),
                    "cost_onTime": parseInt(route.transport.COST_ONE_TIME),
                    "maxweigth": parseInt(route.transport.MAXIMUM_WEIGHT),
                    "maxvolume": parseInt(route.transport.MAXIMUM_VOLUME),
                    "maxvalue": parseInt(route.transport.MAXIMUM_VALUE),
                    "multi_use": true,
                    "amount_use": 1,
                    "proto": false,
                    "cycled": false,
                    "time_load": 0,
                    "time_min": 0,
                    "window": {
                        "start": _data.server_time,
                        "finish": trWindow[0].finish
                    },
                    "weigth_nominal": 0,
                    "time_max": 0,
                    "start_point": "-1",
                    "finish_point": route.points[route.points.length - 1].waypoint.TYPE == "WAREHOUSE"
                        ? route.points[route.points.length - 1].waypoint.ID : "-1",
                    "points_limit": 0,
                    "road_speed": 1,
                    "point_speed": 1,
                    "add_servicetime": 0, // parseInt(route.transport.TIME_OF_DISEMBARK),
                    "number_of_pallets": 0,
                    "refrigerator": false,
                    "temperature_control": false,
                    "low_temperature": 0,
                    "high_temperature": 0,
                    "time_preserving": 0,
                    "height": 0,
                    "length": 0,
                    "can_with_ramp": true,
                    "can_without_ramp": true,
                    "use_inn": false,
                    "min_rest_time": 0,
                    "region": "-1",
                    "donor": false,
                    "recipient": false,
                    "points_acquaintances": [],
                    "tr_constraints": [],
                    "tr_permits": []
                });

                console.log(mathInput);

                http.post('./recalculate/', {input: mathInput}).
                    success(function (data) {
                        processModifiedPoints(route, data);
                    });
            }
        };

        function processModifiedPoints(changedRoute, data) {
            console.log('recalculate success!');
            console.log(data);
            //console.log(rawData);
            //console.log(changedRoute);

            if (data.status == 'error' || data.solutions.length == 0 || data.solutions[0].routes.length != 1) {
                console.log('Bad data');
                showPopup('Автоматический пересчет не удался.');
                return;
            }

            console.log('MATH DATE >> ', new Date(_data.server_time * 1000));

            var tmpRawRoute,
                toMove = [],
                newData = data.solutions[0].routes[0].deliveries,
                tmpPoint,
                routeIndx;

            for (var i = 0; i < rawData.routes.length; i++) {
                if (_data.routes[i].ID == changedRoute.ID) {
                    tmpRawRoute = rawData.routes[i];
                    tmpRawRoute.recalcIter = _data.routes[i].recalcIter;
                    routeIndx = i;
                    break;
                }
            }

            for (var i = 0, j = 0; i < changedRoute.points.length; i++, j++) {
                if (changedRoute.points[i].status != STATUS.FINISHED &&
                    changedRoute.points[i].status != STATUS.FINISHED_LATE &&
                    changedRoute.points[i].status != STATUS.FINISHED_TOO_EARLY) {

                    for (var k = 0; k < newData.length; k++) {
                        if (newData[k].pointId == changedRoute.points[i].waypoint.gIndex) {
                            tmpPoint = tmpRawRoute.points.splice(j, 1)[0];
                            tmpPoint.ARRIVAL_TIME = filter('date')((newData[k].arrival * 1000), 'dd.MM.yyyy HH:mm:ss');
                            toMove.push(tmpPoint);
                            j--;
                            break;
                        }
                    }
                }
            }

            //console.log(toMove);

            for (i = 0; i < newData.length; i++) {
                for (var j = 0; j < toMove.length; j++) {
                    if (newData[i].pointId == toMove[j].waypoint.gIndex) {
                        tmpRawRoute.points.push(JSON.parse(JSON.stringify(toMove[j])));
                    }
                }
            }

            for (i = 0; i < tmpRawRoute.points.length; i++) {
                tmpRawRoute.points[i].NUMBER = i + 1;
            }

            tmpRawRoute.toSave = true;
            tmpRawRoute.change_timestamp = data.timestamp;

            http.get('./routerdata?routeIndx=' + routeIndx).
                success(function (data) {
                    console.log('routerdata DONE!');
                    console.log(data);
                    tmpRawRoute.plan_geometry = data.geometry;
                    tmpRawRoute.time_matrix = data.time_matrix;

                    linkDataParts(rawData);
                    if (loadParts) {
                        loadTrackParts();
                    }
                });
        }

        scope.saveRoutes = function () {
            console.log('saveRoutes');

            var routes = [],
                route,
                point;
            for (var i = 0; i < _data.routes.length; i++) {
                if (_data.routes[i].toSave || i == 0) {
                    route = {
                        itineraryID: _data.routes[i].itineraryID,
                        routesID: _data.routes[i].ID,
                        transportID: _data.routes[i].transport.ID,
                        routeNumber: _data.routes[i].NUMBER,
                        change_timestamp: _data.routes[i].change_timestamp,
                        driver: _data.routes[i].DRIVER,
                        startTime: _data.routes[i].START_TIME,
                        endTime: _data.routes[i].END_TIME,
                        time: _data.routes[i].TIME,
                        value: _data.routes[i].VALUE,
                        distance: _data.routes[i].DISTANCE,
                        numberOfTasks: _data.routes[i].NUMBER_OF_TASKS,
                        points: []
                    };

                    for (var j = 0; j < _data.routes[i].points.length; j++) {
                        point = _data.routes[i].points[j];
                        route.points.push({
                            taskNumber: point.TASK_NUMBER,
                            stepNumber: point.NUMBER,
                            arrivalTime: point.arrival_time_ts,
                            startWaypointId: point.START_WAYPOINT,
                            endWaypointId: point.END_WAYPOINT,
                            startLatLon: {
                                lat: point.LAT,
                                lon: point.LON
                            },
                            endLatLon: {
                                lat: point.END_LAT,
                                lon: point.END_LON
                            },
                            taskTime: point.TASK_TIME,
                            downtime: point.DOWNTIME,
                            travelTime: point.TRAVEL_TIME,
                            distance: point.DISTANCE,
                            startTime: point.START_TIME,
                            endTime: point.END_TIME,
                            taskDate: point.TASK_DATE,
                            weight: point.WEIGHT,
                            volume: point.VOLUME
                        });
                    }

                    routes.push(route);
                }
            }

            if (routes.length == 0) return;

            console.log('sending routes to save', routes);

            http.post('./saveroute/', {routes: routes}).
                success(function (data) {
                    console.log(data);
                    for (var i = 0; i < _data.routes.length; i++) {
                        delete _data.routes[i].toSave;
                    }
                });
        };


        function cancelPoint(row_id) {
            var point = scope.displayCollection[row_id];
            point.status = STATUS.CANCELED;
        }

    }]);