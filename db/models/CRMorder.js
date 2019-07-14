var mongoose = require('../mongoose');
var Schema = mongoose.Schema;
var PushNotification = require('./PushNotification.js');
var my = require('../../helpers/functions.js');
var config = require('../../config.js');
var log = console.log;
var log_error = my.log_error;
var log_warning = my.log_warning;
var util = require('util');
var FCM = require('fcm-node');
var fcm = new FCM(config.notifications.gcmKey);

var CRMorderSchema = new Schema({
    name: {//имя клиента
        type: String
    },
    time: {//начало приема
        type: Date
    },
    contacts: {//контакты клиенты
        type: String
    },
    sessionId: {//dialogflow sessionId
        type: String,
        index: true
    },
    user: {//владелец бизнеса(бота)
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    service: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Service',
        required: true
    },
    bot: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Bot'
    },
    employee: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    description: {//комментарий к заказу
      type: String
  },
}, {
    timestamps: true
});

CRMorderSchema.pre('save', function (next) {
    var _this = this;

    if (_this.isNew) {
        return PushNotification.find({
            user: _this.employee
        }).then(function (pushNotifications) {
            pushNotifications.forEach(function (notification) {
                //тут будет отправка уведомления
                if (notification.type == 'device') {
                    var message = {
                        to: notification.device,
                        data: {
                            order_id: _this._id
                        }
                    };

                    fcm.send(message, function(err, response){
                        if (err) {
                            log(log_error(err));
                        } else {
                            log(response);
                        }
                    });
                } else if (notification.type == 'email') {
                    my.sendEmail(notification.email, 'Новая записть в ЦРМ!',
                        'Данные записи:' + JSON.stringify(_this));
                }
            });

            return next();
        }, function (err) {
            return next(new Error(err));
        });
    } else {
        return next();
    }
});

CRMorderSchema.index({
    time: 1,
    user: 1
});

CRMorderSchema.index({
    time: 1,
    user: 1,
    bot: 1
});

CRMorderSchema.index({
    time: 1,
    user: 1,
    employee: 1
});

CRMorderSchema.index({
    time: 1,
    employee: 1
});

CRMorderSchema.index({
    time: 1,
    user: 1,
    service: 1
});

module.exports = mongoose.model('CRMorder', CRMorderSchema);
