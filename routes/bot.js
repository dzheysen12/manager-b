var express = require('express');
var router = express.Router();
var Bot = require('../db/models/Bot.js');
var Setting = require('../db/models/Setting.js');

var passport = require('passport');
require('../passport')(passport);

var my = require('../helpers/functions.js');
var config = require('../config.js');
var log = console.log;
var log_error = my.log_error;
var log_warning = my.log_warning;
var util = require('util');

router.use(function (req, res, next) {// check auth key
    passport.authenticate('jwt', {
        session: false
    }, function(err, user, info) {
        if (user) {
            req.user = user;
            if (user.type == 'user') {
                return next();
            } else {
                res.json(my.createResponse(403));
            }
        } else {
            res.json(my.createResponse(901));
        }
    })(req, res, next);
});

router.post('/list', function(req, res, next) {
    var q = req.body;
    var user = req.user;
    var search = {
        user: user._id
    };

    Bot.find(search).sort({
        'name': 'asc'
    }).populate({
        path: 'employees'
    }).then(function (bots) {
        res.json(my.createResponse(200, {
            bots: bots
        }));
    }, function (err) {
        log(log_error(util.inspect(err)));
        res.json(my.createResponse(904));
    });
});

router.post('/add', function(req, res, next) {
    var q = req.body;
    var user = req.user;
    var not_enough_parameters = my.checkParams(q, ['name', 'description']);
    if (not_enough_parameters) {
        return res.json(my.createResponse(902));
    }

    var validateError = my.validateError(q, {
        name: 'string',
        description: 'string',
        employees: 'array_of_ids',
        buttonColor: 'string',
        widgetColor: 'string',
        title: 'string',
    });

    if (validateError) {
        return res.json(my.createResponse(904));
    }

    var newBot = new Bot({
        name: q.name,
        description: q.description,
        user: user._id
    });

    my.checkOptionalParams(newBot, q ,['employees', 'buttonColor', 'widgetColor', 'title']);

    my.trySaveMongoObj(newBot, res);
});

router.use(function (req, res, next) {// bot edit
    var q = req.body;
    var not_enough_parameters = my.checkParams(q, ['botid']);
    if (not_enough_parameters) {
        return res.json(my.createResponse(902));
    }

    var validateError = my.validateError(q, {
        botid: 'ObjectId'
    });

    if (validateError) {
        return res.json(my.createResponse(904));
    }

    Bot.findOne({
        _id: q.botid
    }).then(function (bot) {
        if (bot) {
            req.edit_bot = bot;
            return next();
        } else {
            res.json(my.createResponse(906));
        }
    }, function (err) {
        log(log_error(util.inspect(err)));
        res.json(my.createResponse(904));
    });
});

router.post('/edit', function(req, res, next) {
    var q = req.body;
    var bot  = req.edit_bot;

    var validateError = my.validateError(q, {
        name: 'string',
        description: 'string',
        employees: 'array_of_ids',
        buttonColor: 'string',
        widgetColor: 'string',
        title: 'string',
        employees_is_empty: 'boolean',
    });

    if (validateError) {
        return res.json(my.createResponse(904));
    }

    if (q.employees_is_empty) {
        q.employees = [];
    }

    my.checkOptionalParams(bot, q ,['name', 'description', 'employees', 'buttonColor', 'widgetColor', 'title']);

    my.trySaveMongoObj(bot, res);
});

router.post('/delete', function(req, res, next) {
    var bot  = req.edit_bot;

    my.tryRemoveMongoObj(bot, res);
});

module.exports = router;
