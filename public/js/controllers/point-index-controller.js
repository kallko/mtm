angular.module('MTMonitor').controller('PointIndexController', ['$scope', '$http', function (scope, http) {

    var pointTable,
        pointContainer;

    setListeners();
    init();
    // generateTestData();
    loadDailyData();

    function Point() {
        this.number = 0;
        this.status = 0;
        this.realOrder = 0;
        this.planOrder = 0;
        this.pointID = 0;
        this.orderID = 0;
        this.pointName = 'test name';
        this.address = 'test address';
        this.timeWindow = {
            start: 0,
            finish: 0
        };
        this.planArrivalTime = 0;
        this.planServiceTime = 0;
        this.planDowntime = 0;
        this.planDeparture = 0;
        this.distance = 0;
        this.predictionArrivalTime = 0;
        this.factArrivalTime = 0;
        this.driverInPlan = true;
        this.carNumber = '0000';
        this.driverName = 'Test Name';
        this.phone = '0000';
        this.driverComment = '';
        this.managerName = '';
        this.managerComment = '';
    }

    function init() {
        scope.rowCollection = [];
        scope.displayCollection = [].concat(scope.rowCollection);
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

        return new Date(_date[2], _date[1], _date[0], _time[0], _time[1], _time[2]).getTime() / 1000;
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

        console.log(data);
        console.log(scope.rowCollection);

        scope.displayCollection = [].concat(scope.rowCollection);

        console.log('Finish linking ...');

        setColResizable();
    }

    function setColResizable() {
        $("#point-table-tbl").colResizable({
            headerOnly: true
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

        $("#tabs").tabs();

        $("#map-link").on('click', function () {
            map.invalidateSize(false);
        });

        $('ul.nav-pills li a').click(function (e) {
            $('ul.nav-pills li.active').removeClass('active')
            $(this).parent('li').addClass('active')
        });

        myLayout.on('stateChanged', function () {
            pointTable.height(pointContainer.height() - 10);
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

    scope.getTextStatus = function (statusCode, pointId) {
        var newClass,
            text;
        if (statusCode == 0) {
            newClass = 'row-white';
            text = 'Запланирован';
        } else if (statusCode == 1) {
            newClass = 'row-yellow';
            text = 'Выполняется';
        } else if (statusCode == 2) {
            newClass = 'row-green';
            text = 'Выполнен';
        } else if (statusCode == 3) {
            newClass = 'row-red';
            text = 'Отменен';
        }

        if (pointId != null) {
            $('#point-' + pointId).addClass(newClass);
        }

        return text;
    };

    function generateTestData() {
        var testData = [];
        tmpPoint = null;
        for (var i = 0; i < 77; i++) {
            tmpPoint = new Point();
            tmpPoint.number = i + 1;
            tmpPoint.pointID = i + 1;
            tmpPoint.status = Math.floor(Math.random() * 4);
            tmpPoint.driverName = "Driver" + i % 3;
            tmpPoint.driverInPlan = Math.floor(Math.random() * 3) != 0;
            testData.push(tmpPoint);
        }

        scope.rowCollection = testData;
        scope.displayCollection = [].concat(scope.rowCollection);
    }

    scope.strMaxLength = function (str, lenght) {
        if (str.length > lenght) {
            return str.substr(0, lenght) + ' ...';
        }

        return str;
    };

}]);
