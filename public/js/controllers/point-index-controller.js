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
            mobileRadius = 0.5,
            controlledWindow = 600,
            promisedWindow = 3600,
            problemSortType = 0,
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
                    name: 'доставлено поздно',
                    table_name: 'доставлено',
                    value: STATUS.FINISHED_LATE,
                    class: 'delivered-late-status'
                },
                {
                    name: 'доставлено рано',
                    table_name: 'доставлено',
                    value: STATUS.FINISHED_TOO_EARLY,
                    class: 'delivered-too-early-status'
                },
                {name: 'выполняется', value: STATUS.IN_PROGRESS, class: 'performed-status'},
                {name: 'время вышло', value: STATUS.ARRIVED_LATE, class: 'arrived-late-status'},
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
            scope.filters.routes = [{name: 'все маршруты', value: -1}];
            scope.filters.route = scope.filters.routes[0].value;
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
            scope.filters.text = "";
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
                routeId = 0,
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
                        data.drivers[j].NAME = cutFIO(data.drivers[j].NAME);
                        data.routes[i].driver = data.drivers[j];
                        break;
                    }
                }

                tmpPoints = data.routes[i].points;
                for (j = 0; j < tmpPoints.length; j++) {
                    tPoint = tmpPoints[j];
                    tPoint.driver = data.routes[i].driver;
                    tPoint.in_plan = true;
                    if (data.routes[i].filterId == null) {
                        data.routes[i].filterId = routeId;
                        scope.filters.routes.push({
                            name: data.routes[i].transport.NAME + ' - ' + data.routes[i].driver.NAME,
                            value: data.routes[i].filterId
                        });
                        routeId++;
                    }

                    tPoint.route_indx = data.routes[i].filterId;
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
                    tPoint.status = STATUS.SCHEDULED;

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


        function cutFIO(fioStr) {
            var parts = fioStr.split(' ');
            return parts[0] + ' ' + parts[1];
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
                LAT,
                LON,
                lat,
                lon,
                now = _data.server_time,
                lastPoint,
                tmpDistance,
                tmpTime;

            for (var i = 0; i < _data.routes.length; i++) {
                for (var j = 0; j < _data.routes[i].points.length; j++) {
                    _data.routes[i].points[j].status = STATUS.SCHEDULED;
                }
            }

            for (i = 0; i < _data.routes.length; i++) {
                route = _data.routes[i];
                route.lastPointIndx = 0;
                if (route.real_track != undefined) {
                    for (j = 0; j < route.real_track.length; j++) {
                        if (route.real_track[j].state == "ARRIVAL") {
                            tmpArrival = route.real_track[j];
                            for (var k = 0; k < route.points.length; k++) {
                                tmpPoint = route.points[k];
                                LAT = parseFloat(tmpPoint.LAT);
                                LON = parseFloat(tmpPoint.LON);
                                lat = parseFloat(tmpArrival.lat);
                                lon = parseFloat(tmpArrival.lon);

                                tmpPoint.distanceToStop = tmpPoint.distanceToStop || 2000000000;
                                tmpPoint.timeToStop = tmpPoint.timeToStop || 2000000000;

                                tmpDistance = getDistanceFromLatLonInKm(lat, lon, LAT, LON);
                                tmpTime = Math.abs(tmpPoint.arrival_time_ts - tmpArrival.t1);
                                if (tmpDistance < radius && (tmpPoint.distanceToStop > tmpDistance &&
                                    tmpPoint.timeToStop > tmpTime)) {

                                    tmpPoint.distanceToStop = tmpDistance;
                                    tmpPoint.timeToStop = tmpTime;
                                    tmpPoint.haveStop = true;
                                    route.lastPointIndx = k > route.lastPointIndx ? k : route.lastPointIndx;
                                    tmpPoint.stop_arrival_time = tmpArrival.t1;
                                    tmpPoint.real_arrival_time = tmpArrival.t1;

                                    findStatusAndWindowForPoint(tmpPoint);
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
                checkConfirmedFromLocalStorage();
                return;
            }

            //TODO REMOVE
            console.log([_data.ID, getTodayStrFor1C()]);
            //_data.mobile_buttons = parentForm._call('getDriversActions', [_data.ID == '28' ? '28/2' : _data.ID, getTodayStrFor1C()]);
            //console.log('_data.mobile_buttons', _data.mobile_buttons);
            //console.log('28/2', parentForm._call('getDriversActions', ['28/2', getTodayStrFor1C()]));
            //console.log('28', parentForm._call('getDriversActions', ['28', getTodayStrFor1C()]));

            _data.mobile_buttons = parentForm._call('getDriversActions', [_data.ID, getTodayStrFor1C()]);

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

            // TODO: FIX если есть проверка по кнопкам, не совсем корректно работает пересчет

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
                        if (_data.mobile_buttons[i].gps_time_ts == undefined) {
                            if (_data.mobile_buttons[i].gps_time) {
                                _data.mobile_buttons[i].gps_time_ts = strToTstamp(_data.mobile_buttons[i].gps_time);
                            } else {
                                _data.mobile_buttons[i].gps_time_ts = 0;
                            }
                        }

                        if (_data.mobile_buttons[i].number == tmpPoint.TASK_NUMBER
                            && getDistanceFromLatLonInKm(lat, lon, LAT, LON) < mobileRadius
                        ) {
                            tmpPoint.mobile_push = _data.mobile_buttons[i];
                            tmpPoint.havePush = true;
                            tmpPoint.mobile_arrival_time = _data.mobile_buttons[i].gps_time_ts;
                            tmpPoint.real_arrival_time = tmpPoint.real_arrival_time || _data.mobile_buttons[i].gps_time_ts;
                            tmpPoint.confirmed = tmpPoint.confirmed || tmpPoint.haveStop;
                            _data.routes[j].lastPointIndx = k > _data.routes[j].lastPointIndx ? k : _data.routes[j].lastPointIndx;
                            findStatusAndWindowForPoint(tmpPoint);
                            break;
                        }
                    }
                }
            }

            checkConfirmedFromLocalStorage();
        }

        function checkConfirmedFromLocalStorage() {
            if (!localStorage['confirmed'] || localStorage['confirmed'] == '[object Object]') {
                localStorage['confirmed'] = '{}';
                return;
            }

            var confirmedObj = JSON.parse(localStorage['confirmed']),
                point,
                row,
                confirmed;

            for (var i = 0; i < scope.rowCollection.length; i++) {
                confirmed = confirmedObj[scope.rowCollection[i].TASK_NUMBER];
                if (confirmed == undefined) continue;

                row = scope.rowCollection[i];
                row.rawConfirmed = confirmed;
                point = rawData.routes[row.route_id].points[row.NUMBER - 1];
                point.rawConfirmed = row.rawConfirmed;

                if (scope.rowCollection[i].rawConfirmed === 1) {
                    row.confirmed = true;
                } else if (scope.rowCollection[i].rawConfirmed === -1) {
                    if (_data.server_time > row.promised_window_changed.finish) {
                        row.status = STATUS.ARRIVED_LATE;
                    } else {
                        row.status = STATUS.DELAY;
                    }
                }

                point.checkedStatus = row.status;
            }
        }

        function findStatusAndWindowForPoint(tmpPoint) {
            tmpPoint.windowType = WINDOW_TYPE.OUT_WINDOWS;
            if (tmpPoint.promised_window_changed.start < tmpPoint.real_arrival_time
                && tmpPoint.promised_window_changed.finish > tmpPoint.real_arrival_time) {
                tmpPoint.windowType = WINDOW_TYPE.IN_PROMISED;
            } else {
                for (var l = 0; tmpPoint.windows != undefined && l < tmpPoint.windows.length; l++) {
                    if (tmpPoint.windows[l].start < tmpPoint.real_arrival_time
                        && tmpPoint.windows[l].finish > tmpPoint.real_arrival_time) {
                        tmpPoint.windowType = WINDOW_TYPE.IN_ORDERED;
                        break;
                    }
                }
            }

            if (tmpPoint.rawConfirmed !== -1) {
                if (tmpPoint.real_arrival_time > tmpPoint.promised_window_changed.finish) {
                    tmpPoint.status = STATUS.FINISHED_LATE;
                } else if (tmpPoint.real_arrival_time < tmpPoint.promised_window_changed.start) {
                    tmpPoint.status = STATUS.FINISHED_TOO_EARLY;
                } else {
                    tmpPoint.status = STATUS.FINISHED;
                }
            } else {

            }
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

            for (i = 0; i < scope.rowCollection.length; i++) {
                scope.rowCollection[i].problem_index = scope.rowCollection[i].problem_index || 0;
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
                return scope.filters.route + scope.filters.status + scope.filters.problem_index;
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

            $('.header .problem-index-col').on('click', function () {
                problemSortType++;
                problemSortType = problemSortType % 3;
                console.log(problemSortType);
            });
        }

        function addToConfirmed(id, code) {
            if (localStorage['confirmed'] == undefined) {
                localStorage['confirmed'] = '{}';
            }

            var obj = JSON.parse(localStorage['confirmed']);
            obj[id] = code;
            localStorage['confirmed'] = JSON.stringify(obj);
            console.log(obj);
        }

        function deliveryRowConextMenu(context, e) {
            var option = $(e.target).data("menuOption");
            console.log(option);
            var contextJ = $(context)[0],
                row = scope.rowCollection[parseInt(contextJ.id.substr(6))],
                point = rawData.routes[row.route_id].points[row.NUMBER - 1],
                needChanges = !(row.confirmed && (row.status == STATUS.FINISHED
                || row.status == STATUS.FINISHED_LATE || row.status == STATUS.FINISHED_TOO_EARLY));

            switch (option) {
                case 'sort':
                    sortByRoute(row.route_indx);
                    return;
                case 'confirm-status':
                    if (!needChanges) return;
                    row.confirmed = true;
                    point.rawConfirmed = 1;
                    addToConfirmed(point.TASK_NUMBER, point.rawConfirmed);
                    break;
                case 'not-delivered-status':
                    if (!needChanges) return;

                    if (_data.server_time > row.promised_window_changed.finish) {
                        row.status = STATUS.ARRIVED_LATE;
                    } else {
                        row.status = STATUS.DELAY;
                    }
                    point.rawConfirmed = -1;
                    addToConfirmed(point.TASK_NUMBER, point.rawConfirmed);
                    break;
                case 'cancel-point':
                    row.status = STATUS.CANCELED;
                    break;
            }

            point.checkedStatus = row.status;
            scope.$apply();

            // TODO: подсветить строку под меню
        }

        function sortByRoute(indx) {
            if (scope.filters.route == indx) {
                scope.filters.route = -1;
            } else {
                scope.filters.route = indx;
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
                scope.$emit('setMapCenter', {
                    lat: scope.displayCollection[id].LAT,
                    lon: scope.displayCollection[id].LON
                });

                scope.selectedRow = id;
                $('#point-' + id).addClass('selected-row');
                scope.$emit('highlightPointMarker', scope.displayCollection[id]);
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

        scope.routeFilter = function (row) {
            return (scope.filters.route == -1 || row.route_indx == scope.filters.route);
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
            } else if (scope.filters.route != -1) {
                scope.$emit('drawPlannedTrack', _data.routes[scope.filters.route]);
            }
        };

        scope.drawRoute = function () {
            scope.$emit('clearMap');

            var indx,
                route,
                draw = function (route) {
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

            if (scope.filters.route != -1) {
                indx = scope.filters.route;
            } else if (scope.selectedRow != -1) {
                indx = scope.displayCollection[scope.selectedRow].route_id;
            } else {
                return;
            }

            route = _data.routes[indx];

            if (scope.draw_mode == scope.draw_modes[2].value) {
                scope.$emit('drawPlannedTrack', route);
                return;
            }

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

                timeout(function () {
                    setProblemIndexSortMode(2);
                }, 100);
            } else {
                scope.filters.problem_index = -1;
                timeout(function () {
                    setProblemIndexSortMode(0);
                }, 100);
            }
        };

        function setProblemIndexSortMode(mode) {
            timeout(function () {
                if (mode != problemSortType) {
                    $('.header .problem-index-col').trigger('click');
                    setProblemIndexSortMode(mode);
                }
            }, 10);
        }

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

            if (scope.filters.route != -1) {
                route = _data.routes[scope.filters.route];
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
                                lat: point.START_LAT,
                                lon: point.START_LON
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

        scope.setTextFilter = function () {
            scope.filters.text = $("#search-input").val();
        };

        scope.cancelTextFilter = function () {
            $("#search-input").val('');
            scope.filters.text = '';
        };

        scope.textFilter = function (row) {
            if (scope.filters.text === "") return true;
            if (row.waypoint == undefined) return false;

            return row.waypoint.NAME.indexOf(scope.filters.text) >= 0
                || row.driver.NAME.indexOf(scope.filters.text) >= 0
                || row.waypoint.ADDRESS.indexOf(scope.filters.text) >= 0
                || row.waypoint.COMMENT.indexOf(scope.filters.text) >= 0
                || row.NUMBER.indexOf(scope.filters.text) >= 0
                || row.transport.NAME.indexOf(scope.filters.text) >= 0
                || row.driver.PHONE.indexOf(scope.filters.text) >= 0
                || row.transport.REGISTRATION_NUMBER.indexOf(scope.filters.text) >= 0;
        };

    }]);