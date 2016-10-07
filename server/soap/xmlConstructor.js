var log = new (require('../logging'))('./logs');
module.exports = XMLConstructor;

// конструктор xml запросов
function XMLConstructor() {
    this.xml = {
        begin: '<?xml version="1.0" encoding="UTF-8"?><MESSAGE xmlns="http://sngtrans.com.ua">'  // заголовок
        , end: '</MESSAGE>'
        , instructions: {
            begin: '<INSTRUCTIONS>'
            , end: '</INSTRUCTIONS>'
        }
        , instruction: {
            begin: '<INSTRUCTION>'
            , daily_plan: '<INSTRUCTION NAME="GET_DAILY_PLANS" >'  // получение списка id решений на указанный день
            , itinerary_new: '<INSTRUCTION NAME="GET_ITINERARY_NEW" >' // получить конкретное решение нового типа
            , itinerary: '<INSTRUCTION NAME="GET_ITINERARY" >' // получить конкретное решение старого типа
            , transports: '<INSTRUCTION NAME="GET_LIST_OF_DATA"><PARAMETER KEY="TARGET" VALUE="TRANSPORTS" />'  // получение списка машин
            , drivers: '<INSTRUCTION NAME="GET_LIST_OF_DATA"><PARAMETER KEY="TARGET" VALUE="DRIVERS" />'  // получение списка водителей
            , waypoints: '<INSTRUCTION NAME="GET_LIST_OF_DATA"><PARAMETER KEY="TARGET" VALUE="WAYPOINTS" />'  // получение расширенного списка точек по маршруту
            , sensors: '<INSTRUCTION NAME="GET_LIST_OF_DATA"><PARAMETER KEY="TARGET" VALUE="SENSORS" />' // получение списка сенсоров
            , reasons: '<INSTRUCTION NAME="GET_LIST_OF_DATA"><PARAMETER KEY="TARGET" VALUE="REASONS_FAILURE" />' //поллучения есписка причин отмены
            , jobs: '<INSTRUCTION NAME="GET_STATUS_OF_TASK">'  //  получить статус задачи
            , end: '</INSTRUCTION>'
        }
        , parameter: {
            begin: '<PARAMETER'
        }
        , slashEnd: '/>'
        , setGetValue: function (key, value) {
            return ' KEY="' + key + '" VALUE="' + value + '" ';
        }
        , addParameter: function (key, value) {
            return this.parameter.begin +
                this.setGetValue(key, value) +
                this.slashEnd;
        }
        , addAttribute: function (key, value) {
            return ' ' + key + '="' + value + '" ';
        }
    };
}

// строка формата 1С по указанной дате
XMLConstructor.prototype.getTodayStr = function (timestamp) {
    var date = new Date(timestamp);
    return ( ("0" + date.getDate())).slice(-2) + '.' +
        ("0" + (date.getMonth() + 1)).slice(-2) + '.' +
        date.getFullYear();
};

// xml для получения списка id решений на указанную дату
XMLConstructor.prototype.dailyPlanXML = function (timestamp) {
    var str = '';
    str += this.xml.begin;
    str += this.xml.instructions.begin;
    str += this.xml.instruction.daily_plan;

    str += this.xml.parameter.begin;
    str += this.xml.setGetValue('DATE', this.getTodayStr(timestamp));
    str += this.xml.slashEnd;

    str += this.xml.instruction.end;
    str += this.xml.instructions.end;
    str += this.xml.end;
    return str;
};

// xml для получения решения по id
XMLConstructor.prototype.itineraryXML = function (id, version, newItinerary) {
    var str = '';
    str += this.xml.begin;
    str += this.xml.instructions.begin;
    str += newItinerary ? this.xml.instruction.itinerary_new : this.xml.instruction.itinerary;

    str += this.xml.parameter.begin;
    str += this.xml.setGetValue('ID', id);
    str += this.xml.slashEnd;

    str += this.xml.parameter.begin;
    str += this.xml.setGetValue('ID_REQUEST', parseInt(id));
    str += this.xml.slashEnd;

    str += this.xml.instruction.end;
    str += this.xml.instructions.end;
    str += this.xml.end;
    return str;
};

// xmk для получения дополнительных данных по решению
XMLConstructor.prototype.additionalDataXML = function (routeid) {
    var str = '';
    str += this.xml.begin;
    str += this.xml.instructions.begin;

    str += this.xml.instruction.transports;
    str += this.xml.instruction.end;
    str += this.xml.instruction.drivers;
    str += this.xml.instruction.end;
    str += this.xml.instruction.waypoints;
    str += this.xml.parameter.begin;
    str += this.xml.setGetValue('IDROUTE', routeid);
    str += this.xml.slashEnd;
    str += this.xml.instruction.end;
    str += this.xml.instruction.sensors;
    str += this.xml.instruction.end;
    str += this.xml.instruction.reasons;
    str += this.xml.instruction.end;

    str += this.xml.instructions.end;
    str += this.xml.end;
    return str;
};

// xml для получения списка всех сенсоров
XMLConstructor.prototype.allSensorsXML = function () {
    var str = '';
    str += this.xml.begin;
    str += this.xml.instructions.begin;

    str += this.xml.instruction.sensors;
    str += this.xml.instruction.end;

    str += this.xml.instructions.end;
    str += this.xml.end;
    return str;
};



