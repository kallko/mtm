module.exports = SoapManager;
var soap = require('soap'),
    fs = require('fs'),
    config = require('../config'),
    xmlConstructor = require('./xmlConstructor'),
    _xml = new xmlConstructor(),
    log = new (require('../logging'))('./logs'),
    parseXML = require('xml2js').parseString,
    loadFromCache = config.cashing.soap,
    testCopy = true, // флаг обращения к копии базы

    tracks = require('../tracks'),
    tracksManager = new tracks(
        config.aggregator.url,
        config.router.url,
        config.aggregator.login,
        config.aggregator.password);




// класс для работы с соапом
function SoapManager(login) {
    testCopy ? this.url = "@sngtrans.com.ua/copy/ws/exchange/?wsdl" : this.url = "@sngtrans.com.ua/client/ws/exchange/?wsdl";
    testCopy ? this.urlPda = "@sngtrans.com.ua/copy/ws/pda/?wsdl" : this.urlPda = "@sngtrans.com.ua/client/ws/pda/?wsdl";
    testCopy ? this.urlUI = "@sngtrans.com.ua/copy/ws/UI/?wsdl" :   this.urlUI = "@sngtrans.com.ua/client/ws/UI/?wsdl";
    this.login = login;
    this.admin_login = config.soap.login;
    this.password = config.soap.password;
    //console.log("config 32", this);
}




// генерация строки запроса для обращения к соапу
SoapManager.prototype.getFullUrl = function () {
    return 'https://' + this.admin_login + ':' + this.password + this.url;
};

// получить все необходимые для интерфейса данные на конкретную дату
SoapManager.prototype.getAllDailyData = function (callback, date) {
 //   if (!date) date = new Date();
    if (!loadFromCache) {
        console.log("Wait for Data from SOAP");
        this.getDailyPlan(callback, date);
    } else {
        console.log("Wait for Data from Cahse");
        this.loadFromCachedJson(callback);
    }
};

// загрузка данных по дню из файла (используется для отладки)
SoapManager.prototype.loadFromCachedJson = function (callback) {
    fs.readFile('./logs/final_data.js', 'utf8', function (err, data) {
        if (err) {
            return console.log(err);
        }

        console.log('The data loaded from the cache.');

        var jsonData = JSON.parse(data);
        //console.log('jsonData', jsonData);
        //jsonData.server_time = parseInt(Date.now() / 1000); // - 3600 * 3; // Date.now();
        //console.log(jsonData.server_time);
        //
        //jsonData.tasks_loaded = true;
        //jsonData.sended = false;
        //for (var i = 0; i < jsonData.routes.length; i++) {
        //    tracksManager.getRouterData(jsonData, i, checkBeforeSend, callback);
        //}
        //tracksManager.getRealTracks(jsonData, checkBeforeSend, callback);

        callback(jsonData);
    });
};

// загрузка демо данных
SoapManager.prototype.loadDemoData = function (callback) {
    fs.readFile('./data/demoDay.js', 'utf8', function (err, data) {
        if (err) {
            return console.log(err);
        }

        callback(JSON.parse(data));
    });
};

// проверить наличие всех необходимых данных перед отправкой json на клиент
function checkBeforeSend(_data, callback) {

    //console.log("START CHECK BEFORE SEND");

    //console.log( " Check before send started", _data.iLength);
    if(_data.iLength != 0){
        //console.log("Рано еще, подпустим поближе! 97");
        return;
    }

    var data;
    for (var k = 0; k < _data.length; k++) {
        data = _data[k];

        if (data.sensors == null) {
            //console.log("Рано еще, подпустим поближе! 106");
            return;
        }

        for (var i = 0; i < data.routes.length; i++) {
            if (!data.routes[i].time_matrix_loaded
                || !data.routes[i].plan_geometry_loaded) {
                //console.log("Рано еще, подпустим поближе! 113");
                return;
            }
        }

        for (i = 0; i < data.sensors.length; i++) {
            if (data.sensors[i].loading && !data.sensors[i].stops_loaded) {

                return;
            }
        }
    }

    for (k = 0; k < _data.length; k++) {
        data = _data[k];

        for (i = 0; i < data.routes.length; i++) {
            delete data.routes[i].time_matrix_loaded;
            delete data.routes[i].plan_geometry_loaded;
        }

        for (i = 0; i < data.sensors.length; i++) {
            delete data.sensors[i].real_track_loaded;
            delete data.sensors[i].loading;
        }
    }

    for (i = 0; i < data.length; i++) {
        for (j = 0; j < data[i].routes.length; j++) {
            data[i].routes[j].itineraryID = data[i].ID;
        }
    }


    data = _data;
    for (i = 0; i < data.length; i++) {
        for (j = 0; j < data[i].routes.length; j++) {
            data[i].routes[j].itineraryID = data[i].ID;
        }
    }

    var allData = JSON.parse(JSON.stringify(data[0])),
        gIndex = 0;
    if(data.closedRoutesFrom1C && !allData.closedRoutesFrom1C){
        //console.log(data.closedRoutesFrom1C, "SOAP 148");
        try{
            allData.closedRoutesFrom1C = JSON.parse(data.closedRoutesFrom1C);
        }catch(e){
            console.log(e, "SOAP 152");
        }
    }



    if (allData.idArr == undefined) {allData.idArr = []}
    //allData.idArr = [];

    console.log("!!!!Создаем массив решений!!!!!", data[0].ID, data[0].branch);

    allData.idArr.push({id: data[0].ID, login: "", date: Date.now(), branch: data[0].branch});



    // в случае если дошло до сюда, значит необходимые данные собраны
    // склейка данных из нескольких решений (если их несколько) в одно перед отправкой клиенту
    allData.loadedBranches = allData.loadedBranches || [];

    console.log("А теперь пора!");

    for (i = 1; i < data.length; i++) {
        allData.DISTANCE = parseInt(allData.DISTANCE) + parseInt(data[i].DISTANCE);
        allData.NUMBER_OF_ORPHANS = parseInt(allData.NUMBER_OF_ORPHANS) + parseInt(data[i].NUMBER_OF_ORPHANS);
        allData.NUMBER_OF_TASKS = parseInt(allData.NUMBER_OF_TASKS) + parseInt(data[i].NUMBER_OF_TASKS);
        allData.TIME = parseInt(allData.TIME) + parseInt(data[i].TIME);
        allData.VALUE = parseInt(allData.VALUE) + parseInt(data[i].VALUE);
        allData.routes = allData.routes.concat(data[i].routes);

        console.log("data.firstLogin", data[i].firstLogin);
        console.log("data.branch", data[i].branch);
        allData.idArr.push({id: data[i].ID, login: "", date: Date.now(), branch: data[i].branch || data[0].branch});
        console.log("#data.loadedBranches", data.loadedBranches);

        allData.waypoints = allData.waypoints.concat(data[i].waypoints);

    }

    // в случае, если трек есть в одном решении и его нет в сенсорах другого решения,
    // данные записываются в сенсоры общего склееного решения
    for (j = 1; j < data.length; j++) {
        for (k = 0; k < data[j].sensors.length; k++) {
            if (data[j].sensors[k].real_track != undefined) {
                allData.sensors[k].real_track = data[j].sensors[k].real_track;
            }
        }
    }

    // сохранение изначального времени прибытия и назначение точкам глобального индекса (для пересчета на математике)
    for (i = 0; i < allData.routes.length; i++) {
        for (var j = 0; j < allData.routes[i].points.length; j++) {
            allData.routes[i].points[j].notes = [];
            allData.routes[i].points[j].driverNotes=[];
            allData.routes[i].points[j].base_arrival = allData.routes[i].points[j].ARRIVAL_TIME;
            if (allData.routes[i].points[j].waypoint == undefined) continue;

            allData.routes[i].points[j].waypoint.gIndex = gIndex;
            gIndex++;
        }
    }

    //console.log('DONE!', allData.reasons, "SOAP175");
    log.toFLog('final_data.js', allData);


    callback(allData);
}

