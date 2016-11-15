

var express = require('express'),
    router = express.Router(),
    config = require('../config'),
    soap = require('../soap/soap'),
    tracks = require('../tracks'),
    log = new (require('../logging'))('./logs'),
    //colors = require('colors'),
    fs = require('fs'),
    math_server = new (require('../math-server'))(),
    db = new (require('../db/DBManager'))('postgres://pg_suser:zxczxc90@localhost/plannary'),
    locker = new (require('../locker'))(),
    CronJob = require('cron').CronJob,
    //async = require('async'),
    //colors = require('colors'),




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
    onlineClients = [], // список клиентов онлайн на данный момент
    restart = false; // флаг сообщение о том что на сервере будут проходить профилактические работы

//
//    window_types = [                              // фильтры по типам попадания в окна
//    {name: 'Вне окон', value: WINDOW_TYPE.OUT_WINDOWS, class: 'out-windows'},
//    {name: 'В заказанном', value: WINDOW_TYPE.IN_ORDERED, class: 'in-ordered'},
//    {name: 'В обещанном', value: WINDOW_TYPE.IN_PROMISED, class: 'in-promised'}
//];


//new CronJob('01 00 00 * * *', function() {
//    for(var company in cashedDataArr){
//        if (!oldRoutesCache[company]) {
//            oldRoutesCache[company] = {};
//        }
//        if(company in closeRoutesUniqueID) { // есть ли за сегодня закрытые роуты, если да, то по UniqueID удаляем их из сегодняшних роутов
//            for (var i = 0; closeRoutesUniqueID[company].length > i; i++) {
//                for (var j = 0; cashedDataArr[company].routes.length > j; j++) {
//                    if (cashedDataArr[company].routes[j]['uniqueID'] == closeRoutesUniqueID[company][i]) { // удаляем из кеша все закрытые маршруты
//                        cashedDataArr[company].routes.splice(j, 1);
//                        j--;
//                        break;
//                    }
//
//                }
//            }
//        }
//        if(cashedDataArr[company].routes.length > 0){ // если еще остались роуты то добавляем их к старым в oldRoutesCache
//            var currentDate = cashedDataArr[company].routes[0].START_TIME.split(' ')[0];
//            oldRoutesCache[company][currentDate] = {};
//            oldRoutesCache[company][currentDate] = JSON.parse(JSON.stringify(cashedDataArr[company]));
//        }
//    }
//
//    log.info('END CRON');
//
//    needNewReqto1C = {};
//    closeRoutesUniqueID = {};
//
//
//}, null, true);


    var oldRoutes;

    var demoLogin = 'demo';
    var tracksManager = new tracks(
        config.aggregator.url,
        config.router.url,
        config.aggregator.login,
        config.aggregator.password);

router.route('/')
    .get(function (req, res) {
        try {
        res.status(200);
        } catch (e) {
            log.error( "Ошибка "+ e + e.stack);
        }
    });


router.route('/currentsrvertime')
    .post(function(req, res){
        try {
        res.status(200).json(Date.now());
        } catch (e) {
            log.error( "Ошибка "+ e + e.stack);
        }
    });


router.route('/notification')
    .get(function(req, res){
        restart = true;
        res.status(200).json('ok');
    });

router.route('/saveData')
    .get(function(req, res){
        log.info("Start data saving");
        var data = JSON.stringify(cashedDataArr);
        var mes ='complete';

        try {
            fs.writeFile('./logs' + '/' +'savedData.txt', data, function(err){
                if (err) log.info("Не могу записать. Начинай ковыряться в коде", err);
                mes+= err;
            });

            res.status(200).json({mes: mes });
        } catch (e) {
            log.error( "Ошибка "+ e + e.stack);
        }
    });


router.route('/loadData')
    .get(function(req, res){
        try {
        log.info("Start data loading");
            var oldJson;
        fs.readFile('./logs' + '/' +'saved.txt', 'utf8', function (err, data) {
            oldJson = JSON.parse(data);
            console.log("Error in load", err);
            cashedDataArr = oldJson;
            log.info( "Type of Data", typeof (oldJson));

        });


            res.status(200).json({msg: 'complete'});
        } catch (e) {
            log.error( "Ошибка "+ e + e.stack);
        }
    });

// запуск монитора диспетчера в демо-режиме
//router.route('/demo')
//    .get(function (req, res) {
//        req.session.login = demoLogin;
//        res.sendFile('index.html', {root: './public/'});
//    });

router.route('/keysoldroutescache')
    .get(function(req, res){
        try {
        var key = ""+req.session.login;
        var currentCompany = companyLogins[key];
        if(currentCompany in oldRoutesCache){
            log.info(Object.keys(oldRoutesCache[currentCompany]));
            res.status(200).json( Object.keys(oldRoutesCache[currentCompany]) );
        }else{
            res.status(200).json(null);
        }

        } catch (e) {
            log.error( "Ошибка "+ e + e.stack);
        }

    });
router.route('/getoldroute')
    .post(function(req, res){
        try {
        var key = ""+req.session.login;
        var currentCompany = companyLogins[key];
        res.status(200).json(oldRoutesCache[currentCompany][req.body.date]);
        } catch (e) {
            log.error( "Ошибка "+ e + e.stack);
        }
    });


router.route('/askblocked')
    .post(function(req, res){
        try {
            var key = ""+req.session.login;
            var currentCompany = companyLogins[key];
            var result=[];
            if(restart) {
                result.push('restart');
                res.status(200).json(result);
                return;
            }
            for (var i=0; i<blockedRoutes.length; i++){
                //log.info(blockedRoutes[i]);
                if (blockedRoutes[i].company == currentCompany && blockedRoutes[i].login != key) {
                    result.push(blockedRoutes[i].id);
                }
            }

            res.status(200).json(result);
        } catch (e) {
            log.error( "Ошибка "+ e + e.stack);
        }
    });



router.route('/updatepushes')
    .post (function(req, res){
    try {
        log.info("Получил запрос на updatepushes", req.body.data);

        var key = "" + req.session.login;
        var currentCompany = companyLogins[key];
        var result = req.body.data;
        var data = req.body.data;




        for (var i = 0; i < data.length; i++) {

            result = addPushesToUpdateTrack(currentCompany, result);

        }
        res.status(200).json(result);
    } catch (e) {
        log.error( "Ошибка "+ e + e.stack);
    }
});



router.route('/updatetrack')
    .post (function(req, res){
    try {
        log.info ("Получил запрос на updatetrack", req.body.data);

        var key = ""+req.session.login;
        var currentCompany = companyLogins[key];
        var result = [];
        var data = req.body.data;
        var t=data.length;
        //console.log ("Разберись с этой data", data);
        //console.log("Размер этой дата", data.length);
        var tt=0;
        for (var i=0; i<data.length; i++){

            tracksManager.getTrack(
                data[i].gid,
                data[i].lastState.t1,
                parseInt(Date.now()/1000), "", "", "", "", "", "", function (newData, newGid) {
                    newData.length=newData.length-1;

                    tracksManager.getTrackByStates(newData, newGid, false, function(data, sNewGid){
                        tt++;
                       log.info ("NEWNEWNEW DATA", t, " ", tt);
                        result.push({gid:sNewGid, state: data});
                        if (t==tt) {
                            log.info ("Своевременные данные получены, отправляем их на клиент");
                            res.status(200).json(result);
                        }
                    });
                    //log.info(newGid, "NEW DATA", newData);

        })
    }






        //todo Тестовый блок асинхронности
        //    async.parallel([
        //         function(callback){log.info("First");
        //
        //            var soapManager = new soap(req.session.login);
        //            soapManager.getNewConfig(req.session.login, function (company, data) {
        //                var settings = JSON.parse(data.return);
        //                log.info("Recieve first settings", settings);
        //                callback (null, settings)
        //
        //            })
        //        },
        //         function(callback){log.info("Second");
        //
        //            var soapManager = new soap(req.session.login);
        //            soapManager.getNewConfig(req.session.login, function (company, data) {
        //                var settings = JSON.parse(data.return);
        //                log.info("Recieve second settings", settings);
        //                callback(null, settings)
        //            })}
        //],
        //        function(err, results) {log.info("Third", results)});

    } catch (e) {
        log.error( "Ошибка "+ e + e.stack);
    }
});


router.route('/nodeserch')
    .post(function(req, res){
        try {
        log.info("Получил запрос на поиск", req.body.data);

        var key = ""+req.session.login;
        var currentCompany = companyLogins[key];
        var input = req.body.data;
        var result = serchInCache(input, currentCompany);





        //todo Тестовый блок асинхронности
    //    async.parallel([
    //         function(callback){log.info("First");
    //
    //            var soapManager = new soap(req.session.login);
    //            soapManager.getNewConfig(req.session.login, function (company, data) {
    //                var settings = JSON.parse(data.return);
    //                log.info("Recieve first settings", settings);
    //                callback (null, settings)
    //
    //            })
    //        },
    //         function(callback){log.info("Second");
    //
    //            var soapManager = new soap(req.session.login);
    //            soapManager.getNewConfig(req.session.login, function (company, data) {
    //                var settings = JSON.parse(data.return);
    //                log.info("Recieve second settings", settings);
    //                callback(null, settings)
    //            })}
    //],
    //        function(err, results) {log.info("Third", results)});
        res.status(200).json(result);
        } catch (e) {
            log.error( "Ошибка "+ e + e.stack);
        }
    });



// через этот путь запускается мониторинг при открытии через 1С, при этом сохраняется логин из 1С
router.route('/login')
    .get(function (req, res) {
        try {
        req.session.login = req.query.curuser;


        res.sendFile('index.html', {root: './public/'});
        } catch (e) {
            log.error( "Ошибка "+ e + e.stack);
        }
    });

// загрузка данных из соапа за текущий день

router.route('/dailydata')
    .get(function (req, res) {
        try {
        log.info("Start Loading DailyData");
        startTime = parseInt(Date.now()/1000);
        req.session.lastLockCheck = 0;
        // проверка на включеннный демо режим
        if (req.session.login == demoLogin) {
            var soapManager = new soap(req.session.login);
            soapManager.loadDemoData(function (data) {
                log.info('Demo data loaded!');
                data.demoMode = true;
                data.user = req.session.login;
                res.status(200).json(data);
            });
            return;
        }

        // присвоение лоина для прогрузки интерфейса при запуске вне окна 1С (для отладки)
        log.info("Prepere for Conflict!!!!!!!!",  req.session.login, new Date());


        //log.info(colors.green('HELLO'));
        if (req.session.login == null || req.session.login == undefined) {
            log.info("Login", req.session.login);
            res.status(401).json({status: 'Unauthorized'});
            return;
            //req.session.login = config.soap.defaultClientLogin;
        }

        var now = Date.now(),
            day = 86400000;
        //today12am = now - (now % day);
        var key = ""+req.session.login;
        var currentCompany = companyLogins[key];

        //тестово отладочный блок. Проверка повторного обращения за данными в течение дня
        //log.info("!!!!!!!req.session.login!!!!!", req.session.login);
        //
        //if(req.session.login!=undefined && updateCacshe[req.session.login].length==0){
        //    log.info("First call for data!, or login undefined");
        //
        //} else {
        //    log.info("Repeat call for data!");
        //}

        // при включенном флаге кешинга по сессии, ищет наличие относительно свежего кеша и отправляет в случае успеха



        log.info(" Should I choose Cashe?", req.session.login,  config.cashing.session
            , req.query.force == null
            , req.query.showDate == null
            , req.session.login != null
            , cashedDataArr[currentCompany] != null
            , currentCompany
            , (currentCompany in needNewReqto1C)
            , currentCompany, needNewReqto1C
            );

        if (config.cashing.session
            && req.query.force == null
            && req.query.showDate == null
            && req.session.login != null
            && cashedDataArr[currentCompany] != null
            && (currentCompany in needNewReqto1C)
            /*&& cashedDataArr[req.session.login].lastUpdate == today12am*/ ) {
            if (cashedDataArr[currentCompany].routes) log.info('=== loaded from session === send data to client === ROutes =',cashedDataArr[currentCompany].routes.length );

            var settings={};

            // Получение настроек для конкретной компании
            soapManager = new soap(req.session.login);
            log.info("Запрашиваю настройки для ", req.session.login);
            soapManager.getNewConfig(req.session.login, function (company, data) {
                log.info("receiveConfig", data);

                if (data != undefined) {settings = JSON.parse(data.return)} else {settings = {};}
                log.info("Settings Recieved",  settings, "mtm 385");
                req.session.itineraryID = cashedDataArr[currentCompany].ID;
                cashedDataArr[currentCompany].user = req.session.login;

                var cache = cashedDataArr[currentCompany];
                if(cache.currentDay){
                    cache.server_time = parseInt(new Date() / 1000);
                    cache.current_server_time = cache.server_time;
                }else{
                    cache.current_server_time = parseInt(Date.now() / 1000);
                }

                cashedDataArr[currentCompany].settings = settings;
                log.info("проверка на отправку, получены ли настройки.", cashedDataArr[currentCompany].settings);
                //log.info("Конкретные настройки", cashedDataArr[currentCompany].settings.limit, cashedDataArr[currentCompany].settings.problems_to_operator)
                //todo Два костыля, пока настройки не прописаны в 1с
                if(cashedDataArr[currentCompany].settings.limit == undefined ) cashedDataArr[currentCompany].settings.limit = 74;
                if(cashedDataArr[currentCompany].settings.problems_to_operator == undefined) cashedDataArr[currentCompany].settings.problems_to_operator = 3;
                var result = cashedDataArr[currentCompany].settings;
                result.user = req.session.login;
                res.status(200).json(result);
            });





        } else {
            // запрашивает новые данные в случае выключенного кеширования или отсутствия свежего
            middleTime = parseInt(Date.now()/1000);
            soapManager = new soap(req.session.login);
            settings={};

            // Получение настроек для конкретной компании
            log.info("Запрашиваю настройки 419 для ", req.session.login);
            soapManager.getNewConfig(req.session.login, function (company, data) {
                //log.info("receiveConfig", data);
                settings = JSON.parse(data.return);
                //cashedDataArr[company].settings = settings;
                //log.info("Obj",  obj.predictMinutes, "mtm 1192")
            });

            //Получение дневного плана для конкретной компании
            soapManager.getAllDailyData(dataReadyCallback, req.query.showDate);


            function dataReadyCallback(data) {
                log.info("Загрузка данных из 1C заняла", parseInt(Date.now()/1000)-middleTime);
                endTime = parseInt(Date.now()/1000);
                if (data.routes != undefined) {
                    log.info('=== dataReadyCallback === send data to client ===', data.routes.length);}
                else{
                    log.info('There is no routes. And what we have', data);
                }
                // Добавления уникального ID для каждого маршрута и этогоже ID для каждой точки на маршруте
                log.info('send data to client');
                //if(data.status && data.status === 'no sensors') {
                //    if (res.statusCode == 304) return;
                //    console.log("res.status", res.statusCode);
                //    res.status(200).json(data);
                //    return
                //}
                if (data.status && data.status === 'no plan') { // если на сегодня нет планов
                    res.status(200).json(data);
                }else if( data.routes.length == 0){
                    res.status(200).json({status: 'no plan'});
                }else{
                    //log.info("ReChange SessionLogin", data.CLIENT_ID);

                    var currentCompany = JSON.parse(JSON.stringify(data.CLIENT_ID));
                    var key=""+req.session.login;
                    companyLogins[key]=currentCompany;


                    needNewReqto1C[currentCompany] = true;
                    //здесь падала программа при длительном использовании.


                    //TODO Костыль проверка грузили ли мы сегодня уже эти планы для другого юзера и если да, то не перезаписывать данные.
                    //log.info(data, "Data mtm 248");

                    //for (key in data){
                    //    log.info("Key", key);
                    //};



                    if (cashedDataArr[currentCompany] != null){
                        log.info("Date", data.date, cashedDataArr[currentCompany].date, parseInt(Date.parse(data.date)/1000));
                        var exist = "" +cashedDataArr[currentCompany].date.substring(0,10);
                        if ((""+data.date).startsWith(exist)){
                        log.info("Данные по этой компани на сегодня уже получены");
                            //todo мина замедленного действия. Переписать, чтобы настройки записывались сразу при получении/ или явно передавались не оставаясь в области  глобальной видимости.
                            cashedDataArr[currentCompany].settings = settings;
                            var result = cashedDataArr[currentCompany].settings;

                            result.user = req.session.login;

                        res.status(200).json(result);
                        return;
                        } else {

                            log.info("Грузим день из прошлого", currentCompany);
                            if (cashedDataArr[currentCompany].closedRoutesFrom1C) log.info("Первая проверка", cashedDataArr[currentCompany].closedRoutesFrom1C.length);
                            //Если кто-то запросил данные по прошлому дню
                            var compmpanyName=""+currentCompany;
                            currentCompany+=""+data.date.substring(0,10);
                            if (cashedDataArr[currentCompany] && cashedDataArr[currentCompany].closedRoutesFrom1C) log.info("Вторая проверка", cashedDataArr[currentCompany].closedRoutesFrom1C.length);

                            if(cashedDataArr[currentCompany] != undefined) {

                                log.info("Прошлый день уже создан", cashedDataArr[currentCompany] != undefined , "и посчитан", cashedDataArr[currentCompany].ready);
                                if (!cashedDataArr[currentCompany].ready) {
                                    oldDayCalculate(currentCompany, data);
                                } else {

                                    res.status(200).json(cashedDataArr[currentCompany]);
                                    return;
                                }

                            } else {
                                log.info("Прошлый день еще не создан, начинаем создание");
                            }

                            if (cashedDataArr[currentCompany] != undefined && cashedDataArr[currentCompany].ready) {

                                res.status(200).json(cashedDataArr[currentCompany]);
                                return;
                            }
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
                            cashedDataArr[currentCompany].settings.problems_to_operator = cashedDataArr[currentCompany].settings.problems_to_operator || 3; //TODO прописать в настройки на 1с параметр лимит

                            //Собираем решение из частей в одну кучку
                            linkDataParts(currentCompany, req.session.login);
                            //Мгновенный запуск на пересчет, после загрузки

                            log.info("Собираемся получать пуши", currentCompany, cashedDataArr[currentCompany].idArr );
                            cashedDataArr[currentCompany].repeat = cashedDataArr[currentCompany].idArr.length;

                            cashedDataArr[currentCompany].allPushes = [];
                            soapManager = new soap(req.session.login);
                            for (var k=0; k<cashedDataArr[currentCompany].idArr.length; k++) {
                            soapManager.getPushes(req.session.itineraryID, parseInt(Date.parse(data.date)/1000), compmpanyName, function (company, data) {
                                log.info("391 receivePUSHES!!!!! for iten", iten);
                                var obj = JSON.parse(data.return);
                                log.info("Obj", obj[0], "mtm 336");
                                //delete cashedDataArr[company].allPushes;
                                cashedDataArr[company].allPushes= cashedDataArr[company].allPushes.concat(obj);
                                log.info("GetPushes finished for company", company, "получено пушей", cashedDataArr[currentCompany].idArr.length-cashedDataArr[currentCompany].repeat+1, "из", cashedDataArr[currentCompany].idArr.length );
                                cashedDataArr[currentCompany].repeat--;
                                if (cashedDataArr[currentCompany].repeat == 0) oldDayCalculate (company, data);



                            }, currentCompany);}


                            res.status(200).json("wait");
                            return;



                        }


                    }


                    if (data.routes !=undefined) {
                        for ( i = 0; i < data.routes.length; i++) {
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

                    //cashedDataArr[currentCompany].oldRoutes = oldRoutes;
                    cashedDataArr[currentCompany].currentProblems = [];
                    cashedDataArr[currentCompany].allRoutes=[];
                    cashedDataArr[currentCompany].settings = settings;
                    cashedDataArr[currentCompany].settings.limit = cashedDataArr[currentCompany].settings.limit || 74; //TODO прописать в настройки на 1с параметр лимит
                    cashedDataArr[currentCompany].settings.problems_to_operator = cashedDataArr[currentCompany].settings.problems_to_operator || 3; //TODO прописать в настройки на 1с параметр лимит
                    cashedDataArr[currentCompany].companyName=currentCompany;
                    cashedDataArr[currentCompany].recalc_finishing = true;
                    //Собираем решение из частей в одну кучку
                    linkDataParts(currentCompany, req.session.login);
                    //Мгновенный запуск на пересчет, после загрузки


                    log.info("Запуск первого расчета, после первого запрса.", cashedDataArr[currentCompany].idArr);

                    var tt=0;
                    cashedDataArr[currentCompany].allPushes =[];
                    for (var t=0; t< cashedDataArr[currentCompany].idArr.length; t++) {
                        var soapManager = new soap(cashedDataArr[currentCompany].firstLogin);
                        var iten = cashedDataArr[currentCompany].idArr[t];
                        log.info("Request for Itin", iten);
                        soapManager.getPushes(iten, parseInt(Date.now() / 1000), currentCompany, function (company, data) {
                            log.info(" 452 receivePUSHES!!!!! for iten", company);
                            tt++;
                            //log.toFLog('pushes' + company +tt, data.return);
                            if (data != undefined && data.error == undefined) {
                                var obj = JSON.parse(data.return);
                                //log.info("Obj", obj[0], "mtm 1497");
                                //delete cashedDataArr[company].allPushes;
                                cashedDataArr[company].allPushes = cashedDataArr[company].allPushes.concat(obj);
                            }
                            log.info("Присоединили", obj.length, "Получили", cashedDataArr[company].allPushes.length);
                            log.info("GetPushes finished for company", company, t, tt );
                            if (t==tt) {
                                //log.toFLog("Summary Pushes" , cashedDataArr[company].allPushes);
                                startCalculateCompany(company);
                            }
                        });

                    }


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
                        log.info("Start SERVER");
                        startServer = true;
                        var timerId = setInterval(function() {
                            startPeriodicCalculating(currentCompany);
                        }, 120 * 1000);}
                    // через 5 сек остановить повторы
                    //setTimeout(function() {
                    //    clearInterval(timerId);
                    //    alert( 'стоп' );
                    //}, 5000);
                    data.settings.user = req.session.login;

                    if (res.statusCode != 304) res.status(200).json(data.settings);
                }
            }




        }
    } catch (e) {
            log.error( "Ошибка "+ e + e.stack);
        }
    });


//Попытка запроса оператором одного роута
router.route('/askforroute')
    .post(function(req, res) {
        try {
        var key = "" + req.session.login;
        var currentCompany = companyLogins[key];
        var uniqueID = req.body.id;
        log.info("Пришел одиночный запрос на роут", uniqueID);

        // проверяем не был ли этот маршрут заблокирован
        for (var i = 0; i < blockedRoutes.length; i++) {
            log.info(blockedRoutes[i]);
            if (blockedRoutes[i].id == uniqueID && currentCompany == blockedRoutes[i].company) {
                res.status(200).json({blocked: blockedRoutes[i].login});
                return;
            }
        }

        //Искать маршрут нужно в 2-х местах line_routes & routes
        //log.info("Начинаем поиск", currentCompany, cashedDataArr[currentCompany].line_routes.length);
        var result = {error: "Dont Found"};
        if (cashedDataArr[currentCompany] != undefined && cashedDataArr[currentCompany].line_routes != undefined && cashedDataArr[currentCompany].line_routes.length >0 ) {

            for (var i = 0; i < cashedDataArr[currentCompany].line_routes.length; i++) {
                //log.info("Ищем в проблемных");
                if (uniqueID == cashedDataArr[currentCompany].line_routes[i].uniqueID) {
                    result = cashedDataArr[currentCompany].line_routes[i];
                    cashedDataArr[currentCompany].blocked_routes = cashedDataArr[currentCompany].blocked_routes || [];
                    cashedDataArr[currentCompany].blocked_routes.push(result);
                    cashedDataArr[currentCompany].line_routes.splice(i, 1);
                    log.info ("Маршрут найден в проблемных");
                    break;
                 }
             }
         }

        if (cashedDataArr[currentCompany] != undefined && cashedDataArr[currentCompany].routes != undefined && cashedDataArr[currentCompany].routes.length >0 ) {
            for (var i = 0; i < cashedDataArr[currentCompany].routes.length; i++) {
                //log.info("Ищем в беспроблемных");
                if (uniqueID == cashedDataArr[currentCompany].routes[i].uniqueID) {
                    result = cashedDataArr[currentCompany].routes[i];
                    if (cashedDataArr[currentCompany].blocked_routes == undefined) cashedDataArr[currentCompany].blocked_routes = [];
                    cashedDataArr[currentCompany].blocked_routes = cashedDataArr[currentCompany].blocked_routes || [];
                    cashedDataArr[currentCompany].blocked_routes.push(result);
                    cashedDataArr[currentCompany].routes.splice(i, 1);
                    log.info ("Маршрут найден в беспроблемных");
                    break
                }
            }
        }
        if (result.error == undefined) {
            changePriority(result.uniqueID, currentCompany, key);
            blockedRoutes.push ({id: result.uniqueID, company: currentCompany, login: key, time: parseInt(Date.now()/1000)})
        }
        log.info ("Начинаем запись файла");
        log.toFLog('logging.txt', JSON.stringify(result));
        log.info("Заканчиваем запись файла");
        res.status(200).json({route: result});

        } catch (e) {
            log.error( "Ошибка "+ e + e.stack);
        }

    });

// проверка блокировок точек и маршрутов
router.route('/checklocks/:itineraryid')
    .get(function (req, res) {
        try{
        req.params.itineraryid = req.params.itineraryid.replace('SL', '/');
        var result = locker.checkLocks(req.params.itineraryid, req.session.lastLockCheck);
        if (result) {
            req.session.lastLockCheck = result.lastChange;
            res.status(200).json({status: 'changed', locked: result});
        } else {
            res.status(200).json({status: 'no_changes'});
        }
        } catch (e) {
            log.error( "Ошибка "+ e + e.stack);
        }
    });

// открытие окна точки с проверкой на блокировки
router.route('/opentask/:itineraryid/:taskid')
    .get(function (req, res) {
        try{
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
        } catch (e) {
            log.error( "Ошибка "+ e + e.stack);
        }
    });

// разблокирование конкретной задачи
router.route('/unlocktask/:itineraryid/:taskid')
    .get(function (req, res) {
        try {
        req.params.itineraryid = req.params.itineraryid.replace('SL', '/');
        if (locker.unlockTask(req.params.itineraryid, req.params.taskid, req.session.login)) {
            res.status(200).json({status: 'unlocked'});
        } else {
            res.status(200).json({status: 'not_yours'});
        }
        } catch (e) {
            log.error( "Ошибка "+ e + e.stack);
        }
    });


// блокировка всего марщрута
router.route('/lockroute/:itineraryid/:routeid/:tasks')
    .get(function (req, res) {
        try {
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
        } catch (e) {
            log.error( "Ошибка "+ e + e.stack);
        }
    });

// разблокировка всего маршрута
router.route('/unlockroute/:itineraryid/:routeid/:tasks')
    .get(function (req, res) {
        try {
        req.params.itineraryid = req.params.itineraryid.replace('SL', '/');
        var tasksArr = req.params.tasks.split(';');
        var result = locker.unlockRoute(req.params.itineraryid, tasksArr, req.session.login);
        res.status(200).json(result);
        } catch (e) {
            log.error( "Ошибка "+ e + e.stack);
        }
    });

// получение куска трека по гиду машины и по временному промежутку
router.route('/tracks/:gid&:from&:to&:undef_t&:undef_d&:stop_s&:stop_d&:move_s&:move_d')
    .get(function (req, res) {
        try {
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
        } catch (e) {
            log.error( "Ошибка "+ e + e.stack);
        }
    });

// догрузка треков в данные по сессии по всем машинам сразу
router.route('/trackparts/:start/:end')
    .get(function (req, res) {
        try {
        log.info('догрузка треков в данные по сессии по всем машинам сразу , trackparts, ', req.session.login);
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


                first = false;
                var key = ""+req.session.login;
                var currentCompany = companyLogins[key];
                var cached = cashedDataArr[currentCompany];
                log.info('getRealTrackParts DONE', currentCompany);

                if(cached) {
                    for (var i = 0; i < cached.sensors.length; i++) {
                        for (var j = 0; j < data.length; j++) {
                            if (cached.sensors[i].GID == data[j].gid && data[j].data != cached.sensors[i].real_track) {
                                if (data[j].data.length > 0 && cached.sensors[i].real_track != undefined) {
                                    // var stopsBefore = cached.sensors[i].real_track.length;

                                   // log.info("Car with gid=",cached.sensors[i].GID, "Had stops",  stopsBefore);
                                    //if (cached.sensors[i].GID == 9296) {
                                    //   // log.info(cached.sensors[i].real_track, " BEFORE MTM 338")
                                    //}


                                    var len = cached.sensors[i].real_track.length-1;
                                    if (cached.sensors[i].real_track[len].state == 'CURRENT_POSITION') {
                                        cached.sensors[i].real_track.length = len;
                                    }
                                    data[j].data[0].state = 'MOVE';
                                    cached.sensors[i].real_track = cached.sensors[i].real_track || [];
                                    cached.sensors[i].real_track = cached.sensors[i].real_track.concat(data[j].data);
                                    // var stopsAfter = cached.sensors[i].real_track.length;
                                   // log.info("Car with gid=", cached.sensors[i].GID, "Now have stops",  stopsAfter);
                                    //if (cached.sensors[i].GID == 9296) {
                                    //    log.info(cached.sensors[i].real_track, " AFTER MTM 338")
                                    //}

                                    // if (stopsAfter - stopsBefore == 1) {
                                    //       //log.info("gid", cached.sensors[i].GID, "stops", cached.sensors[i].real_track);
                                    // }

                                }
                                break;
                            }
                        }
                    }
                }
                //log.info('Last cached data before', new Date(cashedDataArr[req.session.login].server_time * 1000));
                //cached.server_time = parseInt(Date.now() / 1000);
                //log.info('Last cached data after', new Date(cashedDataArr[req.session.login].server_time * 1000));

                //log.toFLog('final_data.js', cached);

                res.status(200).json(data);
            });
        } catch (e) {
            log.error( "Ошибка "+ e + e.stack);
        }
    });

