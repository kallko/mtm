module.exports = XMLConstructor;

function XMLConstructor() {
    this.xml = {
        begin: '<?xml version="1.0" encoding="UTF-8"?><MESSAGE xmlns="http://sngtrans.com.ua">'
        , end: '</MESSAGE>'
        , instructions: {
            begin: '<INSTRUCTIONS>'
            , end: '</INSTRUCTIONS>'
        }
        , instruction: {
            begin: '<INSTRUCTION>'
            , daily_plan: '<INSTRUCTION NAME="GET_DAILY_PLANS" >'
            , itinerary_new: '<INSTRUCTION NAME="GET_ITINERARY_NEW" >'
            , itinerary: '<INSTRUCTION NAME="GET_ITINERARY" >'
            , transports: '<INSTRUCTION NAME="GET_LIST_OF_DATA"><PARAMETER KEY="TARGET" VALUE="TRANSPORTS" />'
            , drivers: '<INSTRUCTION NAME="GET_LIST_OF_DATA"><PARAMETER KEY="TARGET" VALUE="DRIVERS" />'
            , waypoints: '<INSTRUCTION NAME="GET_LIST_OF_DATA"><PARAMETER KEY="TARGET" VALUE="WAYPOINTS" />'
            , sensors: '<INSTRUCTION NAME="GET_LIST_OF_DATA"><PARAMETER KEY="TARGET" VALUE="SENSORS" />'
            , jobs: '<INSTRUCTION NAME="GET_STATUS_OF_TASK">'
            , end: '</INSTRUCTION>'
        }
        , parameter: {
            begin: '<PARAMETER'
        }
        , slashEnd: '/>'
        , setGetValue: function (key, value) {
            return ' KEY="' + key + '" VALUE="' + value + '" ';
        }
        , addParameter: function(key, value) {
            return this.parameter.begin +
                this.setGetValue(key, value) +
                this.slashEnd;
        }
        , addAttribute: function(key, value) {
            return ' ' + key + '="' + value + '" ';
        }
    };
}

XMLConstructor.prototype.getTodayStr = function (timestamp) {
    var date = new Date(timestamp);
    return ( ("0" + date.getDate())).slice(-2) + '.' +
        ("0" + (date.getMonth() + 1)).slice(-2) + '.' +
        date.getFullYear();
};

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

    str += this.xml.instructions.end;
    str += this.xml.end;
    return str;
};

XMLConstructor.prototype.taskXML = function (taskNumber, taskDate) {
    var str = '';
    str += this.xml.begin;
    str += this.xml.instructions.begin;

    str += this.xml.instruction.jobs;
    str += this.xml.parameter.begin;
    str += this.xml.setGetValue('NUMBER', taskNumber);
    str += this.xml.slashEnd;
    str += this.xml.parameter.begin;
    str += this.xml.setGetValue('DATE', taskDate);
    str += this.xml.slashEnd;
    str += this.xml.instruction.end;

    str += this.xml.instructions.end;
    str += this.xml.end;
    return str;
};

XMLConstructor.prototype.allSensorsXML = function() {
    var str = '';
    str += this.xml.begin;
    str += this.xml.instructions.begin;

    str += this.xml.instruction.sensors;
    str += this.xml.instruction.end;

    str += this.xml.instructions.end;
    str += this.xml.end;
    return str;
};

XMLConstructor.prototype.add

XMLConstructor.prototype.routesXML = function(routes, login) {
    if (routes.length == 0) return;

    console.log(login);
    var str = '',
        point,
        itineraries = {},
        tmpGeometry;

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
    str += this.xml.addParameter('login', login);
    str += '<ITINERARIES_UPDATE>';
    for (var key in itineraries){
        if (!itineraries.hasOwnProperty(key)) continue;

        routes = itineraries[key].routes;
        str += '<ITINERARY_UPDATE ';
        str += this.xml.addAttribute('ID', key);
        str += this.xml.addAttribute('UPDATE_TIME', itineraries[key].change_timestamp);
        str += ' >';
        str += '<ROUTES>';
        for (i = 0; i < routes.length; i++) {
            str += '<ROUTE ';
            str += this.xml.addAttribute('ID', routes[i].routesID);
            str += this.xml.addAttribute('NUMBER', routes[i].routeNumber);
            str += this.xml.addAttribute('TRANSPORT', routes[i].transportID);
            str += this.xml.addAttribute('DRIVER', '');
            str += this.xml.addAttribute('START_TIME', '');
            str += this.xml.addAttribute('END_TIME', '');
            str += this.xml.addAttribute('VALUE', '');
            str += this.xml.addAttribute('DISTANCE', '');
            str += this.xml.addAttribute('TIME', '');
            str += this.xml.addAttribute('NUMBER_OF_TASKS', '');
            str += ' >';

            str += '<SECTIONS>';
            for (var j = 0; j < routes[i].points.length; j++) {
                point = routes[i].points[j];
                str += '<SECTION ';
                str += this.xml.addAttribute('TASK_NUMBER', point.taskNumber);
                str += this.xml.addAttribute('NUMBER', point.stepNumber);
                str += this.xml.addAttribute('ARRIVAL_TIME', point.arrivalTime);
                str += this.xml.addAttribute('START_WAYPOINT', point.startWaypointId);
                str += this.xml.addAttribute('END_WAYPOINT', point.endWaypointId);
                str += this.xml.addAttribute('TASK_TIME', point.taskTime);
                str += this.xml.addAttribute('DOWNTIME', point.downtime);
                str += this.xml.addAttribute('TRAVEL_TIME', point.travelTime);
                str += this.xml.addAttribute('DISTANCE', point.distance);
                str += this.xml.addAttribute('START_TIME', '');
                str += this.xml.addAttribute('END_TIME', '');
                str += this.xml.addAttribute('TASK_DATE', '');
                str += this.xml.addAttribute('WEIGHT', '');
                str += this.xml.addAttribute('VOLUME', '');
                str += ' >';


                tmpGeometry = [];
                for (var k = 0; k < point.geometry.length; k++) {
                    tmpGeometry.push([point.geometry[k], point.geometry[k + 1]]);
                    k++
                }
                
                str += '<GEOMETRY>';
                str += JSON.stringify(tmpGeometry);
                str += '</GEOMETRY>';

                str += '</SECTION>';
            }
            str += '</SECTIONS>';
            str += '</ROUTE>';
        }
        str += '</ROUTES>';
        str += '</ITINERARY_UPDATE>';

    }
    str += '</ITINERARIES_UPDATE>';
    str += this.xml.end;


    return str;
};