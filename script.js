
<iframe
  src="https://jupyterlite.github.io/demo/repl/index.html?kernel=python&toolbar=1"
  width="100%"
  height="500px"
>
</iframe>

document.addEventListener('keydown', keyDownHandler, false);

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
ctx.canvas.width  = Math.floor(0.9*window.innerWidth);
ctx.canvas.height = Math.floor(0.9*window.innerHeight);
const size = canvas.width/30;
const speed = 30;

const shape1_1 = [
	[1, 1, 1],
	[0, 1, 0],
];

const shape1_2 = [
	[1, 0],
	[1, 1],
	[1, 0],
];

const shape1_3 = [
	[0, 1, 0],
	[1, 1, 1],
];

const shape1_4 = [
	[0, 1],
	[1, 1],
	[0, 1],
];

const shape2_1 = [
	[1, 0],
	[1, 1],
	[0, 1],
];

const shape2_2 = [
	[0, 1, 1],
	[1, 1, 0],
];

const shape3_1 = [
	[1, 0],
	[1, 0],
	[1, 1],
];

const shape3_2 = [
	[0, 0, 1],
	[1, 1, 1],
];

const shape3_3 = [
	[1, 1],
	[0, 1],
	[0, 1],
];

const shape3_4 = [
	[1, 1, 1],
	[1, 0, 0],
];

const shape4_1 = [
	[1, 1],
	[1, 1],
];

const shape5_1 = [
	[1],
	[1],
	[1],
	[1],
];

const shape5_2 = [
	[1, 1, 1, 1],
];

const shapes1 = [shape1_1, shape1_2, shape1_3, shape1_4];
const shapes2 = [shape2_1, shape2_2];
const shapes3 = [shape3_1, shape3_2, shape3_3, shape3_4];
const shapes4 = [shape4_1];
const shapes5 = [shape5_1, shape5_2];
const all_shapes = [shapes1, shapes2, shapes3, shapes4, shapes5]
const colors = ["pink", "green", "orange", "gold", "blue"]
var shapes = [new Shape(),];

function Shape() {
	this.random = Math.floor(Math.random() * all_shapes.length);
	this.shapes = all_shapes[this.random];
	this.color = colors[this.random];
	this.index = 0;
	this.shape = this.shapes[this.index];
	this.pos = {x: 0, y: 0};
	this.coordinates = {top_left_x: -1, top_left_y: -1,
		top_right_x: -1, top_right_y: -1,
		bottom_left_x: -1, bottom_left_y: -1,
		bottom_right_x: -1, bottom_right_y: -1,
	};
	
	this.nextShape = function(){
		if(this.index++ >= this.shapes.length - 1){
			this.shape = this.shapes[0];
			this.index = 0;
		}
		else{
			this.shape = this.shapes[this.index];
		}
	}
	
	this.findCornerCoordinates = function(){
	//Top-Left, Top-Right, Down-Left, Down-Right
		var temp = [-1, this.pos.y, -1, this.pos.y, -1, this.pos.y + size*this.shape.length, -1, this.pos.y + size*this.shape.length]
		for(var i = 0; i < this.shape.length; i++){
			for(var j = 0; j < this.shape[i].length; j++){
				if(this.shape[i][j] != 0) {
					//finding x coordinates on the top
					if(i == 0) {
						//furthest to the left
						if(temp[0] == -1){
							temp[0] = this.pos.x + size*j;
							temp[2] = this.pos.x + size*(j+1);
						}
						//furthest to the right
						else if(temp[2] < j + this.pos.x + size*(j+1)){
							temp[2] = this.pos.x + size*(j+1);
						}
					}
					//finding x coordinates at the bottom
					if(i == this.shape.length - 1) {
						//furthest to the left
						if(temp[4] == -1){
							temp[4] = this.pos.x + size*j;
							temp[6] = this.pos.x + size*(j+1);
						}
						//furthest to the right
						else if(temp[6] < j + this.pos.x + size*(j+1)){
							temp[6] = this.pos.x + size*(j+1);
						}					
					}
				}
			}
		}
		this.coordinates.top_left_x = temp[0];
		this.coordinates.top_left_y = temp[1];
		this.coordinates.top_right_x = temp[2];
		this.coordinates.top_right_y = temp[3];
		this.coordinates.bottom_left_x = temp[4];
		this.coordinates.bottom_left_y = temp[5];
		this.coordinates.bottom_right_x = temp[6];
		this.coordinates.bottom_right_y = temp[7];
	}
	
	this.drawShape = function(){
			for(var i = 0; i < this.shape.length; i++){
				for(var j = 0; j < this.shape[i].length; j++){
					if(this.shape[i][j] != 0) {
						ctx.fillStyle = this.color;
						ctx.fillRect(this.pos.x + size*j, this.pos.y + size*i, size, size);
					}
				}
			}
		
	}
	this.checkIfEmpty = function(){
		for(var i = 0; i < this.shape.length; i++){
			for(var j = 0; j < this.shape[i].length; j++){
				if(this.shape[i][j] != 0) {
					for(var k = -1; k < size; k++){
						if(!checkIfBlackWhite(ctx.getImageData(this.pos.x + size*j, this.pos.y + size*i + k, 1, 1).data)){
							return false;
						}
					}
				}
			}
		}
		return true;
	}
}

