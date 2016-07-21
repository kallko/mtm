var express = require('express'),
    router = express.Router(),
    config = require('../config'),
    soap = require('../soap/soap'),
    tracks = require('../tracks'),
    log = new (require('../logging'))('./logs'),
    fs = require('fs'),
    math_server = new (require('../math-server'))(),
    db = new (require('../db/DBManager'))('postgres://pg_suser:zxczxc90@localhost/plannary'),
    locker = new (require('../locker'))(),
    CronJob = require('cron').CronJob,

    cashedDataArr = {},  // глобальный кеш
    updateCacshe = {}, // Тестовый кэш
    aggregatorError = "invalid parameter 'gid'. ",
    stopUpdateInterval = 120,                       // интервал обновлений стопов
    updateTrackInterval = 30,                       // интервал загрузки новых данных при отрисовке треков
    controlledWindow = 600,                         // размер контролируемого окна
    promisedWindow = 3600,                          // размер обещанного окна
    problemSortType = 0,                            // тип сортировки проблемности

    closeRoutesUniqueID = {}, // для каждой фирмы UniqueID  сегодняшних закрытых роутов

    oldRoutesCache = {}, // объект со всеми роутами,  кроме текущего дня
    companyLogins = {},   // Список логинов на компании
    needNewReqto1C = {}, // если есть свойство с именем компани, то не запрвшивать из 1С
    priority = [],
    currentProblems = {}, //неотправленные на клиента проблеммы.
    blockedRoutes = [], // список заблокированных маршрутов
    startServer = false, // Изначальное состояние периодичности расчетов. Не менять.
    onlineClients = [];   // список клиентов онлайн на данный момент
//
//    window_types = [                              // фильтры по типам попадания в окна
//    {name: 'Вне окон', value: WINDOW_TYPE.OUT_WINDOWS, class: 'out-windows'},
//    {name: 'В заказанном', value: WINDOW_TYPE.IN_ORDERED, class: 'in-ordered'},
//    {name: 'В обещанном', value: WINDOW_TYPE.IN_PROMISED, class: 'in-promised'}
//];


new CronJob('01 00 00 * * *', function() {
    for(var company in cashedDataArr){
        if (!oldRoutesCache[company]) {
            oldRoutesCache[company] = {};
        }
        if(company in closeRoutesUniqueID) { // есть ли за сегодня закрытые роуты, если да, то по UniqueID удаляем их из сегодняшних роутов
            for (var i = 0; closeRoutesUniqueID[company].length > i; i++) {
                for (var j = 0; cashedDataArr[company].routes.length > j; j++) {
                    if (cashedDataArr[company].routes[j]['uniqueID'] == closeRoutesUniqueID[company][i]) { // удаляем из кеша все закрытые маршруты
                        cashedDataArr[company].routes.splice(j, 1);
                        j--;
                        break;
                    }

                }
            }
        }
        if(cashedDataArr[company].routes.length > 0){ // если еще остались роуты то добавляем их к старым в oldRoutesCache
            var currentDate = cashedDataArr[company].routes[0].START_TIME.split(' ')[0];
            oldRoutesCache[company][currentDate] = {};
            oldRoutesCache[company][currentDate] = JSON.parse(JSON.stringify(cashedDataArr[company]));
        }
    }

    console.log('END CRON');

    needNewReqto1C = {};
    closeRoutesUniqueID = {};


}, null, true);




    var demoLogin = 'demo';
    var tracksManager = new tracks(
        config.aggregator.url,
        config.router.url,
        config.aggregator.login,
        config.aggregator.password);

router.route('/')
    .get(function (req, res) {
        res.status(200);
    });


router.route('/currentsrvertime')
    .post(function(req, res){
        res.status(200).json(Date.now());
    });


// запуск монитора диспетчера в демо-режиме
//router.route('/demo')
//    .get(function (req, res) {
//        req.session.login = demoLogin;
//        res.sendFile('index.html', {root: './public/'});
//    });

router.route('/keysoldroutescache')
    .get(function(req, res){
        var key = ""+req.session.login;
        var currentCompany = companyLogins[key];
        if(currentCompany in oldRoutesCache){
            console.log(Object.keys(oldRoutesCache[currentCompany]));
            res.status(200).json( Object.keys(oldRoutesCache[currentCompany]) );
        }else{
            res.status(200).json(null);
        }


    });
router.route('/getoldroute')
    .post(function(req, res){
        var key = ""+req.session.login;
        var currentCompany = companyLogins[key];
        res.status(200).json(oldRoutesCache[currentCompany][req.body.date]);
    });


// через этот путь запускается мониторинг при открытии через 1С, при этом сохраняется логин из 1С
router.route('/login')
    .get(function (req, res) {
        req.session.login = req.query.curuser;
        res.sendFile('index.html', {root: './public/'});
    });

// загрузка данных из соапа за текущий день
router.route('/dailydata')
    .get(function (req, res) {
        console.log("Start Loading DailyData");
        startTime = parseInt(Date.now()/1000);
        req.session.lastLockCheck = 0;
        // проверка на включеннный демо режим
        if (req.session.login == demoLogin) {
            var soapManager = new soap(req.session.login);
            soapManager.loadDemoData(function (data) {
                console.log('Demo data loaded!');
                data.demoMode = true;
                data.user = req.session.login;
                res.status(200).json(data);
            });
            return;
        }

        // присвоение лоина для прогрузки интерфейса при запуске вне окна 1С (для отладки)
        console.log("Prepere for Conflict!!!!!!!!", req.session.login);
        if (req.session.login == null || req.session.login == undefined) {
            console.log("Login", req.session.login);
            res.status(401).json({status: 'Unauthorized'});
            //req.session.login = config.soap.defaultClientLogin;
        }

        var now = Date.now(),
            day = 86400000;
        //today12am = now - (now % day);
        var key = ""+req.session.login;
        var currentCompany = companyLogins[key];

        //тестово отладочный блок. Проверка повторного обращения за данными в течение дня
        //console.log("!!!!!!!req.session.login!!!!!", req.session.login);
        //
        //if(req.session.login!=undefined && updateCacshe[req.session.login].length==0){
        //    console.log("First call for data!, or login undefined");
        //
        //} else {
        //    console.log("Repeat call for data!");
        //}

        // при включенном флаге кешинга по сессии, ищет наличие относительно свежего кеша и отправляет в случае успеха



        console.log(" Should I choose Cashe?", config.cashing.session
            , req.query.force == null
            , req.query.showDate == null
            , req.session.login != null
            , cashedDataArr[currentCompany] != null
            , (currentCompany in needNewReqto1C), currentCompany, needNewReqto1C
            );

        if (config.cashing.session
            && req.query.force == null
            && req.query.showDate == null
            && req.session.login != null
            && cashedDataArr[currentCompany] != null
            && (currentCompany in needNewReqto1C)
            /*&& cashedDataArr[req.session.login].lastUpdate == today12am*/ ) {
            console.log('=== loaded from session === send data to client === ROutes =',cashedDataArr[currentCompany].routes.length );
            req.session.itineraryID = cashedDataArr[currentCompany].ID;
            cashedDataArr[currentCompany].user = req.session.login;
            var cache = cashedDataArr[currentCompany];
            if(cache.currentDay){
                cache.server_time = parseInt(new Date() / 1000);
                cache.current_server_time = cache.server_time;
            }else{
                cache.current_server_time = parseInt(Date.now() / 1000);
            }

             res.status(200).json(cashedDataArr[currentCompany]);
        } else {
            // запрашивает новые данные в случае выключенного кеширования или отсутствия свежего
            middleTime = parseInt(Date.now()/1000);
            var soapManager = new soap(req.session.login);
            var settings={};

            // Получение настроек для конкретной компании
            soapManager.getNewConfig(req.session.login, function (company, data) {
                //console.log("receiveConfig", data);
                settings = JSON.parse(data.return);
                //console.log("Obj",  obj.predictMinutes, "mtm 1192")
            });

            //Получение дневного плана для конкретной компании
            soapManager.getAllDailyData(dataReadyCallback, req.query.showDate);




            function dataReadyCallback(data) {
                console.log("Загрузка данных от 1с заняла", parseInt(Date.now()/1000)-middleTime, "А с самого начала", parseInt(Date.now()/1000)-startTime)
                endTime = parseInt(Date.now()/1000);
                if (data.routes != undefined) {
                console.log('=== dataReadyCallback === send data to client ===', data.routes.length);}
                // Добавления уникального ID для каждого маршрута и этогоже ID для каждой точки на маршруте
                console.log('send data to client');
                if (data.status && data.status === 'no plan') { // если на сегодня нет планов
                    res.status(200).json(data);
                }else if( data.routes.length == 0){
                    res.status(200).json({status: 'no plan'});
                }else{
                    console.log("ReChange SessionLogin", data.CLIENT_ID);

                    var currentCompany = JSON.parse(JSON.stringify(data.CLIENT_ID));
                    var key=""+req.session.login;
                    companyLogins[key]=currentCompany;


                    needNewReqto1C[currentCompany] = true;
                            //здесь падала программа при длительном использовании.
                    
                    if (data.routes !=undefined) {
                        for (var i = 0; i < data.routes.length; i++) {
                            if (!data.routes[i]['uniqueID']) {
                                data.routes[i]['uniqueID'] = data.routes[i].itineraryID + data.VERSION + data.routes[i].ID;
                                for (var j = 0; j < data.routes[i].points.length; j++) {
                                    data.routes[i].points[j]['uniqueID'] = data.routes[i].itineraryID + data.VERSION + data.routes[i].ID;
                                }
                            }
                        }


                    req.session.itineraryID = data.ID;
                    data.user = req.session.login;
                    data.routesOfDate = data.routes[0].START_TIME.split(' ')[0];
                    }
                    cashedDataArr[currentCompany] = data;

                    cashedDataArr[currentCompany].currentProblems = [];
                    cashedDataArr[currentCompany].allRoutes=[];
                    cashedDataArr[currentCompany].settings = settings;
                    cashedDataArr[currentCompany].settings.limit = cashedDataArr[currentCompany].settings.limit || 74; //TODO прописать в настройки на 1с параметр лимит

                    //Собираем решение из частей в одну кучку
                    linkDataParts(currentCompany, req.session.login);


                    // св-во server_time получает истенное время сервера, только если был запрошен день не из календарика, если из - то вернет 23 59 запрошенного дня
                    data.current_server_time = parseInt(new Date() / 1000);
                    var current_server_time = new Date();
                    var server_time = new Date(data.server_time * 1000);
                    if(server_time.getFullYear()+'.'+server_time.getMonth()+'.'+server_time.getDate() == current_server_time.getFullYear()+'.'+current_server_time.getMonth()+'.'+current_server_time.getDate()){
                        data.currentDay = true;
                        data.current_server_time = data.server_time;
                        //cashedDataArr[req.session.login] = data;
                    }else{
                        data.currentDay = false;
                    }





                    //TODO Склейка решения закончена, включаем периодическое (раз в 2 минуты ) обновление и пересчет данных
                    //interval(startPeriodicCalculating(currentCompany), 20 * 1000);
                    if(startServer == false) {
                        console.log("Start SERVER");
                        startServer = true;
                    var timerId = setInterval(function() {
                        startPeriodicCalculating(currentCompany);
                    }, 120 * 1000);}
                    // через 5 сек остановить повторы
                    //setTimeout(function() {
                    //    clearInterval(timerId);
                    //    alert( 'стоп' );
                    //}, 5000);

                    res.status(200).json(data);
                }
            }
        }

    });