// получить план на день
SoapManager.prototype.getDailyPlan = function (callback, date) {
    console.log("Request Date =", date);
    var me = this,
        itIsToday = typeof date === 'undefined';

    // перемотать на вечер запрашиваемого дня, если выбран не текущий день
    if (date) {
        date = parseInt(date);
        var loadOldDay = true;
        console.log(" СОАП готов к загрузке прошлого дня");
    }

     date = date ? date : Date.now();


    console.log("Date<<", date);
    //fixme date
    //date = 1489579200000;
    console.log('Date >>>', new Date(date));

    // soap.createClient(me.getFullUrl(), function (err, client) {
    //     if (err) throw err;
    //
    //     // авторизация с правами соап-администратора
    //     client.setSecurity(new soap.BasicAuthSecurity(me.admin_login, me.password));
    //     // запрос в соап от имени авторизированного пользователя, но с правами администратора
    //     // получения списка id решений на конкретную дату
    //
    //     if (loadOldDay) {
    //         setTimeout(function(){
    //             client.runAsUser({'input_data': _xml.getOldDay("15.06.2016"), 'user': me.login}, function (err, result) {
    //                 if(err) throw err;
    //                 parseXML(result.return, function (err, res) {
    //                     if(err) throw err;
    //                     console.log(JSON.porse(res.MESSAGE.JSONDATA[0]));
    //                 });
    //             });
    //         }, 10000);
    //     }
    // });




    // инициализация соап клиента
    soap.createClient(me.getFullUrl(), function (err, client) {
        if (err) throw err;

        // авторизация с правами соап-администратора
        client.setSecurity(new soap.BasicAuthSecurity(me.admin_login, me.password));
        console.log(me.login);
        console.log(_xml.dailyPlanXML(date));

        // запрос в соап от имени авторизированного пользователя, но с правами администратора
        // получения списка id решений на конкретную дату

        // if(loadOldDay){
        //     console.log(_xml.getOldDay("04.06.2016"));
        //     client.runAsUser({'input_data': _xml.getOldDay("04.06.2016"), 'user': me.login}, function (err, result) {
        //         console.log(result);
        //     });
        // }
        var data = [];
        if (loadOldDay && !itIsToday) {
            var dateObj = new Date( date),
            dateYear = dateObj.getFullYear(),
            dateMonth = dateObj.getMonth() + 1,
            dateMonth = dateMonth < 10 ? '0'+dateMonth : dateMonth,
            dateDay = dateObj.getDate() < 10 ? '0' + dateObj.getDate() : dateObj.getDate();
            console.log(dateDay+'.'+dateMonth+'.'+dateYear);
            setTimeout(function(){
                console.log("Запрос getOldDay");

                    client.runAsUser({'input_data': _xml.getOldDay(dateDay+'.'+ dateMonth+'.'+dateYear), 'user': me.login}, function (err, result) {
                        try{
                            if(err) throw err;
                            parseXML(result.return, function (err, res) {
                                try{
                                    if(err) throw err;
                                    data.closedRoutesFrom1C = res.MESSAGE.JSONDATA[0];
                                    console.log(data.closedRoutesFrom1C.length, "Soap 290");
                                    //log.toFLog('oldDay.txt', data.closedRoutesFrom1C);
                                }catch(e){
                                    console.log(e, "SOAP 285");
                                }
                            });
                        }catch(e){
                            console.log(e, "SOAP 289");
                        }
                    });

            }, 5000);
        }


            //console.log("Запрос dailyPlanXML", _xml.dailyPlanXML(date));
            client.runAsUser({'input_data': _xml.dailyPlanXML(date), 'user': me.login}, function (err, result) {
                if (!err) {
                    console.log('DONE getDailyPlan');
                    console.log(result.return, "SOAP 299");

                    // парсинг ответа соапа из xml в json
                    parseXML(result.return, function (err, res) {
                        if (res.MESSAGE.PLANS == null) {
                            console.log('NO PLANS!');
                            callback({status: 'no plan'});
                            return;
                        }

                        var itineraries = res.MESSAGE.PLANS[0].ITINERARY;



                        data.iLength = itineraries.length;
                        data.branches = [];

                        console.log("Решения на сейчас", itineraries[0].$);
                        // console.log("Решения на сейчас", itineraries[1].$);
                        // console.log("Решения на сейчас", itineraries[2].$);
                        //console.log("BRANCHES FOR TODAY", branches);
                        //for (var i = 0; )


                        //console.log("Looking for keys", res.MESSAGE.PLANS[0].CLIENT_ID);
                        // если грузить нужно не только новые решения (т.е. запросов будет в два раза больше,
                        // один на новый формат, один на старый) счетчик оставшихся запросов умножаем на два
                        if (!config.loadOnlyItineraryNew) data.iLength *= 2;

                        // получение развернутого решения по списку полученных ранее id решений
                        for (i = 0; i < itineraries.length; i++) {
                            (function (ii) {
                                setTimeout(function () {
                                    me.getItinerary(client, itineraries[ii].$.ID, itineraries[ii].$.VERSION, itineraries[ii].$.BRANCH_ID, itineraries[ii].$.BRANCH_NAME, itIsToday, data, date, callback);
                                }, ii * 5000);
                            })(i);
                        }

                    });
                } else {
                    console.log('getDailyPlan ERROR');
                    console.log(err.body, "SOAP 335");
                }
            });




    });
};

