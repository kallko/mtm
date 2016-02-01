angular.module('MTMonitor').factory('Statuses', [function StatusesFactory() {
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

        textStatuses = [
            {name: 'все статусы', value: -1, class: 'all-status'},
            {name: 'доставлено', value: STATUS.FINISHED, class: 'delivered-status'},
            {
                name: 'доставлено поздно',
                table_name: 'доставлено',
                value: STATUS.FINISHED_LATE,
                class: 'delivered-late-status',
                color: 'red'
            },
            {
                name: 'доставлено рано',
                table_name: 'доставлено',
                value: STATUS.FINISHED_TOO_EARLY,
                class: 'delivered-too-early-status'
            },
            {name: 'выполняется', value: STATUS.IN_PROGRESS, class: 'performed-status'},
            {name: 'время вышло', value: STATUS.TIME_OUT, class: 'time-out-status'},
            {name: 'опаздывает', value: STATUS.DELAY, class: 'delay-status'},
            //{name: 'под контролем', value: 4, class: 'controlled-status'},
            //{name: 'ожидают выполнения', value: 5, class: 'awaiting-status'},
            {name: 'запланирован', value: STATUS.SCHEDULED, class: 'scheduled-status'},
            {name: 'отменен', value: STATUS.CANCELED, class: 'canceled-status'}
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