// проверка блокировок точек и маршрутов
router.route('/checklocks/:itineraryid')
    .get(function (req, res) {
        req.params.itineraryid = req.params.itineraryid.replace('SL', '/');
        var result = locker.checkLocks(req.params.itineraryid, req.session.lastLockCheck);
        if (result) {
            req.session.lastLockCheck = result.lastChange;
            res.status(200).json({status: 'changed', locked: result});
        } else {
            res.status(200).json({status: 'no_changes'});
        }
    });

// открытие окна точки с проверкой на блокировки
router.route('/opentask/:itineraryid/:taskid')
    .get(function (req, res) {
        req.params.itineraryid = req.params.itineraryid.replace('SL', '/');
        locker.checkTaskLock(req.params.itineraryid, req.params.taskid, req.session.login,
            function () {
                if (req.query.lockTask) locker.lockTask(req.params.itineraryid, req.params.taskid, req.session.login);
                res.status(200).json({status: 'ok'});
            },
            function (user) {
                res.status(200).json({
                    status: 'locked',
                    byUser: user,
                    me: req.session.login === user
                });
            });
    });

// разблокирование конкретной задачи
router.route('/unlocktask/:itineraryid/:taskid')
    .get(function (req, res) {
        req.params.itineraryid = req.params.itineraryid.replace('SL', '/');
        if (locker.unlockTask(req.params.itineraryid, req.params.taskid, req.session.login)) {
            res.status(200).json({status: 'unlocked'});
        } else {
            res.status(200).json({status: 'not_yours'});
        }
    });


// блокировка всего марщрута
router.route('/lockroute/:itineraryid/:routeid/:tasks')
    .get(function (req, res) {
        req.params.itineraryid = req.params.itineraryid.replace('SL', '/');
        var tasksArr = req.params.tasks.split(';');
        locker.checkRouteLocks(req.params.itineraryid, tasksArr, req.session.login,
            function () {
                locker.lockRoute(req.params.itineraryid, req.params.routeid, tasksArr, req.session.login);
                res.status(200).json({status: 'ok'});
            },

            function (user) {
                res.status(200).json({status: 'locked', byUser: user});
            });
    });

// разблокировка всего маршрута
router.route('/unlockroute/:itineraryid/:routeid/:tasks')
    .get(function (req, res) {
        req.params.itineraryid = req.params.itineraryid.replace('SL', '/');
        var tasksArr = req.params.tasks.split(';');
        var result = locker.unlockRoute(req.params.itineraryid, tasksArr, req.session.login);
        res.status(200).json(result);
    });

// получение куска трека по гиду машины и по временному промежутку
router.route('/tracks/:gid&:from&:to&:undef_t&:undef_d&:stop_s&:stop_d&:move_s&:move_d')
    .get(function (req, res) {
        tracksManager.getTrack(
            req.params.gid,
            req.params.from,
            req.params.to,
            req.params.undef_t,
            req.params.undef_d,
            req.params.stop_s,
            req.params.stop_d,
            req.params.move_s,
            req.params.move_d, function (data) {
                res.status(200).json(data);
            });
    });

// догрузка треков в данные по сессии по всем машинам сразу
router.route('/trackparts/:start/:end')
    .get(function (req, res) {
        console.log('trackparts', req.session.login);
        if (req.session.login == undefined || req.session.login == null) {
            res.status(401).json({status: 'Unauthorized'});
            return;
        }

        var first = true;
        var key = ""+req.session.login;
        var currentCompany = companyLogins[key];
        tracksManager.getRealTrackParts(cashedDataArr[currentCompany], req.params.start, req.params.end,
            function (data) {
                if (!first) return;

                console.log('getRealTrackParts DONE');
                first = false;
                var key = ""+req.session.login;
                var currentCompany = companyLogins[key];
                var cached = cashedDataArr[currentCompany];


                if(cached) {
                    for (var i = 0; i < cached.sensors.length; i++) {
                        for (var j = 0; j < data.length; j++) {
                            if (cached.sensors[i].GID == data[j].gid && data[j].data != cached.sensors[i].real_track) {
                                if (data[j].data.length > 0 && cached.sensors[i].real_track != undefined) {
                                    // var stopsBefore = cached.sensors[i].real_track.length;

                                   // console.log("Car with gid=",cached.sensors[i].GID, "Had stops",  stopsBefore);
                                    //if (cached.sensors[i].GID == 9296) {
                                    //   // console.log(cached.sensors[i].real_track, " BEFORE MTM 338")
                                    //}


                                    var len = cached.sensors[i].real_track.length-1;
                                    if (cached.sensors[i].real_track[len].state == 'CURRENT_POSITION') {
                                        cached.sensors[i].real_track.length = len;
                                    }
                                    data[j].data[0].state = 'MOVE';
                                    cached.sensors[i].real_track = cached.sensors[i].real_track || [];
                                    cached.sensors[i].real_track = cached.sensors[i].real_track.concat(data[j].data);
                                    // var stopsAfter = cached.sensors[i].real_track.length;
                                   // console.log("Car with gid=", cached.sensors[i].GID, "Now have stops",  stopsAfter);
                                    //if (cached.sensors[i].GID == 9296) {
                                    //    console.log(cached.sensors[i].real_track, " AFTER MTM 338")
                                    //}

                                    // if (stopsAfter - stopsBefore == 1) {
                                    //       //console.log("gid", cached.sensors[i].GID, "stops", cached.sensors[i].real_track);
                                    // }

                                }
                                break;
                            }
                        }
                    }
                }
                //console.log('Last cached data before', new Date(cashedDataArr[req.session.login].server_time * 1000));
                //cached.server_time = parseInt(Date.now() / 1000);
                //console.log('Last cached data after', new Date(cashedDataArr[req.session.login].server_time * 1000));

                log.toFLog('final_data.js', cached);

                res.status(200).json(data);
            });
    });

