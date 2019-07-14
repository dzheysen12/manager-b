var express = require('express');
var router = express.Router();
var CRMorder = require('../db/models/CRMorder.js');

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
            return next();
        } else {
            res.json(my.createResponse(901));
        }
    })(req, res, next);
});

router.post('/list', function(req, res, next) {
    var q = req.body;
    var user = req.user;
    //search example: { bot: '5bcb97db9dd3a7209839be35' }
    var validateError = my.validateError(q, {
        search: 'object'
    });

    var search = q.search || {};

    if (user.type == 'user') {
        search.user = user._id;
    } else if (user.type == 'employee') {
        search = { employee: user._id };
    }

    if (validateError) {
        return res.json(my.createResponse(904));
    }

    CRMorder.find(search).sort({
        'time': 'asc'
    }).populate({
        path: 'service'
    }).populate({
        path: 'employee'
    }).then(function (crm_orders) {
        res.json(my.createResponse(200, {
            crm_orders: crm_orders
        }));
    }, function (err) {
        log(log_error(util.inspect(err)));
        res.json(my.createResponse(904));
    });
});

router.post('/add', function(req, res, next) {
    var q = req.body;
    var user = req.user;
    var required = ['name', 'time', 'contacts', 'service'];

    if (user.type == 'admin') {
        required.push('user');
    }

    var not_enough_parameters = my.checkParams(q, required);
    if (not_enough_parameters) {
        return res.json(my.createResponse(902));
    }

    var validateError = my.validateError(q, {
        name: 'string',
        time: 'date',
        contacts: 'string',
        service: 'ObjectId',
        bot: 'ObjectId',
        employee: 'ObjectId',
        user: 'ObjectId',
        sessionId: 'string'
    });

    if (validateError) {
        return res.json(my.createResponse(904));
    }

    var newCRMorder = new CRMorder({
        name: q.name,
        time: q.time,
        contacts: q.contacts,
        service: q.service
    });
    my.checkOptionalParams(newCRMorder, q, ['bot', 'employee', 'sessionId']);

    if (user.type == 'user') {
        newCRMorder.user = user._id;
    } else if (user.type == 'employee') {
        newCRMorder.user = user.owner;
        newCRMorder.employee = user._id;
    }

    my.trySaveMongoObj(newCRMorder, res, function (saved_crm_order) {
        CRMorder.find({
            _id: saved_crm_order._id
        }).sort({
            'time': 'asc'
        }).populate({
            path: 'service'
        }).populate({
            path: 'employee'
        }).then(function (crm_order) {
            if (crm_order) {
                res.json(my.createResponse(200, crm_order));
            } else {
                res.json(my.createResponse(906));
            }
        }, function (err) {
            log(log_error(util.inspect(err)));
            res.json(my.createResponse(904));
        });
    });
});

router.use(function (req, res, next) {// crm_order edit
    var q = req.body;
    var user = req.user;
    var not_enough_parameters = my.checkParams(q, ['crm_orderid']);
    if (not_enough_parameters) {
        return res.json(my.createResponse(902));
    }

    var validateError = my.validateError(q, {
        crm_orderid: 'ObjectId'
    });

    if (validateError) {
        return res.json(my.createResponse(904));
    }

    CRMorder.findOne({
        _id: q.crm_orderid
    }).then(function (crm_order) {
        if (crm_order) {
            if ((user.type == 'user' && crm_order.user.toString() != user._id.toString())
                || (user.type == 'employee'
                    && crm_order.employee.toString() != user._id.toString())) {
                res.json(my.createResponse(403));
            }
            req.edit_crm_order = crm_order;
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
    var crm_order  = req.edit_crm_order;
    var user = req.user;

    var validateError = my.validateError(q, {
        name: 'string',
        time: 'date',
        contacts: 'string',
        service: 'ObjectId',
        bot: 'ObjectId',
        employee: 'ObjectId',
        user: 'ObjectId',
        sessionId: 'string'
    });

    if (validateError) {
        return res.json(my.createResponse(904));
    }

    var optionals = ['name', 'time', 'contacts', 'service'];

    if (user.type != 'employee') {
        optionals = optionals.concat(['bot', 'employee', 'sessionId']);
    }

    my.checkOptionalParams(crm_order, q , optionals);

    my.trySaveMongoObj(crm_order, res, function (saved_crm_order) {
        CRMorder.find({
            _id: saved_crm_order._id
        }).sort({
            'time': 'asc'
        }).populate({
            path: 'service'
        }).populate({
            path: 'employee'
        }).then(function (crm_order) {
            if (crm_order) {
                res.json(my.createResponse(200, crm_order));
            } else {
                res.json(my.createResponse(906));
            }
        }, function (err) {
            log(log_error(util.inspect(err)));
            res.json(my.createResponse(904));
        });
    });
});

router.post('/delete', function(req, res, next) {
    var crm_order  = req.edit_crm_order;

    my.tryRemoveMongoObj(crm_order, res);
});

module.exports = router;
