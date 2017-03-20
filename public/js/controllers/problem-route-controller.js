// контроллер для работы с проблемами
angular.module('MTMonitor').controller('ProblemRouteController', ['$scope', '$http', '$timeout', '$interval'
    , '$filter', '$rootScope', 'Settings', 'Statuses', 'TimeConverter',
    function (scope, http, timeout, interval, filter, rootScope, Settings, Statuses, TimeConverter) {
        // console.log("ProblemRouteController Start");
        //scope.testProblemArray = [["Опоздание", 2, 3, 4], ["Долгая остановка", 6, 7, 8]]; // Тестовая база инцидентов.
        var askProblemFromServer = true;                                           //  запрашивать ли проблемы с сервера
        rootScope.asking = false;                                                   // Запущен ли процесс запрсов
        rootScope.tempDecision;
        rootScope.restart = false;

        interval(confirmOnline, 60 * 1000); // опрос на обновление трека, и подтверждение онлайна оператора
        interval(askBlocked, 3 * 1000); //опрос на "занятость маршрутов"
        scope.redEnvelope = false;
        scope.calls ='';
        //$('#call-view').popup('hide'); //fixme изначально спрятана менюшка связи диспетчера-водителя

        function askBlocked(){
            if(!rootScope.data || rootScope.restart) return;
            http.post('./askblocked')
                .then(function(data){
                    data = data.data;
                    //console.log("askBlocked", data);
                    if(data.data[0] != undefined && data.data[0] == 'restart') {
                        rootScope.$emit('showNotification', {text: "Вскоре на сервере начнутся профилактические работы. " +'\n' + 'Запишите пожалуйста все изменения в маршрутах', duration: 20000});
                        rootScope.restart = true;
                    }

                    if (data && data.call && data.call != null && data.call.time != undefined) signalCallNotification(data.call);
                    if (!rootScope.data.currentDay) return;
                    if  (data != undefined && data.length > 0) {
                       rootScope.$emit('changeBlockedRoutes', data);
                   }
                });
        }

        function confirmOnline() {
            if(rootScope.restart) return;
            console.log("confirmOnline in process", rootScope.settings);
            var sync=[];
            if (rootScope.data && rootScope.data.routes && rootScope.data.currentDay == true) {
                for (var i=0; i<rootScope.data.routes.length; i++){
                sync.push(rootScope.data.routes[i].uniqueID);
            }}
            if (rootScope.data && rootScope.data.routes) rootScope.$emit('addLoginAndTimeStampToNotes', rootScope.data.routes);

            if (!rootScope.data || !rootScope.data.routes || !rootScope.data.routes.length) return;
            http.post('./confirmonline/', {sync: sync, routes: rootScope.data.routes})
                .then(function (data) {
                    //console.log("confirmonline data", data);
                    if (data.status != 200) alert("Отсутсвует связь с сервером ");
                    //console.log(rootScope.data.statistic,  "Статистика такая была", rootScope.data.server_time);
                    if (rootScope.data == undefined) rootScope.data = {};

                    data = data.data;
                    rootScope.data.server_time = data.server_time;
                    console.log("RootScopeData", rootScope.data);
                    rootScope.nowTime = rootScope.data.server_time;
                    if (!rootScope.data.currentDay) return;

                    console.log("RootScopeData", rootScope.data);
                    rootScope.data.statistic = data.statistics;
                    console.log("Receive data", data);
                    if (data.calls && data.calls.length > 0) {
                        scope.redEnvelope = true;
                        scope.$emit('newCalls', data.calls)
                    };
                    if (data.allRoutes != undefined && rootScope.data.currentDay) {
                        rootScope.data.allRoutes = data.allRoutes;
                        //console.log("Send data to recreate filters Routes");
                        scope.$emit('newAllRoutes');
                    }

                    if (data.err != undefined && data.err.length >0) {
                        console.log("data.err", data.err);
                        alert("Произошел сбой связи. Перезайдите в АРМ, пожалуйста");
                    }

                    //todo запрос на обнговление трека
                    //if(!rootScope.data.routes) rootScope.data.routes=[];
                    if (rootScope.data.recievedUpdate == undefined) rootScope.data.recievedUpdate = true;
                    if ( rootScope.data.routes != undefined && rootScope.data.routes.length>0 && rootScope.data.currentDay != false && rootScope.data.recievedUpdate){
                        var obj =[];
                        var lastState={};
                        for (var i=0; i< rootScope.data.routes.length; i++){
                            if (rootScope.data.routes[i].real_track == undefined) rootScope.data.routes[i].real_track =[];
                            if (rootScope.data.routes[i].transport.gid != undefined ) {
                                if (rootScope.data.routes[i].real_track.length == 0) {
                                    lastState.t1=strToTstamp(rootScope.data.routes[i].START_TIME);
                                } else {lastState = rootScope.data.routes[i].real_track[ rootScope.data.routes[i].real_track.length-1]}

                                console.log("Время запроса", rootScope.data.routes[i].transport.gid, lastState.t1);
                                var res = {gid : rootScope.data.routes[i].transport.gid, lastState: lastState, uniqueID : rootScope.data.routes[i].uniqueID };
                                console.log("Res", res);
                                obj.push(res);
                            }
                        }
                        rootScope.data.recievedUpdate = false;

                        http.post('./updatepushes', {data: obj})
                            .then(function(data){
                               console.log("Result updatepushes", data);

                                rootScope.$emit('updatePush', data);
                            });

                        http.post ('./updatetrack', {data: obj})
                            .then(function (data) {
                                rootScope.data.recievedUpdate=true;
                                console.log("UpdateTrack look in server", data);
                                for (var j=0; j<data.length; j++){
                                    if (data[j].state.length == 0 ) {
                                        data.splice(j,1);
                                        j--;
                                        continue;
                                    }
                                    console.log("Size of states ", data[j].state.length);
                                    if (data[j].state[data[j].state.length-1].id == 0) {
                                        data[j].state.length = data[j].state.length-2;
                                    }
                                }
                                 rootScope.$emit('updateTrack', data);
                            })
                            .error (function (data){
                            rootScope.data.recievedUpdate = true;
                            console.log("Ошибка", data);
                        })
                    }

                    //rootScope.$emit('holestatistic', rootScope.data.statistic);
                    //console.log(rootScope.data.server_time, "Статистика такая стала", rootScope.data.statistic);
                })

        }

        function startAsking() {
            if (askProblemFromServer && rootScope.loaded) {
                //console.log("I decide to start Asking");
                rootScope.asking = true;
                timeout(function () {
                    setProblemUpdate();
                }, 3000); //timeout, чтобы успел произойти первый перерасчет на сервере, прежде чем запрашивать первые 3 проблеммы.


            }
        }

        // Запрос у сервера проблем каждые 6 секунд
        function setProblemUpdate() {
            //console.log("I decide i do it!");

            interval(checkProblem, 15 * 1000);
        }







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
                for(var i=0; i < settings.userRoles.length; i++){
                    if (settings.userRoles[i] == 'operator') need = parseInt(settings.problems_to_operator) - exist;
                }


            }

            //if(need<0) need='';
            //console.log("Данные перед запросом", need, rootScope.settings.problems_to_operator, exist);
            //console.log(" Go to ASK ", !rootScope.data,  need,  rootScope.asking);
            if(!rootScope.asking || rootScope.restart) return;
            if (((rootScope.data == undefined || rootScope.data.routes == undefined || rootScope.data.routes.length == 0) && (need>0 || exist == 0)) || (need > 0 && need < rootScope.settings.problems_to_operator )) {
                //console.log("Give me", need, "the problem please! ");

                console.log("need", need);
                http.get('./askforproblems/:' + need)
                    .success(function (data) {

                        if (data == undefined) {
                            return
                        } else {
                            //console.log("Problems Loaded");
                        }

                        if (data == "wait" || data == 'Company undefined') {
                            console.log ("Рассчет дня еще не закончен");
                            return;
                        }
                        if(data.allRoutes != undefined) {
                            //console.log("Отправляем данные на клиент", data, data.routes[0].points.length, data.routes[1].points.length, data.routes[2].points.length);
                            rootScope.tempDecision = JSON.parse(JSON.stringify(data));
                            rootScope.reasons = data.reasons;

                            rootScope.$emit('receiveproblem', rootScope.tempDecision, settings);

                            if (data.routes && data.routes.length > 0) {
                                rootScope.$emit ('loadRoutes') }


                            console.log("data", data);
                            if (data.allRoutes != undefined && rootScope.data.currentDay) {
                                rootScope.data.allRoutes = data.allRoutes;
                                //console.log("Send data to recreate filters Routes");
                                scope.$emit('newAllRoutes');
                            }

                            if (rootScope.data && rootScope.data.routes && rootScope.data.routes.some(function(route){
                                    return route.calls && (route.calls.some(function(call){
                                            return !call.finished
                                        }))
                                })) scope.redEnvelope = true;

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
                        rootScope.waitNotification('Загрузка данных еще не закончена. Подождите немного');
                    });


            }
        }


        rootScope.$on('start', function () {
            console.log("Запускаем опрос сервера");
            rootScope.asking = true;
            startAsking();
        });


        rootScope.$on('stopAsking', function () {
            console.log("Останавливаем опрос сервера");
            rootScope.asking = false;
        });


     rootScope.showProblem = function(route) {
         console.log("Push show problem");
            rootScope.redrawProblemRoute = false;
            if (route.filterId != undefined) scope.$emit("possibleRedraw", route.filterId);
            //alert("Я все вижу" + route.filterId);
         scope.$emit('choseproblem', route.filterId);
         if (route == undefined || route.filterId == undefined || rootScope.redrawProblemRoute) return;

            scope.$emit('clearMap');

            scope.$emit('routeToChange', ('routeToChange', {
                route: route,
                serverTime: rootScope.data.server_time,
                demoMode: false,
                workingWindow: rootScope.settings.workingWindowType,
                allDrivers: rootScope.data.drivers,
                allTransports: rootScope.data.transports

            }));
            rootScope.$emit('displayCollectionToStatistic', route.points);
            rootScope.showPoint = true;
        };



        function signalCallNotification(call){
            console.log("showCallNotification", call);
            scope.redEnvelope = true;
            var time = timestmpToStr(new Date(call.time));
            var driverForCall = rootScope.data.drivers.filter(function(driver){
               return driver.NAME == call.name;
            });
            var phone = driverForCall[0].PHONE.length > 0 ? driverForCall[0].PHONE : "В базе нет номера водителя";
            scope.calls += call.name + " " + time + " " + phone + '\n';

        }


        function timestmpToStr(d) {
            try{

                return  [d.getHours().padLeft(),
                    d.getMinutes().padLeft(),
                    d.getSeconds().padLeft()].join(':');
            } catch (e) {
                log.error( "Ошибка "+ e + e.stack);
            }

        }

        scope.showMeDriversCals = function (){
            scope.redEnvelope = false;
            scope.$emit('showCalls');
            //$('#call-view').popup('show');
            //alert(scope.calls);
        };

        rootScope.$on('redEnvelope', function(event){
            scope.redEnvelope = true;
        });

        function checkTimeForEditing (){
            var end = parseInt(Date.now()/1000);
            //console.log("Check for timeout", rootScope.editing.start, end, end-rootScope.editing.start);

            if(rootScope.editing.start + 600 < end && end < rootScope.editing.start + 1200) {

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
        });


        function strToTstamp(strDate, lockaldata) {
            try {

                if (lockaldata != undefined) {
                    var today = new Date();
                    var day, adding, month, year;

                    if(today.getDate().length<2){
                        day = "0"+today.getDate();
                    } else {
                        day = today.getDate();
                    }

                    month = parseInt(today.getMonth());
                    month++;

                    if(month<10){
                        month = "0"+month;
                    } else {
                        month = "" + month;

                    }

                    year = ('' + today.getFullYear()).substring(2);
                    //log.info("Constructor", day, month, year);
                    adding = day+'.'+month+'.'+year;
                    if (strDate.length<10) {
                        strDate = adding + " " + strDate;
                        // log.info("$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$", strDate);
                    }

                }
                var parts = strDate.split(' ');
                var    _date = parts[0].split('.');
                var _time;
                var toPrint=JSON.stringify(strDate);
                //for (var i=0; i<parts.length;i++){
                //    log.info("PARTS", parts[i]);
                //}
                //log.info("_________________");
                try {
                    _time = parts[1].split(':');} catch (exeption) {


                    log.info(toPrint, strDate, "Error", exeption, lockaldata);
                }



                //log.info(strDate, "strDate", "convert to", _date[2], _date[1] - 1, _date[0], _time[0], _time[1], _time[2]);

                return new Date(_date[2], _date[1] - 1, _date[0], _time[0], _time[1], _time[2]).getTime() / 1000;
            } catch (e) {
                log.error( "Ошибка "+ e + e.stack);
            }
        }


    }]);
/**
 * Created by dev-2 on 15.07.16.
 */