// попытки получить развернутые решения нового и, если  config.loadOnlyItineraryNew = false, старого типа
// в итоге получено будет только одно решение, т.к. двух решений разных типов по одному id не бывает
SoapManager.prototype.getItinerary = function (client, id, version, branchId, branchName, itIsToday, data, date, callback) {
    var me = this;
    console.log ("Load ITINERARY BBBRANCH ", branchId,  branchName);
    if (!config.loadOnlyItineraryNew && (this.login != 'IDS.a.kravchenko')) {
        setTimeout(function () {
        client.runAsUser({'input_data': _xml.itineraryXML(id, version), 'user': me.login}, function (err, result) {
            itineraryCallback(err, result, me, client, itIsToday, data, date, branchId, branchName, callback);
        })}, 15);
    }

    console.log("Очень очень Очень  Важные данные", branchId, branchName);
    client.runAsUser({'input_data': _xml.itineraryXML(id, version, true), 'user': me.login}, function (err, result) {
        itineraryCallback(err, result, me, client, itIsToday, data, date, branchId, branchName, callback);
    });
};

// колбек срабатывающий при получении развернутого решения
function itineraryCallback(err, result, me, client, itIsToday, data, date, branchId, branchName, callback) {
    if (!err) {
        console.log(branchName, "BBBBRANCH soap.js:393");
        parseXML(result.return, function (err, res) {
            data.iLength--;

            if (res.MESSAGE.ITINERARIES == null ||
                res.MESSAGE.ITINERARIES[0].ITINERARY == null ||
                res.MESSAGE.ITINERARIES[0].ITINERARY[0].$.APPROVED !== 'true') {
                // если по указанному id не было полученно решения, или оно не было утвержденно, проверяется количество
                // оставшихся необходмыз запросов и если всё уже запрошенно, а решений всё нет и не было,
                // значит планов нет вообще
                if (data.iLength == 0 && !data.havePlan) {
                    console.log('NO PLANS!!!!!!!!!');
                    callback({status: 'no plan'});
                }
                return;
            }

            data.havePlan = true;
            console.log('APPROVED = ' + res.MESSAGE.ITINERARIES[0].ITINERARY[0].$.APPROVED);



            var nIndx = data.push(res.MESSAGE.ITINERARIES[0].ITINERARY[0].$);


            nIndx--;
            //data[nIndx].sended = false;
            data[nIndx].date = new Date(date);
            data[nIndx].server_time = parseInt(date / 1000);
            data[nIndx].branch = {
                id: branchId || 007,
                name: branchName || "tempBranch"
            };
            console.log("#data[nIndx].branch", data[nIndx].branch);
            //console.log("#this.login", this.login);
            console.log("#branchId", branchId);
            data.loadedBranches = data.loadedBranches || [];
            //data.loadedBranches.push(branchId);

            //console.log(res.MESSAGE.ITINERARIES[0].ITINERARY[0].ROUTES[0].ROUTE, "Запросы СОАП 398");


            //fixme
            //return;
            me.prepareItinerary(res.MESSAGE.ITINERARIES[0].ITINERARY[0].ROUTES[0].ROUTE, data, itIsToday, nIndx, callback, res.MESSAGE.ITINERARIES[0].ITINERARY[0].$.SHIFT_NAME);
            me.getAdditionalData(client, data, itIsToday, nIndx, callback, date, branchId);

        });
    } else {
        console.log('getItinerary ERROR');
        console.log(err.body, "SOAP 396");
    }
}

// подготовка решений для дальнейшего работы с ним
SoapManager.prototype.prepareItinerary = function (routes, data, itIsToday, nIndx, callback, shift) {



    var tmpRoute;

    data[nIndx].routes = [];
    //console.log("nIndex", nIndx);
    for (var i = 0; i < routes.length; i++) {
        tmpRoute = {};
        tmpRoute = routes[i].$;
        tmpRoute.SHIFT_NAME = shift;
        // создания массива точек доставки
        tmpRoute.points = [];

        if (routes[i].SECTION == undefined) continue;

        for (var j = 0; j < routes[i].SECTION.length; j++) {
            if (j == 0 && routes[i].SECTION[j].$.START_WAYPOINT == "") {
                routes[i].SECTION[j].$.origStartWp = routes[i].SECTION[j].$.START_WAYPOINT;
                routes[i].SECTION[j].$.START_WAYPOINT = routes[i].SECTION[j].$.END_WAYPOINT;
            }

            // наполнение массива точек

            //TODO ловля ошибочных заданий, если настроится 1сб можно убивать
            if((routes[i].SECTION[j].$).START_TIME == '') {
                console.log("BIG MISTAKE!!!!!!!", (routes[i].SECTION[j].$));

            }


            tmpRoute.points.push(routes[i].SECTION[j].$);
        }
        tmpRoute.branch = data[nIndx].branch;
        data[nIndx].routes.push(tmpRoute);
    }
};

