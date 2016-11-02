module.exports = TracksManager;

var request = require("request"),
    fs = require('fs'),
    config = require('./config'),
    log = new (require('./logging'))('./logs'),
    loadFromCache = config.cashing.tracks;

// класс для работу перимущественно с агрегатаром и роутером
function TracksManager(aggregatorUrl, routerUrl, login, password) {
    this.aggregatorUrl = aggregatorUrl;
    this.routerUrl = routerUrl;
    this.login = login;
    this.password = password;

    // параметры используемые для отладки агрегатора, которые можно вообще не передовать
    this.undef_t = 60;
    this.undef_d = 1000;
    this.stop_s = 5;
    this.stop_d = 25;
    this.move_s = 5;
    this.move_d = 110;
}

// получить трек по указанному гиду машины и в заданном временом диапазоне
TracksManager.prototype.getTrack = function (gid, from, to, undef_t, undef_d,
                                             stop_s, stop_d, move_s, move_d, callback) {
    // загрузка треков из кеша в случае наличия флага и самого кеша (использовалось для отладки)
    //console.log (loadFromCache, "Пришел запрос", gid, from, to);
    if (loadFromCache) {
        fs.readFile('./logs/' + gid + '_' + 'track.js', 'utf8', function (err, data) {
            if (err) {
                return console.log(err);
            }

            callback(JSON.parse(data));
        });
    } else {
        //console.log( "Запрос на частичные треки пришел");
        var url = this.createParamsStr(from, to, undef_t, undef_d, stop_s, stop_d, move_s, move_d);
        url += '&gid=' + gid;
        //console.log( "NEW URL", url);

        request({
            url: url,
            json: true
        }, function (error, response, body) {
            if (!error && response.statusCode === 200) {
                //log.toFLog(gid + '_' + 'track.js', body);
                callback(body, gid);
            }
        });
    }
};

// получение треков по переданным стейтам и гиду машины
TracksManager.prototype.getTrackByStates = function (states, gid, demoTime, callback) {
    console.log("Запрос апдейт дошел до треккера");
    if(states == undefined || states[0] == undefined) {
        //console.log("!!!!The rabbit is out of hat!!!", states);
        callback(states, gid);
        return;
    }
    var counter = 0,
        me = this,
        started = 0,
        updateTime = states[0].lastTrackUpdate == undefined ? 0 : states[0].lastTrackUpdate;

    for (var i = 0; i < states.length; i++) {
        //if ((demoTime != -1 && states[i].t2 > demoTime) ||
        //    (demoTime == -1 && states[i].t1 < updateTime + 1800)) continue;

        started++;
        (function (ii) {
            console.log('load part #', ii, "from", states[ii].t1, "to", states[ii].t2);
            me.getTrackPart(gid, states[ii].t1, states[ii].t2, function (data) {
                states[ii].coords = data;
                //console.log('done loading part #', ii);
                counter++;
                if (counter == started) {
                    callback(states, gid);
                }
            });
        })(i);
    }

    if (started == 0) {
        callback(states, gid);
    }

};


TracksManager.prototype.getTrackByStatesForNode = function (states, gid, route, callback) {
    //console.log("Готовимся к запросу в треккер", gid);
    if(states == undefined || states[0] == undefined) {
        console.log("Бракованный стейт", states);
        return;
    }

    var counter = 0,
        me = this,
        started = 0,
        finished = 0,
        j=0;
    for (j=0; j<states.length;j++){
        if (states[j].coords == undefined || states[j].coords.length <2) finished++
    }
        j=0;
    //console.log("По gid", gid, "Нужно запросить треков", finished+1);
    for (var i = states.length-1; (i >=0 && j < finished+4); i--) {

        if (i >= states.length-4 || (states[i].coords == undefined || states[i].coords.length <2) ) {
            j++;
        } else {
            continue;
        }
        //console.log("Параметры запрса" , i, j);
        started++;
        (function (ii) {
            //console.log('load part #', ii, "from", states[ii].t1, "to", states[ii].t2);
            me.getTrackPart(gid, states[ii].t1, states[ii].t2, function (data, error) {
                if (error == undefined && data!= undefined && data[0] != undefined && typeof (data) != 'string' && states[ii] != undefined) {
                    states[ii].coords = data;
                } else {
                   if (states[ii] != undefined && states[ii].coords != undefined) states[ii].coords = [];
                }

                //console.log (states[ii] != undefined , states[ii]);
                if (states[ii] != undefined && (states[ii].state =="ARRIVAL" || states[ii].state == "START") && states[ii].coords != undefined && states[ii].coords.length >2) {
                    //console.log("Убиваем лишние координаты");
                    states[ii].coords.splice(1, states[ii].coords.length - 2);
                }
                //console.log('done loading part #', ii);
                counter++;
                if (counter == started) {
                    callback(states, route);
                }
            });
        })(i);
    }

    if (started == 0) {
        callback(states, route);
    }

};

