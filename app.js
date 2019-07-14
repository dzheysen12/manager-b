var express = require('express');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var morgan = require('morgan');
var passport = require('passport');
var app = express();
var log = console.log;
var my = require('./helpers/functions.js');
var log_error = my.log_error;
var log_warning = my.log_warning;
var config = require('./config.js');
var seed = require('./seed.js');
var util = require('util');
var path = require('path');

app.use(logger('dev'));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(cookieParser());
app.use(function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers',
        'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    next();
});
app.use(passport.initialize());

var bot = require('./routes/bot');
var category = require('./routes/category');
var crmorder = require('./routes/crmorder');
var message = require('./routes/message');
var notifications = require('./routes/notifications');
var position = require('./routes/position');
var service = require('./routes/service');
var settings = require('./routes/settings');
var tariff = require('./routes/tariff');
var user = require('./routes/user');
var webhook = require('./routes/webhook');
var payment = require('./routes/payment');

app.use('/bot', bot);
app.use('/category', category);
app.use('/crmorder', crmorder);
app.use('/message', message);
app.use('/notifications', notifications);
app.use('/position', position);
app.use('/service', service);
app.use('/settings', settings);
app.use('/tariff', tariff);
app.use('/user', user);
app.use('/webhook', webhook);
app.use(config.Yandex.Payment.Test ? '/payment-test' : '/payment', payment);
app.seed = function () {
    seed.setupAdmin(seed.setupSettings);
};

// catch 404 and forward to error handler
app.use(function (req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handler
app.use(function (err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    res.status(err.status || 500);
    log(log_error(util.inspect(err)));
    res.send(util.inspect(err));
});

module.exports = app;
