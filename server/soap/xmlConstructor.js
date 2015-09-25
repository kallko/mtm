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
            // , itinerary:    '<INSTRUCTION NAME="GET_ITINERARY_NEW" >'
            , itinerary: '<INSTRUCTION NAME="GET_ITINERARY" >'
            , transports: '<INSTRUCTION NAME="GET_LIST_OF_DATA"><PARAMETER KEY="TARGET" VALUE="TRANSPORTS" />'
            , drivers: '<INSTRUCTION NAME="GET_LIST_OF_DATA"><PARAMETER KEY="TARGET" VALUE="DRIVERS" />'
            , waypoints: '<INSTRUCTION NAME="GET_LIST_OF_DATA"><PARAMETER KEY="TARGET" VALUE="WAYPOINTS" />'
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
    };
}

XMLConstructor.prototype.getTodayStr = function () {
    var date = new Date();
    return ( ("0" + date.getDate())).slice(-2) + '.' +
        ("0" + (date.getMonth() + 1)).slice(-2) + '.' +
        date.getFullYear();
};

XMLConstructor.prototype.dailyPlanXML = function () {
    var str = '';
    str += this.xml.begin;
    str += this.xml.instructions.begin;
    str += this.xml.instruction.daily_plan;

    str += this.xml.parameter.begin;
    str += this.xml.setGetValue('DATE', this.getTodayStr());
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
