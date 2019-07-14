var express = require('express');
var router = express.Router();
var User = require('../db/models/User.js');
var Setting = require('../db/models/Setting.js');

var passport = require('passport');
require('../passport')(passport);
var jwt = require('jsonwebtoken');

var my = require('../helpers/functions.js');
var db_promises = require('../helpers/db_promises.js');
var config = require('../config.js');
var log = console.log;
var log_error = my.log_error;
var log_warning = my.log_warning;
var util = require('util');
var mongoose = require('mongoose');
var fs = require('fs');

router.post('/session', function (req, res) {
    var q = req.body;
    var not_enough_parameters = my.checkParams(q, ['email', 'password']);
    if (not_enough_parameters) {
        return res.json(my.createResponse(902));
    }

    var validateError = my.validateError(q, {
        email: true,
        password: true
    });

    if (validateError) {
        return res.json(my.createResponse(904));
    }

    User.findOne({
        email: q.email
    }, function (err, user) {
        if (err) {
            log(log_error(util.inspect(err)));
            res.json(my.createResponse(904));
        } else {
            if (!user) {
                res.json(my.createResponse(905));
            } else {
                user.comparePassword(q.password, function (err, isMatch) {
                    if (isMatch && !err) {
                        if (user.status == 'denied') {
                            res.json(my.createResponse(403));
                        } else if (user.status == 'wait confirm' && config.email_confirmation) {
                            res.json(my.createResponse(905));
                        } else {
                            var day = 60 * 60 * 24;
                            var token = jwt.sign(user.toJSON(), config.passport.secret, {
                                expiresIn: q.remember ? 30 * day : 3 * day
                            });
                            res.json(my.createResponse(200, {
                                auth: token,
                                type: user.type,
                                //language_id: user.language
                            }));
                        }
                    } else {
                        res.json(my.createResponse(905));
                    }
                });
            }
        }
    });
});

router.post('/request', function (req, res, next) {
    //Password recovery request
    var q = req.body;
    var not_enough_parameters = my.checkParams(q, ['email']);
    if (not_enough_parameters) {
        return res.json(my.createResponse(902));
    }

    var validateError = my.validateError(q, {
        email: true
    });

    if (validateError) {
        return res.json(my.createResponse(904));
    }

    User.findOne({
        email: q.email
    }).then(function (user) {
        if (user) {
            if (user.status == 'denied') {
                return res.json(my.createResponse(403));
            } else {
                var code = my.randomStr(12);
                user.passwordRecoverCode = code;
                my.trySaveMongoObj(user, res, function () {
                    return res.json(my.createResponse(200, config.test_mode ? {
                        code: code
                    } : {}));
                });
            }
        } else {
            return res.json(my.createResponse(906));
        }
    }, function (err) {
        log(log_error(util.inspect(err)));
        return res.json(my.createResponse(904));
    });
});

router.post('/restore', function (req, res, next) {
    var q = req.body;
    var not_enough_parameters = my.checkParams(q, ['code', 'password']);
    if (not_enough_parameters) {
        return res.json(my.createResponse(902));
    }

    var validateError = my.validateError(q, {
        password: true,
        code: 'string'
    });

    if (validateError) {
        return res.json(my.createResponse(904));
    }

    User.findOne({
        passwordRecoverCode: q.code
    }).then(function (user) {
        if (user) {
            user.password = q.password;
            user.passwordRecoverCode = undefined;
            my.trySaveMongoObj(user, res);
        } else {
            return res.json(my.createResponse(906));
        }
    }, function (err) {
        log(log_error(util.inspect(err)));
        return res.json(my.createResponse(904));
    });

});

router.use(function (req, res, next) {
    passport.authenticate('jwt', {
        session: false
    }, function (err, user, info) {
        req.user = user;
        return next();
    })(req, res, next);
});