// получение треков по переданным стейтам
router.route('/gettracksbystates/')
    .post(function (req, res) {
        // проверяем все ли пользователи еще онлайн и если, кто-то "отпал", разблокируем его маршрут
        var timeNow = parseInt(Date.now() / 1000);
        for (var i = 0; i < onlineClients.length; i++) {
            if (onlineClients[i].time + 60 * 3 < timeNow) {
                unblockLogin(req.session.login);
                onlineClients.splice(i, 1);
                i--;
            }

        }

        // проверяем не заблокирован ли этот маршрут другим пользователемъ
        // Задача 1 найти этот роут в заблокированных
        var key = ""+req.session.login;
        var currentCompany = companyLogins[key];
        var i=0;
        var blocked=false;
        var dataB;
        //blockedRoutes.push({id:"168113", company:currentCompany, login:key});
        if (blockedRoutes.length==0){
            console.log("!!!! Create first element!!!!!!");
            blockedRoutes.push({id: '286111', company: '292942', login: 'IDS1.dsp', time: parseInt(Date.now() / 1000)});
        }

        while( i<blockedRoutes.length){
            if(blockedRoutes[i].id == req.body.id && blockedRoutes[i].company==currentCompany && ""+blockedRoutes[i].login != ""+req.session.login){
                console.log("Try accept blocked route");
                blocked=true;
                dataB = {
                    result: 'blocked',
                    user: blockedRoutes[i].login
                }
                break;
            }

            i++;
        }

        if(blocked) {
            res.status(200).json(dataB);
            return;
        } else {
            // заменяем блокировку, если таковая была или создаем новую, если это первое обращение этого логина
            i=0;
            var created=false;
            while(i<blockedRoutes.length){
                console.log ("Blocked logins",blockedRoutes[i].login , req.session.login);
                if(""+blockedRoutes[i].login == ""+req.session.login) {
                    console.log('Change blocked routes', blockedRoutes[i].id, req.body.id);
                    blockedRoutes[i].id=req.body.id;
                    created = true;
                    changePriority(req.body.id, currentCompany, req.session.login);

                    //var j = 0;
                    //while (j<blockedRoutes.length){
                    //    console.log("First", blockedRoutes[j]);
                    //    j++;
                    //}

                    break;
                }


                i++;
            }

            if(!created){
                var ts = parseInt(Date.now() / 1000);
                console.log("Не было такого логина! создаем");
                blockedRoutes.push({id: "" + req.body.id, company: currentCompany, login: key, time: ts});
                changePriority(req.body.id, currentCompany, req.session.login);
            }

            i=0;
            while (i<blockedRoutes.length){
                console.log("Second ", blockedRoutes[i]);
                i++;
            }


        }


        tracksManager.getTrackByStates(req.body.states, req.body.gid, req.body.demoTime, function (data) {

            res.status(200).json(data);
        });

        function unblockLogin(login) {
            console.log("Start unbloking");
            for (var i = 0; i < blockedRoutes.length; i++) {
                if ("" + blockedRoutes[i].login == "" + login) {
                    blockedRoutes.splice(i, 1);
                    break;
                }

            }

            var nowTime = parseInt(Date.now() / 1000);
            for (i = 0; i < blockedRoutes.length; i++) {
                if (blockedRoutes[i].time + 60 * 3 < nowTime) {
                    blockedRoutes.splice(i, 1);
                    i--;
                }

            }


        }

        function changePriority(id, company, login) {

            //Редактировался ли этот маршрут ранее.
            var exist = false;
            for (var i = 0; i < priority.length; i++) {
                if ("" + priority[i][0] == "" + id && priority[i][1] == company) {
                    exist = true;
                    for (j = 3; j < 6; j++) {
                        if (priority[i][j] == login) {
                            priority[i].splice(j, 1);
                            break;
                        }
                    }
                    priority[i].splice(3, 0, login);
                    priority[i][2] = parseInt(Date.now() / 1000);
                    priority[i].length = 6;
                    break;
                }
            }
            if (!exist) {
                priority.push([id, company, parseInt(Date.now() / 1000), login]);
            }

            for (i = 0; i < priority.length; i++) {
                console.log("PRIORITY", priority[i]);
            }

        }

    });

// получение планового трека с роутера между двумя точками
router.route('/findpath2p/:lat1&:lon1&:lat2&:lon2')
    .get(function (req, res) {
        console.log('=== router.route findpath ===');
        tracksManager.findPath(req.params.lat1, req.params.lon1, req.params.lat2, req.params.lon2,
            function (data) {
                res.status(200).json(data);
            });
    });

// получение планового времени проезда с роутера между двумя точками
router.route('/findtime2p/:lat1&:lon1&:lat2&:lon2')
    .get(function (req, res) {
        tracksManager.findTime(req.params.lat1, req.params.lon1, req.params.lat2, req.params.lon2,
            function (data) {
                res.status(200).json(data);
            });
    });

// пересчет маршрута на математике
router.route('/recalculate')
    .post(function (req, res) {
        math_server.recalculate(req.body.input, function (data) {
            console.log('MATH DATE >>', new Date());
            res.status(200).json(data);
        });
    });

// сохранение в 1С маршрута
router.route('/saveroute/')
    .post(function (req, res) {
        //console.log('saveroute, len', req.body.routes.length);
        var soapManager = new soap(req.session.login);
        soapManager.saveRoutesTo1C(req.body.routes, function (data) {
            if (!data.error) {
                res.status(200).json({result: data.result});
            } else {
                res.status(200).json({error: data.error});
            }
        });
    });



router.route('/existdata/')
    .post(function(req, res){
        var key = ""+req.session.login;
        var currentCompany = companyLogins[key];
        if(currentCompany in updateCacshe && req.body.date in updateCacshe[currentCompany]){
            res.status(200).json(updateCacshe[currentCompany][req.body.date]);
        } else {
            res.status(200).json([]);
        }


    });







router.route('/savewaypoint/')
    .post(function (req, res) {
        console.log("^^^^^^^^^ router ^^^^^^^^^");
        console.log('savewaypoint, req.bod', req.body);
        var soapManager = new soap(req.session.login);
        soapManager.updateWaypointCoordTo1C(req.body, function (data) {
            if (!data.error) {
                res.status(200).json({result: data.result});
            } else {
                res.status(200).json({error: data.error});
            }
        });
    });



//  прием измененных данных из мэп контроллера через поин индекс контроллер
// Если это первые данные, приняли и вернули ок.
// Если какие-то данные уже были, то мы их объединяем, перезаписывая ранее сохранненные точки свежими версиями и добавлением новых точек.
router.route('/saveupdate/')
    .post(function (req, res) {
        console.log('saveupdate');
        var key = ""+req.session.login;
        var currentCompany = companyLogins[key];
        res.status(200).json({status: 'ok'});
        if( !([currentCompany] in updateCacshe) ){
            updateCacshe[currentCompany] = {};
        }
        if( !( req.body.date in updateCacshe[currentCompany]) ){
            updateCacshe[currentCompany][req.body.date] = [];
            updateCacshe[currentCompany][req.body.date] = req.body;
        }else {
            // Полученные данные нужно объедеенить с существующими на данный момент, которые были получены ранее
            // так как иногда у стопа может быть id=0, который потом измениться, а TASK_NUMBER не уникальный, приходится создавать
            // новые параметры newID oldID и сравнивать по ним.
                var obj=req.body;
                var i=0;
                while (i<obj.data.length){
                    var exist=false;
                    var newID;
                    if(obj.data[i] && obj.data[i].id!=undefined) newID=""+obj.data[i].lat+obj.data[i].lon+obj.data[i].t1;
                    if(obj.data[i] && obj.data[i].TASK_NUMBER) newID=""+obj.data[i].TASK_NUMBER+obj.data[i].TASK_DATE;
                    var j=0;
                    //console.log("updateCacshe[req.session.login]", updateCacshe[req.session.login])
                    while(j<updateCacshe[currentCompany][req.body.date].data.length){
                        var oldID;
                        if(updateCacshe[currentCompany][req.body.date].data[j] && updateCacshe[currentCompany][req.body.date].data[j].id!=undefined) oldID=""+updateCacshe[currentCompany][req.body.date].data[j].lat+updateCacshe[currentCompany][req.body.date].data[j].lon+updateCacshe[currentCompany][req.body.date].data[j].t1;
                        if(updateCacshe[currentCompany][req.body.date].data[j] && updateCacshe[currentCompany][req.body.date].data[j].TASK_NUMBER) oldID=""+updateCacshe[currentCompany][req.body.date].data[j].TASK_NUMBER+updateCacshe[currentCompany][req.body.date].data[j].TASK_DATE;
                        if(newID==oldID){
                            //console.log("i=", i, "ID=", newID, 'j=', j, "oldID=", oldID);
                            updateCacshe[currentCompany][req.body.date].data[j]=obj.data[i];
                            exist=true;
                        }
                        j++;
                    }
                    if(!exist) {
                       // console.log("Adding new point/stop")
                        updateCacshe[currentCompany][req.body.date].data.push(obj.data[i])
                    }
                    delete newID;
                    i++;
                }
            updateCacshe[currentCompany][req.body.date] = req.body;

        }


        // if(  ([req.session.login] in updateCacshe) && (req.body.date in updateCacshe[req.session.login]) ){
        //     updateCacshe[req.session.login] = {};
        //     updateCacshe[req.session.login] = req.body;
        // }else{
        //     updateCacshe[req.session.login][req.body.date] = [];
        //     updateCacshe[req.session.login] = req.body;
        // }
        // res.status(200).json({status: 'ok'});


        //if(updateCacshe[req.session.login]==undefined || updateCacshe[req.session.login].length==0){

        // if( !(req.session.login in updateCacshe) ){
        //     updateCacshe[req.session.login] = {};
        // }
        // updateCacshe[req.session.login][req.body.date] = {};
        // updateCacshe[req.session.login][req.body.date] = JSON.parse(JSON.stringify(req.body));
        //
        // console.log(updateCacshe);
        //
        //     res.status(200).json({status: 'ok'});
        //     return;
        //
        //}
        //res.status(200).json({status: 'ok'});
        // Полученные данные нужно объедеенить с существующими на данный момент, которые были получены ранее
        // так как иногда у стопа может быть id=0, который потом измениться, а TASK_NUMBER не уникальный, приходится создавать
        // новые параметры newID oldID и сравнивать по ним.
    //     var obj=req.body;
    //     var i=0;
    //     while (i<obj.data.length){
    //         var exist=false;
    //         var newID;
    //         if(obj.data[i] && obj.data[i].id!=undefined) newID=""+obj.data[i].lat+obj.data[i].lon+obj.data[i].t1;
    //         if(obj.data[i] && obj.data[i].TASK_NUMBER) newID=""+obj.data[i].TASK_NUMBER+obj.data[i].TASK_DATE;
    //         var j=0;
    //         //console.log("updateCacshe[req.session.login]", updateCacshe[req.session.login])
    //         while(j<updateCacshe[req.session.login].data.length){
    //             var oldID;
    //             if(updateCacshe[req.session.login].data[j] && updateCacshe[req.session.login].data[j].id!=undefined) oldID=""+updateCacshe[req.session.login].data[j].lat+updateCacshe[req.session.login].data[j].lon+updateCacshe[req.session.login].data[j].t1;
    //             if(updateCacshe[req.session.login].data[j] && updateCacshe[req.session.login].data[j].TASK_NUMBER) oldID=""+updateCacshe[req.session.login].data[j].TASK_NUMBER+updateCacshe[req.session.login].data[j].TASK_DATE;
    //             if(newID==oldID){
    //                 //console.log("i=", i, "ID=", newID, 'j=', j, "oldID=", oldID);
    //                 updateCacshe[req.session.login].data[j]=obj.data[i];
    //                 exist=true;
    //             }
    //             j++;
    //         }
    //         if(!exist) {
    //            // console.log("Adding new point/stop")
    //             updateCacshe[req.session.login].data.push(obj.data[i])
    //         }
    //         delete newID;
    //         i++;
    //     }
    //
    });




