var config = require('../config.js');
const nodemailer = require('nodemailer');
var fs = require('fs');
var https = require('https');
var http = require('http');
var log = console.log;
var validate = require('./validate.js');
var clc = require('cli-color');
var log_error = clc.red;
var log_warning = clc.yellow;
var util = require('util');
var url = require('url');
var querystring = require('querystring');
var Setting = require('../db/models/Setting.js');

exports.log_error = log_error;
exports.log_warning = log_warning;

function isMongoModel(object) {
    if (typeof object === 'object') {
        return (typeof object.save === 'function');
    } else {
        return false;
    }
}

exports.isMongoModel = isMongoModel;

function getFullHostname(req) {
    var hostname = req.headers['x-forwarded-host'] || (req.hostname + ':' + config.port);

    var full = req.protocol + "://" + hostname + '/';

    return full;
}

exports.getFullHostname = getFullHostname;

function getFileUrl(req, directory) {
    var full_url = getFullHostname(req) + 'document/get?url=' + req.file.filename;

    if (directory) {
        full_url += '&directory=' + directory;
    }

    return full_url;
}

exports.getFileUrl = getFileUrl;

function tryRemoveFile(filePath) {
    //filePath ~ http://localhost:4800/document/get?url=1536164384762.txt
    if (filePath) {
        //delete '?' in begin
        var query = querystring.parse(url.parse(filePath).search.substr(1));

        fs.unlink(config.files.photos + query.url , function (err) {
            if (err) {
                log(log_error(util.inspect(err)));
            }
        });
    }
}

exports.tryRemoveFile = tryRemoveFile;

function trySaveMongoObj(object, res, successCallback, errorCallback) {
    object.save().then(function (saved_object) {
        if (successCallback) {
            successCallback(saved_object);
        } else {
            /*
            var obj = {};
            if (saved_object.__v == 0) {
                //if create object
                obj = {
                    _id: saved_object._id
                };
            }*/
            res.json(createResponse(200, saved_object));
        }
    }, function (err) {
        if (errorCallback) {
            errorCallback(err);
        } else {
            log(log_error(util.inspect(err)));
            if (err.toString().indexOf('duplicate') != -1) {
                res.json(createResponse(903));//if data is already used
            } else {
                res.json(createResponse(904));
            }
        }
    });
}

function isInnerInterval(inner_interval, interval) {
    //work only with timestamps
    //return true if inner_interval is really inner
    return (inner_interval.start >= interval.start && inner_interval.start <= interval.end
        && inner_interval.end >= interval.start && inner_interval.end <= interval.end);
}

exports.isInnerInterval = isInnerInterval;

function sortByField(array, property) {
    function dynamicSort(property) {
        var sortOrder = 1;
        if (property[0] === '-') {
            sortOrder = -1;
            property = property.substr(1);
        }
        return function (a, b) {
            if (a[property] === undefined)
                a[property] = 0;
            if (b[property] === undefined)
                b[property] = 0;
            var result = (a[property] < b[property]) ? -1 : (a[property] > b[property]) ? 1 : 0;
            return result * sortOrder;
        }
    }

    array.sort(dynamicSort(property));
    return array;
}

exports.sortByField = sortByField;

exports.trySaveMongoObj = trySaveMongoObj;

function tryRemoveMongoObj(object, res, successCallback) {
    object.remove(function (err) {
        if (err) {
            log(log_error(util.inspect(err)));
            res.json(createResponse(904));
        } else {
            if (successCallback) {
                successCallback();
            } else {
                res.json(createResponse(200));
            }
        }
    });
}

exports.tryRemoveMongoObj = tryRemoveMongoObj;

function checkOptionalParams(object, query, fields) {
    fields.forEach(function (field) {
        if (query[field] !== undefined) {
            object[field] = query[field];
        }
    });
}

exports.checkOptionalParams = checkOptionalParams;

