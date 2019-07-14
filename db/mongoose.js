var mongoose = require('mongoose');
var config = require('../config.js');
var db = mongoose.connect("mongodb://Vasya12345:Vasya12345@ds119738.mlab.com:19738/heroku_1sl1m4q3", {
    useMongoClient: true,
    /* other options */
});
db.on('error', console.error.bind(console, 'Mongo connection error:'));

db.once('open', function callback () {
    console.log('Mongo ' + config.mongo.url + ' connected!');
});
mongoose.Promise = global.Promise;
module.exports = mongoose;

