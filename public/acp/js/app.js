angular.module('acp', ['ngRoute', 'smart-table']);

// получение родительской формы от 1С
var parentForm;
function initialize(thisForm) {
    parentForm = thisForm;
    console.log('initialize complete');
}