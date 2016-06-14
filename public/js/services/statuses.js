// сервис для хранения списка статусов
angular.module('MTMonitor').factory('Statuses', [function StatusesFactory() {
        // коды статусов
    var STATUS = {
            FINISHED: 0,
            FINISHED_LATE: 1,
            FINISHED_TOO_EARLY: 2,
            IN_PROGRESS: 3,
            TIME_OUT: 4,
            DELAY: 5,
            SCHEDULED: 7,
            CANCELED: 8
        },

        // параметры статусов
        textStatuses = [
            {
                name: 'все статусы',
                value: -1,
                class: 'all-status',
                limit:80 //Точки набравшие больше предела считаются выполненными, меньше - невыполненными
            },
            {
                name: 'доставлено',
                value: STATUS.FINISHED,
                class: 'delivered-status',
                color: '#0A800A'
            },
            {
                name: 'доставлено поздно',
                table_name: 'доставлено',
                value: STATUS.FINISHED_LATE,
                class: 'delivered-late-status',
                color: 'green'
            },
            {
                name: 'доставлено рано',
                table_name: 'доставлено',
                value: STATUS.FINISHED_TOO_EARLY,
                class: 'delivered-too-early-status',
                color: 'green'
            },
            {
                name: 'выполняется',
                value: STATUS.IN_PROGRESS,
                class: 'performed-status',
                color: 'blue'
            },
            {
                name: 'время вышло',
                value: STATUS.TIME_OUT,
                class: 'time-out-status',
                color: 'red'
            },
            {
                name: 'опаздывает',
                value: STATUS.DELAY,
                class: 'delay-status',
                color: 'red'
            },
            //{name: 'под контролем', value: 4, class: 'controlled-status'},
            //{name: 'ожидают выполнения', value: 5, class: 'awaiting-status'},
            {
                name: 'будет сделано',
                value: STATUS.SCHEDULED,
                class: 'scheduled-status',
                color: '#4482AB'
            },
            {
                name: 'отменен',
                value: STATUS.CANCELED,
                class: 'canceled-status',
                color: '#969696'
            }
        ];

    return {
        getStatuses: function () {
            return STATUS;
        },
        getTextStatuses: function () {
            return textStatuses;
        }
    };
}]);