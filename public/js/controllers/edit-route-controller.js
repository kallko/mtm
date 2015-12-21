angular.module('MTMonitor').controller('EditRouteController', ['$scope', '$rootScope', 'Statuses', '$timeout',
    function (scope, rootScope, Statuses, timeout) {
        var minWidth = 0,
            widthDivider = 15,
            movedJ,
            toHideJ,
            hidePlaceholder = false;

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
            console.log('onRouteToChange');

            var routeCopy = JSON.parse(JSON.stringify(data.route));
            //moveSkippedToEnd(routeCopy);
            scope.route = routeCopy;
            scope.changedRoute = JSON.parse(JSON.stringify(routeCopy));
            updateBoxes(true);
        }

        function moveSkippedToEnd(route) {
            console.log(route.lastPointIndx);
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

            for (var i = 0; i < toMoveArr.length; i++) {
                toMoveArr[i].TRAVEL_TIME = '0';
                toMoveArr[i].DOWNTIME = '0';
                route.points.push(toMoveArr[i]);
            }
        }

        function updateIndices(points) {
            for (var i = 0; i < points.length; i++) {
                points[i].index = i;
            }
        }

        function updateBoxes(updateOriginal) {
            if (updateOriginal) scope.originalBoxes = getBoxesFromRoute(scope.route);
            updateIndices(scope.changedRoute.points);
            scope.changebleBoxes = getBoxesFromRoute(scope.changedRoute);
            scope.$apply();
            $('.draggable-box').draggable({
                start: onDragStartTask,
                stop: onDragStopTask,
                helper: 'clone'
            });

            $('.droppable-box').droppable({
                drop: onDropTask
                , over: function(event, ui) {
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
                , out: function(event, ui) {
                    hidePlaceholder = true;
                    timeout(function () {
                        if (hidePlaceholder) $('.tmp-place').remove();
                    }, 100);
                }
            });
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

            $(this).removeClass('highlighted-box');
            updateBoxes();
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

        scope.boxWidth = function(size) {
            return size / widthDivider > minWidth ? size / widthDivider : minWidth;
        };

        scope.tooltip = function(box) {
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