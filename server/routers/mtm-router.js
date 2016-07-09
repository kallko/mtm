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

    closeRoutesUniqueID = {}, // для каждой фирмы UniqueID  сегодняшних закрытых роутов

    oldRoutesCache = {}, // объект со всеми роутами,  кроме текущего дня
    companyLogins = {},   // Список логинов на компании
    needNewReqto1C = {}, // если есть свойство с именем компани, то не запрвшивать из 1С
    blockedRoutes = []; // список заблокированных маршрутов

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
            day = 86400000,
            today12am = now - (now % day);
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
            var soapManager = new soap(req.session.login);
            soapManager.getAllDailyData(dataReadyCallback, req.query.showDate);

            function dataReadyCallback(data) {
               if (data.routes != undefined){
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


                    needNewReqto1C[req.session.login] = true;
                            //здесь падала программа при длительном использовании.
                    
                    if (data.routes !=undefined) {
                        for (var i = 0; i < data.routes.length; i++) {
                            if (!data.routes[i]['uniqueID']) {
                                data.routes[i]['uniqueID'] = data.routes[i].itineraryID + data.VERSION + data.routes[i].ID;
                                for (var j = 0; j < data.routes[i].points.length; j++) {
                                    data.routes[i].points[j]['uniqueID'] = data.routes[i].itineraryID + data.VERSION + data.routes[i].ID;
                                }
                            } else {
                                continue;
                            }
                        }


                    req.session.itineraryID = data.ID;
                    data.user = req.session.login;
                    data.routesOfDate = data.routes[0].START_TIME.split(' ')[0];
                    }
                    cashedDataArr[currentCompany] = data;
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
        // проверяем не заблокирован ли этот маршрут другим пользователемъ
        // Задача 1 найти этот роут в заблокированных
        var key = ""+req.session.login;
        var currentCompany = companyLogins[key];
        var i=0;
        var blocked=false;
        var dataB;
        //blockedRoutes.push({id:"168113", company:currentCompany, login:key});

        while( i<blockedRoutes.length){
            if(blockedRoutes[i].id == req.body.id && blockedRoutes[i].company==currentCompany ){
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
                    break;
                }

                if(!created){
                    blockedRoutes.push({id:""+req.body.id, company:currentCompany, login:key})
                }

                i++;
            }


            i=0;
            while (i<blockedRoutes.length){
                console.log("Blocked", blockedRoutes[i]);
                i++;
            }


        }

        //req.body.id
        //console.log('gettracksbystates', req.body.states, req.body.gid, req.body.demoTime, "MTM 364");
        tracksManager.getTrackByStates(req.body.states, req.body.gid, req.body.demoTime, function (data) {
           // console.log('get tracks by states DONE!', data, "MTM 366");
            res.status(200).json(data);
        });
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



module.exports = router;