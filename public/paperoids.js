var UP = 0;
var RIGHT = 1;
var DOWN = 2;
var LEFT = 3;
var FIRE = 4;

var SHOT_LIFESPAN = 180;
var SHOT_SPEED = 8;
var SHIP_RESPAWN_TIME = 2000;
var SHIP_SPAWN_PROTECTION = 3000;
var SHIP_SIZE = 48;

var RENDER_STARS = false;
var ANIMATE_STARS = false;
var STARS_AMOUNT = 400;
var STARS_SIZE = 2;

var SHOW_PLAYERNAMES = true;

var REMAINING_TIME = 0;

var CLIENT_CHECK_SHIP_AMOUNT = 2000; // How often to check for disconnected in ms

var map_width = 1920;
var map_height = 1080;

var presets = {
    speed: 0.2,
    maxRockSpeed: 4.5,
    rockCount: 6,
    freeShipScore: 10000,
    freeShipIncrement: 10000
};

var socket = io();

var sent_ship = false;

socket.on('acknowledge new player', function (info) {
    //console.log('server acknowledged you');
    $('#shipinfo').fadeOut(200);
    $('#scoreboard').fadeIn(200);
});

socket.on('game state variables', function (info) {
    //console.log('game vars updated');
    //console.log(info);
    SHOT_SPEED = info.SHOT_SPEED;
    SHOT_LIFESPAN = info.SHOT_LIFESPAN;
    SHIP_RESPAWN_TIME = info.SHIP_RESPAWN_TIME;
    SHIP_SPAWN_PROTECTION = info.SHIP_SPAWN_PROTECTION;
    SHIP_SIZE = info.SHIP_SIZE;
    map_width = info.map_width;
    map_height = info.map_height;
    REMAINING_TIME = info.remaining_time;

    //console.log(SHIP_SPAWN_PROTECTION);
    if (RENDER_STARS) {
        renderSky();
    }

});

socket.on('game state ships', function (ships) {
    //console.log('game state updated');
    //client.ships = ships;
    //console.log(ships);

    removePlayers();

    ships.forEach(function (ship) {
        //console.log(ship);
        addShip(ship);
        //console.log(ship.group);
        //var group = new Group(ship.group);
    });
});

socket.on('game add player', function (ship) {
    //console.log('game add player');
    //console.log(ship);
    addShip(ship, true);
});

socket.on('ships position', function (ships_positions) {
    client.ships.forEach(function (ship) {
        ships_positions.forEach(function (position) {
            if (ship.id === position[0]) {
                ship.position = new Point(position[1], position[2]);
                ship.angle = position[3];
                //console.log(position[3]);
            }
        });
    });
});

socket.on('shot added', function (shipid) {
    //console.log('shot added');
    var shooter;
    client.ships.forEach(function (ship) {
        if (shipid === ship.id) {
            shooter = ship;
        }
    });

    var vector = new Point({
        angle: shooter.angle,
        length: (SHIP_SIZE / 2) - 3
    });

    var shot = {
        owner: shooter.id,
        color: shooter.color,
        position: shooter.position.add(vector),
        angle: shooter.angle
    };

    client.shots.push(new Shot(shot));
});

socket.on('ship destroyed', function (data) {
    //console.log('ship destroyed');
    client.ships.forEach(function (ship) {
        if (data.ship_id === ship.id) {
            ///console.log('hit...');
            ship.hitBy(data.id);
        }
    });
});

socket.on('disconnect', function() {
    console.log('lost connection to server, trying to reload...');
    location.reload();
});

function addShip(ship, spawnprotection) {
    //console.log('added new ship for new player');

    //console.log('received angle ' + ship.angle);

    var newship = new Ship(ship);
    if (spawnprotection) {
        newship.spawnProtection();
    }
    client.ships.push(newship);
    //console.log(newship);

    //var path = new Path([-10, -8], [10, 0], [-10, 8], [-8, 4], [-8, -4]);
    //ship.group = new Group().importJSON(ship.group);
}


