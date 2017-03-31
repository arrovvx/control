var curserTimeID = 0;
var message = "";
var selectLevel = 3; //default is 3, then 2, then 1
var keyboard = [
'A','B','C','D','E','F','G',
'H','I','J','K','L','M','N',
'O','P','Q','R','S','T','U',
'V','W','X','Y','Z','1','2',
'3','4','5','6','7','8','9',
'0','.',',',';',':','!','?',
'"',"'",'[',']','(',')','space','delete'];
var selectedKeys;

function mini(x, y){
	if (x > y)
		return y;
	
	return x;
};

function selectKeys(keys, section, level){
	subSize = Math.pow(4,level - 1);

	newKeys = keys.slice(section*subSize, mini((section + 1)*subSize, keys.length));
	
	return newKeys;
	
};

function makeColumn(keys){
	
	var newCol0 = "";
	
	for(var i = 0; i < 4; i++){
		var newCol = "";
		var size = Math.pow(4, 2);
		var K = keys.slice(i*size, mini((i + 1)*size, keys.length));
		//console.log("K " + K.length);
		if (K.length == 2){
				newCol = newCol.concat("<div class='level2 row-lg-6'>" + K[0] + "</div>" + "<div class='level2 row-lg-6'>" + K[1] + "</div>");
				
		} else {
			for (var i2 = 0; i2 < 4; i2++){
				var newCol2 = "";
				var size2 = Math.pow(4, 1);
				var K2 = K.slice(i2*size2, mini((i2 + 1)*size2, K.length));
				//console.log("K2 " + K2.length);
				
				for (var i3 = 0; i3 < 4; i3++){
					var newCol3 = "";
					var size3 = Math.pow(4, 0);
					var K3 = K2.slice(i3*size3, mini((i3 + 1)*size3, K2.length));
					//console.log("K3 " + K3.length);
					newCol2 = newCol2.concat("<div class='level3 col-lg-3'>" + K3[0] +  "</div>");
				}
				
				
				newCol = newCol.concat("<div class='level2 row-lg-3'>" + newCol2 +  "</div>");
			}
		}
		
		newCol0 = newCol0.concat("<div class='level1 col-lg-3' id='level1-" + i + "'>" + newCol +  "</div>");
	}
	
	return newCol0;
};

function makeColumn2(keys){
	
	var newCol = "";
	
	if (keys.length == 2){
			newCol = newCol.concat("<div class='level1 col-lg-6'>" + keys[0] + "</div>" + "<div class='level1 col-lg-6'>" + keys[1] + "</div>");
			
	} else {
		for (var i2 = 0; i2 < 4; i2++){
			var newCol2 = "";
			var size2 = 4;
			var K2 = keys.slice(i2*size2, mini((i2 + 1)*size2, keys.length));
			//console.log("K2 " + K2.length);
			
			for (var i3 = 0; i3 < 2; i3++){
				var newCol3 = "";
				var size3 = 2;
				var K3 = K2.slice(i3*size3, mini((i3 + 1)*size3, K2.length));
				//console.log("K3 " + K3.length);
				newCol2 = newCol2.concat("<div class='level22 row-lg-6'><div class='level2 col-lg-6'>" + K3[0] + "</div>" + "<div class='level22 col-lg-6'>" + K3[1] + "</div></div>");
			}
			
			newCol = newCol.concat("<div class='level1 col-lg-3' id='level1-" + i2 + "'>" + newCol2 +  "</div>");
		}
	}
		
	
	return newCol;
};

function makeColumn3(keys){
	
	var newCol = "";
	
	if (keys.length == 2){
			newCol = newCol.concat("<div class='level1 col-lg-6'>" + keys[0] + "</div>" + "<div class='level1 col-lg-6'>" + keys[1] + "</div>");
			
	} else {
		for (var i2 = 0; i2 < 4; i2++){
			var newCol2 = "";
			var size2 = 1;
			var K2 = keys.slice(i2*size2, mini((i2 + 1)*size2, keys.length));
			//console.log("K2 " + K2.length);
			
			newCol = newCol.concat("<div class='level1 col-lg-3' id='level1-" + i2 + "'>" + K2[0] +  "</div>");
		}
	}
		
	
	return newCol;
};