function isValidJSON(src) {
    var filtered = src;
    filtered = filtered.replace(/\\["\\\/bfnrtu]/g, '@');
    filtered = filtered.replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, ']');
    filtered = filtered.replace(/(?:^|:|,)(?:\s*\[)+/g, '');

    return (/^[\],:{}\s]*$/.test(filtered));
}

function strInObj(obj, str) {
    if (typeof obj == 'string' && obj.indexOf(str) != -1) {
        return obj;
    } else if (typeof obj == 'object') {
        for (var k in obj) {
            var res = strInObj(obj[k], str);
            if (res) {
                return res;
            }
        }
    } else if (Array.isArray(obj)) {
        obj.forEach(function (e) {
            var res = strInObj(e, str);
            if (res) {
                return res;
            }
        })
    }
    return '';
}

exports.strInObj = strInObj;

function map(array, field) {
    var result = array.map(function (elem) {
        return elem[field];
    });

    return result;
}

exports.map = map;

function getIds(array) {
    return map(array, '_id');
}

exports.getIds = getIds;

function fieldInObj(obj, field, name) {
    if (name && typeof name == 'string' && name.indexOf(field) != -1) {
        return obj;
    }
    else if (typeof obj == 'object') {
        for (var k in obj) {
            var res = fieldInObj(obj[k], field, k);
            if (res !== undefined) {
                return res;
            }
        }
    } else if (Array.isArray(obj)) {
        obj.forEach(function (e) {
            var res = fieldInObj(e, field);
            if (res !== undefined) {
                return res;
            }
        })
    }
    return undefined;
}

exports.fieldInObj = fieldInObj;

exports.xor = function (ai) {
    var f = '';
    for (var c = 0; c < ai.length; c++) {
        f += String.fromCharCode(ai.charCodeAt(c) ^ (1 + (ai.length - c) % 32));
    }
    return f
};

exports.unique = function (arr, unique_field) {
    var obj = {};
    for (var i = 0; i < arr.length; i++) {
        if (obj[arr[i][unique_field]] === undefined) {
            obj[arr[i][unique_field]] = arr[i];
        }
    }
    var res = [];
    for (var key in obj) {
        res.push(obj[key]);
    }
    return res;
};

function addTimezoneOffset(msg, date) {
    var hours = msg.Time.substr(0, 2).charAt(0) == '0' ? +msg.Time.substr(1, 1)
        : +msg.Time.substr(0, 2);
    var mins = msg.Time.substr(3, 2).charAt(0) == '0' ? +msg.Time.substr(4, 1)
        : +msg.Time.substr(3, 2);
    var need = date;
    need.setHours(+hours);
    need.setMinutes(+mins);
    if (msg.Timezone == 'user' || msg.Timezone == 'bot') {
        need.setMinutes(need.getMinutes() - (+msg.TimezoneOffset));
    }
    else {
        var hours = parseInt(msg.Timezone);
        need.setHours(need.getHours() + hours);
    }
    return need;
}

function regGlobalSearhWithScopes(re, str) {
    var result;
    var arr = [];

    while (result = re.exec(str)) {
        arr.push(result);
    }

    return arr;
}

exports.regGlobalSearhWithScopes = regGlobalSearhWithScopes;

function findExt(src) {
    var re = /(\.[a-zA-Z0-9]+)[^a-zA-Z0-9]?/g;
    var matches = regGlobalSearhWithScopes(re, src);
    if (matches.length > 0) {
        return matches[matches.length - 1][1];
    } else {
        return '';
    }
}

exports.findExt = findExt;

function downloadFile(from, to) {
    return new Promise(function (resolve, reject) {
        var file = fs.createWriteStream(to);
        log('File start download');
        if (from.indexOf('https') != -1) {
            https.get(from, function (res) {
                res.pipe(file);
                file.on('finish', function () {
                    log('File end download');
                    resolve(file);
                });
            });
        } else {
            http.get(from, function (res) {
                res.pipe(file);
                file.on('finish', function () {
                    log('File end download');
                    resolve(file);
                });
            });
        }
    });
}

function searchToObj(search) {
    var search = search || window.location.search.substring(1);
    if (search) {
        return JSON.parse('{"' + search.replace(/&/g, '","').replace(/=/g, '":"') + '"}',
            function (key, value) {
                return key === '' ? value : decodeURIComponent(value);
            });
    } else {
        return {};
    }
}

exports.searchToObj = searchToObj;

function arrDiff(a1, a2) {

    var a = [], diff = [];

    for (var i = 0; i < a1.length; i++) {
        a[a1[i]] = true;
    }

    for (var i = 0; i < a2.length; i++) {
        if (a[a2[i]]) {
            delete a[a2[i]];
        } else {
            a[a2[i]] = true;
        }
    }

    for (var k in a) {
        diff.push(k);
    }

    return diff;
};

exports.arrDiff = arrDiff;


exports.downloadFile = downloadFile;

exports.addTimezoneOffset = addTimezoneOffset;

exports.makeFakeImage = function (user_id, template_id, schedule_id) {
    //вставить в тело email письма для определния открытия пиьсма
    var schedule = schedule_id ? '&Schedule=' + schedule_id : '';
    var send_at = new Date().valueOf();
    return '<img src="' + config.Backend + '/admintext/open?User=' + user_id + '&Template='
        + template_id + schedule + '&Send_at=' + send_at + '" alt=""/>';
};

function sendEmail(to, subject, body) {
    return new Promise(function (resolve, reject) {
        if (!to) {
            reject('Email for send email is empty');
        }

        Setting.findOne({
            name: 'mail'
        }).then(function (mail) {
            var from = config.mail.from;
            var options = {
                host: config.mail.host,
                port: config.mail.port,
                secure: config.mail.secure, // true for 465, false for other ports
                auth: {
                    user: config.mail.user,
                    pass: config.mail.pass
                },
                tls:{
                    rejectUnauthorized: false
                }
            };

            if (mail) {
                options.host =  mail.value.host;
                options.port =  mail.value.port;
                options.secure =  mail.value.secure;

                if (mail.value.auth) {
                    options.auth = {
                        user: mail.value.user,
                        pass: mail.value.pass
                    }
                } else {
                    delete options.auth;
                }
            }

            var smtpTransport = nodemailer.createTransport(options);

            var mailOptions = {
                from: from,
                to: to,
                subject: subject,
                text: body,
                html: body
            };

            smtpTransport.sendMail(mailOptions, function (err, res) {
                if (err) {
                    reject(err);
                }
                else {а
                    resolve(res);
                }
            });
        }, function (err) {
            reject(err);
        });
    });
};

exports.sendEmail = sendEmail;

exports.getDaysLeft = function (oDeadLineDate, oToday) {
    return oDeadLineDate > oToday ? Math.ceil((oDeadLineDate - oToday) / (1000 * 60 * 60 * 24))
        : null;
};

function find(arr, search) {
    var res = [];
    arr.forEach(function (e) {
        var add = true;
        for (var key in search) {
            if (isValidMongoId(e[key])) {
                if (e[key].toString() != search[key].toString()) {
                    add = false;
                    break;
                }
            } else {
                if (e[key] != search[key]) {
                    add = false;
                    break;
                }
            }
        }
        if (add) {
            res.push(e);
        }
    });
    return res;
};

exports.find = find;

function findOne(arr, search) {
    var res;

    arr.forEach(function (e) {
        var add = true;
        for (var key in search) {
            if (isValidMongoId(e[key])) {
                if (e[key].toString() != search[key].toString()) {
                    add = false;
                    break;
                }
            } else {
                if (e[key] != search[key]) {
                    add = false;
                    break;
                }
            }
        }
        if (add) {
            res = e;
            return;
        }
    });
    return res;
};

exports.findOne = findOne;

function escape(text) {
    return text ? text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') : text;
}

exports.isValidMongoId = isValidMongoId;

function isValidMongoId(id) {
    id = id || '';
    var checkForHexRegExp = new RegExp('^[0-9a-fA-F]{24}$');
    return (id.toString()).search(new RegExp((checkForHexRegExp))) != -1;
};

exports.escape = escape;

function randomStr(number) {
    var code = '';
    var chars = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'z', 'x', 'c', 'v', 'b', 'n', 'm',
        'a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o',
        'p'];
    for (var i = 0; i < number; i++) {
        var x = Math.floor(Math.random() * (chars.length - 1));
        code += chars[x];
    }
    return code;
}

