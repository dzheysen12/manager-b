var mongoose = require('mongoose');
var config = require('../config.js');
var db = mongoose.connect(config.mongo.url, {
    useMongoClient: true,
    /* other options */
});

console.log(config.mongo.url);

db.on('error', console.error.bind(console, 'Mongo connection error:'));

db.once('open', function callback () {
    console.log('Mongo ' + config.mongo.url + ' connected!');
});
mongoose.Promise = global.Promise;
module.exports = mongoose;

