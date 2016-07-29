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


/*	***********************************************
	Must edit this accordingly on different system
	***********************************************
*/
var displayRefreshPeriod = 1;	 //miliseconds the webpage graph will refresh
var dockerIP = "192.168.99.100"  //docker's local ip (windows version have different ip than host machine)
var WSPort = 7778;				 //websocket port, this must be consistant with the graph.html page
var systemSerialPort = "COM6";   //check device manager


//load websocket and serial port API
var ws = require('ws').Server;
var SerialPort = require("serialport").SerialPort;
var serialport = null;			 //used to create serial read session

//open websocket, this may take a while
var wss = new ws({port:(WSPort)}); //port number must be consistent with UI's javascript


// mongodb connection mongodbURL, DB collections 
var mongodbURL = 'mongodb://192.168.99.100:27017/EMG';
var mongodb;
var collName;
var collSignal;
var collTmp;

//server action states
var schedulerID = 0;
var signalGroupName = "";
var signalGroupID;
var actionState = ACTION_NONE;
var channelVal = [];
var maxChannelNum = 2;

/////special
var tick = 1;
var tickID = 0;



MongoClient.connect(mongodbURL, function (err, db) {
  if (err) {
    console.log('Unable to connect to the mongodb. Error: ', err);
  } else {
	  
    console.log('Connection established to', mongodbURL);
	
	mongodb = db;
	collName = db.collection('signalGroups');	//unique signal id
	collSignal = db.collection('signals');	//stores all signals
	collTmp = db.collection('tmp');			//tmp storage of signals
  }
});