// получение дополнительных данных по полученному решению
SoapManager.prototype.getAdditionalData = function (client, data, itIsToday, nIndx, callback, date, branchId) {
    var me = this;
    log.l("getAdditionalData");
    log.l("=== a_data; data.ID = " + data[nIndx].ID + " === \n");
    log.l(_xml.additionalDataXML(data[nIndx].ID));
    console.log("Запрс на дополнительные данные", _xml.additionalDataXML(data[nIndx].ID));
    client.runAsUser({'input_data': _xml.additionalDataXML(data[nIndx].ID), 'user': me.login}, function (err, result) {
        if (!err) {


            parseXML(result.return, function (err, res) {
                var transports = res.MESSAGE.TRANSPORTS[0].TRANSPORT,   // список всего транспорта по данному клиенту
                    drivers = res.MESSAGE.DRIVERS[0].DRIVER,            // список всех водителей по данному клиенту
                    waypoints = res.MESSAGE.WAYPOINTS[0].WAYPOINT,      // получеине расширенной информации о точках по данному дню
                    sensors = res.MESSAGE.SENSORS[0].SENSOR,            // список всех сенсоров (устройства передающие трек)
                    reasons = res.MESSAGE.REASONS_FAILURE[0].REASON_FAILURE,// список причин отмены заказа
                    notes = res.MESSAGE.DELIVERY_NOTES_LIST[0].DELIVERY_NOTE;      //список замечаний
                   // shift_name = res.MESSAGE.SHIFT_NAME;
                //console.log("полученные сенсоры",res.MESSAGE);

                //fixme чтобы не грузить сервер
                //return;
                data[nIndx].branch = branchId;
                console.log("&data[nIndx].branch", data[nIndx].branch);

                if (waypoints == undefined) return;
                //console.log('drivers', drivers.length);
                log.l('waypoints.length = ' + waypoints.length);
                //console.log(waypoints, "soap.js:344");

                data[nIndx].transports = [];
                if (transports === undefined) {
                    console.log('transports === undefined');
                } else {
                    for (var i = 0; i < transports.length; i++) {
                        data[nIndx].transports.push(transports[i].$);
                    }
                }

                data[nIndx].drivers = [];
                if (drivers === undefined) {
                    console.log('drivers === undefined');
                } else {
                    for (i = 0; i < drivers.length; i++) {
                        data[nIndx].drivers.push(drivers[i].$);
                    }
                }

                data[nIndx].waypoints = [];
                for (i = 0; i < waypoints.length; i++) {
                    data[nIndx].waypoints.push(waypoints[i].$);
                }

                data[nIndx].notes = [];
                for (i = 0; i < notes.length; i++) {
                    data[nIndx].notes.push(notes[i].$);
                }

                data[nIndx].reasons = [];
                if (reasons == undefined){
                    console.log("No reasons");
                    callback({status: 'no reasons'});
                } else {
                    for(i = 0; i<reasons.length; i++){
                        data[nIndx].reasons.push(reasons[i].$);
                    }
                }


                for (var j = 0; j < data[nIndx].routes.length; j++) {
                    for (i = 0; i < data[nIndx].routes[j].points.length; i++) {
                        var tPoint = data[nIndx].routes[j].points[i];

                        // запись в lat lon точки координат из waypoint, указанного в точке как конечный
                        for (var k = 0; k < data[nIndx].waypoints.length; k++) {
                            if (tPoint.END_WAYPOINT == data[nIndx].waypoints[k].ID) {
                                tPoint.waypoint = data[nIndx].waypoints[k];
                                tPoint.LAT = tPoint.waypoint.LAT;
                                tPoint.LON = tPoint.waypoint.LON;
                                break;
                            }
                        }

                        // сохранение стартовых координат из начального waypoint
                        for (var k = 0; k < data[nIndx].waypoints.length; k++) {
                            if (tPoint.START_WAYPOINT == data[nIndx].waypoints[k].ID) {
                                tPoint.START_LAT = data[nIndx].waypoints[k].LAT;
                                tPoint.START_LON = data[nIndx].waypoints[k].LON;
                                break;
                            }
                        }
                    }
                }

                data[nIndx].sensors = [];
                if (sensors == undefined) {
                    console.log('NO SENSORS!');
                    //callback({status: 'no sensors'});
                }



                for (i = 0; sensors && i < sensors.length; i++) {
                    data[nIndx].sensors.push(sensors[i].$);
                }

                // получение данных с роутера (плановые треки, матрицы времен и расстояний)
                for (i = 0; i < data[nIndx].routes.length; i++) {
                    tracksManager.getRouterData(data, i, nIndx, checkBeforeSend, callback);
                }

                // получение реальных треков и стопов
                tracksManager.getTracksAndStops(data, nIndx, checkBeforeSend, callback, date, itIsToday);

                // проверка данных на готовность для отправки клиенту
                //console.log(data.closedRoutesFrom1C, "data SOAP 429");
                checkBeforeSend(data, callback);
            });

        } else {
            console.log("ERROR SOAP 543", err);
            log.l(err.body);
        }
    });
};