socket.on('player disconnected', function (id) {
    //console.log(id);
    removePlayer(id);
});

function removePlayer(id) {
    removeShots(id);
    client.ships.forEach(function (ship, i) {
        if (ship.id === id) {
            client.ships[i].item.remove();
            client.ships[i].playername.remove();
            client.ships[i].protectionCircle.remove();
            client.ships.splice(i, 1);
            console.log('player "' + socket.id + '" disconnected.');
        }
    })
}

function removePlayers() {
    client.ships.forEach(function (ship, i) {
        client.ships[i].item.remove();
        client.ships[i].playername.remove();
        client.ships[i].protectionCircle.remove();
    });

    client.ships = [];
}

function removeShots(id) {
    var toberemoved = [];

    for (var i = client.shots.length - 1; i >= 0; i--) {
        if (client.shots[i].owner === id) {
            client.shots[i].bullet.remove();
            // When splicing this, the rest of the array is not pristine anymore and does not match all shots
            client.shots.splice(i, 1);
        }
    }

}

function initialize() {
    //Rocks.add(presets.rockCount);
    //Score.update();
    //Lives.initialize();
}

function toRadians(angle) {
    return angle * (Math.PI / 180);
}

stars = false;

function renderSky() {
    var i = 0;
    var sky = new paper.Group([]);
    while (i < STARS_AMOUNT) {
        // size is between 1 and 2.5
        var size = Math.random() * 1.5 + 1;
        var star = new paper.Path.Circle({
            center: [Math.random() * map_width, Math.random() * map_height],
            radius: size,
            fillColor: '#ccc',
            strokeColor: '#ccc',
            strokeWidth: 0

        });

        // Set alpha depending on size: biggest stars are ~.8, smallest ~.3
        star.fillColor.alpha = size / 3;
        sky.addChild(star);
        i++;
    }

    sky.position = view.center;
    stars = sky;

    console.log('sky rendered');
}

function animateSky() {
    if (typeof stars === 'boolean') return;
    //console.log(stars);

    //Change 10% of stars at a time
    for (var i = 0; i < STARS_AMOUNT / 4; i++) {
        var index = Math.floor(Math.random() * STARS_AMOUNT);
        stars.children[index].fillColor.alpha += (Math.random() - 0.5) * 0.2;
        //console.log(index);
    }

}

function twinkle(star) {

}

project.currentStyle.strokeColor = 'white';

var Game = {
    roundDelay: false,
    over: function () {
        document.getElementById('gameover').style.display = 'block';
    },
    newRound: function () {
        Game.roundDelay = false;
        Rocks.add(presets.rockCount);
    },
    // Stats.js by Mr. Doob - https://github.com/mrdoob/stats.js
};

var assets = {
    destroyedShip: new function () {
        var group = new Group(
            new Path([-10, -8], [10, 0]),
            new Path([10, 0], [-10, 8]),
            new Path([-8, 4], [-8, -4])
        );
        group.visible = false;
        return group;
    },
    explosion: new function () {
        var explosionPath = new Path.Circle(new Point(), 1);
        explosionPath.fillColor = 'white';
        explosionPath.strokeColor = null;
        return new SymbolDefinition(explosionPath);
    },
    spawnProtection: new function () {
        var circle = new paper.Path.Circle(new paper.Point(), 40);
        circle.visible = false;
        return circle;
    }
};