// получение части треков по всему склееному решению и заданному времени
TracksManager.prototype.getRealTrackParts = function (data, from, to, callback, company, dayStart) {
    var url = this.createParamsStr(from, to, this.undef_t, this.undef_d, this.stop_s,
            this.stop_d, this.move_s, this.move_d),
        counter = 0,
        reqCounter = 0,
        result = [];
    //console.log("Таки зашли в файл трекс", data.routes.length);
    if(data != undefined && data.routes != undefined) {
        for (var i = 0; i < data.routes.length; i++) {

            //console.log("Ищем треки для ", data.routes[i].driver.NAME );
            for (var j = 0; j < data.sensors.length; j++) {
                // запрашивать треки только по сенсорам прикрепленным к машинам имеющихся маршрутов
                if (data.routes[i].TRANSPORT == data.sensors[j].TRANSPORT) {
                    counter++;
                    (function (jj) {
                        //console.log("url=", url);
                        // замена стандартного времени на время нужное именно для этого роута
                        var indxBegin=url.indexOf('&from=');
                        var indxEnd=url.indexOf('&to=');
                        var newUrl='';
                        //if (data.routes[i].real_track != undefined && typeof(data.routes[i].real_track) != 'string') console.log ("Стейтов перед запросом", data.routes[i].real_track.length);
                        if (data.routes[i].real_track != undefined && data.routes[i].real_track[data.routes[i].real_track.length-2] != undefined) {
                            newUrl=url.substring(0,indxBegin) + '&from=' + data.routes[i].real_track[data.routes[i].real_track.length-1].t1 + url.substring(indxEnd);
                        } else {

                            if (data.routes[i].real_track != undefined && data.routes[i].real_track.length <= 1){
                                newUrl=url.substring(0,indxBegin) + '&from=' + dayStart + url.substring(indxEnd);
                            } else {
                                newUrl=url;
                            }

                        }
                       // if (data.sensors[jj].GID == 759 || data.sensors[jj].GID =="759"){
                            //console.log("   Newurl=", newUrl);
                            //console.log("   url=", url)}
                        request({
                            url: newUrl + '&gid=' + data.sensors[jj].GID,
                            json: true
                        }, function (error, response, body) {
                            //console.log("Ответ по треку", response.statusCode);
                            if (!error && response.statusCode === 200) {
                                result.push({
                                    'gid': data.sensors[jj].GID,
                                    'data': body
                                });
                                reqCounter++;
                                if (counter == reqCounter) {
                                    console.log('Done, first loading stops!');
                                    callback(result, company);

                                }
                            } else {
                                console.log('ERROR');
                                result.push({
                                    'gid': data.sensors[jj].GID,
                                    'data': "error"
                                });
                                reqCounter++;
                                if (counter == reqCounter) {
                                    console.log('Done, second loading stops!');
                                    callback(result, company);
                                }
                            }
                        });
                    })(j);
                } else {
                    //console.log("Если нет датчиков, то counter = 0, а сейчас counter = ", counter);
                }
            }
        }  //console.log ("Конец запросов. Результата нет");
        //callback("error");
    } else {
        //console.log("Нечего спрашивать?");
    }
    //console.log("Отправлено запросов ", counter, " Получено ответов", reqCounter);
    // Уникальный случай, когда ни у одной из машин не было датчика
    if(counter == 0) callback("error", company);
};

// создать строку параметров для запроса к агрегатору
TracksManager.prototype.createParamsStr = function (from, to, undef_t, undef_d,
                                                    stop_s, stop_d, move_s, move_d, op) {
    op = typeof op !== 'undefined' ? op : 'states';
    return this.aggregatorUrl
        + op
        + '?login=' + this.login
        + '&pass=' + this.password
        + '&from=' + from
        + '&to=' + to
        + '&undef_t=' + undef_t
        + '&undef_d=' + undef_d
        + '&stop_s=' + stop_s
        + '&stop_d=' + stop_d
        + '&move_s=' + move_s
        + '&move_d=' + move_d
        + '&current=true';
};