exports.randomStr = randomStr;

function random(min, max) {
    if (max === undefined) {
        max = min;
        min = 0;
    }
    return Math.floor(Math.random() * ((max + 1) - min) + min);
}

exports.random = random;

function skip(arr, x) {
    var new_arr = [];
    arr.forEach(function (e, i) {
        if (x <= 0) {
            new_arr.push(e);
        } else {
            x--;
        }
    })
    return new_arr;
}

exports.skip = skip;

function limit(arr, x) {
    var new_arr = [];
    for (var i = 0; i < arr.length; i++) {
        if (x > 0) {
            new_arr.push(arr[i]);
            x--;
        } else {
            break;
        }
    }
    return new_arr;
}

exports.limit = limit;

exports.checkParams = function (where, arr, errors) {
    for (var i = 0; i < arr.length; i++) {
        if (where[arr[i]] === undefined) {
            if (errors && errors[i]) {
                return errors[i];
            }
            return 'Параметр ' + arr[i] + ' необходим';
        }
    }
    return null;
};

exports.validateError = function (where, params) {
    try {
        for (var param_name in params) {
            var param = where[param_name];
            var options = params[param_name];
            if (options === true) {
                // default validate
                options = validate[param_name];
            } else if (typeof options == 'string') {
                options = validate[options] || {
                    types: [options]
                };
            }

            if (param !== undefined) {
                var error_start_text = 'Parameter "' + param_name + '" = ('
                    + param + ') (type: ' + typeof param + ') ';
                if (options.types) {
                    var find = false;
                    options.types.forEach(function (type) {
                        if (typeof param == type) {
                            find = true;
                        } else if (type == 'ObjectId') {
                            if (isValidMongoId(param)) {
                                find = true;
                            }
                        } else if (type == 'array') {
                            if (Array.isArray(param)) {
                                find = true;
                            }
                        } else if (type == 'boolean') {
                            if (param == 'true' || param == 'false') {
                                find = true;
                            }
                        } else if (type == 'number') {
                            if (!isNaN(param)) {
                                find = true;
                            }
                        } else if (type == 'array_of_ids') {
                            if (Array.isArray(param)) {
                                var all_are_ids = true;
                                param.forEach(function (element) {
                                    if (!isValidMongoId(element)) {
                                        all_are_ids = false;
                                    }
                                });
                                if (all_are_ids) {
                                    find = true;
                                }
                            }
                        }
                    });
                    if (!find) {
                        throw error_start_text + 'has invalid type (available types: ' +
                        options.types + ')';
                    }
                }
                if (options.enum) {
                    if (options.enum.indexOf(param) == -1) {
                        throw error_start_text + 'must be only one of: ' + options.enum;
                    }
                }
                if (options.callback) {
                    var error = options.callback(param);
                    if (error) {
                        throw error_start_text + 'return validate error: ' + error;
                    }
                }
            }
        }
        return null;
    } catch (e) {
        log(e);
        return e.toString();
    }
};

