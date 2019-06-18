var mongoose = require('../mongoose');
var Schema = mongoose.Schema;

var scheduleSchema = new Schema({
    workIntervals:{
        type:  mongoose.Schema.Types.Mixed,
        default: [[],[],[],[],[],[],[]]
        /*
        each array represent a weekday(Sunday is 0, Monday is 1, and so on.)
         , weekday consist of working time intervals
        example value for work(if weekday is not work: weekday = []) weekday:
        [
    {
        Start: {
            Hours: 8,
            Minutes: 30
        },
        End: {
            Hours: 12,
            Minutes: 0
        }
    },
    {
        Start: {
            Hours: 13,
            Minutes: 0
        },
        End: {
            Hours: 17,
            Minutes: 30
        }
    }];
         */
    },
    notWorkDays: {//holidays and etc
        type:mongoose.Schema.Types.Mixed,
        default:[]
    },
    serviceTime: {//service time in minutes
        type: Number,
        default:30
    }
});

var PositionSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    description: {
        type: String
    },
    services: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Service'
    }],
    schedule: {
        type: scheduleSchema,
        default: {}
    },
    user: {//создатель должности
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    }
}, {
    timestamps: true
});

PositionSchema.index({
    name: 1,
    user: 1
});

module.exports = mongoose.model('Position', PositionSchema);