// поулчить данные роутера (плановые треки, матрицы расстояний и матрицы времен проезда) по конкреьтному маршруту
TracksManager.prototype.getRouterData = function (_data, index, nIndx, checkBeforeSend, callback, onlyOne) {
    var data = onlyOne ? _data : _data[nIndx],
        loc_str = '',
        points = data.routes[index].points,
        me = this,
        counter = 0;

    for (var i = 0; i < points.length; i++) {
        if (points[i].LAT != null && points[i].LON != null) {
            loc_str += "&loc=" + points[i].LAT + "," + points[i].LON;
            counter++;
        }
    }

    if (counter < 2) {
        data.routes[index].time_matrix_loaded = true;
        data.routes[index].plan_geometry_loaded = true;
        data.routes[index].not_enough_valid_points = true;
        return;
    }

    // получение матриц времени и расстояний
    (function (url) {
        request({
            url: url,
            json: true
        }, function (error, response, body) {
            if (!error && response.statusCode === 200) {
                data.routes[index].time_matrix = body;
                data.routes[index].time_matrix_loaded = true;
                checkBeforeSend(_data, callback);
            } else {
                console.log('table', points.length, body, url);
            }
        });
    })(this.routerUrl + 'table?' + loc_str);



    // получение плановых маршрутов
    (function (url) {
        request({
            url: url,
            json: true
        }, function (error, response, body) {
            if (!error && response.statusCode === 200) {
                // если роутер не смог проложить маршрут сразу, запрашиваем треки кусками по две точки
                if (body.route_geometry == null) {
                    console.log('body.route_geometry == null');
                    data.routes[index].plan_geometry = [];
                    data.routes[index].plan_geometry_loaded = false;
                    me.getGeometryByParts(_data, nIndx, index, 0, checkBeforeSend, callback, onlyOne);
                } else {
                    data.routes[index].plan_geometry = body.route_geometry_splited;
                    data.routes[index].plan_geometry_loaded = true;
                    checkBeforeSend(_data, callback);
                }
            } else {
                console.log('viaroute', points.length, body, url);
            }
        });
    })(this.routerUrl + 'viaroute?instructions=false&compression=false' + loc_str);

};

// запрашивает треки кусками по две точки, если роутер не смог проложить маршрут сразу
TracksManager.prototype.getGeometryByParts = function (_data, nIndx, index, startPos, checkBeforeSend, callback, onlyOne) {
    var data = onlyOne ? _data : _data[nIndx],
        points = data.routes[index].points,
        me = this,
        query = this.routerUrl + 'viaroute?instructions=false&compression=false'
            + '&loc=' + points[startPos].LAT
            + "," + points[startPos].LON
            + '&loc=' + points[startPos + 1].LAT
            + "," + points[startPos + 1].LON;

    if (points[startPos].LAT == undefined || points[startPos + 1].LAT == undefined) {
        startPos++;
        me.getGeometryByParts(_data, nIndx, index, startPos, checkBeforeSend, callback, onlyOne);
        return;
    }

    request({
        url: query,
        json: true
    }, function (error, response, body) {
        if (!error && response.statusCode === 200) {
            data.routes[index].plan_geometry.push(body.route_geometry);
            startPos++;
            //console.log('iteration #', startPos);
            if (points.length > startPos + 1) {
                me.getGeometryByParts(_data, nIndx, index, startPos, checkBeforeSend, callback, onlyOne);
            } else {
                data.routes[index].plan_geometry_loaded = true;
                checkBeforeSend(_data, callback);
            }
        } else {
            console.log('getGeometryByParts ERROR', body, error, query);
        }
    });
};




