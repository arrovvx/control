$(document).ready(function(){

	var ws = null;
	var wsID = null;
	
	//function called to connect to the websocket on the server end
	function WSConnect(){
		var serverURL = window.location.hostname;
		var serverPort = window.location.port;
		var wsPort = $("#WSPort").val();	

		//check if websocket is supported
		if ("WebSocket" in window) {
			
			//create connection
			ws = new WebSocket("ws://" + serverURL + ":" + wsPort + "/");

			//this function be deleted
			ws.onopen = function(){
				ws.send("Notice me senpai");
			};
			
			ws.onmessage = function (serverRes){
				var data = JSON.parse(serverRes.data);
				if (wsID == null) wsID = data.ID;
				ws.onmessage = null;
			};			

			ws.onclose = function() { 
			
				clearActions();
				ws = null;					
				console.log("Connection is closed...");	
			};
		} else {
			alert("WebSocket NOT supported");
		}
	};	
	
	var processCommand = function (WSRes){
		//alert(WSRes);
		var data = JSON.parse(WSRes.data);
		
		if (data.name == "MDOutput")
			$("#display").append(data.output);
		else
			$("#keyboard").append(data.output);

		/*if(data.command == "stop"){
			clearActions();
			
		} else {
			var values = data.input;
			
			plotStates.forEach(function each(state, index){
				var input = parseFloat(values[index]); 	//probably don't need this
				updatePlot(state, input);
			});

			//debugging purposes
			if (debugLog){
				var messageBox = document.getElementById("messageBox");
				messageBox.innerHTML += "<div>Channel Values: "+values.toString()+"\n"+"</div>";
			}
			
			var output = data.output;
		}*/
	};
	
	//connect to server
	WSConnect();
	
	//start button handler, tell the server to start the test scenario
	$( "#start" ).click(function() {
	
		$.ajax({
			type: "POST",
			url: "/realTestActivate",
			contentType: 'application/json',
			data: JSON.stringify({"ID": wsID}),
			success: function(data, status, xhr) {
				if (ws.onmessage){
					ws.onmessage = null;
					$("#start").toggleClass('btn-default');
					$("#start").html( "Start");
				} else {
					ws.onmessage = processCommand;
					$("#start").toggleClass('btn-default');
					$("#start").html( "Stop");
				}
			},
			
			error: function(xhr, status, error) {
				alert("Error in Real Test! Server response: " + xhr.responseText); //error ___ is still active
			}
		});
	});
});