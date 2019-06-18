var express = require('express');
var router = express.Router();
var Tariff = require('../db/models/Tariff.js');

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
            req.user = user;
            return next();
    })(req, res, next);
});

router.post('/list', function(req, res, next) {
    var q = req.body;
    var user = req.user;

    var search = {};

    if (!user || user.type != 'admin') {
        search.status = true;
    }

    Tariff.find(search).then(function (tariffs) {
        res.json(my.createResponse(200, {
            tariffs: tariffs
        }));
    }, function (err) {
        log(log_error(util.inspect(err)));
        res.json(my.createResponse(904));
    });
});

router.use(function (req, res, next) {// user zone
    var user = req.user;

    if (user) {
        return next();
    } else {
        res.json(my.createResponse(901));
    }
});

router.post('/buy', function(req, res, next) {
    var q = req.body;
    var user = req.user;
    var required = ['tariffid'];

    var not_enough_parameters = my.checkParams(q, required);
    if (not_enough_parameters) {
        return res.json(my.createResponse(902));
    }

    var validateError = my.validateError(q, {
        tariffid: 'ObjectId',
    });

    if (validateError) {
        return res.json(my.createResponse(904));
    }

    Tariff.findOne({
        _id: q.tariffid
    }).then(function (tariff) {
        if (tariff) {
            if (user.money >= tariff.price) {
                user.money -= tariff.price;
                const is_old_tariff = user.tariff == q.tariffid;
                user.tariff = tariff._id;

                if (is_old_tariff) {
                    user.tariffEnd = user.tariffEnd.setDate(user.tariffEnd.getDate()
                        + tariff.duration);
                } else {
                    user.tariffEnd = new Date().setDate(new Date().getDate() + tariff.duration);
                }
                my.trySaveMongoObj(user, res);
            } else {
                res.json(my.createResponse(403));
            }
        } else {
            res.json(my.createResponse(906));
        }
    }, function (err) {
        log(log_error(util.inspect(err)));
        res.json(my.createResponse(904));
    });
});

router.use(function (req, res, next) {// admin zone
    var user = req.user;

    if (user.type == 'admin') {
        return next();
    } else {
        res.json(my.createResponse(403));
    }
});

router.post('/add', function(req, res, next) {
    var q = req.body;
    var user = req.user;
    var required = ['name', 'description', 'price', 'duration', 'start', 'employees',
        'ordersPerDay', 'status'];

    var not_enough_parameters = my.checkParams(q, required);
    if (not_enough_parameters) {
        return res.json(my.createResponse(902));
    }

    var validateError = my.validateError(q, {
        name: 'string',
        description: 'string',
        price: 'number',
        duration: 'number',
        start: 'boolean',
        employees: 'number',
        ordersPerDay: 'number',
        status: 'boolean'
    });

    if (validateError) {
        return res.json(my.createResponse(904));
    }

    var newTariff = new Tariff({
        name: q.name,
        description: q.description,
        price: q.contacts,
        duration: q.duration,
        start: q.start,
        employees: q.employees,
        ordersPerDay: q.ordersPerDay,
        status: q.status
    });

    my.trySaveMongoObj(newTariff, res);
});

router.use(function (req, res, next) {// tariff edit
    var q = req.body;
    var user = req.user;
    var not_enough_parameters = my.checkParams(q, ['tariffid']);
    if (not_enough_parameters) {
        return res.json(my.createResponse(902));
    }

    var validateError = my.validateError(q, {
        tariffid: 'ObjectId'
    });

    if (validateError) {
        return res.json(my.createResponse(904));
    }

    Tariff.findOne({
        _id: q.tariffid
    }).then(function (tariff) {
        if (tariff) {
            req.edit_tariff = tariff;
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
    var tariff  = req.edit_tariff;

    var validateError = my.validateError(q, {
        name: 'string',
        description: 'string',
        price: 'number',
        duration: 'number',
        start: 'boolean',
        employees: 'number',
        ordersPerDay: 'number',
        status: 'boolean'
    });

    if (validateError) {
        return res.json(my.createResponse(904));
    }

    var optionals = ['name', 'description', 'price', 'duration', 'start', 'employees',
        'ordersPerDay', 'status'];

    my.checkOptionalParams(tariff, q , optionals);

    my.trySaveMongoObj(tariff, res);
});

router.post('/delete', function(req, res, next) {
    var tariff  = req.edit_tariff;

    my.tryRemoveMongoObj(tariff, res);
});

module.exports = router;