// получение треков по переданным стейтам
router.route('/gettracksbystates')
    .post(function (req, res) {

        try{
        //log.info("Запрашиваем стейты для прошлого маршрута", req.body.states, req.body.gid, req.body.demoTime);
        tracksManager.getTrackByStates(req.body.states, req.body.gid, req.body.demoTime, function (data) {
            //log.info("Трек для прошлого маршрута получен");
            res.status(200).json(data);
        });


        } catch (e) {
            log.error( "Ошибка "+ e + e.stack);
        }

    });

// получение планового трека с роутера между двумя точками
router.route('/findpath2p/:lat1&:lon1&:lat2&:lon2')
    .get(function (req, res) {
        try {
        log.info('=== router.route findpath ===');
        tracksManager.findPath(req.params.lat1, req.params.lon1, req.params.lat2, req.params.lon2,
            function (data) {
                res.status(200).json(data);
            });
        } catch (e) {
            log.error( "Ошибка "+ e + e.stack);
        }
    });

// получение планового времени проезда с роутера между двумя точками
router.route('/findtime2p/:lat1&:lon1&:lat2&:lon2')
    .get(function (req, res) {
        try {
        tracksManager.findTime(req.params.lat1, req.params.lon1, req.params.lat2, req.params.lon2,
            function (data) {
                res.status(200).json(data);
            });
        } catch (e) {
            log.error( "Ошибка "+ e + e.stack);
        }
    });

// пересчет маршрута на математике
router.route('/recalculate')
    .post(function (req, res) {
        try {
        log.info("Send route to recalc");
        math_server.recalculate(req.body.input, function (data) {
            log.info('MATH DATE >>', new Date());
            res.status(200).json(data);
        });
        } catch (e) {
            log.error( "Ошибка "+ e + e.stack);
        }
    });

// сохранение в 1С маршрута
router.route('/saveroute/')
    .post(function (req, res) {
        try {
        //log.info('saveroute, len', req.body.routes.length);
        var soapManager = new soap(req.session.login);
        log.info("Отправляем в SOAP роутов", req.body.routes.length);
        soapManager.saveRoutesTo1C(req.body.routes, function (data) {
            if (!data.error) {
                res.status(200).json({result: data.result});
            } else {
                res.status(200).json({error: data.error});
            }
        });
        } catch (e) {
            log.error( "Ошибка "+ e + e.stack);
        }
    });


router.route('/setmobiledevice/')
    .post(function (req, res) {
        try {
            var key = ""+req.session.login;
            var currentCompany = companyLogins[key];
            //log.info('saveroute, len', req.body.routes.length);
            var soapManager = new soap(req.session.login);
            var imei = req.body.imei;
            var driverID = req.body.driver;
            log.info("С роутера пытаемся поставить мобильное устройство");
            soapManager.setMobileDevice(currentCompany, imei, driverID, function (company, data) {
                if (!data.error) {
                    res.status(200).json({result: data});
                } else {
                    res.status(200).json({error: data});
                }
            });
        } catch (e) {
            log.error( "Ошибка "+ e + e.stack);
        }
    });



//router.route('/existdata/')
//    .post(function(req, res){
//        var key = ""+req.session.login;
//        var currentCompany = companyLogins[key];
//        if(currentCompany in updateCacshe && req.body.date in updateCacshe[currentCompany]){
//            res.status(200).json(updateCacshe[currentCompany][req.body.date]);
//        } else {
//            res.status(200).json([]);
//        }
//
//
//    });







router.route('/savewaypoint/')
    .post(function (req, res) {
        try {
        log.info("^^^^^^^^^ router ^^^^^^^^^");
        log.info('savewaypoint, req.bod', req.body);
        var soapManager = new soap(req.session.login);
        soapManager.updateWaypointCoordTo1C(req.body, function (data) {
            if (!data.error) {
                res.status(200).json({result: data.result});
            } else {
                res.status(200).json({error: data.error});
            }
        });
        } catch (e) {
            log.error( "Ошибка "+ e + e.stack);
        }
    });



//  прием измененных данных из мэп контроллера через поин индекс контроллер
// Если это первые данные, приняли и вернули ок.
// Если какие-то данные уже были, то мы их объединяем, перезаписывая ранее сохранненные точки свежими версиями и добавлением новых точек.

//router.route('/saveupdate/')
//    .post(function (req, res) {
//        log.info('saveupdate');
//        var key = ""+req.session.login;
//        var currentCompany = companyLogins[key];
//        res.status(200).json({status: 'ok'});
//        if( !([currentCompany] in updateCacshe) ){
//            updateCacshe[currentCompany] = {};
//        }
//        if( !( req.body.date in updateCacshe[currentCompany]) ){
//            updateCacshe[currentCompany][req.body.date] = [];
//            updateCacshe[currentCompany][req.body.date] = req.body;
//        }else {
//            // Полученные данные нужно объедеенить с существующими на данный момент, которые были получены ранее
//            // так как иногда у стопа может быть id=0, который потом измениться, а TASK_NUMBER не уникальный, приходится создавать
//            // новые параметры newID oldID и сравнивать по ним.
//                var obj=req.body;
//                var i=0;
//                while (i<obj.data.length){
//                    var exist=false;
//                    var newID;
//                    if(obj.data[i] && obj.data[i].id!=undefined) newID=""+obj.data[i].lat+obj.data[i].lon+obj.data[i].t1;
//                    if(obj.data[i] && obj.data[i].TASK_NUMBER) newID=""+obj.data[i].TASK_NUMBER+obj.data[i].TASK_DATE;
//                    var j=0;
//                    //log.info("updateCacshe[req.session.login]", updateCacshe[req.session.login])
//                    while(j<updateCacshe[currentCompany][req.body.date].data.length){
//                        var oldID;
//                        if(updateCacshe[currentCompany][req.body.date].data[j] && updateCacshe[currentCompany][req.body.date].data[j].id!=undefined) oldID=""+updateCacshe[currentCompany][req.body.date].data[j].lat+updateCacshe[currentCompany][req.body.date].data[j].lon+updateCacshe[currentCompany][req.body.date].data[j].t1;
//                        if(updateCacshe[currentCompany][req.body.date].data[j] && updateCacshe[currentCompany][req.body.date].data[j].TASK_NUMBER) oldID=""+updateCacshe[currentCompany][req.body.date].data[j].TASK_NUMBER+updateCacshe[currentCompany][req.body.date].data[j].TASK_DATE;
//                        if(newID==oldID){
//                            //log.info("i=", i, "ID=", newID, 'j=', j, "oldID=", oldID);
//                            updateCacshe[currentCompany][req.body.date].data[j]=obj.data[i];
//                            exist=true;
//                        }
//                        j++;
//                    }
//                    if(!exist) {
//                       // log.info("Adding new point/stop")
//                        updateCacshe[currentCompany][req.body.date].data.push(obj.data[i])
//                    }
//                    delete newID;
//                    i++;
//                }
//            updateCacshe[currentCompany][req.body.date] = req.body;
//
//        }
//
//
//        // if(  ([req.session.login] in updateCacshe) && (req.body.date in updateCacshe[req.session.login]) ){
//        //     updateCacshe[req.session.login] = {};
//        //     updateCacshe[req.session.login] = req.body;
//        // }else{
//        //     updateCacshe[req.session.login][req.body.date] = [];
//        //     updateCacshe[req.session.login] = req.body;
//        // }
//        // res.status(200).json({status: 'ok'});
//
//
//        //if(updateCacshe[req.session.login]==undefined || updateCacshe[req.session.login].length==0){
//
//        // if( !(req.session.login in updateCacshe) ){
//        //     updateCacshe[req.session.login] = {};
//        // }
//        // updateCacshe[req.session.login][req.body.date] = {};
//        // updateCacshe[req.session.login][req.body.date] = JSON.parse(JSON.stringify(req.body));
//        //
//        // log.info(updateCacshe);
//        //
//        //     res.status(200).json({status: 'ok'});
//        //     return;
//        //
//        //}
//        //res.status(200).json({status: 'ok'});
//        // Полученные данные нужно объедеенить с существующими на данный момент, которые были получены ранее
//        // так как иногда у стопа может быть id=0, который потом измениться, а TASK_NUMBER не уникальный, приходится создавать
//        // новые параметры newID oldID и сравнивать по ним.
//    //     var obj=req.body;
//    //     var i=0;
//    //     while (i<obj.data.length){
//    //         var exist=false;
//    //         var newID;
//    //         if(obj.data[i] && obj.data[i].id!=undefined) newID=""+obj.data[i].lat+obj.data[i].lon+obj.data[i].t1;
//    //         if(obj.data[i] && obj.data[i].TASK_NUMBER) newID=""+obj.data[i].TASK_NUMBER+obj.data[i].TASK_DATE;
//    //         var j=0;
//    //         //log.info("updateCacshe[req.session.login]", updateCacshe[req.session.login])
//    //         while(j<updateCacshe[req.session.login].data.length){
//    //             var oldID;
//    //             if(updateCacshe[req.session.login].data[j] && updateCacshe[req.session.login].data[j].id!=undefined) oldID=""+updateCacshe[req.session.login].data[j].lat+updateCacshe[req.session.login].data[j].lon+updateCacshe[req.session.login].data[j].t1;
//    //             if(updateCacshe[req.session.login].data[j] && updateCacshe[req.session.login].data[j].TASK_NUMBER) oldID=""+updateCacshe[req.session.login].data[j].TASK_NUMBER+updateCacshe[req.session.login].data[j].TASK_DATE;
//    //             if(newID==oldID){
//    //                 //log.info("i=", i, "ID=", newID, 'j=', j, "oldID=", oldID);
//    //                 updateCacshe[req.session.login].data[j]=obj.data[i];
//    //                 exist=true;
//    //             }
//    //             j++;
//    //         }
//    //         if(!exist) {
//    //            // log.info("Adding new point/stop")
//    //             updateCacshe[req.session.login].data.push(obj.data[i])
//    //         }
//    //         delete newID;
//    //         i++;
//    //     }
//    //
//    });
//



// получение с роутера планового трека и времен проезда по всем маршрутам по логину в сессии
router.route('/routerdata')
    .get(function (req, res) {
        try {
        var key = ""+req.session.login;
        var currentCompany = companyLogins[key];
        var routeIndx = req.query.routeIndx,
            cData = cashedDataArr[currentCompany],
            sended = false,
            checkFunc = function (data, callback) {
                log.info('checkFunc', cData.routes[routeIndx].plan_geometry_loaded, cData.routes[routeIndx].time_matrix_loaded, !sended);
                if (cData.routes[routeIndx].plan_geometry_loaded && cData.routes[routeIndx].time_matrix_loaded && !sended) {
                    callback(data);
                }
            },
            callback = function (data) {
                sended = true;
                log.info('routerdata callback');
                res.status(200).json({
                    geometry: data.routes[routeIndx].plan_geometry,
                    time_matrix: data.routes[routeIndx].time_matrix
                });
            };

        log.info('routerdata', routeIndx);
        tracksManager.getRouterData(cData, routeIndx, -1, checkFunc, callback, true);
        } catch (e) {
            log.error( "Ошибка "+ e + e.stack);
        }
    });

// получение матрицы расстояний с роутера
router.route('/getroutermatrix/:points')
    .get(function (req, res) {
        try {
        //log.info('getmatrix', req.params.points);
        log.info('getmatrix for route to recalc');
        tracksManager.getRouterMatrixByPoints(req.params.points, function (data) {
            res.status(200).json(data);
        });
        } catch (e) {
            log.error( "Ошибка "+ e + e.stack);
        }
    });

// открытие окна задачи в 1С IDS
router.route('/openidspointwindow/:pointId')
    .get(function (req, res) {
        try {
        log.info('openidspointwindow mtm router');
        var soapManager = new soap(req.session.login);
        soapManager.openPointWindow(req.session.login, req.params.pointId);
        res.status(200).json({status: 'ok'});
        } catch (e) {
            log.error( "Ошибка "+ e + e.stack);
        }
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
        try{
        if (req.session.login == null || req.session.login ==undefined) {
            res.status(401).json({status: 'Unauthorized'});
            return;
            //req.session.login = config.soap.defaultClientLogin;
        }

        log.info("приняли данные на роутере");
        var key = ""+req.session.login;
        var currentCompany = companyLogins[key];
        log.toFLog("/logging.txt", req.body.closeDayData);
        log.info ("start working");
        var soapManager = new soap(req.session.login);
            soapManager.closeDay(req.body.closeDayData, function (data) {
                if (!data.error) {
                    res.status(200).json({result: data.result, closeCount:req.body.routesID.length, CloseDate:req.body.closeDayDate });
                    //if(req.body.update) { // перезаписать сегодняшний день
                    //        closeRoutesUniqueID[currentCompany] = [];
                    //    log.info(req.body);
                    //    closeRoutesUniqueID[currentCompany] = JSON.parse(JSON.stringify(req.body.routesID));
                    //}else {
                    //    if (currentCompany in oldRoutesCache && req.body.closeDayDate in oldRoutesCache[currentCompany]){
                    //        for (var i = 0; req.body.routesID.length > i; i++) {
                    //            for (var j = 0; oldRoutesCache[currentCompany][req.body.closeDayDate].routes.length > j; j++) {
                    //                if (req.body.routesID[i] == oldRoutesCache[currentCompany][req.body.closeDayDate].routes[j]['uniqueID']) {
                    //                    oldRoutesCache[currentCompany][req.body.closeDayDate].routes.splice(j, 1);
                    //                    j--;
                    //                    log.info('CLOSEROUTE');
                    //                    break;
                    //                }
                    //            }
                    //        }
                    //        if(oldRoutesCache[currentCompany][req.body.closeDayDate].routes.length == 0){
                    //            delete oldRoutesCache[currentCompany][req.body.closeDayDate];
                    //        }
                    //    }
                    //}
                } else {
                    res.status(200).json({error: data.error});
                }
            });
        } catch (e) {
            log.error( "Ошибка "+ e + e.stack);
        }
    });







// логировать что-нибудь в БД
router.route('/log')
    .post(function (req, res) {
        try {
        db.logMessage(1, req.body.message, function (err, result) {
            res.status(200).json({error: err, result: result});
        });
        } catch (e) {
            log.error( "Ошибка "+ e + e.stack);
        }
    });

router.route('/test')
    .get(function (req, res) {
        try{
        log.info(req.session.login);
        res.status(200).json({sessionLogin: req.session.login});
        } catch (e) {
            log.error( "Ошибка "+ e + e.stack);
        }
    });


// догрузка стопов по маршруту на текущиймомент
router.route('/currentStops/:gid/:from/:to')
    .get(function (req, res) {
        try {
        log.info("Start load stops", req.session.login);
        tracksManager.getStops(req.params.gid,  req.params.from, req.params.to, function(rData){
           // log.info("rData", rData, "END rDAta, mtm 475");
            res.status(200).json(rData);
        });
        } catch (e) {
            log.error( "Ошибка "+ e + e.stack);
        }
    });






// получение срочной заявки
router.route('/UrgentOrder/')
    .post(function (req, res) {
        try {

            log.info("!!!!Recieve URGENT ORDER!!!! ", req.body);
            res.status(200).json('ок');

        } catch (e) {
            log.error( "Ошибка "+ e + e.stack);
        }
    });


// получение всех таймматриц для всех роутов одним запросом.
router.route('/predicate/')
    .post(function (req, res) {
        try{

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
           // log.info(pointsStr);

            //запрос матрицы по одному маршруту с обработкой в колбэке.
            tracksManager.getRouterMatrixByPoints(pointsStr, function (data, pointsStr) {
                //log.info(pointsStr);
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
                //log.info(LAT, " ", LON);
                var k=0;
                while (k<collection.length){
                        if(LAT==collection[k].points[0].LAT && LON==collection[k].points[0].LON){
                        indx=collection[k].id;
                            //log.info("find id", indx);
                        break;
                    }
                    k++
                }
                generalResult.push({id:indx, time: timeMatrix});
                // Проверка не является ли этот колбек последним.
                if(generalResult.length==collection.length)
                {
                    //log.info("The cickle is finished RESULT LENGTH=", generalResult.length );
                    res.status(200).json(generalResult);
                    return;
                }
            });



            j++;
        }
        } catch (e) {
            log.error( "Ошибка "+ e + e.stack);
        }
    });

// замена водителя
router.route('/changedriver/')
    .post(function (req, res) {
        try {
        //log.info('gettracksbystates ', req.body.routes[0], "MTM 750");
        //log.info("cashedDataArr[req.session.login]", cashedDataArr[req.session.login].routes, "MTM 751");
        // Перезапись в кеше маршрута отредактированного в мониторинге
        var i=0;
        req.body.routes[0].filterId=null;
        var key = ""+req.session.login;
        var currentCompany = companyLogins[key];
        while(i<cashedDataArr[currentCompany].routes.length){
            if(cashedDataArr[currentCompany].routes[i].uniqueID == req.body.routes[0].uniqueID){
                cashedDataArr[currentCompany].routes[i] = req.body.routes[0];
                cashedDataArr[currentCompany].routes[i].filterId=null;
                //log.info("Overwright Route");
                break;
            }


            i++;
        }

        //tracksManager.getTrackByStates(req.body.states, req.body.gid, req.body.demoTime, function (data) {
        //    log.info('get tracks by states DONE!');
        //    res.status(200).json(data);
        //});

        //Если произошло разделение маршрутов, нужно добавить новый к списку.
        if(req.body.routes[1] != undefined){
            req.body.routes[1].filterId=null;
            cashedDataArr[currentCompany].routes.push(req.body.routes[1]);
        }

        res.status(200).json("ok");
        } catch (e) {
            log.error( "Ошибка "+ e + e.stack);
        }
    });



