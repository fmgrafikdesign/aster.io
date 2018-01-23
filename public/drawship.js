var path;

//var textItem = new PointText({
//    content: 'Click and drag to draw a line.',
//    point: new Point(20, 30),
//    fillColor: 'white',
//});

var resetItem = new PointText({
    content: 'Reset',
    point: new Point(10, 20),
    fillColor: 'white',
});

var undoItem = new PointText({
    content: 'Undo',
    point: new Point(50, 20),
    fillColor: 'white',
})

resetItem.on('click', function() {
    ship.removeChildren();
});

undoItem.on('click', function() {
    console.log('removing child');
    ship.removeChildren(ship.children.length - 2);
});

var front = new PointText({
    content:'Front',
    point: new Point(270, 100),
    fillColor: 'white',
});

front.rotate(90);

function onMouseDown(event) {
    // If we produced a path before, deselect it:
    if (path) {
        path.selected = false;
    }

    if (typeof ship === 'undefined') {
        ship = new Group();
    }

    // Create a new path and set its stroke color to player color:
    path = new Path({
        segments: [event.point],
        strokeColor: player.color,
        strokeWidth: 3,
        // Select the path, so we can see its segment points:
        fullySelected: false
    });

    ship.addChild(path);
    //console.log(ship);
}

// While the user drags the mouse, points are added to the path
// at the position of the mouse:
function onMouseDrag(event) {
    path.add(event.point);

    // Update the content of the text item to show how many
    // segments it has:
    //textItem.content = 'Segment count: ' + path.segments.length;
}

// When the mouse is released, we simplify the path:
function onMouseUp(event) {
    var segmentCount = path.segments.length;

    // When the mouse is released, simplify it:
    path.simplify(10);

    // Select the path, so we can see its segments:
    path.fullySelected = false;

    var newSegmentCount = path.segments.length;
    var difference = segmentCount - newSegmentCount;
    var percentage = 100 - Math.round(newSegmentCount / segmentCount * 100);
    //textItem.content = difference + ' of the ' + segmentCount + ' segments were removed. Saving ' + percentage + '%';
}