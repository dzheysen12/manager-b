var express = require('express');
var router = express.Router();
var User = require('../db/models/User.js');
var Payment = require('../db/models/Payment.js');
var my = require('../helpers/functions.js');
var config = require('../config.js');
var md5 = require('md5');
var log = console.log;
var log_error = my.log_error;
var log_warning = my.log_warning;
var util = require('util');

router.post('/release', function (req, res, next) {
    var q = req.body;
    var arr = ['action', 'orderSumAmount', 'orderSumCurrencyPaycash', 'orderSumBankPaycash',
        'shopId', 'invoiceId', 'customerNumber'];
    var my_md5 = '';
    for (var i = 0; i < arr.length; i++) {
        my_md5 += q[arr[i]] + ';'
    }
    var amount = q.orderSumAmount;
    var u_search = {
        _id: q.customerNumber
    };

    const isOwn = q.shopId == config.Yandex.Payment.ShopId;//наша касса или нет

    res.set('Content-Type', 'text/xml');

    if (isOwn) {
        my_md5 += config.Yandex.Payment.Password;
        var my_md5 = md5(my_md5).toUpperCase();
        if (my_md5 == q.md5) {
            if (my.isValidMongoId(q.customerNumber)) {
                return User.findOne(u_search).then(function (u) {
                    if (!u) {
                        log(log_error('Пользователь не найден(payment->release)'));
                    }
                    else {
                        var payment = new Payment({
                            Amount: amount,
                            Type: 'Recharge',
                            Note: 'Пополнение счета',
                            User: u._id
                        });
                        payment.save();
                        u.money += Math.ceil(amount);
                        return u.save().then(function (u) {
                            res.send('<paymentAvisoResponse performedDatetime="' + q.requestDatetime
                                + '" code="0" invoiceId="' + q.invoiceId + '" shopId="'
                                + q.shopId + '"/>');
                        }, function (err) {
                            log(log_error(err.toString()));
                        });
                    }
                }, function (err) {
                    log(log_error(err.toString()));
                })
            }
        }
        else {
            log(log_error('/check route for Yandex Payment return error(md5 do not match)'));
            res.send('<paymentAvisoResponse performedDatetime="' + q.requestDatetime +
                '" code="0" invoiceId="' + q.invoiceId + '" shopId="' +
                q.shopId + '"/>');
        }
    }
});

router.post('/check', function (req, res, next) {
    var q = req.body;
    var arr = ['action', 'orderSumAmount', 'orderSumCurrencyPaycash', 'orderSumBankPaycash',
        'shopId', 'invoiceId', 'customerNumber'];
    var my_md5 = '';
    for (var i = 0; i < arr.length; i++) {
        my_md5 += q[arr[i]] + ';'
    }

    res.set('Content-Type', 'text/xml');

    const isOwn = q.shopId == config.Yandex.Payment.ShopId;//наша касса или нет

    if (isOwn) {
        my_md5 += config.Yandex.Payment.Password;
        var my_md5 = md5(my_md5).toUpperCase();
        if (my_md5 == q.md5) {
            res.send('<checkOrderResponse performedDatetime="' + q.requestDatetime +
                '" code="0" invoiceId="' + q.invoiceId + '" shopId="' +
                q.shopId + '"/>');
        }
        else {
            log(log_error('/check route for Yandex Payment return error(md5 do not match)'));
            res.send('<checkOrderResponse performedDatetime="' + q.requestDatetime +
                '" code="1" invoiceId="' + q.invoiceId + '" shopId="' +
                q.shopId + '"/>');
        }
    }
});

module.exports = router;