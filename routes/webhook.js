var express = require('express');
var router = express.Router();
var CRMorder = require('../db/models/CRMorder.js');
var PushNotification = require('../db/models/PushNotification.js');
var Bot = require('../db/models/Bot.js');
var Message = require('../db/models/Message.js');
var Setting = require('../db/models/Setting.js');
var config = require('../config.js');

const dialogflow = require('dialogflow');
const sessionClient = new dialogflow.SessionsClient({
    keyFilename: config.dialogflow.GOOGLE_APPLICATION_CREDENTIALS
});

const contextsClient = new dialogflow.ContextsClient({
    keyFilename: config.dialogflow.GOOGLE_APPLICATION_CREDENTIALS
});

const projectId = config.dialogflow.project_id; //https://dialogflow.com/docs/agents#settings
const split_for_get_botid = 'split_for_get_botid';

var passport = require('passport');
require('../passport')(passport);

var my = require('../helpers/functions.js');
var log = console.log;
var log_error = my.log_error;
var log_warning = my.log_warning;
var util = require('util');

var FCM = require('fcm-node');
var fcm = new FCM(config.notifications.gcmKey);
router.post('/test_notify', function(req, res, next) {
    var message = {
        to: '',
        data: {
            order_id: 'ObjectId'
        }
    };

    fcm.send(message, function(err, response){
        if (err) {
            log(log_error(err));
        } else {
            log(response);
        }
    });
});

function findService(text, services) {
    text = text || '';
    var found;

    services.forEach(function (service) {
        if (service.name.toLowerCase() == text.toLowerCase()) {
            found = service;
        }
    });

    if (found) {
        return found;
    }

    services.forEach(function (service) {
        if (service.name.includes(text)) {
            found = service;
        }
    });

    if (found) {
        return found;
    }

    services.forEach(function (service) {
        var diff = my.levenshtein(service.name, text);
        if (diff < 4) {
            found = service;
        }
    });

    if (found) {
        return found;
    }
}

function findNearestTime(timestamp, service, employee, employee_crm_orders) {
    var time_is_free = false;
    const {workIntervals, serviceTime, notWorkDays} = employee.position.schedule;
    const weekday_number = new Date(timestamp).getDay();
    const ending_timestamp = timestamp + serviceTime * 1000 * 60;

    for (var i = 0; i < workIntervals[weekday_number].length; i++) {
        const interval = workIntervals[weekday_number][i];
        var period_start = new Date(timestamp);
        period_start.setHours(interval.Start.Hours)
        period_start.setMinutes(interval.Start.Minutes);
        period_start = period_start.valueOf();
        var period_end = new Date(timestamp);
        period_end.setHours(interval.End.Hours)
        period_end.setMinutes(interval.End.Minutes);
        period_end = period_end.valueOf();
        if (my.isInnerInterval({
                start: timestamp,
                end: ending_timestamp
            }, {
                start: period_start,
                end: period_end
            })) {
            time_is_free = true;
            for (var j = 0; j < employee_crm_orders.length; j++) {
                const crm_order = employee_crm_orders[j];

                const crm_order_start = crm_order.time.valueOf();
                const crm_order_end = crm_order.time.valueOf()
                    + serviceTime * 1000 * 60;

                if ((crm_order_start >= timestamp && crm_order_start < ending_timestamp)
                    || (crm_order_end > timestamp && crm_order_end <= ending_timestamp)) {
                    time_is_free = false;
                    return findNearestTime(crm_order_end, service, employee, employee_crm_orders);
                }
            }
        }

        if (time_is_free) {
            return timestamp;
        } else {
            return findNearestTime(timestamp + 1000 * 60 * 60 * 24,
                service, employee, employee_crm_orders);
        }
    }
}