var Rocks = new function () {
    var group = new Group();
    var shapes = [
        new Path(
            [-23, -40.5], [0, -30.5], [24, -40.5], [45, -21.5], [25, -12.5],
            [46, 9.5], [22, 38.5], [-10, 30.5], [-22, 40.5], [-46, 18.5],
            [-33, 0.5], [-44, -21.5], [-23, -40.5]),
        new Path(
            [-45, -9.5], [-12, -40.5], [24, -40.5], [46, -11.5], [45, 10.5],
            [24, 40.5], [0, 40.5], [0, 10.5], [-23, 38.5], [-46, 9.5], [-25, 0.5],
            [-45, -9.5]),
        new Path([-21.5, -39.5], [11.5, -39.5], [45.5, -20.5],
            [45.5, -8.5], [9.5, 0.5], [44.5, 21.5], [22.5, 39.5], [9.5, 31.5],
            [-20.5, 39.5], [-45.5, 10.5], [-45.5, -20.5], [-11.5, -21.5],
            [-21.5, -39.5]),
        new Path(
            [-22.5, -40.5], [-0.5, -19.5], [23.5, -39.5], [44.5, -21.5],
            [33.5, 0.5], [46.5, 19.5], [13.5, 40.5], [-22.5, 39.5], [-46.5, 18.5],
            [-46.5, -18.5], [-22.5, -40.5])
    ];

    // medium rocks
    for (var i = 4; i < 8; i++) {
        shapes[i] = shapes[i - 4].clone();
        shapes[i].scale(0.5);
    }

    // small rocks
    for (var i = 8; i < 12; i++) {
        shapes[i] = shapes[i - 4].clone();
        shapes[i].scale(0.4);
    }

    var rockSymbols = [];
    for (var i = 0; i < shapes.length; i++) {
        rockSymbols[i] = new SymbolDefinition(shapes[i]);
    }

    var explosions = new Group();

    return {
        shapes: shapes,
        children: group.children,
        make: function (type, pos) {
            var randomRock = type + Math.floor(4 * Math.random());
            var rock = rockSymbols[randomRock].place();
            rock.position = pos ? pos : Point.random() * view.size;
            rock.vector = new Point({
                angle: 360 * Math.random(),
                length: presets.maxRockSpeed * Math.random() + 0.1
            });
            rock.shapeType = type;
            return rock;
        },
        add: function (amount, type, position) {
            for (var i = 0; i < amount; i++) {
                var rock = this.make(type || this.TYPE_BIG, position);
                group.addChild(rock);
            }
        },
        explode: function (rock) {
            var boomRock = rock.symbol.definition.clone();
            boomRock.position = rock.position;
            for (var i = 0; i < boomRock.segments.length; i++) {
                var segmentPoint = boomRock.segments[i].point;
                var placed = assets.explosion.place(segmentPoint);
                placed.vector = (placed.position - rock.position) * 0.1;
                explosions.addChild(placed);
            }
            boomRock.remove();
        },
        iterateExplosions: function () {
            for (var i = 0; i < explosions.children.length; i++) {
                var explosion = explosions.children[i];
                explosion.vector.length *= .7;
                explosion.position += explosion.vector;
                explosion.opacity = explosion.vector.length;
                if (explosion.vector.length < 0.05) {
                    explosion.remove();
                    // if no more rocks, wait a second and start a new round
                    if (this.children.length < 1 && !Game.roundDelay) {
                        Game.roundDelay = true;
                        presets.rockCount += 2;
                        setTimeout(Game.newRound, 1000);
                    }
                }
            }
        },
        TYPE_BIG: 0,
        TYPE_MEDIUM: 4,
        TYPE_SMALL: 8
    };
};

