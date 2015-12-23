angular.module('MTMonitor', ['smart-table']);

var myLayout = new GoldenLayout({
    settings: {
        showPopoutIcon: false,
        showCloseIcon: false,
        hasHeaders: true
    },
    content: [{
        type: 'row',
        content: [
            {
                type: 'column',
                content: [
                    {
                        type: 'component',
                        componentName: 'template',
                        componentState: {templateId: 'transparent-map-window'}
                    }
                    ,
                    {
                        type: 'stack',
                        height: 50,
                        activeItemIndex: 0,
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

myLayout.on('initialised', function () {
    angular.bootstrap(document.body, ['MTMonitor']);
});

myLayout.init();