function minTime(period, times) {
    var now = new Date().valueOf();
    var day = 1000 * 60 * 60 * 24;
    var min = now;
    switch (period) {
        case 'Day':
            min -= day * times;
            break;
        case 'Week':
            min -= day * 7 * times;
            break;
        case 'Month':
            min -= day * 31 * times;
            break;
        case 'Half Year':
            min -= day * 183;
            break;
        case 'Year':
            min -= day * 365 * times;
            break;
        case 'All':
            min = 0;
            break;
    }
    return min;
}

exports.minTime = minTime;

function createResponse(code, data) {
    if (config.test_mode && code != 200 && code != 901) {
        log(log_warning('true code: ' + code));
    }
    return {
        status: code,
        data: data || {}
    };
}

exports.createResponse = createResponse;

/**
 * @param {string} s1 Исходная строка
 * @param {string} s2 Сравниваемая строка
 * @param {object} [costs] Веса операций { [replace], [replaceCase], [insert], [remove] }
 * @return {number} Расстояние Левенштейна
 */
function levenshtein(s1, s2, costs) {
    var i, j, l1, l2, flip, ch, chl, ii, ii2, cost, cutHalf;
    l1 = s1.length;
    l2 = s2.length;

    costs = costs || {};
    var cr = costs.replace || 1;
    var cri = costs.replaceCase || costs.replace || 1;
    var ci = costs.insert || 1;
    var cd = costs.remove || 1;

    cutHalf = flip = Math.max(l1, l2);

    var minCost = Math.min(cd, ci, cr);
    var minD = Math.max(minCost, (l1 - l2) * cd);
    var minI = Math.max(minCost, (l2 - l1) * ci);
    var buf = new Array((cutHalf * 2) - 1);

    for (i = 0; i <= l2; ++i) {
        buf[i] = i * minD;
    }

    for (i = 0; i < l1; ++i, flip = cutHalf - flip) {
        ch = s1[i];
        chl = ch.toLowerCase();

        buf[flip] = (i + 1) * minI;

        ii = flip;
        ii2 = cutHalf - flip;

        for (j = 0; j < l2; ++j, ++ii, ++ii2) {
            cost = (ch === s2[j] ? 0 : (chl === s2[j].toLowerCase()) ? cri : cr);
            buf[ii + 1] = Math.min(buf[ii2 + 1] + cd, buf[ii] + ci, buf[ii2] + cost);
        }
    }
    return buf[l2 + cutHalf - flip];
}

