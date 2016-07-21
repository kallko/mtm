// контроллер для работы с проблемами
angular.module('MTMonitor').controller('ProblemRouteController', ['$scope', '$http', '$timeout', '$interval'
    , '$filter', '$rootScope', 'Settings', 'Statuses', 'TimeConverter',
    function (scope, http, timeout, interval, filter, rootScope, Settings, Statuses, TimeConverter) {
        // console.log("ProblemRouteController Start");
        scope.testProblemArray = [["Опоздание", 2, 3, 4], ["Долгая остановка", 6, 7, 8]]; // Тестовая база инцидентов.
        var askProblemFromServer = true;                                           //  запрашивать ли проблемы с сервера
        rootScope.asking = false;                                                   // Запущен ли процесс запрсов
        rootScope.tempDecision;

        interval(confirmOnline, 60 * 1000);

        function confirmOnline() {
            console.log("confirmOnline in process");
            http.get('./confirmonline/')
                .success(function (data) {
                    if (data != "ok") alert("online confirmed");
                    var j = data;
                }).error(function () {
                    //rootScope.errorNotification('Нет связи с сервером');
                });


        }

        function startAsking() {
            if (askProblemFromServer && rootScope.loaded) {
                console.log("I decide to start Asking");
                rootScope.asking = true;
                setProblemUpdate();
            }
        }

        // Запрос у сервера проблем каждые 5 секунд
          function setProblemUpdate() {
            interval(checkProblem, 5 * 1000);
        }


        scope.solveProblem = function (route) {
            alert("Hellow");
            console.log("Event", route);
            for (var i = 0; i < scope.testProblemArray.length; i++) {
                if (route == scope.testProblemArray[i]) {
                    scope.testProblemArray.splice(i, 1);
                    break;
                }
            }
        }


        //todo поставить проверку не запрашивать проблеммы, если у опрератора уже есть нужное количество нерешенных проблем
        // TODO dhеменно делаем, не запрашивать, если уже есть скачанное решение
        function checkProblem() {
            //console.log(" Route = ", rootScope.editing.uniqueID, scope.filters.route )
            if (!rootScope.tempDecision) {

                http.get('./askforproblems/')
                    .success(function (data) {
                        if (data != "ok") console.log("Problems Loaded");
                        rootScope.tempDecision = data;
                        if (data == undefined) return;
                        rootScope.$emit('receiveproblem', rootScope.tempDecision);
                    }).error(function () {
                        rootScope.errorNotification('Проблем роут контроллер');
                    });

                console.log("Ask for problem");
            }
        }


        rootScope.$on('start', function () {
            console.log("Запускаем опрос сервера");
            startAsking()
        });

    }]);
/**
 * Created by dev-2 on 15.07.16.
 */
