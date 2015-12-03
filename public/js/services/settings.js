angular.module('MTMonitor').factory('Settings', [function SettingsFactory() {
    return {
        load: function() {
            var settingsStr = localStorage['settings'];
            if (!settingsStr) return;

            settingsStr = JSON.parse(settingsStr);
            settingsStr.showDate = -1;
            return settingsStr;
        }
    };
}]);