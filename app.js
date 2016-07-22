var ACTION_NONE = 0,
	ACTION_RECORD = 1,
	ACTION_PLAYBACK = 2,
	ACTION_RESULT = 3;

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
var SerialPort = require("serialport").SerialPort;
var serialport = null;			 //used to create serial read session


/*	***********************************************
	Must edit this accordingly on different system
	***********************************************
*/
var displayRefreshPeriod = 10;	 //miliseconds the webpage graph will refresh
var wss = new ws({port:(7778)}); //port number must be consistent with UI's javascript
var systemSerialPort = "COM6";   //check device manager


var schedulerID = 0;

// mongodb connection url
var url = 'mongodb://192.168.99.100:27017/EMG';
var mongodb;
var collName;
var collSignal;
var collTmp;

var signalGroupName = "";
var signalGroupID;
var actionState = ACTION_NONE;



MongoClient.connect(url, function (err, db) {
  if (err) {
    console.log('Unable to connect to the mongodb. Error: ', err);
  } else {
	  
    console.log('Connection established to', url);
	
	mongodb = db;
	collName = db.collection('signalGroups');	//unique signal id
	collSignal = db.collection('signals');	//stores all signals
	collTmp = db.collection('tmp');			//tmp storage of signals
  }
});


//make sure mongodb closes
process.on('SIGINT', function() {
	mongodb.close();
    process.exit(0);
});


wss.on('connection', function chat(ws){
	
	console.log('Client connected');
	
	ws.on('message', function message(message){
		console.log(message);
		//console.log(wss.clients);
		ws.send(JSON.stringify({"name" : "EMG", "message": "Black Asshole"}));
		
	});
	ws.on('close', function close() {
		
		actionState = ACTION_NONE;
		clearInterval(schedulerID);
		ws.close();	
	});
	
	ws.send("hello");
});


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

app.engine('html', require('ejs').renderFile);




//controller menu
app.post('/getCollections',function(req, res, next) {
	/////////////
	collName.find({},{signalGroupName:1, signalGroupID:1}).toArray(function(err, docs) {
		
		//console.log(JSON.stringify(docs));
		//check if the signal exist in the database		
		if(docs.length > 0){
			var signalGroupArray = [];
			docs.forEach(function(signalGroup, index){
				signalGroupArray.push({name: signalGroup.signalGroupName, ID: signalGroup.signalGroupID});
				
			});
			//console.log("qwe " + JSON.stringify(signalGroupArray));
			res.send(JSON.stringify({"data":signalGroupArray}));/////
			//res.status(500).send('Cannot find specified signal in database');
		} else {
			res.send(JSON.stringify({"data":[]}));
		}
	});
	
	
});

app.post('/graph', function(req, res) {
	/////////////
	console.log("signalgroupid in /graph " + req.body.ID);
	signalGroupID = parseInt(req.body.ID);
	
	//load mongoDB status
	
	collName.find({signalGroupID:signalGroupID},{signalGroupID:1,signalGroupName:1}).toArray(function(err, docs) {
		  
		console.log(JSON.stringify(docs));
		
		//check if the signal exist in the database		
		if(docs.length > 0){
			
			signalGroupID = docs[0].signalGroupID;
			signalGroupName = docs[0].signalGroupName;
			actionState = ACTION_NONE;
			
			res.render('graph.html');
		} else {
			res.status(500).send('Cannot find specified signal in database');
		}
	});
	
	//res.render('index', { title: 'Express' });
});

app.post('/newGraph', function(req, res) {
	
	signalGroupID = Date.now();
	signalGroupName = "";
	actionState = ACTION_NONE;
	
	collName.insert({'signalGroupName': signalGroupName, 'signalGroupID': signalGroupID}, function (err, result) {
		if (err) {
			console.log(err);
		} else {	
			res.render('graph.html');
			//console.log('The documents inserted with "_id" are:', JSON.stringify(result));
		}
	});
	
	//load mongoDB status
	
	//res.render('index', { title: 'Express' });
});

//graph view
app.post('/getChannels',function(req, res, next) {
	res.send(JSON.stringify({"channels": [1], "signalGroupName": signalGroupName}));
  //res.status(500).send('Something broke!');
});



var EMGValue= null;
var recordEMG = function(){
	
	//var num = 500 + Math.random() * 20;
	wss.clients.forEach(function each(client) {
		client.send(JSON.stringify({"name" : "EMG", "values": [EMGValue]}));
	});
	
	uploadEMGToDB();

				
};

function uploadEMGToDB(){
	
	collTmp.insert({output: 1, 'input': [EMGValue], 'timeStamp': Date.now(), 'signalGroupID': signalGroupID}, function (err, result) {
		if (err) {
			console.log(err);
		} else {
			//console.log('The documents inserted with "_id" are:', JSON.stringify(result));
		}
	});
};

