var mongoose = require('../mongoose');
var Schema = mongoose.Schema;

var MessageSchema = new Schema({
    request: {//сообщение пользователя
        type: String,
        required: true
    },
    responses: [{//ответы бота
        type: String
    }],
    raw_response: mongoose.Schema.Types.Mixed, // ответ от dialogflow
    intent: {//найденный intent
        type: String,
        index: true
    },
    sessionId: {//ид пользователя писавшему боту
        type: String,
        required: true,
        index: true
    },
    bot: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Bot',
        required: true,
        index: true
    }
}, {
    timestamps: true
});

MessageSchema.index({
    createdAt: 1,
    sessionId: 1
});

MessageSchema.index({
    createdAt: -1,
    sessionId: 1
});

MessageSchema.index({
    intent: 1,
    bot: 1
});

module.exports = mongoose.model('Message', MessageSchema);