// получение списка причин отмен
//SoapManager.prototype.getReasonList = function (callback) {
//    console.log('getReasonList');
//    var config = {
//        login: 'ids.dsp',
//        pass: 'dspids'
//    };
//    // запрос идет не на обычный адрес соапа, а на его версию для кпк
//    var url = 'https://' + config.login + ':' + config.pass + this.urlPda;
//    soap.createClient(url, function (err, client) {
//        if (err) throw err;
//
//        client.setSecurity(new soap.BasicAuthSecurity(config.login, config.pass));
//        console.log(client.describe());
//        client.get_reason_list(function (err, result) {
//            if (!err) {
//                callback(result.return.reason);
//            } else {
//                console.log('err', err.body);
//                callback({error: 'SOAP error'});
//            }
//        });
//    });
//};

// получение списка всех сенсоров для авторизированного пользователя
SoapManager.prototype.getAllSensors = function (callback) {
    var me = this;

    soap.createClient(me.getFullUrl(), function (err, client) {
        if (err) throw err;
        client.setSecurity(new soap.BasicAuthSecurity(me.admin_login, me.password));
        console.log('getAllSensors', me.login);
        client.runAsUser({'input_data': _xml.allSensorsXML(), 'user': me.login}, function (err, result) {
            if (!err) {
                console.log('getAllSensors OK');
                parseXML(result.return, function (err, res) {
                    res = res.MESSAGE.SENSORS[0].SENSOR;
                    var sensors = [];
                    for (var i = 0; i < res.length; i++) {
                        sensors.push(res[i].$);
                    }

                    callback(sensors);
                });
            } else {
                console.log('getAllSensors ERROR');
                console.log(err.body, "SOAP 595");
            }
        });
    });
};

// получение планов на конкретный день
SoapManager.prototype.getPlanByDate = function (timestamp, callback) {
    var me = this;

    soap.createClient(me.getFullUrl(), function (err, client) {
        if (err) throw err;

        client.setSecurity(new soap.BasicAuthSecurity(me.admin_login, me.password));
        console.log('getPlansByTime', me.login);

        // timestamp *= 1000;
        me.getDailyPlan(callback, timestamp);
    });
};

// сохранение маршрута в 1С
SoapManager.prototype.saveRoutesTo1C = function (routes, callback) {
    console.log('saveRoutesTo1C');
    var counter = 0,
        me = this,
        // получение новой геометрии маршрута
        loadGeometry = function (ii, jj, callback) {
            tracksManager.getRouteBetweenPoints([routes[ii].points[jj].startLatLon, routes[ii].points[jj].endLatLon],
                function (data) {
                    routes[ii].points[jj].geometry = data.route_geometry;
                    routes[ii].counter++;
                    if (routes[ii].counter == routes[ii].points.length) {
                        counter++;
                        console.log('route ready', ii);
                        if (routes.length == counter) {
                            callback();
                        }
                    }
                });
        },

        // сохранение в 1С от имени авторизированного пользователя
        saveTo1C = function (resXml) {
            soap.createClient(me.getFullUrl(), function (err, client) {
                if (err) throw err;

                client.setSecurity(new soap.BasicAuthSecurity(me.admin_login, me.password));

                client.runAsUser({'input_data': resXml, 'user': me.login}, function (err, result) {
                    if (!err) {
                        console.log('saveRoutesTo1C OK');
                        log.toFLog('afterSave.js', result);
                        callback({result: result});
                    } else {
                        console.log('saveRoutesTo1C ERROR');
                        log.toFLog('afterSaveError.js', err);
                        console.log(err.body, "SOAP 652");
                        callback({error: err});
                    }
                });
            });
        };

    log.toFLog('origBeforeSave.json', routes);

    var resXml;
    for (var i = 0; i < routes.length; i++) {
        routes[i].counter = 0;
        for (var j = 0; j < routes[i].points.length; j++) {
            loadGeometry(i, j, function () {
                resXml = _xml.routesXML(routes, me.login);
                log.toFLog('saveChanges.xml', resXml, false);
                saveTo1C(resXml);
            });
        }
    }
};

// открытие окна точки в 1С клиента IDS (заточенно строго под него)
SoapManager.prototype.openPointWindow = function (user, pointId, guid) {
    // соотношения наших логинов с их гуидами (по человечски получать их мы пока не можем)
    var userIds = {
        'IDS.fedorets': '2d61f1b4-16f2-11e3-925c-005056a74894',
        'IDS.ribak': '55e41a94-10b7-11e3-925c-005056a74894',
        'IDS.a.kravchenko': '5229eabf-f516-11e2-a23d-005056a74894',
        'IDS.kadysh': '7274255c-982f-11e5-a386-005056a76b49',
        'IDS.shulga': '69dfeeb7-1a4d-11e5-a872-005056a77794'
    };

    //pointId = '2dddb7d0-c943-11e2-a05b-52540027e502';
    //user = 'IDS.a.kravchenko';

    console.log('user', user, 'pointId', pointId);
    console.log('userIds[user]', userIds[user], "Recieving GUID", guid, " ", guid == userIds[user]);


    if (!userIds[user]) {
        console.log('openPointWindow >> can not find user');
        return;
    }

    soap.createClient('http://SNG_Trans:J7sD3h9d0@api.alaska.com.ua:32080/1c/ws/SNGTrans.1cws?wsdl', function (err, client) {
        if (err) {
            console.log('user', user, 'pointId', pointId);
            console.log('err.body >> ', err.body, "SOAP 698");
            return;
        }
        client.setSecurity(new soap.BasicAuthSecurity('SNG_Trans', 'J7sD3h9d0'));

        // метод в соапе открывающий окно в IDS-овской 1С-ке
        //client.OpenElement({
        //        UserId: 'efa17485-fb45-11e2-a23d-005056a74894',
        //        ObjectType: 'СПРАВОЧНИК',
        //        ObjectName: 'КУБ_Точки',
        //        ElementId: 'dcaf4733-378c-11e6-a4a7-005056a76b49'
        //    },
        client.OpenElement({
            UserId: userIds[user],
            ObjectType: 'СПРАВОЧНИК',
            ObjectName: 'КУБ_Точки',
            ElementId: pointId
        },
            function (err, result) {
            if (err) console.log(err.body, "SOAP 717");
            if (result) console.log(result, "SOAP 718");
        });
    });
};

