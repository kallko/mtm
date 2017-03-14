//Попытка сделать отдельную страницу и модуль для аутентификации вне 1с
//Не реализовано

angular.module('MTMonitor').controller('AuthController', ['$scope', '$rootScope', '$filter', '$http', function (scope, rootScope, filter, http) {

    scope.message = "Hellow World Again";

    scope.click = function(){
        var obj= {
            user : scope.user,
            password : scope.password
        };

        console.log("Send", obj);
        http.get('./login/', {data : obj})
            .success(function (data) {
                console.log("AUTH");
                if (data.status == 'changed') {
                    //console.log(data);
                    scope.locked = data.locked.locked;

                }
            }).error(function(){
                // rootScope.errorNotification('/checklocks');
            });
    }

}]);
