angular.module('MTMonitor').controller('PointIndexController', ['$scope', '$http', '$timeout', function (scope, http, timeout) {

    var pointTableHolder,
        pointContainer,
        pointTable,
        _data,
        STATUS = {
            FINISHED: 0,
            ARRIVED_LATE: 1,
            DELAY: 2,
            FOCUS_L1: 3,
            FOCUS_L2: 4,
            SCHEDULED: 5,
            CANCELED: 6
        };

    setListeners();
    init();
    loadDailyData();

    function init() {
        scope.rowCollection = [];
        scope.displayCollection = [].concat(scope.rowCollection);
        scope.filters = {};
        scope.filters.statuses = [
            {name: 'все', value: -1},
            {name: 'доставленно', value: 0},
            {name: 'опоздал', value: 1},
            {name: 'опаздывает', value: 2},
            {name: 'под контролем', value: 3},
            {name: 'ожидают выполнения', value: 4},
            {name: 'запланирован', value: 5},
            {name: 'отменен', value: 6}
        ];
        scope.filters.status = scope.filters.statuses[0].value;
        scope.filters.drivers = [{name: 'все', value: -1}];
        scope.filters.driver = scope.filters.drivers[0].value;
        scope.draw_modes = [
            {name: 'комбинированный трек', value: 0},
            {name: 'фактический трек', value: 1},
            {name: 'плановый трек', value: 2},
            {name: 'фактический + плановый трек', value: 3}
        ];
        scope.draw_mode = scope.draw_modes[0].value;

        scope.selectedRow = -1;
    }

    function loadDailyData() {
        http.get('/dailydata', {})
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
                start: startDate.getTime() / 1000,
                finish: finishDate.getTime() / 1000
            });
        }

        return resWindows;
    }

    function linkDataParts(data) {
        console.log('Start linking ...');

        var tmpPoints,
            rowId = 0,
            driverId = 0;
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
                tmpPoints[j].driver = data.routes[i].driver;
                if (data.routes[i].driver._id == null) {
                    data.routes[i].driver._id = driverId;
                    scope.filters.drivers.push({
                        name: data.routes[i].driver.NAME,
                        value: data.routes[i].driver._id
                    });
                    driverId++;
                }

                tmpPoints[j].driver_indx = data.routes[i].driver._id;
                tmpPoints[j].transport = data.routes[i].transport;
                tmpPoints[j].arrival_time_hhmm = tmpPoints[j].ARRIVAL_TIME.substr(11, 8);
                tmpPoints[j].arrival_time_ts = strToTstamp(tmpPoints[j].ARRIVAL_TIME);
                tmpPoints[j].end_time_hhmm = tmpPoints[j].END_TIME.substr(11, 8);
                tmpPoints[j].end_time_ts = strToTstamp(tmpPoints[j].END_TIME);
                tmpPoints[j].row_id = rowId;
                tmpPoints[j].arrival_prediction = 0;
                tmpPoints[j].arrival_left_prediction = 0;
                if (j == 0) {
                    tmpPoints[j].status = STATUS.FINISHED;
                } else {
                    tmpPoints[j].status = STATUS.SCHEDULED;
                }

                tmpPoints[j].route_id = i;
                rowId++;

                for (var k = 0; k < data.waypoints.length; k++) {
                    if (tmpPoints[j].START_WAYPOINT == data.waypoints[k].ID) {
                        tmpPoints[j].waypoint = data.waypoints[k];
                        break;
                    }
                }

                for (k = 0; k < data.tasks.length; k++) {
                    if (tmpPoints[j].TASK_NUMBER == data.tasks[k].NUMBER) {
                        //tmpPoints[j].task = data.tasks[k];
                        tmpPoints[j].availability_windows_str = data.tasks[k].AVAILABILITY_WINDOWS;
                        tmpPoints[j].windows = getTstampAvailabilityWindow(tmpPoints[j].availability_windows_str);
                        break;
                    }
                }
            }

            scope.rowCollection = scope.rowCollection.concat(data.routes[i].points);

            //loadTrack(data.routes[i].transport.gid, i);
            statusUpdate(i, data);
        }

        _data = data;
        predicationArrivalUpdate();
        //updateProblemIndex();
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

    function randomInteger(min, max) {
        var rand = min + Math.random() * (max - min)
        rand = Math.round(rand);
        return rand;
    }

    function lineDistance(point1, point2) {
        var xs = 0;
        var ys = 0;

        xs = point2.lat - point1.lat;
        xs = xs * xs;

        ys = point2.lon - point1.lon;
        ys = ys * ys;

        return Math.sqrt(xs + ys);
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

    function statusUpdate(routeIndx, data) {
        var route = data.routes[routeIndx],
            tmpPoint,
            tmpArrival,
            radius = 0.5,
            timeOffset = 3600,
            END_LAT,
            END_LON,
            lat,
            lon,
            focus_l1_time = 60 * 30,
            focus_l2_time = 60 * 120,
            now = data.server_time;

        for (var j = 0; j < route.real_track.length; j++) {
            if (route.real_track[j].state == "ARRIVAL") {
                tmpArrival = route.real_track[j];
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
                        break;
                    }
                }
            }
        }

        for (j = 0; j < route.points.length; j++) {
            tmpPoint = route.points[j];
            if (tmpPoint.status != STATUS.FINISHED &&
                tmpPoint.status != STATUS.CANCELED) {
                if (now + focus_l2_time > tmpPoint.arrival_time_ts) {
                    if (now + focus_l1_time > tmpPoint.arrival_time_ts) {
                        tmpPoint.status = STATUS.FOCUS_L1;
                    } else {
                        tmpPoint.status = STATUS.FOCUS_L2;
                    }
                }
            }
        }
    }

    function updateProblemIndex(route) {
        var point,
            clientStatusCoef = 0,
            orderValueCoef = 0,
            howSoonCoef = 0.1,
            lateMinutesCoef = 1.0;

        for (var j = 0; j < route.points.length; j++) {
            point = route.points[j];
            point.problemlIndex = parseInt(point.arrival_left_prediction * howSoonCoef);
            //if (route.ID == '3') {
            //    console.log(point.problemlIndex);
            //}
        }
    }

    function predicationArrivalUpdate() {
        var route,
            url,
            len,
            point,
            now = _data.server_time; //Date.now();

        console.log(_data.server_time);
        for (var i = 0; i < _data.routes.length; i++) {
            route = _data.routes[i];
            len = route.real_track.length - 1;
            point = route.real_track[len].coords[route.real_track[len].coords.length - 1];
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
                            } else {
                                totalTravelTime += _route.time_matrix.time_table[0][j - 1][j] / 10;
                                if (_route.ID == '3') {
                                    // console.log(_route.time_matrix.time_table[0][j - 1][j] / 10, totalTravelTime);
                                }
                                _route.points[j].arrival_prediction = now + nextPointTime + totalWorkTime + totalTravelTime;
                                _route.points[j].arrival_left_prediction = parseInt(_route.points[j].arrival_prediction - now);
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
            return scope.filters.driver + scope.filters.status;
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
            protoStatusTH = header.find('.status-col');

        headerCopy.find('.status-col').on('click', function () {
            protoStatusTH.trigger('click');
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

    scope.getTextStatus = function (statusCode) {
        for (var i = 0; i < scope.filters.statuses.length; i++) {
            if (scope.filters.statuses[i].value == statusCode) {
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

        console.log('drawRoute', scope.draw_mode, indx);
        scope.$emit('clearMap');
        switch (scope.draw_mode) {
            case scope.draw_modes[0].value: // комбинированный
                console.log(scope.draw_modes[0].name);
                scope.$emit('drawCombinedTrack', _data.routes[indx]);
                break;
            case scope.draw_modes[1].value: // фактический
                console.log(scope.draw_modes[1].name);
                scope.$emit('drawRealTrack', _data.routes[indx]);
                break;
            case scope.draw_modes[2].value: // плановый
                console.log(scope.draw_modes[2].name);
                scope.$emit('drawPlannedTrack', _data.routes[indx]);
                break;
            case scope.draw_modes[3].value: // плановый + фактический
                console.log(scope.draw_modes[3].name);
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

    function loadTrack(gid, routeIndx) {
        var now = new Date(),
            todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000,
            tomorrowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() / 1000;

        var query = '/tracks/' + gid + '&' + todayMidnight + '&' + tomorrowMidnight + '&60&1000&5&25&5&110';
        //console.log(query);

        http.get(query, {}).
            success(function (track) {
                _data.routes[routeIndx].real_track = track;
                statusUpdate(routeIndx);
            });
    }
}]);