var Score = new function () {
    var numberGroup = new Group(
        new Path([0, 0], [20, 0], [20, 27], [0, 27], [0, 0]),
        new Path([10, 0], [10, 27]),
        new Path([0, 0], [20, 0], [20, 14], [0, 14], [0, 27], [20, 27]),
        new Path([0, 0], [20, 0], [20, 14], [0, 14], [20, 14], [20, 27], [0, 27]),
        new Path([0, 0], [0, 14], [20, 14], [20, 0], [20, 27]),
        new Path([20, 0], [0, 0], [0, 14], [20, 14], [20, 27], [0, 27]),
        new Path([20, 0], [0, 0], [0, 27], [20, 27], [20, 14], [0, 14]),
        new Path([0, 0], [20, 0], [0, 27]),
        new Path([0, 0], [20, 0], [20, 27], [0, 27], [0, 0], [0, 14], [20, 14]),
        new Path([20, 14], [0, 14], [0, 0], [20, 0], [20, 27])
    );
    numberGroup.visible = false;
    var scoreDisplay = new Group();
    var score = 0;
    return {
        update: function (type) {
            if (type == Rocks.TYPE_BIG) score += 20;
            if (type == Rocks.TYPE_MEDIUM) score += 50;
            if (type == Rocks.TYPE_SMALL) score += 100;
            if (score >= presets.freeShipScore) {
                Lives.add(1);
                presets.freeShipScore += presets.freeShipIncrement;
            }
            scoreDisplay.removeChildren();

            var scoreString = score + '';
            for (var i = 0; i < scoreString.length; i++) {
                var n = parseInt(scoreString[i], 10);
                scoreDisplay.addChild(numberGroup.children[n].clone());
                scoreDisplay.lastChild.position = [22 + i * 24, 22];
            }
        }
    };
};

//initialize();

function keepInView(item) {
    var position = item.position;
    var itemBounds = item.bounds;
    var bounds = view.bounds;

    if (itemBounds.left > bounds.width) {
        position.x = -item.bounds.width;
    }

    if (position.x < -itemBounds.width) {
        position.x = bounds.width;
    }

    if (itemBounds.top > view.size.height) {
        position.y = -itemBounds.height;
    }

    if (position.y < -itemBounds.height) {
        position.y = bounds.height + itemBounds.height / 2;
    }
}

// Multiplayer functionality

/** We need:
 *  - position of all players
 *  - position of all asteroids
 *  - position of bullets
 *
 *  - color of players & asteroids
 */

/** Client needs to send
 *  - his inputs
 *  - his arrival
 */

/** Client needs to receive
 *  - position of all ships
 *  - position of all bullets
 *  - position of all asteroids
 */

move_up = false;
move_down = false;
move_right = false;
move_left = false;
shoot = false;

function onFrame(event) {
    // Bullets.move();
    // Rocks.iterateExplosions();
    client.ships.forEach(function (ship) {
        ship.checkCollisions();
    });
    // if ( move_left) {
    //     Ship.turnLeft();
    // }
    // if (Key.isDown('right')) {
    //     Ship.turnRight();
    // }
    // if (Key.isDown('up')) {
    //     Ship.thrust();
    // } else {
    //     Ship.coast();
    // }
    // Ship.move();

    renderShips();
    moveShots();

    // Might be a performance hit
    if (ANIMATE_STARS && (event.count % 4 === 0)) {
        //animateSky();
    }
}

function renderShips() {
    if (typeof client.ships === 'undefined') {
        return 0;
    }
    client.ships.forEach(function (ship) {

        //console.log('rendering');

        //var group = new Group(ship.group.children);
        //group.strokeColor = ship.color;
        //group.position = new Point(ship.pos.x, ship.pos.y);
        //console.log('rendering ship id ' + ship.id);

        //var ship = ship_data.item;

        //console.log(ship_data);
        //ship.position = new Point(ship_data.pos.x, ship_data.pos.y);
        //ship.applyMatrix = false;
        //ship.strokeColor = ship_data.color;
        //ship.rotation = ship_data.angle;


        ship.moveTo(ship.position);
        ship.turnTo(ship.angle);
        //console.log(ship.rotation + ' ' + ship.angle);

    })
    //console.log(client.ships);
}

function moveShots() {
    // Update shot position
    client.shots.forEach(function (shot, i) {

        if (!shot) return;

        if (shot.expired()) {
            shot.remove();
            client.shots.splice(i, 1);
            return;
        }

        shot.move();

    });
}

function renderShots() {
    client.shots.forEach(function (shot) {

        shot.group.position = new Point(shot.pos.x, shot.pos.y);

    });
}

//Colorpicker

client = {
    ships: [],
    shots: []
};

player = {
    name: '',
    color: '#ff0000',
};

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

