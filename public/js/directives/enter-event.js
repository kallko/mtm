// директива Enter на элементе
angular.module('MTMonitor').directive('enterEvent', function () {
    return function (scope, element, attrs) {
        element.bind("keydown keypress", function (event) {
            if (event.which === 13) {
                scope.$apply(function () {
                    scope.$eval(attrs.enterEvent);
                });

                event.preventDefault();
            }
        });
    };
});
