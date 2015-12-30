angular.module('MTMonitor').controller('PointViewController', ['$scope', '$rootScope', '$http', 'Statuses',
    function (scope, rootScope, http, Statuses) {
        var STATUS,
            parent;

        init();

        function init() {
            $('#point-view').popup({
                    transition: 'all 0.15s',
                    onclose: function () {
                        if (scope.point.lockedByMe && !scope.route.locked)  scope.toggleTaskBlock();
                    }
                }
            );

            initStatuses();

            rootScope.$on('showPoint', show);
            rootScope.$on('newTextStatus', newTextStatus);
            rootScope.$on('companyName', function (event, data) {
                scope.companyName = data;
                console.log(data);
            });
        }

        function show(event, data) {
            scope.point = data.point;
            scope.route = data.route;
            parent = data.parent;
            $('#point-view').popup('show');
            //console.log('point', data.point);
            //console.log('route', data.route);
        }

        function initStatuses() {
            STATUS = Statuses.getStatuses();
            scope.statuses = Statuses.getTextStatuses();
        }

        function newTextStatus(event, text) {
            if (scope.point)    scope.point.textStatus = text;
        }

        scope.confirmStatus = function () {
            console.log('confirmStatus');
            scope.$emit('changeConfirmation', {
                row: scope.point,
                option: 'confirm-status'
            });
        };

        scope.cancelStatus = function () {
            console.log('cancelStatus');
            scope.$emit('changeConfirmation', {
                row: scope.point,
                option: 'not-delivered-status'
            });
        };

        scope.cancelTask = function () {
            console.log('cancelTask');
            scope.$emit('changeConfirmation', {
                row: scope.point,
                option: 'cancel-point'
            });
        };

        scope.toggleTaskBlock = function () {
            if (!scope.point.locked) {
                var url = './opentask/' + scope.point.itineraryID.replace('/', 'SL') + '/' + scope.point.TASK_NUMBER + '?lockTask=false';
                http.get(url)
                    .success(function (data) {
                        if (data.status === 'ok') {
                            scope.point.locked = true;
                            scope.point.lockedByMe = true;
                            //scope.$emit('showNotification', {text: 'Задание переведено в режим редактирования.'});
                        } else if (data.status === 'locked' && data.me) {
                            scope.point.locked = true;
                            scope.point.lockedByMe = true;
                            //scope.$emit('showNotification', {text: 'Задание уже переведено в режим редактирования.'});
                        } else if (data.status === 'locked') {
                            scope.$emit('showNotification', {text: 'Задание заблокировано пользователем ' + data.byUser});
                        }
                    });
            } else {
                var url = './unlocktask/' + scope.point.itineraryID.replace('/', 'SL') + '/' + scope.point.TASK_NUMBER;
                http.get(url)
                    .success(function (data) {
                        if (data.status === 'unlocked') {
                            scope.point.locked = false;
                            scope.point.lockedByMe = false;
                            //scope.$emit('showNotification', {text: 'Редактирование завершенно.'});
                        }
                    });
            }
        };

        scope.toggleRouteBlock = function () {
            var url = (scope.route.lockedByMe ? './unlockroute/' : './lockroute/') + scope.point.itineraryID.replace('/', 'SL') + '/' + scope.route.filterId + '/',
                first = true;
            for (var i = 0; i < scope.route.points.length; i++) {
                if (scope.route.points[i].TASK_NUMBER != '') {
                    url += (!first ? ';' : '') + scope.route.points[i].TASK_NUMBER;
                    first = false;
                }
            }

            if (!scope.route.lockedByMe) {
                http.get(url)
                    .success(function (data) {
                        console.log(data);
                        if (data.status == 'ok') {
                            scope.route.lockedByMe = true;
                            scope.route.locked = true;
                            for (var i = 0; i < scope.route.points.length; i++) {
                                if (!scope.route.points[i].TASK_NUMBER) continue;

                                scope.route.points[i].locked = true;
                                scope.route.points[i].lockedByMe = true;
                                scope.route.points[i].lockedRoute = true;
                            }
                        }
                    });
            } else {
                http.get(url)
                    .success(function (data) {
                        console.log(data);
                        delete scope.route.lockedByMe;
                        delete scope.route.locked;
                        for (var i = 0; i < scope.route.points.length; i++) {
                            if (!scope.route.points[i].TASK_NUMBER) continue;

                            delete scope.route.points[i].locked;
                            delete scope.route.points[i].lockedByMe;
                            delete scope.route.points[i].lockedRoute;
                        }
                    });
            }
        };

        scope.unconfirmed = function () {
            return scope.point && !scope.point.confirmed && (scope.point.status == STATUS.FINISHED ||
                scope.point.status == STATUS.FINISHED_LATE || scope.point.status == STATUS.FINISHED_TOO_EARLY);
        };

        scope.locked = function (point) {
            return scope.point && scope.point.TASK_NUMBER
                && (!scope.point.locked || scope.point.lockedByMe)
                && (!scope.route.locked || scope.route.lockedByMe);
        };

        scope.changePromisedWindow = function (point) {
            var start = $('#promised-start-card').val().split(':'),
                finish = $('#promised-finish-card').val().split(':'),
                oldStart = new Date(point.promised_window_changed.start * 1000),
                clearOldDate = new Date(oldStart.getFullYear(), oldStart.getMonth(), oldStart.getDate()).getTime();

            point.promised_window_changed = {
                start: clearOldDate / 1000 + start[0] * 3600 + start[1] * 60,
                finish: clearOldDate / 1000 + finish[0] * 3600 + finish[1] * 60
            };

            if (parent === 'editRoute')  {
                console.log('checkPoint');
                scope.$emit('checkPoint', point);
            } else {
                console.log('updateRawPromised');
                scope.$emit('updateRawPromised', { point: point });
            }

            // TODO изменение сырых данных в родительском контролере

            //var rawPoints = rawData.routes[point.route_id].points;
            //for (var i = 0; i < rawPoints.length; i++) {
            //    if (rawPoints[i].TASK_NUMBER == point.TASK_NUMBER) {
            //        rawPoints[i].promised_window = JSON.parse(JSON.stringify(point.promised_window));
            //        rawPoints[i].promised_window_changed = JSON.parse(JSON.stringify(point.promised_window_changed));
            //        break;
            //    }
            //}
        };

        scope.open1CWindow = function () {
            console.log('open1CWindow');
            http.get('./openidspointwindow/' + scope.point.waypoint.ID)
                .success(function(data) {
                    console.log(data);
                });
        };

    }]);