function minimumBrightness(h, s, l, min) {
    return [h, s, Math.max(l, min)]
}

function hsvToRgb(h, s, v) {
    var r, g, b;

    var i = Math.floor(h * 6);
    var f = h * 6 - i;
    var p = v * (1 - s);
    var q = v * (1 - f * s);
    var t = v * (1 - (1 - f) * s);

    switch (i % 6) {
        case 0:
            r = v, g = t, b = p;
            break;
        case 1:
            r = q, g = v, b = p;
            break;
        case 2:
            r = p, g = v, b = t;
            break;
        case 3:
            r = p, g = q, b = v;
            break;
        case 4:
            r = t, g = p, b = v;
            break;
        case 5:
            r = v, g = p, b = q;
            break;
    }

    return [r * 255, g * 255, b * 255];
}

function onKeyDown(event) {
    //console.log(event);
    if ((event.key === 'left' || event.key === 'a') && !event.event.repeat) {
        socket.emit('player movement', LEFT);
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

    // Stop left and right keyboard events from propagating.

    $(document).keydown(function (e) {
        if (e.key === 'F8') {
            $('#setup').fadeToggle(200);
            $('#scoreboard').fadeToggle(200);
        }
    });

    var scoreboard = $('#scoreboard-players');
    var scoreboard_timer = $('#scoreboard-timer');
    var scoreboard_interval;

    socket.emit('request round state');

    socket.emit('request game state ships');

    socket.on('scoreboard add player', function (player) {
        addPlayer(player);
    });

    socket.on('scoreboard remove player', function (id) {
        removePlayer(id);
    });

    socket.on('scoreboard update player', function (player) {
        updatePlayer(player);
    });

    /*
    socket.on('gameinfo', function (text) {
        $('#gameinfo').html(text);
    });
    */


    socket.on('game round info', function(data) {
        REMAINING_TIME = data.remaining_time;
        if(data.running) {
            showRemainingTime();
        } else {
            showTimeUntilNextRound();
        }
    });

    socket.on('game round start', function (data) {

        client.ships.forEach(function (ship) {
            ship.respawn();
        });

        $('#scoreboard').fadeOut(200, function() {
            REMAINING_TIME = data;
            showRemainingTime();
            $('.scoreboard-points').html('0');
            $('.scoreboard-kills').html('0');
            $('.scoreboard-deaths').html('0');
            $(this).removeClass('end');
            $(this).fadeIn(200);
        });
    });

    socket.on('game round end', function (data) {

        $('#scoreboard').fadeOut(200, function() {
            REMAINING_TIME = data;
            showTimeUntilNextRound();
            $(this).addClass('end');
            $(this).fadeIn(200);
        });

    });

    /* Check whether player count is still in sync with server every now and then */
    /* Should prevent desync behaviour if a disconnect event is not received correctly */

    var checkPlayerAmount = function() {
        socket.emit('request ships number')
    }

    setInterval(checkPlayerAmount, CLIENT_CHECK_SHIP_AMOUNT);

    socket.on('game ships number', function(number) {
        //console.log('got ' + number + ', expected ' + client.ships.length);
        if(number !== client.ships.length) {
            console.log('Desync detected. Requesting correct ship amount from server');
            socket.emit('request game state ships');
        }
    });

    //Scoreboard only
    function addPlayer(player) {
        var starthtml = '<div id="' + player.id + '" class="scoreboard-player" data-sid=' + player.score + '>';
        var name = '<span style="color:' + player.color + '" class="scoreboard-name">' + player.name + '</span>'
        var points = '<span class="scoreboard-points">' + player.score + '</span>';
        var kills = '<span class="scoreboard-kills">' + player.kills + '</span>';
        var deaths = '<span class="scoreboard-deaths">' + player.deaths + '</span>';
        var endhtml = '</div>';
        $('#waiting-for-players').remove();
        scoreboard.append(starthtml + name + points + kills + deaths + endhtml);

        sortScoreboard();
    }

    //Scoreboard only
    function removePlayer(id) {
        $('#' + id).remove();

        if (scoreboard.children().length === 0) {
            scoreboard.append('<span id="waiting-for-players">Waiting for players...</span>');
        }
    }

    //Scoreboard only
    function updatePlayer(player) {
        $('#' + player.id).attr('data-sid', player.score);
        $('#' + player.id + ' .scoreboard-points').html(player.score);
        $('#' + player.id + ' .scoreboard-kills').html(player.kills);
        $('#' + player.id + ' .scoreboard-deaths').html(player.deaths);

        // Sort the scoreboard
        sortScoreboard();
    }

    function sortScoreboard() {
        // console.log('sorting scoreboard...');
        // Sort the scoreboard
        $('div#scoreboard-players div').sort(function (a, b) {
            return parseInt(b.dataset.sid) > parseInt(a.dataset.sid);
        }).appendTo('#scoreboard-players');
    }

    function right(str, chr) {
        return str.slice(str.length - chr, str.length);
    }

    function calculateRemainingTime() {
        var timestring;

        if (REMAINING_TIME < 0) {
            REMAINING_TIME = 0;
        }

        //timestring = az(now.getMinutes()) + ':' + az(now.getSeconds());

        var remaining_seconds = Math.floor(REMAINING_TIME / 1000);

        var seconds = right(('0' + (remaining_seconds % 60)), 2);
        timestring = Math.floor(remaining_seconds / 60) + ':' + seconds;
        var string = 'Time remaining: ' + timestring;
        scoreboard_timer.html(string);

        REMAINING_TIME -= 1000;
    }

    function showRemainingTime() {
        clearInterval(scoreboard_interval);
        REMAINING_TIME -= 1500;
        calculateRemainingTime();
        scoreboard_interval = setInterval(calculateRemainingTime, 1000);
    }

    showRemainingTime();

    function calculateTimeUntilNextRound() {
        var timestring;

        if (REMAINING_TIME < 0) {
            REMAINING_TIME = 0;
        }

        var remaining_seconds = Math.floor(REMAINING_TIME / 1000);

        var seconds = right(('0' + (remaining_seconds % 60)), 2);
        timestring = Math.floor(remaining_seconds / 60) + ':' + seconds;
        var string = 'Next round starts in: ' + timestring;
        scoreboard_timer.html(string);

        REMAINING_TIME -= 1000;
    }

    function showTimeUntilNextRound() {
        clearInterval(scoreboard_interval);
        REMAINING_TIME -= 1000;
        calculateTimeUntilNextRound();
        scoreboard_interval = setInterval(calculateTimeUntilNextRound, 1000);
    }

    var colorpicker = $('#colorpicker');

    colorpicker.css('background-color', getRandomColor());

    colorpicker.colpick({
        layout: 'hex',
        colorScheme: 'dark',
        color: '21ebeb',
        onSubmit: function (hsb, hex, rgb, el) {
            //console.log(hsb);
            // Give the selected color a minimum brightness to prevent exploiting black, nonvisible ships
            var adjusted = minimumBrightness(hsb.h, hsb.s, hsb.b, 35);
            //console.log('minimumBrightness:');
            //console.log(adjusted[0]/360, adjusted[1]/100, adjusted[2]/100);
            adjusted = hsvToRgb(adjusted[0] / 360, adjusted[1] / 100, adjusted[2] / 100);
            //console.log('hsvToRgb result:');
            //console.log (adjusted);
            adjusted = [Math.floor(adjusted[0]), Math.floor(adjusted[1]), Math.floor(adjusted[2])];
            //console.log(adjusted);
            //console.log('Initial RGB:');
            //console.log(rgb);
            adjusted = rgb2hex('rgb(' + adjusted[0] + ', ' + adjusted[1] + ', ' + adjusted[2] + ')');
            //console.log(adjusted);
            //console.log('rgb('+adjusted[0]+', '+adjusted[1]+', '+adjusted[2]+')');
            //console.log(colorpicker.css('background-color'))
            //console.log('hex:');
            //console.log(adjusted);

            /* Boah war das ätzend */

            $(el).css('background-color', adjusted);
            $(el).colpickHide();
        }
    });

    colorpicker.on('onSubmit', function () {
        //console.log("submit");
        $(this).colpickHide();
    });

    $('#confirm-playerinfo').click(function () {
        if ($('#playername').val() == '') {
            return false;
        }
        player.name = $('#playername').val();
        player.color = rgb2hex(colorpicker.css('background-color'));
        //console.log(colorpicker.css('background-color'))
        $('#playerinfo').fadeOut(200, function () {
            $('#shipinfo').fadeIn(200);
        });
    });

    $('#confirm-shipinfo').click(function () {
        if (typeof ship === 'undefined' || (ship.children.length === 0 )) {
            console.log("Buidl a shiperl plx!");
            return false;
        }

        if(sent_ship) return;

        sent_ship = true;
        player.ship = ship.exportJSON();
        //console.log(ship);
        //console.log(player.ship);
        socket.emit('new player', JSON.stringify(player));
        //console.log(JSON.stringify(player));

    });

});