function findFreeEmployee(time, service, employees, crm_orders) {
    if (typeof time != 'object') {
        time = new Date(time);
    }
    const timestamp = time.valueOf();
    var time_is_valid_for_work_schedule = false;
    var time_is_not_in_schedule_responses = [];
    var error_responses = [];
    var nearest_times = [];

    for (var i = 0; i < employees.length; i++) {
        const employee = employees[i];
        const position = employee.position;
        if (position && isArray(position.services) && my.find(position.services, {
                _id: service._id
            })) {
            //если рабочий имеет должность и должность имеет нужную услугу
            const {workIntervals, serviceTime, notWorkDays} = position.schedule;
            const ending_timestamp = timestamp + serviceTime * 1000 * 60;
            time_is_not_in_schedule_responses = [];
            time_is_not_in_schedule_responses.push('Это не рабочее время');
            time_is_not_in_schedule_responses.push('Рабочее время:');
            const weekday_number = new Date(timestamp).getDay();
            for (var i = 0; i < workIntervals[weekday_number].length; i++) {
                const interval = workIntervals[weekday_number][i];
                time_is_not_in_schedule_responses.push('От ' + interval.Start.Hours + ":"
                    + interval.Start.Minutes + ' До '
                    + interval.End.Hours + ":" + interval.End.Minutes);

                var period_start = new Date(timestamp);
                period_start.setHours(interval.Start.Hours)
                period_start.setMinutes(interval.Start.Minutes);
                period_start = period_start.valueOf();
                var period_end = new Date(timestamp);
                period_end.setHours(interval.End.Hours)
                period_end.setMinutes(interval.End.Minutes);
                period_end = period_end.valueOf();
                if (my.isInnerInterval({
                        start: timestamp,
                        end: ending_timestamp
                    }, {
                        start: period_start,
                        end: period_end
                    })) {
                    //если время заявки соответсвует рабочему графику
                    time_is_valid_for_work_schedule = true;
                    const employee_crm_orders = my.find(crm_orders, {
                        employee: employee._id
                    });
                    for (var j = 0; j < employee_crm_orders.length; j++) {
                        const crm_order = employee_crm_orders[j];
                        const crm_order_start = crm_order.time.valueOf();
                        const crm_order_end = crm_order.time.valueOf()
                            + serviceTime * 1000 * 60;

                        if ((crm_order_start >= timestamp
                                && crm_order_start <= ending_timestamp)
                            || (crm_order_end >= timestamp
                                && crm_order_end <= ending_timestamp)) {
                            //время занято
                            nearest_times.push(findNearestTime(crm_order_end, service,
                                employee, employee_crm_orders));
                        } else {
                            return {
                                error: false,
                                employee: employee
                            };
                        }
                    }
                }
            }
        }
    }

    if (time_is_valid_for_work_schedule) {
        nearest_times.sort(function (a, b) {
            return a - b;
        });

        error_responses = ['Это время уже занято',
            'Ближайшее свободное время: ' + new Date(nearest_times[0]).toLocaleString()];

        return {
            error: true,
            responses: error_responses.concat(['На какое время хотите записаться?'])
        };
    } else {
        return {
            error: true,
            responses:
                time_is_not_in_schedule_responses.concat(['На какое время хотите записаться?'])
        };
    }
}

