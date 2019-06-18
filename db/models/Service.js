var mongoose = require('../mongoose');
var Schema = mongoose.Schema;

var ServiceSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    description: {
        type: String
    },
    price: {
        type: Number
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        index: true
    }
}, {
    timestamps: true
});

ServiceSchema.index({
    name: 1,
    category: 1
});

ServiceSchema.index({
    name: 1,
    user: 1
});

module.exports = mongoose.model('Service', ServiceSchema);
