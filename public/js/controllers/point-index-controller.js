angular.module('MTMonitor').controller('PointIndexController', ['$scope', '$http', function (scope, http) {

    var pointTable,
        pointContainer,
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
        scope.filters.statusFilters = [
            {name: 'все', value: -1},
            {name: 'выполненные', value: 0},
            {name: 'под контролем', value: 1},
            {name: 'ожидают выполнения', value: 2},
            {name: 'запланирован', value: 3},
            {name: 'отменен', value: 4}
        ];
        scope.filters.statusFilter = scope.filters.statusFilters[0].value;
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
            rowId = 0;
        scope.rowCollection = [];
        for (var i = 0; i < data.routes.length; i++) {
            for (var j = 0; j < data.transports.length; j++) {
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
                tmpPoints[j].transport = data.routes[i].transport;
                tmpPoints[j].arrival_time_hhmm = tmpPoints[j].ARRIVAL_TIME.substr(11, 8);
                tmpPoints[j].arrival_time_ts = strToTstamp(tmpPoints[j].ARRIVAL_TIME);
                tmpPoints[j].end_time_hhmm = tmpPoints[j].END_TIME.substr(11, 8);
                tmpPoints[j].end_time_ts = strToTstamp(tmpPoints[j].END_TIME);
                tmpPoints[j].row_id = rowId;
                tmpPoints[j].status = STATUS.SCHEDULED;
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
        }

        _data = data;
        generateStops(data);
        statusUpdate();

        console.log(data);
        console.log(scope.rowCollection);
        scope.displayCollection = [].concat(scope.rowCollection);

        console.log('Finish linking ...');
        setColResizable();
    }

    function randomInteger(min, max) {
        var rand = min + Math.random() * (max - min)
        rand = Math.round(rand);
        return rand;
    }

    function generateStops(data) {
        var tmpLength = 0;

        for (var i = 0; i < data.routes.length; i++) {
            tmpLength = randomInteger(0, data.routes[i].points.length - data.routes[i].points.length / 3);
            data.routes[i].stops = data.routes[i].points.slice(0, tmpLength);
        }
    }

    function statusUpdate() {
        // TODO: get new real data from aggregator before update

        var now = parseInt(Date.now() / 1000),
            tmpPoint,
            focus_l1_time = 60 * 30,
            focus_l2_time = 60 * 120;
        console.log(new Date());
        console.log('now = ' + now);
        console.log('now + focus_l2_time = ' + (now + focus_l2_time));

        for (var i = 0; i < _data.routes.length; i++) {
            for (var j = 0; j < _data.routes[i].stops.length; j++) {

                // TODO:    with real data create function for checking stops with radius
                //          and time windows for hitting waypoints coordinates and time

                for (var k = 0; k < _data.routes[i].points.length; k++) {
                    tmpPoint = _data.routes[i].points[k];
                    if (_data.routes[i].stops[j].arrival_time_ts == tmpPoint.arrival_time_ts &&
                        _data.routes[i].stops[j].END_LAT == tmpPoint.END_LAT &&
                        _data.routes[i].stops[j].END_LAT == tmpPoint.END_LAT) {
                        tmpPoint.status = STATUS.FINISHED;
                        break;
                    }
                }
            }

            for (j = 0; j < _data.routes[i].points.length; j++) {
                tmpPoint = _data.routes[i].points[j];
                if (tmpPoint.status != STATUS.FINISHED &&
                    tmpPoint.status != STATUS.CANCELED) {
                    //console.log(tmpPoint.arrival_time_ts);
                    //console.log('arrival_time_ts = ' + tmpPoint.arrival_time_ts);
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
    }

    function setColResizable() {
        $("#point-table-tbl").colResizable({
            //headerOnly: true
            //fixed: false
        });
    }

    function setListeners() {
        $(window).resize(resetHeight);
        resetHeight();

        if (pointTable == null) {
            pointTable = $('#point-table');
            pointContainer = $('#point-controller-container');
        }

        myLayout.on('stateChanged', function () {
            pointTable.height(pointContainer.height() - 50);
            pointTable.width(pointContainer.width() - 10);
        });
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
    };

    scope.getTextStatus = function (statusCode) {
        for (var i = 0; i < scope.filters.statusFilters.length; i++) {
            if(scope.filters.statusFilters[i].value == statusCode) {
                return scope.filters.statusFilters[i].name;
            }
        }

        return 'неизвестный статус';
    };

    scope.strMaxLength = function (str, lenght) {
        if (str.length > lenght) {
            return str.substr(0, lenght) + ' ...';
        }

        return str;
    };

}]);
