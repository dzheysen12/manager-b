var mongoose = require('../mongoose');
var Schema = mongoose.Schema;

var SettingSchema = new Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    value: {
        type: mongoose.Schema.Types.Mixed
    }
});

module.exports = mongoose.model('Setting', SettingSchema);
