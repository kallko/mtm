angular.module('MTMonitor').controller('PointIndexController', ['$scope', '$http', '$timeout', '$interval',
    function (scope, http, timeout, interval) {

        var pointTableHolder,
            pointContainer,
            pointTable,
            _data,
            dataUpdateInterval = 180,
            trackUpdateInterval = 60,
            radius = 0.25,
            controlledWindow = 600,
            promisedWindow = 3600,
            STATUS = {
                FINISHED: 0,
                IN_PROGRESS: 1,
                ARRIVED_LATE: 2,
                DELAY: 3,
                //FOCUS_L1: 4,
                //FOCUS_L2: 5,
                SCHEDULED: 6,
                CANCELED: 7
            };

        setListeners();
        init();
        loadDailyData(false);
        // setDynamicDataUpdate(dataUpdateInterval);
        // setRealTrackUpdate(trackUpdateInterval);

        function init() {
            scope.rowCollection = [];
            scope.displayCollection = [].concat(scope.rowCollection);
            scope.filters = {};
            scope.filters.statuses = [
                {name: 'все', value: -1, class: 'all-status'},
                {name: 'доставленно', value: STATUS.FINISHED, class: 'delivered-status'},
                {name: 'выполняется', value: STATUS.IN_PROGRESS, class: 'performed-status'},
                {name: 'опоздал', value: STATUS.ARRIVED_LATE, class: 'arrived-late-status'},
                {name: 'опаздывает', value: STATUS.DELAY, class: 'delay-status'},
                //{name: 'под контролем', value: 4, class: 'controlled-status'},
                //{name: 'ожидают выполнения', value: 5, class: 'awaiting-status'},
                {name: 'запланирован', value: STATUS.SCHEDULED, class: 'scheduled-status'},
                {name: 'отменен', value: STATUS.CANCELED, class: 'canceled-status'}
            ];
            scope.filters.status = scope.filters.statuses[0].value;
            scope.filters.drivers = [{name: 'все', value: -1}];
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

                if (_data.trackUpdateTime == undefined) {
                    _data.trackUpdateTime = _data.server_time;
                }

                var _now = Date.now() / 1000,
                    url = '/trackparts/' + _data.trackUpdateTime + '/' + _now;

                http.get(url)
                    .success(function (trackParts) {
                        addTrackParts(trackParts);
                    });

                // updateData();
            }, seconds * 1000);
        }

        function addTrackParts(trackParts) {
            console.log('trackparts');
            console.log(new Date(_data.trackUpdateTime * 1000));
            console.log(new Date(_now * 1000));
            console.log(trackParts);

            for (var i = 0; i < trackParts.length; i++) {
                for (var j = 0; j < _data.routes.length; j++) {
                    if (_data.routes[j].transport.gid == trackParts[i].gid) {
                        if (trackParts[i].data.length > 0) {
                            trackParts[i].data[0].state = 'MOVE';
                            _data.routes[j].real_track = _data.routes[j].real_track.concat(trackParts[i].data);

                            var len = _data.routes[j].real_track.length - 1;
                            _data.routes[j].car_position = _data.routes[j].real_track[len].
                                coords[_data.routes[j].real_track[len].coords.length - 1];
                        }
                        break;
                    }
                }
                ;
            }
            _data.trackUpdateTime = _now;
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
                    console.log('loadDailyData success');
                    linkDataParts(data);
                });
        }

        function strToTstamp(strDate) {
            var parts = strDate.split(' '),
                _date = parts[0].split('.'),
                _time = parts[1].split(':');

            return new Date(_date[2], _date[1] - 1, _date[0], _time[0], _time[1], _time[2]).getTime() / 1000;
        }

        function getTstampAvailabilityWindow(strWindows) {
            if (strWindows == '') {
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
            console.log('Start linking ...');

            var tmpPoints,
                rowId = 0,
                driverId = 0,
                len = 0,
                tPoint;
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
                            data.routes[i].real_track != "invalid parameter 'gid'. ") {
                            len = data.routes[i].real_track.length - 1;
                            //console.log('NOT NULL', data.routes[i].real_track.length);
                            data.routes[i].car_position = data.routes[i].real_track[len].
                                coords[data.routes[i].real_track[len].coords.length - 1];
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
                            name: data.routes[i].driver.NAME,
                            value: data.routes[i].driver._id
                        });
                        driverId++;
                    }

                    tPoint.driver_indx = data.routes[i].driver._id;
                    tPoint.transport = data.routes[i].transport;
                    tPoint.arrival_time_hhmm = tPoint.ARRIVAL_TIME.substr(11, 8);
                    tPoint.arrival_time_ts = strToTstamp(tPoint.ARRIVAL_TIME);
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
                    } else {
                        tPoint.status = STATUS.SCHEDULED;
                    }

                    tPoint.route_id = i;
                    rowId++;

                    for (var k = 0; k < data.waypoints.length; k++) {
                        if (tPoint.START_WAYPOINT == data.waypoints[k].ID) {
                            tPoint.waypoint = data.waypoints[k];
                            break;
                        }
                    }

                    tPoint.windows = getTstampAvailabilityWindow(tPoint.AVAILABILITY_WINDOWS);
                    if (tPoint.windows != undefined) {
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

            console.log(data);
            console.log({'data': scope.rowCollection});
            scope.displayCollection = [].concat(scope.rowCollection);

            console.log('Finish linking ...');
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
                        _data.routes[i].points[j].promised_window.finish - 900 < now &&
                        _data.routes[i].points[j].promised_window.finish > now) {
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
                END_LAT,
                END_LON,
                lat,
                lon,
                focus_l1_time = 60 * 30,
                focus_l2_time = 60 * 120,
                now = _data.server_time,
                lastPoint;

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
                                END_LAT = parseFloat(tmpPoint.END_LAT);
                                END_LON = parseFloat(tmpPoint.END_LON);
                                lat = parseFloat(tmpArrival.lat);
                                lon = parseFloat(tmpArrival.lon);

                                if (tmpPoint.status != STATUS.FINISHED
                                    && tmpPoint.status != STATUS.CANCELED
                                    && getDistanceFromLatLonInKm(lat, lon, END_LAT, END_LON) < radius
                                    && tmpPoint.arrival_time_ts + timeOffset > tmpArrival.t1
                                    && tmpPoint.arrival_time_ts - timeOffset < tmpArrival.t1) {
                                    tmpPoint.status = STATUS.FINISHED;
                                    route.lastPointIndx = k;
                                    tmpPoint.real_arrival_time = tmpArrival.t1;

                                    lastIndex = tmpPoint.NUMBER;

                                    //break;
                                }
                            }
                        }
                    }

                    lastPoint = route.points[route.lastPointIndx];
                    if (lastPoint != null) {
                        if (lastPoint.arrival_time_ts + parseInt(lastPoint.TASK_TIME) > now
                            && getDistanceFromLatLonInKm(route.car_position.lat, route.car_position.lon,
                                lastPoint.END_LAT, lastPoint.END_LON) < radius) {
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

                // route.mobile_buttons = [
                //     {
                //          'number' : 777,
                //          'time': '10.10.2015 12:00:00',
                //          'canceled': false,
                //          'cancel_reason': 'cancel cancel_reason',
                //          'lat': 50,
                //          'lon': 50,
                //          'gps_time': '10.10.2015 12:00:00'
                //     }
                // ];

                if (route.mobile_buttons != undefined) {
                    for (var j = 0; j < route.mobile_buttons.length; j++) {
                        for (var k = 0; k < route.points.length; k++) {
                            tmpPoint = route.points[k];
                            END_LAT = parseFloat(tmpPoint.END_LAT);
                            END_LON = parseFloat(tmpPoint.END_LON);
                            lat = route.mobile_buttons[j].lat;
                            lon = route.mobile_buttons[j].lon;

                            if (tmpPoint.status != STATUS.FINISHED
                                && tmpPoint.status != STATUS.CANCELED
                                && getDistanceFromLatLonInKm(lat, lon, END_LAT, END_LON) < radius
                                && tmpPoint.arrival_time_ts + buttonTimeOffset > route.mobile_buttons[j].time
                                && tmpPoint.arrival_time_ts - buttonTimeOffset < route.mobile_buttons[j].time) {
                                tmpPoint.status = STATUS.FINISHED;
                                route.lastPointIndx = k > route.lastPointIndx ? k : route.lastPointIndx;
                                tmpPoint.real_arrival_time = route.mobile_buttons[j].time;

                                lastIndex = tmpPoint.NUMBER;

                                //break;
                            }
                        }
                    }
                }
            }
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

            console.log(new Date(_data.server_time * 1000));
            for (var i = 0; i < _data.routes.length; i++) {
                route = _data.routes[i];
                if (route.real_track == undefined ||
                    route.real_track.length == 0 ||
                    route.real_track == "invalid parameter 'gid'. ") {
                    route.real_track = undefined;
                    continue;
                }

                point = route.car_position;
                //console.log({car: route.car_position, real_track: route.real_track});
                url = '/findtime2p/' + point.lat + '&' + point.lon + '&'
                    + route.points[route.lastPointIndx].END_LAT + '&' + route.points[route.lastPointIndx].END_LON;

                (function (_route) {
                    http.get(url).
                        success(function (data) {
                            var lastPoint = _route.lastPointIndx + 1,
                                nextPointTime = parseInt(data.time_table[0][1][0] / 10),
                                totalWorkTime = 0,
                                totalTravelTime = 0;

                            for (var j = 0; j < _route.points.length; j++) {
                                if (j < lastPoint) {
                                    _route.points[j].arrival_prediction = 0;
                                    _route.points[j].overdue_time = 0;
                                    if (_route.points[j].status == STATUS.SCHEDULED) {
                                        _route.points[j].status = STATUS.ARRIVED_LATE;
                                        _route.points[j].overdue_time = now - _route.points[j].arrival_time_ts;
                                    } else if (_route.points[j].status == STATUS.IN_PROGRESS) {
                                        totalWorkTime = parseInt(_route.points[j].TASK_TIME) - (now - _route.points[j].real_arrival_time);
                                        //console.log('now - real_arrival_time', now - _route.points[j].real_arrival_time,
                                        //    'TASK_TIME', _route.points[j].TASK_TIME);
                                        //console.log('now', new Date(now * 1000),
                                        //    'real_arrival_time', new Date(_route.points[j].real_arrival_time * 1000));
                                    }
                                } else {
                                    totalTravelTime += _route.time_matrix.time_table[0][j - 1][j] / 10;
                                    tmpPred = now + nextPointTime + totalWorkTime + totalTravelTime;
                                    _route.points[j].arrival_prediction = now + nextPointTime + totalWorkTime + totalTravelTime;
                                    //console.log('now', now, 'nextPointTime', nextPointTime, 'totalWorkTime', totalWorkTime,
                                    //    'totalTravelTime', totalTravelTime);

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
                                        _route.points[j].overdue_time = parseInt(_route.points[j].arrival_prediction - _route.points[j].arrival_time_ts);

                                        if (_route.points[j].overdue_time > controlledWindow) {
                                            if (_route.points[j].arrival_time_ts < now) {
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
                pointTableHolder.height(pointContainer.height() - 50);
                pointTableHolder.width(pointContainer.width() - 10);
                //$('.header-copy').show();
                //console.log('stateChanged', $('.lm_dragProxy').length);

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
            });

            //document.oncontextmenu = function () {
            //    return false;
            //};
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
                    lat: scope.displayCollection[id].END_LAT,
                    lon: scope.displayCollection[id].END_LON
                });
            }
        };

        scope.getTextStatus = function (statusCode, row_id) {
            for (var i = 0; i < scope.filters.statuses.length; i++) {
                if (scope.filters.statuses[i].value == statusCode) {
                    var object = $('#status-td-' + row_id);
                    object.removeClass();
                    object.addClass(scope.filters.statuses[i].class);
                    return scope.filters.statuses[i].name;
                }
            }

            console.log(statusCode);
            return 'неизвестный статус';
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

        scope.sortByDriver = function (indx) {
            if (scope.filters.driver == indx) {
                scope.filters.driver = -1;
            } else {
                scope.filters.driver = indx;
            }
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
            var indx;

            if (scope.filters.driver != -1) {
                indx = scope.filters.driver;
            } else if (scope.selectedRow != -1) {
                indx = scope.displayCollection[scope.selectedRow].route_id;
            } else {
                return;
            }

            scope.$emit('clearMap');
            switch (scope.draw_mode) {
                case scope.draw_modes[0].value: // комбинированный
                    scope.$emit('drawCombinedTrack', _data.routes[indx]);
                    break;
                case scope.draw_modes[1].value: // фактический
                    scope.$emit('drawRealTrack', _data.routes[indx]);
                    break;
                case scope.draw_modes[2].value: // плановый
                    scope.$emit('drawPlannedTrack', _data.routes[indx]);
                    break;
                case scope.draw_modes[3].value: // плановый + фактический
                    scope.$emit('drawRealAndPlannedTrack', _data.routes[indx]);
                    break;
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
    }]);