// получение с роутера планового трека и времен проезда по всем маршрутам по логину в сессии
router.route('/routerdata')
    .get(function (req, res) {
        var key = ""+req.session.login;
        var currentCompany = companyLogins[key];
        var routeIndx = req.query.routeIndx,
            cData = cashedDataArr[currentCompany],
            sended = false,
            checkFunc = function (data, callback) {
                console.log('checkFunc', cData.routes[routeIndx].plan_geometry_loaded, cData.routes[routeIndx].time_matrix_loaded, !sended);
                if (cData.routes[routeIndx].plan_geometry_loaded && cData.routes[routeIndx].time_matrix_loaded && !sended) {
                    callback(data);
                }
            },
            callback = function (data) {
                sended = true;
                console.log('routerdata callback');
                res.status(200).json({
                    geometry: data.routes[routeIndx].plan_geometry,
                    time_matrix: data.routes[routeIndx].time_matrix
                });
            };

        console.log('routerdata', routeIndx);
        tracksManager.getRouterData(cData, routeIndx, -1, checkFunc, callback, true);
    });

// получение матрицы расстояний с роутера
router.route('/getroutermatrix/:points')
    .get(function (req, res) {
        console.log('getmatrix', req.params.points);
        tracksManager.getRouterMatrixByPoints(req.params.points, function (data) {
            res.status(200).json(data);
        });
    });

// открытие окна задачи в 1С IDS
router.route('/openidspointwindow/:pointId')
    .get(function (req, res) {
        console.log('openidspointwindow');
        var soapManager = new soap(req.session.login);
        soapManager.openPointWindow(req.session.login, req.params.pointId);
        res.status(200).json({status: 'ok'});
    });

// получение списка отмен
//router.route('/getreasonlist')
//    .get(function (req, res) {
//        var soapManager = new soap(req.session.login);
//        soapManager.getReasonList(function(data) {
//            res.status(200).json(data);
//        });
//    });

router.route('/closeday')
    .post(function (req, res) {
        if (req.session.login == null || req.session.login ==undefined) {
            res.status(401).json({status: 'Unauthorized'});
            return;
            //req.session.login = config.soap.defaultClientLogin;
        }

        var key = ""+req.session.login;
        var currentCompany = companyLogins[key];
        //console.log(req.body.closeDayData);
        console.log ("start working");
        var soapManager = new soap(req.session.login);
            soapManager.closeDay(req.body.closeDayData, function (data) {
                if (!data.error) {
                    res.status(200).json({result: data.result, closeCount:req.body.routesID.length, CloseDate:req.body.closeDayDate });
                    if(req.body.update) { // перезаписать сегодняшний день
                            closeRoutesUniqueID[currentCompany] = [];
                        console.log(req.body);
                        closeRoutesUniqueID[currentCompany] = JSON.parse(JSON.stringify(req.body.routesID));
                    }else {
                        if (currentCompany in oldRoutesCache && req.body.closeDayDate in oldRoutesCache[currentCompany]){
                            for (var i = 0; req.body.routesID.length > i; i++) {
                                for (var j = 0; oldRoutesCache[currentCompany][req.body.closeDayDate].routes.length > j; j++) {
                                    if (req.body.routesID[i] == oldRoutesCache[currentCompany][req.body.closeDayDate].routes[j]['uniqueID']) {
                                        oldRoutesCache[currentCompany][req.body.closeDayDate].routes.splice(j, 1);
                                        j--;
                                        console.log('CLOSEROUTE');
                                        break;
                                    }
                                }
                            }
                            if(oldRoutesCache[currentCompany][req.body.closeDayDate].routes.length == 0){
                                delete oldRoutesCache[currentCompany][req.body.closeDayDate];
                            }
                        }
                    }
                } else {
                    res.status(200).json({error: data.error});
                }
            });

    });







// логировать что-нибудь в БД
router.route('/log')
    .post(function (req, res) {
        db.logMessage(1, req.body.message, function (err, result) {
            res.status(200).json({error: err, result: result});
        });
    });

router.route('/test')
    .get(function (req, res) {
        console.log(req.session.login);
        res.status(200).json({sessionLogin: req.session.login});
    });


// догрузка стопов по маршруту на текущиймомент
router.route('/currentStops/:gid/:from/:to')
    .get(function (req, res) {
        console.log("Start load stops", req.session.login);
        tracksManager.getStops(req.params.gid,  req.params.from, req.params.to, function(rData){
           // console.log("rData", rData, "END rDAta, mtm 475");
            res.status(200).json(rData);
        });

    });


// получение всех таймматриц для всех роутов одним запросом.
router.route('/predicate/')
    .post(function (req, res) {

        var collection=req.body.collection;
        var j=0;
        var generalResult=[];  // преременная собирающая в себе все ответы

        while(j<collection.length){
            var pointsStr = '';
            for (var  i= 0; i < collection[j].points.length; i++) {
                if (collection[j].points[i].LAT != null && collection[j].points[i].LON != null) {
                    pointsStr += "&loc=" + collection[j].points[i].LAT + "," + collection[j].points[i].LON;
                }
            }
           // console.log(pointsStr);

            //запрос матрицы по одному маршруту с обработкой в колбэке.
            tracksManager.getRouterMatrixByPoints(pointsStr, function (data, pointsStr) {
                //console.log(pointsStr);
                var timeMatrix=[];
                var i=1;
                // выбор из всей матрицы только времени от первой точки(каррент позитион) ко всем остальным
                while(i<data.time_table[0].length){
                    timeMatrix.push(data.time_table[0][i][0]);
                    i++;
                }
                //Поиск ID к полученной матрице, на случай если ответы в колбеки придут асинхронно
                var indx;
                var temp=pointsStr.substring(5);
                var b=temp.indexOf("&");
                temp=temp.substring(0,b);
                var parts = temp.split(',');
                var LAT=parts[0];
                var LON=parts[1];
                //console.log(LAT, " ", LON);
                var k=0;
                while (k<collection.length){
                        if(LAT==collection[k].points[0].LAT && LON==collection[k].points[0].LON){
                        indx=collection[k].id;
                            //console.log("find id", indx);
                        break;
                    }
                    k++
                }
                generalResult.push({id:indx, time: timeMatrix});
                // Проверка не является ли этот колбек последним.
                if(generalResult.length==collection.length)
                {
                    //console.log("The cickle is finished RESULT LENGTH=", generalResult.length );
                    res.status(200).json(generalResult);
                    return;
                }
            });



            j++;
        }

    });

// получение треков по переданным стейтам
router.route('/changedriver/')
    .post(function (req, res) {
        //console.log('gettracksbystates ', req.body.routes[0], "MTM 750");
        //console.log("cashedDataArr[req.session.login]", cashedDataArr[req.session.login].routes, "MTM 751");
        // Перезапись в кеше маршрута отредактированного в мониторинге
        var i=0;
        req.body.routes[0].filterId=null;
        var key = ""+req.session.login;
        var currentCompany = companyLogins[key];
        while(i<cashedDataArr[currentCompany].routes.length){
            if(cashedDataArr[currentCompany].routes[i].uniqueID == req.body.routes[0].uniqueID){
                cashedDataArr[currentCompany].routes[i] = req.body.routes[0];
                cashedDataArr[currentCompany].routes[i].filterId=null;
                //console.log("Overwright Route");
                break;
            }


            i++;
        }

        //tracksManager.getTrackByStates(req.body.states, req.body.gid, req.body.demoTime, function (data) {
        //    console.log('get tracks by states DONE!');
        //    res.status(200).json(data);
        //});

        //Если произошло разделение маршрутов, нужно добавить новый к списку.
        if(req.body.routes[1] != undefined){
            req.body.routes[1].filterId=null;
            cashedDataArr[currentCompany].routes.push(req.body.routes[1]);
        }

        res.status(200).json("ok");

    });




router.route('/checknewiten')
    .get(function (req, res) {
        console.log("check New Iten in Progress");

        // присвоение лоина для прогрузки интерфейса при запуске вне окна  (для отладки)
        if (req.session.login == null || req.session.login == undefined) {
            console.log("Login", req.session.login);
            res.status(401).json({status: 'Unauthorized'});
            //req.session.login = config.soap.defaultClientLogin;
        }

        var key = ""+req.session.login;
        var currentCompany = companyLogins[key];
        var cache = cashedDataArr[currentCompany];
        var existIten = cashedDataArr[currentCompany].idArr.length;

        var soapManager = new soap(req.session.login);
        soapManager.getAdditionalDailyPlan(dataReadyCallback, req.query.showDate);


        function dataReadyCallback (quant){
            console.log("QUANT", quant, "req.session", cache.CLIENT_NAME, "____ ", cache.CLIENT_ID);
            //for (var key in cache){
            //    console.log ("key", key);
            //}


        }

            res.status(200).json("ok");
    });

