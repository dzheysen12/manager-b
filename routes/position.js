var express = require('express');
var router = express.Router();
var Position = require('../db/models/Position.js');

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

    Position.find(search).sort({
        'name': 'asc'
    }).populate({
        path: 'services'
    }).then(function (positions) {
        res.json(my.createResponse(200, {
            positions: positions
        }));
    }, function (err) {
        log(log_error(util.inspect(err)));
        res.json(my.createResponse(904));
    });
});

function repairScheduleAfterParsing(schedule) {
    // [[],[12]] парсит как [[12]] поэтому передаем массив так {0: null, 1: 12}
    schedule.workIntervals.forEach(function (interval, index) {
        schedule.workIntervals[index] = interval || [];
    });

    schedule.serviceTime = +schedule.serviceTime;
    schedule.notWorkDays = schedule.notWorkDays || [];
    return schedule;
};

router.post('/add', function(req, res, next) {
    var q = req.body;
    var user = req.user;
    var not_enough_parameters = my.checkParams(q, ['name', 'schedule', 'services']);
    if (not_enough_parameters) {
        return res.json(my.createResponse(902));
    }

    q.schedule = repairScheduleAfterParsing(q.schedule);

    var validateError = my.validateError(q, {
        name: 'string',
        description: 'string',
        schedule: true,
        services: 'array_of_ids'
    });

    if (validateError) {
        return res.json(my.createResponse(904));
    }

    var newPosition = new Position({
        name: q.name,
        description: q.description,
        schedule: q.schedule,
        services: q.services,
        user: user._id
    });

    my.trySaveMongoObj(newPosition, res);
});

router.use(function (req, res, next) {// position edit
    var q = req.body;
    var not_enough_parameters = my.checkParams(q, ['positionid']);
    if (not_enough_parameters) {
        return res.json(my.createResponse(902));
    }

    var validateError = my.validateError(q, {
        positionid: 'ObjectId'
    });

    if (validateError) {
        return res.json(my.createResponse(904));
    }

    Position.findOne({
        _id: q.positionid
    }).then(function (position) {
        if (position) {
            req.edit_position = position;
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
    var position  = req.edit_position;

    q.schedule = repairScheduleAfterParsing(q.schedule);

    var validateError = my.validateError(q, {
        name: 'string',
        description: 'string',
        services: 'array_of_ids',
        schedule: true
    });

    if (validateError) {
        return res.json(my.createResponse(904));
    }

    my.checkOptionalParams(position, q ,['name', 'description', 'services', 'schedule']);

    my.trySaveMongoObj(position, res);
});

router.post('/delete', function(req, res, next) {
    var position  = req.edit_position;

    my.tryRemoveMongoObj(position, res);
});

module.exports = router;
