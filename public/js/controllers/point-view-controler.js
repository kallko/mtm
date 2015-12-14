angular.module('MTMonitor').controller('PointViewController', ['$scope', '$rootScope', '$http',
    function (scope, rootScope, http) {
        var STATUS;

        init();

        function init() {
            $('#point-view').popup({
                    transition: 'all 0.15s',
                    onclose: function () {
                        if (scope.point.lockedByMe && !scope.route.locked)  scope.toggleTaskBlock();
                    }
                }
            );

            rootScope.$on('showPoint', show);
            rootScope.$on('sendStatuses', initStatuses);
            rootScope.$on('newTextStatus', newTextStatus);
        }

        function show(event, data) {
            scope.point = data.point;
            scope.route = data.route;
            $('#point-view').popup('show');
            console.log('point', data.point);
            console.log('route', data.route);
        }

        function initStatuses(event, data) {
            if (scope.statuses) return;

            STATUS = data.statuses;
            scope.statuses = data.filters;
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
        }

    }]);