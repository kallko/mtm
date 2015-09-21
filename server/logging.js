module.exports = Log;
var fs = require('fs');

function Log() {

}

Log.prototype.dump = function(obj) {
  console.log(JSON.stringify(obj, null, 2));
};

log.prototype.toFLog = function(path, data) {
  fs.writeFile(path, JSON.stringify(data, null, 2), function(err) {
      if(err) {
          return console.log(err);
      }

      console.log("The file was saved to " + path + "!");
  });
}

