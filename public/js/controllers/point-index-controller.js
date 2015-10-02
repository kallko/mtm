angular.module('MTMonitor').controller('PointIndexController', ['$scope', '$http', '$timeout', function (scope, http, timeout) {

    var pointTableHolder,
        pointContainer,
        pointTable,
        _data,
        STATUS = {
            FINISHED: 0,
            FOCUS_L1: 1,
            FOCUS_L2: 2,
            SCHEDULED: 3,
            CANCELED: 4
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
            {name: 'выполненнен', value: 0},
            {name: 'под контролем', value: 1},
            {name: 'ожидают выполнения', value: 2},
            {name: 'запланирован', value: 3},
            {name: 'отменен', value: 4}
        ];
        scope.filters.status = scope.filters.statuses[0].value;
        scope.filters.drivers = [{name: 'все', value: -1}];
        scope.filters.driver = scope.filters.drivers[0].value;
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
                tmpPoints[j].status = STATUS.SCHEDULED;
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

            loadTrack(data.routes[i].transport.gid, i);
        }

        _data = data;
        scope.$emit('saveForDebug', scope.rowCollection);

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

    function statusUpdate(routeIndx) {
        var now = parseInt(Date.now() / 1000),
            route = _data.routes[routeIndx],
            tmpPoint,
            tmpArrival,
            focus_l1_time = 60 * 30,
            focus_l2_time = 60 * 120,
            radius = 0.4,
            timeOffset = 1800,
            END_LAT,
            END_LON,
            lat,
            lon;

        for (var j = 0; j < route.real_track.length; j++) {
            if (route.real_track[j].state == "ARRIVAL") {
                tmpArrival = route.real_track[j];
                for (var k = 0; k < route.points.length; k++) {
                    tmpPoint = route.points[k]; // END_LON
                    END_LAT = parseFloat(tmpPoint.END_LAT);
                    END_LON = parseFloat(tmpPoint.END_LON);
                    lat = parseFloat(tmpArrival.lat);
                    lon = parseFloat(tmpArrival.lon);

                    //console.log();

                    if (getDistanceFromLatLonInKm(lat, lon, END_LAT, END_LON) < radius
                        && tmpPoint.arrival_time_ts + timeOffset > tmpArrival.t1
                        && tmpPoint.arrival_time_ts - timeOffset < tmpArrival.t1
                    ) {

                        //if (route.ID == 3) {
                        //    console.log(tmpPoint.arrival_time_ts - tmpArrival.t1);
                        //}

                        tmpPoint.status = STATUS.FINISHED;
                        break;
                    }

                }
            }
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
        $(window).resize(resetHeight);
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
            protoStatusTH = header.find('.status-column');

        headerCopy.find('.status-column').on('click', function () {
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
        console.log('click on ' + id);
        $('.selected-row').removeClass('selected-row');
        $('#point-' + id).addClass('selected-row');
        scope.$emit('setMapCenter', {
            lat: scope.displayCollection[id].END_LAT,
            lon: scope.displayCollection[id].END_LON
        });
    };

    scope.getTextStatus = function (statusCode) {
        for (var i = 0; i < scope.filters.statuses.length; i++) {
            if (scope.filters.statuses[i].value == statusCode) {
                return scope.filters.statuses[i].name;
            }
        }

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
            scope.$emit('clearMap');
        } else {
            scope.filters.driver = indx;
            scope.$emit('drawTracks', _data.routes[indx].real_track);
        }
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
                //console.log({'track': tracks});
                //scope.$emit('drawTracks', tracks);
            });
    }
}]);
