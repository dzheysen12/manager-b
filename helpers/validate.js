var User = require('../db/models/User.js');

var validate = {
    email: {
        types: ['string'],
        callback: function (email) {
            if (email.indexOf('@') == -1) {
                return 'Wrong email';
            }
        }
    },
    password: {
        types: ['string'],
        callback: function (password) {
            if (password.length < 6) {
                return 'Short password';
            }
        }
    },
    usertype: {
        types: ['string'],
        enum: User.schema.path('type').enumValues
    },
    date: {
      types: ['string', 'number']
    },
    schedule: {
        types: ['object'],
        callback: function (schedule) {
            var where = 'in schedule object';
            if (schedule.workIntervals) {
                var workIntervals = schedule.workIntervals;
                if (Array.isArray(workIntervals)) {
                    if (workIntervals.length == 7) {
                        where += ' in field \'workIntervals\'';
                        workIntervals.forEach(function (interval) {
                            if (typeof interval === 'object') {
                                if (interval.Start && interval.End) {
                                    for (var key in interval) {
                                        if (interval[key].Hours && interval[key].Minutes) {
                                        } else {
                                            return where + ' in element of array: field \''
                                                + key + '\' ' +
                                                'must has two fields \'Hours\'' +
                                                ' and \'Minutes\' , field = ' + interval[key];
                                        }
                                    }
                                } else {
                                    return where + ':' +
                                        ' each element of array must has two fields \'End\'' +
                                        ' and \'Start\' , element = ' + interval;
                                }
                            } else {
                                return where + ':'
                                    + ' each element of array must has type object, not '
                                    + typeof interval;
                            }
                        });
                    } else {
                        return where +': field \'workIntervals\' must has length == 7' +
                            ', not ' + workIntervals.length;
                    }
                } else {
                    return where +': field \'workIntervals\' must be array , not '
                        + typeof workIntervals;
                }
            } else {
                return where +': field \'workIntervals\' not found';
            }

            where = 'in schedule object';
            if (schedule.notWorkDays) {
                if (Array.isArray(workIntervals)) {

                } else {
                    return where +': field \'notWorkDays\' must be array , not '
                        + typeof workIntervals;
                }
            } else {
                return where +': field \'notWorkDays\' not found';
            }

            where = 'in schedule object';
            if (schedule.serviceTime) {
                var serviceTime = schedule.serviceTime;
                if (!(typeof serviceTime === 'number')) {
                    return where +': field \'serviceTime\' must be number , not '
                        + typeof serviceTime;
                }
            } else {
                return where +': field \'serviceTime\' not found';
            }
        }
    }
};

module.exports = validate;
