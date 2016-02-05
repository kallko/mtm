var express = require('express'),
    router = express.Router(),
    config = require('../config'),
    soap = require('../soap/soap'),
    tracks = require('../tracks'),
    log = new (require('../logging'))('./logs'),
    fs = require('fs'),

    processingSolution = false,
    attemptTimeout = 200,
    tracksManager = new tracks(
        config.aggregator.url,
        config.router.url,
        config.aggregator.login,
        config.aggregator.password);

//fs.readFile('./logs/111.txt', 'utf8', function (err, data) {
//    var lines = data.split('\r\n'),
//        lineParts,
//        counter = 0,
//        resObj = [];
//
//    for (var i = 0; i < lines.length; i++) {
//        lineParts = lines[i].split('\t');
//        counter += lineParts.length;
//
//        resObj.push({
//            id: lineParts[0],
//            lat: lineParts[3] ? parseFloat(lineParts[3].replace(',', '.')) : 0,
//            lon: lineParts[4] ? parseFloat(lineParts[4].replace(',', '.')) : 0,
//            name: lineParts[2],
//            adress: lineParts[1],
//            coords: []
//        });
//    }
//
//    log.toFLog('withoutPushes.js', resObj);
//
//    console.log(lines.length, counter, counter / lines.length);
//});

//fs.readFile('./logs/222.txt', 'utf8', function (err, data) {
//    var lines = data.split('\r\n'),
//        ids = {};
//
//    for (var i = 0; i < lines.length; i++) {
//        ids[lines[i]] = true;
//    }
//
//    fs.readFile('./logs/ids.dsp_solution.json', 'utf8', function (err, data2) {
//        var solution = JSON.parse(data2),
//            newSolution = [];
//
//        console.log('lines', lines.length);
//        console.log('solution', solution.length);
//
//        for (var j = 0; j < solution.length; j++) {
//            if (ids.hasOwnProperty(solution[j].id)) {
//                newSolution.push(solution[j]);
//            }
//        }
//
//        console.log('newSolution', newSolution.length);
//
//        log.toFLog('ids.dsp_solution.json', newSolution);
//    });
//});

// открытие консоли анализа истории и передача ей в качестве index из подпапки acp
router.route('/')
    .get(function (req, res) {
        res.sendFile('index.html', {root: './public/acp/'});
    });


// сохранение логина при запуске из окна 1С
router.route('/login')
    .get(function (req, res) {
        req.session.login = req.query.curuser;
        console.log(req.query.curuser);
        res.sendFile('index.html', {root: './public/acp/'});
    });


// догружает новые данные в уже существующее решение
router.route('/mergesolution')
    .post(function (req, res) {
        console.log('mergesolution');
        fs.readFile('./logs/' + config.soap.defaultClientLogin + '_solution.json', 'utf8', function (err, data) {
            var oldJson = JSON.parse(data),
                newJson = req.body.newData,
                newPoints = [],
                toSaveArr;
            console.log(oldJson.length);
            console.log(newJson.length);

            for (var i = 0; i < newJson.length; i++) {
                if (i % 100 == 0) console.log('i = ', i);
                for (var j = 0; j < oldJson.length; j++) {
                    if (newJson[i].id == oldJson[j].id) {
                        break;
                    }

                    if (j == oldJson.length - 1) {
                        newPoints.push(newJson[i]);
                    }
                }
            }

            console.log('newPoints.length = ', newPoints.length);
            toSaveArr = oldJson.concat(newPoints);
            log.toFLog(config.soap.defaultClientLogin + '_solution.json', toSaveArr);
            res.status(200).json({status: 'merged'});
        });
    });


// сохраняет отдельные части данных в общее решение,
// если сохранение уже происходит, ждет пол секунды и пробует опять
router.route('/savesolution')
    .post(function (req, res) {
        console.log('savesolution', new Date());
        if (!req.body.solution || req.body.solution.length == 0) {
            res.status(200).json({status: 'nothing to save'});
            return;
        }

        var saveSolution = function (solution) {
            if (!processingSolution) {
                console.log('Saving solution...');
                processingSolution = true;
                fs.readFile('./logs/' + config.soap.defaultClientLogin + '_solution.json', 'utf8', function (err, data) {
                    log.toFLog(config.soap.defaultClientLogin + '_' + Date.now() + '_changes.json', solution);

                    if (err) {
                        res.status(200).json({error: err});
                        console.log(err);
                        return err;
                    } else {
                        try {
                            var jsonData = JSON.parse(data),
                                toSave = solution,
                                savedCount = 0;
                            for (var i = 0; i < jsonData.length; i++) {
                                for (var j = 0; j < toSave.length; j++) {
                                    if (jsonData[i].id == toSave[j].id) {
                                        savedCount++;
                                        delete toSave[j].needSave;
                                        jsonData[i] = toSave[j];
                                        break;
                                    }
                                }
                            }

                            log.toFLog(config.soap.defaultClientLogin + '_solution.json', jsonData);
                            res.status(200).json({status: 'saved'});
                        } catch (e) {
                            console.log(e);
                            res.status(500).json({status: 'error'});
                        }

                        processingSolution = false;
                    }
                });
            } else {
                console.log('Waiting for unlock...');
                setTimeout(saveSolution, attemptTimeout, solution);
            }
        };

        saveSolution(req.body.solution);
    });