// xml для сохранения маршрута в 1С
XMLConstructor.prototype.routesXML = function (routes, login) {
    if (routes.length == 0) return;

    console.log(login);
    var str = '',
        point,
        itineraries = {},
        tmpGeometry,
        coords;

    // создание списка решений, изменения в которых, будут сохранены в 1С
    // и сохранение самого позднего времени сохранения
    for (var i = 0; i < routes.length; i++) {
        if (!itineraries[routes[i].itineraryID]) {
            itineraries[routes[i].itineraryID] = {
                routes: [],
                change_timestamp: 0
            };
        }

        itineraries[routes[i].itineraryID].routes.push(routes[i]);
        itineraries[routes[i].itineraryID].change_timestamp = itineraries[routes[i].itineraryID].change_timestamp < routes[i].change_timestamp ?
            routes[i].change_timestamp : itineraries[routes[i].itineraryID].change_timestamp;
    }

    str += this.xml.begin;
    str += '<ITINERARIES_UPDATE>';
    for (var key in itineraries) {
        if (!itineraries.hasOwnProperty(key)) continue;

        routes = itineraries[key].routes;
        str += '<ITINERARY_UPDATE ';
        str += this.xml.addAttribute('USER', login);
        str += this.xml.addAttribute('ID', key);
        str += this.xml.addAttribute('UPDATE_TIME', itineraries[key].change_timestamp);
        str += ' >';
        str += '<ROUTES>';
        for (i = 0; i < routes.length; i++) {
            str += '<ROUTE ';
            str += this.xml.addAttribute('ID', routes[i].routesID);
            str += this.xml.addAttribute('NUMBER', routes[i].routeNumber);
            str += this.xml.addAttribute('TRANSPORT', routes[i].transportID);
            str += this.xml.addAttribute('DRIVER', routes[i].driver);
            str += this.xml.addAttribute('START_TIME', routes[i].startTime);
            str += this.xml.addAttribute('END_TIME', routes[i].endTime);
            str += this.xml.addAttribute('VALUE', routes[i].value);
            str += this.xml.addAttribute('DISTANCE', routes[i].distance);
            str += this.xml.addAttribute('TIME', routes[i].time);
            str += this.xml.addAttribute('NUMBER_OF_TASKS', routes[i].numberOfTasks);
            str += ' >';

            for (var j = 0; j < routes[i].points.length; j++) {
                point = routes[i].points[j];
                str += '<SECTION ';
                str += this.xml.addAttribute('TASK_NUMBER', point.taskNumber < 0 ? '' : point.taskNumber);
                str += this.xml.addAttribute('NUMBER', point.stepNumber);
                str += this.xml.addAttribute('ARRIVAL_TIME', point.arrivalTime);
                str += this.xml.addAttribute('START_WAYPOINT', point.startWaypointId);
                str += this.xml.addAttribute('END_WAYPOINT', point.endWaypointId);
                str += this.xml.addAttribute('TASK_TIME', parseInt(point.taskTime));
                str += this.xml.addAttribute('DOWNTIME', parseInt(point.downtime));
                str += this.xml.addAttribute('TRAVEL_TIME', parseInt(point.travelTime));
                str += this.xml.addAttribute('DISTANCE', parseInt(point.distance));
                str += this.xml.addAttribute('START_TIME', parseInt(point.startTime));
                str += this.xml.addAttribute('END_TIME', parseInt(point.endTime));
                str += this.xml.addAttribute('TASK_DATE', point.taskDate);
                str += this.xml.addAttribute('WEIGHT', parseInt(point.weight));
                str += this.xml.addAttribute('VOLUME', parseInt(point.volume));

                tmpGeometry = [];
                if (point.geometry != undefined) {
                    for (var k = 0; k < point.geometry.length; k++) {
                        coords = point.geometry[k].split(',');
                        coords[0] = parseFloat(coords[0]);
                        coords[1] = parseFloat(coords[1]);
                        tmpGeometry.push(coords);
                    }
                }

                str += this.xml.addAttribute('TRACK', JSON.stringify(tmpGeometry));
                str += ' />';
            }
            str += '</ROUTE>';
        }
        str += '</ROUTES>';
        str += '</ITINERARY_UPDATE>';

    }
    str += '</ITINERARIES_UPDATE>';
    str += this.xml.end;


    return str;
};

// xml для записи в 1С новых координат точки
XMLConstructor.prototype.waypointNewCoordXML = function (waypoint, login) {
    //console.log("Constructor in process, and waypoint is", waypoint);
    var str = '';
    str += this.xml.begin;
    str += '<WAYPOINTS> <WAYPOINT ACTION="AUTO" ';
    str += 'ID="'+ waypoint.waypoint.ID + '" ';
    str += 'LAT="' + waypoint.waypoint.LAT + '" ';
    str += 'LON="' + waypoint.waypoint.LON + '" ';
    str += 'CONFIRMBYGPS="'+waypoint.confirm + '" ';
    str += ' /> </WAYPOINTS>'
    str += this.xml.end;
    console.log("XML Constructor res=", str);
    return str;
};

XMLConstructor.prototype.getOldDay = function (date) {
    return '<?xml version="1.0" encoding="UTF-8"?><MESSAGE xmlns="http://sngtrans.com.ua"><INSTRUCTIONS><INSTRUCTION NAME="GET_CLOSE_DAY"><PARAMETER KEY="CLOSEDATA" VALUE="'+date+'" /></INSTRUCTION></INSTRUCTIONS></MESSAGE>';
};