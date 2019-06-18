var express = require('express');
var router = express.Router();
var Setting = require('../db/models/Setting.js');

var passport = require('passport');
require('../passport')(passport);
var jwt = require('jsonwebtoken');

var my = require('../helpers/functions.js');
var util = require('util');
var config = require('../config.js');
var log = console.log;
var log_error = my.log_error;
var log_warning = my.log_warning;

router.post('/list', function(req, res, next) {
    Setting.find({}).then(function (settings) {
        var object = {};
        settings.forEach(function (setting) {
            object[setting.name] = setting.value;
        });

        res.json(my.createResponse(200, {
            settings: object //settings
        }));
    }, function (err) {
        log(log_error(util.inspect(err)));
        res.json(my.createResponse(904));
    });
});

router.use(function (req, res, next) {// setting edit
    var q = req.body;
    var not_enough_parameters = my.checkParams(q, ['name']);
    if (not_enough_parameters) {
        return res.json(my.createResponse(902));
    }

    var validateError = my.validateError(q, {
        name: 'string'
    });

    if (validateError) {
        return res.json(my.createResponse(904));
    }

    Setting.findOne({
        name: q.name
    }).then(function (setting) {
        if (setting) {
            req.edit_setting = setting;
            return next();
        } else {
            log(log_warning('Setting \'' + q.name + '\' not found'));
            res.json(my.createResponse(906));
        }
    }, function (err) {
        log(log_error(util.inspect(err)));
        res.json(my.createResponse(904));
    });
});

router.post('/get', function(req, res, next) {
    var q = req.body;
    var setting  = req.edit_setting;

    res.json(my.createResponse(200, setting));
});

router.use(function (req, res, next) {// check auth name
    passport.authenticate('jwt', {
        session: false
    }, function(err, user, info) {
        if (user) {
            req.user = user;
            if (user.type == 'admin') {
                return next();
            } else {
                res.json(my.createResponse(403));
            }
        } else {
            res.json(my.createResponse(901));
        }
    })(req, res, next);
});

router.post('/edit', function(req, res, next) {
    var q = req.body;
    var setting  = req.edit_setting;

    var validateError = my.validateError(q, {
        name: 'string'
    });

    if (q.name == 'mail') {
      q.value.auth = (q.value.auth == 'true');
      q.value.secure = (q.value.secure == 'true');
    }

    if (validateError) {
        return res.json(my.createResponse(904));
    }

    my.checkOptionalParams(setting, q ,['value']);

    my.trySaveMongoObj(setting, res);
});

module.exports = router;
