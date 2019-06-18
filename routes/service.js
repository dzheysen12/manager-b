var express = require('express');
var router = express.Router();
var Service = require('../db/models/Service.js');

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

    var validateError = my.validateError(q, {
        category: 'ObjectId'
    });

    if (validateError) {
        return res.json(my.createResponse(904));
    }

    if (q.category) {
        search = {
            category: q.category
        }
    }

    Service.find(search).sort({
        'name': 'asc'
    }).populate({
        path: 'category'
    }).then(function (services) {
        res.json(my.createResponse(200, {
            services: services
        }));
    }, function (err) {
        log(log_error(util.inspect(err)));
        res.json(my.createResponse(904));
    });
});

router.post('/add', function(req, res, next) {
    var q = req.body;
    var user = req.user;
    var not_enough_parameters = my.checkParams(q, ['name', 'price']);
    if (not_enough_parameters) {
        return res.json(my.createResponse(902));
    }

    var validateError = my.validateError(q, {
        name: 'string',
        description: 'string',
        price: 'number',
        category: 'ObjectId'
    });

    if (validateError) {
        return res.json(my.createResponse(904));
    }

    var newService = new Service({
        name: q.name,
        description: q.description,
        price: q.price,
        user: user._id,
    });

    if (q.category) {
        newService.category = q.category;
    }

    my.trySaveMongoObj(newService, res);
});

router.use(function (req, res, next) {// service edit
    var q = req.body;
    var not_enough_parameters = my.checkParams(q, ['serviceid']);
    if (not_enough_parameters) {
        return res.json(my.createResponse(902));
    }

    var validateError = my.validateError(q, {
        serviceid: 'ObjectId'
    });

    if (validateError) {
        return res.json(my.createResponse(904));
    }

    Service.findOne({
        _id: q.serviceid
    }).then(function (service) {
        if (service) {
            req.edit_service = service;
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
    var service  = req.edit_service;

    var validateError = my.validateError(q, {
        name: 'string',
        description: 'string',
        price: 'number',
        category: 'ObjectId'
    });

    if (validateError) {
        return res.json(my.createResponse(904));
    }

    my.checkOptionalParams(service, q ,['name', 'description', 'price', 'category']);

    my.trySaveMongoObj(service, res);
});

router.post('/delete', function(req, res, next) {
    var service  = req.edit_service;

    my.tryRemoveMongoObj(service, res);
});

module.exports = router;
