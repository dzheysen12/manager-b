var express = require('express');
var router = express.Router();
var Category = require('../db/models/Category.js');

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

    Category.find(search).sort({
        'name': 'asc'
    }).then(function (categories) {
        res.json(my.createResponse(200, {
            categories: categories
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
        description: 'string'
    });

    if (validateError) {
        return res.json(my.createResponse(904));
    }

    var newCategory = new Category({
        name: q.name,
        description: q.description,
        user: user._id
    });

    my.trySaveMongoObj(newCategory, res);
});

router.use(function (req, res, next) {// category edit
    var q = req.body;
    var not_enough_parameters = my.checkParams(q, ['categoryid']);
    if (not_enough_parameters) {
        return res.json(my.createResponse(902));
    }

    var validateError = my.validateError(q, {
        categoryid: 'ObjectId'
    });

    if (validateError) {
        return res.json(my.createResponse(904));
    }

    Category.findOne({
        _id: q.categoryid
    }).then(function (category) {
        if (category) {
            req.edit_category = category;
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
    var category  = req.edit_category;

    var validateError = my.validateError(q, {
        name: 'string',
        description: 'string'
    });

    if (validateError) {
        return res.json(my.createResponse(904));
    }

    my.checkOptionalParams(category, q ,['name', 'description']);

    my.trySaveMongoObj(category, res);
});

router.post('/delete', function(req, res, next) {
    var category  = req.edit_category;

    my.tryRemoveMongoObj(category, res);
});

module.exports = router;
