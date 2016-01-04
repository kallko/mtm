angular.module('MTMonitor').factory('TimeConverter', [function TimeConverterFactory() {
    return {
        getTstampAvailabilityWindow: function (strWindows, currentTime) {
            if (!strWindows) {
                //console.log('Invalid strWindows!');
                return;
            }

            var windows = strWindows.split(' ; '),
                resWindows = [];

            for (var i = 0; i < windows.length; i++) {
                var parts = windows[i].split(' '),
                    timeStart = parts[0].split(':'),
                    timeFinish = parts[2].split(':'),
                    startDate = new Date(currentTime * 1000),
                    finishDate = new Date(currentTime * 1000);

                startDate.setHours(timeStart[0]);
                startDate.setMinutes(timeStart[1]);

                finishDate.setHours(timeFinish[0]);
                finishDate.setMinutes(timeFinish[1]);

                resWindows.push({
                    start: parseInt(startDate.getTime() / 1000),
                    finish: parseInt(finishDate.getTime() / 1000)
                });
            }

            return resWindows;
        }
    };
}]);