// сохранение координат точки в 1С
SoapManager.prototype.updateWaypointCoordTo1C = function (waypoint, callback) {
    log.toFLog('origWaypointBeforeSave.json', waypoint);

    //console.log("!!!!!!!!!!! update Wayoint", waypoint.waypoint, "confirm", waypoint.confirm);
        me = this;

    var resXml;
    resXml = _xml.waypointNewCoordXML(waypoint, me.login);
    log.toFLog('saveChanges.xml', resXml, false);



    // сохранение в 1С от имени авторизированного пользователя
    saveTo1C = function (resXml) {

        //console.log("Saveto1C me", me)
            soap.createClient(me.getFullUrl(), function (err, client) {
                if (err) throw err;


               // client.setSecurity(new soap.BasicAuthSecurity('k00056.0', '123'));
                client.setSecurity(new soap.BasicAuthSecurity(me.admin_login, me.password));//или так или строчкой выше
                //client.runAsUser({'input_data': resXml, 'user': 'k00056.0'}, function (err, result) {


                client.runAsUser({'input_data': resXml, 'user': me.login}, function (err, result) {
                    if (!err) {
                        console.log('updateWaypointCoordTo1C OK');
                        log.toFLog('afterSave.js', result);
                        callback({result: result});
                    } else {
                        console.log("Res.XML = ", resXml);
                        console.log('updateWaypointCoordTo1C ERROR');
                        log.toFLog('afterSaveError.js', err);
                        console.log(err.body, "SOAP 758");
                        callback({error: err});
                    }
                });
            });
        };

    saveTo1C(resXml); //Снять комментарий и можно записывать
};





SoapManager.prototype.closeDay = function (closeDayData, callback) {
    var me = this;
    var url  = 'https://' + this.admin_login + ':' + this.password + this.url;
    // сохранение в 1С от имени авторизированного пользователя
    var saveTo1C = function (resXml) {
        console.log("Saveto1C me", me);
        soap.createClient(url, function (err, client) {
            if (err) throw err;
            console.log('CLIENT', client);
            // client.setSecurity(new soap.BasicAuthSecurity('k00056.0', '123'));
            client.setSecurity(new soap.BasicAuthSecurity(me.admin_login, me.password));//или так или строчкой выше
            //client.runAsUser({'input_data': resXml, 'user': me.login}, function (err, result) {

            client.runAsUser({'input_data': resXml, 'user': me.login}, function (err, result) {
                if (!err) {
                    console.log('Close Route to 1C ok');
                    log.toFLog('afterSave.js', result);
                    callback({result: result});
                } else {
                    console.log("Res.XML = ", resXml);
                    console.log('Close Route to 1C ERROR');
                    log.toFLog('afterSaveError.js', err);
                    console.log(err.body, "SOAP 794");
                    callback({error: err});
                }
            });
        });
    };

    log.toFLog("closeRoutes.txt", closeDayData, true);
    saveTo1C(closeDayData); //Снять комментарий и можно записывать
};

//Метод получения настроек.
SoapManager.prototype.getNewConfig = function (company, callback) {
    var me = this;
    var url  = 'https://' + this.admin_login + ':' + this.password + this.urlUI;
    // сохранение в 1С от имени авторизированного пользователя
    var receiveConfig = function (company, callback) {
        //console.log("Try to recieve config", me.login, configData);
        soap.createClient(url, function (err, client) {
            if (err) throw err;
            //console.log('CLIENT', client);
            // client.setSecurity(new soap.BasicAuthSecurity('k00056.0', '123'));
            client.setSecurity(new soap.BasicAuthSecurity(me.admin_login, me.password));//или так или строчкой выше
            //client.runAsUser({'input_data': resXml, 'user': me.login}, function (err, result) {

            client.getConfig({user: me.login}, function (err, result) {
            //client.setMobileDeviceToDriver({user: me.login,  idMobileDevice:'355404066184339' ,  idDriver:'6eb8c195-6eb7-11e6-b210-005056a76b49' }, function (err, result) {
                if (!err) {

                    console.log('GET CONFIG OK for', me.login);
                    log.toFLog('config is', result);
                    //log.toFLog('Mobile', result);
                    //console.log('config is', result);
                    callback(company, result);
                } else {
                    console.log('GET CONFIG  ERROR');
                    console.log('result', err);
                    log.toFLog('result', err);
                    console.log(err.body, "SOAP 828");
                    callback({error: err});
                }
            });
        });
    };

    receiveConfig(company, callback); //Снять комментарий и можно записывать
};



SoapManager.prototype.sendHook = function (company, type, data, callback) {
    //console.log("Etap 1");
    var me = this;
    var url  = 'https://' + this.admin_login + ':' + this.password + this.urlUI;
    // сохранение в 1С от имени авторизированного пользователя
    var sendHookOutside = function (company, type, data) {
        //console.log("Etap 2");
        soap.createClient(url, function (err, client) {
            //console.log("Etap 3", client.UI.UISoap.outsideHook);
            if (err) throw err;
            //console.log("Etap 4");
            client.setSecurity(new soap.BasicAuthSecurity(me.admin_login, me.password));
            //console.log("Etap 5");

            data.type = type;

            var nData = JSON.stringify(data);

            client.outsideHook({data: nData,  user: "", company: company, branch: ""}, function (err, result) {
                console.log("Hook result", result);
                if (!err) {
                    console.log('Send Hook Success');
                } else {
                    console.log('Send Hook Error',  err);
                }
            });
        });
    };

    sendHookOutside(company, type, data); //Снять комментарий и можно записывать
};