function Ship(options) {

    var path = new paper.Group().importJSON(options.group);
    path.strokeWidth = 2;
    //path.closed = true;
    //var thrust = new paper.Path([-8, -4], [-14, 0], [-8, 4]);
    //console.log(path);
    //var rectangle = new paper.Path.Rectangle(path.bounds);
    //console.log(rectangle);
    var playername = new paper.PointText({
        point: [path.position.x, path.position.y - 28],
        content: options.name,
        fillColor: options.color,
        fontSize: 14,
        fontWeight: '300',
        fontFamily: 'Source Sans Pro'
    });
    //console.log(playername.content);
    playername.justification = 'center';

    var protectionCircle = assets.spawnProtection.clone();

    //console.log(this.protectionCircle);

    var group = new paper.Group(path);
    group.applyMatrix = false;
    //console.log(options.ship);
    //var group = new paper.Group().importJSON(options.group);
    //console.log(group);
    group.position = new paper.Point(options.pos.x, options.pos.y);
    group.strokeColor = options.color;


    //group.position = new paper.Point(options.pos.x, options.pos.y);
    //console.log(group.position.x + ', ' + group.position.y);
    //var id = options.id;
    return {
        playername: playername,
        protectionCircle: protectionCircle,
        item: group,
        name: options.name,
        //angle: options.angle,
        color: options.color,
        movement: options.movement,
        id: options.id,
        position: group.position,

        vector: new paper.Point({
            angle: 0.2,
            length: 1
        }),

        destroyedShip: assets.destroyedShip.clone(),

        turnLeft: function () {
            //console.log('turnleft');
            group.rotate(-3);
            //this.angle -= 3;
        },

        turnRight: function () {
            //console.log('turnright');
            group.rotate(3);
            //this.angle += 3;
        },

        thrust: function () {
            //thrust.visible = true;

            this.vector = this.vector.add(new paper.Point({
                angle: this.angle,
                length: presets.speed
            }));
            //console.log(this.vector);
            if (this.vector.length > 8) {
                this.vector.length = 8;
            }
        },

        stop: function () {
            this.vector.length = 0;
        },

        fire: function () {
            if (!this.dying)
                Shot.fire(this.item.position, this.angle);
        },

        coast: function () {
            //thrust.visible = false;
            this.vector = this.vector.multiply(.992);
        },

        move: function () {
            //console.log(this.vector);
            group.position = group.position.add(this.vector);
            playername.position = group.position;
            protectionCircle.position = group.position;
            //keepInView(group);
        },

        moveTo: function (position) {
            group.position = position;
            playername.position = [group.position.x, group.position.y - 44];
            protectionCircle.position = group.position;
            //keepInView(group);
        },

        turnTo: function (angle) {
            //this.angle = angle;

            //group.rotation = angle;
            this.item.rotation = angle;

            //this.angle = angle/2;
            //console.log(angle);
            //keepInView(group);
        },

        hitBy: function (id) {
            //this.item.strokeColor = "red";
            this.destroy();
        },

        destroy: function () {
            var ship = this;
            console.log('destroy called');
            ship.destroyedShip = assets.destroyedShip.clone();
            ship.destroyedShip.position = this.item.position;
            ship.destroyedShip.visible = true;
            ship.destroyedShip.strokeColor = this.color;
            ship.item.visible = false;
            ship.playername.visible = false;
            ship.stop();
            //this.item.position = paper.view.center;
            ship.dying = true;

            setTimeout(function () {
                ship.respawn();
            }, SHIP_RESPAWN_TIME + 10);
        },

        respawn: function () {

            console.log('respawn called');
            var ship = this;
            ship.item.visible = true;
            ship.playername.visible = true;
            ship.stop();
            ship.dying = false;
            ship.destroyedShip.visible = false;
            ship.setColor(ship.color);

            ship.spawnProtection();

        },

        spawnProtection: function () {

            var circle = protectionCircle;
            circle.visible = true;

            //Deactivate after x seconds
            setTimeout(function () {
                circle.visible = false;
                //console.log('spawn protection deactivated');
            }, SHIP_SPAWN_PROTECTION);
            //console.log(SHIP_SPAWN_PROTECTION);
            //return console.log('spawn protection activated');
        },

        setColor: function (color) {
            group.strokeColor = color;
        },

        checkCollisions: function () {

            // move rocks and do a hit-test
            // between bounding rect of rocks and ship

            if (this.dying) {
                console.log('dieing');
                var children = this.destroyedShip.children;
                children[0].position.x++;
                children[1].position.x--;
                children[2].position.x--;
                children[2].position.y++;
                children[0].rotate(1);
                children[1].rotate(-1);
                children[2].rotate(1);
                this.destroyedShip.opacity *= 0.98;

                var ship = this;

                // setTimeout(function() {
                //     ship.destroy();
                //     ship.item.remove();
                // }, 2000);
            }

        }
    };
};

