// контроллер для работы с таблицей точек и маршрутами в целом
angular.module('MTMonitor').controller('PointIndexController', ['$scope', '$http', '$timeout', '$interval'
    , '$filter', '$rootScope', 'Settings', 'Statuses', 'TimeConverter',
    function (scope, http, timeout, interval, filter, rootScope, Settings, Statuses, TimeConverter) {

        var pointTableHolder,                               // холдер таблица точек
            pointContainer,                                 // холдер всего контроллера
            pointTable,                                     // таблица точек
            _data,                                          // главное хранилище данных
            rawData,                                        // сырые не измененные данные пришедшие от сервера
            seed = 1,                                       // сид для генерации

            stopUpdateInterval = 120,                       // интервал обновлений стопов
            updateTrackInterval = 30,                       // интервал загрузки новых данных при отрисовке треков
            checkLocksInterval = 15,                        // интервал проверки блокировок на сервере

            controlledWindow = 600,                         // размер контролируемого окна
            promisedWindow = 3600,                          // размер обещанного окна
            problemSortType = 0,                            // тип сортировки проблемности

            STATUS = Statuses.getStatuses(),                // массив кодов статусов


            WINDOW_TYPE = {                                 // типы попадания в окон
                OUT_WINDOWS: 0,
                IN_ORDERED: 1,
                IN_PROMISED: 2
            },

            aggregatorError = "invalid parameter 'gid'. ",
            loadParts = true,                              // догрузить новые данные сразу после загрузки интерфейса
            enableDynamicUpdate = true;                    // динамическая догрузка данных по заданному выше интервалу
            scope.existData=[];                                         //Хранение измененных в течение дня данных
            //scope.fastCalc=false;                          // Упрощенный расчет точек
            scope.existDataLoaded=false;                     //загружены ли уже существующие ранее данные

            scope.parseInt = parseInt;                       //Возможность использовать parseInt во view
            rootScope.editing = {}                          // Контроль времени на блокировку  маршрута



        setListeners();
        init();
        setCheckLocksInterval();
        loadDailyData(false);



        if (enableDynamicUpdate) {
             setRealTrackUpdate(stopUpdateInterval);
        }

        // начальная инициализация
        function init() {
            scope.rowCollection = [];                                   // коллекция всех задач дял отображения во вьюшке
            scope.displayCollection = [].concat(scope.rowCollection);   // копия коллекции для smart table
            scope.filters = {};                                         // фильтры
            scope.filters.statuses = Statuses.getTextStatuses();        // фильтры по статусам


            scope.filters.window_types = [                              // фильтры по типам попадания в окна
                {name: 'Вне окон', value: WINDOW_TYPE.OUT_WINDOWS, class: 'out-windows'},
                {name: 'В заказанном', value: WINDOW_TYPE.IN_ORDERED, class: 'in-ordered'},
                {name: 'В обещанном', value: WINDOW_TYPE.IN_PROMISED, class: 'in-promised'}
            ];

            scope.filters.branches = [                                  // фильтры по филиалам
                {name: 'Все филиалы', value: -1}
            ];

            scope.filters.route = -1;

            scope.filters.branch = scope.filters.branches[0].value;
           // scope.filters.status = scope.filters.statuses[0].value;
            scope.filters.status = {};
            for(var i = 0; scope.filters.statuses.length > i; i++){
                scope.filters.status[scope.filters.statuses[i].value] = true;
            }
            console.log(scope.filters.statuses);
            console.log(scope.filters.status);
            scope.filters.routes = [{nameDriver: 'все маршруты', nameCar: 'все маршруты', value: -1, allRoutes:true}]; // фильтры по маршрутам
            //scope.filters.route = scope.filters.routes[0].value;
            scope.filters.problem_index = 1;
            scope.filters.promised_15m = -1;
            scope.draw_modes = [                                        // режимы отрисовки треков
                {name: 'комбинированный трек', value: 0},
                {name: 'фактический трек', value: 1},
                {name: 'плановый трек', value: 2},
                {name: 'фактический + плановый трек', value: 3}
            ];

            // console.info(scope.draw_modes[0].value);
            scope.draw_mode = scope.draw_modes[0].value; // комбинированный трек
            scope.recalc_modes = [                                      // режимы пересчета маршрута
                {name: 'по большим окнам', value: 0},
                {name: 'по заданным окнам', value: 1},
                {name: 'по увеличенному заданному окну', value: 2}
            ];
            scope.recalc_mode = scope.recalc_modes[0].value;

            scope.selectedRow = -1;                                     // выбранная строка в таблице точек
            scope.filters.text = "";                                    // текстовый фильтр таблицы
            scope.demoMode = false;                                     // активирован ли демо режим

            scope.params = scope.params || Settings.load();             // настройки приложения

            //setProblemIndexSortMode(0);                                 // сброс фильтрации по индексу проблемности



            var $promised = $('#promised-15m-btn');
            // отжатие кнопки
            if ($promised.hasClass('btn-success')) {
                $promised.toggleClass('btn-default').toggleClass('btn-success');
            }

            // отжатие кнопки
            // if ($problem.hasClass('btn-success')) {
            //     $problem.toggleClass('btn-default').toggleClass('btn-success');
            // }
        }
         rootScope.$on('closeDriverName', function (event, filterId, drawNewRoute) {
                //scope.selectRouteFilter = filterId;

                 // var driversArr = [];
                 // for(var i=0; i<scope.filters.routes.length; i++){
                 //    driversArr.push( scope.filters.routes[i].driver || null);
                 // }
                 // scope.filters.route = driversArr.indexOf(data)-1;
             if(drawNewRoute){
                 scope.filters.route = filterId;
             }else{
                 scope.filters.route = -1;
             }
         });



        // scope.selectFilterRute = function(){
        //
        //     for(var i = 0; _data.routes.length > i; i++ ){
        //         if(_data.routes[i].filterId == scope.filters.route){
        //             if(!_data.routes[i].selected){
        //                 for(var j = 0; _data.routes.length > j; j++){
        //                     _data.routes[j].selected = false;
        //                 }
        //                 _data.routes[i].selected = true;
        //             }
        //             break;
        //         }
        //     }
        // };
        scope.$watch('filters.route', function(){
            if(_data != undefined) {
                if (scope.filters.route == -1) {
                    console.log("All Routes selected");
                    rootScope.$emit('logoutsave');
                    scope.$emit('clearMap');
                    for (var j = 0; _data.routes.length > j; j++) {
                        _data.routes[j].selected = false;
                    }
                    rootScope.$emit('displayCollectionToStatistic', scope.displayCollection);
                } else {
                    scope.drawRoute(scope.filters.route);
                    rootScope.carCentre=true;
                    for (var i = 0; _data.routes.length > i; i++) {
                        if (_data.routes[i].filterId == scope.filters.route) {
                            if (!_data.routes[i].selected) {
                                for (var j = 0; _data.routes.length > j; j++) {
                                    _data.routes[j].selected = false;
                                }
                                _data.routes[i].selected = true;
                            }
                            rootScope.$emit('displayCollectionToStatistic', _data.routes[i].points);
                            break;
                        }
                    }
                }
            }
        });



        // установить динамическое обновление данных
        //не понятно где используется!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        function setDynamicDataUpdate(seconds) {
            interval(function () {
                console.log('setDynamicDataUpdate()');
                if (_data == null) return;
                _data.server_time += seconds;
                console.log("setDynamicDataUpdate updateData");
                updateData();
            }, seconds * 1000);
        }

        // установить динамическое обновление треков
        function setRealTrackUpdate(seconds) {
            interval(function () {
                checkTimeForEditing();
                console.log('setRealTrackUpdate()');
                if (_data == null) return;
                _data.server_time += seconds;
                rootScope.nowTime  += seconds;
                loadTrackParts();
            }, seconds * 1000);
        }

        // установить интервал обновление информации о блокировках задач
        function setCheckLocksInterval() {
            interval(checkLocks, checkLocksInterval * 1000);
        }

        // проверить блокировку задач
        function checkLocks() {
            if (!_data) return;

            http.get('./checklocks/' + _data.ID.replace('/', 'SL'))
                .success(function (data) {
                    if (data.status == 'changed') {
                        //console.log(data);
                        scope.locked = data.locked.locked;
                        refreshLocked();
                    }
                }).error(function(){
                   // rootScope.errorNotification('/checklocks');
                });
        }

        // привести таблицу задач в соответствие с scope.locked
        function refreshLocked() {
            var point,
                haveLockedTasks;

            for (var i = 0; i < _data.routes.length; i++) {
                haveLockedTasks = false;
                for (var j = 0; j < _data.routes[i].points.length; j++) {
                    point = _data.routes[i].points[j];
                    for (var k = 0; scope.locked && k < scope.locked.length; k++) {
                        if (scope.locked[k].taskId == point.TASK_NUMBER) {
                            haveLockedTasks = true;
                            point.locked = true;
                            point.lockedByMe = scope.locked[k].user == _data.user;
                            if (scope.locked[k].routeId) {
                                point.lockedRoute = true;
                                _data.routes[i].lockedByMe = point.lockedByMe;
                                _data.routes[i].locked = true;
                            }
                            break;
                        }

                        if (k + 1 == scope.locked.length) {
                            delete point.locked;
                            delete point.lockedByMe;
                            delete point.lockedRoute;
                        }
                    }
                }

                if (!haveLockedTasks) {
                    delete _data.routes[i].lockedByMe;
                    delete _data.routes[i].locked;
                }
            }
        }

        // загрузить части трека
        function loadTrackParts() {
            if(rootScope.currentDay) {
                if (_data == null) return;

                if (_data.trackUpdateTime == undefined) {
                    _data.trackUpdateTime = _data.server_time;
                }

                var _now = Date.now() / 1000,
                    url = './trackparts/' + parseInt(_data.trackUpdateTime) + '/' + ( (_data.currentDay) ? parseInt(_now) : parseInt(_data.server_time) );

                //console.log(url);
                http.get(url)
                    .success(function (trackParts) {
                        //console.log('loaded track parts');

                        for (var i = 0; i < trackParts.length; i++) {
                            // если часть трека не валидна - пропускаем итерацию
                            if (trackParts[i].data == undefined ||
                                trackParts[i].data.length == 0 ||
                                trackParts[i].data == aggregatorError) {
                                continue;
                            }

                            // добавляем новые данные к уже существующему треку
                            for (var j = 0; j < _data.routes.length; j++) {
                                if (_data.routes[j].transport.gid == trackParts[i].gid) {

                                    //console.log ('To track', _data.routes[j].real_track.length, "add", trackParts[i].data.length);

                                    if (trackParts[i].data.length > 0) {
                                        _data.routes[j].last_signal=trackParts[i].data[trackParts[i].data.length-1].t1;


                                        if (_data.routes[j].real_track != undefined && _data.routes[j].real_track.length>0 && (_data.routes[j].ID == '47' || _data.routes[j].ID == '24'|| _data.routes[j].ID == '38')) {
                                            console.log ("Concat", _data.routes[j].real_track, "with", trackParts[i].data );
                                            console.log('To track length', _data.routes[j].real_track.length, "add",  trackParts[i].data.length, "t1 for last exist", _data.routes[j].real_track[_data.routes[j].real_track.length - 1].t1, "t1 for first recieved", trackParts[i].data[0].t1);
                                        }
                                        // Не удалять потом, в этом блоке проверяется и устанавливается новое nowTime,
                                        // максимум из существующего и самого большого времени в полученых стейтах
                                        var k=0;
                                          while (k<trackParts[i].data.length) {
                                            // Если в стейте есть таймстамп больше чем ранее полученное время, то мы переопределяем время.
                                            if(rootScope.nowTime < trackParts[i].data[k].t2) {
                                                rootScope.nowTime = trackParts[i].data[k].t2;

                                            }
                                          k++;
                                        }





                                        if (_data.routes[j].real_track != undefined &&_data.routes[j].real_track.length>0 && trackParts[i].data.length>0 && (_data.routes[j].ID == '47' || _data.routes[j].ID == '24' || _data.routes[j].ID == '38')) {
                                            console.log('times', _data.routes[j].real_track[_data.routes[j].real_track.length - 1].t1, trackParts[i].data[0].t1)
                                        }


                                        //Удаляем стейты с 0 таймж
                                        //TODO снять комментарий
                                        var h = 0;

                                        while (h< trackParts[i].data.length) {
                                            if (trackParts[i].data[h].time == 0 ){
                                                //console.log("State with time = 0",trackParts[i].data[h])
                                                trackParts[i].data.splice(h,1);
                                                h--;
                                            }

                                            h++;
                                        }

                                        if (trackParts[i].data.length>0 && (_data.routes[j].ID == '47' || _data.routes[j].ID == '24'|| _data.routes[j].ID == '38')) {
                                            console.log("to concat", trackParts[i].data)
                                        }

                                        // Удаляем последний стэйт если он каррент позитион но только перед добавкой новых стейтов
                                        if ( _data.routes[j].real_track != undefined && _data.routes[j].real_track.length>0 && trackParts[i].data.length>0){
                                            if (_data.routes[j].real_track[_data.routes[j].real_track.length-1].state == "CURRENT_POSITION"){
                                                _data.routes[j].car_position.lat = trackParts[i].data[trackParts[i].data.length-1].lat;
                                                _data.routes[j].car_position.lon = trackParts[i].data[trackParts[i].data.length-1].lon;
                                                _data.routes[j].real_track.length =_data.routes[j].real_track.length-1;
                                            }
                                        }
                                        ////тестово отладочный блок, поиск и удаление невалидных разрозненных стейтов.
                                        //    var l=0;
                                        //    while(l<trackParts[i].data.length){
                                        //        console.log(trackParts[i].gid, "GID have state", trackParts[i].data[l].state , "this is State", trackParts[i].data[l]);
                                        //        l++;
                                        //    }

                                            //console.log("Prepere for deleting ",trackParts[i].data[0].state)



                                        // сравниваем id первого полученного и последнего существующего.
                                        // Если одинаковые, то перезаписываем обобщенные данные в существующий и удаляем первый из полученных


                                        if(_data.routes[j].real_track >0 && trackParts[i].data.length>0 && trackParts[i].data[0].time>0 && _data.routes[j].real_track[_data.routes[j].real_track.length - 1].t1 == trackParts[i].data[0].t1) {
                                            console.log("Update last state", _data.routes[j].real_track[_data.routes[j].real_track.length-1].t2,  trackParts[i].data[0].t2);
                                            _data.routes[j].real_track[_data.routes[j].real_track.length-1].dist = trackParts[i].data[0].dist;
                                            _data.routes[j].real_track[_data.routes[j].real_track.length-1].lat = trackParts[i].data[0].lat;
                                            _data.routes[j].real_track[_data.routes[j].real_track.length-1].lon = trackParts[i].data[0].lon;
                                            _data.routes[j].real_track[_data.routes[j].real_track.length-1].id = trackParts[i].data[0].id;
                                            _data.routes[j].real_track[_data.routes[j].real_track.length-1].t2 = trackParts[i].data[0].t2;
                                            _data.routes[j].real_track[_data.routes[j].real_track.length-1].time = trackParts[i].data[0].time;
                                            trackParts[i].data.splice(0,1);

                                        }



                                            _data.routes[j].real_track = _data.routes[j].real_track || [];
                                            _data.routes[j].real_track = _data.routes[j].real_track.concat(trackParts[i].data);
                                            if (_data.routes[j].real_track.length > 0 && _data.routes[j].real_track[0].lastTrackUpdate != undefined) {
                                                _data.routes[j].real_track[0].lastTrackUpdate -= updateTrackInterval * 2;
                                            }

                                            var len = _data.routes[j].real_track.length - 1;

                                            _data.routes[j].car_position = _data.routes[j].real_track[len];

                                            //if (_data.routes[j] != undefined && _data.routes[j].real_track != undefined &&
                                            //    _data.routes[j].real_track.length > 0) {
                                            //    len = _data.routes[j].real_track.length - 1;
                                            //    //console.log("len", len);
                                            //    //console.log("Delete last from", _data.routes[j].real_track.length, "last", _data.routes[j].real_track[_data.routes[j].real_track.length-1]  );
                                            //    _data.routes[j].real_track.splice(len, 1);
                                            //    //_data.routes[j].real_track.length=len;
                                            //    //console.log("Delete post from", _data.routes[j].real_track.length, "last", _data.routes[j].real_track[_data.routes[j].real_track.length-1] );
                                            //}

                                        //var k=0;
                                        //var resultString='';
                                        //while (k<_data.routes[j].real_track.length) {
                                        //    resultString += _data.routes[j].real_track[k].state +" ";
                                        //
                                        //    k++;
                                        //}
                                        //
                                        //if (_data.routes[j].uniqueID == "162119") {
                                        //    console.log("resultString", resultString, "Length=", _data.routes[j].real_track.length );
                                        //}
                                    }
                                    if((_data.routes[j].ID == '47' || _data.routes[j].ID == '24'|| _data.routes[j].ID == '38')) {
                                        console.log('Result', _data.routes[j].real_track.length, "added", trackParts[i].data.length);
                                    }
                                    break;
                                }
                            }
                        }
                        _data.trackUpdateTime = _now;
                        console.log("Update Dinamicly stops for routes updateData");
                        updateData();
                        serverPredicate();
                        // когда расчеты и загрузки закончены, проверяем не появились ли новые утвержденные решения.
                        checkNewIten();


                    }).error(function (err) {
                   // rootScope.errorNotification(url);
                });
            } else {
                console.log("This is PAST Day");
            }
        }

        // насильная загрузка данных мимо кеша сервера
        scope.forceLoad = function () {
            console.log('forceLoad');
            loadDailyData(true);
        };





        // загрузить все необходимые данные для работы мониторинга
        function loadDailyData(force, showDate) {
            showPopup('Загружаю данные...');
            var url = './dailydata';
            if (force)  url += '?force=true';
          //  if (showDate)   url += (force ? '&' : '?') + 'showDate=' + 1464132000000;
            if (showDate)   url += (force ? '&' : '?') + 'showDate=' + showDate;
            //console.log('waiting for data');

            http.get(url, {})
                .success(function (data) {
                    console.log(JSON.parse(JSON.stringify(data)));
                    if(data.currentDay){
                        rootScope.currentDay = true;
                        scope.filters.problem_index = 1;
                    }else{
                        rootScope.currentDay = false;
                        scope.filters.problem_index = -1;
                    }
                    //var newData=JSON.stringify(data);
                    //var toPrint=JSON.parse(newData);
                    rootScope.reasons=data.reasons;
                    rootScope.nowTime=data.current_server_time;
                    console.log("!!!!!!!!!!!!Data server time = ", data.server_time );
                    console.log("Loaded DATA", data.date, data);

                    //проверка на сегодняшний день

                    //console.log("before chose CurrentDay", rootScope.currentDay, data.server_time );
                    //console.log(chooseDate, "==", currentTime, "or", showDate, "==", scope.nowTime );
                    //if(chooseDate.getFullYear()+'.'+chooseDate.getMonth()+'.'+chooseDate.getDate() == currentTime.getFullYear()+'.'+currentTime.getMonth()+'.'+currentTime.getDate()){
                    //if(rootScope.currentDay){
                    //
                    //    console.log("!!!!!!!!!HURA We load today DAY");
                    //} else {
                    //
                    //    console.log("(((((( We LOAD PAST!!! Problem=" , scope.filters.problem_index);
                    //
                    //}
                    if (newSettings != undefined){
                        var stringSettings = JSON.stringify(newSettings);
                        var start = stringSettings.indexOf("predict");
                        stringSettings = stringSettings.substring(start);
                        start = stringSettings.indexOf(":");
                        var end = stringSettings.indexOf(',');

                        var temp = stringSettings.substring(start+1, end);
                        stringSettings = stringSettings.substring(end+1);
                        console.log("Start", stringSettings, start, temp);
                        scope.params.predictMinutes = parseInt(temp);
                        console.log("Start", stringSettings, start, temp, scope.params.predictMinutes);


                        start = stringSettings.indexOf(":");
                        end = stringSettings.indexOf(',');

                        temp = stringSettings.substring(start+1, end);

                        console.log("second",stringSettings, start, end, "Temp, Fact", temp);
                        stringSettings = stringSettings.substring(end+1);
                        scope.params.factMinutes = parseInt(temp);

                        start = stringSettings.indexOf(":");
                        end = stringSettings.indexOf(',');

                        temp = stringSettings.substring(start+1, end);
                        stringSettings = stringSettings.substring(end+1);
                        scope.params.volume = parseInt(temp);

                        start = stringSettings.indexOf(":");
                        end = stringSettings.indexOf(',');

                        temp = stringSettings.substring(start+1, end);
                        stringSettings = stringSettings.substring(end+1);
                        scope.params.weight = parseInt(temp);

                        start = stringSettings.indexOf(":");
                        end = stringSettings.indexOf(',');

                        temp = stringSettings.substring(start+1, end);
                        stringSettings = stringSettings.substring(end+1);
                        scope.params.value = parseInt(temp);

                        start = stringSettings.indexOf(":");
                        end = stringSettings.indexOf(',');

                        temp = stringSettings.substring(start+1, end);
                        stringSettings = stringSettings.substring(end+1);
                        scope.params.changeTime = parseInt(temp);


                        start = stringSettings.indexOf(":");
                        end = stringSettings.indexOf(',');

                        temp = stringSettings.substring(start+1, end);
                        stringSettings = stringSettings.substring(end+1);
                        scope.params.workingWindowType = parseInt(temp);

                        start = stringSettings.indexOf(":");
                        end = stringSettings.indexOf(',');

                        temp = stringSettings.substring(start+1, end);
                        stringSettings = stringSettings.substring(end+1);
                        scope.params.endWindowSize = parseInt(temp);

                        start = stringSettings.indexOf(":");
                        end = stringSettings.indexOf(',');

                        temp = stringSettings.substring(start+1, end);
                        stringSettings = stringSettings.substring(end+1);
                        scope.params.stopRadius = parseInt(temp);

                        start = stringSettings.indexOf(":");
                        end = stringSettings.indexOf(',');

                        temp = stringSettings.substring(start+1, end);
                        stringSettings = stringSettings.substring(end+1);
                        scope.params.mobileRadius = parseInt(temp);

                        start = stringSettings.indexOf(":");
                        end = stringSettings.indexOf(',');

                        temp = stringSettings.substring(start+1, end);
                        stringSettings = stringSettings.substring(end+1);
                        scope.params.timeThreshold = parseInt(temp);

                        start = stringSettings.indexOf(":");
                        end = stringSettings.indexOf('}');

                        temp = stringSettings.substring(start+3, end-2);
                        console.log("Last Params", stringSettings,start,end, temp);
                        scope.params.routeListOrderBy = ""+temp;

                        console.log("SCOPE PARAMS", scope.params);


                    }

                    //console.log("I load this data", toPrint);
                    linkDataParts(data);
                    if (rootScope.currentDay) {
                        loadExistData(scope.routesOfDate);
                    }

                    if (loadParts && rootScope.currentDay) {
                        loadTrackParts();
                        console.log("load track parts");
                    }
                    //console.log(data,' success data');

                    console.log("!!!!!!!!!!!!Data server time = ", data.server_time );

                    if (!rootScope.currentDay){
                        enableDynamicUpdate=false;
                        updateData();
                        updateDataforPast();

                    } else {
                        enableDynamicUpdate=true;
                        updateData();
                    }




                })
                .error(function (err) {
                    console.log(err);
                    rootScope.errorNotification(url);
                });


            console.log("Update Settings from ParentForm", newSettings);


        }

        rootScope.$on('reqOldroute', function(event, data){
            console.log(data, 'прием в поинт ндекс');
            http.post('/getoldroute', {date: data})
                .success(function (data) {
                    linkDataParts(data);
                    loadExistData(scope.routesOfDate);
                    if (loadParts) {
                        loadTrackParts();
                        console.log("load  old routes");
                    }
                    rootScope.$emit('thisIsOldDay');
            });
        });
        rootScope.$on('getCurrentday', function(){
            loadDailyData(false);
        });



        // получить объект Date из строки
        function strToTstamp(strDate, lockaldata) {
            //console.log(strDate, "strDate");
            var parts = strDate.split(' ');
            var    _date = parts[0].split('.');
            var _time;
            var toPrint=JSON.stringify(strDate);
            try {
               _time = parts[1].split(':');} catch (exeption) {
                console.log(toPrint, "Error", exeption, lockaldata);
            }



            //console.log(strDate, "strDate", "convert to", _date[2], _date[1] - 1, _date[0], _time[0], _time[1], _time[2]);

            return new Date(_date[2], _date[1] - 1, _date[0], _time[0], _time[1], _time[2]).getTime() / 1000;
        }

        // слинковать данные пришедшие от сервера
        function linkDataParts(data) {
            //console.info(data);
            init();
            // закоментил инит, возможно будут ошибки
            scope.routesOfDate = data.routesOfDate;

            //console.log('Start linking ...', new Date(data.server_time * 1000));
            rawData = JSON.parse(JSON.stringify(data));

            if (data.status && data.status === 'no plan') {
                showPopup('Нет планов для загрузки.');
            }

            scope.demoMode = data.demoMode === true;
            scope.$emit('setMode', {
                mode: scope.demoMode,
                demoStartTime: data.server_time_demo
            });

            if (scope.demoMode) {
                console.log('DEMO MODE');
                data.server_time = data.server_time_demo + scope.params.demoTime * 300;
                console.log('Demo time', new Date(data.server_time * 1000));
            }

            var tmpPoints,
                rowId = 0,
                routeId = 0,
                len = 0,
                tPoint,
                roundingNumb = 300,         // шаг округления обещанных окон
                problematicRoutes = [],
                branchIndx,
                tmpTaskNumber = -1;
            scope.rowCollection = [];

            // нет сенсоров - нет интерфейса
            if (!data.sensors) {
                console.log(data);
                return;
            }


            //console.log("PIC 323", data);
            // тестовоотладочный блок


            // привязывание гидов из сенсоров к машинам, назначение реальных треков машинам
            for (var i = 0; i < data.sensors.length; i++) {
                for (var j = 0; j < data.transports.length; j++) {
                    if (data.sensors[i].TRANSPORT == data.transports[j].ID) {
                        data.transports[j].gid = data.sensors[i].GID;
                        data.transports[j].real_track = data.sensors[i].real_track;
                    }
                }
            }


            for (i = 0; i < data.routes.length; i++) {
                if (data.routes[i].moreThanOneSensor) problematicRoutes.push(data.routes[i]);

                //TODO: get real branch office
                data.routes[i].branch =data.BRANCH;
                    //i % 2 == 0 ? 'Киев ТЕСТ' : 'Одесса ТЕСТ';

                for (var j = 0; j < scope.filters.branches.length; j++) {
                    if (scope.filters.branches[j].name == data.routes[i].branch) {
                        branchIndx = scope.filters.branches[j].value;
                        break;
                    }
                    else if (j == scope.filters.branches.length - 1) {
                        scope.filters.branches.push({
                            name: data.routes[i].branch,
                            value: scope.filters.branches.length
                        });
                        branchIndx = scope.filters.branches.length - 1;
                    }
                }

                // назначение машин и реальных треков на маршруты
                for (j = 0; j < data.transports.length; j++) {
                    if (data.routes[i].TRANSPORT == data.transports[j].ID) {
                        data.routes[i].transport = data.transports[j];
                        data.routes[i].real_track = data.transports[j].real_track;

                        if (data.transports[j].real_track != undefined &&
                            data.routes[i].real_track.length > 0 &&
                            data.routes[i].real_track != aggregatorError) {
                            len = data.routes[i].real_track.length - 1;
                            data.routes[i].car_position = data.routes[i].real_track[len]; // определение текущего положения машины
                            //console.log('data.routes[i]', data.routes[i]);
                            if (typeof (data.routes[i].real_track)==Array) {
                            data.routes[i].real_track.splice(len, 1);} // удаление стейта с текущим положением машины
                        }
                        break;
                    }
                }

                // назначение маршрутам водитилей
                for (j = 0; j < data.drivers.length; j++) {
                    if (data.routes[i].DRIVER == data.drivers[j].ID) {
                        data.drivers[j].NAME = cutFIO(data.drivers[j].NAME);
                        data.routes[i].driver = data.drivers[j];
                        break;
                    }
                }
                if(j == data.drivers.length){
                    console.log(data.routes[i].DRIVER);
                }


                // если у маршрута нет машины или водителя - удаляем маршрут
                if (!data.routes[i].transport) {
                    data.routes.splice(i, 1);
                    rawData.routes.splice(i, 1);
                    i--;
                    continue;
                }

                tmpPoints = data.routes[i].points;
                for (j = 0; j < tmpPoints.length; j++) {
                    tPoint = tmpPoints[j];
                    tPoint.branchIndx = branchIndx;
                    tPoint.branchName = data.routes[i].branch;
                    tPoint.driver = data.routes[i].driver;
                    tPoint.in_plan = true;

                    // если нет номера задачи, ставим отрицательный номер
                    if (!tPoint.TASK_NUMBER) {
                        tPoint.TASK_NUMBER = tmpTaskNumber;
                        tmpTaskNumber--;
                    }


                    //тестово отладочный блок
                    //if(data.routes[i].driver.ID== "_____X___"){
                    //console.log(" data.routes[i].filterId", data.routes[i].filterId)}

                    if (data.routes[i].filterId == null) {
                        data.routes[i].filterId = routeId;

                        //TODO REMOVE AFTER TESTING
                        //data.routes[i].transport = data.routes[0].transport;
                        //data.server_time = 1446611800;
                        ///////////////////////////

                        scope.filters.routes.push({
                            //name: data.routes[i].transport.NAME,

                            allRoutes: false,

                            nameDriver:  ( ( data.routes[i].hasOwnProperty('driver') && data.routes[i].driver.hasOwnProperty('NAME') ) ? data.routes[i].driver.NAME : 'без имени') + ' - ' + data.routes[i].transport.NAME ,
                            nameCar:  data.routes[i].transport.NAME  + ' - ' +   ( ( data.routes[i].hasOwnProperty('driver') && data.routes[i].driver.hasOwnProperty('NAME') ) ? data.routes[i].driver.NAME : 'без имени') ,

                            value: data.routes[i].filterId,


                            car: data.routes[i].transport.NAME,
                            driver: ( data.routes[i].hasOwnProperty('driver') && data.routes[i].driver.hasOwnProperty('NAME') ) ? data.routes[i].driver.NAME : 'без имени'+i //!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!добавили свойство driver для события в closeDriverName
                        });
                          //  console.log(scope.filters.routes, ' filters.routes');
                        routeId++;
                    }



                    try {
                        tPoint.route_indx = data.routes[i].filterId;
                        tPoint.transport = data.routes[i].transport;

                        if (data.routes[i].DISTANCE==0) {
                            //console.log("The route is UNCALCULATE");


                            //Для непосчитанных маршрутов время прибытия считается границей окна доступности
                            tPoint.arrival_time_hhmm = tPoint.AVAILABILITY_WINDOWS.slice(-5)+":00";

                            // Костыль. Когда в утвержденные маршруты попадает точка с неуказанным временем прибытия
                            if (tPoint.ARRIVAL_TIME.length<1) {
                                tPoint.ARRIVAL_TIME=data.routes[i].points[j-1].ARRIVAL_TIME;
                            }
                            var toDay=tPoint.ARRIVAL_TIME.substr(0, 10);

                            tPoint.base_arrival=toDay+" "+ tPoint.arrival_time_hhmm;

                            tPoint.arrival_time_ts = strToTstamp(toDay+" "+tPoint.arrival_time_hhmm);
                            tPoint.base_arrival_ts = strToTstamp(toDay+" "+tPoint.arrival_time_hhmm);



                            tPoint.controlled_window = {
                                start: tPoint.arrival_time_ts - controlledWindow,
                                finish: tPoint.arrival_time_ts + controlledWindow
                            };

                            tPoint.end_time_hhmm = tPoint.AVAILABILITY_WINDOWS.slice(-5)+":00";
                            tPoint.end_time_ts = strToTstamp(toDay+" "+tPoint.arrival_time_hhmm);

                        }
                        else {
                            //console.log("!!!!!The route is Very Good CALCULATE!!!!");
                            tPoint.arrival_time_hhmm = tPoint.ARRIVAL_TIME.substr(11, 8);


                            tPoint.arrival_time_ts = strToTstamp(tPoint.ARRIVAL_TIME);
                            tPoint.base_arrival_ts = strToTstamp(tPoint.base_arrival);



                            tPoint.controlled_window = {
                                start: tPoint.arrival_time_ts - controlledWindow,
                                finish: tPoint.arrival_time_ts + controlledWindow
                            };

                            tPoint.end_time_hhmm = tPoint.END_TIME.substr(11, 8);

                            tPoint.end_time_ts = strToTstamp(tPoint.END_TIME);

                        }



                    } catch (e) {
                        console.log("Error", tPoint);
                        console.log(tPoint.driver.NAME, e);
                    }


                    tPoint.NUMBER = parseInt(tPoint.NUMBER);
                    tPoint.row_id = rowId;
                    tPoint.arrival_prediction = 0;
                    tPoint.arrival_left_prediction = 0;
                    tPoint.status = STATUS.SCHEDULED;

                    tPoint.route_id = i;
                    rowId++;

                    tPoint.windows = TimeConverter.getTstampAvailabilityWindow(tPoint.AVAILABILITY_WINDOWS, data.server_time);
                    // создание обещанных окон
                    if (tPoint.promised_window == undefined && tPoint.windows != undefined) {
                        //console.log("Create PROMISED WINDOW step1");

                        for (k = 0; k < tPoint.windows.length; k++) {
                            if (tPoint.windows[k].finish + 120 > tPoint.arrival_time_ts &&
                                tPoint.windows[k].start - 120 < tPoint.arrival_time_ts) {
                                if (tPoint.arrival_time_ts + promisedWindow / 2 > tPoint.windows[k].finish) {
                                    tPoint.promised_window = {
                                        start: tPoint.windows[k].finish - promisedWindow,
                                        finish: tPoint.windows[k].finish
                                    };
                                } else if (tPoint.arrival_time_ts - promisedWindow / 2 < tPoint.windows[k].start) {
                                    tPoint.promised_window = {
                                        start: tPoint.windows[k].start,
                                        finish: tPoint.windows[k].start + promisedWindow
                                    };
                                }

                                break;
                            }
                        }
                    }

                    // если обещанное окно не было созданно выше, создаем его вокруг времени прибытия и округляем
                    if (tPoint.promised_window == undefined) {
                        //console.log("Create PROMISED WINDOW step2");
                        tPoint.promised_window = {
                            start: tPoint.arrival_time_ts - promisedWindow / 2,
                            finish: tPoint.arrival_time_ts + promisedWindow / 2
                        };

                        tPoint.promised_window.start -= tPoint.promised_window.start % roundingNumb - roundingNumb;
                        tPoint.promised_window.finish = tPoint.promised_window.start + promisedWindow;
                        for (var k = 0; tPoint.windows != undefined && k < tPoint.windows.length; k++) {
                            if (tPoint.windows[k].finish + 120 > tPoint.arrival_time_ts &&
                                tPoint.windows[k].start - 120 < tPoint.arrival_time_ts) {
                                if (tPoint.windows[k].finish < tPoint.promised_window.finish) {
                                    tPoint.windows[k].finish -= roundingNumb;
                                }
                            }
                        }

                    }

                    // копируем обещанное окно без ссылок
                    if (tPoint.promised_window_changed == undefined) {
                        //console.log("Create PROMISED WINDOW step3");
                        tPoint.promised_window_changed = JSON.parse(JSON.stringify(tPoint.promised_window));
                    }

                    if (scope.params.workingWindowType == 0) {
                        for (var k = 0; tPoint.windows != undefined && k < tPoint.windows.length; k++) {
                            //console.log("Create PROMISED WINDOW step4");
                            if (tPoint.windows[k].finish + 120 > tPoint.arrival_time_ts &&
                                tPoint.windows[k].start - 120 < tPoint.arrival_time_ts) {
                                tPoint.working_window = tPoint.windows[k];
                            }
                        }

                        if (tPoint.working_window == undefined) tPoint.working_window = tPoint.promised_window_changed;
                    } else if (scope.params.workingWindowType == 1) {
                        tPoint.working_window = tPoint.promised_window_changed;
                    }

                }


                scope.rowCollection = scope.rowCollection.concat(data.routes[i].points);
               // console.log(scope.rowCollection, ' rcol'); !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
            }


            //console.log(data);
            //console.log(scope.rowCollection);

            // оповещаем ползователя о проблемных маршрутах
            if (problematicRoutes.length > 0) {
                var msg = '<p style="width: 450px;" >Обнаружены машины с несколькими датчиками. Для данных машин необходимо ' +
                    'оставить только один датчик, в противном случае ' +
                    'для них не будут корректно определяться стопы.</p><ul>';
                for (var j = 0; j < problematicRoutes.length; j++) {
                    msg += '<li>' + problematicRoutes[j].transport.NAME + ', '
                        + problematicRoutes[j].driver.NAME + '</li>';
                }
                msg += '</ul>';
                showPopup(msg);
            }


            _data = data;
            //updateData();
            //_data = concatDailyAndExistingData (_data);

            //console.log('Finish linking');
            scope.displayCollection = [].concat(scope.rowCollection);

            saveRoutes();
            checkLocks();


            scope.$emit('forCloseController', data); //отправляем дату, имя компании и прочее в close-day-controller

            showPopup('Загрузка завершенна!', 200);
            //console.log(showPopup, ' showPopup');

            setColResizable();
            prepareFixedHeader();
        }

        // обрезает ФИО до ФИ
        function cutFIO(fioStr) {
            fioStr = fioStr.replace(/_/g, " ");
            var parts = fioStr.split(' ');
            return ( (parts[0])? parts[0] + ' ' : "" )  + ( (parts[1])? parts[1] : "" );

        }

        scope.uppHeader = function(){
            setColResizable();
            prepareFixedHeader();
        };

        // обновляет статусы и делает прогнозы по слинкованным данным
        function updateData() {
            console.log("StartUpdateData");
            console.time("step2");
            statusUpdate();
            //predicationArrivalUpdate();


            promised15MUpdate();


           // console.log("Сейчас будем апдейтить дату", scope.existDataLoaded);

            //накатываем сверху существующие ранее данные взятые с ноды, но только один раз при первой загрузке.
            if (!scope.existDataLoaded) {
                console.log(" Ура сейчас мы Накатываем сверху скачанные данные");
                concatDailyAndExistingData();
                scope.existDataLoaded=true;
                statusUpdate();
                unlockAllRoutes(null, _data);

               // scope.fastCalc=true;
            }

           // console.log("Finish CCALCULATING!!!!!");
            console.timeEnd("step2");
            //scope.$apply;
        }

        // проверка на попадание не выполненных точек в указанный в настройках диапазон в конце рабочего окна
        function promised15MUpdate() {
            var now = _data.server_time;

            //scope.nowTime=now;
            for (var i = 0; i < _data.routes.length; i++) {
                for (var j = 0; j < _data.routes[i].points.length; j++) {
                    _data.routes[i].points[j].promised_15m = (_data.routes[i].points[j].status == STATUS.SCHEDULED ||
                        _data.routes[i].points[j].status == STATUS.TIME_OUT ||
                        _data.routes[i].points[j].status == STATUS.DELAY ||
                        _data.routes[i].points[j].status == STATUS.IN_PROGRESS) &&
                        _data.routes[i].points[j].working_window.finish - scope.params.endWindowSize * 300 < now &&
                        _data.routes[i].points[j].working_window.finish > now;
                }
            }
        }

        // получить дистанцию между двумя LanLon в метрах
        function getDistanceFromLatLonInM(lat1, lon1, lat2, lon2) {
            var R = 6371; // Radius of the earth in km
            var dLat = deg2rad(lat2 - lat1);  // deg2rad below
            var dLon = deg2rad(lon2 - lon1);
            var a =
                    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
                    Math.sin(dLon / 2) * Math.sin(dLon / 2)
                ;
            var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            var d = R * c; // Distance in km
            //console.log("lat1", lat1, "lon1", lon1, "lat2", lat2, "lon2", lon2, ' dist', d*1000);
            return d * 1000;
        }

        // конверт градусов в радианы
        function deg2rad(deg) {
            return deg * (Math.PI / 180)
        }
        //rootScope.$on('fastCalc', function(){
        //    scope.fastCalc = false;
        //});
        // обновление статусов
        function statusUpdate() {
            //console.log('statusUpdate');
            //if (!rootScope.currentDay){
            //    updateDataforPast();
            //    return;
            //}



            var route,
                tmpPoint,
                tmpArrival,
                timeThreshold = scope.params.timeThreshold * 60,
                LAT,
                LON,
                lat,
                lon,
                now = _data.server_time,
                lastPoint,
                tmpDistance,
                tmpTime,
                status,
                haveUnfinished;

            // удалением всех свойств задач созданных ранее при назначении статусов перед их переназначением
            for (var i = 0; i < _data.routes.length; i++) {
                for (var j = 0; j < _data.routes[i].points.length; j++) {
                    tmpPoint = _data.routes[i].points[j];


                    //Lля уменьшения количества рассчетов выбрасываем из расчетов следующие категории
                    // Подтвержденные точки (из таблицы точек или ручным связыванием точки и стопа)
                    // Точки у которых есть пуш и стоп
                    // Стопы, которые были более 5 минут назад (Они скорее всего уж)
                    //
                    //
                    //
                    //


                    if(tmpPoint.rawConfirmed == 1 || tmpPoint.confirmed==true){
                        //console.log("Подтверждена вручную Уходим");
                        continue;
                    }
                    //
                    //if (scope.fastCalc && tmpPoint.haveStop && tmpPoint.havePush) {
                    //   // console.log("Подтверждена пушем и стопом Уходим");
                    //    continue;
                    //}
                    //
                    //if (scope.fastCalc && tmpPoint.haveStop && (_data.routes[i].pushes==undefined || _data.routes[i].pushes =='undefined' ||  _data.routes[i].pushes.length==0) ){
                    //    //console.log("Подтверждена стопом. Валидных пушей нет уходим");
                    //    continue;
                    //}
                    //
                    //if(scope.fastCalc && (tmpPoint.status<=2 || tmpPoint.status==8)){
                    //    //console.log("Точка уже доставлена идем дальше");
                    //    continue;
                    //}

                   // console.log("Пересчет");
                    //tmpPoint.status = STATUS.SCHEDULED;

                    delete tmpPoint.distanceToStop;
                    delete tmpPoint.timeToStop;
                    delete tmpPoint.haveStop;
                    delete tmpPoint.stopState;
                    delete tmpPoint.stop_arrival_time;
                    delete tmpPoint.real_arrival_time;
                    delete tmpPoint.windowType;
                    //delete tmpPoint.mobile_push;
                    delete tmpPoint.mobile_arrival_time;
                    //delete tmpPoint.havePush;
                    delete tmpPoint.real_arrival_time;
                    delete tmpPoint.confirmed;
                    //delete tmpPoint.servicePoints;
                    delete tmpPoint.overdue_time;
                    //delete tmpPoint.limit;




                }

                _data.routes[i].lastPointIndx = 0;
                delete _data.routes[i].pushes;


            }



            for (i = 0; i < _data.routes.length; i++) {
                route = _data.routes[i];
                //console.log ("route.driver.name", route.driver.NAME);
                route.lastPointIndx = 0;
                if (route.real_track != undefined) {
                    for (j = 0; j < route.real_track.length; j++) {
                        // если статус не из будущего (в случае демо-режима) и стейт является стопом, b dhtvz проверяем его
                        if (route.real_track[j].t1 < _data.server_time && route.real_track[j].state == "ARRIVAL") {
                            //console.log("считаем стоп", _data.server_time, route.real_track[j].t1, _data.server_time-route.real_track[j].t1)






                            tmpArrival = route.real_track[j];

                            //console.log("tmpArrival",tmpArrival);
                            // перебираем все точки к которым
                            for (var k = 0; k < route.points.length; k++) {




                                tmpPoint = route.points[k];




                                if(tmpPoint.rawConfirmed == 1 || tmpPoint.confirmed==true){
                                    //console.log("Подтверждена вручную Уходим");
                                    continue;
                                }

                                //if (scope.fastCalc && tmpPoint.haveStop && tmpPoint.havePush) {
                                //    //console.log("Подтверждена пушем и стопом Уходим");
                                //    continue;
                                //}
                                //
                                //if (scope.fastCalc && tmpPoint.haveStop && (_data.routes[i].pushes==undefined || _data.routes[i].pushes =='undefined' ||  _data.routes[i].pushes.length==0) ){
                                //   // console.log("Подтверждена стопом. Валидных пушей нет уходим");
                                //    continue;
                                //}
                                //
                                //if(scope.fastCalc && (tmpPoint.status<=2 || tmpPoint.status==8)){
                                //    //console.log("Точка уже доставлена идем дальше");
                                //    continue;
                                //}





                                LAT = parseFloat(tmpPoint.LAT);
                                LON = parseFloat(tmpPoint.LON);
                                lat = parseFloat(tmpArrival.lat);
                                lon = parseFloat(tmpArrival.lon);

                                tmpPoint.distanceToStop = tmpPoint.distanceToStop || 2000000000;
                                tmpPoint.timeToStop = tmpPoint.timeToStop || 2000000000;

                                tmpDistance = getDistanceFromLatLonInM(lat, lon, LAT, LON);

                                tmpTime = Math.abs(tmpPoint.arrival_time_ts - tmpArrival.t1);






                                // Если маршрут не просчитан, отдельно проверяем попадает ли стоп в одно из возможных временных окон  и насколько он рядом
                                // и если да, то тоже привязываем стоп к точке

                                var suit=false;   //Показывает совместимость точки и стопа для непросчитанного маршрута
                                if (route.DISTANCE == 0 && tmpDistance < scope.params.stopRadius ) {
                                    suit=checkUncalculateRoute(tmpPoint, tmpArrival);
                                }

                                // если стоп от точки не раньше значения timeThreshold и в пределах
                                // заданного в настройках радиуса, а так же новый детект ближе по расстояение и
                                // по времени чем предыдущий детект - привязываем этот стоп к точке



                                if (suit || (tmpPoint.arrival_time_ts < tmpArrival.t2 + timeThreshold &&
                                    tmpDistance < scope.params.stopRadius && (tmpPoint.distanceToStop > tmpDistance &&
                                    tmpPoint.timeToStop > tmpTime))) {

                                    haveUnfinished = false;



                                    if (tmpPoint.NUMBER !== '1' && tmpPoint.waypoint != undefined && tmpPoint.waypoint.TYPE === 'WAREHOUSE') {
                                        for (var l = k - 1; l > 0; l--) {
                                            status = route.points[l].status;
                                            if (status !== STATUS.FINISHED
                                                && status !== STATUS.FINISHED_LATE
                                                && status !== STATUS.FINISHED_TOO_EARLY
                                                && status !== STATUS.ATTENTION)
                                            {
                                                haveUnfinished = true;
                                                continue;
                                            }
                                        }

                                        if (haveUnfinished) {
                                            continue;
                                        }
                                    }



                                    //При привязке к точке нового стопа проверяет какой из стопов более вероятно обслужил эту точку
                                    //
                                    if(tmpPoint.haveStop == true &&!findBestStop(tmpPoint, tmpArrival)){
                                        continue;
                                    }




                                    tmpPoint.distanceToStop = tmpDistance;
                                    tmpPoint.timeToStop = tmpTime;
                                    tmpPoint.haveStop = true;




                                    //{ if (tmpArrival.t1 > tmpPoint.controlled_window.start) && (tmpArrival.t1<tmpPoint.controlled_window.finish){
                                    //    tmpPoint.limit=60;
                                    //} else {tmpPoint.limit=60; } }

                                    tmpPoint.moveState = j > 0 ? route.real_track[j - 1] : undefined;
                                    tmpPoint.stopState = tmpArrival;
                                    //tmpPoint.rawConfirmed=1; //Подтверждаю точку стопа, раз его нашла автоматика.

                                    route.lastPointIndx = k > route.lastPointIndx ? k : route.lastPointIndx;
                                    tmpPoint.stop_arrival_time = tmpArrival.t1;
                                    tmpPoint.real_arrival_time = tmpArrival.t1;
                                    tmpPoint.autofill_service_time = tmpArrival.time;
                                    //route.points[k]
                                    //console.log("route-point-k", route.points[k], "route" , route)

                                    if (angular.isUndefined(tmpArrival.servicePoints)==true){
                                        tmpArrival.servicePoints=[];
                                    }



                                    // проверка, существует ли уже этот пуш
                                    var ip=0;
                                    var sPointExist=false;
                                    while(ip<tmpArrival.servicePoints.length){
                                       if(tmpArrival.servicePoints[ip]==k){
                                           sPointExist=true;
                                           break;
                                       }
                                        ip++;
                                    }
                                    if(!sPointExist){
                                    tmpArrival.servicePoints.push(k);}

                                   // tmpPoint.rawConfirmed=0;

                                    //console.log("Find stop for Waypoint and change STATUS")
                                    findStatusAndWindowForPoint(tmpPoint);


                                }


                            }
                        }

                    }


                   // console.log("PRE Last point for route ", route.ID, " is ", route.points[route.lastPointIndx].NUMBER);
                    lastPoint = route.points[route.lastPointIndx];
                   // console.log("POST Last point for route ", route.ID, " is ", lastPoint.NUMBER);

                    // проверка последней определенной точки на статус выполняется
                    if (lastPoint != null && route.car_position !=  undefined) {
                       // console.log("Route", route);
                        if (lastPoint.arrival_time_ts + parseInt(lastPoint.TASK_TIME) > now
                            && getDistanceFromLatLonInM(route.car_position.lat, route.car_position.lon,
                                lastPoint.LAT, lastPoint.LON) < scope.params.stopRadius) {
                            lastPoint.status = STATUS.IN_PROGRESS;
                        }
                    }
                }

               // console.log("Last point for route", route.ID, _data.routes[i].ID, " is ", route.lastPointIndx, lastPoint.NUMBER );

            }

            //console.log("Step1 parentForm", parentForm);





            console.log("parentFORM=", parentForm);
            console.trace();
            if (parentForm == undefined && !scope.demoMode) {
                checkConfirmedFromLocalStorage();
                //_data.companyName = 'IDS';
                scope.$emit('companyName', _data.companyName);
                //scope.$emit('forCloseController', _data); // это реализовано около строки 308
               // console.log("RETURN?????????");
            }else {


                console.log("Step2____________________________!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");

                var mobilePushes = [],
                    allPushes = [];

                // генерируем мобильные нажатия, если мы в демо-режиме
                if (scope.demoMode) {
                    var rand,
                        gpsTime,
                        tmp,
                        tmpLen,
                        tmpCoord,
                        tmpLat,
                        tmpLon,
                        tmpRoute;

                    tmpTime = undefined;
                    _data.companyName = 'Demo';
                    for (var i = 0; i < _data.routes.length; i++) {

                        tmpRoute = _data.routes[i];
                        seed = i * 122;
                        rand = random(0, 3600);
                        for (var j = 0; j < tmpRoute.points.length; j++) {
                            if (_data.server_time > (tmpRoute.points[j].arrival_time_ts + (rand - 1800))) {
                                if (random(1, 8) != 1) {
                                    tmp = (tmpRoute.points[j].arrival_time_ts + (random(1, 900) - 300)) * 1000;
                                    gpsTime = filter('date')(tmp, 'dd.MM.yyyy HH:mm:ss');

                                    if (tmpRoute.points[j].haveStop &&
                                        tmpRoute.points[j].stopState != undefined &&
                                        tmpRoute.points[j].stopState.coords &&
                                        (tmpLen = tmpRoute.points[j].stopState.coords.length) > 0) {

                                        tmpLen = tmpLen > 20 ? 20 : tmpLen;
                                        tmpCoord = tmpRoute.points[j].stopState.coords[random(0, tmpLen)];
                                        tmpLat = tmpCoord.lat;
                                        tmpLon = tmpCoord.lon;
                                    } else {
                                        tmpLat = parseFloat(tmpRoute.points[j].LAT) + (random(0, 4) / 10000 - 0.0002);
                                        tmpLon = parseFloat(tmpRoute.points[j].LON) + (random(0, 4) / 10000 - 0.0002);
                                    }

                                    mobilePushes.push({
                                        cancel_reason: "",
                                        canceled: false,
                                        gps_time: gpsTime,
                                        lat: tmpLat,
                                        lon: tmpLon,
                                        number: tmpRoute.points[j].TASK_NUMBER,
                                        time: gpsTime
                                    });
                                }
                            }
                        }
                    }
                } else {
                    // получаем через 1С-ый parentForm имя клиента
                    //console.log("Step3");
                    _data.companyName = parentForm._call('getClientName');
                }
                //console.log( _data.companyName, ' cmpanyName');

                scope.$emit('companyName', _data.companyName);

                // по каждому доступному решению запрашиваем нажатия

                console.log("!!!!!!Find pushes. Where are you?!!!!!!");
                //var newSettings1 = parentForm._call('getConfig()');
                //var newSettings2 = parentForm._call('getConfig');
                //console.log("All Settings", newSettings, newSettings1, newSettings2);

                for (var m = 0; m < _data.idArr.length; m++) {

                    if (scope.demoMode) {
                        m = 2000000000;
                    } else {
                        mobilePushes = parentForm._call('getDriversActions', [_data.idArr[m], getDateStrFor1C(_data.server_time * 1000)]);
                    }

                    console.log("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA mobilePushes recieved", mobilePushes);


                    if (mobilePushes == undefined
                        || Object.keys(mobilePushes).length == 0) {
                        console.log('no mobile buttons push');
                        continue;
                    }

                    var buttonsStr = mobilePushes[Object.keys(mobilePushes)[0]];

                    if (buttonsStr == '[]') {
                        console.log('no mobile buttons push');
                        continue;
                    }

                    if (!scope.demoMode) {
                        buttonsStr = buttonsStr.substr(1, buttonsStr.length - 2);
                        mobilePushes = JSON.parse(buttonsStr);
                    }
                    //console.log('mobilePushes array', {pushes: mobilePushes});

                    if (mobilePushes == undefined) continue;

                    checkPushesTimeGMTZone(mobilePushes);

                    for (var i = 0; i < mobilePushes.length; i++) {
                        if (mobilePushes[i].canceled) continue;

                        //console.log("mobilePushes[i]", mobilePushes[i]);
                        //var mobileString=JSON.stringify(mobilePushes[i]);
                        //console.log("mobileString", mobileString);

                        //if (mobilePushes[i].gps_time_ts == undefined) {
                        //    if (mobilePushes[i].gps_time) {
                        //        mobilePushes[i].gps_time_ts = strToTstamp(mobilePushes[i].gps_time);//+60*60*4 Костыль для IDS у которых не настроены часовые пояса на телефонах водителей.
                        //    } else {
                        //        //mobilePushes[i].gps_time_ts = 0;
                        //    }
                        //}

                        if (mobilePushes[i].gps_time_ts > _data.server_time) continue;

                        for (var j = 0; j < _data.routes.length; j++) {
                            for (var k = 0; k < _data.routes[j].points.length; k++) {
                                tmpPoint = _data.routes[j].points[k];
                                LAT = parseFloat(tmpPoint.LAT);
                                LON = parseFloat(tmpPoint.LON);
                                lat = mobilePushes[i].lat;
                                lon = mobilePushes[i].lon;

                                // каждое нажатие проверяем с каждой точкой в каждом маршруте на совпадение номера задачи
                                if (mobilePushes[i].number == tmpPoint.TASK_NUMBER) {
                                    //console.log("FIND PUSH ", mobilePushes[i], "for Waypoint", tmpPoint );

                                    tmpPoint.mobile_push = mobilePushes[i];
                                    tmpPoint.mobile_arrival_time = mobilePushes[i].gps_time_ts;
                                    mobilePushes[i].distance = getDistanceFromLatLonInM(lat, lon, LAT, LON);
                                    // если нажатие попадает в радиус заданный в настройках, нажатие считается валидным
                                    // Для большей захвата пушей, их радиус увеличен в 2 раза по сравнению с расстоянием до стопа
                                    if (mobilePushes[i].distance <= scope.params.mobileRadius * 2) {
                                        tmpPoint.havePush = true;


                                        //TODO
                                        //Пока нет валидного времени с GPS пушей, закомментируем следующую строку
                                        tmpPoint.real_arrival_time = tmpPoint.real_arrival_time || mobilePushes[i].gps_time_ts;

                                        // если точка уже подтверждена или у неё уже есть связанный стоп - она считается подтвержденной
                                        tmpPoint.confirmed = tmpPoint.confirmed || tmpPoint.haveStop;

                                        _data.routes[j].lastPointIndx = k > _data.routes[j].lastPointIndx ? k : _data.routes[j].lastPointIndx;
                                        _data.routes[j].pushes = _data.routes[j].pushes || [];
                                        if (mobilePushes[i].gps_time_ts < _data.server_time) {
                                            _data.routes[j].pushes.push(mobilePushes[i]);
                                        }
                                        findStatusAndWindowForPoint(tmpPoint);
                                        break;
                                    } else {
                                        _data.routes[j].pushes = _data.routes[j].pushes || [];
                                        if (mobilePushes[i].gps_time_ts < _data.server_time) {
                                            tmpPoint.havePush = true;
                                            mobilePushes[i].long_away = true;
                                            _data.routes[j].pushes.push(mobilePushes[i]);
                                        }
                                        console.log('>>> OUT of mobile radius');
                                    }
                                }
                            }
                        }
                    }

                    allPushes = allPushes.concat(mobilePushes);
                }

            }
            if(scope.filters.route == -1) {
                rootScope.$emit('displayCollectionToStatistic', scope.displayCollection);
            }else{
                for(var i = 0; _data.routes.length > i; i++){
                    if(_data.routes[i].filterId == scope.filters.route){
                        rootScope.$emit('displayCollectionToStatistic', _data.routes[i].points);
                        break;
                    }
                }
            }
        }

        function random(min, max) {
            var x = Math.sin(seed++) * 10000;
            return Math.floor((x - Math.floor(x)) * (max - min) + min);
        }

        // проверить подтвержденние точек в локальном хранилище
        function checkConfirmedFromLocalStorage() {
            if (!localStorage['confirmed'] || localStorage['confirmed'] == '[object Object]') {
                localStorage['confirmed'] = '{}';
                return;
            }

            var confirmedObj = JSON.parse(localStorage['confirmed']),
                point,
                row,
                confirmed;

            for (var i = 0; i < scope.rowCollection.length; i++) {
                confirmed = confirmedObj[scope.rowCollection[i].TASK_NUMBER];
                if (confirmed == undefined) continue;

                row = scope.rowCollection[i];
                row.rawConfirmed = confirmed;
                point = rawData.routes[row.route_id].points[row.NUMBER - 1];
                point.rawConfirmed = row.rawConfirmed;

                if (scope.rowCollection[i].rawConfirmed === 1) {
                    row.confirmed = true;
                } else if (scope.rowCollection[i].rawConfirmed === -1) {
                    if (_data.server_time > row.working_window.finish) {
                        //console.log("row.status = STATUS.TIME_OUT");
                        row.status = STATUS.TIME_OUT;
                    } else {
                        //console.log("row.status = STATUS.DELAY");
                        row.status = STATUS.DELAY;
                    }
                }

                point.checkedStatus = row.status;
            }
        }

        // поределить статус точки и тип окна, в которое она попадает
        function findStatusAndWindowForPoint(tmpPoint) {


            tmpPoint.windowType = WINDOW_TYPE.OUT_WINDOWS;
            if (tmpPoint.promised_window_changed.start < tmpPoint.real_arrival_time
                && tmpPoint.promised_window_changed.finish > tmpPoint.real_arrival_time) {
                tmpPoint.windowType = WINDOW_TYPE.IN_PROMISED;
            } else {
                for (var l = 0; tmpPoint.windows != undefined && l < tmpPoint.windows.length; l++) {
                    if (tmpPoint.windows[l].start < tmpPoint.real_arrival_time
                        && tmpPoint.windows[l].finish > tmpPoint.real_arrival_time) {
                        tmpPoint.windowType = WINDOW_TYPE.IN_ORDERED;
                        break;
                    }
                }
            }

            if (tmpPoint.rawConfirmed !== -1) {
                if (tmpPoint.real_arrival_time > tmpPoint.working_window.finish) {
                    tmpPoint.status = STATUS.FINISHED_LATE;
                } else if (tmpPoint.real_arrival_time < tmpPoint.working_window.start) {
                    tmpPoint.status = STATUS.FINISHED_TOO_EARLY;
                } else {
                    tmpPoint.status = STATUS.FINISHED;
                }
            } else {

            }


            //корректировка достоверности статусов по процентам.
            tmpPoint.limit=0;
            if (tmpPoint.confirmed_by_operator) {
                tmpPoint.limit=100;
                return;
            }
            if (tmpPoint.haveStop) {
                tmpPoint.limit=45;

                if(tmpPoint.stopState.t1 < tmpPoint.promised_window_changed.finish && tmpPoint.stopState.t1 > tmpPoint.promised_window_changed.start){
                    tmpPoint.limit=60;
                }

            }

            if (tmpPoint.havePush) {
                tmpPoint.limit+=15;
                if( tmpPoint.stopState != undefined && tmpPoint.mobile_push.gps_time_ts < tmpPoint.stopState.t2+300 && tmpPoint.mobile_push.gps_time_ts > tmpPoint.stopState.t1 ) {
                    tmpPoint.limit+=15;
                }
            }

            if(tmpPoint.limit>0 && tmpPoint.limit<74  ){
                tmpPoint.status=6;
                tmpPoint.problem_index=1;
                //console.log("tmpPoint.problem_index", tmpPoint.problem_index);
            }


        }

        // получить строковую дату в формате 1С
        function getDateStrFor1C(timestamp) {
            var date = new Date(timestamp);
            return date.getFullYear() +
                ("0" + (date.getMonth() + 1)).slice(-2) +
                ( ("0" + date.getDate())).slice(-2);
        }

        // обновить индекс проблемности
        function updateProblemIndex(route) {
            var point,
                timeThreshold = 3600 * 6,
                timeMin = 0.25,
                timeCoef;

            for (var j = 0; j < route.points.length; j++) {
                point = route.points[j];

                point.problem_index = 0;
               // console.log("point.problem_index", point.problem_index);
                if (point.overdue_time > 0) {
                    if (point.status == STATUS.TIME_OUT) {
                        point.problem_index += (_data.server_time - point.working_window.finish) * scope.params.factMinutes;
                        timeCoef = 1;
                    } else {
                        timeCoef = (timeThreshold - point.arrival_left_prediction) / timeThreshold;
                        timeCoef = timeCoef >= timeMin ? timeCoef : timeMin;
                    }

                    point.problem_index += parseInt(point.overdue_time * scope.params.predictMinutes);
                    point.problem_index += parseInt(point.WEIGHT) * scope.params.weight;
                    point.problem_index += parseInt(point.VOLUME) * scope.params.volume;
                    point.problem_index += parseInt(point.VALUE) * scope.params.value;
                    if(point.change_time) {
                    point.problem_index += parseInt(point.change_time)*scope.params.changeTime;}

                    point.problem_index = parseInt(point.problem_index * timeCoef);
                    point.problem_index = parseInt(point.problem_index / 100);

                }

                if (point.status == 6){
                    point.problem_index = 1;
                   // console.log("point.problem_index", point.problem_index);
                }
            }
        }


        // назначить колонки в таблице доступные для ресайза
        function setColResizable() {
            $("#point-table-tbl").colResizable({
                onResize: function () {
                    resizeHead(pointTable);
                }
            });
        }

        // подписаться на события
        function setListeners() {
            $(window).resize(function () {
                resetHeight();
                if (pointTable == null) {
                    pointTableHolder = $('#point-table');
                }
                resizeHead(pointTable);
            });
            resetHeight();

            if (pointTableHolder == null) {
                pointTableHolder = $('#point-table');
                pointContainer = $('#point-controller-container');
                pointTable = $('#point-table > table');
            }

            // после изменений размера панельки, пересчитывать размеры таблицы и её шапки
            myLayout.on('stateChanged', stateChangedRightTable );

            rootScope.$on('stateChanged', stateChangedRightTable );

            function stateChangedRightTable(e){
                var pointMenuPanel = $('#point-menu-panel');
                pointTableHolder.height(pointContainer.height() - 27 - pointMenuPanel.height());
                pointTableHolder.width(pointContainer.width() - 10);

                if ($('.lm_dragProxy').length == 0) {
                    $('.header-copy').show();
                    updateHeaderClip();
                } else {
                    $('.header-copy').hide();
                }

                //updateFixedHeaderPos();
            }



            // контролировать размер таблицы после изменения фильтров для изменения размеров грипов для ресайза колонок
            scope.$watch(function () {
                return scope.filters.route + scope.filters.promised_15m + scope.filters.problem_index + scope.filters.branch;
            }, function () {
                updateResizeGripHeight();
            });

           /* scope.$on('ngRepeatFinished', function () {
                prepareFixedHeader();
                updateResizeGripHeight();*/
                 $('#point-table-tbl tbody').contextmenu({
                     target: '#context-menu',
                     before: beforeDeliveryRowConextMenu,
                     onItem: deliveryRowConextMenu
                 });
          /*  }); */

            rootScope.$on('settingsChanged', settingsChanged);
            rootScope.$on('updateRawPromised', function (event, data) {
                updateRawPromised(data.point);
            });
            rootScope.$on('saveRoutes', updateRoute);
            rootScope.$on('forceCheckLocks', checkLocks);
            rootScope.$on('unlockAllRoutes', unlockAllRoutes);

            // $('.header .problem-index-col').on('click', function () {
            //     problemSortType++;
            //     problemSortType = problemSortType % 3;
            //     console.log(problemSortType);
            // });
        }

        // обработчик события изменения настроек
        function settingsChanged(event, params) {
            var changed = false;
            if (params.workingWindowType !== scope.params.workingWindowType) {
                console.log('workingWindowType was changed!');
                changed = true;
            }

            if (params.endWindowSize !== scope.params.endWindowSize) {
                console.log('endWindowSize was changed!');
                changed = true;
            }

            if (params.demoTime !== scope.params.demoTime) {
                console.log('demoTime was changed!');
                changed = true;
            }
            if(scope.params.routeListOrderBy !== params.routeListOrderBy){
                changed = true;
                console.log(scope.params.routeListOrderBy);
            }

            if (params.predictMinutes !== scope.params.predictMinutes
                || params.factMinutes !== scope.params.factMinutes
                || params.volume !== scope.params.volume
                || params.weight !== scope.params.weight
                || params.value !== scope.params.value
                || params.stopRadius !== scope.params.stopRadius
                || params.mobileRadius !== scope.params.mobileRadius
                || params.changeTime !== scope.params.changeTime
                || params.timeThreshold !== scope.params.timeThreshold) {
                console.log('problem index parameter was changed!');
                changed = true;
            }

            if (changed) {
                scope.$emit('clearMap');
                scope.params = JSON.parse(JSON.stringify(params));
                linkDataParts(rawData);
            }
        }

        // rootScope.$on('loadOldDay', function(event, params){
        //     if (params.showDate !== -1 && params.showDate !== scope.params.showDate) {
        //         scope.$emit('clearMap');
        //         console.log('OMG!!1 New show date!');
        //         loadDailyData(true, params.showDate);
        //         return;
        //     }
        // });

        // добавить в подтвержденные
        function addToConfirmed(id, code) {
            if (id == '') return;

            if (localStorage['confirmed'] == undefined) {
                localStorage['confirmed'] = '{}';
            }

            var obj = JSON.parse(localStorage['confirmed']);
            obj[id] = code;
            localStorage['confirmed'] = JSON.stringify(obj);
            console.log(obj);
        }

        // контестнео меню у строки в таблице
        function beforeDeliveryRowConextMenu(e, context) {
            console.log(e);
            var target = e.target;
            while (target.tagName != 'TR') {
                target = target.parentNode;                
            }
            var id = target.id.slice(6);
            for(var i = 0; scope.displayCollection[i].row_id != id; i++){}
            scope.rClickRow = scope.displayCollection[i];
            return true; 
        }
        function deliveryRowConextMenu(context, e) {
        
            var option = $(e.target).data("menuOption");
            var contextJ = $(context)[0],
                row = scope.rClickRow,
                point = rawData.routes[row.route_id].points[row.NUMBER - 1];

            switch (option) {
                case 'sort':    // сортировка по маршруту
                    sortByRoute(row.route_indx);
                    return;
                case 'edit':    // отправить маршрут на редактирование
                    sortByRoute(row.route_indx, true);
                    _data.routes[row.route_id].points[0].itineraryID = _data.ID;

                    scope.$emit('routeToChange', {
                        route: _data.routes[row.route_id],
                        serverTime: _data.server_time,
                        demoMode: scope.demoMode,
                        workingWindow: scope.params.workingWindowType,
                        allDrivers: _data.drivers,
                        allTransports: _data.transports

                    });
                    break;
                default:
                    changeStatus(row, point, option);
            }

            // TODO: подсветить строку под меню
        }

        // обработчик изменения статуса
        rootScope.$on('changeConfirmation', onChangeStatus);
        function onChangeStatus(event, data) {
            var rawPoint = rawData.routes[data.row.route_id].points[data.row.NUMBER - 1];
            rawPoint.changeConfirmation=true;


            changeStatus(data.row, rawPoint, data.option);
            factTimeForRoute(_data.routes[data.row.route_id], true);
            // и изменение цвета маркера

        }

        // изменение статуса
        function changeStatus(row, rawPoint, option) {
            var needChanges = !(row.confirmed && (row.status == STATUS.FINISHED
            || row.status == STATUS.FINISHED_LATE || row.status == STATUS.FINISHED_TOO_EARLY));

            switch (option) {
                case 'confirm-status': // подтверждение сомнительного статуса
                    if (!needChanges) return;
                        //Если у точки уже есть статус Доставлено рано или доставлено поздно, оставляем его.
                        if(row.status>2){
                    row.status = STATUS.FINISHED;}
                    row.confirmed_by_operator=true;
                    row.limit=100;
                    row.confirmed = true;
                    row.problem_index=0;
                    if (row.real_arrival_time == undefined) row.real_arrival_time=rootScope.nowTime;
                    rawPoint.rawConfirmed = 1;
                    //после подтверждения обнуляем индех проблемности и опоздывание.
                    row.problem_index=0;
                    console.log("row.problem_index", row.problem_index);
                    rootScope.$emit('checkInCloseDay');
                    rootScope.$emit('makeWaypointGreen', row.NUMBER);
                    //addToConfirmed(row.TASK_NUMBER, rawPoint.rawConfirmed);
                    break;
                case 'not-delivered-status': // отмена сомнительного статуса
                    if (!needChanges) return;

                    if (_data.server_time > row.working_window.finish) {
                        row.status = STATUS.TIME_OUT;
                        //console.log("row.status = STATUS.TIME_OUT");
                    } else {
                        row.status = STATUS.DELAY;
                        //console.log("row.status = STATUS.DELAY");
                    }
                    rawPoint.rawConfirmed = -1;
                 //   addToConfirmed(row.TASK_NUMBER, rawPoint.rawConfirmed);
                    break;
                case 'return-scheduled':
                    rootScope.$emit('unbindPointStop', row);
                    rootScope.$emit('checkInCloseDay');
                   // rootScope.$emit('makeWaypointBlue', row.NUMBER);
                    break;
                case 'cancel-point': // отмена точки
                    console.log(row);
                    row.status = STATUS.CANCELED;
                    row.confirmed = true;
                    rawPoint.rawConfirmed = 1;
                    row.confirmed_by_operator=true;
                    row.limit=100;
                    //row.reason = row.point.reason;
                    rootScope.$emit('makeWaypointGrey', row.NUMBER );
                    rootScope.$emit('checkInCloseDay');  // проверка для контроллера закрытия дня на предмет появления новых маршрутов, которые можно закрыть
                    break;
            }
            rawPoint.checkedStatus = row.status;
            scope.$emit('newTextStatus', scope.getTextStatus(row));
        }

        // сортировать по точке
        function sortByRoute(indx, force) {
            if (force) {
                scope.filters.route = indx;
            } else {
                if (scope.filters.route == indx) {
                    scope.filters.route = -1;
                } else {
                    scope.filters.route = indx;
                }
            }

            scope.$apply();
        }

        // обновить размер грипов для ресайза
        function updateResizeGripHeight() {
            timeout(function () {
                var height = pointTable.height();
                $('div.JCLRgrip').height(height);
                $('div.jcolresizer').height(height);
            }, 1);
        }

        // подготовить заголовки таблицы для их фиксации при скролле
        function prepareFixedHeader() {
            var header = $('.header'),
                table = $('#point-table > table'),
                //headerCopy = header.clone().removeClass('header').addClass('header-copy').insertAfter(header);
                protoStatusTH = header.find('.status-col'),
                protoProblemIndexTH = header.find('.problem-index-col'),
                timeLeftTH = header.find('.prediction-arrival-left-col');

            // headerCopy.find('.status-col').on('click', function () {
            //     protoStatusTH.trigger('click');
            // });
            //
            // headerCopy.find('.problem-index-col').on('click', function () {
            //     protoProblemIndexTH.trigger('click');
            // });
            //
            // headerCopy.find('.prediction-arrival-left-col').on('click', function () {
            //     timeLeftTH.trigger('click');
            // });

            resizeHead(table);
            updateHeaderClip();
            //updateFixedHeaderPos();
        }
        pointTableHolder.on("scroll", updateHeaderClip);

        // обновить область отрисовки заголовка таблицы
        var lastScrollLeft = 0;
        function updateHeaderClip(e) {
            var pointTableHolderScrollLeft = pointTableHolder.scrollLeft();
            if(e && lastScrollLeft === pointTableHolderScrollLeft){
                return;
            }
            lastScrollLeft = pointTableHolderScrollLeft;
            var width = pointContainer.width() - 24;
            pointTableHolder.find('.header-copy').css({
                    'left': - pointTableHolderScrollLeft,
                   clip: 'rect(0, ' + (width + pointTableHolderScrollLeft) + 'px, auto, ' + pointTableHolderScrollLeft + 'px)'
                });
        }

        // изменить размер заголовка таблицы
        function resizeHead($table) {

            $table.find('.header  th').each(function (i, h) {
                $table.find('.header-copy  th:eq(' + i + ')').css({
                    'max-width': $(h).outerWidth(),
                    width: $(h).outerWidth()
                });
            });
            //console.log($table.outerWidth());
           // $table.find('.header-copy').css('width', $table.outerWidth());
        }

        // обновить позицию фиксированного заголовка таблицы
        function updateFixedHeaderPos() {
            $('.header-copy').offset(pointTableHolder.position());
        }

        // обновить высоту таблицы
        function resetHeight() {
            var tableHeight = $(window).height() - $("#menu-holder").height()
                - $("#tab-selector").height() - 22;
            $('#point-table').height(tableHeight);
        }

        // обработчик клика на строке таблицы


        scope.rowClick = function ($event) {

            var target = $event.target;
            while (target.tagName != 'TR') {
                target = target.parentNode;                
            }
            var id = target.id.slice(6);
            for(var i = 0; scope.displayCollection[i].row_id != id; i++){}

            var row = scope.displayCollection[i];

            if($event.type == "click"){
                rootScope.carCentre=false;
                // rootScope.clickOff=true;
                if(scope.filters.route == -1){
                    scope.drawRoute(row.route_id, false); // false - отмена сортровки
                }
                rootScope.$emit('findStopOnMarker', row.LAT, row.LON);
                if(row.haveStop){
                    rootScope.$emit('eventdrawConnectsActivePoint', row.stopState, row.NUMBER, row.TASK_NUMBER);
                }else{
                    rootScope.$emit('eventdrawConnectsActivePoint');
                }

                for(var i = 0; scope.displayCollection.length > i; i++){
                    scope.displayCollection[i].selected = false;
                }
                row.selected = true;


            }else if($event.type == 'dblclick'){
                row.textStatus = scope.getTextStatus(row);
                row.textWindow = scope.getTextWindow(row.windowType, row.row_id);
                row.itineraryID = _data.ID;
                scope.$emit('showPoint', {point: row, route: _data.routes[row.route_indx]});
            }


            //console.log(row);
            // найти какому роуту принадлежит точка
            // var i=0;
            // var curRoute={};
            // while (i<_data.routes.length){
            //     if (_data.routes[i].uniqueID==row.uniqueID){
            //         curRoute=_data.routes[i];
            //         break;
            //     }
            //
            //     i++;
            // }
            //console.log("I have to draw this route:", curRoute);
        };

        rootScope.$on('clickOnMarkerWayPiont', function(e, point){
            for(var i = 0; scope.displayCollection.length > i; i++){
                scope.displayCollection[i].selected = false;
            }
            point.selected = true;
        });

        // обработчик даблклика на строке таблицы

        scope.dblRowClick = function ($event) {
            var target = $event.target;
            while (target.tagName != 'TR') {
                target = target.parentNode;
            }
            var id = target.id.slice(6);
            for(var i = 0; scope.displayCollection[i].row_id != id; i++){}

            var row = scope.displayCollection[i];

            row.textStatus = scope.getTextStatus(row);
            row.textWindow = scope.getTextWindow(row.windowType, row.row_id);
            row.itineraryID = _data.ID;
            scope.$emit('showPoint', {point: row, route: _data.routes[row.route_indx]});
        };


        // получить текстовый статус для задачи с необходимыми css классами

        scope.getTextStatus = function (row) {
            row.class2 = row.status == 5 ? 'delay-status2' : '';
            var statusCode = row.status;
            var confirmed = row.confirmed;
            for (var i = 0; i < scope.filters.statuses.length; i++) {
                if (scope.filters.statuses[i].value == statusCode) {
                    row.class = '';
                       // var unconfirmed = !confirmed && (statusCode == STATUS.FINISHED ||
                       //      statusCode == STATUS.FINISHED_LATE || statusCode == STATUS.FINISHED_TOO_EARLY);
                       //  if (unconfirmed) {
                       //      row.class = "yellow-status ";
                       //  }
                        row.class += scope.filters.statuses[i].class;
                    // if (scope.filters.statuses[i].table_name != undefined) {
                    //     return scope.filters.statuses[i].table_name;// + (unconfirmed ? '?' : ''); убираем вопросительный знак
                    // }
                    return scope.filters.statuses[i].name;// + (unconfirmed ? '?' : ''); убираем вопросительный знак
                }
            }

            console.log(statusCode);
            //checkStatusForCheckBox();
            return 'неизвестный статус';
        };
        var checkBoxDrivers = [];
        function checkStatusForCheckBox(row_id, driverName, statusCode){

            if (statusCode == 3 || 4 || 5 ){
                checkBoxDrivers.push({row_id: driverName})
            }


            /*for(var i=0; i<checkBoxDrivers.length; i++){
                if(driverName!=checkBoxDrivers[i]){
                    checkBoxDrivers.push(driverName);
                }
            }
            function forSome(item, index, arr){
                return item == driverName;
            };
            if(checkBoxDrivers.some(forSome)==false){
                checkBoxDrivers.push(driverName);
            }*/
           console.log(checkBoxDrivers,  'pusk');
        };
        //console.log($('.close-table-driver').val(), "ppppppppp");

        // получить текстовое представление окна по его коду
        scope.getTextWindow = function (windowCode, row_id) {
            for (var i = 0; i < scope.filters.window_types.length; i++) {
                if (scope.filters.window_types[i].value == windowCode) {
                    var object = $('#window-td-' + row_id);
                    object.removeClass();
                    object.addClass(scope.filters.window_types[i].class);
                    if (scope.filters.window_types[i].table_name != undefined) {
                        return scope.filters.window_types[i].table_name;
                    }

                    return scope.filters.window_types[i].name;
                }
            }

            return '';
        };

        // фильтр по статусу
        function statusFilter(row) {
            if(scope.filters.status['-1']){
                return true;
            }else{
                for(var status in scope.filters.status){
                    if(scope.filters.status[status] && status == row.status){
                        return true;
                    }
                }
            }
            return false;
            //return (scope.filters.status == -1 || row.status == scope.filters.status);
        }

        // фильтр по маршруту
        function routeFilter(row) {
            return (scope.filters.route === -1 || row.route_id == scope.filters.route);
        }

        scope.filtersOllstatuses = function(){
            if(scope.filters.status['-1']){
                for(var status in  scope.filters.status){
                    scope.filters.status[status] = true;
                }
            }else{
                for(var status in  scope.filters.status){
                    scope.filters.status[status] = false;
                }
            }
        };

        scope.filterOnestatus = function(){
            updateResizeGripHeight();
            for(var status in  scope.filters.status){
                if( !scope.filters.status[status]){
                    scope.filters.status['-1'] = false;
                    break;
                }
            }
        };

        // фильтр по проблемности
        function problemFilter(row) {
            return (scope.filters.problem_index == -1 || row.problem_index > 0);
        }


        // фильтр на попадание не выполненных точек в указанный в настройках диапазон в конце рабочего окна
        function promise15MFilter(row) {
            return (scope.filters.promised_15m == -1 || row.promised_15m);
        }

        // отрисовать плановый маршрут
        scope.drawPlannedRoute = function () {
            if (scope.selectedRow != -1) {
                scope.$emit('drawPlannedTrack',
                    _data.routes[scope.displayCollection[scope.selectedRow].route_id]);
            } else if (scope.filters.route != -1) {
                scope.$emit('drawPlannedTrack', _data.routes[scope.filters.route]);
            }
        };

        // отрисовать маршрут
        scope.drawRoute = function (filterId, order) {
            scope.$emit('clearMap');
            console.log("Start Function");
            console.time("step1");
            loadExistData();

            //concatDailyAndExistingData();
            rootScope.clickOff=true;
            var route;
            for(var i = 0; _data.routes.length > i; i++){
                if(_data.routes[i].filterId == filterId){
                    route = _data.routes[i];
                    break;
                }
            }

            factTimeForRoute(route);

            // Два раза сортируем, чтобы в итоге были по возрастанию фактического посещения сделаны.
            // Первая сортировка просто сортирует, вторая по возрастанию.
            if(order == undefined){
                scope.order('fact_number');
                scope.order('fact_number');
            }





            console.log("P-I-C recieve click", rootScope.clickOff, "and gona draw", route);



           //Проверка и подготовка роута. Удаление дублирующих Current position
           // CheckAndPrepareRoute (route);
            //scope.$apply();




            var draw = function (route) {
                    switch (scope.draw_mode) {
                        case scope.draw_modes[0].value: // комбинированный
                            scope.$emit('drawCombinedTrack', route);
                            console.log("Send route to map");
                            unlockAllRoutes(null, _data);
                            break;
                        case scope.draw_modes[1].value: // фактический
                            scope.$emit('drawRealTrack', route);
                            break;
                        case scope.draw_modes[2].value: // плановый
                            scope.$emit('drawPlannedTrack', route);
                            break;
                        case scope.draw_modes[3].value: // плановый + фактический
                            scope.$emit('drawRealAndPlannedTrack', route);
                            break;
                    }
                };

            // if (scope.filters.route != -1) {
            //     indx = scope.filters.route;
            // } else if (scope.selectedRow != -1) {
            //     indx = scope.displayCollection[scope.selectedRow].route_id;
            // } else {
            //     return;
            // }
            //
            // route = _data.routes[indx];

            if (scope.draw_mode == scope.draw_modes[2].value) {
                scope.$emit('drawPlannedTrack', route);
                return;
            }

            //todo пока в виде эксперимента перенесем под сакцесс вниз
            //if (route.real_track == undefined) {
            //    draw(route);
            //    return;
            //}

            //if (full == undefined) full=true; //По умолчанию отрисовываем полный трек с обновлением
            // если время последнего обновления не известно или с момента последнего обновления
            // трека прошло updateTrackInterval секунд - догружаем новые данные
            // todo временно отправляем всегда
            if (  route.uniqueID != rootScope.editing.uniqueID || route.real_track[0].lastTrackUpdate == undefined ||
                route.real_track[0].lastTrackUpdate + updateTrackInterval < Date.now() / 1000 ) {
                //console.log('I need download Updated tracks' );
                //console.log('before', route.real_track.length);


                //console.log("route.real_track", route.real_track);




                    http.post('./gettracksbystates', {
                    states: route.real_track,
                    gid: route.transport.gid,
                    id: route.uniqueID,
                    demoTime: scope.demoMode ? _data.server_time : -1
                }).success(function (data) {
                        //var rRtrack = JSON.parse(JSON.stringify(route.real_track));
                        //console.log("Existing before Additional load for Route", rRtrack);
                        //var newData = JSON.parse(JSON.stringify(data));
                        //console.log("Additional load for Route", newData);


                        //Маршрут заблокирован и редактируется другим пользователем
                        if (data.result == 'blocked'){
                            alert("Маршрут заблокирован оператором " + data.user);
                            scope.filters.route = -1;
                            rootScope.clickOff=false;
                            return;
                        }



                        alert("Маршрут свободен для редактирования");
                        //rootScope.editing.route = route.uniqueID;
                        var start = Date.now()/1000;
                        rootScope.editing.start = start;
                        rootScope.routeId = route.uniqueID;


                        console.log("Editing", rootScope.editing);

                        route.real_track = data;


                        for (var k = 0; k < route.real_track.length; k++) {
                            if (route.real_track[k].coords == undefined ||
                                route.real_track[k].coords.length == 0) {
                                route.real_track.splice(k, 1);
                                k--;
                            }
                        }

                        if (scope.demoMode) {
                            route.real_track[0].lastTrackUpdate = 2000000000;
                            //route.car_position = route.real_track[route.real_track.length - 2];
                        } else {
                            if(route.real_track != undefined && route.real_track[0]){
                            route.real_track[0].lastTrackUpdate = parseInt(Date.now() / 1000);}
                        }

                        //console.log('after', route.real_track.length);
                        scope.$emit('clearMap');
                        draw(route);
                    }).error(function(err){
                        console.log(err);
                        alert("Маршрут свободен для редактирования");
                        rootScope.errorNotification(' к агрегатору /gettracksbystates. Нет актуального трека');
                        if (route.real_track == undefined) {
                            scope.filters.route = route.filterId;
                            draw(route);
                            return;
                        }
                        rootScope.clickOff=false;
                        return;
                    });

                //console.log("Troubles here");
            } else {
                console.log('load tracks from cache', scope.draw_modes);
                scope.draw_mode=0;
                //scope.draw_modes[0]=scope.draw_modes[0].value;
                draw(route);
            }
        };

        //вкл/выкл фильтр только проблемных точек
        scope.toggleProblemPoints = function () {
            //console.log("Нажимаем на кнопку!!!!")
   
            if (scope.filters.problem_index == -1) {
                scope.filters.problem_index = 1;
                // timeout(function () {
                //     setProblemIndexSortMode(2);
                // }, 100);
            } else {
                scope.filters.problem_index = -1;
                // timeout(function () {
                //     setProblemIndexSortMode(0);
                // }, 100);
            }


        };



        //задать порядок сортировки по индексу проблемности
        // function setProblemIndexSortMode(mode) {
        //     timeout(function () {
        //         if (mode != problemSortType) {
        //             $('.header .problem-index-col').trigger('click');
        //             setProblemIndexSortMode(mode);
        //         }
        //     }, 10);
        // }

        // вкл/выкл фильтр на попадание не выполненных точек в указанный в настройках диапазон в конце рабочего окна
        scope.togglePromised15MPoints = function () {
            $('#promised-15m-btn').toggleClass('btn-default').toggleClass('btn-success');
            if (scope.filters.promised_15m == -1) {
                scope.filters.promised_15m = 1;
            } else {
                scope.filters.promised_15m = -1;
            }
        };

        // перемещение элемента внутри массива
        // Array.prototype.move = function (old_index, new_index) {
        //     if (new_index >= this.length) {
        //         var k = new_index - this.length;
        //         while ((k--) + 1) {
        //             this.push(undefined);
        //         }
        //     }
        //     this.splice(new_index, 0, this.splice(old_index, 1)[0]);
        //     return this;
        // };

        // изменить обещанное окно
        scope.changePromisedWindow = function (row_id) {
            var start = $('#edit-promised-start-' + row_id).val().split(':'),
                finish = $('#edit-promised-finish-' + row_id).val().split(':'),
                point = scope.displayCollection[row_id],
                oldStart = new Date(point.promised_window_changed.start * 1000),
                clearOldDate = new Date(oldStart.getFullYear(), oldStart.getMonth(), oldStart.getDate()).getTime();

            point.promised_window_changed = {
                start: clearOldDate / 1000 + start[0] * 3600 + start[1] * 60,
                finish: clearOldDate / 1000 + finish[0] * 3600 + finish[1] * 60
            };

            updateRawPromised(point);
            console.log("scope.changePromisedWindow updateData");
            updateData();
        };

        // изменить обещанное окно в сырых данных
        function updateRawPromised(point) {
            console.log("Start change Promised Window");
            var rawPoints = _data.routes[point.route_id].points;
            for (var i = 0; i < rawPoints.length; i++) {
                if (rawPoints[i].TASK_NUMBER == point.TASK_NUMBER) {
                    console.log("Find point to change", rawPoints[i]);
                    rawPoints[i].promised_window = JSON.parse(JSON.stringify(point.promised_window));
                    rawPoints[i].promised_window_changed = JSON.parse(JSON.stringify(point.promised_window_changed));
                    (rawPoints[i].change_time==undefined || rawPoints[i].change_time==null ||rawPoints[i].change_time==0) ? rawPoints[i].change_time=1 : rawPoints[i].change_time+=1;
                    break;
                }
            }
        }

        // показать попап
        function showPopup(text, duration) {
            scope.$emit('showNotification', {text: text, duration: duration});
        }


        // сохранить маршрут
        function saveRoutes() {
            var routes = [],
                route,
                point,
                whStart,
                len;
            for (var i = 0; i < _data.routes.length; i++) {
                // все маршруты, которые помечены на сохранение, переупаковать на отправку
                if (!_data.routes[i].toSave) continue;

                len = _data.routes[i].points.length;
                route = {
                    itineraryID: _data.routes[i].itineraryID,
                    routesID: _data.routes[i].ID,
                    transportID: _data.routes[i].transport.ID,
                    routeNumber: _data.routes[i].NUMBER,
                    change_timestamp: _data.routes[i].change_timestamp,
                    driver: _data.routes[i].DRIVER,
                    startTime: _data.routes[i].START_TIME,
                    endTime: _data.routes[i].END_TIME,
                    time: _data.routes[i].TIME,
                    value: _data.routes[i].VALUE,
                    distance: _data.routes[i].DISTANCE,
                    numberOfTasks: _data.routes[i].NUMBER_OF_TASKS,
                    points: []
                };

                for (var j = 0; j < len; j++) {
                    point = _data.routes[i].points[j];
                    route.points.push({
                        taskNumber: point.TASK_NUMBER,
                        stepNumber: point.NUMBER,
                        arrivalTime: point.arrival_time_ts,
                        startWaypointId: point.origStartWp ? point.origStartWp : point.START_WAYPOINT,
                        endWaypointId: point.END_WAYPOINT,
                        startLatLon: {
                            lat: point.START_LAT,
                            lon: point.START_LON
                        },
                        endLatLon: {
                            lat: point.END_LAT,
                            lon: point.END_LON
                        },
                        taskTime: point.ARRIVAL_TIME,
                        downtime: point.DOWNTIME,
                        travelTime: point.TRAVEL_TIME,
                        distance: point.DISTANCE,
                        startTime: point.START_TIME,
                        endTime: point.END_TIME,
                        taskDate: point.TASK_DATE,
                        weight: point.WEIGHT,
                        volume: point.VOLUME
                    });
                }

                routes.push(route);
            }

            if (routes.length == 0) return;

            console.log('sending routes to save', routes);

            // отправляем переупакованные данныена пересчет
            http.post('./saveroute/', {routes: routes})
                .success(function (data) {
                    console.log('Save to 1C result >>', data);
                    for (var i = 0; i < _data.routes.length; i++) {
                        delete _data.routes[i].toSave;
                    }
                }).error(function(err){
                        console.log(err);
                        rootScope.errorNotification('/saveroute');
                  });

        }

        function updateWaypoint(waypoint, confirm) {

            console.log('sending waypoint to save', waypoint, confirm);
            http.post('./savewaypoint/', {waypoint: waypoint, confirm:confirm}).
                success(function (data) {
                    console.log('Save to 1C result >>', data);
                })
            .error(function(data){
                rootScope.errorNotification('/savewaypoint');
                console.log('ERROR to Save to 1C result >>', data);

            });
        }

        //function saveUpdate(points) {
        //
        //    console.log('sending update to save', points);
        //    http.post('./saveupdate/', {waypoints: points}).
        //        success(function (data) {
        //            console.log('Save to 1C result >>', data);
        //        })
        //        .error(function(data){
        //            console.log('ERROR to Save to 1C result >>', data);
        //        });
        //}

        // назначить текстовый фильтр
        scope.setTextFilter = function () {
            scope.filters.text = $("#search-input").val();
            updateResizeGripHeight();
        };

        // очистить текстовый фильтр
        scope.cancelTextFilter = function () {
            $("#search-input").val('');
            scope.filters.text = '';
            updateResizeGripHeight();
        };

        // текстовый фильтр
        function textFilter(row) {
            if (scope.filters.text === "") return true;
            if (row.waypoint == undefined) return false;
            var filterLowCase = scope.filters.text.toLowerCase();

            return row.waypoint.NAME.toLowerCase().indexOf(filterLowCase) >= 0
                || row.driver.NAME.toLowerCase().indexOf(filterLowCase) >= 0
                || row.waypoint.ADDRESS.toLowerCase().indexOf(filterLowCase) >= 0
                || row.waypoint.COMMENT.toLowerCase().indexOf(filterLowCase) >= 0
                || row.NUMBER.toLowerCase().indexOf(filterLowCase) >= 0
                || row.transport.NAME.toLowerCase().indexOf(filterLowCase) >= 0
                || row.driver.PHONE.toLowerCase().indexOf(filterLowCase) >= 0
                || row.transport.REGISTRATION_NUMBER.toLowerCase().indexOf(filterLowCase) >= 0;
        }

        // фильтр по филлиалам
        function branchFilter(row) {
            return (scope.filters.branch == -1 || row.branchIndx == scope.filters.branch);
        }
        scope.applyFilterCount = 0;
        // применить все фильтры
        scope.applyFilter = function (row) {
            return routeFilter(row)
                && statusFilter(row)
                && problemFilter(row)
                && promise15MFilter(row)
                && textFilter(row)
                && branchFilter(row);
        };



        var orderBy = filter('orderBy');
        scope.order = function(predicate){
            scope.myFilter = true;
            scope.predicate = predicate;
            scope.reverse = (scope.predicate === predicate) ? !scope.reverse : false;
            scope.displayCollection = orderBy(scope.displayCollection, predicate, scope.reverse);

        };

        scope.myFilter = '-problem_index';




        // обновить маршрут
        function updateRoute(event, data) {
            console.log('updateRoute at point-index-controller', data.route);

            var updatedRoute = rawData.routes[data.route.filterId],
                route = data.route;

            // разблокировать маршрут
            scope.$emit('unlockRoute', {
                route: _data.routes[data.route.filterId],
                point: _data.routes[data.route.filterId].points[0]
            });

            for (var i = 0; i < route.points.length; i++) {
                for (var j = 0; j < updatedRoute.points.length; j++) {
                    if (updatedRoute.points[j].NUMBER === route.points[i].NUMBER) {
                        updatedRoute.points.splice(j, 1);
                        break;
                    }
                }
            }

            for (var i = 0; i < route.points.length; i++) {
                updatedRoute.points.push(route.points[i]);
            }

            for (var i = 0; i < updatedRoute.points.length; i++) {
                updatedRoute.points[i].NUMBER = i + 1;
            }

            updatedRoute.toSave = true;
            updatedRoute.change_timestamp = data.timestamp;

            linkDataParts(rawData);

        }

        // получить статус нажатия
        scope.getPushStatus = function (row) {
            if (row.havePush) {
                return row.mobile_push.time;
                //return 'Есть';
            } else if (row.mobile_push) {
                $('#push-td-' + row.row_id).addClass('invalid-push');
                return row.mobile_push.time;
                //return 'Есть';
            } else {
                return '';
            }
        };

        // разблокировать все маршруты
        function unlockAllRoutes(event, data) {
            var route;
            console.log('unlockAllRoutes()', data.filterId);

            for (var i = 0; i < _data.routes.length; i++) {
                route = _data.routes[i];
                if (data.filterId == route.filterId || !route.lockedByMe) continue;

                delete route.lockedByMe;
                delete route.locked;
                for (var j = 0; j < route.points.length; j++) {
                    if (!route.points[j].TASK_NUMBER) continue;

                    delete route.points[j].locked;
                    delete route.points[j].lockedByMe;
                    delete route.points[j].lockedRoute;
                }
            }
        }
        function collectDataForDayClosing(data, currentDay){

            var result = {
                    routes: []
                },
                routeI,
                pointJ,
                route,
                point,
                startTime,
                endTime;
            var routesID = [];

            for (var i = 0; i < data.routes.length; i++) {
                if(data.routes[i].getCheck != true){
                    continue;
                }
                routeI = data.routes[i];
                routesID.push(routeI.uniqueID);
                route = {
                    pointsReady: [],
                    pointsNotReady: [],
                    driver: routeI.DRIVER,
                    transport: routeI.TRANSPORT,
                    itenereryID: routeI.itineraryID,
                    number: routeI.NUMBER,
                    startTimePlan: strToTstamp(routeI.START_TIME),
                    endTimePlan: strToTstamp(routeI.END_TIME),
                    totalPoints: routeI.points.length,
                    inOrderedLen: 0,
                    inPromised: 0,
                    inPlan: 0
                };

                endTime = 0;
                startTime = 2000000000;
                for (var j = 0; j < routeI.points.length; j++) {
                    pointJ = routeI.points[j];
                    var taskDay = pointJ.TASK_DATE.split(".");

                    point = {
                        waypoint: pointJ.END_WAYPOINT,
                        taskNumber: pointJ.TASK_NUMBER,
                        taskDay: parseInt(new Date(taskDay[1]+"/"+taskDay[0]+"/"+taskDay[2]).getTime() /1000) + 60*60*3,
                        plannedNumber: pointJ.NUMBER,
                        weight: pointJ.WEIGHT,
                        volume: pointJ.VOLUME,
                        value: pointJ.VALUE,
                        windowType: pointJ.windowType,
                        inPlan: true,
                        stopState: pointJ.stopState,
                        moveState: pointJ.moveState
                    };
                    if(point.stopState && point.stopState.coords){
                        delete point.stopState.coords;
                    }

                    if (pointJ.real_arrival_time && pointJ.real_arrival_time > endTime) endTime = pointJ.real_arrival_time;
                    if (pointJ.real_arrival_time && pointJ.real_arrival_time < startTime) startTime = pointJ.real_arrival_time;

                    point.status = {
                        promised: false,
                        ordered: false
                    };

                    if (point.windowType === WINDOW_TYPE.IN_PROMISED) {
                        point.status.promised = true;
                        point.status.ordered = true;
                    } else if (point.windowType === WINDOW_TYPE.IN_ORDERED) {
                        point.status.ordered = true;
                    }

                    if (point.status.ordered) route.inOrderedLen++;
                    if (point.status.promised) route.inPromised++;
                    if (point.inPlan) route.inPlan++;
                    //console.log(pointJ);

                    if(pointJ.status == 8){
                        point.reasonDisp = pointJ.reason;
                        point.reasonDriver = '';
                        route.pointsNotReady.push(point);
                    } else {
                        route.pointsReady.push(point);
                    }
                }

                route.startTimeFact = startTime === 2000000000 ? undefined : startTime;
                route.endTimeFact = endTime === 0 ? undefined : endTime;
                if(!route.startTimeFact){
                    route.startTimeFact = Date.now();
                }
                if(!route.endTimeFact){
                    route.endTimeFact = Date.now();
                }
                //TODO REMOVE only for test
               // route.pointsReady = route.pointsReady.concat(route.pointsUnconfirmed);
                ///////////////////////////

                for (var k = 0; k < route.pointsReady.length; k++) {
                    point = route.pointsReady[k];
                    if (point.stopState) {
                        point.durationFact = point.stopState.t2 - point.stopState.t1;
                        point.arrivalTimeFact = point.stopState.t1;
                    }else{
                        point.arrivalTimeFact = '09.05.2016';
                        point.durationFact = 0;
                    }

                    if (point.moveState) {
                        point.moveDuration = point.moveState.t2 - point.moveState.t1;
                        point.moveDistance = point.moveState.dist;
                    }else{
                        point.moveDistance = 0;
                        point.moveDuration = 0;
                    }
                }


                    result.routes.push(route);
            }


            var xml = '<?xml version="1.0" encoding="UTF-8"?><MESSAGE xmlns="http://sngtrans.com.ua"><CLOSEDAY CLOSEDATA="'+data.routesOfDate+'"><TEXTDATA>'+ JSON.stringify(result) +'</TEXTDATA></CLOSEDAY></MESSAGE>';
            
            if( currentDay ){ // проверка сегодняшней даты закрытия дня
                console.log("UPDATE DAY");
                //console.log("XML == ", xml);
                return {closeDayData: xml, routesID: routesID, update:true, closeDayDate: data.routesOfDate}; // обновляем текущий день
            }else{
                return {closeDayData: xml, routesID: routesID, update:false, closeDayDate: data.routesOfDate}; // дописываем старый день
            }
        }

        rootScope.$on('pushWaypointTo1С', function(event, data, confirm){ // инициализация отправки данных точки на сервер 1с
            console.log(data, ' sended data', confirm);
            updateWaypoint(data, confirm)

        });
        //console.log(scope.filters.route, ' filters route');
        rootScope.$on('pushCloseDayDataToServer', function(event, data){ // инициализация отправки данных на сервер для закрытия дня
            pushDataToServer(collectDataForDayClosing(data.data, data.currentDay));
        });

        function pushDataToServer(outgoingData){   // функция отправки данных на сервер, может быть универсальной
            http.post('./closeday', outgoingData).then(successCallback, errorCallback); //отправка на url /closeday временно
            function successCallback(res){
                if(!res.data.error){
                    rootScope.$emit('successOfPusingData');
                    rootScope.$emit('showNotification', {text: 'Закрыто '+res.data.closeCount+' роутов за '+res.data.CloseDate, duration:2000});

                    if(!outgoingData.update){
                        for(var i = 0; _data.routes.length > i; i++){
                            for(var j = 0; outgoingData.routesID.length > j; j++){
                                if(_data.routes[i]['uniqueID'] == outgoingData.routesID[j]){
                                    _data.routes.splice(i, 1);
                                    i--;
                                }
                            }
                        }
                        if(_data.routes.length == 0){
                            delete scope.displayCollection;
                        }else{
                            for(i = 0; outgoingData.routesID.length > i; i++){
                                for(j = 0; scope.displayCollection > j; j++ ){
                                    if(outgoingData.routesID[i] == scope.displayCollection[j]['uniqueID']){
                                        scope.displayCollection.splice(j, 1);
                                        j--;
                                    }
                                }
                            }
                        }

                        rootScope.$emit('successCloseOldRoutes');
                    }else{
                        for(var i = 0; _data.routes.length > i; i++){
                            for(var j = 0; outgoingData.routesID.length > j; j++){
                                if(_data.routes[i]['uniqueID'] == outgoingData.routesID[j]){

                                    _data.routes[i].closeRoute  = true;
                                }
                            }
                        }

                    }
                }else{

                    rootScope.$emit('showNotification', {text: 'Произошла ошибка при закрытии дня', duration:3000});
                }
            }

            function errorCallback(err){
                console.log(err);
                rootScope.errorNotification('/closeday');
                rootScope.$emit('serverError');
            }

        }

        function findBestStop(point, stop){

            //if (point.source &&
            //    point.source.row_id == 246)
            //{
            //    console.log("Tested point", point, "and new stop is", stop, "and old point is ", point.stopState);
            //}

            var findOldDist=getDistanceFromLatLonInM(point.LAT, point.LON, point.stopState.lat, point.stopState.lon);
            var findNewDist=getDistanceFromLatLonInM(point.LAT, point.LON, stop.lat, stop.lon);

            var findOldTime=point.stopState.t2-point.stopState.t1;
            var findNewTime=stop.time;
            var etalonTime=point.TASK_TIME;

            var oldDeltaWindow=0;
            if(point.real_arrival_time<point.controlled_window.start){
                oldDeltaWindow=point.real_arrival_time-point.controlled_window.start;
            }

            if(point.real_arrival_time>point.controlled_window.finish){
                oldDeltaWindow=point.real_arrival_time - point.controlled_window.finish;
            }

            var newDeltaWindow=0;
            if (stop.t1<point.controlled_window.start){
                newDeltaWindow=stop.t1-point.controlled_window.start;
            }

            if (stop.t1>point.controlled_window.finish){
                newDeltaWindow=stop.t1-point.controlled_window.finish;
            }

            var oldWeight=findOldDist+5*Math.abs(oldDeltaWindow/60)+(10*((etalonTime-findOldTime)/60));

            var newWeight=findNewDist+5*Math.abs(newDeltaWindow/60)+(10*((etalonTime-findNewTime)/60));

            if(oldWeight>newWeight){

              //  console.log("New point is better");
              //  console.log("I have to remove ", point.NUMBER-1, "from", point.stopState.servicePoints);
                var i=0;
                while (i<point.stopState.servicePoints.length){
                     if(point.stopState.servicePoints[i]==point.NUMBER-1) {
                         point.stopState.servicePoints.splice(i,1);
                     }

                    i++;
                }

              //  console.log("result is", point.stopState.servicePoints);

                return true;
            } else{

                return false;

            }

        }


        function loadExistData(date) {
            console.log('Загружаю данные existing...');
            var url = './existdata';
            console.log('load exist data');
            console.log(date);
                http.post(url, {date: date})
                .success(function (data) {
                        console.timeEnd("step1");
                    console.log(data,' existing success data');
                    scope.existData=data;
                    scope.existDataLoaded=false;
                    console.log(' loadExistData updateData');
                    updateData();
                    //console.log("scope.existData",scope.existData);
                })
                .error(function (data) {
                    rootScope.errorNotification(url);
                    console.log(data);
                });

        }



        function concatDailyAndExistingData (){
            //console.log(data);
            console.log('concat from Node existing data', _data, "with", scope.existData  );
            if (!scope.existData.data) return;
            var i=0;
            while (i<_data.routes.length){
                var j=0;
                while (j< _data.routes[i].points.length){
                   var l=0;
                       while (l<scope.existData.data.length){

                           if( scope.existData.data[l]!=null &&
                               scope.existData.data[l].uniqueID !=undefined &&
                               scope.existData.data[l].uniqueID == _data.routes[i].points[j].uniqueID &&
                               scope.existData.data[l].route_id !=undefined &&
                               scope.existData.data[l].route_id == _data.routes[i].points[j].route_id &&
                               scope.existData.data[l].route_indx == _data.routes[i].points[j].route_indx &&
                               scope.existData.data[l].row_id == _data.routes[i].points[j].row_id

                           ) {
                               //console.log("Its time to concat loaded", _data.routes[i].points[j], "with", scope.existData.data[l] );
                               _data.routes[i].points[j]=scope.existData.data[l];
                               break;
                           }
                        l++
                    }
                    j++;
                }
                testUnitePushes(_data.routes[i].pushes);

                i++;
            }


            // Перезапписывание стопов реальными сохраненными данными
            i=0;
            while (i<_data.routes.length){

                var j=0;
                while (_data.routes[i].real_track!=undefined && j< _data.routes[i].real_track.length){
                    var l=0;
                    while (l<scope.existData.data.length){
                        //console.log("I m working");
                        if( scope.existData.data[l]!=null
                            && _data.routes[i].real_track[j].state == "ARRIVAL"
                            && _data.routes[i].real_track[j].id==scope.existData.data[l].id
                            && _data.routes[i].real_track[j].t1==scope.existData.data[l].t1
                            && _data.routes[i].real_track[j].id!=0
                            && _data.routes[i].real_track[j].id!="0"
                            && scope.existData.data[l].servicePoints != undefined
                        ) {

                            _data.routes[i].real_track[j].servicePoints=scope.existData.data[l].servicePoints;
                            break;

                        }
                        l++;
                    }
                    j++;
                }
                i++;
            }


            //console.log("Data", _data);
            //console.log ("scope.rowCollection", scope.rowCollection);
            //!!!!! Проапдейтить rowCollection , displaycollection обновится позже за пределами этой функции

            scope.rowCollection=[];
            i=0;
            while (i<_data.routes.length){

               // console.log("Update rowCollection", scope.rowCollection.length);
                scope.rowCollection=scope.rowCollection.concat(_data.routes[i].points);
                i++;
            }

            //console.log ("scope.rowCollection  2!!!!", scope.rowCollection);

            return _data;
        }

        //rootScope.$on('confirmViewPointEditing', function(event, data){}); // прием события от подтвержденной карточки остановки


        function testUnitePushes (mobilePushes){


            if(mobilePushes==undefined) return;


             //console.log('testUnitePushes', mobilePushes.length);

            for (var i = 0; i < mobilePushes.length; i++) {

                //if (mobilePushes[i].canceled){
                //    console.log('canceled');
                //    continue;}

                if (mobilePushes[i].gps_time_ts == undefined) {
                    console.log('problem with time of pushes');
                    if (mobilePushes[i].gps_time) {
                        mobilePushes[i].gps_time_ts = strToTstamp(mobilePushes[i].gps_time);
                    } else {
                        mobilePushes[i].gps_time_ts = 0;
                    }
                }

                //if (mobilePushes[i].gps_time_ts > _data.server_time){
                //    console.log('problem with data server time');
                //    continue;}

                for (var j = 0; j < _data.routes.length; j++) {
                    for (var k = 0; k < _data.routes[j].points.length; k++) {
                        tmpPoint = _data.routes[j].points[k];
                        LAT = parseFloat(tmpPoint.LAT);
                        LON = parseFloat(tmpPoint.LON);
                        lat = mobilePushes[i].lat;
                        lon = mobilePushes[i].lon;

                        //console.log("i j k, MP.length",i, j, k, mobilePushes.length);

                        // каждое нажатие проверяем с каждой точкой в каждом маршруте на совпадение номера задачи
                        if (mobilePushes[i].number == tmpPoint.TASK_NUMBER) {
                            //console.log("!!!!Find point to Push!!!");
                            tmpPoint.mobile_push = mobilePushes[i];
                            tmpPoint.mobile_arrival_time = mobilePushes[i].gps_time_ts;
                            mobilePushes[i].distance = getDistanceFromLatLonInM(lat, lon, LAT, LON);
                            // если нажатие попадает в радиус заданный в настройках, нажатие считается валидным
                            if (mobilePushes[i].distance <= scope.params.mobileRadius) {
                                tmpPoint.havePush = true;
                                tmpPoint.real_arrival_time = tmpPoint.real_arrival_time || mobilePushes[i].gps_time_ts;
                                // если точка уже подтверждена или у неё уже есть связанный стоп - она считается подтвержденной
                                tmpPoint.confirmed = tmpPoint.confirmed || tmpPoint.haveStop;
                                _data.routes[j].lastPointIndx = k > _data.routes[j].lastPointIndx ? k : _data.routes[j].lastPointIndx;
                                _data.routes[j].pushes = _data.routes[j].pushes || [];
                                findStatusAndWindowForPoint(tmpPoint);
                                break;
                            } else {
                                console.log('>>> OUT of mobile radius');
                            }
                        }
                    }
                }
            }
        }




        //
        //scope.testbutton = function ()  {
        //
        //
        //
        //    console.log("button test was pushed", Date.now()/1000);
        //    var gid=900;
        //    var from=(Date.now()-(1000*60*60*3))/1000;
        //    var to = Date.now()/1000;
        //    http.get('./currentStops/'+gid +'/'+parseInt(from) +'/'+parseInt(to)).
        //        success(function (data) {
        //            console.log('Call for current stops succesfull', data);
        //        })
        //        .error(function(data){
        //            rootScope.errorNotification('./currentStops/'+gid +'/'+parseInt(from) +'/'+parseInt(to));
        //            console.log('ERROR to Call for current stops >>', data);
        //        });
        //
        //
        //};

        // Функция, которая проверяет для непросчитанных маршрутов, является ли стоп валидным
        // по времени. Попадает ли в одно из возможных временных окон.
        function checkUncalculateRoute(point, stop){

            //console.log("Start checkUncalculate");

            var result=false;
            var parts=point.AVAILABILITY_WINDOWS.split(";");
            var size=parts.length;
            var i=0;
            while(i<size){
                var date=point.ARRIVAL_TIME.substr(0,11);
                var temp=parts[i].trim();
                var before=temp.substr(0,5);
                before=date+before+":00";
                //console.log("before=", before);
                var begin=strToTstamp(before, point);

                var after=temp.slice(-5);
                after=date+after+":00";
                var end=strToTstamp(after, point);
                if ((stop.t1> begin-scope.params.timeThreshold * 60) && (stop.t1< end+scope.params.timeThreshold * 60) ){
                    result=true;
                    break;
                }
                i++;
            }




            return result;
        }


        //  транзит в мтм роутер из мэп контроллер изменнных данных
        rootScope.$on('saveUpdate', function (event, markers) {
            // var markersWithOutUndef = [];
            // for(var i = 0; markers.length > i; i++){ // убираем текущее положение машины
            //     if(markers[i] !== undefined){
            //         markersWithOutUndef.push(markers[i]);
            //     }
            // }
            http.post('./saveupdate/', {data: markers, date: scope.routesOfDate})
                .success(function (data) {
                   console.log('send from pic to route', data);
                    alert("Save route success");
                })
                .error(function(err){
                    alert("Save route ERROR!");
                })
        });





        rootScope.$on('askGPSConfirmPoint', function(event, marker){


            if(parentForm != undefined) {

                try {
                    //var temp = parentForm._call('getPointGpsConfirmation', [marker.point.ID]);
                    //console.log("JSON file", temp);
                    //rootScope.gpsConfirm = (JSON.parse((parentForm._call('getPointGpsConfirmation', [marker.point.ID])).m_value)).result;
                    rootScope.gpsConfirm = (JSON.parse((parentForm._call('getPointGpsConfirmation', [marker.point.ID])).Ti)).result;


                } catch (e) {

                    console.log("Point", marker.point, e)
                }

            }
            console.log("Point", marker.point.ID, "confirmed=", rootScope.gpsConfirm);

        });

        function askTimeMatrixForRoute(points, timeMatrix, now, route) {
            var pointsStr = '';
            for (var i = 0; i < points.length; i++) {
                if (points[i].LAT != null && points[i].LON != null) {
                    pointsStr += "&loc=" + points[i].LAT + "," + points[i].LON;
                }
            }
            http.get('./getroutermatrix/' + pointsStr)
                .success(function (data) {
                    var i=1;
                    while(i<data.time_table[0].length) {

                        if (points[i].status ==4 || points[i].status==5 || points[i].status==7){

                            points[i].arrival_left_prediction=data.time_table[0][i-1][0]/10;
                            points[i].arrival_prediction=now+points[i].arrival_left_prediction;
                            if(points[i].status==7 && points[i].arrival_prediction > points[i].arrival_time_ts ){
                                points[i].status=5;
                                points[i].overdue_time=points[i].arrival_prediction-points[i].arrival_time_ts;
                                //console.log("TIME_OUT for point", points[i]);
                            }
                            if((points[i].status==7 || points[i].status==5) && now > points[i].arrival_time_ts ){
                                points[i].status=4;
                                points[i].overdue_time=now-points[i].arrival_time_ts+points[i].arrival_left_prediction;
                                //console.log("DELAY for point", points[i]);
                            }

                        }
                        i++;
                    }
                    updateProblemIndex(route);
                });

        }

        //Приведение времени PUSH к локально текущему Киев прибавляем 3 часа
        function checkPushesTimeGMTZone(pushes){

            var i=0;
            while (i<pushes.length) {

                var temp = pushes[i].gps_time ? strToTstamp(pushes[i].gps_time)+60*60*4 : 0;
                pushes[i].gps_time_ts=temp;
                //console.log(strToTstamp(pushes[i].gps_time), "New Time", temp, "Old TS", pushes[i]);
                var date=new Date();
                date.setTime(pushes[i].gps_time_ts*1000);
                pushes[i].time=timestmpToStr(date);
                i++
            }
        }



        function timestmpToStr(d) {
            //console.log("d", d, "type", typeof (d), "proba", d.getHours());

            var dformat =
                [d.getHours().padLeft(),
                    d.getMinutes().padLeft(),
                    d.getSeconds().padLeft()].join(':');
            return dformat;
        }



        // функция, которая запрашивает данные с сервера одним пакетом
        // для предсказания прибытия. Чтобы клиент не тормозился большим количеством колбэков
        function serverPredicate(){
            var result=[];
            var i=0;
            while(i<_data.routes.length) {

                var route=_data.routes[i];


               if(route.real_track !=undefined && route.real_track.length>0) {
                   var indx = route.uniqueID;
                   var carPos = [{
                       LAT: route.real_track[route.real_track.length - 1].lat,
                       LON: route.real_track[route.real_track.length - 1].lon
                   }];
                   var obj = {id: indx, points: carPos.concat(route.points)};
                   result.push(obj);
                   //if (route.uniqueID == 231157) {
                   //    console.log("Route", route, "result", obj);
                   //}
               }
                i++;
            }

           // console.log("Result for predication=", result);

            http.post('./predicate', {
                collection: result
            })
                .success(function (data) {
                //console.log("Additional load", {data: data});
                   predicateArrivalSecond (data);

            }).error(function(err){
                console.log(err);

            });
        }



        //альтернативный расчет предсказаний, когда все данные получены одним запросом
        function  predicateArrivalSecond (data) {
            //console.log("Start new predicate", data);
            var i = 0;
            while (i < _data.routes.length) {
                if (_data.routes[i].DISTANCE == 0) {
                    uncalcPredication(i);
                } else {
                    calcPredication(i);
                }

                i++

            }


            function uncalcPredication(j) {

                var route = _data.routes[j];
                var now = _data.server_time;


                var time_table = [];
                var points = route.points;

                var k = 0;
                while (k < data.length) {
                    //console.log("Start serch", route.uniqueID, data[k].id );
                    if (route.uniqueID == data[k].id) {
                        //  console.log("find Time_Table");
                        time_table = data[k].time;
                        break;
                    }

                    k++;
                }


                var i = 0;
                //console.log("timeTabls",time_table)
                while (i < points.length) {
                    // console.log("START PREDICATE CALCULATING", points[i]);

                    if (points[i].status == 4 || points[i].status == 5 || points[i].status == 7) {

                        points[i].arrival_left_prediction = time_table[i] / 10 ? time_table[i] / 10 : 15 * 60;//Если у нас нет корректного предсказания времени (нет датчика ДЖПС) точка попадает в опаздывает за 15 минут до конца КОК
                        points[i].arrival_prediction = now + points[i].arrival_left_prediction;
                        if (points[i].status == 7 && points[i].arrival_prediction > points[i].arrival_time_ts) {
                            points[i].status = 5;
                            points[i].overdue_time = points[i].arrival_prediction - points[i].arrival_time_ts;
                            //console.log("TIME_OUT for point", points[i]);
                        }
                        if ((points[i].status == 7 || points[i].status == 5) && now > points[i].arrival_time_ts) {
                            points[i].status = 4;
                            points[i].overdue_time = now - points[i].arrival_time_ts + points[i].arrival_left_prediction;

                            //console.log("DELAY for point", points[i]);
                        }
                        if ( points[i].havePush || points[i].haveStop) {
                            findStatusAndWindowForPoint(points[i]);
                        }
                    }
                    i++;
                }
                updateProblemIndex(route);

            }


            function calcPredication(idx) {

                //console.log("This is calculated route");

                var route,
                    point,
                    tmpPred,
                    now = _data.server_time;


                route = _data.routes[idx];
                //console.log("Predication for ", route.driver.NAME);
                // пропускаем итерацию в случае не валидного трека
                //if (route.real_track == undefined ||
                //    route.real_track.length == 0 ||
                //    route.real_track == aggregatorError) {
                //    route.real_track = undefined;
                //    console.log("Bad Route");
                //    return;
                //}

                if (route.points[route.lastPointIndx]) {

                            //console.log(route.points);
                            //console.log("Делаем прогноз прибытия просчитанных маршрутов");
                            point = route.car_position;
                            //console.log("POINT", point);


                    //найти lastPointIndx

                    var lastPoint = route.points.length - 1;
                    while (lastPoint > 0) {
                        if (route.points[lastPoint].status < 4 || route.points[lastPoint].status == 6) {
                            // lastPoint++;
                            break;
                        }


                        lastPoint--;
                    }


                    // Если последняя точка выполнена, прогноз уже не нужен.
                    //if(lastPoint==route.points.length-1){
                    //    return;
                    //}

                    var singleTimeMatrix = [];

                    if(route.real_track != undefined) {
                        var k = 0;
                        while (k < data.length) {
                            if (data[k].id == route.uniqueID) {

                                singleTimeMatrix = data[k].time;
                                break;
                            }

                            k++;
                        }
                    }



                    var nextPointTime = parseInt(singleTimeMatrix[lastPoint] / 10),
                        totalWorkTime = 0,
                        totalTravelTime = 0,
                        tmpDowntime = 0,
                        totalDowntime = 0,
                        tmpTime;

                    for (var j = 0; j < route.points.length; j++) {
                        //if(route.driver.NAME =="Зінчук Віталій") {
                        //    console.log("Считаем точку Зинчука", lastPoint, route.points[j]);
                        //}
                        if (j <= lastPoint || route.real_track==undefined ) {
                            // все точки до последней выполненной проверяются по факту
                            //console.log("Try to change status for point", _route.points[j] );


                            route.points[j].arrival_prediction = 0;
                            route.points[j].overdue_time = 0;
                            if (route.points[j].status == STATUS.SCHEDULED) {
                                if (now > route.points[j].working_window.finish) {
                                    //!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! Проверить расчет working window
                                    //console.log("NOW=", now, "working_window.finish=", _route.points[j].working_window.finish, " controlled_window", _route.points[j].controlled_window.finish);
                                    route.points[j].status = STATUS.TIME_OUT;
                                    if(route.points[j].havePush || route.points[j].haveStop) {
                                        findStatusAndWindowForPoint(route.points[j])
                                    }
                                    //console.log("_route.points[j].status = STATUS.TIME_OUT;", _route.points[j]);
                                    route.points[j].overdue_time = now - route.points[j].arrival_time_ts;
                                }
                            } else if (route.points[j].status == STATUS.IN_PROGRESS) {
                                totalWorkTime = parseInt(route.points[j].TASK_TIME) - (now - route.points[j].real_arrival_time);
                            }
                        } else {
                            // точки ниже последней выполненной считаются ниже
                            //  console.log (j, "Point for Route", route);
                            tmpTime = route.time_matrix.time_table[0][j - 1][j];
                            // времена проезда от роутера приходят в десятых долях секунд
                            totalTravelTime += tmpTime == undefined ? 15*60 : parseInt(tmpTime / 10);
                            tmpPred = now + nextPointTime + totalWorkTime + totalTravelTime + totalDowntime;
                            tmpDowntime = route.points[j].working_window.start - tmpPred;
                            if (tmpDowntime > 0) {
                                totalDowntime += tmpDowntime;
                                tmpPred = route.points[j].working_window.start;
                            }


                            route.points[j].arrival_prediction = now + nextPointTime + totalWorkTime + totalTravelTime;

                            // console.log("In route", route, "Predication for point ", j, "==", route.points[j].arrival_prediction);

                            route.points[j].in_plan = true;
                            if (route.points[j].arrival_prediction == null || route.points[j].arrival_prediction == 0 || route.points[j].arrival_prediction == '0' ) {
                                route.points[j].arrival_prediction = tmpPred;
                            } else {
                                if (tmpPred + 300 < route.points[j].arrival_prediction) {
                                    route.points[j].in_plan = false;
                                }

                                route.points[j].arrival_prediction = tmpPred;
                            }

                            route.points[j].arrival_left_prediction = parseInt(route.points[j].arrival_prediction - now);
                            // предсказываем статус опаздывает или уже опаздал
                            if (route.points[j].arrival_prediction > route.points[j].arrival_time_ts) {
                                route.points[j].overdue_time = parseInt(route.points[j].arrival_prediction -
                                    route.points[j].working_window.finish);

                                if (route.points[j].overdue_time > 0) {
                                    if (route.points[j].working_window.finish < now) {
                                        route.points[j].status = STATUS.TIME_OUT;
                                        if(route.points[j].havePush || route.points[j].haveStop) {
                                            findStatusAndWindowForPoint(route.points[j])
                                        }
                                        //console.log("_route.points[j].status = STATUS.TIME_OUT;");
                                    } else {
                                        route.points[j].status = STATUS.DELAY;
                                        if(route.points[j].havePush || route.points[j].haveStop) {
                                            findStatusAndWindowForPoint(route.points[j])
                                        }
                                        //console.log("_route.points[j].status = STATUS.DELAY;");
                                    }
                                }

                            } else {
                                route.points[j].overdue_time = 0;
                            }

                            totalWorkTime += parseInt(route.points[j].TASK_TIME);
                        }
                    }

                    updateProblemIndex(route);


                }


                scope.rowCollection[idx].problem_index = scope.rowCollection[idx].problem_index || 0;
               // console.log("scope.rowCollection[idx].problem_index", scope.rowCollection[idx].problem_index);

                rootScope.rowCollection = scope.rowCollection;


            }


            if (scope.filters.route == -1){
                rootScope.$emit('displayCollectionToStatistic', scope.displayCollection);
            }else{
                for(var i = 0; _data.routes.length > i; i++){
                    if(_data.routes[i].filterId == scope.filters.route){
                        rootScope.$emit('displayCollectionToStatistic', _data.routes[i].points);
                        break;
                    }
                }
            }
        }


        function  updateDataforPast(){
            console.log("START UPDATING FOR PAST bun now is", rootScope.nowTime);
            var i=0;
            while (i<_data.routes.length){
                var j=0;
                while(j<_data.routes[i].points.length){
                    if (_data.routes[i].points[j].status>2 && _data.routes[i].points[j].status != 8){
                        _data.routes[i].points[j].status=4;
                        _data.routes[i].points[j].overdue_time=rootScope.nowTime -_data.routes[i].points[j].arrival_time_ts;
                    }

                    j++;
                }

                updateProblemIndex(_data.routes[i]);
                i++;
            }
            if ( _data.closedRoutesFrom1C && _data.closedRoutesFrom1C.routes.length > 0) {

                scope.unbindStop = function(oldRout1C, oldRout, l){
                    oldRout.points[l].haveStop = false;
                    delete oldRout.points[l].stopState;
                    var number = oldRout.points[l].NUMBER;
                    for(var r = 0; oldRout.real_track.length > r; r++){
                        if('servicePoints' in oldRout.real_track[r]){
                            for(var x = 0; oldRout.real_track[r].servicePoints.length > x; x++){
                                if(oldRout.real_track[r].servicePoints == number - 1){
                                    oldRout.real_track[r].servicePoints.splice(x, 1);
                                    break;
                                }
                            }
                        }
                    }
                };
                scope.bindStop = function(oldRout1C, oldRout, k, l){
                    var t1 = oldRout1C.points[k].stop.arrival;
                    var taskid = oldRout1C.points[k].taskID;
                    for(var z = 0; oldRout.points.length > z; z++){
                        if(oldRout.points[z].TASK_NUMBER == taskid){
                            var number = oldRout.points[z].NUMBER;
                            break;
                        }
                    }

                    oldRout.points[l].haveStop = true;
                    for(var r = 0; oldRout.real_track.length > r; r++){
                        if(oldRout.real_track[r].state != "ARRIVAL") continue;
                        if(oldRout.real_track[r].t1 == t1){
                            if('servicePoints' in oldRout.real_track[r]){
                                console.log(oldRout.real_track[r]);
                                oldRout.real_track[r].servicePoints.push(number - 1);
                            }else{
                                oldRout.real_track[r].servicePoints = [number - 1];
                            }
                            break;
                        }
                    }
                    oldRout.points[l].stopState = oldRout.real_track[r];
                };



                for(var i = 0; _data.closedRoutesFrom1C.routes.length > i; i++){
                    var oldRout1C = _data.closedRoutesFrom1C.routes[i];
                    for(var j = 0; _data.routes.length > j; j++){
                        var oldRout = _data.routes[j];
                        if(oldRout1C.itenereryID == oldRout.itineraryID && oldRout1C.routeID == oldRout.NUMBER && oldRout1C.transportID == oldRout.TRANSPORT){
                            oldRout.closeRoute = true;
                            for(var k = 0; oldRout.points.length > k; k++){
                                onChangeStatus(undefined, { row: oldRout.points[k], option: 'confirm-status'});
                            }
                            for(k = 0; oldRout1C.points.length > k; k++){
                                for(var l = 0; oldRout.points.length > l; l++){
                                    if(oldRout1C.points[k].taskID == oldRout.points[l].TASK_NUMBER){




                                        if(oldRout1C.points[k].stop.arrival){ // если в 1С есть стоп
                                            if(oldRout.points[l].haveStop && 'stopState' in oldRout.points[l]){
                                                if(!(oldRout1C.points[k].stop.arrival == oldRout.points[l].stopState.t1)){
                                                    // отвязать текущий стоп и привязать нужный
                                                    scope.unbindStop(oldRout1C, oldRout, l);
                                                    scope.bindStop(oldRout1C, oldRout, k, l);
                                                }
                                            }else{
                                                // привязать стоп
                                                scope.bindStop(oldRout1C, oldRout, k, l);

                                            }
                                        }else{
                                            if(oldRout.points[l].haveStop){ // если есть стоп в моделе
                                                scope.unbindStop(oldRout1C, oldRout, l);
                                            }
                                        }

                                        if(!oldRout1C.points[k].status){
                                            oldRout.points[l].reasonDisp = oldRout1C.points[k].reasonDisp;
                                            onChangeStatus(undefined, { row: oldRout.points[l], option: 'cancel-point'});
                                        }






                                    }
                                }
                            }
                        }
                    }
                }




                
                rootScope.$emit('checkInCloseDay');
                if(scope.filters.route == -1) {
                    rootScope.$emit('displayCollectionToStatistic', scope.displayCollection);
                }else{
                    for(var i = 0; _data.routes.length > i; i++){
                        if(_data.routes[i].filterId == scope.filters.route){
                            rootScope.$emit('displayCollectionToStatistic', _data.routes[i].points);
                            break;
                        }
                    }
                }
            }


        }





        rootScope.$on('changeDriver',  function (event, driver, transport, start, routeID) {
            console.log("PIC recieve and gona work",  driver, transport, start, routeID, _data);
            changeDriveronRoute(driver, transport, start, routeID)
        });

        function changeDriveronRoute(driver, transport, start, routeID) {



           // определение, какой роут подвергся редактированию
            var i=0;
            while (i<_data.routes.length) {
                if(_data.routes[i].uniqueID==routeID) {
                    var tempRouteDublicate=_data.routes[i];
                    //console.log("We will change",_data.routes[i].filterId );
                    //console.log("All route", tempRouteDublicate);
                    break;
                }

                i++;
            }

            //частный случай если ничего не поменялось
            if(tempRouteDublicate.TRANSPORT == transport  && tempRouteDublicate.DRIVER == driver){
                console.log("It is nothing to change");
                return;
            }



            //частный случай, если поменяли только водителя на маршруте, на котором не сделано ни одной точки
            if(tempRouteDublicate.TRANSPORT == transport && start==1){
                console.log("Just driver change");

                tempRouteDublicate.DRIVER=driver;
                // замена водителя
                var i=0;
                while(i<_data.drivers.length){
                    if(_data.drivers[i].ID == driver) {

                        tempRouteDublicate.driver= _data.drivers[i];
                        var newDriver=_data.drivers[i];
                        break;
                    }

                    i++;
                }

                //Замена поля driver во всех точках маршрута
                i=0;
                while(i< tempRouteDublicate.points.length){
                    tempRouteDublicate.points[i].driver=newDriver;
                    i++;
                }

                //Замена водителя в scope.filters.routes
                i=0;
                while(i<scope.filters.routes.length){
                    //console.log("Start serching" , tempRouteDublicate.filterId, "=",scope.filters.routes[i].value);
                    if (scope.filters.routes[i].value == tempRouteDublicate.filterId){
                        scope.filters.routes[i].driver = ( tempRouteDublicate.hasOwnProperty('driver') && tempRouteDublicate.driver.hasOwnProperty('NAME') ) ? tempRouteDublicate.driver.NAME : 'без имени'+i; //!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!добавили свойство driver для события в closeDriverName
                        scope.filters.routes[i].nameDriver =  ( ( tempRouteDublicate.hasOwnProperty('driver') && tempRouteDublicate.driver.hasOwnProperty('NAME') ) ? tempRouteDublicate.driver.NAME : 'без имени') + ' - ' + tempRouteDublicate.transport.NAME;

                        //console.log("ReArange scope.filters.routes");
                        break;
                    }
                    i++
                }



                http.post('./changedriver', {
                    routes: [tempRouteDublicate]
                })
                    .success(function (data) {
                        console.log("Cashe Update", {data: data});

                    }).error(function(err){
                        console.log(err);

                    });
                //console.log("Changed route is", tempRouteDublicate);
                return;
            }



            // создание дубликакта роута
            var routeDublicate={};
            routeDublicate=JSON.parse(JSON.stringify(tempRouteDublicate));


            //Прописывание в новый роут правильных данных
            delete routeDublicate.DRIVER;  //
            delete routeDublicate.NUMBER_OF_TASKS;
            delete routeDublicate.TRANSPORT; //
            delete routeDublicate.car_position;
            delete routeDublicate.driver; //
            delete routeDublicate.haveSensor; //
            delete routeDublicate.locked;    //
            delete routeDublicate.lockedByMe; //
            delete routeDublicate.real_track;
            delete routeDublicate.transport; //
            delete routeDublicate.uniqueID; //
            delete routeDublicate.$$hashKey;


            routeDublicate.ID =_data.routes.length;
            routeDublicate.filterId = _data.routes.length;
            routeDublicate.getCheck = false;
            routeDublicate.uniqueID = ""+routeDublicate.itineraryID+routeDublicate.NUMBER+routeDublicate.ID;




            //Найти нового водителя в полной базе
            var i=0;
            while(i<_data.drivers.length){
                if(_data.drivers[i].ID == driver) {
                    routeDublicate.DRIVER=driver;
                    routeDublicate.driver=_data.drivers[i];
                    break;
                }

                i++;
            }

            // Найти новый транспорт
            i=0;
            while(i<_data.transports.length){
                if(_data.transports[i].ID == transport) {
                    routeDublicate.TRANSPORT=transport;
                    routeDublicate.transport=_data.transports[i];
                    _data.transports[i].gid ? routeDublicate.haveSensor=true : routeDublicate.haveSensor=false;
                    break;
                }

                i++;
            }

            //Разделить между маршрутами точки, прогнозы, геометрию

            var indx=start-1;// Номер точки на 1 больше чем индекс (если начинать с 1 точки, то это с 0 индекса);



            // Разделение точек между маршрутами
            var removed = tempRouteDublicate.points.slice(indx);
            routeDublicate.points=removed;
            tempRouteDublicate.points.length= indx;

            //Разделение plan_geometry между маршрутами
            removed = tempRouteDublicate.plan_geometry.slice(indx);
            routeDublicate.plan_geometry=removed;
            tempRouteDublicate.plan_geometry.length= indx;


            //Разделение данных для предсказания
            removed = tempRouteDublicate.time_matrix.length_table[0].slice(indx);
            routeDublicate.time_matrix.length_table[0]=removed;
            tempRouteDublicate.time_matrix.length_table[0].length= indx;

            removed = tempRouteDublicate.time_matrix.time_table[0].slice(indx);
            routeDublicate.time_matrix.time_table[0]=removed;
            tempRouteDublicate.time_matrix.time_table[0].length= indx;

            console.log("We will change route", routeDublicate , tempRouteDublicate);
            _data.routes.push(routeDublicate);
            //Сохранить

            scope.$apply;


            //Изменить route_id в новом маршруте во всех точках а также driver transport
            var i=0;
            while(i<routeDublicate.points.length){
                routeDublicate.points[i].transport= routeDublicate.transport;
                routeDublicate.points[i].driver= routeDublicate.driver;
                routeDublicate.points[i].route_id = routeDublicate.filterId;
                routeDublicate.points[i].route_indx = routeDublicate.filterId;
                i++;
            }

            //console.log("DisplayCollection", scope.displayCollection);

            //добавление новго выбора для селектора
            scope.filters.routes.push({
                //name: data.routes[i].transport.NAME,
                allRoutes: false,
                nameDriver:  ( ( routeDublicate.hasOwnProperty('driver') && routeDublicate.driver.hasOwnProperty('NAME') ) ? routeDublicate.driver.NAME : 'без имени') + ' - ' + routeDublicate.transport.NAME ,
                nameCar:  routeDublicate.transport.NAME  + ' - ' +   ( ( routeDublicate.hasOwnProperty('driver') && routeDublicate.driver.hasOwnProperty('NAME') ) ? routeDublicate.driver.NAME : 'без имени') ,
                value: routeDublicate.filterId,
                car: routeDublicate.transport.NAME,
                driver: ( routeDublicate.hasOwnProperty('driver') && routeDublicate.driver.hasOwnProperty('NAME') ) ? routeDublicate.driver.NAME : 'без имени'+i //!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!добавили свойство driver для события в closeDriverName
            });



            //Сохраняем в кеш измененные данные. Отправляем 2 роута. Первый надо будет перезаписать, второй добавить.
            // отдельно взять точки из первого маршрута и обновить update
            http.post('./changedriver', {
                routes: [tempRouteDublicate, routeDublicate]
            })
                .success(function (data) {
                    console.log("Cashe updated 2 times", {data: data});

                }).error(function(err){
                    console.log(err);

                });


        }


        scope.loadOldDay = function(){
            if(scope.showDate!=undefined){
                var dateTS = scope.showDate.getTime();
                scope.params.showDate = (dateTS + 1000*60*60*24) - 1 || -1;

                //rootScope.$emit('fastCalc');
                rootScope.$emit('stateChanged');
                http.post('./currentsrvertime/')
                    .success(function (serverTime){
                        var chooseDate = new Date(scope.params.showDate);
                        var currentTime = new Date(serverTime);
                        if(chooseDate.getFullYear()+'.'+chooseDate.getMonth()+'.'+chooseDate.getDate() == currentTime.getFullYear()+'.'+currentTime.getMonth()+'.'+currentTime.getDate()){
                            scope.params.showDate = null;
                        }
                        if (scope.params.showDate !== -1) {
                            scope.$emit('clearMap');
                            console.log('OMG!!1 New show date!');
                            loadDailyData(true, scope.params.showDate);
                        }
                    });
            }
        };


        rootScope.$on('reFact', function (event, indx){
            var route=_data.routes[indx];
            factTimeForRoute (route, true);
        });


        //функция определяющая реальную последовательность посещения точек
        function factTimeForRoute (route, sort) {
            //создаем три массива Доставлено / В плане / Отменено
            //Сортируем каждый массив по своему признаку
            // Объединяем массивы
            // Потом проходимся по массиву и в каждую точку в свойство факт заносим ее индекс +1

            console.log("Route, to refact", route);

            var deliveredPoints = [];
            var sheduledPoints = [];
            var canceledPoints = [];
            console.log("Rebuild fact", deliveredPoints.length, sheduledPoints.length, canceledPoints.length);
            var i = route.points.length;
            while( i-- > 0){

            }
            var i=-1;
            while(i++<route.points.length-1){
                //console.log("i=", i);
                if(route.points[i].status < 4 || route.points[i].status == 6 ) {deliveredPoints.push(route.points[i]); continue;}
                if(route.points[i].status < 8) {sheduledPoints.push(route.points[i]); continue;}
                canceledPoints.push(route.points[i]);

            }

            function comparePlanTime (a, b){
                return a.arrival_time_ts - b.arrival_time_ts;
            }

            function compareRealTime (a, b){
                return a.real_arrival_time - b.real_arrival_time;
            }

            function compareCancelTime (a, b){
                return a.cancel_time - b.cancel_time;
            }

            deliveredPoints.sort(compareRealTime);
            sheduledPoints.sort(comparePlanTime);
            canceledPoints.sort(compareCancelTime);

            var allPoints=deliveredPoints.concat(sheduledPoints);
            allPoints=allPoints.concat(canceledPoints);

            var i=0;
            while(i<allPoints.length){
                allPoints[i].fact_number = i+1;
                i++;
            }



            console.log("Combos Length", route.points.length, deliveredPoints.length, sheduledPoints.length, canceledPoints.length);

           if (sort) {scope.order('fact_number'); scope.order('fact_number');}

        }

        function checkNewIten(){
            http.get('./checknewiten')
        }

        rootScope.$on('statusUpdate', statusUpdate);


        // Удаление некорректного пуша
        rootScope.$on('cancelPush', cancelPush);
            function cancelPush (event , point) {
            console.log("Try to cancel push", point);
            point.incorrect_push=point.mobile_push;
            delete point.mobile_push;
            delete point.havePush;

            //Находим роут, соответсвующий этой точке
                var i=0;
                var route;
                while (i<_data.routes.length){
                    console.log()
                    if( point.uniqueID==_data.routes[i].uniqueID){
                        route=_data.routes[i];
                        console.log("Delete push in this route", route);
                        break;
                    }

                    i++;
                }

                // Удаляем пуш из массива пушей
                console.log("Delete push in this route", route);
                var ki=0;
                while(ki<route.pushes.length){
                    console.log("Looking looking looking", route.pushes[ki].number, point.incorrect_push.number );
                    if(route.pushes[ki].number == point.incorrect_push.number){
                        route.pushes.splice(ki,1);
                        console.log("Find and kill incorrect push");
                        break;
                    }

                    ki++;
                }
        };

        //scope.$on("$locationChangeStart", function(){
        //    alert("Hey Hoorey");
        //});

        function checkTimeForEditing (){
            var end = Date.now()/1000;
            console.log("Check for timeout", rootScope.editing.start, end, end-rootScope.editing.start);
            if(rootScope.editing.start + 600 < end ) {
                http.post('./logout')
                            .success(function (data) {
                                console.log("complete");
                            });

                        //alert("Bye!!!!!");
                        //event.returnValue = "Write something clever here..";
                scope.filters.route = -1;
                scope.$emit('clearMap');
                rootScope.editing={};
                rootScope.$emit('logoutsave');
                alert("Time out!");
                }


            }

    function onCloseMonitoring(){}


    }]);



//points, timeMatrix, now
