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
    console.log("Start Logger");
    var d = new Date();
    d.setDate(d.getDate()-2);
    var me = this;
    console.log(me, "me");
    var oldName = 'login-log ' + ("" + d).substring(0,10) + ".txt";
    console.log("OldName", me.folder);
    fs.stat(me.folder+'/'+ oldName, function(err, stats){
        if(err) {
            console.log (err);
        }
        if (stats != undefined && stats.isFile) {
            console.log("Найден файл логирования 2-х дневной давности");
            fs.unlink(me.folder+'/'+ name2);
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
                fs.unlink(me.folder+'/'+ name2);
            }
        });
    }
    //if ( typeof (obj) != 'string')obj=JSON.stringify(obj);
    ////console.log ("Получено", obj, obj1, obj2, obj3, obj4, obj5, obj6, obj7, obj8, obj9);
    //if (obj1 != null ) obj1=JSON.stringify(obj1); else obj1 ='';
    //if (obj2 != null ) obj2=JSON.stringify(obj2); else obj2 ='';
    //if (obj3 != null ) obj3=JSON.stringify(obj3); else obj3 ='';
    //if (obj4 != null ) obj4=JSON.stringify(obj4); else obj4 ='';
    //if (obj5 != null ) obj5=JSON.stringify(obj5); else obj5 ='';
    //if (obj6 != null ) obj6=JSON.stringify(obj6); else obj6 ='';
    //if (obj7 != null ) obj7=JSON.stringify(obj7); else obj7 ='';
    //if (obj8 != null ) obj8=JSON.stringify(obj8); else obj8 ='';
    //if (obj9 != null ) obj9=JSON.stringify(obj9); else obj9 ='';
    //
    //obj = obj1 != undefined ? obj+" " +obj1 :obj;
    //obj = obj2 != undefined ? obj+" " +obj2 :obj;
    //obj = obj3 != undefined ? obj+" " +obj3 :obj;
    //obj = obj4 != undefined ? obj+" " +obj4 :obj;
    //obj = obj5 != undefined ? obj+" " +obj5 :obj;
    //obj = obj6 != undefined ? obj+" " +obj6 :obj;
    //obj = obj7 != undefined ? obj+" " +obj7 :obj;
    //obj = obj8 != undefined ? obj+" " +obj8 :obj;
    //obj = obj9 != undefined ? obj+" " +obj9 :obj;

    //console.log(obj);

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
