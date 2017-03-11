module.exports = Log;
var fs = require('fs');
var lastUpdate;

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

Log.prototype.toFLogAppend = function (name, data, toJson) {
    toJson = typeof toJson !== 'undefined' ? toJson : true;
    var me = this;
    fs.appendFile(me.folder + '/' + name, toJson ? JSON.stringify(data, null, 2) : data,
        function (err) {
            if (err) {
                return console.log(err);
            }

            console.log("The " + name + " was saved to " + me.folder + "!\n");
        });
};

Log.prototype.logger = function (name, data, toJson) {
    var d = new Date();
    d.setDate(d.getDate()-2);
    var me = this;
    var oldName = name + ("" + d).substring(0,10) + ".txt";
    fs.stat(me.folder+'/'+ oldName, function(err, stats){
        if(err) {
            //console.log (err);
        }
        if (stats != undefined && stats.isFile) {
            console.log("Найден файл логирования 2-х дневной давности");
            fs.unlink(me.folder+'/'+ oldName);
        }
    });


    toJson = typeof toJson !== 'undefined' ? toJson : true;

    fs.appendFile(me.folder + '/' + name, toJson ? JSON.stringify(data, null, 2) : data,
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

Log.prototype.info = function () {
    //console.log("Пришел ли 2 параметр", obj1==null);
    var me = this;
    var result ="";
    var preString;
    for (var i=0; i<arguments.length; i++){
        if (arguments[i] == undefined) {
            preString = "undefined";
            result+= preString+" ";
            continue;
        }
        if (typeof (arguments[i]) == 'number') {
            preString = ""+ arguments[i];
            result+= preString+" ";
            continue;
        }
        if (arguments[i] != null ) {
            preString=JSON.stringify(arguments[i]);
            if (preString == 'true' || preString == 'false') {
                result+= preString+" ";
                continue;}
            //console.log("argument ", preString);
            if (preString.length>1) {

                preString = preString.substring(1, preString.length-1);

            }
        } else {
            preString =''}
        //console.log("result ", preString);
        result+= preString+" ";
    }




    var today = new Date().getDate();
    if (today != lastUpdate) {
        lastUpdate = today;
        var d = new Date();
        d.setDate(d.getDate()-2);
        var name2 = "log_" + d.getDate()+"_" + d.getMonth() + "_" + d.getFullYear();
        fs.stat(me.folder+'/'+ name2, function(err, stats){
            if(err) {
                //console.log (err);
            }
            if (stats != undefined && stats.isFile) {
                console.log("Найден файл 2-х дневной давности");
                //fs.unlink(me.folder+'/'+ name2).then(console.log("ok"), console.log("Not ok"));
            }
        });
    }

    var name ="log_" + new Date().getDate()+"_" + new Date().getMonth() + "_" + new Date().getFullYear();
    console.log(result);
    fs.appendFile(me.folder + '/' + name, '\n' + result, function(err){
        if (err) console.log("Какая-та хрень, не могу файл записать. Наверное, место на диске кончилось", err);
    })

};

Log.prototype.error = function (text){
    var me = this;


    fs.appendFile(me.folder + '/' + 'errors.txt', '\n'+ new Date() + " " +  text, function(err){
        if (err) console.log("Какая-та хрень, не могу файл записать. Наверное, место на диске кончилось", err);
    })

};