router.route('/savetonode/')
    .post(function (req, res) {
        try {
        log.info("Приступаем к сохранению роута");
        var i=0;
        var id = parseInt(req.body.route.uniqueID);
        var key = ""+req.session.login;
        var currentCompany = companyLogins[key];
        log.info("Приступаем к сохранению роута", i, id, currentCompany);
        while(cashedDataArr[currentCompany].blocked_routes != undefined && i<cashedDataArr[currentCompany].blocked_routes.length){
                if(cashedDataArr[currentCompany].blocked_routes[i].uniqueID == id){
                    cashedDataArr[currentCompany].blocked_routes[i] = req.body.route;
                    log.info("Overwright Route");
                    cashedDataArr[currentCompany].routes.push(cashedDataArr[currentCompany].blocked_routes[i]);
                    var uniqueId = cashedDataArr[currentCompany].blocked_routes[i].uniqueID;
                    unblockRoute(key, uniqueId);
                    cashedDataArr[currentCompany].blocked_routes.splice(i,1);
                    res.status(200).json(id);
                    return;
            }

            i++;
        }

        function unblockRoute(login, uniqueId) {
                     for (var i=0; i<blockedRoutes.length; i++) {
                if (blockedRoutes[i].id == uniqueId && blockedRoutes[i].login == login) {
                    log.info("снимаем блокировку с роута", uniqueId);
                    blockedRoutes.splice(i, 1);
                }

            }

        }


        if (cashedDataArr[currentCompany].oldRoutes != undefined) {
        while(i<cashedDataArr[currentCompany].oldRoutes.length){
            if(cashedDataArr[currentCompany].oldRoutes[i].uniqueID == id){
                cashedDataArr[currentCompany].oldRoutes[i] = req.body.route;
                log.info("Overwright OLD Route");

                uniqueId = cashedDataArr[currentCompany].oldRoutes[i].uniqueID;
                unblockRoute(key, uniqueId);

                res.status(200).json(id);
                return;
            }

            i++;
        }
        }

        res.status(200).json("error");
        } catch (e) {
            log.error( "Ошибка "+ e + e.stack);
        }
    });


//router.route('/checknewiten')
//    .get(function (req, res) {
//        log.info("check New Iten in Progress");
//
//        // присвоение лоина для прогрузки интерфейса при запуске вне окна  (для отладки)
//        if (req.session.login == null || req.session.login == undefined) {
//            log.info("Login", req.session.login);
//            res.status(401).json({status: 'Unauthorized'});
//            return;
//            //req.session.login = config.soap.defaultClientLogin;
//        }
//
//        var key = ""+req.session.login;
//        var currentCompany = companyLogins[key];
//        var cache = cashedDataArr[currentCompany];
//        var existIten = cashedDataArr[currentCompany].idArr.length;
//
//        var soapManager = new soap(req.session.login);
//        soapManager.getAdditionalDailyPlan(dataReadyCallback, req.query.showDate);
//
//
//        function dataReadyCallback (quant){
//            log.info("QUANT", quant, "req.session", cache.CLIENT_NAME, "____ ", cache.CLIENT_ID);
//            //for (var key in cache){
//            //    log.info ("key", key);
//            //}
//
//
//        }
//
//            res.status(200).json("ok");
//    });

router.route('/logout')
    .post(function (req, res) {
        try {
        if (req.session.login == undefined) return;
        log.info("!!!!!!!!!!LOGOUT!!!!!!!", req.session.login);
        var i=0;
        while(i<blockedRoutes.length){
            if( ""+blockedRoutes[i].login == ""+req.session.login){
                log.info("$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$", req.session.login, "logouting");
                var uniqueId = blockedRoutes[i].id;
                var company = blockedRoutes[i].company;
                for(var j=0; j<cashedDataArr[company].blocked_routes.length; j++){
                    if(cashedDataArr[company].blocked_routes[j].uniqueID == uniqueId){
                        log.info("Возврат роута из заблокированных в нормальные");
                        cashedDataArr[company].routes.push(cashedDataArr[company].blocked_routes[j]);
                        cashedDataArr[company].blocked_routes.splice(j,1);
                        break;
                    }
                }

                blockedRoutes.splice(i,1);
                i--;

            }

            i++;
        }

        i=0;
        while(i<blockedRoutes.length){
            log.info("Third blocking", blockedRoutes[i]);
            i++;
        }
        log.info("Logout complete");
        res.status(200).json("ok");
        } catch (e) {
            log.error( "Ошибка "+ e + e.stack);
        }
    });

//тестовая функция показывает по логину kalko некоторые параметры сервера

router.route('/getServerStatus')
    .get(function(req, res) {
        try {
        //log.info("Router");
        var key = "" + req.session.login;
        var login=key;
        var currentCompany = companyLogins[key];
        var result={};
        result.company = currentCompany;
        result.routes = cashedDataArr[currentCompany].routes.length;
        result.blocked_routes = cashedDataArr[currentCompany].blocked_routes ? cashedDataArr[currentCompany].blocked_routes.length : 0;
        result.line_routes = cashedDataArr[currentCompany].line_routes.length;
        result.oldRoutes = 0;
            result.online= " ";
            for (var i =0; i<onlineClients.length; i++) {
                //console.log("ONLINE", onlineClients[i]);
                result.online+= onlineClients[i].login + "  ";
                //console.log("Result", result.online);
            }
        if (cashedDataArr[currentCompany].oldRoutes != undefined) result.oldRoutes = cashedDataArr[currentCompany].oldRoutes.length;
        //log.info("Result ", result);
        res.status(200).json({result :result});
        } catch (e) {
            log.error( "Ошибка "+ e + e.stack);
        }
    });


//need - количество необходимых оператору проблем. Указывается в настройках
router.route('/askforproblems/:need')
    .get(function (req, res) {
        try{
        //log.info("пришел запроc", req.params.need);
        if (req.params.need == NaN) return;
        var result = {};
        var key = "" + req.session.login;
        var login=key;
        var currentCompany = companyLogins[key];
        var need = parseInt((req.params.need).substring(1));
        log.info("ASk For ", need, "Problem", req.session.login);
        if(need <0){
            res.status(400).json("Need degree zerro");
            return;
        }

        if (cashedDataArr[currentCompany] == undefined) {
            res.status(400).json("Company undefined");
            return;
        }





       // log.info("Проблемных роутов", cashedDataArr[currentCompany].line_routes.length);
        //TODO переписать условие когда начнет правильно формировать очередь проблемных роутов
        if (cashedDataArr[currentCompany].line_routes != undefined) {
            log.info("Ищем проблемму для для оператора");
            result = {};
            result.routes = [];
            //Сначала просмотрим в заблокированных роутах. Возможно этот роут уже был выбран оператором и он случайно нажал эскейп, не сохранившись
            if (cashedDataArr[currentCompany].blocked_routes != undefined) {
                log.info("Ищем не блокировал ли этот оператор маршруты?");
                //todo тестовый блок
                log.info("Заблокированные сейчас маршруты");
                for(var i=0; i<blockedRoutes.length;i++){
                    log.info("Check blocked", blockedRoutes[i] );
                }

                var toOperator = [];
                for (i = 0; i < blockedRoutes.length; i++) {
                    if (blockedRoutes[i].company == currentCompany && blockedRoutes[i].login == login) {
                        toOperator.push(blockedRoutes[i].id);
                    }
                }

                log.info ("Оператором уже заблокировано", toOperator);
                if (toOperator.length > 0) {


                    result.ID = cashedDataArr[currentCompany].ID;
                    result.server_time = parseInt(Date.now() / 1000);
                    result.allRoutes = [];
                    result.allRoutes = cashedDataArr[currentCompany].allRoutes;
                    result.reasons = cashedDataArr[currentCompany].reasons;
                    result.settings = cashedDataArr[currentCompany].settings;
                    result.drivers = cashedDataArr[currentCompany].drivers;
                    result.transports = cashedDataArr[currentCompany].transports;
                    result.companyName = currentCompany;
                    result.statistic = cashedDataArr[currentCompany].statistic;
                    result.settings.user = "" + req.session.login;
                    result.currentDay = true;

                    for (i = 0; i < toOperator.length; i++) {
                        for (var j = 0; j < cashedDataArr[currentCompany].blocked_routes.length; j++) {
                            log.info("" + toOperator[i], "" + cashedDataArr[currentCompany].blocked_routes[j].uniqueID);
                            if ("" + toOperator[i] == "" + cashedDataArr[currentCompany].blocked_routes[j].uniqueID) {
                                log.info("Добавляем маршрут");
                                result.routes.push(cashedDataArr[currentCompany].blocked_routes[j]);

                            }
                        }


                    }

                    // log.info("Result", result.routes[0].uniqueID);
                    if (result.routes.length == need) {
                        log.info("Все запрашиваемые маршруты уже были заблокированы этим пользователем");
                        res.status(200).json(result);
                        return;
                    }


                }
            }


            if (result.routes == undefined || result.routes.length == 0) {
                result.routes = [];
                result.allRoutes = cashedDataArr[currentCompany].allRoutes;
                result.server_time = parseInt(Date.now() / 1000);
                result.currentDay = true;
                result.drivers = cashedDataArr[currentCompany].drivers;
                result.transports = cashedDataArr[currentCompany].transports;
                result.reasons = cashedDataArr[currentCompany].reasons;
            }
            log.info("Need=", need);
            if (need != 1){


                while (result.routes.length < need) {
                    //Если у оператора нет заблокированного маршрута ищем, что ему дать из проблем
                    log.info("Выбираем новую проблемму");
                    i = choseRouteForOperator(currentCompany, login);

                    if ( i< 0 &&  result.routes.length>0){
                        log.info("Нашли проблемм сколько могли");
                        res.status(200).json(result);
                        return;
                    }


                    if (i < 0) {
                        result.nowTime = parseInt(Date.now()/1000);
                        result.statistic = cashedDataArr[currentCompany].statistic;
                        result.ID = cashedDataArr[currentCompany].ID;
                        result.server_time = parseInt(Date.now() / 1000);
                        result.companyName = currentCompany;
                        result.settings = cashedDataArr[currentCompany].settings;
                        result.drivers = cashedDataArr[currentCompany].drivers;
                        result.transports = cashedDataArr[currentCompany].transports;
                        result.settings.user = "" + req.session.login;
                        result.reasons = cashedDataArr[currentCompany].reasons;
                        //надо отдать маршрут из старых на закрытие
                        //var existOld = choseRouteForClose(currentCompany);
                        //if (existOld === false) {
                        // Нет роутов на раздачу, выдаем статистику


                        res.status(200).json(result);
                        return;

                    }


                    result.ID = cashedDataArr[currentCompany].ID;
                    result.routes.push(cashedDataArr[currentCompany].line_routes[i]);
                    result.server_time = parseInt(Date.now() / 1000);
                    result.companyName = currentCompany;
                    result.reasons = cashedDataArr[currentCompany].reasons;
                    result.settings = cashedDataArr[currentCompany].settings;
                    result.settings.user = "" + req.session.login;
                    result.drivers = cashedDataArr[currentCompany].drivers;
                    result.transports = cashedDataArr[currentCompany].transports;
                    result.statistic = cashedDataArr[currentCompany].statistic;

                    var indx = cashedDataArr[currentCompany].line_routes[i].filterId;
                    for (var k=0; k< cashedDataArr[currentCompany].routes.length; k++){
                        if(cashedDataArr[currentCompany].routes[k].filterId == indx){
                            cashedDataArr[currentCompany].routes.splice(k,1);
                            break;
                        }
                    }


                    cashedDataArr[currentCompany].line_routes.splice(i, 1);

                }

            } else {
                log.info("нужна всего одна новая проблемма");
                log.info("Выбираем новую проблемму");
                i = choseRouteForOperator(currentCompany, login);

                if (i < 0) {
                    res.status(200).json("All problem routes blocked");
                    return;
                }


                result.ID = cashedDataArr[currentCompany].ID;
                result.routes.push(cashedDataArr[currentCompany].line_routes[i]);
                result.companyName = currentCompany;
                result.reasons = cashedDataArr[currentCompany].reasons;
                result.server_time = parseInt(Date.now() / 1000);
                result.drivers = cashedDataArr[currentCompany].drivers;
                result.transports = cashedDataArr[currentCompany].transports;
                result.statistic = cashedDataArr[currentCompany].statistic
                //cashedDataArr[currentCompany].blocked_routes.push(cashedDataArr[currentCompany].line_routes[i]);
                //blockedRoutes.push({id: "" + cashedDataArr[currentCompany].line_routes[i].uniqueID, company: currentCompany, login: login, time: parseInt(Date.now()/1000)})
                changePriority(cashedDataArr[currentCompany].line_routes[i].uniqueID, currentCompany, login);
                result.settings = cashedDataArr[currentCompany].settings;
                result.settings.user = "" + req.session.login;
                cashedDataArr[currentCompany].line_routes.splice(result, 1);

            }
        }
        else
        {

            if (cashedDataArr[currentCompany].line_routes == undefined || cashedDataArr[currentCompany].line_routes.length == 0){
                result ={};
                result.statistic=cashedDataArr[currentCompany].statistic;
                result.nowTime = parseInt(Date.now()/1000);
                result.companyName = currentCompany;
                res.status(200).json(result);
                return;
            } else {
                result = cashedDataArr[currentCompany];}
            }

        result.allRoutes = cashedDataArr[currentCompany].allRoutes;
        result.currentDay = true;
            result.drivers = cashedDataArr[currentCompany].drivers;
            result.transports = cashedDataArr[currentCompany].transports;
        //Перед отправкой проверка на задвоенность маршрутов


        result.reasons = cashedDataArr[currentCompany].reasons;
        log.info("Result length", result.routes.length);
        res.status(200).json(result);
        } catch (e) {
            log.error( "Ошибка "+ e + e.stack);
        }
    });


//Каждую минуту клиент подтверждает на сервер, что он online
// Если такого подтверждения нет более 3 минут, считаем, что юзер закрыл клиент
router.route('/confirmonline')
    .post(function (req, res) {
        try {
        if(req.session.login == undefined) return;
        log.info("online confirmed", req.session.login, req.body);
        var blockedArr = req.body;
        var key = ""+req.session.login;
        var currentCompany = companyLogins[key];
        var err = checkSync(currentCompany, req.session.login, blockedArr);
        if (onlineClients.length == 0) {
            var obj = {time: parseInt(Date.now() / 1000), login: req.session.login, company: currentCompany};
            onlineClients.push(obj);
            var result={};
            result.server_time = parseInt(Date.now() / 1000);
            if (cashedDataArr[currentCompany] != undefined && cashedDataArr[currentCompany].statistic != undefined) result.statistics = cashedDataArr[currentCompany].statistic;
            result.status = 'ok';
            result.allRoutes = cashedDataArr[currentCompany].allRoutes;

            res.status(200).json(result);
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
            obj = {time: parseInt(Date.now() / 1000), login: req.session.login, company: currentCompany};
            onlineClients.push(obj);
        }

        for ( i = 0; i < onlineClients.length; i++) {
            //log.info("Online now", onlineClients[i]);

        }
        for ( i = 0; i < blockedRoutes.length; i++) {
            //log.info("Blocked now", blockedRoutes[i]);

        }

        result={};
        result.server_time = parseInt(Date.now() / 1000);
        result.statistics = cashedDataArr[currentCompany].statistic;
        result.status = 'ok';
        result.err = err;
            result.allRoutes = cashedDataArr[currentCompany].allRoutes;

        res.status(200).json(result);
        } catch (e) {
            log.error( "Ошибка "+ e + e.stack);
        }
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
    try {
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
    } catch (e) {
        log.error( "Ошибка "+ e + e.stack);
    }
}



// Функция вытягивающая ФИО водителя из его карточки.
function cutFIO(fioStr) {
    try {
    fioStr = fioStr.replace(/_/g, " ");
    var parts = fioStr.split(' ');
    return ( (parts[0]) ? parts[0] + ' ' : "" ) + ( (parts[1]) ? parts[1] : "" );
    } catch (e) {
        log.error( "Ошибка "+ e + e.stack);
    }
}

// Перевод строковой даты в таймстамп
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

function linkDataParts (currentCompany, login) {
    try {
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
    cashedDataArr[currentCompany].last_track_update = parseInt(Date.now()/1000);

    //var soapManager = new soap(login);
    //soapManager.getNewConfig(login, function (data) {
    //    log.info("receiveConfig", data);
    //    var obj = JSON.parse(data.return);
    //    log.info("Obj",  obj.predictMinutes, "mtm 1192")
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
                    //log.info('data.routes[i]', data.routes[i]);
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
        //    log.info(data.routes[i].DRIVER);
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

                    nameDriver: ( ( cashedDataArr[currentCompany].routes[i].hasOwnProperty('driver') && cashedDataArr[currentCompany].routes[i].driver.hasOwnProperty('NAME') ) ? cashedDataArr[currentCompany].routes[i].driver.NAME : 'без имени') +  " " + cashedDataArr[currentCompany].routes[i].SHIFT_NAME + ' - ' + cashedDataArr[currentCompany].routes[i].transport.NAME,
                    nameCar: cashedDataArr[currentCompany].routes[i].transport.NAME + " " + cashedDataArr[currentCompany].routes[i].SHIFT_NAME + ' - ' + ( ( cashedDataArr[currentCompany].routes[i].hasOwnProperty('driver') && cashedDataArr[currentCompany].routes[i].driver.hasOwnProperty('NAME') ) ? cashedDataArr[currentCompany].routes[i].driver.NAME : 'без имени'),


                    value: cashedDataArr[currentCompany].routes[i].filterId,
                    uniqueID: cashedDataArr[currentCompany].routes[i].uniqueID,


                    car: cashedDataArr[currentCompany].routes[i].transport.NAME,
                    driver: ( cashedDataArr[currentCompany].routes[i].hasOwnProperty('driver') && cashedDataArr[currentCompany].routes[i].driver.hasOwnProperty('NAME') ) ? cashedDataArr[currentCompany].routes[i].driver.NAME : 'без имени' + i //!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!добавили свойство driver для события в closeDriverName
                });
                //  log.info(scope.filters.routes, ' filters.routes');
                routeId++;
            }


            try {
                tPoint.route_indx = cashedDataArr[currentCompany].routes[i].filterId;
                var trans = JSON.parse(JSON.stringify(cashedDataArr[currentCompany].routes[i].transport))
                delete trans.real_track;
                tPoint.transport = trans;

                if (cashedDataArr[currentCompany].routes[i].DISTANCE == 0) {
                    //log.info("The route is UNCALCULATE");


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
                    //log.info("!!!!!The route is Very Good CALCULATE!!!!");
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
                log.info( tPoint, "Error mtm 1874");
                log.info(tPoint.driver.NAME, e);
               // log.info("route", cashedDataArr[currentCompany].routes[i].points[0] );
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
                //log.info("Create PROMISED WINDOW step1");

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
                //log.info("Create PROMISED WINDOW step2");
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
                //log.info("Create PROMISED WINDOW step3");
                tPoint.promised_window_changed = JSON.parse(JSON.stringify(tPoint.promised_window));
            }


            createSeveralAviabilityWindows(tPoint);


            var workingWindowType = cashedDataArr[currentCompany].settings.workingWindowType;

            //log.info("Ищем ошибку в роуте", cashedDataArr[currentCompany].routes[i].driver.NAME);

            if (workingWindowType == 0) {
                tPoint.working_window = tPoint.orderWindows;


                if (tPoint.working_window == undefined) tPoint.working_window = tPoint.orderWindows;
            } else if (workingWindowType == 1) {
                tPoint.working_window =[];
                tPoint.working_window.push(tPoint.promised_window_changed);
            }

        }

        //log.info(cashedDataArr[currentCompany].currentProblems, "Problems 485");

    }

    //Удаление последнего стейта если он Каррент позитион
   // var size = cashedDataArr[currentCompany].routes.length;
    for (i=0; i<cashedDataArr[currentCompany].routes.length; i++){

        var route = cashedDataArr[currentCompany].routes[i];
        delete route.transport.real_track;
        if (route.real_track == undefined || route.real_track.length == 0) continue;
        var last = route.real_track.length-1;
        //log.info("last = ", last);
        if (route.real_track[last].state == 'CURRENT_POSITION') {
            route.real_track.length=last;
            //log.info("DELETE CURRENT POSITION");
        }
    }
    //cashedDataArr[currentCompany].routes.length = size;
    log.info("FINISHING LINKING", currentCompany, "маршрутов", cashedDataArr[currentCompany].routes.length, "всего маршрутов", cashedDataArr[currentCompany].allRoutes.length);
    checkCorrectCalculating(currentCompany);
    } catch (e) {
        log.error( "Ошибка "+ e + e.stack);
    }
}


