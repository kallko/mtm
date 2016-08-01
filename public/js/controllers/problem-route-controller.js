// контроллер для работы с проблемами
angular.module('MTMonitor').controller('ProblemRouteController', ['$scope', '$http', '$timeout', '$interval'
    , '$filter', '$rootScope', 'Settings', 'Statuses', 'TimeConverter',
    function (scope, http, timeout, interval, filter, rootScope, Settings, Statuses, TimeConverter) {
        // console.log("ProblemRouteController Start");
        //scope.testProblemArray = [["Опоздание", 2, 3, 4], ["Долгая остановка", 6, 7, 8]]; // Тестовая база инцидентов.
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
        //todo поменять 110 секунд на 5 после тестов
          function setProblemUpdate() {
            interval(checkProblem, 3 * 1000);
        }





        //todo поставить проверку не запрашивать проблеммы, если у опрератора уже есть нужное количество нерешенных проблем
        // TODO dhеменно делаем, не запрашивать, если уже есть скачанное решение
        function checkProblem() {
            checkTimeForEditing();

            if (rootScope.tempDecision != undefined) {
                var pQuant = rootScope.settings.problem_to_operator;
            console.log("Ask for problem?", rootScope.data.routes.length, pQuant);

            }
            var need=0;
            var exist=0;
            if (rootScope.data != undefined && rootScope.data.routes != undefined){
                exist = rootScope.data.routes.length;
            }
            if(rootScope.settings != undefined) {
                need = parseInt(rootScope.settings.problems_to_operator) - exist;
            }

            //if(need<0) need='';
            //console.log("Данные", need, rootScope.settings.problems_to_operator, exist);
            console.log(" Go to ASK ", !rootScope.data,  need );
            if ((!rootScope.data && need>0 ) || (need > 0 && need < rootScope.settings.problems_to_operator )) {
                console.log("Give me", need, "the problem please! String is");


                http.get('./askforproblems/:'+need)
                    .success(function (data) {

                        if (data == undefined) {
                            return
                        } else {
                            console.log("Problems Loaded");
                        }
                        if(data.allRoutes != undefined) {
                            console.log("Отправляем данные на клиент", data);
                            rootScope.tempDecision = JSON.parse(JSON.stringify(data));
                            rootScope.$emit('receiveproblem', rootScope.tempDecision);
                        } else {
                            console.log("Общая статистика", data);
                            rootScope.statisticAll = data.statistic;

                        }

                    rootScope.editing.start = parseInt(Date.now()/1000);

                    }).error(function () {
                        rootScope.errorNotification('Проблем роут контроллер');
                    });


            }
        }


        rootScope.$on('start', function () {
            console.log("Запускаем опрос сервера");
            startAsking()
        });


     scope.showProblem = function(route) {
            //alert("Я все вижу" + route.filterId);
            scope.$emit('choseproblem', route.filterId);

        }



        function checkTimeForEditing (){
            var end = parseInt(Date.now()/1000);
            console.log("Check for timeout", rootScope.editing.start, end, end-rootScope.editing.start);

            if(rootScope.editing.start + 600 < end ) {
                http.post('./logout')
                    .success(function (data) {
                        console.log("complete");
                        rootScope.asking = false;
                        rootScope.data.routes = [];
                        rootScope.editing={};
                        alert("Time out!");
                        scope.$emit('logout');// В PIC очищение таблицы точек
                    });


            }


        }



    }]);
/**
 * Created by dev-2 on 15.07.16.
 */
