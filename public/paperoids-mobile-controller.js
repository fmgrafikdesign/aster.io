var UP = 0;
var RIGHT = 1;
var DOWN = 2;
var LEFT = 3;
var FIRE = 4;

// From what device angle onwards the ship turns left or right
var TURNING_THRESHOLD = 15;

// Initialize sockets
var socket = io();

// Initialize GyroNorm

var args = {
    logger: logger
};

var gn = new GyroNorm();

gn.init(args).then(function () {
    var isAvailable = gn.isAvailable();
    if (!isAvailable.deviceOrientationAvailable) {
        logger({message: 'Device orientation is not available.'});
    }

    if (!isAvailable.accelerationAvailable) {
        logger({message: 'Device acceleration is not available.'});
    }

    if (!isAvailable.accelerationIncludingGravityAvailable) {
        logger({message: 'Device acceleration incl. gravity is not available.'});
    }

    if (!isAvailable.rotationRateAvailable) {
        logger({message: 'Device rotation rate is not available.'});
    }

    // This is where we can get our data
    gn.start(function(data){

        // Available data

        // data.do.alpha	( deviceorientation event alpha value )
        // data.do.beta		( deviceorientation event beta value )
        // data.do.gamma	( deviceorientation event gamma value )
        // data.do.absolute	( deviceorientation event absolute value )

        // data.dm.x		( devicemotion event acceleration x value )
        // data.dm.y		( devicemotion event acceleration y value )
        // data.dm.z		( devicemotion event acceleration z value )

        // data.dm.gx		( devicemotion event accelerationIncludingGravity x value )
        // data.dm.gy		( devicemotion event accelerationIncludingGravity y value )
        // data.dm.gz		( devicemotion event accelerationIncludingGravity z value )

        // data.dm.alpha	( devicemotion event rotationRate alpha value )
        // data.dm.beta		( devicemotion event rotationRate beta value )
        // data.dm.gamma	( devicemotion event rotationRate gamma value )

        //console.log(data.do.beta);
        //data.do.beta is the horizontal rotation we need to determine whether to turn the ship

        //socket.emit('debug message', data.do.beta);

        steerShip(data.do.beta);

    });

}).catch(function (e) {

    console.log(e);

});

var lastangle = 0;
function steerShip(angle) {
    // If angle is > threshold and wasn't before, issue turnLeft command
    //socket.emit('debug message', '(' + angle + ' > ' + TURNING_THRESHOLD + ') && (!(' + lastangle + ' > ' + TURNING_THRESHOLD + '))');
    //console.log('(' + angle + ' > ' + TURNING_THRESHOLD + ') && (!(' + lastangle + ' > ' + TURNING_THRESHOLD + '))');
    if((angle > TURNING_THRESHOLD) && !(lastangle > TURNING_THRESHOLD)) {
        socket.emit('player movement', RIGHT);
        //socket.emit('debug message', 'turnRight');
    }
    // If angle is < -threshold and wasn't before, issue turnRight command
    else if ((angle < -TURNING_THRESHOLD) && !(lastangle < -TURNING_THRESHOLD) ) {
        socket.emit('player movement', LEFT);
        //socket.emit('debug message', 'turnLeft');
    }
    // If ship is moving and angle is not above threshold anymore, stop
    else if ((lastangle > TURNING_THRESHOLD || lastangle < -TURNING_THRESHOLD) && (angle < TURNING_THRESHOLD && angle > -TURNING_THRESHOLD ) ) {
        socket.emit('player movement stop', LEFT);
        socket.emit('player movement stop', RIGHT);
        //socket.emit('debug message', 'stopTurning');
    }
    lastangle = angle;
}

function logger(data) {
    console.log(data.message);
}

socket.on('acknowledge new player', function (info) {
    console.log('server acknowledged you');
    $('#setup').fadeOut(200, function () {
        $('#controller').fadeIn(200);
    });
});


player = {
    name: '',
    color: '#ff0000',
};

function toggleFullScreen() {
    var doc = window.document;
    var docEl = doc.documentElement;

    var requestFullScreen = docEl.requestFullscreen || docEl.mozRequestFullScreen || docEl.webkitRequestFullScreen || docEl.msRequestFullscreen;
    var cancelFullScreen = doc.exitFullscreen || doc.mozCancelFullScreen || doc.webkitExitFullscreen || doc.msExitFullscreen;

    if (!doc.fullscreenElement && !doc.mozFullScreenElement && !doc.webkitFullscreenElement && !doc.msFullscreenElement) {
        requestFullScreen.call(docEl);
    }
    else {
        cancelFullScreen.call(doc);
    }
}