function checkIfBlackWhite(arr){
	if(arr[0] == 255 && arr[1] == 255 && arr[2] == 255){
		return true;
	}
	if(arr[0] == 0 && arr[1] == 0 && arr[2] == 0){
		return true;
	}
	return false;
}

function draw() {
	shapes[shapes.length-1].pos.y++;
	drawBackground();
	for(var i = 0; i < shapes.length - 1; i++) {
		shapes[i].drawShape();
	}
	if(shapes[shapes.length-1].checkIfEmpty()){
		shapes[shapes.length-1].drawShape();
	}
	else {
		shapes.push(new Shape());
	}
	checkBorder();
	setTimeout(draw, speed);
}

function drawBackground(){
	ctx.fillStyle = 'rgb(255,255,255)';
	ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function checkBorder(){
	shapes[shapes.length-1].findCornerCoordinates();
	if(Math.min(shapes[shapes.length-1].coordinates.top_left_x, shapes[shapes.length-1].coordinates.bottom_left_x) < 0 ){
		shapes[shapes.length-1].pos.x = 0;
	}
	if(Math.max(shapes[shapes.length-1].coordinates.top_right_x, shapes[shapes.length-1].coordinates.bottom_right_x) > canvas.width ){
		shapes[shapes.length-1].pos.x = size*Math.floor(canvas.width/size)-size*shapes[shapes.length-1].shape[0].length;
	}
	if(shapes[shapes.length-1].coordinates.bottom_left_y > canvas.height){
		shapes[shapes.length-1].pos.y = canvas.height - (shapes[shapes.length-1].coordinates.bottom_left_y - shapes[shapes.length-1].coordinates.top_left_y);
		shapes.push(new Shape());
	}
}

function keyDownHandler(event) {
  var x = event.keyCode;
  //left arrow
  if (x == 37) {
	shapes[shapes.length-1].pos.x -= size;
  }
  //right arrow
  else if (x == 39) {
	shapes[shapes.length-1].pos.x += size;
  }
  //up arrow
  else if (x == 38) {
	shapes[shapes.length-1].nextShape();
  }
  //down arrow
  else if (x == 40) {
	shapes[shapes.length-1].pos.y += size;
  }
}

/*
$('#canvas').mousemove(function(e) {
	var pos = findPos(this);
	var x = e.pageX - pos.x;
	var y = e.pageY - pos.y;
	var coord = "x=" + x + ", y=" + y;
	var p = ctx.getImageData(x, y, 1, 1).data; 
	$('#status').html(coord + "<br>" + 'rgb ' + p[0] + ',' + p[1] + ',' + p[2]);
});

function findPos(obj) {
    var curleft = 0, curtop = 0;
    if (obj.offsetParent) {
        do {
            curleft += obj.offsetLeft;
            curtop += obj.offsetTop;
        } while (obj = obj.offsetParent);
        return { x: curleft, y: curtop };
    }
    return undefined;
}*/

//main
draw();