router.post('/hook', function (req, res, next) {
    var q = req.body;
    var {session} = q;
    const botid = session.split(split_for_get_botid)[1];
    const sessionId = session.split('/')[session.split('/').length - 1];

    if (config.test_mode) {
        log('sessionId - ' + sessionId);
        log('BotID - ' + botid);
        log(util.inspect(q));
    }

    var {fulfillmentText, fulfillmentMessages, outputContexts, parameters, intent}
        = q.queryResult;
    var intentObj = {
        name: intent.displayName.toLowerCase().replace(/\ /g, '_'),//заменим пробелы на _
        id: intent.name.split('/').pop()
    }
    intent = intent ? intent.displayName : intent;
    if (config.test_mode) {
        log('Intent is: ' + intent);
    }

    var response = {
        fulfillmentText: fulfillmentText,
        fulfillmentMessages: fulfillmentMessages,
        outputContexts: outputContexts
    };
    function deleteAllContexts() {
        outputContexts.forEach(function (context) {
            response.outputContexts = [];
            context.lifespanCount = 0;
            response.outputContexts.push(context);
        });
    }

    function setParam(param_name, value) {
        response.outputContexts.forEach(function (context) {
            context.parameters[param_name] = value;
            context.parameters[param_name + '.original'] = value;
        });
    }

    function exceptParam(param_name, intent, lifespanCount) {
        // если какой то параметр не валиден в ответе отправляем уточнение параметра
        // и запускаем эту функцию для настройки контекста ожидания параметра
        var newParameters = {};
        var required_contexts = [
            {
                exist: false,
                name: intent.name + '_dialog_context',
                lifespanCount: 2
            },
            {
                exist: false,
                name: intent.id + '_id_dialog_context',
                lifespanCount: 2
            },
            {
                exist: false,
                name: intent.name + '_dialog_params_' + param_name,
                lifespanCount: lifespanCount || 2
            }
        ];

        outputContexts.forEach(function (context) {
            if (context.name.includes('_dialog_params_')) {
                //если это контекст ожидающий required параметр для intent
                //удаляем все прочие контексты ожидающие какой-либо параметр
                context.lifespanCount = 0;
            } else {
                context.parameters[param_name] = '';
                context.parameters[param_name + '.original'] = '';
                newParameters = context.parameters;
                //получаем копию параметров без того параметра который мы будем ожидать
            }

            required_contexts.forEach(function (requiredContext) {
                if (context.name.includes(requiredContext.name) && context.lifespanCount > 0) {
                    requiredContext.exist = true;
                }
            });
            response.outputContexts.push(context);
        });

        required_contexts.forEach(function (requiredContext) {
            if (!requiredContext.exist) {
                requiredContext.parameters = newParameters;
                addContext(requiredContext);
            }
        });
    }

    function addContext(context) {
        const contextName = contextsClient.contextPath(
            projectId,
            sessionId,
            context.name
        );

        response.outputContexts.push({
            name: contextName,
            lifespanCount: context.lifespanCount,
            parameters: context.parameters
        });
    }

    function setResponseText(text) {
        setArrayOfTextResponses([text]);
        response.fulfillmentText = text;
    }

    function setArrayOfTextResponses(array_of_text_responses) {
        // если нужно ответить сразу несколькими сообщениями
        response.fulfillmentMessages = [];
        array_of_text_responses.forEach(function (text) {
            response.fulfillmentMessages.push({
                text: {
                    text: [text]
                }
            });
        });
    }

    return Bot.findOne({
        _id: botid
    }).populate({
        path: 'user',
        populate: {
            path: 'tariff'
        }
    }).populate({
        path: 'employees',
        populate: {
            path: 'position',
            populate: {
                path: 'services'
            }
        }
    }).then(function (bot) {
        if (bot) {
            var { user } = bot;
            if (!user) {
                setResponseText('Владелец не найден!');
                return res.json(response);
            }

            /*
            if (!user.tariff || !user.tariffEnd) {
                setResponseText('Тариф не подключен!');
                return res.json(response);
            } else if (user.tariffEnd < new Date()) {
                setResponseText('Время действия тарифа истекло!');
                return res.json(response);
            }*/

            var services = [];

            bot.employees.forEach(function (employee) {
                if (employee.position && employee.position.services) {
                    services = services.concat(employee.position.services);
                }
            });

            const current_orders_search = {
                time: {
                    $gt: new Date()
                },
                employee: {
                    $in: bot.employees.map(function (employee) {
                        return employee._id;
                    })
                }
            };

            if (intent == 'Booking') {
                if (services.length == 0) {
                    deleteAllContexts();
                    setResponseText('Ни одной услуги не найдено');
                    return res.json(response);
                }

                var {contacts, service, time, name} = parameters;
                var found_service = service ? findService(service, services) : undefined;

                if (service && !found_service) {
                    var responses = [];
                    responses.push('У нас нет услуги \'' + service + '\'');
                    responses.push('Выберите услугу из списка:');
                    services.forEach(function (service) {
                        responses.push('* \'' + service.name +
                            '\' - ' + service.price + 'руб');
                    });

                    setArrayOfTextResponses(responses);
                    exceptParam('service', intentObj);
                    return res.json(response);
                } else {
                    return CRMorder.find(current_orders_search).then(function (crm_orders) {
                        var free_employee = time ? findFreeEmployee(time, found_service
                            , bot.employees, crm_orders) : undefined;

                        if (time && free_employee.error) {
                            setArrayOfTextResponses(free_employee.responses);
                            exceptParam('time', intentObj);
                            return res.json(response);
                        } else {
                            if (contacts && found_service && time && name) {
                                setResponseText('Вы записались на услугу - ' + found_service.name +
                                    '(' + found_service.price + ' руб), на имя - ' + name +
                                    ', ваши контакты - ' + contacts + ', время записи' +
                                    time + '.Все верно?');
                                return res.json(response);
                            } else {
                                return res.json(response);
                            }
                        }
                    }, function (err) {
                        log(log_error(util.inspect(err)));
                        setResponseText('Ошибка на сервере при поиске заявкок!');
                        return res.json(response);
                    });

                }
            }
            else if (intent == 'Booking - yes') {
                const {contacts, service, time, name} = parameters;
                const found_service = findService(service, services);

                return CRMorder.find(current_orders_search).then(function (crm_orders) {
                    const free_employee = findFreeEmployee(time, found_service,
                        bot.employees, crm_orders);

                    const employee = free_employee.employee;

                    var newCRMorder = new CRMorder({
                        name: name,
                        time: time,
                        contacts: contacts,
                        service: found_service._id,
                        bot: q.botid,
                        user: bot.user._id,
                        sessionId: sessionId,
                        employee: employee._id
                    });

                    newCRMorder.save().then(function (ok) {
                        return res.json(response);
                    }, function (err) {
                        log(log_error(util.inspect(err)));
                        setResponseText('Ошибка на сервере при создании заявки!');
                        return res.json(response);
                    });
                }, function (err) {
                    log(log_error(util.inspect(err)));
                    setResponseText('Ошибка на сервере при поиске заявкок!');
                    return res.json(response);
                });
            }
            else if (intent == 'ShowOrders' || intent == 'CancelOrder') {
                return CRMorder.find({
                    sessionId: session
                }).populate({
                    path: 'service'
                }).populate({
                    path: 'employee'
                }).sort({
                    'createdAt': 'asc'
                }).then(function (orders) {
                    if (orders.length > 0) {
                        var {order_index} = parameters;

                        if (intent == 'ShowOrders' || !order_index) {
                            var responses = [];

                            orders.forEach(function (order, i) {
                                var service_name = order.service ? order.service.name
                                    : 'Услуга была удалена из системы';

                                var service_price = order.service ? order.service.price
                                    : 'Услуга была удалена из системы';

                                var employee_name = order.employee ?
                                    order.employee.name + ' ' + order.employee.surname
                                    : 'Исполнитель был удален из системы';

                                responses.push(i + ': ' + 'Клиент=' + order.name
                                    + 'Контакты Клиента=' + order.contacts
                                    + ' Услуга=' + service_name
                                    + ' Цена=' + service_price
                                    + ' Время записи=' + order.time.toLocaleString()
                                    + ' Исполнитель=' + employee_name);
                            });

                            setArrayOfTextResponses(responses);
                        } else {
                            orders[order_index].remove();
                        }

                        return res.json(response);
                    } else {
                        setResponseText('Ни одной заявки не найдено');
                        return res.json(response);
                    }
                }, function (err) {
                    log(log_error(util.inspect(err)));
                    setResponseText('Ошибка на сервере при поиске заявкок!');
                    return res.json(response);
                });
            }
            else {
                return res.json(response);
            }
        } else {
            setResponseText('Бот с данным botid не найден');
            return res.json(response);
        }
    }, function (err) {
        log(log_error(util.inspect(err)));
        setResponseText('Некорректный botid');
        return res.json(response);
    });
});