function makeSliderCol(keys){
	
	var newCol = "<div id='slider-box'>";
	
	for (var i = 0; i < keys.length; i++){
		
		newCol = newCol.concat("<div class='slider-col col-lg-12' id='slider-col-" + i + "'>" + keys[i] +  "</div>");
	}
	
	return newCol.concat("</div>");
};


function cursorAnimation() {
	$('#cursor').animate({
		opacity: 0
	}, 'fast', 'swing').animate({
		opacity: 1
	}, 'fast', 'swing');
};

function type() {
	$('#message').html(message.substr(0,captionLength));
	
    
	/*$('#message').html(caption.substr(0, captionLength++));
    if(captionLength < caption.length+1) {
        setTimeout('type()', 100);
    } else {
        captionLength = 0;
        caption = '';
    }*/
};

function clearText(){
	var position = $('#message').offset();
			
	$('#cursor').hide();
	$('#displayLevel1').css({"position":"absolute", "left": position.left, "top":position.top});
	$('#displayLevel1').animate({opacity: 0}, {queue: false, duration: 170});
	$('#displayLevel1').animate({left: '+=650', top:'-=150'}, 80).animate({left: '+=360', top:'-=200'},{
								duration: 100,
								complete:function(){
									$('#cursor').show();
									$('#message').html('');
									$("#displayLevel1").css({"position":"static", "opacity": '1'});
									$("#displayLevel1").show();
								}
							});
};

function sendText(){
	$('#cursor').hide();
	$('#displayLevel1').animate({opacity: 0}, {queue: false, duration: 300});
	$("#displayLevel1").animate({"width": 'toggle'},
							{duration: 350,
							complete:function(){
								$('#cursor').show();
								$('#message').html('');
								$("#displayLevel1").css({"margin-right": '1px', "opacity": '1'});
								$("#displayLevel1").show();
							}
						});
};

var captionLength = 0;
var state = 0;