router.post('/register', function (req, res, next) {
    var q = req.body;
    var required = ['email', 'password', 'usertype'];
    var user = req.user;

    if (user && user.type == 'user') {
        required.push('position');
    }

    var not_enough_parameters = my.checkParams(q, required);
    if (not_enough_parameters) {
        return res.json(my.createResponse(902));
    }

    var validateError = my.validateError(q, {
        email: true,
        password: true,
        usertype: true,
        name: 'string',
        surname: 'string',
        position: 'ObjectId'
    });

    if (validateError) {
        return res.json(my.createResponse(904));
    }


    if (q.usertype == 'admin') {
        if (!user || user.type != 'admin') {
            log(log_warning('You are not admin'));
            return res.json(my.createResponse(403));
        }
    } else if (q.usertype == 'employee') {
        if (!user || user.type != 'user') {
            log(log_warning('You are not user'));
            return res.json(my.createResponse(403));
        }

        /*
        if (!user.tariff || !user.tariffEnd) {
            log(log_warning('Тариф не найден'));
            return res.json(my.createResponse(403));
        }*/
    }

    var newUser = new User({
        email: q.email,
        password: q.password,
        type: q.usertype
    });

    if (user && user.type == 'user') {
        newUser.owner = user._id;
    }

    my.checkOptionalParams(newUser, q, ['name', 'surname', 'position']);

    const successCallback = function (savedUser) {
        if (config.email_confirmation) {
            newUser.status = 'wait confirm';
            var code = my.randomStr(12);
            var key = 'email_confirm' + savedUser._id;
            redis_client.set(key, code, function (err) {
                if (err) {
                    log(log_error(util.inspect(err)));
                    return res.json(my.createResponse(904));
                }
            });
            my.sendEmail(newUser.email, 'Подтвердите свой email адрес',
                '<a href="' + config.frontend + 'verify?Id=' + savedUser._id +
                '&Code=' + code + '">Подтвердить</a>').then(function (ok) {
                final();
            }, function (err) {
                log(log_error(util.inspect(err)));
                savedUser.remove();
                return res.json(my.createResponse(904));
            });
        } else {
            final();
        }

        function final() {
            if (savedUser.type == 'employee') {
                return res.json(my.createResponse(200, savedUser));
            } else {
                var day = 60 * 60 * 24;

                var token = jwt.sign(savedUser.toJSON(), config.passport.secret, {
                    expiresIn: 3 * day
                });

                return res.json(my.createResponse(200, {
                    auth: token,
                    type: savedUser.type,
                    _id: savedUser._id
                }));
            }
        }
    };

    my.trySaveMongoObj(newUser, res, successCallback);
});

router.use(function (req, res, next) {// private zone
    if (req.user) {
        return next();
    } else {
        res.json(my.createResponse(901));
    }
});

router.post('/me', function (req, res, next) {
    var user = req.user;

    return res.json(my.createResponse(200, user));
});

router.post('/activate', function(req, res, next) {
    var q = req.body;
    var user = req.user;

    Setting.findOne({
        name: 'activate_price'
    }).then(function (activate_price) {
        if (activate_price) {
            if (user.money >= activate_price.value) {
                user.money -= activate_price.value;
                user.activate = true;
                my.trySaveMongoObj(user, res);
            } else {
                log(log_warning('На балансе нет достаточной суммы'));
                res.json(my.createResponse(403));
            }
        } else {
            log(log_error('Settings \'activate_price\' not found'));
            res.json(my.createResponse(906));
        }
    }, function (err) {
        log(log_error(util.inspect(err)));
        res.json(my.createResponse(904));
    });
});


router.post('/edit', function (req, res, next) {
    var q = req.body;
    var user = req.user;
    var validateError = my.validateError(q, {
        password: true,
        name: 'string',
        surname: 'string'
    });

    if (validateError) {
      return res.json(my.createResponse(904));
    }

    my.checkOptionalParams(user, q, ['password', 'name', 'surname']);
    my.trySaveMongoObj(user, res);
});

router.post('/list', function (req, res, next) {
    var q = req.body;
    var user = req.user;
    var search = {};

    if (q.usertype) {
        search.type = q.usertype;
    }

    if (user.type == 'user') {
        search = {
            owner: user._id
        };
    } else if (user.type == 'employee') {
        return res.json(my.createResponse(403));
    }

    var validateError = my.validateError(q, {
        usertype: true
    });

    if (validateError) {
        return res.json(my.createResponse(904));
    }

   User.find(search).then(function (users) {
       return res.json(my.createResponse(200, {
           users: users
       }));
   }, function (err) {
       log(log_error(util.inspect(err)));
       res.json(my.createResponse(904));
   });
});

