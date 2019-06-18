var mongoose = require('../mongoose');
var Schema = mongoose.Schema;

var TariffSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    description: {
        type: String
    },
    price: {
        type: Number,
        required: true
    },
    duration: {// in days
        type: Number,
        required: true
    },
    start: {
        type: Boolean
    },
    employees: {
        type: Number
    },
    ordersPerDay: {
        type: Number
    },
    status: {
        type: Boolean,
        required: true,
        index: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Tariff', TariffSchema);
