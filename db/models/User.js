var mongoose = require('../mongoose');
var Schema = mongoose.Schema;
var bcrypt = require('bcrypt-nodejs');
var my = require('../../helpers/functions.js');
var log = console.log;
var log_error = my.log_error;
var log_warning = my.log_warning;
var util = require('util');

var UserSchema = new Schema({
    name: String,
    surname: String,
    email: {
        type: String,
        index: true,
        unique: true,
        required: true
    },
    password: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['confirmed', 'wait confirm','denied'],
        default: 'confirmed',
        required: true
    },
    type: {
        type: String,
        enum: ['admin', 'user', 'employee'],
        required: true
    },
    //only employee start
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        index: true
    },
    position: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Position',
        index: true
    },
    //only employee end
    passwordRecoverCode: {//for password restore
        type: String
    },
    money: {
        type: Number,
        default: 0
    },
    //не используется
    tariff: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tariff',
        index: true
    },
    tariffEnd: {
        type: Date
    },
    //не используется
    activate: {
        type: Boolean,
        default: false
    },
}, {
    timestamps: true
});

UserSchema.index({
    passwordRecoverCode: 1
}, {
    unique: true,
    sparse: true
});

UserSchema.pre('save', function (next) {
    var user = this;

   /*function final() {
        redis_client.set('user' + user._id, JSON.stringify(user), function (err) {
            if (err) {
                log(log_error(util.inspect(err)));
            }
        });
    }*/

    if (this.isModified('password') || this.isNew) {
        bcrypt.genSalt(10, function (err, salt) {
            if (err) {
                return next(err);
            }
            bcrypt.hash(user.password, salt, null, function (err, hash) {
                if (err) {
                    return next(err);
                }
                user.password = hash;
                //final();
                next();
            });
        });
    } else {
        //final();
        return next();
    }
});

UserSchema.methods.comparePassword = function (passw, cb) {
    bcrypt.compare(passw, this.password, function (err, isMatch) {
        if (err) {
            return cb(err);
        }
        cb(null, isMatch);
    });
};

module.exports = mongoose.model('User', UserSchema);
