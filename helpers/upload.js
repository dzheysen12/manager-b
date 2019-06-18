var config = require('../config.js');
var my = require('./functions.js');
var multer = require('multer');
var path = require('path');

var storage = multer.diskStorage({
    destination: function (req, file, callback) {
        callback(null, config.files.photos);
    },
    filename: function (req, file, callback) {
        callback(null, Date.now() + my.findExt(file.originalname));
    }
});
var upload = multer({
    storage: storage,
    limits: {
        fileSize: 1024 * 1024,
    },
    fileFilter: function (req, file, callback) {
        var ext = path.extname(file.originalname);
        if(ext !== '.png' && ext !== '.jpg' && ext !== '.gif' && ext !== '.jpeg') {
            return callback(new Error('Only images are allowed'));
        }
        callback(null, true);
    }
});

module.exports = function (field) {
    return upload.single(field);
};