router.route('/logout')
    .post(function (req, res) {
        console.log("!!!!!!!!!!LOGOUT!!!!!!!", req.session.login);
        var i=0;
        while(i<blockedRoutes.length){
            if( ""+blockedRoutes[i].login == ""+req.session.login){
                console.log("$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$", req.session.login, "logouting");
                blockedRoutes.splice(i,1);
                break;
            }

            i++;
        }

        i=0;
        while(i<blockedRoutes.length){
            console.log("Third blocking", blockedRoutes[i]);
            i++;
        }
        console.log("Logout complete");
        res.status(200).json("ok");

    });


router.route('/askforproblems')
    .get(function (req, res) {

        var key = "" + req.session.login;
        var currentCompany = companyLogins[key];
        console.log("ASk For Problem", req.session.login);
        var result = cashedDataArr[currentCompany];
        res.status(200).json(result);

    });


//Каждую минуту клиент подтверждает на сервер, что он online
// Если такого подтверждения нет более 3 минут, считаем, что юзер закрыл клиент
router.route('/confirmonline')
    .get(function (req, res) {
        console.log("online confirmed", req.session.login);
        var key = ""+req.session.login;
        var currentCompany = companyLogins[key];
        if (onlineClients.length == 0) {
            var obj = {time: parseInt(Date.now() / 1000), login: req.session.login, company: currentCompany};
            onlineClients.push(obj);
            return;
        }


        var exist = false;
        for (var i = 0; i < onlineClients.length; i++) {
            if (onlineClients[i].login == req.session.login) {
                onlineClients[i].time = parseInt(Date.now() / 1000);
                exist = true;
                break;
            }

        }
        if (!exist) {
            var obj = {time: parseInt(Date.now() / 1000), login: req.session.login, company: currentCompany};
            onlineClients.push(obj);
        }

        for (var i = 0; i < onlineClients.length; i++) {
            console.log("Online now", onlineClients[i]);

        }

        res.status(200).json("ok");

    });





// TODO
// TODO Ниже функции  сервера данных. Выше роутер.
var temp1,   //Тестовые переменные для отладки
    startTime,
    middleTime,
    endTime,
    temp2,

    temp3;

function getTstampAvailabilityWindow(strWindows, currentTime) {
    if (!strWindows) {
        return;
    }

    var windows = strWindows.split(' ; '),
        resWindows = [];

    for (var i = 0; i < windows.length; i++) {
        var parts = windows[i].split(' '),
            timeStart = parts[0].split(':'),
            timeFinish = parts[2].split(':'),
            startDate = new Date(currentTime * 1000),
            finishDate = new Date(currentTime * 1000);

        startDate.setHours(timeStart[0]);
        startDate.setMinutes(timeStart[1]);

        finishDate.setHours(timeFinish[0]);
        finishDate.setMinutes(timeFinish[1]);

        resWindows.push({
            start: parseInt(startDate.getTime() / 1000),
            finish: parseInt(finishDate.getTime() / 1000)
        });
    }

    return resWindows;
}



// Функция вытягивающая ФИО водителя из его карточки.
function cutFIO(fioStr) {
    fioStr = fioStr.replace(/_/g, " ");
    var parts = fioStr.split(' ');
    return ( (parts[0]) ? parts[0] + ' ' : "" ) + ( (parts[1]) ? parts[1] : "" );

}

// Перевод строковой даты в таймстамп
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

