/*jslint node: true */

//  OpenShift sample Node application
var express = require('express'),
    fs      = require('fs'),
    app     = express(),
    eps     = require('ejs'),
    morgan  = require('morgan');
    
var http = require('http').Server(app);
var io = require('socket.io')(http);
var randomstring = require('randomstring');

Object.assign = require('object-assign');

app.engine('html', require('ejs').renderFile);
app.use(express.static('public'));
app.use(express.static('src/views'));
app.use(morgan('combined'));

app.set('views', './src/views');
app.set('view engine', 'ejs');
  
var server_port       = process.env.PORT || 8080;
var server_ip_address = process.env.IP   || process.env.OPENSHIFT_NODEJS_IP   || '127.0.0.1';

app.whiteboardSessions = [];
app.roomMembers = [];


app.get('/', function (req, res) {
    res.render('index', {title: 'hello from the app', list: [ 'a', 'b', 'c']});
});

io.on('connection', function (socket) {

    console.log('connection');

    socket.on('lineDrawn', function (msg) {
        var room = msg[0];
        if (app.whiteboardSessions == null) {
            app.whiteboardSessions = {};
        }
        var lines = app.whiteboardSessions[room];

        if (lines == null) {
            lines = [];
            app.whiteboardSessions[room] = lines;
        }
        
        lines.push(msg);

        socket.to(room).broadcast.emit('drawLine', msg);
    });

    socket.on('imageDrawn', function (msg) {
        console.log('imageDrawn');
        var room = msg[0];
        console.log('imageDrawn: ' + room);

        if (app.whiteboardSessions == null) {
            app.whiteboardSessions = {};
        }
        var lines = app.whiteboardSessions[room];

        if (lines == null) {
            lines = [];
            app.whiteboardSessions[room] = lines;
        }
        lines.push(msg);

        console.log('imageDrawn emit');
        socket.to(room).broadcast.emit('drawImage', msg);
    });

    socket.on('reset', function (msg) {
        var room = msg[0];

        console.log('reset: ' + room);
        app.whiteboardSessions[room] = [];
        socket.to(room).broadcast.emit('onReset', room);
    });

    socket.on('startSession', function (msg) {
        var randomSessionId = randomstring.generate(6);
        var message = JSON.parse(msg);

        var deviceName = message.device;

        socket.join(randomSessionId);
        console.log('startSession: ' + randomSessionId);
        socket.emit('onSessionStart',  randomSessionId);
        io.to(socket.id).emit('test');

        var room = randomSessionId;
        if (app.roomMembers == null) {
            app.roomMembers = {};
        }
        var devices = app.roomMembers[room];

        if (devices == null) {
            devices = [];
            app.roomMembers[room] = devices;
        }

        devices.push(deviceName);
        io.to(socket.id).emit('onListSessions',                                     app.roomMembers[room]);
    });

    socket.on('joinSession', function (msg) {
        console.log(msg);
        var message = JSON.parse(msg);
        var room = message.id;
        var deviceName = message.device;

        console.log('joinSession: ' + room + ' ' + deviceName);

        var response = {};

        if (app.roomMembers[room] != null) {
            socket.join(room);
            var lines = app.whiteboardSessions[room];
            setTimeout(function () {
                io.to(socket.id).emit('drawLines', lines);
            }, 500);

            var devices = app.roomMembers[room];
            devices.push(deviceName);

            response.type = 'success';
            response.message = room;

            io.to(socket.id).emit('onListSessions',                 app.roomMembers[room]);
        } else {
            response.type = 'error';
            response.message = 'Unable to find session: ' + room;
        }

        io.to(socket.id).emit('onSessionJoined', response);
    });

    socket.on('leaveSession', function (msg) {
        var message = JSON.parse(msg);
        var room = message.room;
        var deviceName = message.device;

        console.log('leaveSession: ' + msg);
        socket.leave(room);

        io.to(socket.id).emit('onSessionLeft');

        var index = app.roomMembers.indexOf(deviceName);
        if (index > -1) {
            app.roomMembers.splice(index, 1);
        }

        io.to(socket.id).emit('onListSessions', app.roomMembers[room]);
    });

    socket.on('listSessions', function (room) {
        io.to(socket.id).emit('onListSessions', app.roomMembers[room]);
    });
});

// error handling
app.use(function (err, req, res, next) {
    console.error(err.stack);
    res.status(500).send('Something bad happened!');
});

http.listen(server_port, function () {
    console.log('listening on *:' + server_port);
});

module.exports = app;