// получить реальные треки и стопы по всем машинам решения за весь день указанный в переданных данных в поле server_time
TracksManager.prototype.getTracksAndStops = function (_data, nIndx, checkBeforeSend, callback, date, itIsToday) {
    console.log('=== getRealTracks ===');
    var data = _data[nIndx];
    var now = new Date(data.server_time * 1000);
    if(itIsToday){
        var timeStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000;
        var timeFin = new Date().getTime() / 1000;
    }else{
        timeStart =   parseInt( (date / 1000) - (60 * 60 * 24), 10);
        timeFin = parseInt(date / 1000, 10);
    }
    var url = this.createParamsStr(
            timeStart,
            //new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() / 1000, //Тестово отладочный блок. Если раскомментировать строку то будет получать все данные за день. В строке ниже, получает данные только до текущего времени сервера
            timeFin,
            this.undef_t, this.undef_d,
            this.stop_s, this.stop_d, this.move_s, this.move_d);

    for (var i = 0; i < data.routes.length; i++) {
        for (var j = 0; j < data.sensors.length; j++) {
            if (data.routes[i].TRANSPORT == data.sensors[j].TRANSPORT) {
                if (data.routes[i].haveSensor) {
                    data.routes[i].moreThanOneSensor = true;
                    console.log('moreThanOneSensor = true');
                    break;
                }

                data.sensors[j].loading = true;
                data.routes[i].haveSensor = true;

                (function (jj) {
                    console.log('request for stops ', jj, url + '&gid=' + data.sensors[jj].GID);
                    request({
                        url: url + '&gid=' + data.sensors[jj].GID,
                        json: true
                    }, function (error, response, body) {
                        if (!error && response.statusCode === 200) {
                            console.log('stops for sensor loaded', jj);
                            data.sensors[jj].stops_loaded = true;
                            data.sensors[jj].real_track = body;
                            checkBeforeSend(_data, callback);
                        }
                    });
                })(j);
            }
        }
    }
};

// получить от роутера проложенный маршрут между двумя точками
TracksManager.prototype.findPath = function (lat1, lon1, lat2, lon2, callback) {
    request({
        url: this.routerUrl + 'viaroute?instructions=false&compression=false'
        + '&loc=' + lat1
        + "," + lon1
        + '&loc=' + lat2
        + "," + lon2,
        json: true
    }, function (error, response, body) {
        if (!error && response.statusCode === 200) {
            callback(body.route_geometry);
        }
    });
};

// получить от роутера время проезда между двумя точками
TracksManager.prototype.findTime = function (lat1, lon1, lat2, lon2, callback) {

    console.log("Запрос на время/расстояние между точками", lat1, lon1, lat2, lon2);
    request({
        url: this.routerUrl + 'table?'
        + '&loc=' + lat1
        + "," + lon1
        + '&loc=' + lat2
        + "," + lon2,
        json: true
    }, function (error, response, body) {
        if (!error && response.statusCode === 200) {
            callback(body);
        }
    });
};

// получить маршрут проложенный через точки
TracksManager.prototype.getRouteBetweenPoints = function (points, callback) {
    if (points.length < 2) return;

    var loc_str = "&loc=" + points[0].lat + "," + points[0].lon;
    for (var i = 1; i < points.length; i++) {
        loc_str += "&loc=" + points[i].lat + "," + points[i].lon;
    }

    request({
        url: this.routerUrl + 'viaroute?instructions=false&compression=false' + loc_str,
        json: true
    }, function (error, response, body) {
        if (!error && response.statusCode === 200) {
            callback(body);
        }
    });

};

// получить стопы по гиду машины за указанный промежуток времени
TracksManager.prototype.getStops = function (gid, from, to, callback) {
    var url = this.createParamsStr(from, to, this.undef_t, this.undef_d, this.stop_s,
        this.stop_d, this.move_s, this.move_d);
   // console.log("tracks 343", url);

    request({
        url: url + '&gid=' + gid,
        json: true
    }, function (error, response, body) {
        if (!error && response.statusCode === 200) {
            //console.log("tracks 349 body", body, "END track.js 349");
            callback(body);
        }
    });
};

// получить трек по гиду машины за указанный промежуток времени
TracksManager.prototype.getTrackPart = function (gid, from, to, callback) {
    var url = this.createParamsStr(from, to, this.undef_t, this.undef_d, this.stop_s,
        this.stop_d, this.move_s, this.move_d, 'messages');

    //console.log(url+ '&gid=' + gid, "Это сам запрос");


    request({
        url: url + '&gid=' + gid,
        json: true
    }, function (error, response, body) {
        if (!error && response.statusCode === 200) {
            //console.log(" Запрос успешен Track loaded");
            callback(body);
        } else {
            console.log(" Ошибка !!!!!", error);
            callback(body,error);
        }
    });
};

