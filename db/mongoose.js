var mongoose = require('mongoose');
var config = require('../config.js');

var MONGODB_URI = process.env.MONGOLAB_URI || process.env.MONGOHQ_URL || "mongodb://localhost", // Make sure to replace that URI with the one provided by MongoLab
  db,
  users;

var db = mongoose.connect(MONGODB_URI, {
    useMongoClient: true,
    /* other options */
});

db.on('error', console.error.bind(console, 'Mongo connection error:'));

db.once('open', function callback () {
    console.log('Mongo ' + config.mongo.url + ' connected!');
});
mongoose.Promise = global.Promise;
module.exports = mongoose;