router.post('/send_message', function (req, res, next) {
    var q = req.body;
    var not_enough_parameters = my.checkParams(q, ['text', 'botid']);
    if (not_enough_parameters) {
        return res.json(my.createResponse(902));
    }

    var validateError = my.validateError(q, {
        text: 'string',
        botid: 'ObjectId'
    });

    if (validateError) {
        return res.json(my.createResponse(904));
    }

    return Setting.findOne({
        name: 'message_price'
    }).then(function (message_price) {
        if (message_price) {
            message_price = message_price.value;
            return Bot.findOne({
                _id: q.botid
            }).populate({
                path: 'user'
            }).then(function (bot) {
                if (bot) {
                    var { user } = bot;
                    if (user) {
                        if (user.activate) {
                            if (user.money >= message_price) {
                                user.money -= message_price;
                                user.save().then(function (ok) {}, function (err) {
                                    log(log_error(util.inspect(err)));
                                });
                                dialogflowCall();
                            } else {
                                res.json(my.createResponse(200, ['Не хватает средств для ' +
                                'отправки сообщения']));
                            }
                        } else {
                            res.json(my.createResponse(200, ['Ваш аккаунт еще не был оплачен']));
                        }
                    } else {
                        log(log_warning('User connected ' +
                            'to bot with _id = ' + q.botid + ' not found'));
                        res.json(my.createResponse(906));
                    }
                } else {
                    log(log_warning('Bot with _id = ' + q.botid + ' not found'));
                    res.json(my.createResponse(906));
                }
            }, function (err) {
                log(log_error(util.inspect(err)));
                res.json(my.createResponse(904));
            });
        } else {
            log(log_error('Settings \'message_price\' not found'));
            res.json(my.createResponse(906));
        }
    }, function (err) {
        log(log_error(util.inspect(err)));
        res.json(my.createResponse(904));
    });
    
    function dialogflowCall() {
        var ip = req.header('x-forwarded-for') || req.connection.remoteAddress;

        const sessionId = ip + split_for_get_botid + q.botid;
        const sessionPath = sessionClient.sessionPath(projectId, sessionId);

        const request = {
            session: sessionPath,
            queryInput: {
                text: {
                    text: q.text,
                    languageCode: 'ru-RU'
                }
            }
        };

        var newMessage = new Message({
            request: q.text,
            sessionId: sessionId,
            bot: q.botid
        });

        sessionClient.detectIntent(request)
            .then(function (dialogflow_responses) {
                if (config.test_mode) {
                    log(util.inspect(dialogflow_responses));
                }

                const result = dialogflow_responses[0].queryResult;
                var responses = [];

                if (result.fulfillmentMessages && result.fulfillmentMessages.length > 0) {
                    result.fulfillmentMessages.forEach(function (message) {
                        responses = responses.concat(message.text.text);
                    });
                }
                newMessage.responses = responses;
                newMessage.intent = result.intent.displayName;
                newMessage.raw_response = dialogflow_responses;
                newMessage.save().then(function (ok) {}, function (err) {
                    log(log_error(util.inspect(err)));
                });
                res.json(my.createResponse(200, responses));
            })
            .catch(function (err) {
                newMessage.responses = ['Remote api error'];
                newMessage.raw_response = err;
                newMessage.save().then(function (ok) {}, function (err) {
                    log(log_error(util.inspect(err)));
                });
                log('Dialogflow error:');
                log(log_error(util.inspect(err)));
                res.json(my.createResponse(500));
            });
    }
});

module.exports = router;
