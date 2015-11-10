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
            //, itinerary:    '<INSTRUCTION NAME="GET_ITINERARY_NEW" >'
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

XMLConstructor.prototype.itineraryXML = function (id, version) {
    var str = '';
    str += this.xml.begin;
    str += this.xml.instructions.begin;
    str += this.xml.instruction.itinerary;

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

XMLConstructor.prototype.routesXML = function(routes) {
    if (routes.length == 0) return;

    var str = '',
        point,
        itineraries = {};

    for (var i = 0; i < routes.length; i++) {
        if (!itineraries[routes[i].itineraryID]) {
            itineraries[routes[i].itineraryID] = [];
        }

        itineraries[routes[i].itineraryID].push(routes[i]);
    }

    str += this.xml.begin;
    str += '<ITINERARIES>';
    for (var key in itineraries){
        if (!itineraries.hasOwnProperty(key)) continue;

        routes = itineraries[key];
        str += '<ITINERARY>';
        str += this.xml.addParameter('ID', key);
        str += '<ROUTES>';
        for (i = 0; i < routes.length; i++) {
            str += '<ROUTE>';
            str += this.xml.addParameter('routesID', routes[i].routesID);
            str += this.xml.addParameter('routeNumber', routes[i].routeNumber);
            str += this.xml.addParameter('changeTime', routes[i].change_timestamp);
            str += this.xml.addParameter('transportID', routes[i].transportID);

            str += '<SECTIONS>';
            for (var j = 0; j < routes[i].points.length; j++) {
                point = routes[i].points[j];
                str += '<SECTION>';
                str += this.xml.addParameter('taskNumber', point.taskNumber);
                str += this.xml.addParameter('stepNumber', point.stepNumber);
                str += this.xml.addParameter('arrivalTime', point.arrivalTime);
                str += this.xml.addParameter('startWaypointId', point.startWaypointId);
                str += this.xml.addParameter('endWaypointId', point.endWaypointId);
                str += this.xml.addParameter('taskTime', point.taskTime);
                str += this.xml.addParameter('downtime', point.downtime);
                str += this.xml.addParameter('travelTime', point.travelTime);
                str += this.xml.addParameter('distance', point.distance);

                str += '<GEOMETRY>';
                str += JSON.stringify(point.geometry);
                str += '</GEOMETRY>';

                str += '</SECTION>';
            }
            str += '</SECTIONS>';
            str += '</ROUTE>';
        }
        str += '</ROUTES>';
        str += '</ITINERARY>';

    }
    str += '</ITINERARIES>';
    str += this.xml.end;


    return str;
};