// Каждые две минуты стартует расчет, которые проходит по всем решениям, которые сейчас присутствуют в кэше
function startPeriodicCalculating() {
    try {
    log.info("Начинаем периодический рассчет");

    var superEndTime = parseInt(Date.now()/1000); //TODO условный замер времени на 1 компании можно убивать, но вместе с парой, которая отмеряет финиш
    // Создаем список компаний, по которым нужно провести пересчет
    var companysToCalc=[];
    for(var company in cashedDataArr) {
        companysToCalc.push(company);
    }

    //todo пока отключена функция. По правильному оставить, но дописать расчет, когда кто-то заходит онлайн, если давно не было рассчетов.
    // Удаляем из списка компаний те, пользователи которых, не находятся online
    //for(var i=0; i<companysToCalc.length; i++){
    //    if (!checkOnline(companysToCalc[i])){
    //        log.info("Нет пользователей онлайн");
    //        companysToCalc.splice(i,1);
    //        i--;
    //    }
    //}

    // Удаляем из списка компаний те, получение данных и первичный рассчет по которым еще не закончен

    for(var i=0; i<companysToCalc.length; i++){
        log.info("Компания", companysToCalc[i], cashedDataArr[companysToCalc[i]].recalc_finishing);
        if ( !cashedDataArr[companysToCalc[i]].recalc_finishing){
            log.info("Первичный расчет еще не закончен");
            companysToCalc.splice(i,1);
            i--;
        }
    }

    //Удаляем из списка прошлые дни

    for( i=0; i<companysToCalc.length; i++){
        log.info("Компания", companysToCalc[i], cashedDataArr[companysToCalc[i]].currentDay);
        if (cashedDataArr[companysToCalc[i]].currentDay == false){
            log.info("Это прошлый день");
            companysToCalc.splice(i,1);
            i--;
        }
    }


    // Не считаем те компании, у которых размер роутов равен 0
    for(var i=0; i<companysToCalc.length; i++){
        if ((cashedDataArr[companysToCalc[i]].routes == undefined || cashedDataArr[companysToCalc[i]].routes.length == 0) && (cashedDataArr[companysToCalc[i]].line_routes == undefined || cashedDataArr[companysToCalc[i]].line_routes.length == 0)){
            log.info("У этой компании нет роутов на пересчет");
            companysToCalc.splice(i,1);
            i--;
        } else {
            if (cashedDataArr[companysToCalc[i]].line_routes != undefined) {
                cashedDataArr[companysToCalc[i]].routes = cashedDataArr[companysToCalc[i]].routes.concat(cashedDataArr[companysToCalc[i]].line_routes);
                cashedDataArr[companysToCalc[i]].line_routes.length = 0;
            }

        }
    }


    for(i=0; i<companysToCalc.length; i++){
            log.info("Компания на пересчет", companysToCalc[i]);
            checkOnline(companysToCalc[i]);

    }

    log.info("Вызов callbackDispetcher из startPeriodicCalculating");

    callbackDispetcher(companysToCalc);



    function callbackDispetcher(companys) {
        if (!company) return;

        for (var k=0; k<companys.length; k++) {
            middleTime = parseInt(Date.now()/1000);
            cashedDataArr[companys[k]].needRequests = cashedDataArr[companys[k]].idArr.length + 2; // Количество необходимых запрсов во внешний мир. Только после получения всех ответов, можно запускать пересчет *3 потому что мы просим пушиб треки и данные для предсказания
            log.info ("Готовимся выполнять запросы впереди их", cashedDataArr[companys[k]].needRequests, new Date() );
            cashedDataArr[companys[k]].allPushes=[];
            for (var itenQuant=0; itenQuant<cashedDataArr[companys[k]].idArr.length; itenQuant++) {
                    var iten = cashedDataArr[companys[k]].idArr[itenQuant];
                    var soapManager = new soap(cashedDataArr[companys[k]].firstLogin);
                    soapManager.getPushes(iten, parseInt(Date.now() / 1000), companys[k], function (company, data) {
                        log.info("2375 receivePUSHES!!!!! for iten", company);
                        if (data != undefined && data.error == undefined ){
                        var obj = JSON.parse(data.return);
                        //log.info("Obj", obj[0], "mtm 1497");
                        //delete cashedDataArr[company].allPushes;
                        cashedDataArr[company].allPushes= cashedDataArr[company].allPushes.concat(obj);}
                        cashedDataArr[company].needRequests--;
                        if (obj) log.info ("Получили", obj.length, "присоеденеили", cashedDataArr[company].allPushes.length);
                        log.info("GetPushes finished for company", company, cashedDataArr[company].needRequests);
                        if(cashedDataArr[company].needRequests == 0) startCalculateCompany(company);
                    });
            //
            }

            //TODO Заменить на запрс свежих стейтов и треков


            log.info('Start loading TrackParts',companys[k]);
            //if (req.session.login == undefined || req.session.login == null) {
            //    res.status(401).json({status: 'Unauthorized'});
            //    return;
            //}

            //var first = true;

            var end = parseInt(Date.now()/1000);
            var start = cashedDataArr[companys[k]].last_track_update;
            var dayStart = new Date();
            dayStart.setHours(0,0,0,0);
            dayStart=dayStart/1000;
            log.info("Midnight TimeStamp = ", dayStart);
            var companyAsk = companys[k];
                log.info("Check data", cashedDataArr[companyAsk].routes.length);
                tracksManager.getRealTrackParts(cashedDataArr[companyAsk], start, end,
                function (data, companyAsk) {
                   // if (!first) return;

                    // todo тестово отладочный блок
                    //checkeConcatTrack(companyAsk, 437123, data);
                    //checkeConcatTrack(companyAsk, 437323, data);

                    //log.info('getRealTrackParts DONE', data);
                    //first = false;

                    if (data =='error') {
                        //cashedDataArr[companyAsk].needRequests = cashedDataArr[companyAsk].needRequests+ 2+(cashedDataArr[companyAsk].idArr.length-1)*2;// todo костыль на  решения без датчиков.
                        //cashedDataArr[companyAsk].needRequests --;
                        log.info("Get Real TRACK finished for company Recieve ERROR", companyAsk, cashedDataArr[companyAsk].needRequests);
                        //dataForPredicate(companyAsk, startCalculateCompany);
                        if(cashedDataArr[companyAsk].needRequests == 0) startCalculateCompany(companyAsk);
                        //return;
                    }

                    for(i=0; i<data.length; i++){

                    if (typeof (data[i].data) == 'string') data[i].data =[];
                            //log.info("Stage 1", i, data[i]);
                        if (data[i] == undefined || data[i].data == undefined || data[i].data.length == 0) continue;



                        for (j=0; j<data[i].data.length; j++){
                            //log.info("Stage 2");
                           // log.info("Time == ", data[i].data[j].time);
                          if (data[i].data[j].time == 0 || data[i].data[j].time == '0' || data[i].data[j] == "error" ) {
                              //log.info("delete 0 time state");
                              data[i].data.splice(j,1);
                              j--;
                          }
                        }

                    }



                    var cached = cashedDataArr[companyAsk];
                    cashedDataArr[companyAsk].last_track_update = parseInt(Date.now()/1000);

                    if(cached) {
                        for (var i = 0; i < cached.routes.length; i++) {
                            for (var j = 0; j < data.length; j++) {
                                var toSave = data[j];
                                if (cached.routes[i].transport.gid == data[j].gid && data[j].data != cached.routes[i].real_track) {
                                    //TODO конкатенация свежих данных.

                                    //Первое слияние за день прописываем отдельно

                                    if ((cached.routes[i].real_track == undefined || cached.routes[i].real_track.length < 2 || cached.routes[i].real_track == "invalid parameter 'gid'. ")) {

                                        if (data[j].data.length<2)  continue;

                                        log.info("№;№;№;№;;№;№;№;№;Записываем Первые данные№;№;№;№;№;№;№;№");
                                        cached.routes[i].real_track = data[j].data;

                                    continue;
                                    }


                                   // var size = data[j].data.length;
                                   //log.info("____________________________________")
                                   // for (var f=data[j].data.length; f>=0; f--){
                                   //    log.info("New Track", data[j].data[f-1]);
                                   //     log.info("Old track", cached.sensors[i].real_track[cached.sensors[i].real_track.length-1-(size-f)] );
                                   // }


                                    if ((cached.routes[i].real_track == undefined || cached.routes[i].real_track.length == 0) && (data[j].data[0] != undefined)){
                                        cached.routes[i].real_track = data[j].data;
                                        //log.info("(cached.sensors[i].real_track == undefined || cached.sensors[i].real_track.length == 0) && (data[j].data[0] != undefined)");
                                        continue;
                                    }

                                    if(data[j].data[0] == undefined || data[j].data == 'error') {
                                    //log.info("data[j].data[0] == undefined");
                                        continue;
                                    }




                                    //Убираем последний стейт в треке, если его id ==0
                                    if (cached.routes[i].real_track[cached.routes[i].real_track.length-1].id == '0') {
                                        cached.routes[i].real_track.length = cached.routes[i].real_track.length-1;
                                        if(cached.routes[i].real_track.length ==0) continue;
                                    }


                                    //Убираем первый ш последний стейт в полученных данных, если его id ==0

                                    if (data[j].data[0].id == '0' || data[j].data[0].id == 0) {

                                        //log.info("ID первого полученного стейта 0, всего получено стейтов", data[j].data.length);
                                        data[j].data.splice(0,1);
                                        if(data[j].data.length == 0 ) continue;
                                    }


                                    if (data[j].data[data[j].data.length-1].id == '0' || data[j].data[data[j].data.length-1].id == 0) {

                                        //log.info("ID последнего стейта 0, всего получено стейтов", data[j].data.length);
                                        data[j].data.splice(data[j].data.length-1,1);
                                        if(data[j].data.length == 0 ) continue;
                                    }

                                    //var idx = cached.routes[i].real_track.length-1;
                                    //var flag = 0;
                                    //while (cached.routes[i].real_track[idx] != undefined && flag<2){
                                    //    log.info("Последние треки", cached.routes[i].real_track[idx]);
                                    //    idx--;
                                    //    flag++;
                                    //}
                                    //
                                    //log.info("Полученные данные", data[j].data);

                                    if ( data[j].data[0].id+'' == cached.routes[i].real_track[cached.routes[i].real_track.length-1].id+"" ){
                                               if(data[j].data[0].t1) cached.routes[i].real_track[cached.routes[i].real_track.length-1].t1 = data[j].data[0].t1;
                                               if (data[j].data[0].t2) cached.routes[i].real_track[cached.routes[i].real_track.length-1].t2 = data[j].data[0].t2;
                                                if (data[j].data[0].lat) cached.routes[i].real_track[cached.routes[i].real_track.length-1].lat = data[j].data[0].lat;
                                                if (data[j].data[0].lon) cached.routes[i].real_track[cached.routes[i].real_track.length-1].lon = data[j].data[0].lon;
                                                if (data[j].data[0].dist)cached.routes[i].real_track[cached.routes[i].real_track.length-1].dist = data[j].data[0].dist;
                                                if (data[j].data[0].time) cached.routes[i].real_track[cached.routes[i].real_track.length-1].time = data[j].data[0].time;
                                        data[j].data.splice(0,1);
                                        if (data[j].data.length >0) {
                                            //log.info("Дописываем стейты", cached.routes[i].driver.NAME, cached.routes[i].real_track.length, data[j].data.length );
                                            for (var g=0; g<data[j].data.length; g++){
                                                cached.routes[i].real_track.push(data[j].data[g]);
                                            }
                                            //cached.routes[i].real_track.concat(data[j].data);
                                            //log.info("Стейтов стало", cached.routes[i].real_track.length);
                                        }

                                    } else {
                                        //log.info("Какой-то невероятный случай!", cached.routes[i].real_track[cached.routes[i].real_track.length-1], data[j].data[0], data[j].data.length);

                                        //Убираем стейты, которые мы уже получали раньше и которые у нас записаны
                                        var t=0;
                                        while(data[j].data[0] != undefined && ""+cached.routes[i].real_track[cached.routes[i].real_track.length-1].id != ""+data[j].data[t].id){
                                            //log.info("Сравниваем", cached.routes[i].real_track[cached.routes[i].real_track.length-1], data[j].data[t]);
                                            if (""+cached.routes[i].real_track[cached.routes[i].real_track.length-1].id != ""+data[j].data[t].id)
                                            {
                                                data[j].data.splice(t,1);
                                                t--;
                                            }
                                            t++;
                                        }

                                        //log.info("Отбросы закончены", cached.routes[i].real_track[cached.routes[i].real_track.length-1], data[j].data[0]);


                                        if(data[j].data.length == 0 || data[j].data == undefined) continue;
                                        // Если уже вручную связали этот стейт с какой либо точкой
                                        if (data[j].data[0])
                                            if (data[j].data[0].t1) cached.routes[i].real_track[cached.routes[i].real_track.length-1].t1 = data[j].data[0].t1;
                                            if (data[j].data[0].t2) cached.routes[i].real_track[cached.routes[i].real_track.length-1].t2 = data[j].data[0].t2;
                                            if (data[j].data[0].lat) cached.routes[i].real_track[cached.routes[i].real_track.length-1].lat = data[j].data[0].lat;
                                            if (data[j].data[0].lon) cached.routes[i].real_track[cached.routes[i].real_track.length-1].lon = data[j].data[0].lon;
                                            if (data[j].data[0].dist) cached.routes[i].real_track[cached.routes[i].real_track.length-1].dist = data[j].data[0].dist;
                                            if (data[j].data[0].time) cached.routes[i].real_track[cached.routes[i].real_track.length-1].time = data[j].data[0].time;

                                            data[j].data.splice(0,1);

                                        if (data[j].data.length >0) {
                                            //log.info("Дописываем стейты", cached.routes[i].driver.NAME, cached.routes[i].real_track.length, data[j].data.length );
                                            for ( g=0; g<data[j].data.length; g++){
                                                cached.routes[i].real_track.push(data[j].data[g]);
                                            }
                                            //cached.routes[i].real_track.concat(data[j].data);
                                            //log.info("Стейтов стало", cached.routes[i].real_track.length);
                                        }

                                    }

                                    //
                                    //var firstIndx =undefined;
                                    //if (cached.real_track == undefined) {
                                    //    cached.real_track = data[j].data;
                                    //    continue;
                                    //}
                                    //
                                    //for(var n = cached.real_track.length-1; n>=0; n--) {
                                    //    if (cached.real_track[n].t1 == data[j].data[0].t1){
                                    //        firstIndx = n;
                                    //        break;
                                    //    }
                                    //}
                                    //
                                    //if (cached.real_track.length>1) log.info("Найдена точка входа, для объединения треков, где всего стейтов", cached.real_track.length, "стейт в треке", n,  cached.real_track[n], "всего получено", data[j].data.length );



                                    // todo визу старый вариант сверху новый


                                }
                            }

                            var res=0;
                            if (cached.routes[i].real_track != undefined) res = cached.routes[i].real_track.length;
                            //log.info("проверка и запись сенсора", cached.routes[i].transport.gid, "Закончена. Количество стейтов", res );

                        }

                        //log.info("начинаем проверку качества трека", companyAsk);
                        try{
                        for (var k=0; k<cached.routes.length; k++){
                            if (cached.routes[k].real_track == undefined || cached.routes[k].real_track.length == 0 || cached.routes[k].real_track == "invalid parameter 'gid'. ")  {
                                if (!cached.routes[k].driver) {log.info("ОШИБКА У маршрута у которого нет водителя", cached.routes[k].NUMBER, "Нет трека ", cached.routes[k].transport.gid) ;} else{
                                    log.info("ОШИБКА У маршрута", cached.routes[k].driver.NAME, "Нет трека ", cached.routes[k].transport.gid);
                                }

                                continue;
                            }

                            for( l=1; l<cached.routes[k].real_track.length; l++){
                                var flag = true;
                                //if (cached.routes[k].real_track[l].state == "MOVE" && cached.routes[k].real_track[l].coords != undefined && cached.routes[k].real_track[l].coords.length > 0) log.info  ("НА НООДЕ НАЙДЕНЫ КООРДИНАТЫ!!!!!")
                                if (cached.routes[k].real_track[l].t1 != cached.routes[k].real_track[l-1].t2 )
                                    if (cached.routes[k].real_track[l-1].id+'' != cached.routes[k].real_track[l].id+''


                                    ) {
                                        log.info("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!Найдена ошибка в треках Трек разорван !!!!!!!!!!!!!!!!!", cached.routes[k].driver.NAME, cached.routes[k].real_track[l-1], cached.routes[k].real_track[l] );
                                        if (flag) {
                                            log.toFLog("broken" + cached.routes[k].driver.NAME +".txt", cached.routes[k].real_track[l]);
                                            log.toFLog("recieve" + cached.routes[k].driver.NAME +".txt", toSave);

                                            flag=false;
                                        }
                                        repearTrackTry(cached.routes[k]);
                                    } else {
                                        cached.routes[k].real_track.splice(l-1, 1);
                                        l--;
                                    }


                            }


                            for(var l=1; l<cached.routes[k].real_track.length; l++){
                                if ( cached.routes[k].real_track[l].t1 > cached.routes[k].real_track[l].t2 )
                                    log.info("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!Найдена ошибка в треках Обратный стейт!!!!!!!!!!!!!!!!!", cached.routes[k].driver.NAME, cached.routes[k].real_track[l]);

                            }

                        }
                        } catch (e) {
                            log.error( "Ошибка "+ e + e.stack);
                        }
                        //
                        //checkeConcatTrack(companyAsk, 437123);
                        //checkeConcatTrack(companyAsk, 437323);

                    }

                    cashedDataArr[companyAsk].needRequests --;
                    log.info("2375 Get and Check Real TRACK finished for company", companyAsk, cashedDataArr[companyAsk].needRequests);
                    dataForPredicate(companyAsk, startCalculateCompany);
                    if(cashedDataArr[companyAsk].needRequests == 0) startCalculateCompany(companyAsk);


                }, companyAsk, dayStart);



                log.info("Конец запросов по компании", companyAsk);



            }
        }
    } catch (e) {
        log.error( "Ошибка "+ e + e.stack);
    }
}


function dataForPredicate(company, callback){
    try {
    log.info("START PREDICATE FUNCTION", company);
    var result=[];
    var i=0;
    while(i<cashedDataArr[company].routes.length) {

        var route=cashedDataArr[company].routes[i];

        //log.info("Вот такой вот роут real trac", route.real_track);
        if(route.real_track !=undefined && route.real_track.length>0 && route.real_track != "invalid parameter 'gid'. ") {
            var indx = route.uniqueID;
            var carPos = [{
                LAT: route.real_track[route.real_track.length - 1].lat,
                LON: route.real_track[route.real_track.length - 1].lon
            }];

            if (carPos[0].LAT == undefined) {
                log.info ("НАЙДЕНА ОШИБОЧКА!!!!!!&*&*&*^&^%&*%&", route.real_track);
            }
            var obj = {id: indx, points: carPos.concat(route.points)};
            result.push(obj);
            //if (route.uniqueID == 231157) {
            //    log.info("Route", route, "result", obj);
            //}
        }
        i++;
    }

     //log.info("Result for predication=", result);

    var j=0;
    var generalResult=[];                                                   // преременная собирающая в себе все ответы
        var collection = result;
    log.info("CONT PREDICATE FUNCTION", !(collection.length==0));
    if (collection.length==0) {
        cashedDataArr[company].needRequests --;
        log.info("The first cickle is finished RESULT LENGTH =", company, generalResult.length, cashedDataArr[company].needRequests );
        if(cashedDataArr[company].needRequests == 0) callback(company);
        return;
    }
    while(j<collection.length){
        var pointsStr = '';
        //log.info(collection[j].points);
        //if (collection[j].points == undefined) {
        //    log.info("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!Точек нет!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
        //} else {
        //    log.info(collection[j].points.length);
        //}
        for (i= 0; i < collection[j].points.length; i++) {
            //log.info("i=", i, collection[j].points[i].LAT, " ", collection[j].points[i].LON);
            if (collection[j].points[i].LAT != null && collection[j].points[i].LON != null) {
                pointsStr += "&loc=" + collection[j].points[i].LAT + "," + collection[j].points[i].LON;
            }
        }
         //log.info( pointsStr, "PointSTR");

        //запрос матрицы по одному маршруту с обработкой в колбэке.
       /* log.info("Пытаемся получить предсказание МТМ 2241");*/
        //log.info("CONT2 PREDICATE FUNCTION");
        tracksManager.getRouterMatrixByPoints(pointsStr, function (data, pointsStr) {
            //log.info(pointsStr);
         //log.info("SUCCESS PREDICATE FUNCTION");
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
            //log.info(LAT, " ", LON);
            var k=0;
            while (k<collection.length){
                if(LAT==collection[k].points[0].LAT && LON==collection[k].points[0].LON){
                    indx=collection[k].id;
                    //log.info("find id", indx);
                    break;
                }
                k++
            }
            generalResult.push({id:indx, time: timeMatrix});
            // Проверка не является ли этот колбек последним.
            if(generalResult.length==collection.length)
            {

                cashedDataArr[company].dataForPredicate=generalResult;
                cashedDataArr[company].needRequests --;
                log.info("The Second cickle is finished RESULT LENGTH =", generalResult.length, cashedDataArr[company].needRequests, company );
                if(cashedDataArr[company].needRequests == 0) callback(company);
                return;
            }

        });



        j++;
    }

    //TODO переделать этот костыль. Сюда не должно заходить.
    //Если зашло сюда, значит не было данных для придиката.
    } catch (e) {
        log.error( "Ошибка "+ e + e.stack);
    }

}



function uncalcPredication(route, company) {
try{
    var now = parseInt(Date.now()/1000);


    var time_table = [];
    var points = route.points;

    var k = 0;
    if (cashedDataArr[company].dataForPredicate != undefined) {
        while (k < cashedDataArr[company].dataForPredicate.length) {
            //log.info("Start serch", route.uniqueID, data[k].id );
            if (route.uniqueID == cashedDataArr[company].dataForPredicate[k].id) {
                //  log.info("find Time_Table");
                time_table = cashedDataArr[company].dataForPredicate[k].time;
                break;
            }

            k++;
        }
    }

    var i = 0;
    //log.info("timeTabls",time_table)
    for ( i = 0; i < points.length; i++) {
        // log.info("START PREDICATE CALCULATING", points[i]);
        if (points[i].real_arrival_time != undefined  || points[i].haveStop) {

            continue;
        }

        if (points[i].status == 4 || points[i].status == 5 || points[i].status == 7) {


            points[i].arrival_left_prediction = time_table[i] / 10 ? time_table[i] / 10 : 15 * 60;//Если у нас нет корректного предсказания времени (нет датчика ДЖПС) точка попадает в опаздывает за 15 минут до конца КОК
            points[i].arrival_prediction = now + points[i].arrival_left_prediction;
            if (points[i].status == 7 && points[i].arrival_prediction > points[i].arrival_time_ts) {
                points[i].status = 5;
                //log.info("Присваиваем статус 5");
                //points[i].variantus = 2770;
                points[i].overdue_time = points[i].arrival_prediction - points[i].arrival_time_ts;
                //log.info("TIME_OUT for point", points[i]);
            }
            if ((points[i].status == 7 || points[i].status == 5) && now > points[i].arrival_time_ts) {
                points[i].status = 4;
                //log.info("Присваиваем статус 4");
                //points[i].variantus = 2836;
                points[i].overdue_time = now - points[i].arrival_time_ts + points[i].arrival_left_prediction;

                //log.info("DELAY for point", points[i]);
            }

        }

    }

} catch (e) {
    log.error( "Ошибка "+ e + e.stack);
}
}


function calcPredication(route, company) {

try {

    var point,
        tmpPred,
        now = parseInt(Date.now()/1000);



    if (route.points[route.lastPointIndx] || route.points[route.lastPointIndx] == 0) {


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

        if (route.real_track != undefined && cashedDataArr[company].dataForPredicate != undefined && route.real_track.length != 0 && route.real_track != "invalid parameter 'gid'. ") {
            var k = 0;

            while (k < cashedDataArr[company].dataForPredicate.length) {
                if (cashedDataArr[company].dataForPredicate[k].id == route.uniqueID) {

                    singleTimeMatrix = cashedDataArr[company].dataForPredicate.time;
                    //break;
                }

                k++;
            }


        } else {
            //Рассчитываем статусы по фактическому времени, если у нас нет трека или предсказания;

            for (var i= 0; i<route.points.length; i++ ){

                if (route.points[i].working_window[0] == undefined) {

                    log.info ('Скорее всего это склад'.green);
                    //todo решить проблему со складом
                    if (route.points[i].arrival_time_ts != undefined && now > route.points[i].arrival_time_ts) {
                        route.points[i].status = 4;
                        //log.info("Присваиваем статус 4");
                        //route.points[j].variantus = 2910;
                        route.points[i].overdue_time = now - route.points[i].arrival_time_ts;
                    }
                        continue;
                }
                //log.info("2843 MTM", route.points[i].working_window);
                if (now > route.points[i].working_window[route.points[i].working_window.length-1].finish){

                    route.points[i].status = 4;
                    //log.info("Присваиваем статус 4");
                    //route.points[i].variantus =2917;
                    route.points[i].overdue_time = now - route.points[i].arrival_time_ts;
                    continue;
                }

                if(now > route.points[i].arrival_time_ts) {

                    route.points[i].status = 5;
                    //route.points[i].variantus = 2852;
                    route.points[i].overdue_time = now - route.points[i].arrival_time_ts;
                    continue;
                }
            }
            return;
        }


        var nextPointTime,
            totalWorkTime = 0,
            totalTravelTime = 0,
            tmpDowntime = 0,
            totalDowntime = 0,
            tmpTime;

            singleTimeMatrix != undefined ? nextPointTime = parseInt(singleTimeMatrix[lastPoint] / 10): nextPointTime = 0;

        for (var j = 0; j < route.points.length; j++) {


            if (j <= lastPoint || route.real_track == undefined) {
                // все точки до последней выполненной проверяются по факту
                //log.info("Try to change status for point", _route.points[j] );


                route.points[j].arrival_prediction = 0;
                route.points[j].overdue_time = 0;
                if (route.points[j].status == 7) {

                    //log.info(route.points[j], "MTM2865 route.points[j].working_window.finish");
                    if (now > route.points[j].working_window.finish) {
                        //!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! Проверить расчет working window
                        //log.info("NOW=", now, "working_window.finish=", _route.points[j].working_window.finish, " controlled_window", _route.points[j].controlled_window.finish);
                        route.points[j].status = 4;
                        //log.info("Присваиваем статус 4");
                        //route.points[j].variantus = 2960;
                        //log.info("_route.points[j].status = STATUS.TIME_OUT;", _route.points[j]);
                        route.points[j].overdue_time = now - route.points[j].arrival_time_ts;
                    }
                } else if (route.points[j].status == 3) {
                    totalWorkTime = parseInt(route.points[j].TASK_TIME) - (now - route.points[j].real_arrival_time);
                }


            } else {
                // точки ниже последней выполненной считаются ниже
                //  log.info (j, "Point for Route", route);
                tmpTime = route.time_matrix.time_table[0][j - 1][j];
                // времена проезда от роутера приходят в десятых долях секунд
                totalTravelTime += tmpTime == undefined ? 15 * 60 : parseInt(tmpTime / 10);
                tmpPred = now + nextPointTime + totalWorkTime + totalTravelTime + totalDowntime;
                if (tmpDowntime = route.points[j].working_window[0] != undefined) tmpDowntime = route.points[j].working_window[0].start - tmpPred;
                if (tmpDowntime > 0) {
                    totalDowntime += tmpDowntime;
                    if (route.points[j].working_window[0] != undefined)tmpPred = route.points[j].working_window[0].start;
                }


                route.points[j].arrival_prediction = now + nextPointTime + totalWorkTime + totalTravelTime;



                // log.info("In route", route, "Predication for point ", j, "==", route.points[j].arrival_prediction);

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
                    if (route.points[j].working_window[route.points[j].working_window.length-1] != undefined) {var minus = route.points[j].working_window[route.points[j].working_window.length-1].finish;} else {var minus =route.points[j].working_window.finish}
                    route.points[j].overdue_time = parseInt(route.points[j].arrival_prediction - minus);

                    if (route.points[j].overdue_time > 0) {
                        if (minus < now) {
                            route.points[j].status = 4;

                        } else {
                            route.points[j].status = 5;

                        }
                    }

                } else {

                    route.points[j].overdue_time = 0;
                }

                totalWorkTime += parseInt(route.points[j].TASK_TIME);
            }
        }

    }
} catch (e) {
    log.error( "Ошибка "+ e + e.stack);
}
    }

