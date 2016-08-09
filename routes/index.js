var ws = require('ws').Server;
var wsClient = require('ws');
var debug = require('debug')('UI');

var ACTION_NONE = 0,
	ACTION_RECORD = 1,
	ACTION_PLAYBACK = 2,
	ACTION_TEST = 3;

module.exports = function (settings, dataaccess){
	
	//open websocket, this may take a while
	var WSConn = {
		UI: new ws({port:(settings.UIWebsocketPort)}),
		sampler: new ws({port:(settings.SamplerWebsocketPort)}),
		TLC: null//new wsClient('ws://' + settings.TLCIP + ':' + settings.TLCWebsocketPort + '/')
	};
	
	//define server action states (sas)
	var sas = {
		schedulerID: 0,
		signalGroupName: "",
		signalGroupID: null,
		actionState: ACTION_NONE,
		channelVal: [],
		maxChannelNum: settings.maxChannelNumber,
		tmpTimestamp: 0,
		samplerActionFunction: null
	};
	
	WSConn.UI.on('connection', function chat(ws){
		console.log('UI client connected');
		
		ws.on('message', function message(message){
			//console.log(message);
			ws.send(JSON.stringify({"name" : settings.databaseName, "message": "Black Asshole"}));
			
		});
		ws.on('close', function close() {
			dataaccess.clearTmpData();
			clearSAS();
			
			console.log('Client connection closed');
		});
	});
	
	WSConn.sampler.on('connection', function chat(wsSample){
		console.log('Sampler client connected');
		
		wsSample.on('message', function message(message){
			console.log("Message from sampler: " + message);
			
			var data = JSON.parse(message);
			
			if(sas.actionState == ACTION_RECORD || sas.actionState == ACTION_TEST){
				if ( data.input && data.input.length == sas.channelVal.length ){ 
					sas.samplerActionFunction(data);
					
				} else {
					console.log("Error, data fields not properly defined");
				}
				
			} else if(data.command == "store"){
				if(dataaccess.isDBOnline()){
					if ( (data.input && data.input.length <= sas.maxChannelNum) && data.output && data.signalGroupID){
					
						//require signal ID
						signalInfo = {'signalGroupID': data.signalGroupID};
						
						dataaccess.insertNewSignalDirectly(signalInfo, data.output, data.input, function(err){
							if(err){
								ws.send(JSON.stringify({"status" : "Error"}));
							}
						});
					} else {
						console.log("Error, data fields not properly defined");
					}
				} else {
					console.log("Error inserting to database. Database not online");
					
				}
			}
			
		});
		
		wsSample.on('close', function close() {
			
			if (sas.actionState == ACTION_RECORD || sas.actionState == ACTION_TEST){
				sas.actionState = ACTION_NONE;
				sas.samplerActionFunction = null;
				stopUIAction();
				console.log("current recording action stopped");
			}
			
			console.log("connection to sampler closed");
			wsSample.close();
		});
		
	});
	
	module.index = function(req, res, next){
			res.render('index');
	};
	
	module.getSignalGroups = function (req, res, next){
		if (dataaccess.isDBOnline()){
			dataaccess.getSignalGroupList(function (err, signalGroupArray){
				if(err){
					res.status(500).send('Cannot querying collection list. Error: ' + err);
				} else {
					res.send(JSON.stringify({"data":signalGroupArray}));
				}
			});
			
		} else {
			res.status(500).send('Cannot establish connection to the database');
		}
	};
	
	module.graph = function (req, res, next){
		
		console.log("signalgroupid in /graph " + req.body.ID);
		signalGroupID = parseInt(req.body.ID);
		
		if (dataaccess.isDBOnline()){
			dataaccess.getSignalGroupDetails(signalGroupID, function (err, signalGroup){
				if(err){
					res.status(500).send('Cannot query specified signal in database. Error: ' + err);
				} else {
					
					if(signalGroup) {
						sas.signalGroupID = signalGroup.signalGroupID;
						sas.signalGroupName = signalGroup.signalGroupName;
						sas.actionState = ACTION_NONE;
						
						//channel array values determine the channel's UI display name
						for(i = 0; i < signalGroup.channelNum; i++)	
							sas.channelVal.push(i + 1);
						
						res.render('graph', { WSPort: settings.UIWebsocketPort });
						
					} else {
						res.status(500).send('Cannot find specified signal in database');
					}
				}
			});
			
		} else {
			res.status(500).send('Cannot establish connection to the database');
		}
	};
	
	module.newGraph = function (req, res, next){
		
		if (dataaccess.isDBOnline()){
			
			//create new signal group profile
			sas.signalGroupID = Date.now();
			sas.signalGroupName = "";
			sas.actionState = ACTION_NONE;
			sas.channelVal.push(0);
			
			dataaccess.insertNewSignalGroup(sas, function (err){
				if(err) {
					res.status(500).send('Error inserting new signal group. Error: ' + err);
					
				} else {
					res.render('graph', { WSPort: settings.UIWebsocketPort });
				}
				
			});
		} else {
			res.status(500).send('Cannot establish connection to the database');
		}
	};
	
	module.getSignalGroupInfo = function(req, res, next){
		
		res.send(JSON.stringify({"channels": sas.channelVal, "signalGroupName": sas.signalGroupName}));
	};
	
	module.record = function(req, res, next){
		//if no samplers are connected
		if (WSConn.sampler.clients.length == 0){
			res.status(500).send('No samplers are connected');
		} else {
			
			if (dataaccess.isDBOnline()){
			
				if (sas.actionState == ACTION_NONE){
					
					sas.samplerActionFunction = function (data){
						uploadEMGToDB(data);
						sendChannelValuesToUI(data);
					};
					
					startSampler();
					sas.actionState = ACTION_RECORD;
					res.send(JSON.stringify({"result": "record start success"}));
				} else if(sas.actionState == ACTION_RECORD){
					
					stopSampler();
					sas.samplerActionFunction = null;
					sas.actionState = ACTION_NONE;
					res.send(JSON.stringify({"result": "record stop success"}));
				} else {
					res.status(500).send('Server resource claimed by another action');
				}
			} else {
				res.status(500).send('Cannot establish connection to the database');
			}
		}
	};
	
	module.testTLC = function(req, res, next){
		//if no samplers are connected
		if (WSConn.sampler.clients.length == 0){
			res.status(500).send('No samplers are connected');
		} else {
			if (sas.actionState == ACTION_NONE){
				
				useTLC(function(err){
						
					if(err){
						res.status(500).send('Cannot establish connection to the TLC. ' + err);
					} else {
						//WSConn.TLC.on('message', function(message) {}); //use this to get TLC output
						sas.samplerActionFunction = function (data){
								uploadEMGToTLC(data);
								sendChannelValuesToUI(data);
						};
						
						startSampler(); 
						sas.actionState = ACTION_TEST;
						res.send(JSON.stringify({"result": "TLC dynamic learning start success"}));
					}
				});
				
			} else if(sas.actionState == ACTION_TEST){
				
				stopSampler();
				sas.samplerActionFunction = null;
				sas.actionState = ACTION_NONE;
				res.send(JSON.stringify({"result": "TLC dynamic learning stop success"}));
			} else {
				res.status(500).send('Server resource claimed by another action');
			}
		}
	};
	
	module.playback = function(req, res, next) {
		
		if (dataaccess.isDBOnline()){
			
			if (sas.actionState == ACTION_NONE){
				
				sas.schedulerID = setInterval( playbackEMG, settings.UIDataTransferPeriod); 
				sas.actionState = ACTION_PLAYBACK;
				res.send(JSON.stringify({"result": "playback start success"}));
			} else if(sas.actionState == ACTION_PLAYBACK){
				
				clearInterval(sas.schedulerID);
				sas.actionState = ACTION_NONE;
				res.send(JSON.stringify({"result": "playback stop success"}));
			} else {
				res.status(500).send('Server resource claimed by another action');
			}
		} else {
			res.status(500).send('Cannot establish connection to the database');
		}
	}
	
	module.save = function(req, res, next){
		var newSignalGroupName = req.body.signalGroupName;
		
		if (dataaccess.isDBOnline()){
			if (sas.actionState == ACTION_NONE){
				if (newSignalGroupName){
					//update signal name 
					sas.signalGroupName = newSignalGroupName;
					dataaccess.updateSignalGroupName(sas, function(){
						
						//move signal values from tmp to official
						dataaccess.saveTmpSignal(sas, function (err){
							if(err){
								res.status(500).send('Signals cannot be saved. Error' + err);
							} else {
								res.send(JSON.stringify({"result": "save signals success"}));
							}
						});
					});
					
				} else {
					res.status(500).send('Signal name cannot be empty');
				}
			} else {
				res.status(500).send('Server resource claimed by another action');
			}
			
		} else {
			res.status(500).send('Cannot establish connection to the database');
		}
		
	};
	
	module.cancel = function(req, res, next){
		
		if (dataaccess.isDBOnline()){
			if (sas.actionState == ACTION_NONE){
				dataaccess.clearTmpData();
				clearSAS();
				
				res.send(JSON.stringify({"result": "cancel success"}));
				
			} else {
				res.status(500).send('Server resource claimed by another action');
			}
		} else {
			res.status(500).send('Cannot establish connection to the database');
		}
	};
	
	module.add = function(req, res, next){
		
		if (dataaccess.isDBOnline()){
			if (sas.actionState == ACTION_NONE){
				
				dataaccess.addChannelToSignalGroup(sas, function (err){
					if(err){
						res.status(500).send("Cannot update channel number. Error: " + err);
					} else {
						res.send(JSON.stringify({"result": "channel number update success"}));
					}
					
				});
			} else {
				res.status(500).send('Server resource claimed by another action');
			}
		} else {
			res.status(500).send('Cannot establish connection to the database');
		}
	};
	
	module.deleteSignalGroup = function(req, res, next){
		if (dataaccess.isDBOnline()){
			if (sas.actionState == ACTION_NONE){
				
				dataaccess.deleteSignalGroup(sas);				
				dataaccess.clearTmpData();
				clearSAS();
				
				res.send(JSON.stringify({"result": "delete signals success"}));
				
			} else {
				res.status(500).send('Server resource claimed by another action');
			}
		} else {
			res.status(500).send('Cannot establish connection to the database');
		}
	};
	
	function clearSAS(){
		
		if (sas.actionState != ACTION_NONE && WSConn.sampler.clients.length > 0){
			stopSampler();
		}
		
		clearInterval(sas.schedulerID);
		sas.signalGroupID = null;
		sas.signalGroupName = "";
		sas.actionState = ACTION_NONE;
		sas.channelVal = [];	
	};
	
	function startSampler(){
		WSConn.sampler.clients.forEach(function each(client) {
			client.send(JSON.stringify({"command" : "start"}), function(err){
				
				if(err){
					console.log("Cannot send start command to sampler. Error: " + err);
				}
			});
		});
	};
	
	function stopSampler(){
		WSConn.sampler.clients.forEach(function each(client) {
			client.send(JSON.stringify({"command" : "stop"}), function(err){
				
				if(err){
					console.log("Cannot send stop command to sampler. Error: " + err);
				}
			});
		});
	};
	
	function uploadEMGToDB(data){
		//console.log(signalGroupID);
		
		dataaccess.insertNewSignalTmp(sas, 1, data.input, function(err){ //data.output
			
			if(err){
				console.log("Cannot insert new signal to database. Error: " + err);
			}
		});
		
	};
	
	function uploadEMGToTLC(data){
		
		WSConn.TLC.send(JSON.stringify({"name" : settings.databaseName, "output": 1, "input": data.input})); //data.output
	};
	
	function playbackEMG(){
		
		dataaccess.getSignals(sas, 1, function(err, newTimestamp, signal){
			
			if(err){
				console.log("Cannot query signals from database for playback. Error: " + err);
			} else {
				
				sas.tmpTimestamp = newTimestamp;
				if(signal){
					sendChannelValuesToUI(signal);
					
				} else {
					console.log("No signal found for playback, replay signals");
				}
			}
		});
	};
	
	function sendChannelValuesToUI(data){
		
		WSConn.UI.clients.forEach(function each(client) {
			client.send(JSON.stringify({"name" : settings.databaseName, "input": data.input}), function(err){ //"output":data.output
				//error sending websocket client  info
				if (err){
					console.log("Fail to send client channel data. Error: " + err);
					
				}
			});
		});
	};
	
	function stopUIAction(){
		
		WSConn.UI.clients.forEach(function each(client) {
			client.send(JSON.stringify({"command":"stop"}), function(err){
				//error sending websocket client  info
				if (err){
					console.log("Cannot send commands to UI client. Error: " + err);
					
				}
			});
		});
	};
	
	//wrapper to establish connection to the TLC websocket server and send request
	function useTLC(callback){
		
		if(WSConn.TLC){
			callback(null);
			
		} else {
			
			WSConn.TLC = new wsClient('ws://' + settings.TLCIP + ':' + settings.TLCWebsocketPort + '/');
		
			//the error or open function will be triggered initially
			WSConn.TLC.on('error', function(err) {
				
				console.log("Error with connection to the TLC. " + err);
				WSConn.TLC.close();
				WSConn.TLC = null;
				callback(err);
			});
			
			WSConn.TLC.on('open', function() {
				console.log("Connection to the TLC established");
				
				WSConn.TLC.on('error', function(err) {
					if (sas.actionState == ACTION_TEST){
						stopUIAction();
						stopSampler();
						sas.samplerActionFunction = null;
						sas.actionState = ACTION_NONE;
						
						console.log("current TLC test action stopped");
					}
					
					console.log("Error with connection to the TLC. " + err);
					WSConn.TLC.close();//test this
					WSConn.TLC = null;
				});
				
				callback(null);
			});
			
			
			//this will never initially be run
			WSConn.TLC.on('close', function(message) {
				if (sas.actionState == ACTION_TEST){
					stopUIAction();
					stopSampler();
					sas.samplerActionFunction = null;
					sas.actionState = ACTION_NONE;
					
					console.log("current TLC test action stopped");
				}
				
				console.log("Connection to the TLC closed. Msg: " + message);
				WSConn.TLC = null;
			});
		}
	};
	
	return module;
};
