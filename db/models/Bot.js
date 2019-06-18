var mongoose = require('../mongoose');
var Schema = mongoose.Schema;

var BotSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    description: {
        type: String
    },
    type: {
        type: String,
        enum: ['service', 'product'],
        default: 'service',
        required: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    employees: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }]
}, {
    timestamps: true
});

BotSchema.index({
    name: 1,
    user: 1,
});

module.exports = mongoose.model('Bot', BotSchema);