//Приведение времени PUSH к локально текущему Киев прибавляем 3 часа
function checkPushesTimeGMTZone(pushes, company, companyName){
    try {
    //log.info(colors.green('Start reorange pushes'));
    //log.info('Тестовое сообщение зеленого цвета'.green);
    if (pushes == undefined || company == undefined) return;
    var i=0;
    var delta;
    var str = ""+ company;
    //Костыль приводящий пуши разных компаний к единому знаменателю
    if (str.startsWith("292942")) delta = 2;
    if (str.startsWith("271389")) delta = 3;

    while (i<pushes.length) {


        var temp = pushes[i].gps_time ? strToTstamp(pushes[i].gps_time)+60*60*delta : 0;
        pushes[i].gps_time_ts=temp;
        if( temp == 0) {
            log.info("Невалидный ПУШ", companyName);
        }

        //log.info("New Time", temp);
        var date=new Date();
        date.setTime(pushes[i].gps_time_ts*1000);
        pushes[i].time=timestmpToStr(date);
        i++
    }
    } catch (e) {
        log.error( "Ошибка "+ e + e.stack);
    }
}



function timestmpToStr(d) {
    try{
    //log.info("d", d, "type", typeof (d), "proba", d.getHours());


    return  [d.getHours().padLeft(),
            d.getMinutes().padLeft(),
            d.getSeconds().padLeft()].join(':');
    } catch (e) {
        log.error( "Ошибка "+ e + e.stack);
    }

}

// добавить ноль слева, если число меньше десяти
Number.prototype.padLeft = function (base, chr) {
    try {
    var len = (String(base || 10).length - String(this).length) + 1;
    return len > 0 ? new Array(len).join(chr || '0') + this : this;
    } catch (e) {
        log.error( "Ошибка "+ e + e.stack);
    }
};

// получить дистанцию между двумя LanLon в метрах
function getDistanceFromLatLonInM(lat1, lon1, lat2, lon2) {
    try{
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
    //log.info("lat1", lat1, "lon1", lon1, "lat2", lat2, "lon2", lon2, ' dist', d*1000);
    return d * 1000;
    } catch (e) {
        log.error( "Ошибка "+ e + e.stack);
    }
}

// конверт градусов в радианы
function deg2rad(deg) {
    try {
    return deg * (Math.PI / 180)
    } catch (e) {
        log.error( "Ошибка "+ e + e.stack);
    }
}


function checkUncalculateRoute(point, stop, company){
    try {

    //log.info("Start checkUncalculate");

    var result=false;
    var parts=point.AVAILABILITY_WINDOWS.split(";");
    var size=parts.length;
    var i=0;
    while(i<size){
        var date=point.ARRIVAL_TIME.substr(0,11);
        var temp=parts[i].trim();
        var before=temp.substr(0,5);
        before=date+before+":00";
        //log.info("before=", before);
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
    } catch (e) {
        log.error( "Ошибка "+ e + e.stack);
    }
}



function findBestStop(point, stop){

    try {
    //if (point.source &&
    //    point.source.row_id == 246)
    //{
    //    log.info("Tested point", point, "and new stop is", stop, "and old point is ", point.stopState);
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

        //  log.info("New point is better");
        //  log.info("I have to remove ", point.NUMBER-1, "from", point.stopState.servicePoints);
        var i=0;
        while (i<point.stopState.servicePoints.length){
            if(point.stopState.servicePoints[i]==point.NUMBER) {
                point.stopState.servicePoints.splice(i,1);
            }

            i++;
        }

        //  log.info("result is", point.stopState.servicePoints);

        return true;
    } else{

        return false;

    }
    } catch (e) {
        log.error( "Ошибка "+ e + e.stack);
    }
}



function  checkOnline(company) {
    try {
    for (var i=0; i<onlineClients.length; i++){
                if(onlineClients[i].time + 60*3 < parseInt(Date.now()/1000)){
                    log.info(onlineClients[i].login, "Давно не был онлайн, удаляем");
                    unblockLogin(onlineClients[i].login);
                    onlineClients.splice(i,1);
                    i--;
        }

    }
    var result=false;
    for (i=0; i<onlineClients.length; i++){
        log.info("Стоит ли считать компанию ", company, "Если online:", onlineClients[i]);
        if(onlineClients[i].company == company){
            result=true;
            return result;
        }

    }


    log.info("На данный момент нет никого онлайн из этой компании. Считать нет смысла, но все равно");

    //Функция страховка если по каким либо причинам остались заблокированные роуты.
    if (cashedDataArr[company].blocked_routes != undefined && cashedDataArr[company].blocked_routes.length >0){
        log.info("Страховка сработала", cashedDataArr[company].blocked_routes.length );
        cashedDataArr[company].routes = cashedDataArr[company].routes.concat(cashedDataArr[company].blocked_routes);
        cashedDataArr[company].blocked_routes.length = 0;
    }

    for (i=0; i< blockedRoutes.length; i++){
        if (blockedRoutes[i].company == company){
            blockedRoutes.splice(i,1);
            i--;
        }
    }

    return result;
    } catch (e) {
        log.error( "Ошибка "+ e + e.stack);
    }
}


function checkRealTrackData (company) {
    try {
    for (var i=0; i<cashedDataArr[company].routes.length; i++){
        if (cashedDataArr[company].routes[i].real_track == undefined || cashedDataArr[company].routes[i].real_track.length == 0) continue;
        for (var j=0; j<cashedDataArr[company].routes[i].real_track.length-1; j++){
            if (cashedDataArr[company].routes[i].real_track[j].t2 != cashedDataArr[company].routes[i].real_track[j+1].t1) {
                log.info ("Find Problem in ",cashedDataArr[company].routes[i].transport.gid, cashedDataArr[company].routes[i].real_track[j+1].t1);
               // log.info ("Find Problem in ",cashedDataArr[company].routes[i].transport.gid, cashedDataArr[company].routes[i].real_track[j], cashedDataArr[company].routes[i].real_track[j+1] , j, " from", cashedDataArr[company].routes[i].real_track.length);
            }
        }
    }
    } catch (e) {
        log.error( "Ошибка "+ e + e.stack);
    }
}


