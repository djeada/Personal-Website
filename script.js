document.addEventListener('keydown', keyDownHandler, false);

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d')
const size = 30;
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
}

function draw() {
	shapes[shapes.length-1].pos.y++;
	drawBackground();
	for(var i = 0; i < shapes.length; i++) { 
		shapes[i].drawShape();
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
		shapes[shapes.length-1].pos.x = canvas.width - (Math.max(shapes[shapes.length-1].coordinates.top_right_x, shapes[shapes.length-1].coordinates.bottom_right_x)-Math.min(shapes[shapes.length-1].coordinates.top_left_x, shapes[shapes.length-1].coordinates.bottom_left_x));
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

//main
draw();