router.route('/savebigsol')
    .post(function (req, res) {
        console.log('savebigsol');
        log.toFLog(config.soap.defaultClientLogin + '_BigSolution.json', req.body.solution);
        res.status(200).json({status: 'saved'});
    });

// получить решение исключая из него все измененные и готовые точки
router.route('/loadsolution')
    .get(function (req, res) {
        console.log('loadsolution for ', config.soap.defaultClientLogin);

        var loadSolution = function (_res) {
            if (!processingSolution) {
                processingSolution = true;
                fs.readFile('./logs/' + config.soap.defaultClientLogin + '_solution.json', 'utf8', function (err, data) {
                    if (err) {
                        console.log(err);
                        return err;
                    } else {
                        console.log('Done!');

                        //// кусок для формирования json загружаемого в 1С для обновления координат
                        //var newJson = [],
                        //    _json = JSON.parse(data);
                        //console.log(_json.length);
                        //for (var i = 0; i < _json.length; i++) {
                        //    if (_json[i].solved || _json[i].changed) {
                        //        newJson.push({
                        //            id: _json[i].id,
                        //            new_position: _json[i].new_position
                        //        });
                        //    }
                        //}
                        //
                        //log.toFLog('brand_new_json.json', newJson);

                        var json = JSON.parse(data),
                            toSend = [];

                        for (var i = 0; i < json.length; i++) {
                            if (!json[i].solved && json[i].lat && json[i].lon
                                && json[i].coords && json[i].coords.length > 0) {
                                if (json[i].changed || json[i].done) {
                                    json[i].hide = true;
                                }
                                toSend.push(json[i]);
                            }
                        }

                        processingSolution = false;
                        _res.status(200).json(toSend);
                    }
                });
            } else {
                setTimeout(loadSolution, attemptTimeout, _res);
            }
        };
        loadSolution(res);

    });

// получить стопы по конкретному гиду машины за конкретный период времени
router.route('/getstops/:gid/:from/:to')
    .get(function (req, res) {
        fs.readFile('./logs/' + req.params.gid + '_' + req.params.from + '_' + req.params.to + '.json', 'utf8', function (err, data) {
            if (err) {
                tracksManager.getStops(req.params.gid, req.params.from, req.params.to, function (data) {
                    log.toFLog(req.params.gid + '_' + req.params.from + '_' + req.params.to + '.json', data);
                    res.status(200).json({gid: req.params.gid, data: data});
                });
            } else {
                res.status(200).json({gid: req.params.gid, data: JSON.parse(data)});
            }
        });
    });

// получить трек по конкретному гиду машины за конкретный период времени
router.route('/gettracks/:gid/:from/:to')
    .get(function (req, res) {
        console.log('gettracks');
        tracksManager.getTrackPart(req.params.gid, req.params.from, req.params.to, function (data) {
            res.status(200).json({gid: req.params.gid, data: data});
        });
    });

// получить список сенсоров (устройств передающих треки) по авторизированному пользователю
router.route('/getsensors')
    .get(function (req, res) {
        console.log('getsensors');
        var soapManager = new soap(config.soap.defaultClientLogin);
        soapManager.getAllSensors(function (data) {
            res.status(200).json(data);
        });
    });

// загрузить план на конкретную дату
router.route('/getplan/:timestamp')
    .get(function (req, res) {
        var fileName = './logs/' + config.soap.defaultClientLogin + '_' + req.params.timestamp + '.json';
        fs.readFile(fileName, 'utf8', function (err, data) {
            if (err) {
                console.log('load plan for ' + config.soap.defaultClientLogin + ', date = ' + new Date(req.params.timestamp * 1000));
                var soapManager = new soap(config.soap.defaultClientLogin);
                soapManager.getPlanByDate(req.params.timestamp, function (plan) {
                    log.toFLog(config.soap.defaultClientLogin + '_' + req.params.timestamp + '.json', plan);
                    res.status(200).json(plan);
                });
            } else {
                console.log('load plan FROM CACHE for ' + config.soap.defaultClientLogin + ', date = ' + new Date(req.params.timestamp * 1000));
                res.status(200).json(JSON.parse(data));
            }
        });
    });

module.exports = router;