//graph view
app.post('/record',function(req, res, next) {
	
	if (actionState == ACTION_NONE){
		
		serialport = new SerialPort(systemSerialPort);
		serialport.on('open', function(){
			console.log('Serial port opened');
			serialport.on('data', function(data){
			
				//console.log(data[0]);
				EMGValue = data[0];
			});
		});
		
			
		schedulerID = setInterval( recordEMG, displayRefreshPeriod); 
		
		actionState = ACTION_RECORD;
	} else if(actionState == ACTION_RECORD){
		
		clearInterval(schedulerID);
		serialport.close(function (err) {
			console.log('port closed, Error: ', null != err);
		});
		serialport = null;
		actionState = ACTION_NONE;
	} else {
		res.status(500).send('Server resource claimed by another action');
	}
	
	res.send(JSON.stringify({"channels": [1]}));
});

var tmpNum = 0;

function playbackEMG(){
	//.limit(1)
	collSignal.find({timeStamp:{$gt: tmpNum}}).limit(1).toArray(function(err, docs) {
		  //console.log(signalGroupID);
		
		//console.log(docs[0]);
		
		if(docs[0]){
			//console.log(docs.length);
			tmpNum = docs[0].timeStamp;
			
			//var num = 500 + Math.random() * 20;
			wss.clients.forEach(function each(client) {
				client.send(JSON.stringify({"name" : "EMG", "values": docs[0].input}));
			});
		} else {
			collTmp.find({timeStamp:{$gt: tmpNum}}).limit(1).toArray(function(err2, docs2) {
				//console.log("qwe" + docs2.length);
				//console.log(docs[0]);
				
				if(docs2[0]){
					tmpNum = docs2[0].timeStamp;
					
					wss.clients.forEach(function each(client) {
						client.send(JSON.stringify({"name" : "EMG", "values": docs2[0].input}));
					});
				} else {
					tmpNum = 0;
				}

			});
		}

	});

				
};

//graph view
app.post('/playback',function(req, res, next) {
	if (actionState == ACTION_NONE){
			
		schedulerID = setInterval( playbackEMG, displayRefreshPeriod); 
		
		actionState = ACTION_PLAYBACK;
	} else if(actionState == ACTION_PLAYBACK){
		
		clearInterval(schedulerID);
		actionState = ACTION_NONE;
	} else {
		res.status(500).send('Server resource claimed by another action');
	}
	
	res.send(JSON.stringify({"channels": [1]}));
});

//graph view
app.post('/save',function(req, res, next) {
	console.log(req.body.signalGroupName);
	var newSignalGroupName = req.body.signalGroupName;
	
	if (actionState == ACTION_NONE){
		if (newSignalGroupName){
			//update signal name 
			collName.update({ signalGroupID: signalGroupID },{"$set": { "signalGroupName": newSignalGroupName}},{ upsert: true });
			
			//move signal values from tmp to official
			collTmp.find({ signalGroupID: signalGroupID }).toArray(function(err, docs) {
				  //console.log(signalGroupID);
				console.log(docs.length);
				
				console.log(docs[0]);
				if(docs.length > 0) {
					docs.forEach(function each(signal, index){
						collSignal.insert(signal, function (err, result) {
							if (err) {
								console.log(err);
							} else {
								//console.log('The documents inserted with "_id" are2222:', JSON.stringify(result));
							}
						});
					});
				}
			});
			collTmp.drop();
			res.send(JSON.stringify({"channels": [1]}));
		} else {
			res.status(500).send('Signal name cannot be empty');
		}
	} else {
		res.status(500).send('Server resource claimed by another action');
	}
	
});

//graph view
app.post('/cancel',function(req, res, next) {
	
	if (actionState == ACTION_NONE){
		collName.find({ signalGroupID: signalGroupID }, {signalGroupName:1}).toArray(function(err, docs) {
			
			if(docs[0]) {
				if (docs[0].signalGroupName == ""){
					collName.remove( { signalGroupName: signalGroupName }, true );
				}
			} else {
				res.status(500).send('Signal group entry does not exist');
			}
		});
			
		collTmp.drop();
		signalGroupID = null;
		signalGroupName = "";
		actionState = ACTION_NONE;
		res.send(JSON.stringify({"channels": [1]}));
		
	} else {
		res.status(500).send('Server resource claimed by another action');
	}
	
});

//graph view
app.post('/delete',function(req, res, next) {
	
	if (actionState == ACTION_NONE){
		
		collSignal.remove( { signalGroupID: signalGroupID }, false );
		collName.remove( { signalGroupName: signalGroupName }, true );
		collTmp.drop();
		signalGroupID = null;
		signalGroupName = "";
		actionState = ACTION_NONE;
		res.send(JSON.stringify({"channels": [1]}));
		
	} else {
		res.status(500).send('Server resource claimed by another action');
	}
	
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