$(document).ready(function(){

	var ws = null;
	var wsID = null;
	var wsSim = false;
	
	var stage = 0;

//K = selectKeys(keyboard, 0,3);
//alert(selectKeys(K, 0,2));


//$("#keyboard").html(makeColumn3(selectKeys(selectKeys(keyboard, 0,3), 1,2)));
	selectedKeys = keyboard
	$("#keyboard").html(makeColumn(selectedKeys));
	$("#slider").html(makeSliderCol(selectKeys(selectedKeys, 0, selectLevel)));
	
	//start button handler, tell the server to start the test scenario
	$( "#start" ).click(function() {
		if (wsSim){
			wsSim = false;
			$("#start").toggleClass('btn-default');
			$("#start").html( "Start");
		} else {
			wsSim = true;
			$("#start").toggleClass('btn-default');
			$("#start").html( "Stop");
		}
		
		if(stage == 0){
			
			$( "#level1-0" ).css({"background-color": "#aa0000"});
		} else if(stage == 1){
			selectedKeys = selectKeys(selectedKeys, 0, selectLevel);
			selectLevel -= 1;
			$("#keyboard").html(makeColumn2(selectedKeys));
			$( "#level1-0" ).css({"background-color": "#FFFFFF"});
			
		} else if(stage == 2){
			$( "#level1-1" ).css({"background-color": "#aa0000"});
			
		} else if(stage == 3){
			selectedKeys = selectKeys(selectedKeys, 1, selectLevel);
			selectLevel -= 1;
			$("#keyboard").html(makeColumn3(selectedKeys));
			$( "#level1-1" ).css({"background-color": "#FFFFFF"});
			
		} else if(stage == 4){
			$( "#level1-3" ).css({"background-color": "#aa0000"});
		} else if(stage == 5){
			
			$( "#level1-3" ).css({"background-color": "#FFFFFF"});
			message = message.concat(selectedKeys[3]);
			$('#message').html(message);
			selectedKeys = keyboard
			$("#keyboard").html(makeColumn(selectedKeys));
			selectLevel = 3;
			
		} else if(stage == 6){
			
			$( "#level1-0" ).css({"background-color": "#aa0000"});
		} else if(stage == 7){
			selectedKeys = selectKeys(selectedKeys, 0, selectLevel);
			selectLevel -= 1;
			console.log(selectedKeys);
			$("#keyboard").html(makeColumn2(selectedKeys));
			$( "#level1-0" ).css({"background-color": "#FFFFFF"});
			
		} else if(stage == 8){
			$( "#level1-1" ).css({"background-color": "#aa0000"});
			
		} else if(stage == 9){
			selectedKeys = selectKeys(selectedKeys, 1, selectLevel);
			selectLevel -= 1;
			$("#keyboard").html(makeColumn3(selectedKeys));
			$( "#level1-1" ).css({"background-color": "#FFFFFF"});
			
		} else if(stage == 10){
			$( "#level1-0" ).css({"background-color": "#aa0000"});
		} else if(stage == 11){
			
			$( "#level1-0" ).css({"background-color": "#FFFFFF"});
			message = message.concat(selectedKeys[0]);
			$('#message').html(message);
			selectedKeys = keyboard
			$("#keyboard").html(makeColumn(selectedKeys));
			selectLevel = 3;
			
			
		} else if(stage == 12){
			
			$( "#level1-0" ).css({"background-color": "#aa0000"});
		} else if(stage == 13){
			selectedKeys = selectKeys(selectedKeys, 0, selectLevel);
			selectLevel -= 1;
			console.log(selectedKeys);
			$("#keyboard").html(makeColumn2(selectedKeys));
			$( "#level1-0" ).css({"background-color": "#FFFFFF"});
			
		} else if(stage == 14){
			$( "#level1-2" ).css({"background-color": "#aa0000"});
			
		} else if(stage == 15){
			selectedKeys = selectKeys(selectedKeys, 2, selectLevel);
			selectLevel -= 1;
			$("#keyboard").html(makeColumn3(selectedKeys));
			$( "#level1-2" ).css({"background-color": "#FFFFFF"});
			
		} else if(stage == 16){
			$( "#level1-3" ).css({"background-color": "#aa0000"});
		} else if(stage == 17){
			
			$( "#level1-3" ).css({"background-color": "#FFFFFF"});
			message = message.concat(selectedKeys[3]);
			$('#message').html(message);
			selectedKeys = keyboard
			$("#keyboard").html(makeColumn(selectedKeys));
			selectLevel = 3;
			
			
		} else if(stage == 18){
			
			$( "#level1-0" ).css({"background-color": "#aa0000"});
		} else if(stage == 19){
			selectedKeys = selectKeys(selectedKeys, 0, selectLevel);
			selectLevel -= 1;
			console.log(selectedKeys);
			$("#keyboard").html(makeColumn2(selectedKeys));
			$( "#level1-0" ).css({"background-color": "#FFFFFF"});
			
		} else if(stage == 20){
			$( "#level1-2" ).css({"background-color": "#aa0000"});
			
		} else if(stage == 21){
			selectedKeys = selectKeys(selectedKeys, 2, selectLevel);
			selectLevel -= 1;
			$("#keyboard").html(makeColumn3(selectedKeys));
			$( "#level1-2" ).css({"background-color": "#FFFFFF"});
			
		} else if(stage == 22){
			$( "#level1-3" ).css({"background-color": "#aa0000"});
		} else if(stage == 23){
			
			$( "#level1-3" ).css({"background-color": "#FFFFFF"});
			message = message.concat(selectedKeys[3]);
			$('#message').html(message);
			selectedKeys = keyboard
			$("#keyboard").html(makeColumn(selectedKeys));
			selectLevel = 3;
			
			
		} else if(stage == 24){
			
			$( "#level1-0" ).css({"background-color": "#aa0000"});
		} else if(stage == 25){
			selectedKeys = selectKeys(selectedKeys, 0, selectLevel);
			selectLevel -= 1;
			console.log(selectedKeys);
			$("#keyboard").html(makeColumn2(selectedKeys));
			$( "#level1-0" ).css({"background-color": "#FFFFFF"});
			
		} else if(stage == 26){
			$( "#level1-3" ).css({"background-color": "#aa0000"});
			
		} else if(stage == 27){
			selectedKeys = selectKeys(selectedKeys, 3, selectLevel);
			selectLevel -= 1;
			$("#keyboard").html(makeColumn3(selectedKeys));
			$( "#level1-3" ).css({"background-color": "#FFFFFF"});
			
		} else if(stage == 28){
			$( "#level1-2" ).css({"background-color": "#aa0000"});
		} else if(stage == 29){
			
			$( "#level1-2" ).css({"background-color": "#FFFFFF"});
			message = message.concat(selectedKeys[2]);
			$('#message').html(message);
			selectedKeys = keyboard
			$("#keyboard").html(makeColumn(selectedKeys));
			selectLevel = 3;
			
			
		} else if(stage == 30){
			
			sendText();
			stage = 109;
			message = "";
			
		} else if(stage == 110){
			
			$( "#level1-0" ).css({"background-color": "#aa0000"});
		} else if(stage == 111){
			selectedKeys = selectKeys(selectedKeys, 0, selectLevel);
			selectLevel -= 1;
			$("#keyboard").html(makeColumn2(selectedKeys));
			$( "#level1-0" ).css({"background-color": "#FFFFFF"});
			
		} else if(stage == 112){
			$( "#level1-1" ).css({"background-color": "#aa0000"});
			
		} else if(stage == 113){
			selectedKeys = selectKeys(selectedKeys, 1, selectLevel);
			selectLevel -= 1;
			$("#keyboard").html(makeColumn3(selectedKeys));
			$( "#level1-1" ).css({"background-color": "#FFFFFF"});
			
		} else if(stage == 114){
			$( "#level1-3" ).css({"background-color": "#aa0000"});
		} else if(stage == 115){
			
			$( "#level1-3" ).css({"background-color": "#FFFFFF"});
			message = message.concat(selectedKeys[3]);
			$('#message').html(message);
			selectedKeys = keyboard
			$("#keyboard").html(makeColumn(selectedKeys));
			selectLevel = 3;
			
		} else if(stage == 116){
			
			$( "#level1-0" ).css({"background-color": "#aa0000"});
		} else if(stage == 117){
			selectedKeys = selectKeys(selectedKeys, 0, selectLevel);
			selectLevel -= 1;
			console.log(selectedKeys);
			$("#keyboard").html(makeColumn2(selectedKeys));
			$( "#level1-0" ).css({"background-color": "#FFFFFF"});
			
		} else if(stage == 118){
			$( "#level1-1" ).css({"background-color": "#aa0000"});
			
		} else if(stage == 119){
			selectedKeys = selectKeys(selectedKeys, 1, selectLevel);
			selectLevel -= 1;
			$("#keyboard").html(makeColumn3(selectedKeys));
			$( "#level1-1" ).css({"background-color": "#FFFFFF"});
			
		} else if(stage == 120){
			$( "#level1-0" ).css({"background-color": "#aa0000"});
		} else if(stage == 121){
			
			$( "#level1-0" ).css({"background-color": "#FFFFFF"});
			message = message.concat(selectedKeys[0]);
			$('#message').html(message);
			selectedKeys = keyboard
			$("#keyboard").html(makeColumn(selectedKeys));
			selectLevel = 3;
			
			
		} else if(stage == 122){
			
			clearText();
			stage = -1;
			message = "";
		} 
		stage += 1;
		
	});
	
	
	curserTimeID = setInterval('cursorAnimation()', 600);
});