function Shot(args) {
    //var group = new paper.Group();
    var pos = args.position;
    var vec = new paper.Point({
        angle: args.angle,
        length: SHOT_SPEED
    });
    //console.log(args);
    //console.log('shot start pos: ' + pos.x + ', ' + pos.y);

    function checkHits(bullet) {
        for (var r = 0; r < Rocks.children.length; r++) {
            var rock = Rocks.children[r];
            if (rock.bounds.contains(bullet.position)) {
                Score.update(rock.shapeType);
                Rocks.explode(rock);
                if (rock.shapeType < Rocks.TYPE_SMALL) {
                    for (var j = 0; j < 2; j++) {
                        Rocks.add(1, rock.shapeType + 4, rock.position);
                    }
                }
                rock.remove();
                bullet.remove();
            }
        }
    }

    return {

        owner: args.owner,
        color: args.color,
        position: pos,
        angle: args.angle,

        vector: vec,
        bullet: new paper.Path.Circle({
            center: pos.add(vec),
            radius: 3,
            fillColor: args.color,
            strokeColor: args.color,
            strokeWidth: 0,
            data: {
                vector: vec,
                timeToDie: SHOT_LIFESPAN
            }
        })
        ,
        expired: function () {
            return this.bullet.data.timeToDie < 1;
        },
        move: function () {

            this.bullet.data.timeToDie--;
            if (this.bullet.data.timeToDie < 1) {
                this.bullet.remove();
            } else {
                this.bullet.position = this.bullet.position.add(this.bullet.data.vector);
                keepInView(this.bullet);
                //console.log(this.bullet.position);
                //checkHits(bullet);
                //keepInView(bullet);
            }

        },
        remove: function () {
            //console.log('shot end pos: ' + this.bullet.position.x + ', ' + this.bullet.position.y);
            this.bullet.remove();
        }
    };
};