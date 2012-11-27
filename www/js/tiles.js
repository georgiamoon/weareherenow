var po = org.polymaps;

var div = document.getElementById("map"),
    svg = div.appendChild(po.svg("svg")),
    g = svg.appendChild(po.svg("g"));

/*var map = po.map()
    .container(g)
    .tileSize({x: 128, y: 128})
    .angle(.3)
    .add(po.interact())
    .on("resize", resize);
	//.center(40.7145, -74.0051);

	//console.log(map.center());*/

resize();

map.add(po.layer(grid));

var rect = g.appendChild(po.svg("rect"));
rect.setAttribute("width", "50%");
rect.setAttribute("height", "50%");

function resize() {
  if (resize.ignore) return;
  var x = div.clientWidth / 2,
      y = div.clientHeight / 2;
  g.setAttribute("transform", "translate(" + (x / 2) + "," + (y / 2) + ")");
  resize.ignore = true;
  map.size({x: x, y: y});
  resize.ignore = false;
}

function queryDB(xlow, ylow, xhigh, yhigh){
	this.xlow = xlow;
	this.ylow = ylow;
	this.xhigh = xhigh;
	this.yhigh = yhigh;
	
	var data = $.get("http://weareherenow.org/query-geojson.php?xhigh="+xhigh+"&xlow="+xlow+"&yhigh="+yhigh+"&ylow="+ylow, function(data){console.log(data);});
}

 var xhigh, xlow, yhigh, ylow;
 
function grid(tile) {
  var g = tile.element = po.svg("g");

  var rect = g.appendChild(po.svg("rect")),
      size = map.tileSize();
  rect.setAttribute("width", size.x);
  rect.setAttribute("height", size.y);

  var text = g.appendChild(po.svg("text"));
  text.setAttribute("x", 6);
  text.setAttribute("y", 6);
  text.setAttribute("dy", ".71em");
  text.appendChild(document.createTextNode(tile.key));
  
  var extents = map.extent();
  
  ylow = extents[0].lat;
  xlow = extents[0].lon;
  yhigh = extents[1].lat;
  xhigh = extents[1].lon;
  
  console.log(map.extent());
  queryDB(xlow, ylow, xhigh, yhigh);
  //console.log("xlow = " + xlow + ", ylow = " + ylow + ", xhigh = " + xhigh + ", yhigh = " + yhigh);
}



var spin = 0;
setInterval(function() {
  if (spin) map.angle(map.angle() + spin);
}, 30);

function key(e) {
  switch (e.keyCode) {
    case 65: spin = e.type == "keydown" ? -.004 : 0; break;
    case 68: spin = e.type == "keydown" ? .004 : 0; break;
  }
}

window.addEventListener("keydown", key, true);
window.addEventListener("keyup", key, true);
window.addEventListener("resize", resize, false);
//$("window").mouseup(queryDB(xlow, ylow, xhigh, yhigh));