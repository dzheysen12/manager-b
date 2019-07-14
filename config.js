var config = {
    frontend: 'http://localhost:3000/',
    mongo: {
        url: 'mongodb://localhost:27017/ai_bots'
    },
    passport: {
        secret:' dJkre98LopwqE1'//for jwt token
    },
    port: '4800',
    files: {
        translations: __dirname + '/uploads/translations/',
        help_documents: __dirname + '/uploads/help_pages/',
        export: __dirname + '/uploads/export/',
        photos: __dirname + '/uploads/photos/'
    },
    mail: {
        host: '',
        user: '',
        pass: '',
        from: '',
        port: 465,
        secure: true,
        auth: true,
    },
    redis: {
        host: '127.0.0.1',
        port: '6379'
    },
    email_confirmation: false,
    test_mode: true,
    dialogflow: {
        project_id: 'test-8c627',
        GOOGLE_APPLICATION_CREDENTIALS: __dirname
        + '/GOOGLE_APPLICATION_CREDENTIALS/Test-d519ebd83d17.json'
    },
    notifications: {
        //Google cloud messaging
        gcmKey: 'AAAAkJkGh1E:APA91bGRJK439NW3l3Mlqmyv_8VsrMdYGat9cdUbFSggHqq725RKWIpRXuh-' +
        '0xjUObochJZ95yIW1dVIfEDIgidulriuUYBxUuV7yVxD6g6j9KbKLN-wuWvaRO8--qQrXTcA6Jnza9qv'
    },
    Yandex: {
        Payment: {
            Api: 'https://payment.yandex.net/api/v3/payments',
            Test: false,
            ShopId: '177433',
            Password: 'tvergOf4tMK6PXWE',
            Scid: '717597'
        }
    }
};

module.exports = config;
