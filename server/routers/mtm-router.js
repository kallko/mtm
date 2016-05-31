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
    cronSubscribers = {}, // хранилище подписчиков, для удаления закрытых роутов на клиенте по крону
    oldRoutesCache = {}, // объект со всеми роутами,  кроме текущего дня
    needNewReqto1C = {}; // если есть свойство с именем компани, то не запрвшивать из 1С

new CronJob('00 01 00 * * *', function(){
    for(var company in cashedDataArr){
        if(!Array.isArray(oldRoutesCache[company])){ // есть ли старые роуты к кеше
            oldRoutesCache[company] = [];
        }
        if(company in closeRoutesUniqueID) { // есть ли за сегодня закрытые роуты, если да, то по UniqueID удаляем их из сегодняшних роутов
            for (var i = 0; closeRoutesUniqueID[company].length > i; i++) {
                for (var j = 0; cashedDataArr[company].routes.length > 0; j++) {
                    if (cashedDataArr[company].routes[j]['uniqueID'] == closeRoutesUniqueID[company][i]) { // удаляем из кеша все закрытые маршруты
                        cashedDataArr[company].routes.splice(j, 1);
                        j--;
                        break;
                    }

                }
            }
        }
        if(cashedDataArr[company].routes.length > 0){ // если еще остались роуты то добавляем их к старым в oldRoutesCache
            for(var j = 0; cashedDataArr[company].routes.length > j; j++){
                cashedDataArr[company].routes[j].oldroute = true; // метка для старых роутов
            }

            oldRoutesCache[company] = oldRoutesCache[company].concat(JSON.parse(JSON.stringify(cashedDataArr[company].routes)));
            cashedDataArr[company].routes = [];
        }
        if(company in cronSubscribers && cronSubscribers[company] > 0){ // если остались подписчики, то отсылаем ответ и удаляем закрытые роуты на клиенте
            for(i = 0; cronSubscribers[company].length > i; i++){
                cronSubscribers[company][i].status(200).json({remove:'ok'});
            }
        }
    }



    console.log('START CRON');
    console.log(oldRoutesCache);
    console.log('END CRON');
    cronSubscribers = {};
    needNewReqto1C = {};
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

// запуск монитора диспетчера в демо-режиме
router.route('/demo')
    .get(function (req, res) {
        req.session.login = demoLogin;
        res.sendFile('index.html', {root: './public/'});
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
        console.log('---------------------------------------------------------------------------');
         console.log(updateCacshe[req.session.login]);
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
        if (req.session.login == null) {
            req.session.login = config.soap.defaultClientLogin;
        }

        var now = Date.now(),
            day = 86400000,
            today12am = now - (now % day);

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
            && cashedDataArr[req.session.login] != null
            && (req.session.login in needNewReqto1C)
            /*&& cashedDataArr[req.session.login].lastUpdate == today12am*/ ) {
            console.log('=== loaded from session === send data to client ===');
            req.session.itineraryID = cashedDataArr[req.session.login].ID;
            cashedDataArr[req.session.login].user = req.session.login;

            var copyCashedDataArr = JSON.parse(JSON.stringify(cashedDataArr[req.session.login]));
            if(Array.isArray(oldRoutesCache[req.session.login]) ){
                copyCashedDataArr.routes = copyCashedDataArr.routes.concat(oldRoutesCache[req.session.login]);
            }
            res.status(200).json(copyCashedDataArr);
        } else {
            // запрашивает новые данные в случае выключенного кеширования или отсутствия свежего кеша
            var soapManager = new soap(req.session.login);
            soapManager.getAllDailyData(dataReadyCallback, req.query.showDate);

            function dataReadyCallback(data) {
                //var toPrint = JSON.stringify(data)
                console.log('=== dataReadyCallback === send data to client ===');
                // Добавления уникального ID для каждого маршрута и этогоже ID для каждой точки на маршруте
                console.log('=== dataReadyCallback === send data to client ===');

                if (data.status && data.status === 'no plan') { // если на сегодня нет планов
                    if(req.session.login in cashedDataArr){
                        cashedDataArr[req.session.login].server_time = parseInt(Date.now()/1000);
                    }
                    if(oldRoutesCache[req.session.login] != undefined){  // проверка есть ли в кеше старые не закрыты роуты
                        cashedDataArr[req.session.login].routes = cashedDataArr[req.session.login].routes.concat(oldRoutesCache[req.session.login]);
                        res.status(200).json(cashedDataArr[req.session.login]); // возвращаем вчерашнию dailydata минус закрытые роуты
                    }else{
                        res.status(200).json(data);
                    }
                }else{
                    needNewReqto1C[req.session.login] = true;
                            //здесь падала программа при длительном использовании.

                    cashedDataArr[req.session.login] = data;

                    req.session.itineraryID = data.ID;
                    data.user = req.session.login;

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

                    }

                    var _data = JSON.parse(JSON.stringify(data));
                    if(Array.isArray(oldRoutesCache[req.session.login]) ){
                        _data.routes = _data.routes.concat(oldRoutesCache[req.session.login]);
                    }
                    res.status(200).json(_data);
                }
                // if (!req.query.showDate) {
                //     data.lastUpdate = today12am;
                //     cashedDataArr[req.session.login] = data;
                //     //console.log();
                // }


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
        if (req.session.login == undefined) {
            res.status(401).json({status: 'Unauthorized'});
            return;
        }

        var first = true;
        tracksManager.getRealTrackParts(cashedDataArr[req.session.login], req.params.start, req.params.end,
            function (data) {
                if (!first) return;

                console.log('getRealTrackParts DONE');
                first = false;
                var cached = cashedDataArr[req.session.login];

                for (var i = 0; i < cached.sensors.length; i++) {
                    for (var j = 0; j < data.length; j++) {
                        if (cached.sensors[i].GID == data[j].gid && data[j].data!=cached.sensors[i].real_track ) {
                            if (data[j].data.length > 0) {
                                var stopsBefore=cached.sensors[i].real_track.length;

                                //console.log("Car with gid=",cached.sensors[i].GID, "Had stops",  stopsBefore);
                                cached.sensors[i].real_track = cached.sensors[i].real_track || [];
                                cached.sensors[i].real_track = cached.sensors[i].real_track.concat(data[j].data);
                                var stopsAfter=cached.sensors[i].real_track.length;
                                //console.log("Car with gid=", cached.sensors[i].GID, "Now hav stops",  stopsAfter);
                                if(stopsAfter-stopsBefore==1){
                                 //  console.log("gid", cached.sensors[i].GID, "stops", cached.sensors[i].real_track);
                                }

                            }
                            break;
                        }
                    }
                }

                //console.log('Last cached data before', new Date(cashedDataArr[req.session.login].server_time * 1000));
                cached.server_time = parseInt(Date.now() / 1000);
                //console.log('Last cached data after', new Date(cashedDataArr[req.session.login].server_time * 1000));

                log.toFLog('final_data.js', cached);

                res.status(200).json(data);
            });
    });

// получение треков по переданным стейтам
router.route('/gettracksbystates/')
    .post(function (req, res) {
        console.log('gettracksbystates');
        tracksManager.getTrackByStates(req.body.states, req.body.gid, req.body.demoTime, function (data) {
            console.log('get tracks by states DONE!');
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
    .get(function (req, res) {

        if (req.session.login!=undefined) {
        var data=updateCacshe[req.session.login];
        } else {
            data=[];
        }
        //console.log("mtm existing data", data);
        res.status(200).json(data);
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
        console.log("Логин : ", [req.session.login]);

        if(updateCacshe[req.session.login]==undefined || updateCacshe[req.session.login].length==0){
            updateCacshe[req.session.login] = req.body;
            res.status(200).json({status: 'ok'});
            return;
        }
        res.status(200).json({status: 'ok'});
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
            while(j<updateCacshe[req.session.login].data.length){
                var oldID;
                if(updateCacshe[req.session.login].data[j] && updateCacshe[req.session.login].data[j].id!=undefined) oldID=""+updateCacshe[req.session.login].data[j].lat+updateCacshe[req.session.login].data[j].lon+updateCacshe[req.session.login].data[j].t1;
                if(updateCacshe[req.session.login].data[j] && updateCacshe[req.session.login].data[j].TASK_NUMBER) oldID=""+updateCacshe[req.session.login].data[j].TASK_NUMBER+updateCacshe[req.session.login].data[j].TASK_DATE;
                if(newID==oldID){
                    //console.log("i=", i, "ID=", newID, 'j=', j, "oldID=", oldID);
                    updateCacshe[req.session.login].data[j]=obj.data[i];
                    exist=true;
                }
                j++;
            }
            if(!exist) {
               // console.log("Adding new point/stop")
                updateCacshe[req.session.login].data.push(obj.data[i])
            }
            delete newID;
            i++;
        }
        for(var company in updateCacshe){
           // console.log(updateCacshe[company]);
        }
    });




// получение с роутера планового трека и времен проезда по всем маршрутам по логину в сессии
router.route('/routerdata')
    .get(function (req, res) {
        var routeIndx = req.query.routeIndx,
            cData = cashedDataArr[req.session.login],
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
        console.log('getmatrix');
        tracksManager.getRouterMatrixByPoints(req.params.points, function (data) {
            res.status(200).json(data);
        });
    });

// получение матрицы расстояний с для всех непросчитанных роутов
//router.route('/getroutermatrixuncalc/:points')
//    .get(function (req, res) {
//        console.log('getmatrix');
//        tracksManager.getRouterMatrixByPoints(req.params.points, function (data) {
//            res.status(200).json(data);
//        });
//    });


// открытие окна задачи в 1С IDS
router.route('/openidspointwindow/:pointId')
    .get(function (req, res) {
        console.log('openidspointwindow');
        var soapManager = new soap(config.soap.defaultClientLogin);
        soapManager.openPointWindow(req.session.login, req.params.pointId);
        res.status(200).json({status: 'ok'});
    });

// получение списка отмен
router.route('/getreasonlist')
    .get(function (req, res) {
        var soapManager = new soap(req.session.login);
        soapManager.getReasonList(function(data) {
            res.status(200).json(data);
        });
    });

router.route('/closeday')
    .post(function (req, res) {
        if (req.session.login == null) {
            req.session.login = config.soap.defaultClientLogin;
        }
        //console.log(req.body.closeDayData);

        var soapManager = new soap(req.session.login);
            soapManager.closeDay(req.body.closeDayData, function (data) {
                if (!data.error) {
                    res.status(200).json({result: data.result, closeCount:req.body.routesID.length, CloseDate:req.body.closeDayDate });
                    if(req.body.update) { // перезаписать сегодняшний день
                        if(!Array.isArray(closeRoutesUniqueID[req.session.login])){
                            closeRoutesUniqueID[req.session.login] = [];
                        }
        loopRoutesID : for (var i = 0; req.body.routesID.length > i; i++) { // добавляем к роутам из кеша которые закрыты св-во closeDayServer
                            for(var j = 0; closeRoutesUniqueID[req.session.login].length > j; j++){
                                if(closeRoutesUniqueID[req.session.login][j] == req.body.routesID[i]){ // если тру, то такой роут уже был закрыт
                                    continue loopRoutesID;
                                }
                            }
                            closeRoutesUniqueID[req.session.login].push(req.body.routesID[i]);
                        }
                    }else {
                        if (Array.isArray(oldRoutesCache[req.session.login])){
                            for (var i = 0; req.body.routesID.length > i; i++) {
                                for (var j = 0; oldRoutesCache[req.session.login].length > j; j++) {
                                    if (req.body.routesID[i] == oldRoutesCache[req.session.login][j]['uniqueID']) {
                                        oldRoutesCache[req.session.login].splice(j, 1);
                                        j--;
                                        console.log('CLOSEROUTE');
                                        break;
                                    }
                                }
                            }
                        }
                    }
                } else {
                    res.status(200).json({error: data.error});
                }
            });

    });

router.route('/cronsubscribers') // роут для приема подписчиков на удаления по крону из фронт энда закрытых маршрутов
    .post(function (req, res) {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        if(! (req.session.login in cronSubscribers) ){
            cronSubscribers[req.session.login] = [];
        }
        cronSubscribers[req.session.login].push(res);
        res.on('close', function() {
            if( (req.session.login in cronSubscribers) && cronSubscribers[req.session.login].length > 0){
                cronSubscribers[req.session.login].splice(cronSubscribers[req.session.login].indexOf(res), 1);
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


module.exports = router;