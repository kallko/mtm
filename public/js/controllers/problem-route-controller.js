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
            var sync=[];
            if (rootScope.data && rootScope.data.routes && rootScope.data.currentDay == true) {
                for (var i=0; i<rootScope.data.routes.length; i++){
                sync.push(rootScope.data.routes[i].uniqueID);
            }}

            http.post('./confirmonline/', sync)
                .success(function (data) {
                    if (data.status != "ok") alert("Отсутсвует связь с сервером ");
                    //console.log(rootScope.data.statistic,  "Статистика такая была", rootScope.data.server_time);
                    if (rootScope.data == undefined) rootScope.data = {};
                    rootScope.data.server_time = data.server_time;
                    rootScope.data.statistic = data.statistics;
                    rootScope.nowTime = rootScope.data.server_time;

                    if (data.err != undefined && data.err.length >0) {
                        alert("Произошел сбой связи. Перезайдите в АРМ, пожалуйста");
                    }
                    //rootScope.$emit('holestatistic', rootScope.data.statistic);
                    //console.log(rootScope.data.server_time, "Статистика такая стала", rootScope.data.statistic);
                }).error(function () {
                    //rootScope.errorNotification('Нет связи с сервером');
                });


        }

        function startAsking() {
            if (askProblemFromServer && rootScope.loaded) {
                console.log("I decide to start Asking");
                rootScope.asking = true;
                timeout(function () {
                    setProblemUpdate();
                }, 3000); //timeout, чтобы успел произойти первый перерасчет на сервере, прежде чем запрашивать первые 3 проблеммы.


            }
        }

        // Запрос у сервера проблем каждые 6 секунд
        function setProblemUpdate() {
            console.log("I decide i do it!");

            interval(checkProblem, 15 * 1000);
        }





        //todo поставить проверку не запрашивать проблеммы, если у опрератора уже есть нужное количество нерешенных проблем
        // TODO dhеменно делаем, не запрашивать, если уже есть скачанное решение
        function checkProblem() {
            checkTimeForEditing();

            //if (rootScope.tempDecision != undefined && rootScope.data && rootScope.data.routes) {
            //    var pQuant = rootScope.settings.problem_to_operator;
            ////console.log("Ask for problem?", rootScope.data.routes.length, pQuant);

 //           }

            //console.log("На момент запроса настройки", rootScope.data, rootScope.settings);
            var need=0;
            var exist=0;
            if (rootScope.data != undefined && rootScope.data.routes != undefined){
                exist = rootScope.data.routes.length;
            }
            if(rootScope.settings != undefined) {
                var settings;
                if (rootScope.data != undefined && rootScope.data.settings != undefined) {
                    settings = rootScope.data.settings;
                } else {
                    settings=rootScope.settings;
                }
                for(var i=0; i<settings.userRoles.length; i++){
                    if (settings.userRoles[i] == 'operator') need = parseInt(settings.problems_to_operator) - exist;
                }


            }

            //if(need<0) need='';
            //console.log("Данные перед запросом", need, rootScope.settings.problems_to_operator, exist);
            //console.log(" Go to ASK ", !rootScope.data,  need,  rootScope.asking);
            if(!rootScope.asking) return;
            if (((rootScope.data == undefined || rootScope.data.routes == undefined || rootScope.data.routes.length == 0) && (need>0 || exist == 0)) || (need > 0 && need < rootScope.settings.problems_to_operator )) {
                //console.log("Give me", need, "the problem please! ");


                http.get('./askforproblems/:'+need)
                    .success(function (data) {

                        if (data == undefined) {
                            return
                        } else {
                            //console.log("Problems Loaded");
                        }

                        if (data == "wait") {
                            console.log ("Рассчет прошлого дня еще не закончен");
                            return;
                        }
                        if(data.allRoutes != undefined) {
                            //console.log("Отправляем данные на клиент", data, data.routes[0].points.length, data.routes[1].points.length, data.routes[2].points.length);
                            rootScope.tempDecision = JSON.parse(JSON.stringify(data));
                            rootScope.$emit('receiveproblem', rootScope.tempDecision);
                            rootScope.reasons=data.reasons;
                            if (rootScope.tempDecision.statistic != undefined) rootScope.$emit('holestatistic', rootScope.tempDecision.statistic);
                        } else


                        {

                            if (data == 'All problem routes blocked') {
                             return;

                            } else {
                            console.log("Общая статистика", data);
                            rootScope.statisticAll = data.statistic;
                            rootScope.nowTime = data.nowTime;
                            }
                        }

                    rootScope.editing.start = parseInt(Date.now()/1000);

                    }).error(function () {
                        rootScope.waitNotification('Первичный рассчет еще не закончен. Подождите немного');
                    });


            }
        }


        rootScope.$on('start', function () {
            console.log("Запускаем опрос сервера");
            startAsking();
        });


     rootScope.showProblem = function(route) {
            //alert("Я все вижу" + route.filterId);
            scope.$emit('choseproblem', route.filterId);
            scope.$emit('routeToChange', ('routeToChange', {
                route: route,
                serverTime: rootScope.data.server_time,
                demoMode: false,
                workingWindow: rootScope.settings.workingWindowType,
                allDrivers: rootScope.data.drivers,
                allTransports: rootScope.data.transports

            }));
            rootScope.$emit('displayCollectionToStatistic', route.points);

        };



        function checkTimeForEditing (){
            var end = parseInt(Date.now()/1000);
            //console.log("Check for timeout", rootScope.editing.start, end, end-rootScope.editing.start);

            if(rootScope.editing.start + 600 < end && end < rootScope.editing.start +1200 ) {

                http.post('./logout')
                    .success(function (data) {
                        console.log("complete logout");
                        rootScope.asking = false;
                        rootScope.data.routes = [];
                        rootScope.editing={};
                        alert("Time out!");
                        scope.$emit('logout');// В PIC очищение таблицы точек
                        scope.$emit('clearMap');
                    });


            }


        }



        rootScope.$on('changeasking', function (event, changeAsking) {
            console.log("Изменяем состояние опроса сервера");
            if (changeAsking) {
                //todo !!! костыль для прошлых маршрутов.
                scope.$emit('clearDisplay');
                rootScope.displayCollection = [];
                rootScope.asking = true;
                rootScope.data = undefined;
                //startAsking();
            } else {
                rootScope.asking = false;
            }
        })



    }]);
/**
 * Created by dev-2 on 15.07.16.
 */