exports.levenshtein = levenshtein;

function getIntervals(from, to, step, unit) {
    var intervals = [];
    from = typeof from != 'object' ? new Date(from) : from;
    to = typeof to != 'object' ? new Date(to) : to;

    while (from.valueOf() <= to.valueOf()) {
        var milliseconds = 0;
        switch (unit) {
            case 'hour':
                milliseconds = 1000 * 60 * 60;
                break;
            case 'day':
                milliseconds = 1000 * 60 * 60 * 24;
                break;
            case 'month':
                milliseconds = 1000 * 60 * 60 * 24 * 30;
                break;
        }
        var end_of_step = new Date(from.valueOf() + step * milliseconds);

        intervals.push({
            start: from,
            end: end_of_step
        });
        from = end_of_step;
    }

    return intervals;
}

exports.getIntervals = getIntervals;

function searchNew(start, end) {
    return {
        createdAt: {
            $gte: start,
            $lte: end
        }
    };
}

exports.searchNew = searchNew;

function searchTotal(end) {
    return {
        createdAt: {
            $lte: end
        }
    };
}

exports.searchTotal = searchTotal;

function toOneLevelObject(anyLevelObject) {
    var result = {};
    toOneLevelObjectHelper(result, '', anyLevelObject);
    return result;
}

function toOneLevelObjectHelper(result, path, value) {
    //typeof ['s'] == 'object' (arrays has object type)
    if (Array.isArray(value)) {
        value.forEach(function (oneElement, index) {
            toOneLevelObjectHelper(result, path + '[' + index + ']', oneElement);
        });
    }
    else if (typeof value == 'object') {
        if (path) {
            path += '_';//if '.' instead of '_' json2xls do not see fields in object
        }
        for (var key in value) {
            toOneLevelObjectHelper(result, path + key, value[key]);
        }
    } else {
        var obj = {};
        obj[path] = value;
        Object.assign(result ,obj);
    }
}

exports.toOneLevelObject = toOneLevelObject;