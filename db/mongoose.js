var mongoose = require('mongoose');
var config = require('../config.js');

var newd =  mongo_uri = ENV['MONGODB_URI'];

var db = mongoose.connect(newd, {
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