SoapManager.prototype.setMobileDevice = function (company, imei, driverID, callback) {
    log.info("Set Mobile Device start");
    var me = this;
    var url  = 'https://' + this.admin_login + ':' + this.password + this.urlUI;
    // сохранение в 1С от имени авторизированного пользователя
    var setMobile = function (company, callback) {
               soap.createClient(url, function (err, client) {
            if (err) throw err;
            client.setSecurity(new soap.BasicAuthSecurity(me.admin_login, me.password));//или так или строчкой выше

            log.info("Ready to call", imei, driverID);

            client.setMobileDeviceToDriver({user: me.login,  idMobileDevice:imei,  idDriver:driverID }, function (err, result) {
                if (!err) {

                    console.log('GET SET Device OK for', me.login);
                    log.toFLog('config is', result);
                    //log.toFLog('Mobile', result);
                    //console.log('config is', result);
                    callback(company, result);
                } else {
                    console.log('GET SET Device  ERROR');
                    console.log('result', err);
                    log.toFLog('result', err);
                    console.log(err.body, "SOAP 828");
                    callback({error: err});
                }
            });
        });
    };

    setMobile(company, callback);
};




//Получение пушей водителей
SoapManager.prototype.getPushes = function (idArr, time, company, callback, tempCompany) {
    // получить строковую дату в формате 1С
    function getDateStrFor1C(timestamp) {
        var date = new Date(timestamp);
        return date.getFullYear() +
            ("0" + (date.getMonth() + 1)).slice(-2) +
            ( ("0" + date.getDate())).slice(-2);
    }

    var me = this;
    var url = 'https://' + this.admin_login + ':' + this.password + this.urlUI;
    // сохранение в 1С от имени авторизированного пользователя
    var receivePushes = function (idArr, time, company, callback, tempCompany) {
        //console.log("Try to recieve pushes", me.login);
        soap.createClient(url, function (err, client) {
            if (err) throw err;
            //console.log('CLIENT', client);
            // client.setSecurity(new soap.BasicAuthSecurity('k00056.0', '123'));
            client.setSecurity(new soap.BasicAuthSecurity(me.admin_login, me.password));//или так или строчкой выше
            //client.runAsUser({'input_data': resXml, 'user': me.login}, function (err, result) {
            //console.log("STEP 1", idArr, getDateStrFor1C(time * 1000));
            client.getDriversActions({'itenId':idArr, 'datestr':getDateStrFor1C(time * 1000), 'user': me.login}, function (err, result) {
                if (!err) {
                    //console.log('GET PUSHES OK');
                    log.toFLog('PUSHES is', result);
                    console.log('!!!!!!!!PUSHES is', JSON.parse(result.return).length);
                    if (tempCompany == undefined) tempCompany = company;
                    callback(tempCompany, result);
                } else {
                    if (tempCompany == undefined) tempCompany=company;
                    console.log('GET PUSHES  ERROR');
                    log.toFLog('result', err);
                    console.log('result', err, "SOAP 872");

                    //console.log(err.body);
                    callback(tempCompany, {error: err});
                }
            });
        });
    };

    receivePushes(idArr, time, company, callback, tempCompany);

};

// проверить наличие новых решений (июль 2016)
SoapManager.prototype.lookAdditionalDailyPlan = function (serverDate, existIten, company, callback) {

    var me = this;
    // Проверка, запрашиваем ли мы день уже существующий или перешли в новый
    var oldDay = serverDate.substr(0,2);
    var date =  new Date();
    var newDay = date.getDate();
    var inTime = (oldDay==newDay);
    console.log("Old DAY = ", oldDay, "And new Day", newDay , inTime, "ExistIten", existIten);

    //Find unique logins

    var logins = findUniqueLogins(existIten);
    console.log("logins", logins, "existIten", existIten);




    date = Date.now();
    soap.createClient(me.getFullUrl(), function (err, client) {
        if (err) throw err;

        // авторизация с правами соап-администратора
        client.setSecurity(new soap.BasicAuthSecurity(me.admin_login, me.password));
        //console.log(me.login);
        //console.log(_xml.dailyPlanXML(date));
        var answer = 0;
        var newItin =[];
        for (var i = 0; i < logins.length; i++){
            console.log("Send REQUEST");
            client.runAsUser({'input_data': _xml.dailyPlanXML(date), 'user': logins[i].login}, function (err, result) {
                answer ++;
                if (!err) {
                    console.log("ADD ITIN SERCH", result);
                    parseXML(result.return, function (err, res) {
                       if (!err)  console.log("1074 FIND ITIN", res.MESSAGE.PLANS[0].ITINERARY);
                        newItin.push(res.MESSAGE.PLANS[0].ITINERARY);
                    });

                    if (answer === logins.length) {
                        var toLoad = compareItinerary(newItin, existIten);
                        console.log("toLoad", toLoad);
                        if (toLoad !== null) {
                            analysAndLoadnewITIN(toLoad, existIten, callback);
                        } else {
                            console.log("NEW ITIN DOESNOT DISCOVERED");
                            return;
                        }

                    }
                } else {
                    console.log("ERRRRRRRROR", err);
                }
            })
        }


        //fixme
        return;
        // запрос в соап от имени авторизированного пользователя, но с правами администратора
        // получения списка id решений на конкретную дату
        console.log("me.login", me.login);
        client.runAsUser({'input_data': _xml.dailyPlanXML(date), 'user': me.login}, function (err, result) {
            if (!err) {
                //console.log('Its ALL Iten for now:');
                //console.log(result.return);

                // парсинг ответа соапа из xml в json
                parseXML(result.return, function (err, res) {

                    // диспетчер, что делать, если изменилось количество решений или дата дня

                    // пропало утвержденное решение
                    if (res.MESSAGE.PLANS == null && inTime && existIten > 0) {
                        //console.log('Проблемма = пропало единственное утвержденное решение');
                        callback({status: ' loose single iten'});
                        return;
                    }

                    // Новых решений не появилось
                    if ((res.MESSAGE.PLANS == null && inTime && existIten == 0) || res.MESSAGE.PLANS == undefined ) {
                        //console.log('Все еще нет утвержденных решений');
                        callback({status: 'still no plan'});
                        return;
                    }

                    var itineraries = res.MESSAGE.PLANS[0].ITINERARY,
                        data = [];

                    data.itens = itineraries;
                    data.iLength = itineraries.length;
                    data.company = company;
                    //console.log("Quantity of Iten is", data.iLength);


                    // Количество решений не изменилось
                    if (data.iLength == existIten && inTime) {
                        //console.log("Количество решений за день не изменилось");
                        callback({status: 'no changes'});
                        return;
                    }

                    // Появились утвержденные планы на новый день.
                    if(!inTime && data.iLength > 0){
                        //console.log("Появились утвержденные планы на новый день");
                        callback({status: 'begin new day', newDayIten: data});
                        return;
                    }

                    //Пропало одно из утвержденных решений
                    if(inTime && data.iLength<existIten){
                        //console.log("Проблемма. Пропало одно из утвержденных решений");
                        callback({status: 'loose one of Iten'});
                        return;
                    }

                    //Появились новые решения на текущий день
                    if(inTime && data.iLength>existIten){
                        //console.log("Появилось дополнительное утвержденное решение");
                        callback({status: 'exist additional Iten', addIten:data});
                        return;
                    }

                    console.log("Неопознанная проблемма. Текущий день = ", inTime, "Уже получено решений", existIten, "На 1с существует решений", data.iLength);
                    callback({status: 'undefined problem', iten:data});


                });
            } else {
                console.log('getDailyPlan ERROR');
                console.log(err.body, "SOAP 976");
            }
        });
    });
};

