var express = require('express');
var router = express.Router();
var Message = require('../db/models/Message.js');

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

router.post('/find_by_intent', function(req, res, next) {
    var q = req.body;
    var user = req.user;
    var required = ['intent'];
    var search = {
        intent: q.intent
    };

    if (user.type != 'admin') {
        required.push('botid');
        search.bot = q.botid;
    }

    var not_enough_parameters = my.checkParams(q, required);
    if (not_enough_parameters) {
        return res.json(my.createResponse(902));
    }

    var validateError = my.validateError(q, {
        intent: 'string',
        botid: 'ObjectId'
    });

    if (validateError) {
        return res.json(my.createResponse(904));
    }

    Message.find(search).then(function (messages) {
        res.json(my.createResponse(200, {
            messages: messages
        }));
    }, function (err) {
        log(log_error(util.inspect(err)));
        res.json(my.createResponse(904));
    });
});

router.post('/dialog/list', function(req, res, next) {
    var q = req.body;
    var user = req.user;
    var required = ['botid'];

    var not_enough_parameters = my.checkParams(q, required);
    if (not_enough_parameters) {
        return res.json(my.createResponse(902));
    }

    var validateError = my.validateError(q, {
        bot: 'ObjectId'
    });

    if (validateError) {
        return res.json(my.createResponse(904));
    }

    const aggregate = [{
        $group: {
            _id: "sessionId",
            count: {
                $sum: 1
            }
        }
    }
    ];

    Message.aggregate(aggregate).then(function (dialogs) {
        res.json(my.createResponse(200, {
            dialogs: dialogs
        }));
    }, function (err) {
        log(log_error(util.inspect(err)));
        res.json(my.createResponse(904));
    });
});

router.post('/dialog/show', function(req, res, next) {
    var q = req.body;
    var user = req.user;
    var required = ['sessionid'];

    var not_enough_parameters = my.checkParams(q, required);
    if (not_enough_parameters) {
        return res.json(my.createResponse(902));
    }

    var validateError = my.validateError(q, {
        sessionid: 'string'
    });

    if (validateError) {
        return res.json(my.createResponse(904));
    }

    Message.find({
        sessionId: q.sessionid
    }).sort({
        'time': 'asc'
    }).then(function (messages) {
        res.json(my.createResponse(200, {
            messages: messages
        }));
    }, function (err) {
        log(log_error(util.inspect(err)));
        res.json(my.createResponse(904));
    });
});

router.use(function (req, res, next) {// check sessionid and dialog owner
    var q = req.body;
    var user = req.user;
    var not_enough_parameters = my.checkParams(q, ['sessionid']);
    if (not_enough_parameters) {
        return res.json(my.createResponse(902));
    }

    var validateError = my.validateError(q, {
        sessionid: 'string'
    });

    if (validateError) {
        return res.json(my.createResponse(904));
    }

    Message.findOne({
        sessionId: q.sessionid
    }).populate({
        path: 'bot',
        populate: {
            path: 'user'
        }
    }).then(function (message) {
        if (message) {
            if (user._id.toString() == message.bot.user._id.toString()) {
                return next();
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

router.post('/dialog/delete', function(req, res, next) {
    var q = req.body;

    Message.remove({
        _id: q.sessionid
    }).then(function (ok) {
        res.json(my.createResponse(200));
    }, function (err) {
        log(log_error(util.inspect(err)));
        res.json(my.createResponse(904));
    });
});

module.exports = router;
