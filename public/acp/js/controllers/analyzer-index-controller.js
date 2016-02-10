// контроллер отвечающий за анализ и обработку данных
angular.module('acp').controller('AnalyzerIndexController', ['$scope', '$http', 'Track', 'Sensor',
    '$timeout', 'Solution', 'Plan', function (scope, http, Track, Sensor, timeout, Solution, Plan) {
        scope.params = {};
        scope.map = {};
        scope.points = {};

        var pointsCounter = 0,
            saving = false;

        toLogDiv('Загружаем данные...');
        timeout(function () {
            loadData();
        }, 1200);

        // загружает данные с сервера
        function loadData() {
            console.log('loadData');

            if (false) {
                // когда все точки обработаны, необходимо влючить эту ветку, для загрузки планов и
                // дальнейшего анализа данных
                var from = 1433116800, // грузить планы от
                    to =  1454924689; // и до
                scope.plans = [];
                loadPlans(from, to); // Грузит планы, проводит дополнительный анализ, после чего
                // сохраняет результат в BigSolution, который потом необходимо
                // грузить в солвер. После этого в acp-router в роуте loadsolution необходимо раскоментить кусок
                // кода, который формирует json для загрузки в 1С обновленных координат и выгрузить этот json в 1C
            } else {
                if (true) {
                    // в этой ветке происходит штатная работа человека работающего с перемещением точек
                    Solution.load().success(function (data) {
                        scope.data = data;
                        groupButtonsByRadius();
                        scope.map.clearMap();
                        scope.points.reinit(scope.data);
                    });
                } else {
                    // ветка влючаемая при необходимости догрузить новые данные в основной массив
                    scope.data = jsonData2; // новые данные подключаются отдельным файлом в /data/input_test2.js
                    groupButtonsByRadius();
                    Solution.merge(jsonData2).success(function (data) {
                        console.log('Merge complete!');
                    });
                }
            }
        }

        // загрузить сенсоры и стопы
        function loadSensorsAndStops() {
            var from = 1433116800,
                to = 1446076800;

            Sensor.all().success(function (sensors) {
                console.log({sensors: sensors});
                for (var i = 0; i < scope.data.length; i++) {
                    for (var j = 0; j < scope.data[i].coords.length; j++) {
                        for (var k = 0; k < sensors.length; k++) {
                            if (scope.data[i].coords[j].transportid == sensors[k].TRANSPORT) {
                                scope.data[i].coords[j].gid = sensors[k].GID;
                                sensors[k].need_data = true;
                                break;
                            }
                        }
                    }
                }

                scope.stopsCollection = {};
                var counter = 0;
                for (i = 0; i < sensors.length; i++) {
                    if (sensors[i].need_data) {

                        (function (ii) {
                            counter++;
                            Track.stops(sensors[ii].GID, from, to).success(function (stops) {
                                for (var i = 0; i < stops.data.length; i++) {
                                    stops.data[i].transportid = sensors[ii].TRANSPORT;
                                }

                                scope.stopsCollection[stops.gid] = stops.data;
                                counter--;

                                if (counter == 0) {
                                    console.log('all stops downloaded!');
                                    console.log({stops: scope.stopsCollection});
                                }
                            });
                        })(i);
                    }
                }
            });
        }

        // загрузить планы в диапазоне from - to
        function loadPlans(from, to) {
            console.log('loadPlans');
            Plan.all(from).success(function (data) {
                //console.log(data);
                console.log(new Date(from * 1000));
                //scope.plans.push(data);

                // в случае отсутствия планов начинается новый цикл загрузки
                if (data.status == 'no plan') {
                    startNewLoadCycle(from, to);
                    return;
                }

                // назначения гидов машинам из сенсоров
                for (var i = 0; i < data.sensors.length; i++) {
                    for (var j = 0; j < data.transports.length; j++) {
                        if (data.sensors[i].TRANSPORT == data.transports[j].ID) {
                            data.transports[j].gid = data.sensors[i].GID;
                        }
                    }
                }

                for (i = 0; i < data.routes.length; i++) {
                    // назначение машин на маршруты
                    for (j = 0; j < data.transports.length; j++) {
                        if (data.routes[i].TRANSPORT == data.transports[j].ID) {
                            data.routes[i].transport = data.transports[j];
                            break;
                        }
                    }

                    // привязывание конечных waypoint к точкам
                    for (var j = 0; j < data.routes[i].points.length; j++) {
                        for (var k = 0; k < data.waypoints.length; k++) {
                            if (data.routes[i].points[j].END_WAYPOINT == data.waypoints[k].ID) {
                                data.routes[i].points[j].waypoint = data.waypoints[k];
                                pointsCounter++;
                                break;
                            }
                        }
                    }
                }

                var counter = 0;
                for (var i = 0; i < data.routes.length; i++) {
                    if (data.routes[i].transport == undefined) {
                        counter++;
                        continue;
                    }

                    // получение стопов по гидам машин из маршрутов
                    (function (ii) {
                        Track.stops(data.routes[ii].transport.gid, from, from + 86400)
                            .success(function (stops) {
                                data.routes[ii].stops = stops.data;
                                bindPlanStopsToPoints(data.routes[ii]); // привязываем плановые стопы к точкам
                                counter++;
                                if (counter == data.routes.length) {
                                    // после выгрузки всех стопов начинаем новый цикл загрузки плана
                                    console.log('stops loaded!');
                                    startNewLoadCycle(from, to);
                                }
                            });
                    })(i);
                }

            });
        }

        // привязываем стопы из планов к точкам
        function bindPlanStopsToPoints(route) {
            var result = {
                    jobs: {
                        len: 0
                    },
                    stops: {}
                },
                point,
                stop,
                tmpKey,
                tmpStopId = 0,
                tmpTaskId,
                stopsArr,
                goodPoint;

            // начальное соотношение стопов к задачам
            for (var i = 0; i < route.points.length; i++) {
                point = route.points[i];
                if (point.waypoint == undefined) continue;
                for (var j = 0; j < route.stops.length; j++) {
                    stop = route.stops[j];
                    if (stop.state == "ARRIVAL" &&
                        getDistanceFromLatLonInKm(parseFloat(point.waypoint.LAT), parseFloat(point.waypoint.LON),
                            stop.lat, stop.lon) * 1000 <= 60) {

                        tmpKey = 'task#' + point.TASK_NUMBER;
                        if (result.jobs[tmpKey] == undefined) {
                            result.jobs[tmpKey] = [];
                            result.jobs.len++;
                        }

                        if (stop.id == undefined) {
                            tmpStopId++;
                            stop.id = tmpStopId;
                        }

                        result.jobs[tmpKey].push(stop);
                    }
                }
            }

            result.jobs.find_coef = result.jobs.len / route.points.length * 100;
            route.linked_jobs = result.jobs;

            // соотношения задач к стопам
            for (var key in result.jobs) {
                if (result.jobs.hasOwnProperty(key) && key.substr(0, 5) == 'task#') {

                    stopsArr = result.jobs[key];
                    for (var i = 0; i < stopsArr.length; i++) {
                        tmpKey = 'stop#' + stopsArr[i].id;
                        if (result.stops[tmpKey] == undefined) {
                            result.stops[tmpKey] = [];
                        }

                        result.stops[tmpKey].push(key);
                    }
                }
            }

            route.linked_stops = result.stops;
            route.good_points = [];
            if (scope.good_points == undefined) {
                scope.good_points = [];
            }

            // финальная подвязка стопа к задаче и определение "хороших" точек
            for (var key in result.jobs) {
                if (result.jobs.hasOwnProperty(key) && key.substr(0, 5) == 'task#') {
                    stopsArr = result.jobs[key];
                    if (stopsArr.length == 1
                        && route.linked_stops['stop#' + stopsArr[0].id] != undefined
                        && route.linked_stops['stop#' + stopsArr[0].id].length == 1) {

                        tmpTaskId = key.substr(5, key.length - 5);
                        for (var i = 0; i < route.points.length; i++) {
                            if (route.points[i].TASK_NUMBER == tmpTaskId) {
                                point = route.points[i];
                                break;
                            }
                        }

                        goodPoint = {
                            task_id: tmpTaskId,
                            timestamp: stopsArr[0].t1,
                            duration: stopsArr[0].time,
                            waypoint_id: point.waypoint.ID,
                            transport_id: route.TRANSPORT,
                            driver_id: route.DRIVER,
                            weight: point.WEIGHT,
                            volume: point.VOLUME,
                            packages: 1,
                            scu: 1
                        };
                        route.good_points.push(goodPoint);
                        scope.good_points.push(goodPoint);
                    }
                }
            }

        }

        // запуск нового цикла загрузки планов
        function startNewLoadCycle(from, to) {
            from += 86400; // + день в секундах
            if (to > from) {
                // если до конечного таймстемпа не дошли, запрашиваем следующий план
                loadPlans(from, to);
            } else {
                console.log('All plans loaded!');
                // если дошли, заменяем IDS-овские гуиды на наши внутренние id, необходимые для солвера
                replaceDataID();

                // сохраняем готовые данные в BigSolution
                Solution.saveBig(scope.good_points)
                    .success(function (data) {
                        console.log(data);
                    });

                console.log({good_points: scope.good_points, pointsCounter: pointsCounter});
            }
        }

        // заменяем IDS-овские гуиды на наши внутренние id, необходимые для солвера
        function replaceDataID() {
            var point;

            // данные для замен берутся из трех файлов /data/drivers.js, /data/transports.js, /data/waypoins.js
            for (var i = 0; i < scope.good_points.length; i++) {
                point = scope.good_points[i];

                for (var j = 0; j < driversJson.length; j++) {
                    if (driversJson[j].old_id == point.driver_id) {
                        point.driver_id = driversJson[j].new_id;
                        break;
                    }
                }

                for (var j = 0; j < transportsJson.length; j++) {
                    if (transportsJson[j].old_id == point.transport_id) {
                        point.transport_id = transportsJson[j].new_id;
                        break;
                    }
                }

                for (var j = 0; j < jsonWaypoints.length; j++) {
                    if (jsonWaypoints[j].old_id == point.waypoint_id) {
                        point.waypoint_id = jsonWaypoints[j].new_id;
                        break;
                    }
                }

            }
        }

        // сохранить измененные данные
        scope.saveData = function () {
            if (saving) {
                toLogDiv('Всё ещё сохраняю...');
                return;
            }

            console.log('saveData');
            var toSave = [];

            for (var i = 0; i < scope.data.length; i++) {
                if (scope.data[i].needSave) {
                    toSave.push(scope.data[i]);
                }
            }

            if (toSave.length == 0) {
                toLogDiv('Последняя версия данных уже сохранена.');
                return;
            }
            toLogDiv(' Сохраняю...');
            saving = true;

            console.log('toSave.length', toSave.length);
            timeout(function () {
                Solution.save(toSave)
                    .success(function (data) {
                        saving = false;
                        toLogDiv('Сохранено!');
                        for (var i = 0; i < toSave.length; i++) {
                            delete toSave[i].needSave;
                        }
                    })
                    .error(function (data) {
                        console.log('Error while saving.')
                        saving = false;
                    });
            }, 100);
        };

        // вкл/выкл отображение включенных
        scope.toggleChanged = function () {
            $('#toggle-edited-btn').toggleClass('btn-default').toggleClass('btn-success');
            scope.points.showHidden = !scope.points.showHidden;
        };

        // анализироваьт данные
        scope.analyzeData = function () {
            console.log('analyzeData');
            groupButtonsByRadius();
            scope.points.reinit(scope.data);
        };

        // гриппировать мобильные нажатия по радиусу
        function groupButtonsByRadius() {
            var aBtn,
                bBtn,
                maxCount,
                sum,
                tmpLat,
                tmpLon,
                coodsToSort,
                totalCount = 0,
                hiddenCount = 0,
                changedCount = 0,
                doneCount = 0;

            // в первом проходе для каждого нажатия находятся нажатия в радиусе
            for (var i = 0; i < scope.data.length; i++) {
                if (scope.data[i].changed) continue;

                for (var j = 0; j < scope.data[i].coords.length; j++) {
                    aBtn = scope.data[i].coords[j];
                    aBtn.closePointsCount = 0;
                    for (var k = 0; k < scope.data[i].coords.length; k++) {
                        bBtn = scope.data[i].coords[k];
                        if (getDistanceFromLatLonInKm(aBtn.lat, aBtn.lon, bBtn.lat, bBtn.lon) * 1000 <=
                            scope.params.mobilePushRadius) {
                            aBtn.closePointsCount++;
                        }
                    }

                    bBtn = scope.data[i];
                    if (getDistanceFromLatLonInKm(aBtn.lat, aBtn.lon, bBtn.lat, bBtn.lon) * 1000 <=
                        scope.params.mobilePushRadius) {
                        aBtn.closePointsCount++;
                    }
                }
            }

            for (i = 0; i < scope.data.length; i++) {
                if (scope.data[i].hide) hiddenCount++;
                if (scope.data[i].done) doneCount++;

                if (scope.data[i].changed) {
                    changedCount++;
                    continue;
                }

                maxCount = -1;
                // находим максимальное количество нажатий в радиусе
                for (j = 0; j < scope.data[i].coords.length; j++) {
                    aBtn = scope.data[i].coords[j];
                    if (aBtn.closePointsCount > maxCount) {
                        maxCount = aBtn.closePointsCount;
                    }
                }

                for (j = 0; j < scope.data[i].coords.length; j++) {
                    aBtn = scope.data[i].coords[j];
                    // находим нажатие с максимальным количеством нажатий в радиусе
                    if (aBtn.closePointsCount == maxCount) {
                        sum = {
                            count: 0,
                            lat: 0,
                            lon: 0
                        };

                        coodsToSort = [];
                        // находим нажатия в радиусе у нажатия с максимальным количеством нажатий
                        for (k = 0; k < scope.data[i].coords.length; k++) {
                            bBtn = scope.data[i].coords[k];
                            bBtn.inRadius = getDistanceFromLatLonInKm(aBtn.lat, aBtn.lon, bBtn.lat, bBtn.lon) * 1000 <=
                                scope.params.mobilePushRadius;
                            if (bBtn.inRadius) {
                                tmpLat = parseFloat(bBtn.lat);
                                tmpLon = parseFloat(bBtn.lon);

                                sum.count++;
                                sum.lat += tmpLat;
                                sum.lon += tmpLon;

                                coodsToSort.push(bBtn);
                            }
                        }

                        bBtn = scope.data[i];
                        bBtn.inRadius = getDistanceFromLatLonInKm(aBtn.lat, aBtn.lon, bBtn.lat, bBtn.lon) * 1000 <=
                            scope.params.mobilePushRadius;
                        if (bBtn.inRadius) {
                            tmpLat = parseFloat(bBtn.lat);
                            tmpLon = parseFloat(bBtn.lon);

                            sum.count++;
                            sum.lat += tmpLat;
                            sum.lon += tmpLon;

                            coodsToSort.push(bBtn);
                        }

                        sum.lat /= sum.count;
                        sum.lon /= sum.count;

                        scope.data[i].median = findMedianForPoints(coodsToSort);
                        scope.data[i].grouped_coords_length = sum.count;
                        scope.data[i].outGroupPrc = parseFloat(((scope.data[i].coords.length - sum.count) / scope.data[i].coords.length * 100).toFixed(2));
                        scope.data[i].solved = scope.data[i].grouped_coords_length > 1 && scope.data[i].outGroupPrc <= 50;

                        scope.data[i].center = {};
                        scope.data[i].center.lat = sum.lat.toFixed(5);
                        scope.data[i].center.lon = sum.lon.toFixed(5);
                        scope.data[i].new_position = scope.data[i].median;
                        break;
                    }
                }

                if (!scope.data[i].solved && !scope.data[i].hide) {
                    totalCount++;
                }
            }

            //console.log('Проблемных точек', totalCount);
            //console.log('Решенных точек', scope.data.length - totalCount);
            toLogDiv('Данные загружены. Точек требующих вмешательства - ' + totalCount
                //+ ', автоматически решенных точек - ' + (scope.data.length - totalCount)
                + ', готовых - ' + doneCount
                + ', изменено - ' + changedCount
                + ', скрыто - ' + hiddenCount);
            console.log('изменено', changedCount);
            console.log('готово', doneCount);
        }

        // вывести сообщение в лог-див
        function toLogDiv(msg) {
            $('#log-div').text(msg);
        }

        // перобразовать строку объект Date
        function strToTstamp(strDate) {
            var parts = strDate.split(' '),
                _date = parts[0].split('.'),
                _time = parts[1].split(':');

            return new Date(_date[2], _date[1] - 1, _date[0], _time[0], _time[1], _time[2]).getTime() / 1000;
        }

        // найти медиану координат точек
        function findMedianForPoints(points) {
            var coodsToSort = {
                    lat: [],
                    lon: []
                },
                tmpLen,
                median = {};

            for (var i = 0; i < points.length; i++) {
                coodsToSort.lat.push(points[i].lat);
                coodsToSort.lon.push(points[i].lon);
            }

            coodsToSort.lat.sort();
            coodsToSort.lon.sort();

            tmpLen = coodsToSort.lat.length;
            if (tmpLen % 2 == 1) {
                tmpLen = parseInt(tmpLen / 2);
                median.lat = coodsToSort.lat[tmpLen];
                median.lon = coodsToSort.lon[tmpLen];
            } else if (tmpLen > 0) {
                tmpLen = parseInt(tmpLen / 2);
                median.lat = (parseFloat(coodsToSort.lat[tmpLen - 1]) + parseFloat(coodsToSort.lat[tmpLen])) / 2;
                median.lon = (parseFloat(coodsToSort.lon[tmpLen - 1]) + parseFloat(coodsToSort.lon[tmpLen])) / 2;
            }

            if (coodsToSort.lat.length > 0) {
                median.lat = parseFloat(median.lat).toFixed(5);
                median.lon = parseFloat(median.lon).toFixed(5);
            }

            return median;
        }

        // найти новое положение точек
        function findRealPointPosition() {
            var points;
            console.log('findRealPointPosition', scope.data);

            for (var i = 0; i < scope.data.length; i++) {
                points = [];
                for (var j = 0; j < scope.data[i].stops.length; j++) {
                    points.push(scope.data[i].stops[j].median);
                }

                for (j = 0; j < scope.data[i].coords.length; j++) {
                    points.push(scope.data[i].coords[j]);
                }

                // получаем новое положение из медианы стопов точки и ей мобильных нажатий
                scope.data[i].new_position = findMedianForPoints(points);
            }
        }

        // получить дистанцию между двумя координатами в км
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

        function deg2rad(deg) {
            return deg * (Math.PI / 180)
        }

    }]);