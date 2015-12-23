angular.module('MTMonitor').controller('EditRouteController', ['$scope', '$rootScope', 'Statuses', '$timeout', '$http',
    function (scope, rootScope, Statuses, timeout, http) {
        var minWidth = 0,
            widthDivider = 25,
            movedJ,
            toHideJ,
            hidePlaceholder = false,
            routerData,
            serverTime,
            firstInit;

        scope.BOX_TYPE = {
            TRAVEL: 0,
            DOWNTIME: 1,
            TASK: 2
        };
        scope.STATUS = Statuses.getStatuses();

        init();

        function init() {
            rootScope.$on('routeToChange', onRouteToChange);
        }

        function onRouteToChange(event, data) {
            var routeCopy = JSON.parse(JSON.stringify(data.route));
            serverTime = data.serverTime;
            firstInit = true;
            routerData = undefined;

            if (data.demoMode) {
                routeCopy.car_position = undefined;
                for (var i = 0; i < routeCopy.real_track.length; i++) {
                    if (routeCopy.real_track[i].t1 < serverTime &&
                        routeCopy.real_track[i].t2 > serverTime) {
                        routeCopy.car_position = routeCopy.real_track[i];
                        break;
                    }
                }

                routeCopy.car_position = routeCopy.car_position ? routeCopy.car_position :
                    routeCopy.real_track[routeCopy.real_track.length - 1];
            }

            scope.route = routeCopy;
            scope.changedRoute = JSON.parse(JSON.stringify(routeCopy));

            moveSkippedToEnd(scope.changedRoute);
            for (var i = 0; i < scope.changedRoute.points.length; i++) {
                if (scope.changedRoute.points[i].status == scope.STATUS.FINISHED ||
                    scope.changedRoute.points[i].status == scope.STATUS.FINISHED_LATE ||
                    scope.changedRoute.points[i].status == scope.STATUS.FINISHED_TOO_EARLY) {
                    scope.changedRoute.points.splice(i, 1);
                    scope.changedRoute.lastPointIndx--;
                    i--;
                } else {
                    scope.changedRoute.points[i].base_index = i;
                }

            }

            if (scope.changedRoute.points.length > 0) {
                loadRouterData(scope.changedRoute.points, recalculateRoute);
            } else {
                scope.$emit('showNotification', {text: 'Маршрут полностью выполнен.'});
            }
            //updateBoxes(true);
        }

        function recalculateRoute() {
            if (!routerData) {
                loadRouterData(scope.changedRoute.points, recalculateRoute);
                return;
            }

            console.log('scope.changedRoute >>', scope.changedRoute);
            var url = './findtime2p/'
                + scope.changedRoute.car_position.lat + '&'
                + scope.changedRoute.car_position.lon + '&'
                + scope.changedRoute.points[scope.changedRoute.lastPointIndx + 1].LAT + '&'
                + scope.changedRoute.points[scope.changedRoute.lastPointIndx + 1].LON;
            console.log(url);
            http.get(url)
                .success(function (data) {
                    console.log(data);

                    var fromPoint,
                        toPoint,
                        cTime;

                    cTime = applyTravelTimeToPoint(scope.changedRoute.points[0],
                        parseInt(data.time_table[0][0][1] / 10), serverTime);

                    for (var i = 1; i < scope.changedRoute.points.length; i++) {
                        fromPoint = scope.changedRoute.points[i - 1];
                        toPoint = scope.changedRoute.points[i];
                        cTime = applyTravelTimeToPoint(toPoint,
                            routerData.timeTable[fromPoint.base_index][toPoint.base_index] / 10, cTime);
                    }

                    updateBoxes(firstInit);
                });
        }

        function applyTravelTimeToPoint(point, travelTime, cTime) {
            point.TRAVEL_TIME = travelTime;
            cTime += travelTime;
            point.DOWNTIME = getDowntime(cTime, point.windows);
            cTime += point.DOWNTIME;
            cTime += parseInt(point.TASK_TIME);

            //console.log('cTime', new Date(cTime * 1000));
            return cTime;
        }

        function getDowntime(time, windows) {
            if (!windows || windows.length == 0) return 0;

            var closestWindow;
            if (windows.length == 1) {
                closestWindow = windows[0];
            } else {
                for (var i = 0; i < windows.length; i++) {
                    if (windows[i].finish > time || i == windows.length - 1) {
                        closestWindow = windows[i];
                        break;
                    }
                }
            }

            //console.log('start', new Date(closestWindow.start * 1000), 'time', new Date(time * 1000));
            if (closestWindow.start > time) return closestWindow.start - time;

            return 0;
        }

        function moveSkippedToEnd(route) {
            var toMoveArr = [];

            for (var i = 0; i < route.lastPointIndx + 1 - toMoveArr.length; i++) {
                if (route.points[i].status != scope.STATUS.FINISHED &&
                    route.points[i].status != scope.STATUS.FINISHED_LATE &&
                    route.points[i].status != scope.STATUS.FINISHED_TOO_EARLY) {
                    toMoveArr.push(route.points[i]);
                    route.points.splice(i, 1);
                    i--;
                }
            }

            route.lastPointIndx -= toMoveArr.length;
            for (var i = 0; i < toMoveArr.length; i++) {
                toMoveArr[i].TRAVEL_TIME = '0';
                toMoveArr[i].DOWNTIME = '0';
                route.points.push(toMoveArr[i]);
            }
        }

        function loadRouterData(points, callback) {
            var pointsStr = '';
            for (var i = 0; i < points.length; i++) {
                if (points[i].LAT != null && points[i].LON != null) {
                    pointsStr += "&loc=" + points[i].LAT + "," + points[i].LON;
                }
            }

            console.log('./getroutermatrix/' + pointsStr);
            http.get('./getroutermatrix/' + pointsStr)
                .success(function (data) {
                    routerData = {
                        lengthTable: data.length_table[0],
                        timeTable: data.time_table[0]
                    };
                    callback();
                });
        }

        function updateIndices(points) {
            for (var i = 0; i < points.length; i++) {
                points[i].index = i;
            }
        }

        function updateBoxes(updateOriginal) {
            if (updateOriginal) {
                scope.originalBoxes = getBoxesFromRoute(scope.route);
                firstInit = false;
            }

            updateIndices(scope.changedRoute.points);
            scope.changebleBoxes = getBoxesFromRoute(scope.changedRoute);
            //console.log('scope.$apply()');
            //scope.$apply();

            timeout(function () {
                console.log('setting listeners');
                $('.draggable-box').draggable({
                    start: onDragStartTask,
                    stop: onDragStopTask,
                    helper: 'clone'
                });

                $('.droppable-box').droppable({
                    drop: onDropTask
                    , over: function (event, ui) {
                        $('.tmp-place').remove();
                        hidePlaceholder = false;
                        var dataIndex = $(this).data('index'),
                            placeHolder = $('<div class="box tmp-place" style="width: ' + movedJ.width() + 'px;" ' +
                                ' data-index="' + dataIndex + '" ></div>');
                        $('#box-' + scope.BOX_TYPE.TASK + '-' + dataIndex).before(placeHolder);
                        placeHolder.droppable({
                            drop: onDropTask
                        });
                    }
                    , out: function (event, ui) {
                        hidePlaceholder = true;
                        timeout(function () {
                            if (hidePlaceholder) $('.tmp-place').remove();
                        }, 100);
                    }
                });
            }, 1);
        }

        function onDragStartTask(event, ui) {
            ui.helper.css('z-index', '999999');
            movedJ = ui.helper;
            toHideJ = $('#box-' + scope.BOX_TYPE.TASK + '-' + movedJ.data('index'));
            toHideJ.hide();
        }

        function onDragStopTask(event, ui) {
            ui.helper.css('left', '0px').css('top', '0px').css('z-index', 'auto');
            $('.tmp-place').remove();
            toHideJ.show();
        }

        function onDropTask(event, ui) {
            var moved = ui.helper.data('index'),
                target = $(this).data('index'),
                point = scope.changedRoute.points.splice(moved, 1)[0];

            $('.tmp-place').remove();
            if (target == 55555) {
                scope.changedRoute.points.push(point);
            } else {
                target = target > moved ? target - 1 : target;
                scope.changedRoute.points.splice(target, 0, point);
            }

            //$(this).removeClass('highlighted-box');
            recalculateRoute();
            //updateBoxes();
        }

        function getBoxesFromRoute(route) {
            var boxes = [],
                point,
                tmpTime;

            for (var i = 0; i < route.points.length; i++) {
                point = route.points[i];
                if (point.TRAVEL_TIME !== '0') {
                    tmpTime = parseInt(point.TRAVEL_TIME);
                    boxes.push({
                        type: scope.BOX_TYPE.TRAVEL,
                        size: tmpTime,
                        status: point.status,
                        index: point.index
                    });
                }

                if (point.DOWNTIME !== '0') {
                    tmpTime = parseInt(point.DOWNTIME);
                    boxes.push({
                        type: scope.BOX_TYPE.DOWNTIME,
                        size: tmpTime,
                        status: point.status,
                        index: point.index
                    });
                }

                if (point.TASK_TIME !== '0') {
                    tmpTime = parseInt(point.TASK_TIME);
                    boxes.push({
                        type: scope.BOX_TYPE.TASK,
                        size: tmpTime,
                        number: point.NUMBER,
                        arrivalStr: point.arrival_time_hhmm,
                        endTimeStr: point.end_time_hhmm,
                        travelTime: point.TRAVEL_TIME,
                        downtime: point.DOWNTIME,
                        status: point.status,
                        index: point.index
                    });
                }
            }

            return boxes;
        }

        scope.boxWidth = function (size) {
            return size / widthDivider > minWidth ? size / widthDivider : minWidth;
        };

        scope.tooltip = function (box) {
            var result = '';

            switch (box.type) {
                case scope.BOX_TYPE.TASK:
                    result += 'Задача #' + box.number + '\n';
                    break;
                case scope.BOX_TYPE.TRAVEL:
                    result += 'Переезд' + '\n';
                    break;
                case scope.BOX_TYPE.DOWNTIME:
                    result += 'Простой' + '\n';
                    break;
            }

            result += 'Продолжительность: ' + toMinutes(box.size) + ' мин.\n';

            if (box.type == scope.BOX_TYPE.TASK) {
                result += 'Время прибытия: ' + box.arrivalStr + '\n';
                result += 'Время отъезда: ' + box.endTimeStr + '\n';
                result += 'Переезд: ' + toMinutes(box.travelTime) + ' мин.\n';
                result += 'Простой: ' + toMinutes(box.downtime) + ' мин.\n';
            }

            return result;
        };

        function toMinutes(seconds) {
            return parseInt(seconds / 60);
        }

    }]);