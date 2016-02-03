module.exports = Log;
var fs = require('fs');

// класс для логирования, который часто используется для сохранения всего и вся
function Log(path) {
    this.folder = path;
}

// выводит развернутый объект любой вложенносьти в консоль
Log.prototype.dump = function (obj) {
    console.log(JSON.stringify(obj, null, 2));
};

// сохраняет в файл переданные данные (в формате json, или же как есть)
Log.prototype.toFLog = function (name, data, toJson) {
    toJson = typeof toJson !== 'undefined' ? toJson : true;
    var me = this;
    fs.writeFile(me.folder + '/' + name, toJson ? JSON.stringify(data, null, 2) : data,
        function (err) {
            if (err) {
                return console.log(err);
            }

            console.log("The " + name + " was saved to " + me.folder + "!\n");
        });
};

// обычный лог
Log.prototype.l = function (obj) {
    console.log(obj);
};

