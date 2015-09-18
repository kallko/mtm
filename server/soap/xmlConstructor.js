module.exports = XMLConstructor;

function XMLConstructor(){
  this.xml = {
      begin : '<?xml version="1.0" encoding="UTF-8"?><MESSAGE xmlns="http://sngtrans.com.ua">'
    , end   : '</MESSAGE>'
    , instructions : {
          begin:  '<INSTRUCTIONS>'
        , end:    '</INSTRUCTIONS>'
      }
    , instruction : {
          begin:        '<INSTRUCTION>'
        , daily_plan:   '<INSTRUCTION NAME="GET_DAILY_PLANS" >'
        , end:          '</INSTRUCTION>'
      }
    , parameter : {
          begin : '<PARAMETER'
      }
    , slashEnd  : '/>'
    , setGetValue : function(key, value){
        return ' KEY="' + key + '" VALUE="' + value + '" ';
      }
  };
}

XMLConstructor.prototype.dailyPlanXML = function(){
  var str = '';
  str += this.xml.begin;
  str += this.xml.instructions.begin;
  str += this.xml.instruction.daily_plan;

  str += this.xml.parameter.begin;
  str += this.xml.setGetValue('DATE', '18.09.2015');
  str += this.xml.slashEnd;

  str += this.xml.instruction.end;
  str += this.xml.instructions.end;
  str += this.xml.end;
  return str;
};
