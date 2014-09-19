var express = require('express'),
    api     = require('./api'),
    users   = require('./accounts'),
    app     = express();

app
    .use(express.static('./public'))
    .use(users)
    .use('/api', api)
    .get('*', function (req, res) {
        if (!req.user) {
            res.redirect('/login');
        } else {
            res.sendfile('public/main.html');
        }
    })
    .listen(3000);