//fixme branchId, branchName,
SoapManager.prototype.getNewDayIten = function (id, version, company, callback) {
    var me=this;
    soap.createClient(me.getFullUrl(), function (err, client) {
        if (err) throw err;
        client.setSecurity(new soap.BasicAuthSecurity(me.admin_login, me.password));
        console.log("Важные данные", id, version, me.login);
        client.runAsUser({
            'input_data': _xml.itineraryXML(id, version, true),
            'user': me.login
        }, function (err, result) {
            itineraryCallback(err, result, me, company, true, data, date, branchId, branchName, callback);
        });
    });
};

SoapManager.prototype.getAdditionalIten = function (id, version, login, branch, branchName, company, callback) {
    var me=this;
    console.log("1193 Важные данные", id, version, login, company );
    soap.createClient(me.getFullUrl(), function (err, client) {
        if (err) throw err;
        client.setSecurity(new soap.BasicAuthSecurity(me.admin_login, me.password));
        client.runAsUser({'input_data': _xml.itineraryXML(id, version, true), 'user': login}, function (err, result) {

            parseXML(result.return, function (err, res) {
                //if (res.MESSAGE.PLANS == null) {
                //    console.log('NO PLANS!');
                //    callback({status: 'no plan'});
                //    return;
                //}

                var data = [];
                var itineraries = id;

                data.iLength = 1;
                var itIsToday = true;

                var date = Date.now();

                //console.log("Looking for keys", res.MESSAGE.PLANS[0].CLIENT_ID);
                // если грузить нужно не только новые решения (т.е. запросов будет в два раза больше,
                // один на новый формат, один на старый) счетчик оставшихся запросов умножаем на два
                //if (!config.loadOnlyItineraryNew) data.iLength *= 2;

                // получение развернутого решения по списку полученных ранее id решений
                for (var i = 0; i < 1; i++) {
                    (function (ii) {
                        setTimeout(function () {

                            console.log("Подгружаем из 1с", id, version, branch, branchName);
                            me.getItinerary(client, id, version, branch, branchName, itIsToday, data, date, callback);
                        }, ii * 5000);
                    })(i);
                }

            });








            //console.log("Промежуточный результат", result.return);
            //var itineraries = result.return.MESSAGE.PLANS[0].ITINERARY;
            //data.iLength = itineraries.length;
            //itineraryCallback(err, result, me, company, true, data, date, callback);
        });
    })


};


function analysAndLoadnewITIN(toLoad, existItin, callback) {
    console.log("Start analysAndLoadnewITIN");


    var toDelete = existItin.map(function (itin) {
       if ((toLoad.BRANCH_ID == itin.branch) && (new Date(itin.date).getDate() !== new Date().getDate())) return itin;
    });
    existItin.forEach(function (itin) {
        //fixme тестово отладочное убрать
        console.log("Date of ITIN", new Date(itin.date).getDate());
    });

    console.log("1262 toDelete", toDelete);
    if (toDelete || toDelete.lenght !== 0) {
        callback({status: 'begin new day', addIten: toLoad, oldDayItin: toDelete});
    } else {
        callback({status: 'exist additional Iten', addIten:toLoad});
    }

}


function compareItinerary(newItin, existItin) {
    console.log("Satrt compareItinerary");
    console.log("newItin, existItin", newItin, existItin);
    var clearNewItin = [];

    newItin.forEach(function(itin){
        clearNewItin.push(itin[0].$);
    });

    for (var i = 0; i < clearNewItin.length; i++){
        if (!existItin.some(function (itin) {
                return itin.id === clearNewItin[i].id
            })) {
            console.log("Find new Itin", clearNewItin[i]);
            return clearNewItin[i];
        }
    }
    return null;
}



function findUniqueLogins(existIten) {
    var exist = [].concat(existIten);
    var result = [].concat(exist[0]);
    exist.splice(0,1);
    for (var i = 0; i < exist.length; i++){
       if (result.some(function (item) {
               return item.login === exist[i].login
           })) {
           exist.splice(i,1);
           i--;
       } else {
           result.push(exist[i]);
       }
    }

    return result;
}

