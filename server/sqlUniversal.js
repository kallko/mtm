/**
 * Created by dev-2 on 07.02.17.
 */

//SELECT *
//FROM public.sessions
//WHERE shift_id = 16423
//ORDER BY shift_id DESC
//LIMIT 1


"use strict";
    var pgp = require("pg-promise")(/*options*/),
        db = pgp("postgres://postgres:postgres@localhost:5432/test");
    var
        colors = require('colors');
        colors.supportsColor = true;
        colors.enabled = true;

    var companys=[];

    var dict = {
        '&&': 'AND',
        '||': 'OR',
        'dispatchers': 'public."dispatchers" ',
        'shifts': 'public.shifts',
        'sessions': 'public.sessions',
        'actions': 'public.action_kinds',
        'from': 'FROM',
        'data': 'VALUES (',
        'set': 'SET',
        'if': 'WHERE',
        '==': '=',
        "=":'=',
        ",": ',',
        "in": 'INNER JOIN'
    };

module.exports = SqlUniversal;

function SqlUniversal (){
    console.log("Establish  DB Connection".green);
    if (companys.length == 0) execute("First Load Company", 'SELECT DISTINCT company FROM public."dispatchers" ', firstConnect);
}

SqlUniversal.prototype.lastRowLoad = function (company){
    var request = "SELECT * FROM ";
    var adding = '';
    var stringAdd ='';


    console.log("Company", company);
    for (var i = 1; i < arguments.length; i++){
        if(typeof (arguments[i]) == "function") {
            var  callback = arguments[i];
            break;
        }
        stringAdd ='';
        if (!arguments[i+1] &&
            !dict[arguments[i+1]] &&
            dict[arguments[i+1]] != '=' &&
            !dict[arguments[i]] && parseInt(arguments[i]) != arguments[i]) stringAdd = "'" + arguments[i] + "',";
        adding = dict[arguments[i]] || (stringAdd) || (arguments[i]);
        request  += adding +" ";
    }

    //request  +="'";
    console.log("Request".yellow, request);
    //execute("simpleLoad", request, callback)


};


SqlUniversal.prototype.simpleLoad = function (company){
    var request = "SELECT * FROM ";
    var adding = '';
    var stringAdd ='';


    console.log("Company", company);
    for (var i = 1; i < arguments.length; i++){
        if(typeof (arguments[i]) == "function") {
            var  callback = arguments[i];
            break;
        }
        stringAdd ='';
        if (!arguments[i+1] &&
            !dict[arguments[i+1]] &&
            dict[arguments[i+1]] != '=' &&
            !dict[arguments[i]] && parseInt(arguments[i]) != arguments[i]) stringAdd = "'" + arguments[i] + "',";
        adding = dict[arguments[i]] || (stringAdd) || (arguments[i]);
        request  += adding +" ";
    }

    //request  +="'";
    console.log("Request".yellow, request);
    execute("simpleLoad", request, callback)


};



SqlUniversal.prototype.add = function (company){
    var request = "INSERT INTO ";
    var adding = '';
    var stringAdd ='';

    for (var i = 1; i < arguments.length; i++){
        if(typeof (arguments[i]) == "function") {
            var  callback = arguments[i];
            break;
        }
        stringAdd ='';
        console.log("this is argument", i, " ", arguments[i]);
        if (
            !dict[arguments[i]] &&
            parseInt(arguments[i]) != arguments[i]) stringAdd = "'" + arguments[i] + "',";
        adding = dict[arguments[i]] || (stringAdd) || (arguments[i] + ",");
        request  += adding +" ";
    }
    request = request.substr(0, request.length - 2);
    request  += ")";
    console.log("Request".yellow, request);


    execute("add", request, callback);
};

SqlUniversal.prototype.save = function (company){
    var request = "UPDATE " +  dict[arguments[1]] + " WHERE ";

    for (var i = 2; i < arguments.length; i++){
        if(typeof (arguments[i]) == "function") {
            var  callback = arguments[i];
            break;
        }
        var stringAdd ='';
        console.log("this is argument", i, " ", dict[arguments[i]] || arguments[i]);
        if (!arguments[i+1] &&
            !dict[arguments[i+1]] &&
            dict[arguments[i+1]] != '=' &&
            !dict[arguments[i]] && parseInt(arguments[i]) != arguments[i]) stringAdd = "'" + arguments[i] + "'";
        request += dict[arguments[i]] || (stringAdd) || arguments[i];
        request += " ";




    }
    console.log("Request".yellow, request);
    var end = request.substring(request.indexOf("SET"));
    var middle = request.substring(request.indexOf("WHERE"), request.indexOf("SET"));
    var start = request.substring(0, request.indexOf("WHERE"));

    request = start + end + middle;

    execute("save", request, callback);
};

function execute (name, request, callbac){
    db.any( request )
        .then(function(data){
            console.log( name + " ".green, data);
            if (callbac) callbac(data);
        })
        .catch(function (error) {
            console.log( name + "ERROR:".red, error);
            if(callbac) callbac('error');
        });
}

function firstConnect(data){
    data.forEach(function(item){
        companys.push(item.company);
    });
}