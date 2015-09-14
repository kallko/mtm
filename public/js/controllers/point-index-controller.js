angular.module('MTMonitor').controller('PointIndexController', ['$scope', '$filter', function (scope, filter) {

  // var
  //     nameList = ['Pierre', 'Pol', 'Jacques', 'Robert', 'Elisa'],
  //     familyName = ['Dupont', 'Germain', 'Delcourt', 'bjip', 'Menez'];
  //
  // function createRandomItem() {
  //     var
  //         firstName = nameList[Math.floor(Math.random() * 4)],
  //         lastName = familyName[Math.floor(Math.random() * 4)];
  //
  //     return{
  //         firstName: firstName,
  //         lastName: lastName
  //     };
  // }
  //
  // scope.rowCollection = [];
  // for (var j = 0; j < 50; j++) {
  //     scope.rowCollection.push(createRandomItem());
  // }

    function randomStr(len){
      var text = "";
      var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

      for( var i=0; i < len; i++ )
          text += possible.charAt(Math.floor(Math.random() * possible.length));

      return text;
    }

    var testData = []
        tmpStatus = '';
    for (var i = 0; i < 70; i++) {
      tmpStatus = Math.round(Math.random() * 10) % 2 == 0 ? 'Доставлено' : 'Не доставленно';
      tmpStatus = Math.round(Math.random() * 21) % 10 == 0 ? 'Отменен' : tmpStatus,
      testData.push({address: 'address ' + i,
                    factNum: i,
                    planNum: i,
                    transport: 'transport' + i,
                    driver: 'driver' + i,
                    status: tmpStatus,
                    strictSelectValue: "ab"});
    }
    scope.rowCollection = testData;

    scope.displayCollection = [].concat(scope.rowCollection);

    scope.predicates = ['address', 'factNum', 'planNum', 'transport', 'driver', 'balance', 'email'];
    scope.selectedPredicate = scope.predicates[0];
}]);

// angular.module('MTMonitor').filter('myStrictFilter', function($filter){
//     return function(input, predicate){
//         return $filter('filter')(input, predicate, true);
//     }
// });

angular.module('MTMonitor').filter('unique', function() {
    return function (arr, field) {
        var o = {}, i, l = arr.length, r = [];
        for(i=0; i<l;i+=1) {
            o[arr[i][field]] = arr[i];
        }
        for(i in o) {
            r.push(o[i]);
        }
        return r;
    };
  });