// сохранить данные обработанные в консоли анализа истории в солвер
//TracksManager.prototype.sendDataToSolver = function () {
//
//    fs.readFile('./logs/' + config.soap.defaultClientLogin + '_BigSolution.json', 'utf8', function (err, data) {
//        if (err) {
//            return console.log(err);
//        }
//
//        data = JSON.parse(data);
//
//
//        var test = {},
//            counter = 0,
//            key;
//        for (var i = 0; i < data.length; i++) {
//            key = data[i].waypoint_id.toString() + data[i].timestamp.toString();
//            if (!test[key]) {
//                test[key] = { counter: 1 };
//            }
//            else {
//                test[key].counter++;
//                counter++;
//                //console.log('REPEAT!', counter);
//                data.splice(i, 1);
//                i--;
//            }
//        }
//
//        var query;
//        var func = function (ii, _query) {
//            setTimeout(function () {
//                //console.log(_query);
//                request({
//                    url: _query,
//                    json: true
//                }, function (error, response, body) {
//                    //console.log(body, ii);
//                });
//
//            }, (ii) * 4 );
//        };
//
//        for (var i = 0; i < data.length; i++) {
//            if (i % 50 == 0) {
//                if (query != undefined) {
//                    func(i, query);
//                }
//
//                query = 'http://5.9.147.66:5500/visit?';
//                //query = 'http://5.9.147.66:5500/delete?';
//            } else {
//                query += "&";
//            }
//
//            query += 'point=' + data[i].waypoint_id +
//                '&data=' + data[i].transport_id + ';'
//                + data[i].driver_id + ';'
//                + data[i].timestamp + ';'
//                + 'true;'
//                + data[i].duration + ';'
//                + data[i].weight + ';'
//                + data[i].volume + ';'
//                + '0;'
//                + '0;'
//                + '0;0;0;0';
//
//            //query += 'point=' + data[i].waypoint_id +
//            //    '&date=' + data[i].timestamp;
//        }
//        func(i, query);
//
//
//        console.log(data.length);
//    });
//
//};

// получить матрицу времен проездов и расстояний по готовой строке координат
TracksManager.prototype.getRouterMatrixByPoints = function (pointsStr, callback) {
    //console.log(this.routerUrl + 'table?' + pointsStr, "Пытаемся получить предсказание Tracks 488");
    request({
        url: this.routerUrl + 'table?' + pointsStr,
        json: true
    }, function (error, response, body) {
        if (!error && response.statusCode === 200) {
            //console.log("Данные получены");
            callback(body, pointsStr);
        } else {

            console.log(body, "ERROR TRACKS 495");
        }
    });
};

