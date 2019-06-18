var mongoose = require('../mongoose');
var Schema = mongoose.Schema;
var Service = require('./Service.js');
var my = require('../../helpers/functions.js');

var CategorySchema = new Schema({
    name: {
        type: String,
        required: true,
    },
    description: {
        type: String
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    }
}, {
    timestamps: true
});

CategorySchema.index({
    name: 1,
    user: 1,
});

CategorySchema.pre('remove', function (next) {
    var _this = this;

    Service.remove({
        category: _this._id
    }).then(function (ok) {
        return next();
    }, function (err) {
        return next(new Error(err));
    });
});

module.exports = mongoose.model('Category', CategorySchema);