//make sure mongodb closes
process.on('SIGINT', function() {
	
	//same as cancel
	collName.find({ signalGroupID: signalGroupID }, {signalGroupName:1}).toArray(function(err, docs) {
		console.log(docs.toString());
		if(docs[0]) {
			if (docs[0].signalGroupName == ""){
				collName.remove( { signalGroupName: signalGroupName }, true );
			}
		}
	
		endSession();
		mongodb.close();
		process.exit(0);
	});
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
		channelVal = [];
		clearInterval(schedulerID);
		
		clearInterval(tickID);/////////////
		
		endSession();
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
	
	collName.find({signalGroupID:signalGroupID},{signalGroupID:1,signalGroupName:1,channelNum:1}).toArray(function(err, docs) {
		  
		console.log(JSON.stringify(docs));
		
		//check if the signal exist in the database		
		if(docs.length > 0){
			
			signalGroupID = docs[0].signalGroupID;
			signalGroupName = docs[0].signalGroupName;
			actionState = ACTION_NONE;
			for(i = 0; i < docs[0].channelNum; i++)	
				channelVal.push(0);
			
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
	channelVal.push(0);
	
	collName.insert({'signalGroupName': signalGroupName, 'signalGroupID': signalGroupID, 'channelNum':1}, function (err, result) {
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
	res.send(JSON.stringify({"channels": channelVal, "signalGroupName": signalGroupName}));
  //res.status(500).send('Something broke!');
});





function endSession() {
	
	collTmp.drop();
	signalGroupID = null;
	signalGroupName = "";
	actionState = ACTION_NONE;
	channelVal = [];
	
};

var recordEMG = function(){
	
	//var num = 500 + Math.random() * 20;
	wss.clients.forEach(function each(client) {
		////////////// 2 = flex, 1 = release
		if(tick < 0){
			client.send(JSON.stringify({"name" : "EMG", "values": channelVal}));
		} else {
			client.send(JSON.stringify({"name" : "EMG", "values": channelVal, "tick":tick, "output":tick}));////////
			tick *= -1;
		}
	});
	
	uploadEMGToDB();

				
};

function uploadEMGToDB(){
	//console.log(signalGroupID);
	////////////////////
	var absTick = tick;
	if (absTick < 0) absTick *= -1;
	collTmp.insert({output: absTick, 'input': channelVal, 'timeStamp': Date.now(), 'signalGroupID': signalGroupID}, function (err, result) {
		if (err) {
			console.log(err);
		} else {
			//console.log('The documents inserted with "_id" are:', JSON.stringify(result));
		}
	});
};

var readArduino = function(data){
	
}

//graph view
app.post('/record',function(req, res, next) {
	
	if (actionState == ACTION_NONE){
		
		//decode signal from arduino master fred sex
		serialport = new SerialPort(systemSerialPort);
		serialport.on('open', function(){
			console.log('Serial port opened');
			serialport.on('data', function(data){
			
				//console.log(data[0]);
				//
				for(i = 0; i < maxChannelNum; i++)
					channelVal[i] = data[0];
				//console.log((data[0]>>> 0).toString(2));
			});
		});
		
			
		schedulerID = setInterval( recordEMG, displayRefreshPeriod); 
		///////////////////
		tickID = setInterval( function(){
			if(tick == -1){
				tick = 2;
			} else if (tick == -2){
				tick = 1;
			}
		}, 1000); ///////////////////
		
		actionState = ACTION_RECORD;
	} else if(actionState == ACTION_RECORD){
		
		clearInterval(schedulerID);
		clearInterval(tickID);///////////
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
				client.send(JSON.stringify({"name" : "EMG", "values": docs[0].input, "tick":docs[0].output}));////////
			});
		} else {
			collTmp.find({timeStamp:{$gt: tmpNum}}).limit(1).toArray(function(err2, docs2) {
				//console.log("qwe" + docs2.length);
				//console.log(docs[0]);
				
				if(docs2[0]){
					tmpNum = docs2[0].timeStamp;
					
					///////special scenario	
					wss.clients.forEach(function each(client) {
						client.send(JSON.stringify({"name" : "EMG", "values": docs2[0].input, "tick":docs2[0].output}));////////
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
		///////////////////
		tickID = setInterval( function(){
			if(tick == -1){
				tick = 2;
			} else if (tick == -2){
				tick = 1;
			}
		}, 1000); ///////////////////
		
		actionState = ACTION_PLAYBACK;
		res.send(JSON.stringify({"channels": [1]}));
	} else if(actionState == ACTION_PLAYBACK){
		
		clearInterval(schedulerID);
		clearInterval(tickID);///////////
		actionState = ACTION_NONE;
		res.send(JSON.stringify({"channels": [1]}));
	} else {
		res.status(500).send('Server resource claimed by another action');
	}
	
});

//graph view
app.post('/save',function(req, res, next) {
	//console.log(req.body.signalGroupName);
	var newSignalGroupName = req.body.signalGroupName;
	
	if (actionState == ACTION_NONE){
		if (newSignalGroupName){
			//update signal name 
			collName.update({ signalGroupID: signalGroupID },{"$set": { "signalGroupName": newSignalGroupName}},{ upsert: true });
			
			//move signal values from tmp to official
			collTmp.find({ signalGroupID: signalGroupID }).toArray(function(err, docs) {
				  //console.log(signalGroupID);
				//console.log(docs.length);
				
				//console.log(docs[0]);
				if(docs && docs.length > 0) {
					docs.forEach(function each(signal, index){
						collSignal.insert(signal, function (err, result) {
							if (err) {
								console.log(err);
							} else {
								//console.log('The documents inserted:', JSON.stringify(result));
							}
						});
					});
				} else {
					//console.log(docs);
					//console.log("signalGroupID: " + signalGroupID);
					console.log(err);
				}
				collTmp.drop();
				res.send(JSON.stringify({"channels": [1]}));
				
			});
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
				
				endSession();
				res.send(JSON.stringify({"channels": [1]}));
			} else {
				endSession();
				res.status(500).send('Signal group entry does not exist');
			}
		});
		
	} else {
		res.status(500).send('Server resource claimed by another action');
	}
	
});

//graph view
app.post('/add',function(req, res, next) {
	//console.log(req.body.signalGroupNum);
	//console.log("qwe " + signalGroupID);
	if (actionState == ACTION_NONE){
		collName.find({ signalGroupID: signalGroupID }, {channelNum:1}).toArray(function(err, docs) {
			
			//console.log(JSON.stringify(docs[0]));
			if(docs[0]) {
				if (docs[0].channelNum < maxChannelNum){
					collName.update({ signalGroupID: signalGroupID },{"$set": { "channelNum": docs[0].channelNum + 1}},{ upsert: true });
					channelVal.push(0);
					res.send(JSON.stringify({"channels": [1]}));
					
				} else {
					res.status(500).send('Max number of channels reached');
				}
			} else {
				res.status(500).send('Signal group entry does not exist');
			}
		});
	} else {
		res.status(500).send('Server resource claimed by another action');
	}
	
});

//graph view
app.post('/delete',function(req, res, next) {
	
	if (actionState == ACTION_NONE){
		
		
		collSignal.remove( { signalGroupID: signalGroupID }, false );
		collName.remove( { signalGroupName: signalGroupName }, true );
		
		endSession();
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
