angular.module('MTMonitor', ['smart-table']);

// инициализация Golden Layout (перемещаемые панельки)
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
                    // три панельки в одном стеке
                    {
                        type: 'stack',
                        height: 50,
                        activeItemIndex: 2,
                        content: [
                            {
                                type: 'component',
                                title: 'Настройки',
                                componentName: 'template',
                                componentState: {templateId: 'setting-window'}
                            }
                            ,
                            {
                                type: 'component',
                                title: 'Редактирование маршрута',
                                componentName: 'template',
                                componentState: {templateId: 'edit-route'}
                            },
                            {
                                type: 'component',
                                title: 'Закрытие дня',
                                componentName: 'template',
                                componentState: {templateId: 'close-day'}
                            }
                        ]
                    }
                ]
            },
            {
                type: 'component',
                width: 50,
                componentName: 'template',
                title: 'Точки маршрута',
                componentState: {templateId: 'template-point-table'}
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

