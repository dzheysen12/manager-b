var express = require('express');
var router = express.Router();
var PushNotification = require('../db/models/PushNotification.js');
var config = require('../config.js');
var passport = require('passport');
require('../passport')(passport);

var my = require('../helpers/functions.js');
var log = console.log;
var log_error = my.log_error;
var log_warning = my.log_warning;
var util = require('util');

router.use(function (req, res, next) {// check auth name
    passport.authenticate('jwt', {
        session: false
    }, function(err, user, info) {
        if (user) {
            req.user = user;
            if (user.type != 'admin') {
                return next();
            } else {
                res.json(my.createResponse(403));
            }
        } else {
            res.json(my.createResponse(901));
        }
    })(req, res, next);
});

router.post('/phone/enable', function(req, res, next) {
    var q = req.body;
    var user = req.user;
    var required = ['device'];

    var not_enough_parameters = my.checkParams(q, required);
    if (not_enough_parameters) {
        return res.json(my.createResponse(902));
    }

    var validateError = my.validateError(q, {
        device: 'string'
    });

    if (validateError) {
        return res.json(my.createResponse(904));
    }

    var newPushNotification = new PushNotification({
        device: q.device,
        user: user._id,
        type: 'phone'
    });

    my.trySaveMongoObj(newPushNotification, res);
});

router.post('/phone/disable', function(req, res, next) {
    var q = req.body;
    var user = req.user;

    PushNotification.remove({
        user: user._id,
        type: 'phone'
    }).then(function (ok) {
        res.json(my.createResponse(200));
    }, function (err) {
        log(log_error(util.inspect(err)));
        res.json(my.createResponse(904));
    });
});

router.post('/email/add', function(req, res, next) {
    var q = req.body;
    var user = req.user;
    var required = ['email'];

    var not_enough_parameters = my.checkParams(q, required);
    if (not_enough_parameters) {
        return res.json(my.createResponse(902));
    }

    var validateError = my.validateError(q, {
        email: 'string'
    });

    if (validateError) {
        return res.json(my.createResponse(904));
    }

    var newPushNotification = new PushNotification({
        email: q.email,
        user: user._id,
        type: 'email'
    });

    my.trySaveMongoObj(newPushNotification, res);
});

router.post('/email/delete', function(req, res, next) {
    var q = req.body;
    var user = req.user;
    var required = ['pushnotificationid'];

    var not_enough_parameters = my.checkParams(q, required);
    if (not_enough_parameters) {
        return res.json(my.createResponse(902));
    }

    var validateError = my.validateError(q, {
        pushnotificationid: 'ObjectId'
    });

    if (validateError) {
        return res.json(my.createResponse(904));
    }

    PushNotification.remove({
        _id: q.pushnotificationid
    }).then(function (ok) {
        res.json(my.createResponse(200));
    }, function (err) {
        log(log_error(util.inspect(err)));
        res.json(my.createResponse(904));
    });
});

module.exports = router;
