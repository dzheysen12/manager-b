var User = require('../db/models/User.js');
var mongoose = require('mongoose');

var Models = {
    User: User
};

var my = require('./functions.js');
var config = require('../config.js');
var log = console.log;
var log_error = my.log_error;
var log_warning = my.log_warning;
var util = require('util');

function getMongoModel(object, model) {
    return new Promise(function (resolve, reject) {
        if (my.isMongoModel(object)) {
            resolve(object);
        } else {
            Models[model].findOne({
                _id: object._id
            }).then(function (true_object) {
                if (true_object) {
                    resolve(true_object);
                } else {
                    reject({
                        code: 906
                    });
                }
            } ,function (err) {
                reject({
                    error: err,
                    code: 904
                });
            });
        }
    });
}

exports.getMongoModel = getMongoModel;

function getUsersStatistic(start, end, usertype) {
    return new Promise(function (resolve, reject) {
        var searchNew = my.searchNew(start, end);
        var searchTotal = my.searchTotal(end);
        var searchActivity = my.searchNew(start, end);

        if (usertype) {
            searchNew.type = usertype;
            searchTotal.type = usertype;
            searchActivity['user.type'] = usertype;
        }


        var aggregate = [
            {
                $lookup: {
                    from: 'users',
                    localField: 'user',
                    foreignField: '_id',
                    as: 'user'
                }
            },  {
                $unwind: '$user'
            },
            {
                $match: searchActivity
            },
            {
                $group : {
                    _id: '$user'
                }
            }
        ];

        User.find(searchNew).then(function (newUsers) {
            User.find(searchTotal).then(function (totalUsers) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({
                            new: newUsers.length || 0,
                            total: totalUsers.length || 0
                        });
                    }
            }, function (err) {
                reject(err);
            });
        }, function (err) {
            reject(err);
        });
    });
}

exports.getUsersStatistic = getUsersStatistic;

function getUsersStatisticForWhichType(start, end) {
    return new Promise(function (resolve, reject) {
            getUsersStatistic(start, end, 'employee').then(function (clients) {
                getUsersStatistic(start, end, 'user').then(function (users) {
                    resolve({
                        'clients': clients,
                        'users': users
                    });
                }, function (err) {
                    reject(err);
                });
            }, function (err) {
                reject(err);
            });
    });
}

exports.getUsersStatisticForWhichType = getUsersStatisticForWhichType;

function getPeriodStatistic(start, end, model) {
    return new Promise(function (resolve, reject) {
        var searchNew = my.searchNew(start, end);
        var searchTotal = my.searchTotal(end);

        Models[model].find(searchNew).then(function (newObjets) {
            Models[model].find(searchTotal).then(function (totalObjets) {
                resolve({
                    new: newObjets.length || 0,
                    total: totalObjets.length || 0
                });
            }, function (err) {
                reject(err);
            });
        }, function (err) {
            reject(err);
        });
    });
}

exports.getPeriodStatistic = getPeriodStatistic;
