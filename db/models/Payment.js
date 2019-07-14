var mongoose = require('mongoose');

var PaymentSchema = new mongoose.Schema({
    User: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    Amount: {
        type: Number
    },
    Note: {
        type: String,
        default: ''
    },
    Type: {
        /*
            Recharge - поплнение
            Activate - активация аккаунта
            */
        type: String,
        enum: ['Recharge', 'Activate']
    }
}, {
    timestamps: true
});

PaymentSchema.index({
    User: 1,
    createdAt: 1
});

PaymentSchema.index({
    User: 1,
    createdAt: -1
});

PaymentSchema.index({
    User: 1,
    Type: 1,
    createdAt: 1
});

PaymentSchema.index({
    User: 1,
    Type: 1,
    createdAt: -1
});

var PaymentModel = mongoose.model('Payment', PaymentSchema);

module.exports = PaymentModel;