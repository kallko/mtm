angular.module('acp', ['ngRoute', 'smart-table']);

var parentForm;
function initialize(thisForm) {
    parentForm = thisForm;
    console.log('initialize complete');
}