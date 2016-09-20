angular.module('MTMonitor', ['smart-table']);

// инициализация Golden Layout (перемещаемые панельки)
// var myLayout = new GoldenLayout({
//     settings: {
//         showPopoutIcon: false,
//         showCloseIcon: false,
//         hasHeaders: true,
//         constrainDragToContainer:false
//     },
//     dimensions: {
//         dragProxyWidth: 0,
//         dragProxyHeight: 0
//     },
//     content: [{
//         type: 'row',
//         // начальное расположение панелек в интерфейсе
//         content: [
//             {
//                 type: 'column',
//                 content: [
//                     {
//                         type: 'component',
//                         componentName: 'template',
//                         width: 50,
//                         componentState: {templateId: 'transparent-map-window'} // id темплейта из index.html
//                     }
//                 ]
//             },
//             {
//                 type: 'column',
//                 content: [
//                     {
//                         type: 'stack',
//                         height: 100,
//                         activeItemIndex: 0,
//                         content: [
//                             {
//                                 type: 'component',
//                                 componentName: 'template',
//                                 title: 'Точки маршрута',
//                                 componentState: {templateId: 'template-point-table'}
//                             },
//                             {
//                                 type: 'component',
//                                 title: 'Закрытие дня',
//                                 componentName: 'template',
//                                 componentState: {templateId: 'close-day'}
//                             },
//                             {
//                                 type: 'component',
//                                 title: 'Настройки',
//                                 componentName: 'template',
//                                 componentState: {templateId: 'setting-window'}
//                             }
//                             ,
//                             {
//                                 type: 'component',
//                                 title: 'Редактирование маршрута',
//                                 componentName: 'template',
//                                 componentState: {templateId: 'edit-route'}
//                             }
//                         ]
//                     }
//                 ]
//             }]
//     }]
// });


var myLayout = new GoldenLayout({
    settings: {
        showPopoutIcon: false,
        showCloseIcon: false,
        hasHeaders: true,
        constrainDragToContainer:false
    },
    dimensions: {
        dragProxyWidth: 0,
        dragProxyHeight: 0
    },
    content: [{
        type: 'row',
        // начальное расположение панелек в интерфейсе
        content: [
            {
                type: 'column',
                content: [
                    {
                        type: 'component',
                        componentName: 'template',
                        componentState: {templateId: 'transparent-map-window'} // id темплейта из index.html
                    }
                    ,
                    {
                        type: 'stack',
                        height: 20,
                        activeItemIndex: 0,
                        content: [
                            {
                                type: 'component',
                                title: 'Статистика',
                                componentName: 'template',
                                componentState: {templateId: 'statistic-tmp'}
                            }
                        ]
                    }
                ]
            },
            {
                type: 'column',
                content: [
                    {
                        type: 'stack',
                        height: 100,
                        activeItemIndex: 0,
                        content: [
                            {
                                type: 'component',
                                componentName: 'template',
                                title: 'Точки маршрута',
                                componentState: {templateId: 'template-point-table'}
                            },
                            {
                                type: 'component',
                                title: 'Поиск',
                                componentName: 'template',
                                componentState: {templateId: 'close-day'}
                            },
                            //{
                            //    type: 'component',
                            //    title: 'Настройки',
                            //    componentName: 'template',
                            //    componentState: {templateId: 'setting-window'}
                            //}
                            //,
                            {
                                type: 'component',
                                title: 'Редактирование маршрута',
                                componentName: 'template',
                                componentState: {templateId: 'edit-route'}
                            }
                        ]
                    }
                ]
            }]
    }]
});


myLayout.registerComponent('template', function (container, state) {
    var templateHtml = $('#' + state.templateId).html();
    container.getElement().html(templateHtml);
});

// ручной запуск Ангуляра после инициализации Golden Layout
myLayout.on('initialised', function () {

    angular.bootstrap(document.body, ['MTMonitor']);

});

myLayout.init();


angular.module('MTMonitor')
    .run(function($rootScope) {
        $rootScope.errorNotification = function(url) {
            $rootScope.$emit('showNotification', {text: 'Произошла ошибка при попытке обратится к '+url, duration: 5000});
        };

        $rootScope.waitNotification = function(text, duration) {
            if (!duration) duration = 5000;
            $rootScope.$emit('showNotification', {text: text, duration: duration});
        };

        $rootScope.currentDay = true; // false если день не сегодняшний

    })
    .config(['$compileProvider', function ($compileProvider) {
         // disable debug info
         $compileProvider.debugInfoEnabled(false);
    }]);