// сформировать отчет по пробегам и типам стейтов
TracksManager.prototype.getStateDataByPeriod = function () {
    var gids = [1086, 900, 758, 709], //[741,708,711,710,712,764,709,715,739,742,753,897,725,714,716,718,701,713,723,746,735,762,812,720,733,814,896,756,721,706,759,757,744,747,760,717,758,719,755,734,809,707,738,736,748,763,749,754,813,811,705,743,899,745,933,900,697,761,810,895],
        step = 24 * 60 * 60,
        days = 1,
        startDate = 1454025600, //1453852800,//1446336000,
        endDate = startDate + days * 3600 * 24,
        tmpTime = startDate,
        result = {},
        me = this,
        reqCounter = 0,
        warehouse = {
            lat: 50.489879,
            lon: 30.451639
        },
        maxDistFromWh = 0.5,
        requests = [],
        strRes = '';

    while (tmpTime < endDate) {
        console.log(tmpTime);
        //console.log('day ', new Date(tmpTime * 1000));
        for (var j = 0; j < gids.length; j++) {
            requests.push([gids[j], tmpTime]);
        }

        tmpTime += step;
    }
    function do_func() {
        var wasNearWh = false,
            wasFarFromWh = false,
            returnToWh = false,
            nearWh,
            distFromWh,
            req = requests.pop(),
            gid = req[0], time = req[1];

        console.log('GO >>', new Date(time * 1000), gid);
        me.getStops(gid, time, time + step, function (data) {

            console.log('READY >>', new Date(time * 1000), gid);
            reqCounter++;

            result[gid] = result[gid] || {};
            result[gid][time] = result[gid][time] || {
                    MOVE: {
                        dist: 0,
                        time: 0
                    },

                    ARRIVAL: {
                        dist: 0,
                        time: 0
                    },

                    NO_SIGNAL: {
                        dist: 0,
                        time: 0
                    }
                };

            for (var i = 0; i < data.length; i++) {
                if (returnToWh) break;

                distFromWh = getDistanceFromLatLonInKm(warehouse.lat, warehouse.lon, data[i].lat, data[i].lon);
                nearWh = distFromWh < maxDistFromWh;

                wasNearWh = nearWh || wasNearWh;
                wasFarFromWh = (wasNearWh && !nearWh) || wasFarFromWh;
                returnToWh = wasFarFromWh && nearWh;

                if (!wasFarFromWh || returnToWh || data[i].state === 'START' || data[i].state === 'CURRENT_POSITION') continue;

                result[gid][time][data[i].state].dist += data[i].dist;
                result[gid][time][data[i].state].time += data[i].time;
            }

            if (reqCounter === gids.length * days) {
                console.log('Done!');
                log.toFLog('jsonStates.json', result);

                for (var k in result) {
                    if (!result.hasOwnProperty(k)) continue;

                    for (var k2 in result[k]) {
                        if (!result[k].hasOwnProperty(k2)) continue;

                        states = result[k][k2];
                        strRes += (parseInt(k2) / 86400 + 25569) + ','
                            + getNByGid(k) + ','
                            + (states.MOVE.dist / 1000) + ','
                            + (states.MOVE.time / 24 / 3600) + ','
                            + (states.ARRIVAL.dist / 1000) + ','
                            + (states.ARRIVAL.time / 24 / 3600) + ','
                            + (states.NO_SIGNAL.dist / 1000) + ','
                            + (states.NO_SIGNAL.time / 24 / 3600)
                            + '\r\n';
                    }
                }

                //console.log(strRes);
                log.toFLog('jsonStates.csv', strRes, false);
            }

            if (requests.length > 0)  do_func();
        });
    }

    do_func();
};


function deg2rad(deg) {
    return deg * (Math.PI / 180)
}

// расстояние в км между двумя точками
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
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
    return d;
}

function getNByGid(gid) {
    var nToGids = [['А28', 725],
        ['А17', 710],
        ['А15', 714],
        ['А12', 716],
        ['А43', 718],
        ['А27', 701],
        ['А59', 721],
        ['А49', 706],
        ['А48', 708],
        ['А50', 712],
        ['А32', 711],
        ['А64', 715],
        ['А68', 713],
        ['А33', 722],
        ['А73', 759],
        ['А46', 757],
        ['А61', 723],
        ['А41', 709],
        ['А22', 746],
        ['А18', 744],
        ['А10', 739],
        ['А24', 747],
        ['А08', 735],
        ['А78', 933],
        ['А79', 762],
        ['А37', 760],
        ['А05', 745],
        ['А55', 717],
        ['А42', 753],
        ['А45', 758],
        ['А52', 812],
        ['А75', 720],
        ['А47', 719],
        ['А35', 755],
        ['А09', 734],
        ['А81', 809],
        ['А21', 707],
        ['А19', 738],
        ['А03', 736],
        ['А23', 748],
        ['А29', 763],
        ['А51', 764],
        ['А34', 901],
        ['А14', 741],
        ['А54', 895],
        ['А63', 756],
        ['А38', 896],
        ['А74', 810],
        ['А02', 761],
        ['А44', 697],
        ['А11', 814],
        ['А16', 743],
        ['А56', 705],
        ['А04', 733],
        ['А01', 899],
        ['А69', 811],
        ['А06', 900],
        ['А77', 897],
        ['А36', 754],
        ['А07', 813],
        ['А25', 749]];

    for (var i = 0; i < nToGids.length; i++) {
        if (nToGids[i][1] == gid) return nToGids[i][0];
    }

    return 'NONE'
}

//http://sngtrans.com.ua/gps/states?login=admin&pass=admin321&from=1462395600&to=1462451321&gid=749 запрос на стейты
//http://sngtrans.com.ua/gps/messages?login=admin&pass=admin321&from=1462395600&to=1462451321&gid=749 запрос на треки