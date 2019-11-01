/* global module, require */
//require('./main.css');
var jquery = require('jquery');
var Jupyter = require('@jupyterlab/notebook');
var dialog = null; // require('@jupyterlab/notebook/base/js/dialog');
var utils = null; // require('@jupyterlab/notebook/base/js/utils');

var connect = require('./connect.js');

console.log('rsconnect-jupyterlab loaded!');

module.exports = [{
    id: 'rsconnect-jupyterlab',
    autoStart: true,
    activate: function(app) {
      console.log('JupyterLab extension rsconnect-jupyterlab is activated!');
      console.log(Jupyter);
      console.log(app);
      connect.init(jquery, Jupyter, dialog, utils);
    }
}];