function linkDataParts (currentCompany, login)
{
//Добавление нового пользователь online, если его раньше не было
    var exist = false;
    for (var i=0; i<onlineClients.length;i++){
        if(onlineClients[i].login == login) {
            onlineClients[i].time = parseInt(Date.now() / 1000);
            exist=true;
        }
    }

    if(!exist){
        onlineClients.push({time: parseInt(Date.now() / 1000), login: login, company: currentCompany});
    }

// Сбор общего решения из полученных кусков
    var tmpPoints,
        rowId = 0,
        routeId = 0,
        len = 0,
        tPoint,
        roundingNumb = 300,         // шаг округления обещанных окон
        branchIndx,
        tmpTaskNumber = -1;

    cashedDataArr[currentCompany].firstLogin=login;

    //var soapManager = new soap(login);
    //soapManager.getNewConfig(login, function (data) {
    //    console.log("receiveConfig", data);
    //    var obj = JSON.parse(data.return);
    //    console.log("Obj",  obj.predictMinutes, "mtm 1192")
    //});




    for (i = 0; i < cashedDataArr[currentCompany].sensors.length; i++) {
        for (var j = 0; j < cashedDataArr[currentCompany].transports.length; j++) {
            if (cashedDataArr[currentCompany].sensors[i].TRANSPORT == cashedDataArr[currentCompany].transports[j].ID) {
                cashedDataArr[currentCompany].transports[j].gid = cashedDataArr[currentCompany].sensors[i].GID;
                cashedDataArr[currentCompany].transports[j].real_track = cashedDataArr[currentCompany].sensors[i].real_track;
            }
        }
    }


    for (i = 0; i < cashedDataArr[currentCompany].routes.length; i++) {
        if (cashedDataArr[currentCompany].routes[i].moreThanOneSensor) cashedDataArr[currentCompany].currentProblems.push([cashedDataArr[currentCompany].routes[i], 'Более одного сенсора']);

        ////TODO: get real branch office
        cashedDataArr[currentCompany].routes[i].branch = cashedDataArr[currentCompany].BRANCH;
        //i % 2 == 0 ? 'Киев ТЕСТ' : 'Одесса ТЕСТ';

        //for (var j = 0; j < scope.filters.branches.length; j++) {
        //    if (scope.filters.branches[j].name == data.routes[i].branch) {
        //        branchIndx = scope.filters.branches[j].value;
        //        break;
        //    }
        //    else if (j == scope.filters.branches.length - 1) {
        //        scope.filters.branches.push({
        //            name: data.routes[i].branch,
        //            value: scope.filters.branches.length
        //        });
        //        branchIndx = scope.filters.branches.length - 1;
        //    }
        //}
        //
        //// назначение машин и реальных треков на маршруты
        for (j = 0; j < cashedDataArr[currentCompany].transports.length; j++) {
            if (cashedDataArr[currentCompany].routes[i].TRANSPORT == cashedDataArr[currentCompany].transports[j].ID) {
                cashedDataArr[currentCompany].routes[i].transport = cashedDataArr[currentCompany].transports[j];
                cashedDataArr[currentCompany].routes[i].real_track = cashedDataArr[currentCompany].transports[j].real_track;

                if (cashedDataArr[currentCompany].transports[j].real_track != undefined &&
                    cashedDataArr[currentCompany].routes[i].real_track.length > 0 &&
                    cashedDataArr[currentCompany].routes[i].real_track != aggregatorError) {
                    var len = cashedDataArr[currentCompany].routes[i].real_track.length - 1;
                    cashedDataArr[currentCompany].routes[i].car_position = cashedDataArr[currentCompany].routes[i].real_track[len]; // определение текущего положения машины
                    //console.log('data.routes[i]', data.routes[i]);
                    if (typeof (cashedDataArr[currentCompany].routes[i].real_track) == Array) {
                        cashedDataArr[currentCompany].routes[i].real_track.splice(len, 1);
                    } // удаление стейта с текущим положением машины
                }
                break;
            }
        }
        //
        //// назначение маршрутам водитилей
        for (j = 0; j < cashedDataArr[currentCompany].drivers.length; j++) {
            if (cashedDataArr[currentCompany].routes[i].DRIVER == cashedDataArr[currentCompany].drivers[j].ID) {
                cashedDataArr[currentCompany].drivers[j].NAME = cutFIO(cashedDataArr[currentCompany].drivers[j].NAME);
                cashedDataArr[currentCompany].routes[i].driver = cashedDataArr[currentCompany].drivers[j];
                break;
            }
        }
        //if(j == data.drivers.length){
        //    console.log(data.routes[i].DRIVER);
        //}
        //
        //
        //// если у маршрута нет машины или водителя - удаляем маршрут
        if (!cashedDataArr[currentCompany].routes[i].transport) {
            cashedDataArr[currentCompany].routes.splice(i, 1);
            cashedDataArr[currentCompany].currentProblems.push([cashedDataArr[currentCompany].routes[i], 'Нет машины']);
            i--;
            continue;
        }
        //
        tmpPoints = cashedDataArr[currentCompany].routes[i].points;
        for (j = 0; j < tmpPoints.length; j++) {
            tPoint = tmpPoints[j];
            tPoint.branchIndx = branchIndx;
            tPoint.branchName = cashedDataArr[currentCompany].routes[i].branch;
            tPoint.driver = cashedDataArr[currentCompany].routes[i].driver;
            tPoint.in_plan = true;

            // если нет номера задачи, ставим отрицательный номер
            if (!tPoint.TASK_NUMBER) {
                tPoint.TASK_NUMBER = tmpTaskNumber;
                tmpTaskNumber--;
            }
            //
            //
            //    //тестово отладочный блок

            //
            if (cashedDataArr[currentCompany].routes[i].filterId == null) {
                cashedDataArr[currentCompany].routes[i].filterId = routeId;

                //TODO REMOVE AFTER TESTING
                //data.routes[i].transport = data.routes[0].transport;
                //data.server_time = 1446611800;
                ///////////////////////////

                cashedDataArr[currentCompany].allRoutes.push({
                    //name: data.routes[i].transport.NAME,

                    allRoutes: false,

                    nameDriver: ( ( cashedDataArr[currentCompany].routes[i].hasOwnProperty('driver') && cashedDataArr[currentCompany].routes[i].driver.hasOwnProperty('NAME') ) ? cashedDataArr[currentCompany].routes[i].driver.NAME : 'без имени') + ' - ' + cashedDataArr[currentCompany].routes[i].transport.NAME,
                    nameCar: cashedDataArr[currentCompany].routes[i].transport.NAME + ' - ' + ( ( cashedDataArr[currentCompany].routes[i].hasOwnProperty('driver') && cashedDataArr[currentCompany].routes[i].driver.hasOwnProperty('NAME') ) ? cashedDataArr[currentCompany].routes[i].driver.NAME : 'без имени'),

                    value: cashedDataArr[currentCompany].routes[i].filterId,
                    uniqueID: cashedDataArr[currentCompany].routes[i].uniqueID,


                    car: cashedDataArr[currentCompany].routes[i].transport.NAME,
                    driver: ( cashedDataArr[currentCompany].routes[i].hasOwnProperty('driver') && cashedDataArr[currentCompany].routes[i].driver.hasOwnProperty('NAME') ) ? cashedDataArr[currentCompany].routes[i].driver.NAME : 'без имени' + i //!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!добавили свойство driver для события в closeDriverName
                });
                //  console.log(scope.filters.routes, ' filters.routes');
                routeId++;
            }


            try {
                tPoint.route_indx = cashedDataArr[currentCompany].routes[i].filterId;
                tPoint.transport = cashedDataArr[currentCompany].routes[i].transport;

                if (cashedDataArr[currentCompany].routes[i].DISTANCE == 0) {
                    //console.log("The route is UNCALCULATE");


                    //Для непосчитанных маршрутов время прибытия считается границей окна доступности
                    tPoint.arrival_time_hhmm = tPoint.AVAILABILITY_WINDOWS.slice(-5) + ":00";

                    // Костыль. Когда в утвержденные маршруты попадает точка с неуказанным временем прибытия
                    if (tPoint.ARRIVAL_TIME.length < 1) {
                        tPoint.ARRIVAL_TIME = cashedDataArr[currentCompany].routes[i].points[j - 1].ARRIVAL_TIME;
                    }
                    var toDay = tPoint.ARRIVAL_TIME.substr(0, 10);

                    tPoint.base_arrival = toDay + " " + tPoint.arrival_time_hhmm;

                    tPoint.arrival_time_ts = strToTstamp(toDay + " " + tPoint.arrival_time_hhmm);
                    tPoint.base_arrival_ts = strToTstamp(toDay + " " + tPoint.arrival_time_hhmm);


                    tPoint.controlled_window = {
                        start: tPoint.arrival_time_ts - controlledWindow,
                        finish: tPoint.arrival_time_ts + controlledWindow
                    };

                    tPoint.end_time_hhmm = tPoint.AVAILABILITY_WINDOWS.slice(-5) + ":00";
                    tPoint.end_time_ts = strToTstamp(toDay + " " + tPoint.arrival_time_hhmm);

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
               // console.log("route", cashedDataArr[currentCompany].routes[i].points[0] );
            }
            //
            //
            tPoint.NUMBER = parseInt(tPoint.NUMBER);
            tPoint.row_id = rowId;
            tPoint.arrival_prediction = 0;
            tPoint.arrival_left_prediction = 0;
            tPoint.status = 7;

            tPoint.route_id = i;
            rowId++;

            tPoint.windows = getTstampAvailabilityWindow(tPoint.AVAILABILITY_WINDOWS, cashedDataArr[currentCompany].server_time);
            // создание обещанных окон
            if (tPoint.promised_window == undefined && tPoint.windows != undefined) {
                //console.log("Create PROMISED WINDOW step1");

                for (var k = 0; k < tPoint.windows.length; k++) {
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
            //
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
            //
            //    // копируем обещанное окно без ссылок
            if (tPoint.promised_window_changed == undefined) {
                //console.log("Create PROMISED WINDOW step3");
                tPoint.promised_window_changed = JSON.parse(JSON.stringify(tPoint.promised_window));
            }


            //TODO Сделать определение на какое окно ровняться (обещанное или заказанное), получив настройки из 1С
            // TODO пока делаем workingWindowType 1





            var workingWindowType = cashedDataArr[currentCompany].settings.workingWindowType;

            //console.log("Ищем ошибку в роуте", cashedDataArr[currentCompany].routes[i].driver.NAME);

            if (workingWindowType == 0) {
                for (var k = 0; tPoint.windows != undefined && k < tPoint.windows.length; k++) {
                    //console.log("Create PROMISED WINDOW step4");
                    if (tPoint.windows[k].finish + 120 > tPoint.arrival_time_ts &&
                        tPoint.windows[k].start - 120 < tPoint.arrival_time_ts) {
                        tPoint.working_window = tPoint.windows[k];
                    }
                }

                if (tPoint.working_window == undefined) tPoint.working_window = tPoint.promised_window_changed;
            } else if (workingWindowType == 1) {
                tPoint.working_window = tPoint.promised_window_changed;
            }

        }

        //console.log(cashedDataArr[currentCompany].currentProblems, "Problems 485");

    }

    console.log("FINISHING LINKING");

}


// Каждые две минуты стартует расчет, которые проходит по всем решениям, которые сейчас присутствуют в кэше
function startPeriodicCalculating() {
    console.log("Начинаем периодический рассчет");
    var superEndTime = parseInt(Date.now()/1000); //TODO условный замер времени на 1 компании можно убивать, но вместе с парой, которая отмеряет финиш
    // Создаем список компаний, по которым нужно провести пересчет
    var companysToCalc=[];
    for(var company in cashedDataArr) {
        companysToCalc.push(company);
    }

    // Удаляем из списка компаний те, пользователи которых, не находятся online
    for(var i=0; i<companysToCalc.length; i++){
        if (!checkOnline(companysToCalc[i])){
            console.log("Нет пользователей онлайн");
            companysToCalc.splice(i,1);
            i--;
        }
    }

    for(i=0; i<companysToCalc.length; i++){
            console.log("Компания на пересчет", companysToCalc[i]);
    }

    callbackDispetcher(companysToCalc);



    function callbackDispetcher(companys) {
        for (var k=0; k<companys.length; k++) {

            cashedDataArr[companys[k]].needRequests = cashedDataArr[companys[k]].idArr.length*3; // Количество необходимых запрсов во внешний мир. Только после получения всех ответов, можно запускать пересчет *3 потому что мы просим пушиб треки и данные для предсказания
        for (var itenQuant=0; itenQuant<cashedDataArr[companys[k]].idArr.length; itenQuant++) {
                    var iten = cashedDataArr[companys[k]].idArr[itenQuant];
                    var soapManager = new soap(cashedDataArr[companys[k]].firstLogin);
                    soapManager.getPushes(iten, parseInt(Date.now() / 1000), companys[k], function (company, data) {
                        //console.log("receivePUSHES", data);
                        var obj = JSON.parse(data.return);
                        //console.log("Obj", obj[0], "mtm 1497");
                        //delete cashedDataArr[company].allPushes;
                        cashedDataArr[company].allPushes=obj;
                        cashedDataArr[company].needRequests--;
                        console.log("GetPushes finished for company", company, cashedDataArr[company].needRequests);
                        if(cashedDataArr[company].needRequests == 0) startCalculateCompany(company);
                    });
            //

                       dataForPredicate(company)
            //        //TODO Заменить на запрс свежих стейтов и треков
                    soapManager.getNewConfig(companys[k], function (company, data) {
                        //console.log("receiveConfig", data);
                        var settings = JSON.parse(data.return);
                        //console.log("Obj",  obj.predictMinutes, "mtm 1192")
                        cashedDataArr[company].needRequests --;
                        console.log("GetConfig finished for company", company, cashedDataArr[company].needRequests);
                        if(cashedDataArr[company].needRequests == 0) startCalculateCompany(company);
                    });
            //



                    function startCalculateCompany(company) {
                        console.log("Все данные получены, пересчитали компанию", company);
                        connectPointsAndPushes(company);
                        connectStopsAndPoints(company);
                        predicateTime(company);
                        findStatusesAndWindows(company);
                        calculateProblemIndex(company);
                        calculateStatistic (company);
                        createProblems(company)


                    }



                    function connectPointsAndPushes(company) {
                        console.log("Start connectPointsAndPushes", company);
                        var mobilePushes = cashedDataArr[company].allPushes;

                        checkPushesTimeGMTZone(mobilePushes, cashedDataArr[company].CLIENT_NAME);

                        for (var i=0; i<cashedDataArr[company].routes.length; i++){
                            cashedDataArr[company].routes[i].pushes=[];
                        }

                        for (i = 0; i<mobilePushes.length;i++){
                            if (mobilePushes[i].gps_time == 0 ||
                                (mobilePushes[i].lat == 0 && mobilePushes[i].lon == 0) ||
                                 mobilePushes.gps_time > parseInt(Date.now()/1000)
                            ) continue;


                            if (mobilePushes[i].canceled) continue; //TODO написать функцию обработки пуша-отмены

                            for (var j = 0; j < cashedDataArr[company].routes.length; j++) {


                                for (var k = 0; k < cashedDataArr[company].routes[j].points.length; k++) {
                                    var tmpPoint = cashedDataArr[company].routes[j].points[k];
                                    var LAT = parseFloat(tmpPoint.LAT);
                                    var LON = parseFloat(tmpPoint.LON);
                                    var lat = mobilePushes[i].lat;
                                    var lon = mobilePushes[i].lon;

                                    // каждое нажатие проверяем с каждой точкой в каждом маршруте на совпадение номера задачи
                                    if (mobilePushes[i].number == tmpPoint.TASK_NUMBER) {
                                        //console.log("FIND PUSH ", mobilePushes[i], "for Waypoint", tmpPoint );

                                        tmpPoint.mobile_push = mobilePushes[i];
                                        tmpPoint.mobile_arrival_time = mobilePushes[i].gps_time_ts;
                                        mobilePushes[i].distance = getDistanceFromLatLonInM(lat, lon, LAT, LON);
                                        // если нажатие попадает в радиус заданный в настройках, нажатие считается валидным
                                        // Для большей захвата пушей, их радиус увеличен в 2 раза по сравнению с расстоянием до стопа
                                        if (mobilePushes[i].distance <= cashedDataArr[company].settings.mobileRadius) {
                                            tmpPoint.havePush = true;



                                            //Пока нет валидного времени с GPS пушей, закомментируем следующую строку
                                            tmpPoint.real_arrival_time = tmpPoint.real_arrival_time || mobilePushes[i].gps_time_ts;

                                            // если точка уже подтверждена или у неё уже есть связанный стоп - она считается подтвержденной
                                            tmpPoint.confirmed = tmpPoint.confirmed || tmpPoint.haveStop;

                                            cashedDataArr[company].routes[j].lastPointIndx = k > cashedDataArr[company].routes[j].lastPointIndx ? k : cashedDataArr[company].routes[j].lastPointIndx;
                                           // cashedDataArr[company].routes[j].pushes = cashedDataArr[company].routes[j].pushes || [];
                                            if (mobilePushes[i].gps_time_ts < parseInt(Date.now()/1000)) {
                                                cashedDataArr[company].routes[j].pushes.push(mobilePushes[i]);
                                            }

                                            break;
                                        } else {
                                           // cashedDataArr[company].routes[j].pushes =  cashedDataArr[company].routes[j].pushes || [];
                                            if (mobilePushes[i].gps_time_ts < parseInt(Date.now()/1000)) {
                                                tmpPoint.havePush = true;
                                                mobilePushes[i].long_away = true;
                                                cashedDataArr[company].routes[j].pushes.push(mobilePushes[i]);
                                            }
                                            //console.log('>>> OUT of mobile radius');
                                        }
                                    }
                                }
                            }

                        }


                    }

                    function connectStopsAndPoints(company) {
                        console.log("Start connectStopsAndPushes");
                        for (i = 0; i < cashedDataArr[company].routes.length; i++) {
                           var route = cashedDataArr[company].routes[i];
                            //console.log ("route.driver.name", route.driver.NAME);
                            route.lastPointIndx = 0;
                            if (route.real_track != undefined) {
                                for (var j = 0; j < route.real_track.length; j++) {
                                    // если статус не из будущего (в случае демо-режима) и стейт является стопом, b dhtvz проверяем его
                                    if (route.real_track[j].t1 < parseInt(Date.now()/1000) && route.real_track[j].state == "ARRIVAL") {
                                        //console.log("считаем стоп", _data.server_time, route.real_track[j].t1, _data.server_time-route.real_track[j].t1)



                                        var tmpArrival = route.real_track[j];

                                        //console.log("tmpArrival",tmpArrival);
                                        // перебираем все точки к которым
                                        for (var k = 0; k < route.points.length; k++) {




                                          var  tmpPoint = route.points[k];


                                             cashedDataArr[company].settings.limit != undefined ? cashedDataArr[company].settings.limit : cashedDataArr[company].settings.limit = 74;

                                            if(tmpPoint.confirmed_by_operator == true || tmpPoint.limit > cashedDataArr[company].settings.limit){
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





                                            var LAT = parseFloat(tmpPoint.LAT);
                                            var LON = parseFloat(tmpPoint.LON);
                                            var lat = parseFloat(tmpArrival.lat);
                                            var lon = parseFloat(tmpArrival.lon);

                                            tmpPoint.distanceToStop = tmpPoint.distanceToStop || 2000000000;
                                            tmpPoint.timeToStop = tmpPoint.timeToStop || 2000000000;

                                            var tmpDistance = getDistanceFromLatLonInM(lat, lon, LAT, LON);

                                            var tmpTime = Math.abs(tmpPoint.arrival_time_ts - tmpArrival.t1);






                                            // Если маршрут не просчитан, отдельно проверяем попадает ли стоп в одно из возможных временных окон  и насколько он рядом
                                            // и если да, то тоже привязываем стоп к точке

                                            var suit=false;   //Показывает совместимость точки и стопа для непросчитанного маршрута
                                            if (route.DISTANCE == 0 && tmpDistance < cashedDataArr[company].settings.stopRadius ) {
                                                suit=checkUncalculateRoute(tmpPoint, tmpArrival, company);
                                            }

                                            // если стоп от точки не раньше значения timeThreshold и в пределах
                                            // заданного в настройках радиуса, а так же новый детект ближе по расстояение и
                                            // по времени чем предыдущий детект - привязываем этот стоп к точке



                                            if (suit || (tmpPoint.arrival_time_ts < tmpArrival.t2 + cashedDataArr[company].settings.timeThreshold &&
                                                tmpDistance < cashedDataArr[company].settings.stopRadius && (tmpPoint.distanceToStop > tmpDistance &&
                                                tmpPoint.timeToStop > tmpTime))) {

                                               var haveUnfinished = false;



                                                if (tmpPoint.NUMBER !== '1' && tmpPoint.waypoint != undefined && tmpPoint.waypoint.TYPE === 'WAREHOUSE') {
                                                    for (var l = k - 1; l > 0; l--) {
                                                        var status = route.points[l].status;
                                                        if (status > 3 && status != 6)
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
                                                if(tmpPoint.haveStop == true && !findBestStop(tmpPoint, tmpArrival)){
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

                                                //if (angular.isUndefined(tmpArrival.servicePoints)==true){
                                                //    tmpArrival.servicePoints=[];
                                                //}

                                               if(tmpArrival.servicePoints == undefined) { tmpArrival.servicePoints=[]};

                                                // проверка, существует ли уже этот стоп
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



                                            }


                                        }
                                    }

                                }


                                // console.log("PRE Last point for route ", route.ID, " is ", route.points[route.lastPointIndx].NUMBER);
                                var lastPoint = route.points[route.lastPointIndx];
                                // console.log("POST Last point for route ", route.ID, " is ", lastPoint.NUMBER);

                                // проверка последней определенной точки на статус выполняется
                                if (lastPoint != null && route.car_position !=  undefined) {
                                    // console.log("Route", route);
                                    if (lastPoint.arrival_time_ts + parseInt(lastPoint.TASK_TIME) > parseInt(Date.now()/1000)
                                        && getDistanceFromLatLonInM(route.car_position.lat, route.car_position.lon,
                                            lastPoint.LAT, lastPoint.LON) < cashedDataArr[company].stopRadius) {
                                        lastPoint.status = 3;
                                    }
                                }
                            }

                            // console.log("Last point for route", route.ID, _data.routes[i].ID, " is ", route.lastPointIndx, lastPoint.NUMBER );

                        }


                    }

                    function predicateTime(company) {
                        console.log("Start predicateTime");
                        for (i=0; i< cashedDataArr[company].routes.length; i++){
                            var route = cashedDataArr[company].routes[i];
                            if (route.DISTANCE == 0) {
                                uncalcPredication(route, company);
                            } else {
                                calcPredication(route, company);
                            }


                        }
                    }

                    function findStatusesAndWindows(company) {
                        console.log("Start findStatusesAndWindows");
                        var tmpPoint;

                        for(var i=0; i<cashedDataArr[company].routes.length; i++ ) {
                            //console.log("1");
                            for (var j=0; j<cashedDataArr[company].routes[i].points.length; j++) {
                                //console.log("2");

                                tmpPoint = cashedDataArr[company].routes[i].points[j];

                                if (tmpPoint.real_arrival_time == undefined) continue;
                                //считаем окна только для доставленного
                                //if (tmpPoint.status > 3 && tmpPoint.status != 6) continue;

                                tmpPoint.windowType = 'Вне окон';
                                if (tmpPoint.promised_window_changed.start < tmpPoint.real_arrival_time
                                    && tmpPoint.promised_window_changed.finish > tmpPoint.real_arrival_time) {
                                    tmpPoint.windowType = 'В заказанном';
                                    //console.log('В заказанном')
                                } else {
                                    for (var l = 0; tmpPoint.windows != undefined && l < tmpPoint.windows.length; l++) {
                                        if (tmpPoint.windows[l].start < tmpPoint.real_arrival_time
                                            && tmpPoint.windows[l].finish > tmpPoint.real_arrival_time) {
                                            tmpPoint.windowType = 'В обещанном';
                                            //console.log('В обещанном');
                                            break;
                                        }
                                    }
                                }

                                if (tmpPoint.rawConfirmed !== -1) {
                                    if (tmpPoint.real_arrival_time > tmpPoint.working_window.finish) {
                                        tmpPoint.status = 1;
                                    } else if (tmpPoint.real_arrival_time < tmpPoint.working_window.start) {
                                        tmpPoint.status = 2;
                                    } else {
                                        tmpPoint.status = 0;
                                    }
                                } else {

                                }


                                //корректировка достоверности статусов по процентам.
                                tmpPoint.limit = 0;
                                if (tmpPoint.confirmed_by_operator) {
                                    tmpPoint.limit = 100;
                                    return;
                                }
                                if (tmpPoint.haveStop) {
                                    tmpPoint.limit = 45;

                                    if (tmpPoint.stopState.t1 < tmpPoint.promised_window_changed.finish && tmpPoint.stopState.t1 > tmpPoint.promised_window_changed.start) {
                                        tmpPoint.limit = 60;
                                    }

                                }

                                if (tmpPoint.havePush) {
                                    tmpPoint.limit += 15;
                                    if (tmpPoint.stopState != undefined && tmpPoint.mobile_push.gps_time_ts < tmpPoint.stopState.t2 + 300 && tmpPoint.mobile_push.gps_time_ts > tmpPoint.stopState.t1) {
                                        tmpPoint.limit += 15;
                                    }
                                }

                                if (tmpPoint.limit > 0 && tmpPoint.limit < 74) {
                                    tmpPoint.status = 6;
                                    tmpPoint.problem_index = 1;
                                    //console.log("tmpPoint.problem_index", tmpPoint.problem_index);
                                }
                            }

                        }


                    }


                    function calculateProblemIndex(company) {
                        console.log("Start calculate ProblemIndx");
                    }

                    function calculateStatistic (company){
                        console.log("Start calculate Statistic");
                        var indx;
                        cashedDataArr[company].statistic=[];
                        for (var i=0; i<9; i++) {
                            cashedDataArr[company].statistic.push(0);
                        }


                        for (i=0; i<cashedDataArr[company].routes.length; i++){
                            for (var j=0; j<cashedDataArr[company].routes[i].points.length;j++){
                                indx=parseInt(cashedDataArr[company].routes[i].points[j].status);
                                cashedDataArr[company].statistic[indx]++;
                            }
                        }


                    }

                    function createProblems(company) {
                        console.log("Start createProblems Конец рассчета, который занял", parseInt(Date.now()/1000)-superEndTime);

                    }



            }
        }
    }
}


function dataForPredicate(company){
    var result=[];
    var i=0;
    while(i<cashedDataArr[company].routes.length) {

        var route=cashedDataArr[company].routes[i];


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

    var j=0;
    var generalResult=[];  // преременная собирающая в себе все ответы
        var collection = result;

    while(j<collection.length){
        var pointsStr = '';
        for (var  i= 0; i < collection[j].points.length; i++) {
            if (collection[j].points[i].LAT != null && collection[j].points[i].LON != null) {
                pointsStr += "&loc=" + collection[j].points[i].LAT + "," + collection[j].points[i].LON;
            }
        }
        // console.log(pointsStr);

        //запрос матрицы по одному маршруту с обработкой в колбэке.
        tracksManager.getRouterMatrixByPoints(pointsStr, function (data, pointsStr) {
            //console.log(pointsStr);
            var timeMatrix=[];
            var i=1;
            // выбор из всей матрицы только времени от первой точки(каррент позитион) ко всем остальным
            while(i<data.time_table[0].length){
                timeMatrix.push(data.time_table[0][i][0]);
                i++;
            }
            //Поиск ID к полученной матрице, на случай если ответы в колбеки придут асинхронно
            var indx;
            var temp=pointsStr.substring(5);
            var b=temp.indexOf("&");
            temp=temp.substring(0,b);
            var parts = temp.split(',');
            var LAT=parts[0];
            var LON=parts[1];
            //console.log(LAT, " ", LON);
            var k=0;
            while (k<collection.length){
                if(LAT==collection[k].points[0].LAT && LON==collection[k].points[0].LON){
                    indx=collection[k].id;
                    //console.log("find id", indx);
                    break;
                }
                k++
            }
            generalResult.push({id:indx, time: timeMatrix});
            // Проверка не является ли этот колбек последним.
            if(generalResult.length==collection.length)
            {
                console.log("The cickle is finished RESULT LENGTH=", generalResult.length );
                cashedDataArr[company].dataForPredicate=generalResult;
                cashedDataArr[company].needRequests --;
                //res.status(200).json(generalResult);
                return;
            }
        });



        j++;
    }









    //http.post('./predicate', {
    //    collection: result
    //})
    //    .success(function (data) {
    //        console.log("Additional load COMPLETE", {data: data});
    //        //predicateArrivalSecond (data);
    //        cashedDataArr[company].needRequests --;
    //
    //    }).error(function(err){
    //        console.log(err);
    //
    //    });
}



function uncalcPredication(route, company) {


    var now = parseInt(Date.now()/1000);


    var time_table = [];
    var points = route.points;

    var k = 0;
    while (k < cashedDataArr[company].dataForPredicate.length) {
        //console.log("Start serch", route.uniqueID, data[k].id );
        if (route.uniqueID == cashedDataArr[company].dataForPredicate[k].id) {
            //  console.log("find Time_Table");
            time_table = cashedDataArr[company].dataForPredicate[k].time;
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

        }
        i++;
    }


}


function calcPredication(route, company) {

    //console.log("This is calculated route");

    var point,
        tmpPred,
        now = _data.server_time;



    if (route.points[route.lastPointIndx]) {


        point = route.car_position;


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

        if (route.real_track != undefined) {
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
            if (j <= lastPoint || route.real_track == undefined) {
                // все точки до последней выполненной проверяются по факту
                //console.log("Try to change status for point", _route.points[j] );


                route.points[j].arrival_prediction = 0;
                route.points[j].overdue_time = 0;
                if (route.points[j].status == 7) {
                    if (now > route.points[j].working_window.finish) {
                        //!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! Проверить расчет working window
                        //console.log("NOW=", now, "working_window.finish=", _route.points[j].working_window.finish, " controlled_window", _route.points[j].controlled_window.finish);
                        route.points[j].status = 7;

                        //console.log("_route.points[j].status = STATUS.TIME_OUT;", _route.points[j]);
                        route.points[j].overdue_time = now - route.points[j].arrival_time_ts;
                    }
                } else if (route.points[j].status == 3) {
                    totalWorkTime = parseInt(route.points[j].TASK_TIME) - (now - route.points[j].real_arrival_time);
                }
            } else {
                // точки ниже последней выполненной считаются ниже
                //  console.log (j, "Point for Route", route);
                tmpTime = route.time_matrix.time_table[0][j - 1][j];
                // времена проезда от роутера приходят в десятых долях секунд
                totalTravelTime += tmpTime == undefined ? 15 * 60 : parseInt(tmpTime / 10);
                tmpPred = now + nextPointTime + totalWorkTime + totalTravelTime + totalDowntime;
                tmpDowntime = route.points[j].working_window.start - tmpPred;
                if (tmpDowntime > 0) {
                    totalDowntime += tmpDowntime;
                    tmpPred = route.points[j].working_window.start;
                }


                route.points[j].arrival_prediction = now + nextPointTime + totalWorkTime + totalTravelTime;

                // console.log("In route", route, "Predication for point ", j, "==", route.points[j].arrival_prediction);

                route.points[j].in_plan = true;
                if (route.points[j].arrival_prediction == null || route.points[j].arrival_prediction == 0 || route.points[j].arrival_prediction == '0') {
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
                            route.points[j].status = 4;

                            //console.log("_route.points[j].status = STATUS.TIME_OUT;");
                        } else {
                            route.points[j].status = 5;

                            //console.log("_route.points[j].status = STATUS.DELAY;");
                        }
                    }

                } else {
                    route.points[j].overdue_time = 0;
                }

                totalWorkTime += parseInt(route.points[j].TASK_TIME);
            }
        }

    }

    }

//Приведение времени PUSH к локально текущему Киев прибавляем 3 часа
function checkPushesTimeGMTZone(pushes, company){
    console.log("Start reorange pushes");
    var i=0;
    while (i<pushes.length) {


        var temp = pushes[i].gps_time ? strToTstamp(pushes[i].gps_time)+60*60*4 : 0;
        if( temp == 0) {
            console.log("Невалидный ПУШ", company);
        }
        pushes[i].gps_time_ts=temp;
        //console.log("New Time", temp);
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

// добавить ноль слева, если число меньше десяти
Number.prototype.padLeft = function (base, chr) {
    var len = (String(base || 10).length - String(this).length) + 1;
    return len > 0 ? new Array(len).join(chr || '0') + this : this;
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


function checkUncalculateRoute(point, stop, company){

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
        if ((stop.t1> begin - cashedDataArr[company].settings.timeThreshold * 60) && (stop.t1< end+cashedDataArr[company].settings.timeThreshold * 60) ){
            result=true;
            break;
        }
        i++;
    }




    return result;
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



function  checkOnline(company) {
    for (var i=0; i<onlineClients.length; i++){
                if(onlineClients[i].time + 60*3 < parseInt(Date.now()/1000)){
                    console.log(onlineClients[i].login, "Давно не был онлайн, удаляем");
                    onlineClients.splice(i,1);
                    i--;
        }

    }
    var result=false;
    for (var i=0; i<onlineClients.length; i++){
        console.log("Стоит ли считать компанию ", company, "Если online:", onlineClients[i]);
        if(onlineClients[i].company == company){
            result=true;
            return result;
        }

    }


    console.log("На данный момент нет никого онлайн из этой компании. Считать нет смысла");
    return result;

}


module.exports = router;