function lookForNewIten(company) {

try {
        var date = cashedDataArr[company].routesOfDate;
        log.info("Start looking for new ITEN", company);
        var soapManager = new soap(cashedDataArr[company].firstLogin);
        var existIten;
        if(cashedDataArr[company].idArr != undefined) {
            existIten = cashedDataArr[company].idArr.length;
        } else{
            existIten = 0;
        }

        soapManager.lookAdditionalDailyPlan(date, existIten, company, function (data) {
           log.info("Опрос 1с на предмет новых решений дал результат", data.status, data.addIten);
            // Если присутствуют новые решения в текущем дне
            if(data.addIten != undefined){
                log.info("Начинаем догружать и объединять новые данные со старым решением " );
                // Определение ID и версий новых решений
                var newIten =[];
                for( var i=0; i<data.addIten.itens.length; i++){
                    log.info(data.addIten.itens[i].$);
                    var alreadyExistIten=false;
                    for (var j=0; j<cashedDataArr[company].idArr; j++) {
                         if( ""+cashedDataArr[company].idArr[j] == ""+data.addIten.itens[i].$.ID ) {
                             log.info ("Найдено существующее решение", cashedDataArr[company].idArr[j] );
                             alreadyExistIten=true;
                             break
                         }

                    }
                    if (!alreadyExistIten) {
                        newIten.push(data.addIten.itens[i].$);
                    }
                }


                log.info("Выявлены следующие новые решения", newIten);



                for (i=0; i<newIten.length; i++){

                    soapManager.getAdditionalIten(newIten[i].ID, newIten[i].VERSION, company, addIten)
                }

                function addIten (data) {
                    //log.info("Ready to concat", data.routes, "MTM 2750");
                    //Добавление новых данных в Кэш
                    log.info("До объединения", cashedDataArr[company].routes.length,  cashedDataArr[company].waypoints.length, "получили", data.routes.length, data.waypoints.length);
                    var newRoutes = JSON.parse(JSON.stringify(data.routes));
                    var newWaypoints = JSON.parse(JSON.stringify(data.waypoints));

                    var lastFilterId=0;
                    var lastRowId=0;
                    //Поиск максимального filterId, чтобы далее продолжать с этого номера Может в 3 массивах

                    if ( cashedDataArr[company].routes != undefined) {
                        for ( i=0; i<cashedDataArr[company].routes.length; i++){
                            if(cashedDataArr[company].routes[i].filterId > lastFilterId) {
                                lastFilterId = cashedDataArr[company].routes[i].filterId;
                                log.info("Новый максимальный аfilterId =", lastFilterId);
                            }
                            for (j=0; j<cashedDataArr[company].routes[i].points.length; j++){
                                if(cashedDataArr[company].routes[i].points[j].row_id >lastRowId  ){
                                    lastRowId = cashedDataArr[company].routes[i].points[j].row_id;
                                    log.info("Новый максимальный rowID =", lastRowId);
                                }
                            }

                        }

                    }

                    if ( cashedDataArr[company].line_routes != undefined) {
                        for (var i=0; i<cashedDataArr[company].line_routes.length; i++){
                            if(cashedDataArr[company].line_routes[i].filterId > lastFilterId) {
                                lastFilterId = cashedDataArr[company].line_routes[i].filterId;
                                log.info("Новый максимальный аfilterId =", lastFilterId);
                            }
                            for (j=0; j<cashedDataArr[company].line_routes[i].points.length; j++){
                                if(cashedDataArr[company].line_routes[i].points[j].row_id >lastRowId  ){
                                    lastRowId = cashedDataArr[company].line_routes[i].points[j].row_id;
                                    log.info("Новый максимальный rowID =", lastRowId);
                                }
                            }
                        }
                    }

                    if ( cashedDataArr[company].blocked_routes != undefined) {
                        for (var i=0; i<cashedDataArr[company].blocked_routes.length; i++){
                            if(cashedDataArr[company].blocked_routes[i].filterId > lastFilterId) {
                                lastFilterId = cashedDataArr[company].blocked_routes[i].filterId;
                                log.info("Новый максимальный аfilterId =", lastFilterId);
                            }
                            for (j=0; j<cashedDataArr[company].blocked_routes[i].points.length; j++){
                                if(cashedDataArr[company].blocked_routes[i].points[j].row_id >lastRowId  ){
                                    lastRowId = cashedDataArr[company].blocked_routes[i].points[j].row_id;
                                    log.info("Новый максимальный rowID =", lastRowId);
                                }
                            }
                        }
                    }


                    lastFilterId++;
                    lastRowId++;


                    cashedDataArr[company].routes = cashedDataArr[company].routes.concat(newRoutes);

                    cashedDataArr[company].waypoints = cashedDataArr[company].waypoints.concat(newWaypoints);
                    log.info("После объединения", cashedDataArr[company].routes.length, cashedDataArr[company].waypoints.length);

                    var tmpPoints,
                        rowId = lastRowId,
                        routeId = 0,
                        len = 0,
                        tPoint,
                        roundingNumb = 300,         // шаг округления обещанных окон
                        branchIndx,
                        tmpTaskNumber = -1;

                    var currentCompany = company;

                    //cashedDataArr[currentCompany].firstLogin=login;
                    //cashedDataArr[currentCompany].last_track_update = parseInt(Date.now()/1000);

                    //var soapManager = new soap(login);
                    //soapManager.getNewConfig(login, function (data) {
                    //    log.info("receiveConfig", data);
                    //    var obj = JSON.parse(data.return);
                    //    log.info("Obj",  obj.predictMinutes, "mtm 1192")
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
                            //log.info("Сравнение", cashedDataArr[currentCompany].routes[i].TRANSPORT , cashedDataArr[currentCompany].transports[j].ID)
                            if (cashedDataArr[currentCompany].routes[i].TRANSPORT == cashedDataArr[currentCompany].transports[j].ID) {
                                cashedDataArr[currentCompany].routes[i].transport = cashedDataArr[currentCompany].transports[j];
                                cashedDataArr[currentCompany].routes[i].real_track = cashedDataArr[currentCompany].transports[j].real_track;

                                if (cashedDataArr[currentCompany].transports[j].real_track != undefined &&
                                    cashedDataArr[currentCompany].routes[i].real_track.length > 0 &&
                                    cashedDataArr[currentCompany].routes[i].real_track != aggregatorError) {
                                    var len = cashedDataArr[currentCompany].routes[i].real_track.length - 1;
                                    cashedDataArr[currentCompany].routes[i].car_position = cashedDataArr[currentCompany].routes[i].real_track[len]; // определение текущего положения машины
                                    //log.info('data.routes[i]', data.routes[i]);
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
                        //    log.info(data.routes[i].DRIVER);
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
                            //

                            //
                            if (cashedDataArr[currentCompany].routes[i].filterId == null || cashedDataArr[currentCompany].routes[i].filterId == undefined ) {
                                cashedDataArr[currentCompany].routes[i].filterId = lastFilterId;
                                cashedDataArr[currentCompany].routes[i].uniqueID = ""+cashedDataArr[currentCompany].routes[i].itineraryID+data.VERSION+cashedDataArr[currentCompany].routes[i].ID;
                                log.info("Prisvoen UNIQUE ID", ""+""+cashedDataArr[currentCompany].routes[i].itineraryID+data.VERSION+cashedDataArr[currentCompany].routes[i].ID);
                                for( var k =0; k < cashedDataArr[currentCompany].routes[i].points.length; k++){
                                    cashedDataArr[currentCompany].routes[i].points[k].uniqueID = cashedDataArr[currentCompany].routes[i].uniqueID;
                                    cashedDataArr[currentCompany].routes[i].points[k].route_id = cashedDataArr[currentCompany].routes[i].filterId;
                                    cashedDataArr[currentCompany].routes[i].points[k].route_indx = cashedDataArr[currentCompany].routes[i].filterId;
                                }

                                //TODO REMOVE AFTER TESTING
                                //data.routes[i].transport = data.routes[0].transport;
                                //data.server_time = 1446611800;
                                ///////////////////////////

                                cashedDataArr[currentCompany].allRoutes.push({
                                    //name: data.routes[i].transport.NAME,

                                    allRoutes: false,

                                    nameDriver: ( ( cashedDataArr[currentCompany].routes[i].hasOwnProperty('driver') && cashedDataArr[currentCompany].routes[i].driver.hasOwnProperty('NAME') ) ? cashedDataArr[currentCompany].routes[i].driver.NAME : 'без имени') +  " " + cashedDataArr[currentCompany].routes[i].SHIFT_NAME + ' - ' + cashedDataArr[currentCompany].routes[i].transport.NAME,
                                    nameCar: cashedDataArr[currentCompany].routes[i].transport.NAME + " " + cashedDataArr[currentCompany].routes[i].SHIFT_NAME + ' - ' + ( ( cashedDataArr[currentCompany].routes[i].hasOwnProperty('driver') && cashedDataArr[currentCompany].routes[i].driver.hasOwnProperty('NAME') ) ? cashedDataArr[currentCompany].routes[i].driver.NAME : 'без имени'),

                                    value: cashedDataArr[currentCompany].routes[i].filterId,
                                    uniqueID: cashedDataArr[currentCompany].routes[i].uniqueID,


                                    car: cashedDataArr[currentCompany].routes[i].transport.NAME,
                                    driver: ( cashedDataArr[currentCompany].routes[i].hasOwnProperty('driver') && cashedDataArr[currentCompany].routes[i].driver.hasOwnProperty('NAME') ) ? cashedDataArr[currentCompany].routes[i].driver.NAME : 'без имени' + i //!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!добавили свойство driver для события в closeDriverName
                                });
                                //  log.info(scope.filters.routes, ' filters.routes');
                                lastFilterId++;
                            }


                            try {
                                tPoint.route_indx = cashedDataArr[currentCompany].routes[i].filterId;
                                var trans = JSON.parse(JSON.stringify(cashedDataArr[currentCompany].routes[i].transport));
                                delete trans.real_track;
                                tPoint.transport = trans;

                                if (cashedDataArr[currentCompany].routes[i].DISTANCE == 0) {
                                    //log.info("The route is UNCALCULATE");


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
                                    //log.info("!!!!!The route is Very Good CALCULATE!!!!");
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
                                log.info("Error", tPoint);
                                log.info(tPoint.driver.NAME, e);
                                // log.info("route", cashedDataArr[currentCompany].routes[i].points[0] );
                            }
                            //
                            //
                            tPoint.NUMBER = parseInt(tPoint.NUMBER);
                            tPoint.row_id = rowId;
                            tPoint.arrival_prediction = 0;
                            tPoint.arrival_left_prediction = 0;
                            tPoint.status = 7;

                            //tPoint.route_id = i;
                            rowId++;

                            tPoint.windows = getTstampAvailabilityWindow(tPoint.AVAILABILITY_WINDOWS, cashedDataArr[currentCompany].server_time);
                            // создание обещанных окон
                            if (tPoint.promised_window == undefined && tPoint.windows != undefined) {
                                //log.info("Create PROMISED WINDOW step1");

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
                                //log.info("Create PROMISED WINDOW step2");
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
                                //log.info("Create PROMISED WINDOW step3");
                                tPoint.promised_window_changed = JSON.parse(JSON.stringify(tPoint.promised_window));
                            }




                            createSeveralAviabilityWindows(tPoint);
                            var workingWindowType = cashedDataArr[currentCompany].settings.workingWindowType;



                            //log.info("Ищем ошибку в роуте", cashedDataArr[currentCompany].routes[i].driver.NAME);

                            if (workingWindowType == 0) {
                                tPoint.working_window = tPoint.orderWindows;
                                //for (var k = 0; tPoint.windows != undefined && k < tPoint.windows.length; k++) {
                                //    //log.info("Create PROMISED WINDOW step4");
                                //    if (tPoint.windows[k].finish + 120 > tPoint.arrival_time_ts &&
                                //        tPoint.windows[k].start - 120 < tPoint.arrival_time_ts) {
                                //        tPoint.working_window = tPoint.windows[k];
                                //    }
                                //}

                                if (tPoint.working_window == undefined) tPoint.working_window = tPoint.orderWindows;
                            } else if (workingWindowType == 1) {
                                tPoint.working_window = tPoint.promised_window_changed;
                            }

                        }

                        //log.info(cashedDataArr[currentCompany].currentProblems, "Problems 485");

                    }

                    //Удаление последнего стейта если он Каррент позитион
                    for (i=0; i<cashedDataArr[currentCompany].routes.length; i++){

                        var route = cashedDataArr[currentCompany].routes[i];
                        if (route.real_track == undefined || route.real_track.length == 0) continue;
                        var last = route.real_track.length-1;
                        //log.info("last = ", last);
                        if (route.real_track[last].state == 'CURRENT_POSITION') {
                            route.real_track.length=last;
                            //log.info("DELETE CURRENT POSITION");
                        }
                    }

                    cashedDataArr[currentCompany].idArr.push(cashedDataArr[currentCompany].routes[cashedDataArr[currentCompany].routes.length-1].itineraryID);
                    log.info("FINISHING SECOND LINKING");
                    checkCorrectCalculating(currentCompany);





                }

            }




            // Если уже есть планы на новый день и он наступил
            if(data.newDayIten != undefined){
                //TODO дописать и проверить работоспособность строчки ниже и всего кода.
                log.info("Start Load NEW DAY");

                var login = cashedDataArr[company].firstLogin;
                //TODO решить вопрос с обновлением настроек.
                var settings = cashedDataArr[company].settings;
                if(cashedDataArr[company].oldRoutes != undefined) {
                    //cashedDataArr[company].line_routes = cashedDataArr[company].line_routes.concat(cashedDataArr[company].oldRoutes);
                    oldRoutes = JSON.parse(JSON.stringify(cashedDataArr[company].line_routes));
                } else {
                    oldRoutes =JSON.parse(JSON.stringify(cashedDataArr[company].line_routes));
                }


                if (cashedDataArr[company].blocked_routes != undefined) {
                    for (var k = 0; k < cashedDataArr[company].blocked_routes.length; k++) {
                        oldRoutes.push(cashedDataArr[company].blocked_routes[k]);
                    }
                }
                saveRoutesTo1s(oldRoutes);
                cashedDataArr[company]={};


                log.info("Старых маршрутов ", oldRoutes.length);
                //

                //Получение дневного плана для конкретной компании
                middleTime = parseInt(Date.now()/1000);
                soapManager.getAllDailyData(dataReadyCallback);


                function dataReadyCallback(data) {
                    log.info("Загрузка данных НОВОГО ДНЯ из 1C заняла", parseInt(Date.now()/1000)-middleTime);
                    endTime = parseInt(Date.now()/1000);
                    if (data.routes != undefined) {
                        log.info('=== dataReadyCallback === send data to client ===', data.routes.length);}
                    // Добавления уникального ID для каждого маршрута и этогоже ID для каждой точки на маршруте
                    log.info('send data to client');

                        //log.info("ReChange SessionLogin", data.CLIENT_ID);

                        var currentCompany = JSON.parse(JSON.stringify(data.CLIENT_ID));
                        var key=""+login;
                        companyLogins[key]=currentCompany;


                        needNewReqto1C[currentCompany] = true;
                        //здесь падала программа при длительном использовании.

                        if (data.routes !=undefined) {
                            for (var i = 0; i < data.routes.length; i++) {
                                if (!data.routes[i]['uniqueID']) {
                                    data.routes[i]['uniqueID'] = data.routes[i].itineraryID + data.VERSION + data.routes[i].ID;
                                    log.info("Prisvoeno znahenie", data.routes[i]['uniqueID']);
                                    for (var j = 0; j < data.routes[i].points.length; j++) {
                                        data.routes[i].points[j]['uniqueID'] = data.routes[i].itineraryID + data.VERSION + data.routes[i].ID;
                                    }
                                }
                            }


                           // req.session.itineraryID = data.ID;
                            data.user = login;
                            data.routesOfDate = data.routes[0].START_TIME.split(' ')[0];
                        }
                        cashedDataArr[currentCompany] = data;


                        cashedDataArr[currentCompany].currentProblems = [];
                        cashedDataArr[currentCompany].allRoutes=[];
                        cashedDataArr[currentCompany].settings = settings;
                        cashedDataArr[currentCompany].oldRoutes=[];
                        cashedDataArr[currentCompany].settings.limit = cashedDataArr[currentCompany].settings.limit || 74; //TODO прописать в настройки на 1с параметр лимит

                        //Собираем решение из частей в одну кучку
                        linkDataParts(currentCompany, login);


                        // св-во server_time получает истенное время сервера, только если был запрошен день не из календарика, если из - то вернет 23 59 запрошенного дня
                        data.current_server_time = parseInt(new Date() / 1000);
                        //var current_server_time = new Date();
                        //var server_time = new Date(data.server_time * 1000);

                            data.currentDay = true;
                            data.current_server_time = data.server_time;
                            //cashedDataArr[req.session.login] = data;




                    cashedDataArr[company].recalc_finishing = true;

                        //TODO Склейка решения закончена, включаем периодическое (раз в 2 минуты ) обновление и пересчет данных
                        //interval(startPeriodicCalculating(currentCompany), 20 * 1000);
                        if(startServer == false) {
                            log.info("Start SERVER");
                            startServer = true;
                            var timerId = setInterval(function() {
                                startPeriodicCalculating(currentCompany);
                            }, 88 * 1000);}

                    cashedDataArr[company].oldRoutes=[];
                    log.info("Старые маршрутыб было", cashedDataArr[company].oldRoutes.length, "пришло", oldRoutes.length );
                    cashedDataArr[company].oldRoutes= [].concat(oldRoutes);
                    log.info("Старые маршрутыб СТАЛО", cashedDataArr[company].oldRoutes.length);


                }


            }

        });
} catch (e) {
    log.error( "Ошибка "+ e + e.stack);
}
}



function saveRoutesTo1s(routes){
    return;
    if (!routes) return;

    try {


        collectDataForDayClosing(routes);


        function collectDataForDayClosing(currentDay){

            var result = {
                    routes: []
                },
                routeI,
                pointJ,
                route,
                point,
                startTime,
                routesOfDate,
                endTime;
            var routesID = [];

            for (var i = 0; i < routes.length; i++) {

                routeI = routes[i];
                routes[i].closed = true;
                routesOfDate = (routes[i].START_TIME).substr(0,10);
                routesID.push(routeI.uniqueID);
                route = {
                    pointsReady: [],
                    pointsNotReady: [],
                    driver: routeI.DRIVER,
                    transport: routeI.TRANSPORT,
                    itenereryID: routeI.itineraryID,
                    number: routeI.NUMBER,
                    gid: routeI.transport.gid || -1,
                    uniqueId: routeI.uniqueId,
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

                    point.real_arrival_time = pointJ.real_arrival_time;

                    point.status = {
                        promised: false,
                        ordered: false
                    };

                    if (point.windowType == "В заказанном") {
                        point.status.promised = true;
                        point.status.ordered = true;
                    } else if (point.windowType == "В обещанном") {
                        point.status.ordered = true;
                    }

                    if (point.status.ordered) route.inOrderedLen++;
                    if (point.status.promised) route.inPromised++;
                    if (point.inPlan) route.inPlan++;
                    //console.log(pointJ);

                    if(pointJ.status == 8){
                        point.reasonDisp = pointJ.reason || '';
                        point.reasonDriver = '';
                        if (point.mobile_push != undefined && point.mobile_push.canceled == true) {
                            point.reasonDriver = point.mobile_push.cancel_reason;
                        }
                        route.pointsNotReady.push(point);

                        //console.log("причины отмены", point.reasonDisp, point.reasonDriver);
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
                    //console.log("Обрабатываем доставленные точки");
                    point = route.pointsReady[k];
                    point.arrivalTimeFact = 0;
                    if (point.stopState) {
                        point.durationFact = point.stopState.t2 - point.stopState.t1;
                        point.arrivalTimeFact = point.stopState.t1;
                        point.id = point.stopState.id;
                    }else{
                        point.arrivalTimeFact = point.real_arrival_time || 0;
                        point.durationFact = 0;
                        point.id = 0;
                    }

                    //console.log("Point", point);
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


            var xml = '<?xml version="1.0" encoding="UTF-8"?><MESSAGE xmlns="http://sngtrans.com.ua"><CLOSEDAY CLOSEDATA="'+routesOfDate+'"><TEXTDATA>'+ JSON.stringify(result) +'</TEXTDATA></CLOSEDAY></MESSAGE>';

            if( currentDay ){ // проверка сегодняшней даты закрытия дня
                console.log("UPDATE DAY");
                //console.log("XML == ", xml);
                return {closeDayData: xml, routesID: routesID, update:true, closeDayDate: routesOfDate}; // обновляем текущий день
            }else{
                return {closeDayData: xml, routesID: routesID, update:false, closeDayDate: routesOfDate}; // дописываем старый день
            }
        }


    } catch (e) {
        log.error( "Ошибка "+ e + e.stack);
    }

}

function changePriority(id, company, login) {
try {
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
        log.info("PRIORITY", priority[i]);
    }
} catch (e) {
    log.error( "Ошибка "+ e + e.stack);
}
}


// Функция подбирает роут для оператора
function choseRouteForOperator(company, login){
    try{
    log.info("Start choseRouteForOperator ");
    var result = 0;
    for (;result< cashedDataArr[company].line_routes.length; result++){
        var route = cashedDataArr[company].line_routes[result];
        //проверяем не заблокирован ли этот роут уже другим оператором
        var blocked = false;
        for(var j=0; j<blockedRoutes.length; j++){

            if (blockedRoutes[j].id == route.uniqueID &&  blockedRoutes[j].company  == company){
                log.info("проблемный роут уже заблокирован");
                blocked = true;
                break;
            }
        }

        if(blocked) continue;
        break;


    }

    if(result< cashedDataArr[company].line_routes.length ){
        log.info("Отдаем оператору маршрут ", result, cashedDataArr[company].line_routes[result].uniqueID );
        blockedRoutes.push({id: "" + cashedDataArr[company].line_routes[result].uniqueID, company: company, login: login, time: parseInt(Date.now()/1000)});

        if(cashedDataArr[company].blocked_routes == undefined) cashedDataArr[company].blocked_routes = [];

        cashedDataArr[company].blocked_routes.push(cashedDataArr[company].line_routes[result]);

        log.info("Size of blocked Routes is", cashedDataArr[company].blocked_routes.length);
        return result;
    } else {
        log.info("Больше проблем не вижу");
        return -1;
    }
    } catch (e) {
        log.error( "Ошибка "+ e + e.stack);
    }

}


function connectPointsAndPushes(company) {
    try{
    log.info("Start connectPointsAndPushes", company);
    var mobilePushes = cashedDataArr[company].allPushes;

    checkPushesTimeGMTZone(mobilePushes, company, cashedDataArr[company].CLIENT_NAME);

    for (var i=0; i<cashedDataArr[company].routes.length; i++){
        cashedDataArr[company].routes[i].pushes=[];
    }


    mark1:

    for (i = 0; i<mobilePushes.length;i++){

//todo временно закомментируем, чтобы проверить наличие пушей
//        if (mobilePushes[i].gps_time == 0 ||
//            (mobilePushes[i].lat == 0 && mobilePushes[i].lon == 0) ||
//            mobilePushes.gps_time > parseInt(Date.now()/1000)
//        ) continue;



        for (var j = 0; j < cashedDataArr[company].routes.length; j++) {


            for (var k = 0; k < cashedDataArr[company].routes[j].points.length; k++) {



                var tmpPoint = cashedDataArr[company].routes[j].points[k];


                var LAT = parseFloat(tmpPoint.LAT);
                var LON = parseFloat(tmpPoint.LON);
                var lat = mobilePushes[i].lat;
                var lon = mobilePushes[i].lon;

                // каждое нажатие проверяем с каждой точкой в каждом маршруте на совпадение номера задачи
                if (mobilePushes[i].number == tmpPoint.TASK_NUMBER) {

                    mobilePushes[i].plan_number = tmpPoint.NUMBER;
                    mobilePushes[i].uniqueID = tmpPoint.uniqueID;

                    //TODO написать функцию обработки пуша-отмены
                    if (mobilePushes[i].canceled) {
                        //log.info("НАЙДЕН ПУШ, который отменяет точку!!!!!!!!!!!!!", tmpPoint.driver.NAME, tmpPoint.NUMBER);
                        cancelTaskPush(mobilePushes[i], tmpPoint, company);
                        continue mark1;
                    }


                    //Проверка, не был ли ранее отменен этот пуш как некоректный
                    if (tmpPoint.incorrect_push != undefined && tmpPoint.incorrect_push.number == mobilePushes[i].number) break;

                    //log.info("FIND PUSH ", mobilePushes[i], "for Waypoint", tmpPoint );

                    tmpPoint.mobile_push = mobilePushes[i];
                    tmpPoint.mobile_arrival_time = mobilePushes[i].gps_time_ts;
                    mobilePushes[i].distance = getDistanceFromLatLonInM(lat, lon, LAT, LON);
                    // если нажатие попадает в радиус заданный в настройках, нажатие считается валидным
                    // Для большей захвата пушей, их радиус увеличен в 2 раза по сравнению с расстоянием до стопа
                    if (mobilePushes[i].distance <= cashedDataArr[company].settings.mobileRadius) {
                        tmpPoint.havePush = true;



                        //Пока нет валидного времени с GPS пушей, закомментируем следующую строку
                        if (tmpPoint.real_arrival_time == undefined)  tmpPoint.real_arrival_time = {};
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
                        //log.info('>>> OUT of mobile radius');
                    }
                }
            }
        }

    }
    } catch (e) {
        log.error( "Ошибка "+ e + e.stack);
    }

}


function connectStopsAndPoints(company) {
    try{
    log.info("Start connectStopsAndPushes");

    // создание множественных окон доступности если их нет
    for(var i = 0; i<cashedDataArr[company].routes.length; i++){
        for(var j = 0; j<cashedDataArr[company].routes[i].points.length; j++ ){
            if(cashedDataArr[company].routes[i].points[j].orderWindows == undefined){
                createSeveralAviabilityWindows(cashedDataArr[company].routes[i].points[j]);
            }
        }
    }







    for (i = 0; i < cashedDataArr[company].routes.length; i++) {
        var route = cashedDataArr[company].routes[i];
        //log.info ("route.driver.name", route.driver.NAME);
        route.lastPointIndx = 0;
        if (route.real_track != undefined) {
            for (var j = 0; j < route.real_track.length; j++) {
                // если статус не из будущего (в случае демо-режима) и стейт является стопом, b dhtvz проверяем его
                if (route.real_track[j].t1 < parseInt(Date.now()/1000) && route.real_track[j].state == "ARRIVAL") {
                    //log.info("считаем стоп", _data.server_time, route.real_track[j].t1, _data.server_time-route.real_track[j].t1)



                    var tmpArrival = route.real_track[j];

                    //log.info("tmpArrival",tmpArrival);
                    // перебираем все точки к которым
                    for (var k = 0; k < route.points.length; k++) {




                        var  tmpPoint = route.points[k];


                        //cashedDataArr[company].settings.limit != undefined ? cashedDataArr[company].settings.limit : cashedDataArr[company].settings.limit = 74;

                        if(tmpPoint.confirmed_by_operator == true || tmpPoint.limit > cashedDataArr[company].settings.limit || tmpPoint.havePushStop){
                            //log.info("Подтверждена вручную Уходим");
                            continue;
                        }


                        var LAT = parseFloat(tmpPoint.LAT);
                        var LON = parseFloat(tmpPoint.LON);
                        var lat = parseFloat(tmpArrival.lat);
                        var lon = parseFloat(tmpArrival.lon);

                        tmpPoint.distanceToStop = tmpPoint.distanceToStop || 2000000000;
                        tmpPoint.timeToStop = tmpPoint.timeToStop || 2000000000;

                        var tmpDistance = getDistanceFromLatLonInM(lat, lon, LAT, LON);

                        var tmpTime = Math.abs(tmpPoint.arrival_time_ts - tmpArrival.t1);






                        // Если маршрут не просчитан, отдельно проверяем попадает ли стоп в одно из возможных временных окон  и насколько он рядом
                        // и если да, то тоже привязываем стоп к точк

                        var suit=false;   //Показывает совместимость точки и стопа для непросчитанного маршрута
                        if (route.DISTANCE == 0 && tmpDistance < cashedDataArr[company].settings.stopRadius ) {
                            suit=checkUncalculateRoute(tmpPoint, tmpArrival, company);
                        }

                        // если стоп от точки не раньше значения timeThreshold и в пределах
                        // заданного в настройках радиуса, а так же новый детект ближе по расстояение и
                        // по времени чем предыдущий детект - привязываем этот стоп к точке

                        //todo написать заполнение данных на склад.
                        //Для склада временное окно расширяется вдвое
                        var warehoseK = 1;
                        if (tmpPoint.NUMBER !== '1' && tmpPoint.waypoint != undefined && tmpPoint.waypoint.TYPE === 'WAREHOUSE') {
                            warehoseK = 2;
                            //log.info("Рассчитываем склад", (tmpPoint.arrival_time_ts < tmpArrival.t2 + cashedDataArr[company].settings.timeThreshold &&
                            //tmpDistance < cashedDataArr[company].settings.stopRadius && (tmpPoint.distanceToStop > tmpDistance &&
                            //tmpPoint.timeToStop > tmpTime)));

                        }


                        var generalSuit;
                        // Подходит ли стоп по условиям "Обещанное окно"
                        var promiseSuit = (((tmpPoint.arrival_time_ts < tmpArrival.t2 + warehoseK*cashedDataArr[company].settings.timeThreshold*60) || (tmpPoint.arrival_time_ts > tmpArrival.t2 && tmpPoint.arrival_time_ts < tmpArrival.t2 + cashedDataArr[company].settings.timeThreshold*60)));


                        // подходит ли стоп по условиям "заказанное окно"
                        //if (tmpPoint.TASK_NUMBER == "4400455330" && tmpArrival.id+"" == "" + 2990767 ) {tmpPoint.checkOrderSuitSend =true;}



                        var orderSuit = checkOrderSuit (tmpPoint, tmpArrival, company);


                        if (cashedDataArr[company].settings.workingWindowType == 0 ){
                            generalSuit = orderSuit;

                        } else {
                            generalSuit = promiseSuit;
                        }


                        //if (tmpPoint.TASK_NUMBER == "4400455330" && tmpArrival.id+"" == "" + 2990767  ) log.info ("Второй этап проверки",cashedDataArr[company].settings.workingWindowTypes,  orderSuit, generalSuit, tmpDistance < cashedDataArr[company].settings.stopRadius, tmpPoint.distanceToStop > tmpDistance, tmpPoint.timeToStop > tmpTime);
                        if ((suit || generalSuit)  && tmpDistance < cashedDataArr[company].settings.stopRadius && (tmpPoint.distanceToStop > tmpDistance &&
                        tmpPoint.timeToStop > tmpTime)) {



                            //При привязке к точке нового стопа проверяет какой из стопов более вероятно обслужил эту точку
                            //
                            if(tmpPoint.haveStop == true && !findBestStop(tmpPoint, tmpArrival)){
                                continue;
                            }


                            // Проверяет не является ли данный стоп некорректным и ранее отвязанным вручную оператором
                            var uniqueId = "" + tmpArrival.lat + tmpArrival.lon + tmpArrival.t1;
                            var incorrect_stop = false;
                            if(tmpPoint.incorrect_stop != undefined ){
                                for (var si = 0; si < tmpPoint.incorrect_stop.length; si++){

                                    if (tmpPoint.incorrect_stop[si] == uniqueId) {
                                        incorrect_stop = true;
                                        break;
                                    }
                                }
                            }

                            if (incorrect_stop){
                                log.info ("Ура, найден некорректный стоп!!!!!!");
                                continue;
                            }

                            tmpPoint.distanceToStop = tmpDistance;
                            tmpPoint.timeToStop = tmpTime;
                            tmpPoint.haveStop = true;




                            //{ if (tmpArrival.t1 > tmpPoint.controlled_window.start) && (tmpArrival.t1<tmpPoint.controlled_window.finish){
                            //    tmpPoint.limit=60;
                            //} else {tmpPoint.limit=60; } }

                            //tmpPoint.moveState = j > 0 ? route.real_track[j - 1] : undefined;
                            tmpPoint.stopState = tmpArrival;
                            //tmpPoint.rawConfirmed=1; //Подтверждаю точку стопа, раз его нашла автоматика.

                            route.lastPointIndx = k > route.lastPointIndx ? k : route.lastPointIndx;
                            tmpPoint.stop_arrival_time = tmpArrival.t1;
                            tmpPoint.real_arrival_time = tmpArrival.t1;
                            tmpPoint.autofill_service_time = tmpPoint.stopState.time;
                            //if (tmpPoint.autofill_create != undefined) tmpPoint.autofill_change = '4280';
                            //tmpPoint.autofill_create ='4281' + tmpPoint.stopState.id;
                            //route.points[k]
                            //log.info("route-point-k", route.points[k], "route" , route)

                            //if (angular.isUndefined(tmpArrival.servicePoints)==true){
                            //    tmpArrival.servicePoints=[];
                            //}

                            if(tmpArrival.servicePoints == undefined) { tmpArrival.servicePoints=[]};

                            // проверка, существует ли уже этот стоп
                            var ip=0;
                            var sPointExist=false;
                            while(ip<tmpArrival.servicePoints.length){
                                if(tmpArrival.servicePoints[ip]==tmpPoint.NUMBER){
                                    sPointExist=true;
                                    break;
                                }
                                ip++;
                            }
                            if(!sPointExist){
                                tmpArrival.servicePoints.push(tmpPoint.NUMBER);}

                            // tmpPoint.rawConfirmed=0;

                            //log.info("Find stop for Waypoint and change STATUS")



                        }


                    }
                }

            }


            // log.info("PRE Last point for route ", route.ID, " is ", route.points[route.lastPointIndx].NUMBER);
            var lastPoint = route.points[route.lastPointIndx];
            // log.info("POST Last point for route ", route.ID, " is ", lastPoint.NUMBER);

            // проверка последней определенной точки на статус выполняется
            if (lastPoint != null && route.car_position !=  undefined) {
                // log.info("Route", route);
                if (lastPoint.arrival_time_ts + parseInt(lastPoint.TASK_TIME) > parseInt(Date.now()/1000)
                    && getDistanceFromLatLonInM(route.car_position.lat, route.car_position.lon,
                        lastPoint.LAT, lastPoint.LON) < cashedDataArr[company].stopRadius) {
                    lastPoint.status = 3;
                }
            }
        }

        // log.info("Last point for route", route.ID, _data.routes[i].ID, " is ", route.lastPointIndx, lastPoint.NUMBER );

    }
    } catch (e) {
        log.error( "Ошибка "+ e + e.stack);
    }

}


function findStatusesAndWindows(company) {
    try{
    log.info("Start findStatusesAndWindows", company);
    var tmpPoint;

    for(var i=0; i<cashedDataArr[company].routes.length; i++ ) {

        cashedDataArr[company].routes[i].ready_to_close=true;

        //log.info("1");
        for (var j=0; j<cashedDataArr[company].routes[i].points.length; j++) {
            //log.info("2");

            tmpPoint = cashedDataArr[company].routes[i].points[j];



            if (tmpPoint.real_arrival_time == undefined) {
                cashedDataArr[company].routes[i].ready_to_close=false;

                continue;
            }
            //считаем окна только для доставленного
            //if (tmpPoint.status > 3 && tmpPoint.status != 6) continue;
            //log.info("Точка  вероятно доставлена");

            tmpPoint.windowType = 'Вне окон';
            if (tmpPoint.promised_window_changed.start < tmpPoint.real_arrival_time
                && tmpPoint.promised_window_changed.finish > tmpPoint.real_arrival_time) {
                tmpPoint.windowType = 'В обещанном';
                //log.info('В заказанном')
            } else {
                for (var l = 0; tmpPoint.windows != undefined && l < tmpPoint.windows.length; l++) {
                    if (tmpPoint.windows[l].start < tmpPoint.real_arrival_time
                        && tmpPoint.windows[l].finish > tmpPoint.real_arrival_time) {
                        tmpPoint.windowType = 'В заказанном';
                        //log.info('В обещанном');
                        break;
                    }
                }
            }


            //log.info("cashedDataArr[company].settings.workingWindowTypes", cashedDataArr[company].settings.workingWindowType);
            if (cashedDataArr[company].settings.workingWindowType == 1) {
                //tmpPoint.findStatus = true;
                if (tmpPoint.waypoint.TYPE == "WAREHOUSE"){
                    //todo Дописать определение статуса для склада
                    continue;
                }



                //log.info(tmpPoint, "MTM 4121");
                //Костыль, если working window неправильно сформирован
                if (!tmpPoint.working_window.isArray) {
                    var transit = tmpPoint.working_window;
                    tmpPoint.working_window =[];
                    tmpPoint.working_window.push(transit)

                }
                if (tmpPoint.real_arrival_time > tmpPoint.working_window[tmpPoint.working_window.length-1].finish) {
                    tmpPoint.status = 1;
                    //log.info("Присваиваем статус 1");
                } else if (tmpPoint.real_arrival_time < tmpPoint.working_window[0].start) {
                    //log.info("Присваиваем статус 2");
                    tmpPoint.status = 2;
                } else {
                    //log.info("Присваиваем статус 0");
                    tmpPoint.status = 0;
                }
            } else{


                if (tmpPoint.waypoint.TYPE == "WAREHOUSE"){
                    //todo Дописать определение статуса для склада
                    continue;
                }


                var start, end;
                tmpPoint.status = undefined;

                if (tmpPoint.working_window[0] == undefined){
                    end = tmpPoint.working_window.finish;
                    start = tmpPoint.working_window.start;
                } else {
                    end = tmpPoint.working_window[tmpPoint.working_window.length-1].finish;
                    start = tmpPoint.working_window[0].start;
                }



                if (tmpPoint.real_arrival_time > end)
                {
                    //log.info("Присваиваем статус 1");
                    tmpPoint.status = 1;

                }

                if (tmpPoint.real_arrival_time < start)
                {
                    //log.info("Присваиваем статус 2");
                    tmpPoint.status = 2;
                }

                if (tmpPoint.status == undefined) {
                    if (tmpPoint.working_window[0] == undefined) {
                        //log.info("Присваиваем статус 0");
                        tmpPoint.status = 0;
                    } else {
                        for (var k=0; k<tmpPoint.working_window.length; k++){
                            if (tmpPoint.real_arrival_time > tmpPoint.working_window[k].start && tmpPoint.real_arrival_time < tmpPoint.working_window[k].finish ){
                                tmpPoint.status = 0;
                                //log.info("Присваиваем статус 0");
                                break;
                            }
                        }


                    }


                    if(tmpPoint.status == undefined) {
                        //точка где то между окнами
                        //log.info("Присваиваем статус 1");
                        tmpPoint.status = 1; //todo Условно присвоили статус доставлен поздно, если не попали ни в одно окно
                    }

                }

            }

            //корректировка достоверности статусов по процентам.
            tmpPoint.limit = 0;
            if (tmpPoint.confirmed_by_operator) {
                tmpPoint.limit = 100;

                continue;
            }
            if (tmpPoint.havePushStop) {
                tmpPoint.limit = 90;

                continue;
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

            //log.info("Настройки", cashedDataArr[company].settings.limit);
            if (tmpPoint.limit > 0 && tmpPoint.limit < cashedDataArr[company].settings.limit) {
                tmpPoint.status = 6;
                cashedDataArr[company].routes[i].ready_to_close=false;
                tmpPoint.problem_index = 1;
                //log.info("tmpPoint.problem_index", tmpPoint.problem_index);
            }
            //log.info("И присваиваем ей статус", tmpPoint.status);
        }

    }
    } catch (e) {
        log.error( "Ошибка "+ e + e.stack);
    }

}



function calculateStatistic (company){
    try {
    log.info("Start calculate Statistic");
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


    //Подсчет общего веса для маршрута, если он не был посчитан ранее
    for (i=0; i<cashedDataArr[company].routes.length; i++){
        if (cashedDataArr[company].routes.weight == undefined) cashedDataArr[company].routes[i].weight = 0;
        for (var j=0; j<cashedDataArr[company].routes[i].points.length;j++){
            cashedDataArr[company].routes[i].weight +=parseInt(cashedDataArr[company].routes[i].points[j].WEIGHT);

        }
    }

    } catch (e) {
        log.error( "Ошибка "+ e + e.stack);
    }
}

function oldDayStatuses(company) {
    try {
    log.info("Заменяем статусы компании", company );
    for (var i=0; i<cashedDataArr[company].routes.length;i++){
        for (var j=0; j<cashedDataArr[company].routes[i].points.length; j++){
            if (cashedDataArr[company].routes[i].points[j].status >2 && cashedDataArr[company].routes[i].points[j].status !=8 ) {
                //log.info("Change Old Day Status");
                cashedDataArr[company].routes[i].points[j].status == 4;
            }
        }
    }
    } catch (e) {
        log.error( "Ошибка "+ e + e.stack);
    }
}

function oldDayCalculate (company, data) {
    try {
    // св-во server_time получает истенное время сервера, только если был запрошен день не из календарика, если из - то вернет 23 59 запрошенного дня
    data.current_server_time = parseInt(new Date() / 1000);
    data.currentDay = false;
    cashedDataArr[company].currentDay = false;
    log.info("Прошлый день готов к рассчету", company);
    createFilterIdForOldDay(company);
    concat1CAndMonitoring (company);

    } catch (e) {
        log.error( "Ошибка "+ e + e.stack);
    }
}

function continueConcat(company) {
    connectPointsAndPushes(company)
    //connectPointsPushesStops(company);
    connectStopsAndPoints(company);
    findStatusesAndWindows(company);
    calculateStatistic (company);
    //checkRealTrackData(company); //todo убрать, после того как починят треккер
    //oldDayStatuses(company);
    log.info("Расчет прошлого дня окончен", company);
    log.info("Доставленных точек", cashedDataArr[company].statistic[0]+cashedDataArr[company].statistic[1]+cashedDataArr[company].statistic[2] )
    cashedDataArr[company].ready = true;
    log.info("Готово к отдаче", cashedDataArr[company].ready);
}

function checkUniqueID (company){
    try{
    log.info("Start check uniqueID");
    for ( var i=0; i<cashedDataArr[company].routes.length; i++){
        //log.info("i", i);
        for (var j = i+1; j < cashedDataArr[company].routes.length; j++){
            //log.info("j", j, cashedDataArr[company].routes[i].uniqueID , cashedDataArr[company].routes[j].uniqueID);
            if (cashedDataArr[company].routes[i].uniqueID == cashedDataArr[company].routes[j].uniqueID){

                log.info(cashedDataArr[company].routes[i].uniqueID , cashedDataArr[company].routes[j].uniqueID);
                log.info("АТТЕНТИОН!!!!! Find equals uniqiueID", cashedDataArr[company].routes[i].driver.NAME, cashedDataArr[company].routes[j].driver.NAME)
            }
        }
    }
    } catch (e) {
        log.error( "Ошибка "+ e + e.stack);
    }
}

function selectRoutes(company) {
    try{
    if (cashedDataArr[company].line_routes == undefined || cashedDataArr[company].line_routes == null) return;
    cashedDataArr[company].routes = cashedDataArr[company].routes.concat(cashedDataArr[company].line_routes);
    cashedDataArr[company].line_routes.length=0;
    } catch (e) {
        log.error( "Ошибка "+ e + e.stack);
    }
}



function serchInCache(input, company) {
    try {

    if(input == undefined || company == undefined || input == null || input =='') return '';
    var hits = [];
    var routesForSerch=[];

    //Создаем область поиска
    routesForSerch=routesForSerch.concat(cashedDataArr[company].routes);
    routesForSerch=routesForSerch.concat(cashedDataArr[company].line_routes);
    routesForSerch=routesForSerch.concat(cashedDataArr[company].blocked_routes);
    //log.info("Начинаем поиск", routesForSerch.length);


    for (var i=0; i< routesForSerch.length; i++){
        //log.info("проверяем Водителя", routesForSerch[i].driver.NAME, " ", input)
        if(routesForSerch[i].driver.NAME.indexOf(input)>=0){
            //log.info("Найден водитель", routesForSerch[i].driver.NAME);
            hits.push({driverName:routesForSerch[i].driver.NAME, uniqueID: routesForSerch[i].uniqueID, transportName: routesForSerch[i].transport.NAME });
            continue;
        }

        for (var j=0; j< routesForSerch[i].points.length; j++){
            var name='',
                adress='',
                comment='',
                needPush=false;
            if(routesForSerch[i].points[j].waypoint == undefined) continue;

            if (routesForSerch[i].points[j].waypoint.NAME.indexOf(input)>=0){
                name =  routesForSerch[i].points[j].waypoint.NAME;
                needPush =true;
            }

            if (routesForSerch[i].points[j].waypoint.ADDRESS.indexOf(input)>=0){
                adress =  routesForSerch[i].points[j].waypoint.ADDRESS;
                needPush =true;
            }

            if (routesForSerch[i].points[j].waypoint.COMMENT.indexOf(input)>=0){
                comment =  routesForSerch[i].points[j].waypoint.COMMENT;
                needPush =true;
            }

            if(needPush){
                hits.push({driverName:routesForSerch[i].driver.NAME, uniqueID: routesForSerch[i].uniqueID, transportName: routesForSerch[i].transport.NAME, name:name, adress:adress, comment:comment });
            }

        }
    }
    return hits;
    } catch (e) {
        log.error( "Ошибка "+ e + e.stack);
    }
}


function printData(company) {
    try {

    for (var i = 0; i <onlineClients.length; i++ ){
        log.info(" Онлайн", onlineClients[i]);
    }

    for (i= 0; i<blockedRoutes.length; i ++){
        log.info(" Блокед", blockedRoutes[i]);
    }

    var routesCount = 0;
    var pointsCount = 0;
    var canceledCount = 0;
    var outCount = 0;
    var orderCount = 0;
    var undefinedCount = 0;
    var biger15 = 0;


    for (i=0; i<cashedDataArr[company].routes.length; i++ ){
        if (cashedDataArr[company].routes[i].real_track == undefined || cashedDataArr[company].routes[i].real_track.length < 20) continue;
        routesCount++;
        for (var j=0; j<cashedDataArr[company].routes[i].points.length; j++){
            pointsCount++;
            var point = cashedDataArr[company].routes[i].points[j];
            if (point.windowType == "В заказанном" || point.windowType == "В обещанном" ) {
                orderCount++;
                continue;
            }
            if (point.status == 8) {
                canceledCount++;
                continue;
            }
            if (point.windowType == "Вне окон") {
                outCount++;
                continue;
            }

            undefinedCount++;


        }
    }

    for (i=0; i<cashedDataArr[company].line_routes.length; i++ ){
        if (cashedDataArr[company].line_routes[i].real_track == undefined || cashedDataArr[company].line_routes[i].real_track.length < 20) continue;
        routesCount++;
        for (j=0; j<cashedDataArr[company].line_routes[i].points.length; j++){
            pointsCount++;
            point = cashedDataArr[company].line_routes[i].points[j];
            if (point.waypoint == undefined) continue;
            if (point.windowType == "В заказанном" || point.windowType == "В обещанном" ) {
                orderCount++;
                continue;
            }
            if (point.status == 8) {
                canceledCount++;
                continue;
            }
            if (point.windowType == "Вне окон") {
                outCount++;
                if (point.orderWindows[0] == undefined) continue;
                if (point.real_arrival_time < point.orderWindows[0].start-15*60 || point.real_arrival_time > point.orderWindows[point.orderWindows.length-1].finish+15*60) {
                    biger15++;
                    continue
                }

                continue;
            }

            undefinedCount++;

        }
    }



    //for (i=0; i<cashedDataArr[company].blocked_routes.length; i++ ){
    //    if (cashedDataArr[company].blocked_routes[i].real_track == undefined || cashedDataArr[company].blocked_routes[i].real_track.length < 20) continue;
    //    routesCount++;
    //    for (var j=0; j<cashedDataArr[company].blocked_routes[i].points.length; j++){
    //        pointsCount++;
    //        var point = cashedDataArr[company].blocked_routes[i].points[j];
    //        if (point.windowType == "В заказанном" || point.windowType == "В обещанном" ) {
    //            orderCount++;
    //            continue;
    //        }
    //        if (point.status == 8) {
    //            canceledCount++;
    //            continue;
    //        }
    //        outCount++
    //
    //
    //    }
    //}


    log.info ("Итоговая информация" + "\n" +
        "Достойных роутов " + routesCount + "\n" +
        "Точек доставки " + pointsCount + "\n" +
        "Точек в заказанном окне " + orderCount + "\n" +
        "Отмененных точек " + canceledCount + "\n" +
        "Доставленных мимо " + outCount + "\n" +
        "В том числе с разницей более 15 минут " + biger15 + "\n"+
        "Точек с неопределенным статусом " + undefinedCount);
    } catch (e) {
        log.error( "Ошибка "+ e + e.stack);
    }
}


function unblockInData(data){
    try {
    //log.info("Переносим заблокированный роуты в нормальные");
    if (cashedDataArr[data.company].blocked_routes == undefined) return;
    //log.info("Есть заблокированные");
    for (var i=0; i<cashedDataArr[data.company].blocked_routes.length; i++){
        //log.info("Сравнение ", cashedDataArr[data.company].blocked_routes[i].uniqueID , data.id)
        if (cashedDataArr[data.company].blocked_routes[i].uniqueID == data.id){
            log.info("Переносим", data.id);
            cashedDataArr[data.company].routes.push(cashedDataArr[data.company].blocked_routes[i]);
            cashedDataArr[data.company].blocked_routes.splice(i,1);
            log.info("Роутов", cashedDataArr[data.company].routes.length, "А блокированных роутов", cashedDataArr[data.company].blocked_routes.length);
            break;
        }
    }
    } catch (e) {
        log.error( "Ошибка "+ e + e.stack);
    }
}


function unblockLogin(login) {
    try {
    //log.info("Start unbloking");
    for (var i = 0; i < blockedRoutes.length; i++) {
        if ("" + blockedRoutes[i].login == "" + login) {
            unblockInData(blockedRoutes[i]);
            blockedRoutes.splice(i, 1);
            i--;
        }

    }

    //var nowTime = parseInt(Date.now() / 1000);
    //for (i = 0; i < blockedRoutes.length; i++) {
    //    if (blockedRoutes[i].time + 60 * 3 < nowTime) {
    //        blockedRoutes.splice(i, 1);
    //        i--;
    //    }
    //
    //}
    } catch (e) {
        log.error( "Ошибка "+ e + e.stack);
    }

}


function cancelTaskPush(push, point, company){
    try{
    if(push == undefined || point == undefined) {
        log.info(point, push, "!!!!!ОШИБКА входных данных в функции cancelTaskPush 1-point, 2-push");
        return;
    }

    //log.info("Отменяющий пуш выглядит так", push);
    point.status = 8;
    point.checkedStatus = 8;
    point.class = "canceled-status";
    point.textStatus = "отменен";
    point.cancel_time = parseInt(Date.now()/1000);
    point.havePush = true;
    point.mobile_push = push;
    point.limit = 85; //todo отфонарная цифра для тестов.
    point.confirmed = true;
    point.reason = push.cancel_reason;

    if(push.cancel_reason != undefined && push.cancel_reason.length >0) {
        for (var i=0; i<cashedDataArr[company].reasons.length; i++ ){
            //log.info("Ищем причину отмены задания", push.cancel_reason, cashedDataArr[company].reasons[i].DESCRIPTION);
            if(push.cancel_reason == cashedDataArr[company].reasons[i].DESCRIPTION) {
                point.reason = i;
                break;
            }
        }

    }

    } catch (e) {
        log.error( "Ошибка "+ e + e.stack);
    }


}


function checkCorrectCalculating(company){
    try{
    log.info("Проверяем корректность расчета маршрутов");
    if (company == undefined || cashedDataArr[company] == undefined) {
        log.info("Ошибка в функции checkCorrectCalculating ");
        return;
    }

    if (cashedDataArr[company].routes != undefined) {
        for (var i=0; i<cashedDataArr[company].routes.length; i++){
            if (cashedDataArr[company].routes[i].DISTANCE == 0 || cashedDataArr[company].routes[i].check_calc == true || cashedDataArr[company].routes[i].points == undefined) continue;
            //log.info("проверка Роута");
            for (var j=0; j<cashedDataArr[company].routes[i].points.length; j++){
                //log.info("проверка точки в Роуте");
                if (cashedDataArr[company].routes[i].points[j].ARRIVAL_TIME == undefined || cashedDataArr[company].routes[i].points[j].ARRIVAL_TIME == '' || cashedDataArr[company].routes[i].points[j].ARRIVAL_TIME.length == 0 ){
                    //log.info("Найден непросчитанный роут!!!!!");
                    createArrivalTime(cashedDataArr[company].routes[i].points[j], cashedDataArr[company].routes[i], cashedDataArr[company].settings.controlledWindow, company);
                    cashedDataArr[company].routes[i].DISTANCE = 0;
                    cashedDataArr[company].routes[i].check_calc = true;
                    continue;

                }
            }
        }
    }

    if (cashedDataArr[company].line_routes != undefined) {
        for (var i=0; i<cashedDataArr[company].line_routes.length; i++){
            //log.info("проверка  лайн Роута");
            if (cashedDataArr[company].line_routes[i].DISTANCE == 0 || cashedDataArr[company].line_routes[i].check_calc == true || cashedDataArr[company].line_routes[i].points == undefined) continue;

            for (var j=0; j<cashedDataArr[company].line_routes[i].points.length; j++){
                //log.info("проверка точки в  Лайн Роуте");
                if (cashedDataArr[company].line_routes[i].points[j].ARRIVAL_TIME == undefined || cashedDataArr[company].line_routes[i].points[j].ARRIVAL_TIME == '' || cashedDataArr[company].line_routes[i].points[j].ARRIVAL_TIME.length == 0 ){
                    //log.info("Найден непросчитанный роут!!!!!");
                    createArrivalTime(cashedDataArr[company].line_routes[i].points[j], cashedDataArr[company].line_routes[i], cashedDataArr[company].settings.controlledWindow, company);
                    cashedDataArr[company].line_routes[i].DISTANCE = 0;
                    cashedDataArr[company].line_routes[i].check_calc = true;
                    continue;

                }
            }
        }
    }


    log.info("Первичная проверка корректности расчетов окончена");

    if (cashedDataArr[company].routes != undefined) {
        for (i = 0; i < cashedDataArr[company].routes.length; i++) {
            for (j = 0; j<cashedDataArr[company].routes[i].points.length; j++){
                if(cashedDataArr[company].routes[i].points[j].waypoint == undefined) {
                    log.info(cashedDataArr[company].routes[i].points[j], "Внимание, найдена точка маршрута без описания!!!");
                }
            }
        }
    }


        if (cashedDataArr[company].routes != undefined) {

            for (i = 0; i < cashedDataArr[company].routes.length && cashedDataArr[company].routes[i].max_arrival_time == undefined ; i++) {
                //console.log("!@#!@#$!$%@#$^@%^!@#%$!@#%!#$%!#$%^!#$%!#$%!@#%");
                var route = cashedDataArr[company].routes[i];

                for (j=0; j<route.points.length; j++){
                    var point = route.points[j];
                    if (route.max_arrival_time == undefined && point != undefined && point.arrival_time_ts != undefined) route.max_arrival_time = point.arrival_time_ts;
                    if (point != undefined && point.arrival_time_ts != undefined && point.arrival_time_ts > route.max_arrival_time) route.max_arrival_time = point.arrival_time_ts;

                }

            }
        }
    } catch (e) {
        log.error( "Ошибка "+ e + e.stack);
    }
}


function createArrivalTime (tPoint, route, controlledWindow, company) {
    try{
    //log.info("#############################################################The route is UNCALCULATE########################################################");


    //Для непосчитанных маршрутов время прибытия считается границей окна доступности
    tPoint.arrival_time_hhmm = tPoint.AVAILABILITY_WINDOWS.slice(-5) + ":00";

    // Костыль. Когда в утвержденные маршруты попадает точка с неуказанным временем прибытия
    //todo очень злой костыль, нужно срочно найти правильное решение

    if (tPoint.ARRIVAL_TIME.length < 1) {
        if(route.points[1] != undefined && route.points[1].ARRIVAL_TIME != undefined && route.points[1].ARRIVAL_TIME.length !='' && route.points[1].ARRIVAL_TIME.length !=0) {
            tPoint.ARRIVAL_TIME = route.points[1].ARRIVAL_TIME
        }

    }
    var toDay = tPoint.ARRIVAL_TIME.substr(0, 10);

    tPoint.base_arrival = toDay + " " + tPoint.arrival_time_hhmm;

    tPoint.arrival_time_ts = strToTstamp(toDay + " " + tPoint.arrival_time_hhmm);
    tPoint.base_arrival_ts = strToTstamp(toDay + " " + tPoint.arrival_time_hhmm);

        //todo костылек. Определение самого позднего времени доставки Используется в мэп контроллере, как граница прорисовки маршрута если эта граница посчитана в 1С неправильно

    createSeveralAviabilityWindows(tPoint);

    tPoint.controlled_window = {
        start: tPoint.arrival_time_ts - controlledWindow,
        finish: tPoint.arrival_time_ts + controlledWindow
    };

    tPoint.end_time_hhmm = tPoint.AVAILABILITY_WINDOWS.slice(-5) + ":00";
    tPoint.end_time_ts = strToTstamp(toDay + " " + tPoint.arrival_time_hhmm);

    tPoint.promised_window.start = tPoint.arrival_time_ts - 60*30;
    tPoint.promised_window.finish = tPoint.arrival_time_ts + 60*30;

    tPoint.promised_window_changed = tPoint.promised_window;


    if (cashedDataArr[company].settings.workingWindowType == 0){

        log.info (tPoint, "MTM 4538");
        log.info("Время заказанное",  tPoint.orderWindows[tPoint.orderWindows.length -1]);
        tPoint.working_window = tPoint.orderWindows[tPoint.orderWindows.length -1];
    }  else {

        log.info("Время обещанное");
        tPoint.working_window = tPoint.orderWindows;
    }
    } catch (e) {
        log.error( "Ошибка "+ e + e.stack);
    }
}


function createFilterIdForOldDay(company) {
    try {
    log.info("Start createFilterIdForOldDay");
    if(company == undefined) {
        log.info("ОШИБКА ВХОДНЫХ ДАННЫХ createFilterIdForOldDay");
        return;
    }


    for (var i=0; i<cashedDataArr[company].routes.length; i++){
        for (var j =0; j<cashedDataArr[company].allRoutes.length; j++ ){
            if (cashedDataArr[company].routes[i].uniqueID == cashedDataArr[company].allRoutes[j].uniqueID) {
                //log.info("Найдено совпадение");
                cashedDataArr[company].routes[i].filterId = cashedDataArr[company].allRoutes[j].value;
                break;
            }
        }

    }
    log.info("FINISH createFilterIdForOldDay");
    } catch (e) {
        log.error( "Ошибка "+ e + e.stack);
    }
}


function createSeveralAviabilityWindows (point){
    try {

    point.orderWindows=[];
    //log.info("Start checkUncalculate");

    if (point.AVAILABILITY_WINDOWS == undefined || point.AVAILABILITY_WINDOWS.length == 0) return;

    var parts=point.AVAILABILITY_WINDOWS.split(";");
    var size=parts.length;
    var i=0;
    while(i<size){
        var date=point.ARRIVAL_TIME.substr(0,11);
        var temp=parts[i].trim();
        //log.info("Arrival Time", point.ARRIVAL_TIME );
        //log.info("Date", date, temp);
        var before=temp.substr(0,5);
        before=date+before+":00";
        //log.info("before=", before);
        var begin=strToTstamp(before, point);

        var after=temp.slice(-5);
        after=date+after+":00";
        //log.info("after=", after);
        var end=strToTstamp(after, point);
        point.orderWindows.push({start: begin, finish: end });


        i++;
    }
    } catch (e) {
        log.error( "Ошибка "+ e + e.stack);
    }

}


function checkOrderSuit (point, stop, company) {
    try {
    //log.info("Start checkOrderSuit");
    if (point == undefined || stop == undefined) {
        log.info(point, stop, "Ошибка данных в checkOrderSuit");
        return false;
    }


    //if (point.TASK_NUMBER == "4400455330" && stop.id+"" == "" + 2990767 ) point.checkOrderSuit =true;


    if (point.orderWindows[0] == undefined) {

        if (stop.t1 < point.orderWindows.finish + cashedDataArr[company].settings.timeThreshold*60 && stop.t2 > point.orderWindows.start - cashedDataArr[company].settings.timeThreshold*60 ) {
            //point.variant = 1;
            return true;
        } else {
            //point.variant = 2;
            return false;}


    } else {

        //log.info("_________________________________________________________________________________________")
        for (var i=0; i<point.orderWindows.length; i++){

            //if (point.TASK_NUMBER == "4400455330" && stop.id+"" == "" + 2990767  ) log.info("Проверяем точку", stop.t1, point.orderWindows[i].finish + cashedDataArr[company].settings.timeThreshold*60, (stop.t1 < point.orderWindows[i].finish + cashedDataArr[company].settings.timeThreshold*60), " и больше ", stop.t2, point.orderWindows[i].start - cashedDataArr[company].settings.timeThreshold*60, (stop.t2 > point.orderWindows[i].start - cashedDataArr[company].settings.timeThreshold*60))
            if (stop.t1 < point.orderWindows[i].finish + cashedDataArr[company].settings.timeThreshold*60 && stop.t2 > point.orderWindows[i].start - cashedDataArr[company].settings.timeThreshold*60 ) {
                //log.info("Проверка удачная");
               // point.variant = 3;
                return true;
            }
        }
        //point.variant = 4;
        return false;

    }
    } catch (e) {
        log.error( "Ошибка "+ e + e.stack);
    }

};


function predicateTime(company) {
    try {
    log.info("Start predicateTime");
    for (var i=0; i< cashedDataArr[company].routes.length; i++){
        var route = cashedDataArr[company].routes[i];
        if (route.DISTANCE == 0) {
            uncalcPredication(route, company);
        } else {
            calcPredication(route, company);
        }

    }
    } catch (e) {
        log.error( "Ошибка "+ e + e.stack);
    }
}



function calculateProblemIndex(company) {
    try {
    log.info("Start calculate ProblemIndx");

    var point,
        timeThreshold = 3600 * 6,
        timeMin = 0.25,
        timeCoef;
    for (var i=0; i<cashedDataArr[company].routes.length; i++) {
        var route = cashedDataArr[company].routes[i];
        route.max_problem = 0;
        route.problem_point={};
        route.kind_of_problem='';

        for (var j = 0; j < route.points.length; j++) {
            point = route.points[j];

            point.problem_index = 0;



            if(point.status < 4 || point.status == 8) continue;
            //log.info("Найдена проблемная точка");

            if (point.status == 6) {
                point.problem_index = 1;
                if (route.find_problem_ts == 0 || route.find_problem_ts == undefined){
                    route.find_problem_ts = parseInt(Date.now()/1000);
                }
                // Проверка на максимальную проблемность
                if(point.problem_index > route.max_problem) {
                    route.max_problem = point.problem_index;
                    route.problem_point=point;
                    route.kind_of_problem='внимание';
                    // log.info("Проблемность равна  1");
                    continue;
                }

            }




            // log.info("point.problem_index", point.problem_index);

                if (point.status == 4) {
                    var koef;
                    if (point.working_window[0] == undefined) {
                        koef = point.working_window.finish;
                    } else {
                        koef = point.working_window[point.working_window.length-1].finish;
                    }
                    point.problem_index += (point.overdue_time) * cashedDataArr[company].settings.factMinutes;

                    timeCoef = 1;

                } else {
                    timeCoef = (timeThreshold - point.arrival_left_prediction) / timeThreshold;
                    timeCoef = timeCoef >= timeMin ? timeCoef : timeMin;

                }

                if (route.find_problem_ts == 0 || route.find_problem_ts == undefined){
                    route.find_problem_ts = parseInt(Date.now()/1000);
                }

                point.problem_index += parseInt(point.overdue_time * cashedDataArr[company].settings.predictMinutes);
                point.problem_index += parseInt(point.WEIGHT) * cashedDataArr[company].settings.weight;
                point.problem_index += parseInt(point.VOLUME) * cashedDataArr[company].settings.volume;
                point.problem_index += parseInt(point.VALUE) * cashedDataArr[company].settings.value;
                if (point.change_time) {
                    point.problem_index += parseInt(point.change_time) * cashedDataArr[company].settings.changeTime;
                }

                point.problem_index = parseInt(point.problem_index * timeCoef);
                point.problem_index = parseInt(point.problem_index / 100);

                // log.info("Проблемность равна  ",  point.problem_index);
                // Проверка на максимальную проблемность
                if(point.problem_index > route.max_problem) {
                    route.max_problem = point.problem_index;
                    route.problem_point=point;
                    if(point.status == 4 ){route.kind_of_problem='время вышло';}
                    if(point.status == 5 ){route.kind_of_problem='опаздывает';}

                }

                // Calculate problem index for delay points



        }
    }


    //проверка не запланировано ли прибытие в какую либо точку за пределами заказанных окон
    // todo придумать правильную логику, когда и как находить эту проблему. При данной реализации
    // todo во-первых лишний проход цикла, во вторых подумать о соотношении этой проблемы с другими
    // todo хотя по идее при равильной работе диспетчера он увидит эту проблему прямо утром при запуске сервиса первом пересчете
    // todo трудность в том, что оператор может первый раз запустить программу в середине дня

    for ( i=0; i<cashedDataArr[company].routes.length; i++) {
         route = cashedDataArr[company].routes[i];

        for ( j=0; j < route.points.length; j++){
            point = route.points[j];
            var outOfWindows = true;
            if (point.orderWindows == undefined || point.waypoint == undefined || point.waypoint.TYPE == "WAREHOUSE" || point.waypoint.TYPE =="PARKING") {
                //log.info("У точки нет заказанного окна, скорее всего склад");
                continue;
            }

            //чисто технически добавляем по минуте к границам заказанного окна
            for (var k =0; k<point.orderWindows.length; k++){
                var window = point.orderWindows[k];
                if (point.arrival_time_ts  < window.finish + 60 && point.arrival_time_ts > window.start - 60 ){
                    outOfWindows =false;
                    break;
                }
            }

            if (outOfWindows && point.waypoint && point.waypoint.TYPE != "WAREHOUSE" && point.waypoint.TYPE !="PARKING"){
                log.info("Время прибытия точки запланировано за пределами заказанных окон", point.driver.NAME, point.NUMBER, point.arrival_time_ts, window.finish , window.start );
                point.problem_index = route.max_problem+1; //todo посчитать проблемность для точки вне окна
                point.out_of_ordered = true;
                route.max_problem = point.problem_index;
                route.problem_point=point;
                route.kind_of_problem='вне заказанного';
            }
        }
    }



    //определение готовых к закрытию маршрутов

    for (var i=0; i<cashedDataArr[company].routes.length; i++) {
        // log.info("Start looking for ready to close");
        if (cashedDataArr[company].routes[i].closed == true) {
            changeNameOfRoute(company, cashedDataArr[company].routes[i].uniqueID);
            continue;
        }

        //todo прописать функцию закрытия роута с ноды
        if (cashedDataArr[company].routes[i].ready_to_close) {

            route = cashedDataArr[company].routes[i];
            log.info("Find route ready to close");
            route.max_problem = 0.5;
            route.kind_of_problem='не закрыт';
            route.find_problem_ts = parseInt(Date.now()/1000);

        }


    }

    for (i=0; i<cashedDataArr[company].routes.length; i++) {
        if (cashedDataArr[company].routes[i].max_problem == 0 || cashedDataArr[company].routes.max_problem == undefined ) {
            cashedDataArr[company].routes[i].find_problem_ts = 0;
        }
    }
    } catch (e) {
        log.error( "Ошибка "+ e + e.stack);
    }

}


function createProblems(company) {
    try {
    //todo поиск и сортировка ведется по полю max_problem. А описание проблемы в поле kind_of_problem
    //todo дописать определение проблемности в случае, если проблемма - не точка
    // Задача этой функции сформировать и расставить по порядку проблеммы
    cashedDataArr[company].line_routes = [];

    for (var i=0; i<cashedDataArr[company].routes.length; i++){
        if (cashedDataArr[company].routes[i].max_problem >0) {
            cashedDataArr[company].line_routes.push(cashedDataArr[company].routes[i]);
            cashedDataArr[company].routes.splice(i,1);
            i--;
        }
    }



    cashedDataArr[company].line_routes.sort(compareNumeric);

    function compareNumeric(a, b) {
        return b.max_problem - a.max_problem;
    }


    log.info("!!!!!!!!Посчитана компания", company);
    //log.info("Конец рассчета, который занял", parseInt(Date.now()/1000)-superEndTime);
    log.info("Общая статистика. Беспроблемных роутов", cashedDataArr[company].routes.length);
    log.info("Роутов с проблеммами в очереди",cashedDataArr[company].line_routes.length);
    log.info("Роутов розданных операторам", cashedDataArr[company].blocked_routes ? cashedDataArr[company].blocked_routes.length : 0);
    log.info("Прошлых незакрытых роутов", cashedDataArr[company].oldRoutes ? cashedDataArr[company].oldRoutes.length:0);

    } catch (e) {
        log.error( "Ошибка "+ e + e.stack);
    }
}


function checkServiceTime(company) {
    try {
    if (company == undefined) {
        log.info("Ошибка в checkServiceTime");
        return;
    }
    for (var i=0; i<cashedDataArr[company].routes.length; i++){

       // if (cashedDataArr[company].routes[i].DISTANCE == 0 || cashedDataArr[company].routes[i].DISTANCE == '0') continue;
        for(var j=0; j<cashedDataArr[company].routes[i].points.length; j++){

            //console.log("Расчет Правильности обслуживания", cashedDataArr[company].routes[i].points[j].waypoint == undefined,
            //    cashedDataArr[company].routes[i].points[j].waypoint.TASK_TIME == "0" ,
            //    !(cashedDataArr[company].routes[i].points[j].autofill_service_time > 0  || cashedDataArr[company].routes[i].points[j].real_service_time > 0))



            if( cashedDataArr[company].routes[i].points[j].waypoint == undefined ||
                cashedDataArr[company].routes[i].points[j].TASK_TIME == "0" ||
                !(cashedDataArr[company].routes[i].points[j].stopState   || cashedDataArr[company].routes[i].points[j].real_service_time > 0)){
                //console.log ("Delta UNDEFINED");
                continue;
            }
            var time;
            if(cashedDataArr[company].routes[i].points[j].real_service_time != undefined) {
                time = cashedDataArr[company].routes[i].points[j].real_service_time
            } else {
                time = cashedDataArr[company].routes[i].points[j].stopState.time
            }

            var delta = (time/(parseInt(cashedDataArr[company].routes[i].points[j].TASK_TIME))).toFixed(2);
            //console.log (time, cashedDataArr[company].routes[i].points[j].TASK_TIME, "DELTA,", delta);

            if (delta < 0.7) {
                cashedDataArr[company].routes[i].points[j].service_quality = " - " + parseInt((1-delta)*100).toFixed(0)+ "%";
                continue;
            }

            if (delta > 1.3) {
                cashedDataArr[company].routes[i].points[j].service_quality = "+ " + parseInt((delta-1)*100).toFixed(0) + "%";
                continue;
            }

            cashedDataArr[company].routes[i].points[j].service_quality = "Норма";

        }
    }
    } catch (e) {
        log.error( "Ошибка "+ e + e.stack);
    }
}


function checkeConcatTrack(company, id, data){
    try {
    if (company == undefined || id == undefined ){
        log.info("Ошибка в checkeConcatTrack. Данные неопределены");
        return;
    }
    //log.info("Для проверки переданы данные", company, id, cashedDataArr[company].routes.length);
    var route;
     for(var i=0; i< cashedDataArr[company].routes.length; i++){

         if (cashedDataArr[company].routes[i].uniqueID == id) {
             route = cashedDataArr[company].routes[i];
             break;
         }

     }

    if (route == undefined) {
        //log.info("Маршрут для проверки не найден");
        return;
    }

    log.info("В маршруте сейчас ", route.real_track.length, " стэйтов");
    log.info ("Последний стейт", route.real_track[route.real_track.length-1]);

    if (data == undefined) return;
    var newTrack;
    //log.info(data, "data for concat");
    //log.info("Количество полученных наборов", data.length  );
    for (i=0; i<data.length; i++){

       if (data[i].gid == route.transport.gid){
           newTrack=data[i].data;
           log.info("Новые стейты найдены. Их имеется", newTrack.length);
           break;
       }
   }

    for (i=0; i<newTrack.length; i++){
        log.info("Получен стейт", newTrack[i]);
    }
    } catch (e) {
        log.error( "Ошибка "+ e + e.stack);
    }
}


function checkSync(company, login, blockedArr) {
    try {
    var result=[];
    if (!company || !login || !blockedArr || blockedArr.length == 0) {
        log.info("Неопределенные данные checkSync");
        return result;
    }

    for(var i=0; i<blockedArr.length; i++){
        for (var j=0; j<blockedRoutes.length; j++){
            if (blockedRoutes[j].id == blockedArr[i] && blockedRoutes[j].login == login){
                blockedArr.splice(i,1);
                i--;
            }
        }
    }
    result = blockedArr;
    log.info("Результат проверки", result);
    if (result.length == 0) return result;
    // Если так случилось, что существует роут на клиенте, который незаблокирован за пользователем на сервере
    // Блокируем этот маршрут
    for(i=0; i<result.length; i++){
        var blocked =false;
        for (j=0; j<blockedRoutes.length; j++){
            if (blockedRoutes[j].id == result[i]) {
                log.info("Этот маршрут заблокирован другим пользователем");
                blocked =true;
            }
        }
        if (!blocked) {
            if (cashedDataArr[company].line_routes != undefined) {
                for (var l=0; l<cashedDataArr[company].line_routes.length; l++){
                    if(result[i] == cashedDataArr[company].line_routes[l].uniqueID ) {
                        if (cashedDataArr[company].blocked_routes == undefined) cashedDataArr[company].blocked_routes =[];
                        cashedDataArr[company].blocked_routes.push(cashedDataArr[company].line_routes[l])
                        cashedDataArr[company].line_routes.splice(l,1);
                        blockedRoutes.push({id: result[i], company:company, login:login, time:parseInt(Date.now()/1000)})
                        changePriority(result[i], company, login);
                        break;
                    }
                }
            }

            if (cashedDataArr[company].routes != undefined) {
                for ( l=0; l<cashedDataArr[company].routes.length; l++){
                    if(result[i] == cashedDataArr[company].routes[l].uniqueID ) {
                        if (cashedDataArr[company].blocked_routes == undefined) cashedDataArr[company].blocked_routes =[];
                        cashedDataArr[company].blocked_routes.push(cashedDataArr[company].routes[l])
                        cashedDataArr[company].routes.splice(l,1);
                        blockedRoutes.push({id: result[i], company:company, login:login, time:parseInt(Date.now()/1000)})
                        changePriority(result[i], company, login);
                        break;
                    }
                }
            }

            result.splice(i,1);
        }
    }

    return result;
    } catch (e) {
        log.error( "Ошибка "+ e + e.stack);
    }
}


function connectPointsPushesStops(company) {
    console.log("Start connectPointsPushesStops ");

    if (!company) return;
    for (var i=0; i<cashedDataArr[company].routes.length; i++){
       var  route = cashedDataArr[company].routes[i];
        if (route.real_track == undefined || route.real_track.length == 0) continue;
        for (var j=0; j<route.points.length; j++){
            var point = route.points[j];
            if (!point.havePush) continue;
            var push = point.mobile_push;
            if(push.lat == null) continue;
            var tmpDistance = getDistanceFromLatLonInM(parseFloat(point.LAT), parseFloat(point.LON), push.lat, push.lon);

            if (tmpDistance > cashedDataArr[company].settings.mobileRadius) continue;


            //этап 1 найти стоп подходящий по времени
            for (var k=0; k<route.real_track.length; k++){
                if (push.gps_time_ts > route.real_track[k].t1 && route.real_track[k].state == "ARRIVAL" && push.gps_time_ts < route.real_track[k].t2 + 180) {

                    var tmpDistance1 = getDistanceFromLatLonInM(parseFloat(point.LAT), parseFloat(point.LON), route.real_track[k].lat, route.real_track[k].lon);
                    if (tmpDistance1 > cashedDataArr[company].settings.stopRadius) continue;


                    var tmpArrival = route.real_track[k];
                    var tmpTime = Math.abs(point.arrival_time_ts - tmpArrival.t1);
                    var uniqueId = "" + tmpArrival.lat + tmpArrival.lon + tmpArrival.t1;
                    var incorrect_stop = false;
                    if(point.incorrect_stop != undefined ){
                        for (var si = 0; si < point.incorrect_stop.length; si++){

                            if (point.incorrect_stop[si] == uniqueId) {
                                incorrect_stop = true;
                                break;
                            }
                        }
                    }

                    if (incorrect_stop){
                        log.info ("Ура, найден некорректный стоп!!!!!!");
                        continue;
                    }

                    point.distanceToStop = tmpDistance;
                    point.timeToStop = tmpTime;
                    point.haveStop = true;
                    point.havePushStop = true;
                    point.stopState = tmpArrival;
                    route.lastPointIndx = k > route.lastPointIndx ? k : route.lastPointIndx;
                    point.stop_arrival_time = tmpArrival.t1;
                    point.real_arrival_time = tmpArrival.t1;
                    point.autofill_service_time = point.stopState.time;

                    if(tmpArrival.servicePoints == undefined) { tmpArrival.servicePoints=[]};

                    // проверка, существует ли уже этот стоп
                    var ip=0;
                    var sPointExist=false;
                    while(ip<tmpArrival.servicePoints.length){
                        if(tmpArrival.servicePoints[ip]==point.NUMBER){
                            sPointExist=true;
                            break;
                        }
                        ip++;
                    }
                    if(!sPointExist){
                        tmpArrival.servicePoints.push(point.NUMBER);}


                }
            }

        }
    }
    console.log("Start connectPointsPushesStops ");
}

function concat1CAndMonitoring (company) {
    try {
    if (!company || cashedDataArr[company].closedRoutesFrom1C == undefined) {
        log.info('В 1С нет сохраненных маршрутов');
        continueConcat(company);
        return;
    }



    log.info("Закрытые в 1С маршруты загружены", company, cashedDataArr[company].closedRoutesFrom1C.routes.length);
        var t=0;
        var tt=0;
    // Проверка соответсвия gidov
        for (var i=0; i<cashedDataArr[company].routes.length; i++){
              for(var j=0; j<cashedDataArr[company].closedRoutesFrom1C.routes.length; j++ ) {
                  if (cashedDataArr[company].routes[i].TRANSPORT == cashedDataArr[company].closedRoutesFrom1C.routes[j].transportID &&
                      cashedDataArr[company].routes[i].NUMBER == "" + cashedDataArr[company].closedRoutesFrom1C.routes[j].routeID){
                        //log.info("Совпадение открытого и закрытого маршрута найдены", cashedDataArr[company].routes[i].transport.gid, cashedDataArr[company].closedRoutesFrom1C.routes[j].gid);
                        if (cashedDataArr[company].routes[i].transport.gid != "0" && cashedDataArr[company].routes[i].transport.gid != undefined && ""+cashedDataArr[company].routes[i].transport.gid != "" + cashedDataArr[company].closedRoutesFrom1C.routes[j].gid){
                            cashedDataArr[company].routes[i].transport.gid = cashedDataArr[company].closedRoutesFrom1C.routes[j].gid;
                            cashedDataArr[company].routes[i].real_track = [];
                            t++;
                            var from = strToTstamp(cashedDataArr[company].routesOfDate + " 00:00:01");
                            var to = strToTstamp(cashedDataArr[company].routesOfDate + " 23:59:59");
                            tracksManager.getTrack(cashedDataArr[company].routes[i].TRANSPORT.gid, from, to, "", "", "", "", "", "", function (data, gid){
                                tt++;
                                log.info ("inside t == tt", t, " ", tt);
                                for (var l=0; l< cashedDataArr[company].routes.length; l++ ){
                                    if (cashedDataArr[company].routes[l].TRANSPORT.gid == gid) {
                                        cashedDataArr[company].routes[l].real_track = data;
                                    }
                                }


                            })
                        }

                  }
              }


        }
        log.info ("outside t == tt", t, " ", tt);
        if (t==0 || t == tt) continueConcat(company);
    } catch (e) {
        log.error( "Ошибка "+ e + e.stack);
    }
}

function autosaveData(){
    log.info("Start data saving");
    var data = JSON.stringify(cashedDataArr);
    var mes ='complete';

    try {
        fs.writeFile('./logs' + '/' +'savedData.txt', data, function(err){
            if (err) log.info("Не могу записать. Начинай ковыряться в коде", err);
            mes+= err;
        });


    } catch (e) {
        log.error( "Ошибка "+ e + e.stack);
    }
}

function  changeNameOfRoute(company, uniqueID){
    //try {
    log.info("changeNameOfRoute recieve", company, uniqueID);
    if (company == undefined || uniqueID == undefined) return;
    var res = String.fromCharCode(8660);
    for (var i=0; i<cashedDataArr[company].allRoutes.length; i++){
        log.info("Lets check", cashedDataArr[company].allRoutes[i].uniqueID, uniqueID);
        if (cashedDataArr[company].allRoutes[i].uniqueID == uniqueID && cashedDataArr[company].allRoutes[i].nameCar.indexOf(res) == -1) {
            log.info("Find closed route And i will change it name");


            cashedDataArr[company].allRoutes[i].nameCar = res + " "  + cashedDataArr[company].allRoutes[i].nameCar;
            cashedDataArr[company].allRoutes[i].nameDriver =  res + " " + cashedDataArr[company].allRoutes[i].nameDriver;
            log.info("New name", cashedDataArr[company].allRoutes[i].nameCar);
            log.info("New name", cashedDataArr[company].allRoutes[i].nameDriver);
        }
    }


    //} catch (e) {
    //    log.error( "Ошибка "+ e + e.stack);
    //}
}


function repearTrackTry(route) {


    console.log("!!!!!!!!!!!!!!!!!! $%^#$%^$^#$ NEED REPAIR #$%#%#!!!!!!!!!!!!!!");
    var result=[];

    //tracksManager.getTrack(
    //    route.transport.gid,
    //    route.real_track[0].t1,
    //    parseInt(Date.now()/1000), "", "", "", "", "", "", function (newData, newGid) {
    //        newData.length=newData.length-1;
    //
    //        tracksManager.getTrackByStates(newData, newGid, false, function(data, sNewGid){
    //
    //            ///log.info ("NEWNEWNEW DATA", t, " ", tt);
    //            result.push({gid:sNewGid, state: data});
    //
    //            console.log( "!!!!!UPDATE TRACK REPAIRE", result);
    //
    //        });
    //        //log.info(newGid, "NEW DATA", newData);
    //
    //    })


}


function addPushesToUpdateTrack(company, result){
    if (company == undefined || result == undefined || result.length == 0) return;
    for (var i=0; i<result.length; i++){
        for (var j=0; j<cashedDataArr[company].blocked_routes.length; j++){
            if (result[i].gid == cashedDataArr[company].blocked_routes[j].transport.gid) {
                result[i].uniqueID = cashedDataArr[company].blocked_routes[j].uniqueID;
                result[i].points_tasks = [];
                for (var l=0; l<cashedDataArr[company].blocked_routes[j].points.length; l++){
                    result[i].points_tasks.push(cashedDataArr[company].blocked_routes[j].points[l].TASK_NUMBER);
                }
            }
        }
    }

    for (var k=0; k<result.length; k++) {
        result[k].pushes=[];
        for (i=0; i<result[k].points_tasks.length; i++){
            for (j=0; j<cashedDataArr[company].allPushes.length; j++){
                if (result[k].points_tasks[i] == cashedDataArr[company].allPushes[j].number){

                    if (cashedDataArr[company].allPushes[j].time == undefined) checkPushesTimeGMTZone(cashedDataArr[company].allPushes[j], company, cashedDataArr[company].COMPANY_NAME);
                    result[k].pushes.push(cashedDataArr[company].allPushes[j]);

                }
            }
        }
    }

    return result;
}

function loadCoords(company) {
    try {
    if (!company) return;

    var states = [],
        gid,
        route = {};
    if (cashedDataArr[company].line_routes != undefined) {

        for (var i = 0; i < cashedDataArr[company].line_routes.length; i++) {
            route = cashedDataArr[company].line_routes[i];
            states = route.real_track;
            gid = route.transport.gid;
            //log.info("Отправляем запрос по гиду", gid);
            if (gid !=undefined && states != undefined && states.length>0) tracksManager.getTrackByStatesForNode(states, gid, route, function (data, route) {
                //log.info(data, "MTM 5198");
                route.real_track=data;
                //log.info("Закончена подгрузка координат", route.transport.gid);
            })
        }

    }
    } catch (e) {
        log.error( "Ошибка "+ e + e.stack);
    }
}


function startCalculateCompany(company) {
    try {
    startTime = parseInt(Date.now()/1000);
    log.info("Все данные получены, пересчитываем компанию", company);
    if (cashedDataArr[company].currentDay == false) return;
    checkCorrectCalculating(company);
    cashedDataArr[company].recalc_finishing = false;
    selectRoutes(company);
    connectPointsAndPushes(company);
    connectPointsPushesStops(company);
    connectStopsAndPoints(company);
    checkServiceTime(company);
    predicateTime(company);
    findStatusesAndWindows(company);
    calculateProblemIndex(company);
    calculateStatistic (company);
    createProblems(company);
    //checkRealTrackData(company); //todo убрать, после того как починят треккер
    loadCoords(company);
    lookForNewIten(company);
    //checkUniqueID (company);
    cashedDataArr[company].recalc_finishing = true;
    printData(company); //todo статистическая функция, можно убивать
    autosaveData();
    if (middleTime) log.info("От запрсов до конца рассчета прошло", parseInt(Date.now()/1000) - middleTime, "А сам рассчет длился", parseInt(Date.now()/1000) - startTime );
    } catch (e) {
        log.error( "Ошибка "+ e + e.stack);
    }
}



module.exports = router;

//for (i=0; i<rootScope.data.routes.length; i++){
//    if (rootScope.data.routes[i].closed){
//        console.log("Найден закрытый маршрут");
//        //var res = String.fromCharCode(8660);
//        //var res1 = String.fromCharCode(257);
//        rootScope.data.allRoutes[j].nameCar = "Закрыт"  + rootScope.data.allRoutes[j].nameCar;
//        rootScope.data.allRoutes[j].nameDriver =  "Закрыт" + res1 + rootScope.data.allRoutes[j].nameDriver;
//
//    }
//
//}