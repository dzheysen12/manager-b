var mongoose = require('../mongoose');
var Schema = mongoose.Schema;

var PushNotificationSchema = new Schema({
    type: {
        type: String,
        enum: ['email', 'phone']
    },
    device: {
        type: String
    },
    email: {
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

PushNotificationSchema.index({
    user: 1,
    device: 1
}, {
    unique: true
});

PushNotificationSchema.index({
    type: 1,
    device: 1
});

module.exports = mongoose.model('PushNotification', PushNotificationSchema);