router.use(function (req, res, next) {// user edit
    var q = req.body;
    var not_enough_parameters = my.checkParams(q, ['userid']);
    if (not_enough_parameters) {
        return res.json(my.createResponse(902));
    }

    var validateError = my.validateError(q, {
        userid: 'ObjectId'
    });

    if (validateError) {
        return res.json(my.createResponse(904));
    }

    User.findOne({
        _id: q.userid
    }).then(function (user) {
        if (user) {
            req.edit_user = user;
            return next();
        } else {
            res.json(my.createResponse(906));
        }
    }, function (err) {
        log(log_error(util.inspect(err)));
        res.json(my.createResponse(904));
    });
});

router.use(function (req, res, next) {// private zone
    var user = req.user;

    if (user.type == 'admin') {
        return next();
    } else if (user.type == 'user') {//user can edit own employees
        var edit_user  = req.edit_user;

        if (edit_user.owner.toString() == user._id.toString()) {
            return next();
        } else {
            res.json(my.createResponse(403));
        }
    } else {
        res.json(my.createResponse(403));
    }
});

router.post('/edit_not_own_account', function (req, res, next) {
    var q = req.body;
    var user = req.edit_user;

    var validateError = my.validateError(q, {
        password: true,
        email: true,
        name: 'string',
        surname: 'string',
        position: 'ObjectId'
    });

    if (validateError) {
        return res.json(my.createResponse(904));
    }

    my.checkOptionalParams(user, q, ['name', 'surname', 'email', 'password', 'position']);
    my.trySaveMongoObj(user, res);
});

router.post('/delete', function(req, res, next) {
    var edit_user  = req.edit_user;

    my.tryRemoveMongoObj(edit_user, res);
});

router.post('/lock', function (req, res, next) {
    var user = req.edit_user;
    user.status = 'denied';
    my.trySaveMongoObj(user, res);
});

router.post('/unlock', function (req, res, next) {
    var user = req.edit_user;
    user.status = 'confirmed';
    my.trySaveMongoObj(user, res);
});

router.post('/email', function (req, res, next) {
    var q = req.body;
    var not_enough_parameters = my.checkParams(q, ['email']);
    if (not_enough_parameters) {
        return res.json(my.createResponse(902));
    }

    var validateError = my.validateError(q, {
        email: true
    });

    if (validateError) {
        return res.json(my.createResponse(904));
    }
    var user = req.edit_user;
    user.email = q.email;
    my.trySaveMongoObj(user, res);
});

router.post('/password', function (req, res, next) {
    var q = req.body;
    var not_enough_parameters = my.checkParams(q, ['password']);
    if (not_enough_parameters) {
        return res.json(my.createResponse(902));
    }
    var validateError = my.validateError(q, {
        password: true
    });

    if (validateError) {
        return res.json(my.createResponse(904));
    }
    var user = req.edit_user;
    user.password = q.password;
    my.trySaveMongoObj(user, res);
});

router.post('/view', function (req, res, next) {
    var q = req.body;
    var user = req.edit_user;
    var day = 60 * 60 * 24;
    var token = jwt.sign(user.toJSON(), config.passport.secret, {
        expiresIn: q.remember ? 30 * day : 3 * day
    });

    res.json(my.createResponse(200, {
        auth: token,
        type: user.type
    }));
});

router.use(function (req, res, next) {// admin zone
    var user = req.user;

    if (user.type == 'admin') {
        return next();
    } else {
        res.json(my.createResponse(403));
    }
});

router.post('/edit_by_admin', function (req, res, next) {
    var q = req.body;

    var validateError = my.validateError(q, {
        money: 'number'
    });

    if (validateError) {
        return res.json(my.createResponse(904));
    }
    var user = req.edit_user;
    my.checkOptionalParams(user, q , ['money']);

    my.trySaveMongoObj(user, res);
});

module.exports = router;