function getRandomColor() {
    var letters = '0123456789ABCDEF'.split('');
    var color = '#';
    for (var i = 0; i < 6; i++) {
        color += letters[Math.round(Math.random() * 15)];
    }
    return color;
}

function rgb2hex(rgb) {
    rgb = rgb.match(/^rgba?[\s+]?\([\s+]?(\d+)[\s+]?,[\s+]?(\d+)[\s+]?,[\s+]?(\d+)[\s+]?/i);
    return (rgb && rgb.length === 4) ? "#" +
        ("0" + parseInt(rgb[1], 10).toString(16)).slice(-2) +
        ("0" + parseInt(rgb[2], 10).toString(16)).slice(-2) +
        ("0" + parseInt(rgb[3], 10).toString(16)).slice(-2) : '';
}

// Adjust this for touch controls
function onKeyDown(event) {
    //console.log(event);
    if ((event.key === 'left' || event.key === 'a') && !event.event.repeat) {
        socket.emit('player movement', LEFT);
        console.log('left');
        return move_left = true;
    }
    if ((event.key === 'right' || event.key === 'd') && !event.event.repeat) {
        socket.emit('player movement', RIGHT);
        return move_right = true;
    }
    if ((event.key === 'up' || event.key === 'w') && !event.event.repeat) {
        socket.emit('player movement', UP);
        return move_up = true;
    }
    if (event.key === 'down' && !event.event.repeat) {
        socket.emit('player movement', DOWN);
        return move_down = true;
    }
    if (event.key === 'space' && !event.event.repeat) {
        socket.emit('player movement', FIRE);
        return shoot = true;
    }
}

// Stop left and right keyboard events from propagating.
function onKeyUp(event) {
    if ((event.key === 'left' || event.key === 'a') && !event.event.repeat) {
        socket.emit('player movement stop', LEFT);
        //console.log("left");
        return move_left = true;
    }
    if ((event.key === 'right' || event.key === 'd') && !event.event.repeat) {
        socket.emit('player movement stop', RIGHT);
        return move_right = true;
    }
    if ((event.key === 'up' || event.key === 'w') && !event.event.repeat) {
        socket.emit('player movement stop', UP);
        return move_up = true;
    }
    if (event.key === 'down' && !event.event.repeat) {
        socket.emit('player movement stop', DOWN);
        return move_down = true;
    }
    if (event.key === 'space' && !event.event.repeat) {
        socket.emit('player movement stop', FIRE);
        return shoot = true;
    }
}

$(document).ready(function () {

    var colorpicker = $('#colorpicker');

    colorpicker.css('background-color', getRandomColor());

    colorpicker.colpick({
        layout: 'hex',
        colorScheme: 'dark',
        color: '21ebeb',
        onSubmit: function (hsb, hex, rgb, el) {
            $(el).css('background-color', '#' + hex);
            $(el).colpickHide();
        }
    });

    colorpicker.on('onSubmit', function () {
        console.log("submit");
        $(this).colpickHide();
    });

    $('#confirm-playerinfo').click(function () {
        if ($('#playername').val() == '') {
            return false;
        }
        player.name = $('#playername').val();
        player.color = rgb2hex(colorpicker.css('background-color'));
        $('#playerinfo').fadeOut(200, function () {
            $('#shipinfo').fadeIn(200);
        });
    });

    $('#confirm-shipinfo').click(function () {
        if (typeof ship === 'undefined') {
            console.log("Buidl a shiperl plx!");
            return false;
        }

        player.ship = ship.exportJSON();
        console.log(ship);
        console.log(player.ship);
        socket.emit('new player', JSON.stringify(player));
        //console.log(JSON.stringify(player));

    });


    //Send Thrust-Events to server

    $('#thrust-button').on('tapstart', function (e) {
        $(this).addClass('active');
        console.log('User tapped #myElement');
        socket.emit('player movement', UP);

    });

    $('#thrust-button').on('tapend', function () {
        $(this).removeClass('active');
        console.log('User stopped tapping #myElement');
        socket.emit('player movement stop', UP);
    });

    //Send Fire-Events to server

    $('#shoot-button').on('tapstart', function (e) {
        $(this).addClass('active');
        console.log('User tapped #myElement');
        socket.emit('player movement', FIRE);

    });

    $('#shoot-button').on('tapend', function () {
        $(this).removeClass('active');
        console.log('User stopped tapping #myElement');
        socket.emit('player movement stop', FIRE);
    });

    //TODO: Check ship color to have at least a certain amount of brightness

});