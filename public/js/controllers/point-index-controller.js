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
            {name: 'выполненные', value: 0},
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

        http.get('http://192.168.9.242:3001/states?login=admin&pass=admin321&gid=713&from=1443484800&to=1443571200', {}).
            success(function (stops) {
                console.log(stops);
                drawStops(stops);
            });

        http.get('http://192.168.9.242:3001/messages?login=admin&pass=admin321&gid=713&from=1443484800&to=1443571200', {}).
            success(function (tracks) {
                console.log(tracks);
                drawTracks(tracks)
            });

        // [{"state":"ARRIVAL","t1":1413207066,"t2":1413208170,"lat":50.466892,"lon":30.377143,"dist":70,"time":1104},{"state":"MOVE","t1":1413208170,"t2":1413208240,"lat":50.46714,"lon":30.376225,"dist":358,"time":70},{"state":"ARRIVAL","t1":1413208240,"t2":1413211074,"lat":50.468735,"lon":30.37376,"dist":41,"time":2834},{"state":"MOVE","t1":1413211074,"t2":1413211182,"lat":50.468479,"lon":30.374182,"dist":1005,"time":108},{"state":"ARRIVAL","t1":1413211182,"t2":1413211272,"lat":50.465867,"lon":30.379187,"dist":8,"time":90},{"state":"MOVE","t1":1413211272,"t2":1413211342,"lat":50.465851,"lon":30.3793,"dist":1353,"time":70},{"state":"ARRIVAL","t1":1413211342,"t2":1413211720,"lat":50.466884,"lon":30.377234,"dist":57,"time":378},{"state":"MOVE","t1":1413211720,"t2":1413217292,"lat":50.467204,"lon":30.376598,"dist":94803,"time":5572},{"state":"ARRIVAL","t1":1413217292,"t2":1413266370,"lat":49.782428,"lon":30.178871,"dist":22,"time":49078},{"state":"MOVE","t1":1413266370,"t2":1413266528,"lat":49.78262,"lon":30.178795,"dist":95554,"time":158},{"state":"ARRIVAL","t1":1413266528,"t2":1413267256,"lat":49.784675,"lon":30.177585,"dist":15,"time":728},{"state":"MOVE","t1":1413267256,"t2":1413268848,"lat":49.784547,"lon":30.177517,"dist":114212,"time":1592},{"state":"ARRIVAL","t1":1413268848,"t2":1413270672,"lat":49.857379,"lon":30.112462,"dist":65,"time":1824},{"state":"MOVE","t1":1413270672,"t2":1413271764,"lat":49.857456,"lon":30.113367,"dist":134391,"time":1092},{"state":"ARRIVAL","t1":1413271764,"t2":1413272202,"lat":49.980645,"lon":30.005351,"dist":12,"time":438},{"state":"MOVE","t1":1413272202,"t2":1413272252,"lat":49.980632,"lon":30.005182,"dist":134737,"time":50},{"state":"ARRIVAL","t1":1413272252,"t2":1413272624,"lat":49.982697,"lon":30.005637,"dist":3,"time":372},{"state":"MOVE","t1":1413272624,"t2":1413272800,"lat":49.982726,"lon":30.005622,"dist":136536,"time":176},{"state":"ARRIVAL","t1":1413272800,"t2":1413272872,"lat":49.989578,"lon":30.01998,"dist":15,"time":72},{"state":"MOVE","t1":1413272872,"t2":1413273566,"lat":49.989587,"lon":30.020195,"dist":147045,"time":694},{"state":"ARRIVAL","t1":1413273566,"t2":1413274468,"lat":50.015819,"lon":30.119227,"dist":15,"time":902},{"state":"MOVE","t1":1413274468,"t2":1413274624,"lat":50.015861,"lon":30.11943,"dist":148978,"time":156},{"state":"ARRIVAL","t1":1413274624,"t2":1413274920,"lat":50.006298,"lon":30.124842,"dist":12,"time":296},{"state":"MOVE","t1":1413274920,"t2":1413275446,"lat":50.006236,"lon":30.124987,"dist":158055,"time":526},{"state":"ARRIVAL","t1":1413275446,"t2":1413276042,"lat":49.992167,"lon":30.017949,"dist":12,"time":596},{"state":"MOVE","t1":1413276042,"t2":1413276258,"lat":49.992077,"lon":30.018056,"dist":161029,"time":216},{"state":"ARRIVAL","t1":1413276258,"t2":1413277952,"lat":49.996257,"lon":29.996764,"dist":17,"time":1694},{"state":"MOVE","t1":1413277952,"t2":1413278012,"lat":49.996307,"lon":29.996529,"dist":161800,"time":60},{"state":"ARRIVAL","t1":1413278012,"t2":1413278444,"lat":49.997942,"lon":29.986451,"dist":19,"time":432},{"state":"MOVE","t1":1413278444,"t2":1413280434,"lat":49.998105,"lon":29.986343,"dist":191220,"time":1990},{"state":"ARRIVAL","t1":1413280434,"t2":1413281382,"lat":50.18095,"lon":30.10778,"dist":17,"time":948},{"state":"MOVE","t1":1413281382,"t2":1413282712,"lat":50.181061,"lon":30.107946,"dist":211999,"time":1330},{"state":"ARRIVAL","t1":1413282712,"t2":1413283222,"lat":50.073703,"lon":30.077546,"dist":19,"time":510},{"state":"MOVE","t1":1413283222,"t2":1413284838,"lat":50.073647,"lon":30.077282,"dist":237786,"time":1616},{"state":"ARRIVAL","t1":1413284838,"t2":1413286036,"lat":49.997925,"lon":29.986435,"dist":18,"time":1198},{"state":"MOVE","t1":1413286036,"t2":1413286262,"lat":49.997889,"lon":29.986681,"dist":0,"time":226}]
        //scope.$emit('drawStops');
    }

    function drawStops(stops) {
        var tmpVar,
            iconIndex = 14,
            tmpTitle = '';

        for (var i = 0, k = 0; i < stops.length; i++) {
            if (stops[i].state == "MOVE") {
                continue;
            }

            k++;
            tmpTitle = 'Дистанция: ' + stops[i].dist + '\n';
            tmpTitle += 'Время прибытия: ' + new Date(stops[i].t1 * 1000) + '\n';
            tmpTitle += 'Длительность: ' + parseInt(stops[i].time / 60) + ' минут';
            //console.log('i = ' + i + '; ' + stops[i].state);
            tmpVar = L.marker([stops[i].lat, stops[i].lon],
                {'title': tmpTitle});
            tmpVar.setIcon(getIcon(k, iconIndex, 'grey', 'black'));
            _map.addLayer(tmpVar);
        }
    }

    function drawTracks(tracks) {
        var polyline = new L.Polyline(tracks, {
            color: '#F00',
            weight: 3,
            opacity: 1,
            smoothFactor: 1
        });
        polyline.addTo(_map);
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
                if (data.routes[i].driver._id == null) {
                    data.routes[i].driver._id = driverId;
                    scope.filters.drivers.push({
                        name: data.routes[i].driver.NAME,
                        value: data.routes[i].driver._id
                    });
                    driverId++;
                }

                tmpPoints[j].driver_id = data.routes[i].driver._id;
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
        //console.log(new Date());
        //console.log('now = ' + now);
        //console.log('now + focus_l2_time = ' + (now + focus_l2_time));

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
            onResize: function () {
                resizeHead(pointTable);
            }
        });
    }

    scope.$on('ngRepeatFinished', function () {
        updateResizeGripHeight();
    });

    scope.$watch(function () {
        return scope.filters.driver + scope.filters.status;
    }, function () {
        timeout(function () {
            updateResizeGripHeight();
        }, 1);

    });

    function setListeners() {
        $(window).resize(resetHeight);
        resetHeight();

        if (pointTableHolder == null) {
            pointTableHolder = $('#point-table');
            pointContainer = $('#point-controller-container');
            pointTable = $('#point-table > table');
        }

        myLayout.on('stateChanged', function () {
            pointTableHolder.height(pointContainer.height() - 50);
            pointTableHolder.width(pointContainer.width() - 10);
            updateFixedHeaderPos();
        });
    }

    function updateResizeGripHeight() {
        var height = pointTable.height();
        console.log(height);
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

        setTitleListener();
        resizeHead(table);
        pointTableHolder.on("scroll", updateHeaderClip);
        updateHeaderClip();
        updateFixedHeaderPos();
    }

    function setTitleListener() {

        //$('.lm_title:contains("Точки маршрута")').on('mousedown', function () {
        //    //headerCopy.hide();
        //    //console.log(headerCopy);
        //    console.log('Точки маршрута');
        //
        //});

        //var body = $('body');
        //scope.$watch(function() {
        //    return body.attr('class');
        //}, function(newValue, oldValue) {
        //    if (newValue !== oldValue) { // Values will be equal on initialization
        //        console.log('class has changed to: ' + newValue);
        //    }
        //});

        //scope.$watch(function () {
        //    return $('.lm_dragProxy').length;
        //}, function(val) {
        //    console.log('TEST');
        //});

        // lm_dragProxy
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
        return (scope.filters.driver == -1 || row.driver_id == scope.filters.driver);
    };

}]);
