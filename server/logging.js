module.exports = Log;
var fs = require('fs');

function Log(path) {
    this.folder = path;
}

Log.prototype.dump = function (obj) {
    console.log(JSON.stringify(obj, null, 2));
};

Log.prototype.toFLog = function (name, data) {
    var me = this;
    fs.writeFile(me.folder + '/' + name, JSON.stringify(data, null, 2), function (err) {
        if (err) {
            return console.log(err);
        }

        console.log("The " + name + " was saved to " + me.folder + "!");
    });
};

Log.prototype.l = function (obj) {
    console.log(obj);
} ;

