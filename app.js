var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var routes = require('./routes/index');
var users = require('./routes/users');

//import the mongodb native drivers.
var mongodb = require('mongodb');
//work with "MongoClient" interface 
var MongoClient = mongodb.MongoClient;

var app = express();

//open websocket
var ws = require('ws').Server;
var wss = new ws({port:(7778)});
var qwe = 0;
var intID = 0;

// mongodb connection url
var url = 'mongodb://192.168.99.100:27017/EMG';
var mongodb;
var collection;


MongoClient.connect(url, function (err, db) {
  if (err) {
    console.log('Unable to connect to the mongodb. Error: ', err);
  } else {
	  
    console.log('Connection established to', url);
	
	mongodb = db;
	collection = db.collection('subjects');
  }
});


//make sure mongodb closes
process.on('SIGINT', function() {
	mongodb.close();
    process.exit(0);
});


wss.on('connection', function chat(ws){
	
	intID = setInterval(function(){
		var num = 500 + Math.random() * 20;
		wss.clients.forEach(function each(client) {
			client.send(JSON.stringify({"name" : "EMG", "message": num}));
		});
		
		collection.insert({output: 1, 'input': [500,100,233,444,555,666,7777,8888]}, function (err, result) {
			if (err) {
				console.log(err);
			} else {
				console.log('The documents inserted with "_id" are:', JSON.stringify(result));
			}
		});
		
	}, 1000);   
	console.log('Client connected');
	
	ws.on('message', function message(message){
		console.log(message);
		//console.log(wss.clients);
		ws.send(JSON.stringify({"name" : "EMG", "message": qwe}));
		
	});
	ws.on('close', function close() {
		  	ws.close();
			clearInterval(intID);
			
	});
	
	ws.send("hello");
});



/*
//open serial port 
var SerialPort = require("serialport").SerialPort;
var serialport = new SerialPort("COM6");
serialport.on('open', function(){
  console.log('Serial Port Opend');
  serialport.on('data', function(data){
      console.log(data[0]);
			  wss.clients.forEach(function each(client) {
				client.send(JSON.stringify({"name" : "EMG", "message": data[0]}));
			  });
  });
});*/


// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', routes);
app.use('/users', users);


app.post('/qwe',function(req, res, next) {
  res.send(JSON.stringify({"data":["James", "Kenny", "Fred"]}));
});


// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});



module.exports = app;
