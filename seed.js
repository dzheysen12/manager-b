var User = require('./db/models/User.js');
var Setting = require('./db/models/Setting.js');
var config = require('./config.js');
var my = require('./helpers/functions.js');
var log = console.log;
var log_error = my.log_error;
var log_warning = my.log_warning;
var util = require('util');

function setupAdmin( callback) {
    User.findOne({
        type: 'admin'
    }).then(function (user) {
        if (!user) {
            var admin = new User({
                name: 'Admin',
                email: 'admin@admin.ru',
                password: 'admin@admin.ru',
                status: 'confirmed',
                type: 'admin'
            });
            admin.save().then(function (ok) {
                log('Admin was added(admin@admin.ru)');
                if (callback) {
                    callback();
                }
            }, function (err) {
                log(log_error('Admin setup error:'));
                log(log_error(util.inspect(err)));
            });
        } else {
            if (callback) {
                callback();
            }
        }
    }, function (err) {
        log('Admin setup error:');
        log(log_error(util.inspect(err)));
    });
}

exports.setupAdmin = setupAdmin;

function setupSettings() {
    Setting.findOne({
        name: 'mail'
    }).then(function (mail) {
        if (!mail) {
            var mail = new Setting({
                name: 'mail',
                value: config.mail
            });
            mail.save();
        }
    }, function (err) {
        log(log_error('Settings setup error:'));
        log(log_error(util.inspect(err)));
    });

    Setting.findOne({
        name: 'activate_price'
    }).then(function (activate_price) {
        if (!activate_price) {
            var activate_price = new Setting({
                name: 'activate_price',
                value: 15000
            });
            activate_price.save();
        }
    }, function (err) {
        log(log_error('Settings setup error:'));
        log(log_error(util.inspect(err)));
    });

    Setting.findOne({
        name: 'message_price'
    }).then(function (message_price) {
        if (!message_price) {
            var message_price = new Setting({
                name: 'message_price',
                value: 1
            });
            message_price.save();
        }
    }, function (err) {
        log(log_error('Settings setup error:'));
        log(log_error(util.inspect(err)));
    });
}

exports.setupSettings = setupSettings;
