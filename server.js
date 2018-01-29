var app = require('express')();
var express = require('express');
var http = require('http').Server(app);
//require('jquery-colpick');
var io = require('socket.io')(http);
var paper = require('paper');

// Use this port for the webserver, as per uberspace guidelines
// https://wiki.uberspace.de/system:ports
var port = 61161;

try {
    console.log(require.resolve("paper"));
    console.log('paper found');
} catch (e) {
    console.error("paper is not found");
    process.exit(e.code);
}

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/paperoids.html');
});

app.get('/mobile', function (req, res) {
    res.sendFile(__dirname + '/mobile.html');
});

app.use('/', express.static(__dirname + '/public/'));
app.use('/paper', express.static(__dirname + '/node_modules/paper/dist/'));
app.use('/js', express.static(__dirname + '/node_modules/'));

http.listen(port, function () {
    console.log('Server running on port %s', port);
});

//console.log(paper.Group);

//DEBUG FUNCTIONS
var SHOW_PERFORMANCE = false;

/** Game Server logic **/

var LIFES = 3; // Lifes per player
var ASTEROIDS = 10; // Number of Asteroids on screen
var SHOT_DELAY = 12; // delay between shots
var SHOT_SPEED = 5; // How many px does a shot move per tick
var SHOT_LIFESPAN = 120; // How long a shot lives

var SHIP_TOPSPEED = 6; // Topspeed of ship
var SHIP_ACCELERATION = 0.22; // Acceleration of ship
var SHIP_TURNRATE = 3; // Turnrate of ship

var SHIP_SIZE = 48;
var SHIP_RESPAWN_TIME = 2000; // in milliseconds
var SHIP_SPAWN_PROTECTION = 3000; // in milliseconds

var POINTS_PER_KILL = 100;
var POINTS_PER_DEATH = -50;
var POINTS_PER_ASTEROID = 10;

var map_width = 1920;
var map_height = 1080;

var GAME_ROUND_LENGTH = 60 * 3 * 1000 // Duration of one round (in Milliseconds)
//var GAME_ROUND_LENGTH = 10 * 1000 // DEBUG Duration of one round (in Milliseconds)
var GAME_ROUND_INBETWEEN = 16 * 1000 // Time between two rounds (in Milliseconds)
var GAME_ROUND_START_TIMESTAMP = 0;
var GAME_ROUND_END_TIMESTAMP = 0;

var UP = 0;
var RIGHT = 1;
var DOWN = 2;
var LEFT = 3;
var FIRE = 4;

var presets = {
    speed: 0.2,
    maxRockSpeed: 4.5,
    rockCount: 6,
    lives: 3,
    freeShipScore: 10000,
    freeShipIncrement: 10000
};

paper.install(this);
paper.setup([map_width, map_height]);

/** Receive movement of ships
 *  Receive new shots
 *
 *  Update position of ships, asteroids, shots
 *
 *  Check collision
 *
 *  Game logic like killing and respawning stuff
 */

function toRadians(angle) {
    return angle * (Math.PI / 180);
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

function hexToRgb(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

function rgbToHsv(r, g, b) {
    r /= 255, g /= 255, b /= 255;

    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h, s, v = max;

    var d = max - min;
    s = max == 0 ? 0 : d / max;

    if (max == min) {
        h = 0; // achromatic
    } else {
        switch (max) {
            case r:
                h = (g - b) / d + (g < b ? 6 : 0);
                break;
            case g:
                h = (b - r) / d + 2;
                break;
            case b:
                h = (r - g) / d + 4;
                break;
        }

        h /= 6;
    }

    return [h, s, v];
}

function serializeShip(ship) {

    var serialized = {
        angle: ship.angle,
        color: ship.color,
        group: ship.item,
        id: ship.id,
        name: ship.name,
        pos: ship.position
    };

    //console.log('serialized angle: ' + serialized.angle);

    return serialized;
}

io.on('connection', function (socket) {
    console.log('a user connected! | ' + socket.id);

    // Send game info 'players' to new player
    //console.log(game.ships);

    var shipsToPlayer = [];

    game.ships.forEach(function (ship) {
        //console.log(ship);
        var shipToPlayer = serializeShip(ship);

        shipsToPlayer.push(shipToPlayer);
    });

    socket.emit('game state ships', shipsToPlayer);

    //console.log(score.getPlayers());
    score.getPlayers().forEach(function (player) {
        //console.log('+1');
        socket.emit('scoreboard add player', player);
    });

    var remaining_time = GAME_ROUND_LENGTH - (new Date().getTime() - GAME_ROUND_START_TIMESTAMP);

    var gameinfo = {
        SHOT_SPEED: SHOT_SPEED,
        SHOT_LIFESPAN: SHOT_LIFESPAN,
        SHIP_RESPAWN_TIME: SHIP_RESPAWN_TIME,
        SHIP_SPAWN_PROTECTION: SHIP_SPAWN_PROTECTION,
        SHIP_SIZE: SHIP_SIZE,
        map_width: map_width,
        map_height: map_height,
        remaining_time: remaining_time
    };

    //socket.emit('gameinfo', remaining_time);

    socket.emit('game state variables', gameinfo);

    socket.on('debug message', function (message) {
        console.log(message);
    });


    socket.on('new player', function (player) {

        player = JSON.parse(player);
        //console.log(player);
        // Add new player to shiplist
        console.log('new player "' + player.name + '" connected.');
        //console.log(player.ship);

        // Give color a minimum lightness to prevent exploiting dark, hardly visible ships
        // This color conversion is cancer, but I'm too lazy to think of a more effective way to do it.
        var color = player.color;
        color = hexToRgb(color);
        //console.log('rgb', color);
        color = rgbToHsv(color.r, color.g, color.b);
        //console.log('hsv', color);
        color = minimumBrightness(color[0] * 360, color[1] * 100, color[2] * 100, 30);
        //console.log('hsv minimum Brightness', color);
        color = hsvToRgb(color[0] / 360, color[1] / 100, color[2] / 100);
        color = [Math.floor(color[0]), Math.floor(color[1]), Math.floor(color[2])];
        color = rgb2hex('rgb(' + color[0] + ', ' + color[1] + ', ' + color[2] + ')');

        var ship = {
            id: socket.id,
            color: color,
            name: player.name,
            group: player.ship,
            movement: {
                up: false,
                down: false,
                left: false,
                right: false,
                shooting: false
            },
            pos: {
                x: Math.floor(Math.random() * map_width),
                y: Math.floor(Math.random() * map_height)
            },
            angle: Math.floor(Math.random() * 360),
            speed: 0
        };

        socket.emit('acknowledge new player');
        //socket.emit('game state players', game.ships);

        // Add ship to the server
        game.addShip(ship);

        // Add player to scoreboard
        score.addPlayer(socket.id, player.name, color);

        // console.log('server angle: ' + ship.angle);

        // Get the ship
        //console.log(socket.id);
        var client_ship = game.getShip(socket.id);

        //console.log('client angle: ' + client_ship.angle);

        // Add player to the clientsgame
        io.emit('game add player', serializeShip(client_ship));
        //console.log(ship.group);

    });

    socket.on('player movement', function (dir) {
        if (!game.running) return;
        //console.log('received player ' + socket.id + ' movement: ' + movement.up + ' ' + movement.down + ' ' + movement.left + ' ' + movement.right + ' ' + movement.shooting);

        // Update player movement
        //console.log('player ' + socket.id + ' now going ' + dir);
        game.updateShipMovement(socket.id, dir, true);

    });

    socket.on('request round state', function() {
        if(game.running) {
            var remaining_time = GAME_ROUND_LENGTH - (new Date().getTime() - GAME_ROUND_START_TIMESTAMP);
            socket.emit('game round info', {
                running: true,
                remaining_time:  remaining_time
            });
        } else {
            var remaining_time = GAME_ROUND_INBETWEEN - (new Date().getTime() - GAME_ROUND_END_TIMESTAMP);
            socket.emit('game round info', {
                running: false,
                remaining_time:  remaining_time
            });
        }
    });


    socket.on('player movement stop', function (dir) {
        if (!game.running) return;
        //console.log('received player ' + socket.id + ' movement: ' + movement.up + ' ' + movement.down + ' ' + movement.left + ' ' + movement.right + ' ' + movement.shooting);

        // Update player movement
        //game.updateShip(socket.id, movement);
        //console.log('player ' + socket.id + ' stopped going ' + dir);
        game.updateShipMovement(socket.id, dir, false);

    });


    socket.on('disconnect', function () {
        // Delete player stuff
        game.removeShip(socket.id);
        game.removeShots(socket.id);
        score.removePlayer(socket.id);
        io.emit('player disconnected', socket.id);
        console.log('player disconnected.');
    })
});

function GameServer() {
    // ships obj: id, color, movement, pos.x, pos.y, pos.angle
    this.ships = [];

    // shots obj: owner-id, color, pos.x, pos.y, angle
    this.shots = [];

    this.lastShotId = 0;

    // asteroids obj: asteroid-id, owner-id, color, pos.x, pos.y, movement
    this.asteroids = [];

    // Game is currently running
    this.running = false;

}

GameServer.prototype = {

    // Add ship on player entrance
    addShip: function (ship) {
        var newship = new Ship(ship);
        newship.spawnProtection();
        this.ships.push(newship);
        //console.log(ship);
    },

    // Get a ship via its id
    getShip: function (id) {
        var result;
        this.ships.forEach(function (ship) {
            if (id === ship.id) {
                result = ship;
            }
        });

        return result;
    },

    updateShip: function (shipid, movement) {
        this.ships.forEach(function (ship) {
            if (ship.id == shipid) {

                ship.movement = movement;

                // If shooting: add shot
                // TODO Consider delay
                if (ship.movement.shooting) {

                    //TODO calculate angle & position
                    var shot = {
                        owner: ship.id,
                        color: ship.color,
                        pos: ship.position,
                        angle: ship.angle,
                        time_to_live: SHOT_LIFESPAN
                    };
                    //this.addShot(shot);
                }

                //console.log('updated ' + ship.id);


            }
        });
    },

    updateShipMovement: function (shipid, dir, move) {
        this.ships.forEach(function (ship) {
            if (ship.id === shipid) {

                if (dir === UP) {
                    ship.movement.up = move;
                } else if (dir === DOWN) {
                    ship.movement.down = move;
                } else if (dir === LEFT) {
                    ship.movement.left = move;
                } else if (dir === RIGHT) {
                    ship.movement.right = move;
                } else if (dir === FIRE && move) {
                    ship.movement.shooting = move;
                    game.addShot(ship);
                }
                //ship.movement = movement;
                //console.log(ship.movement);

                // If shooting: add shot
                // TODO Consider delay

                //console.log('updated ' + ship.id);


            }
        });
    },

    stopShipMovement: function (ship) {
        ship.movement.up = false;
        ship.movement.down = false;
        ship.movement.left = false;
        ship.movement.right = false;
        ship.movement.shooting = false;
    },


    // Add shot
    addShot: function (ship) {

        // If the ship is dieing or dead you can't fire
        if (ship.dying || ship.isInvincible()) {
            return false;
        }

        var vector = new paper.Point({
            angle: ship.angle,
            length: (SHIP_SIZE / 2) - 3
        });

        var shot = {
            owner: ship.id,
            color: ship.color,
            position: ship.item.position.add(vector),
            angle: ship.angle,
        }
        this.shots.push(new Shot(shot));
        io.emit('shot added', ship.id);
        //console.log('shot added');
    },


    // Remove ship on player exit
    removeShip: function (shipID) {
        this.ships = this.ships.filter(function (t) {
            return t.id !== shipID
        })
    },

    removeShots: function (shipID) {
        this.shots = this.shots.filter(function (t) {
            return t.owner !== shipID
        });
    },


    // Synchronize ships
    moveShips: function () {
        this.ships.forEach(function (ship) {

            // Update ship angle
            if (ship.movement.left) {
                //ship.angle -= SHIP_TURNRATE;
                ship.turnLeft();
            }

            if (ship.movement.right) {
                //ship.angle += SHIP_TURNRATE;
                ship.turnRight();
            }

            // Update ship speed
            if (ship.movement.up) {
                //ship.speed = Math.max(SHIP_TOPSPEED);
                //ship.speed = SHIP_TOPSPEED;
                ship.thrust();
            } else {
                //ship.speed = 0;
                ship.coast();
            }

            ship.move();

            //console.log(ship.item.position.x + ' ' + ship.item.position.y);

            //ship.pos

            // Calculate x and y movement based on angle

            // Bei angle = 0 -> X = 1, Y = 0
            // Bei angle = 90 -> X = 0, y = 1

            //x -> cos
            //y -> sin

            //var rad = toRadians(ship.angle);
            //var dx = Math.cos(rad) * ship.speed;
            //var dy = Math.sin(rad) * ship.speed;

            //console.log('dx: ' + dx + ', dy: ' + dy + ', angle: ' + ship.angle);

            //ship.pos.x += dx;
            //ship.pos.y += dy;

            //ship.papergroup.position = new paper.Point(ship.pos.x, ship.pos.y);
            //ship.papergroup.rotation = ship.angle;
            //console.log('x: ' + ship.pos.x + ', y: ' + ship.pos.y + ', angle: ' + ship.angle);

            // Update ship position (based on speed & angle


        });
    },


    // Synchronize shots
    moveShots: function () {
        // Update shot position
        this.shots.forEach(function (shot, i) {

            if (shot.expired()) {
                shot.remove();
                game.shots.splice(i, 1);
                return;
            }

            shot.move();
            //var rad = toRadians(shot.angle);
            //var dx = Math.cos(rad) * SHOT_SPEED;
            //var dy = Math.sin(rad) * SHOT_SPEED;

            //console.log('dx: ' + dx + ', dy: ' + dy + ', angle: ' + ship.angle);

            //shot.pos.x += dx;
            //shot.pos.y += dy;

            //console.log(shot.time_to_live);
        });
    },

    // Detect shot collision
    detectShotCollision: function () {
        // ...
    },

    moveAsteroids: function () {
        // ...
    },


    // Update game objects
    update: function () {
        // Update shots;
        this.moveShots();

        // Update ship movement;
        this.moveShips();

        // Update Asteroid movement;
        this.moveAsteroids();

    },

    // Check for collisions
    checks: function () {
        //checkCollisions
        this.checkCollisions();

        //checkHits
        this.checkHits();
    },

    //Check if any ship is colliding with asteroids
    checkCollisions: function () {

    },

    //Check if any shot is colliding with ships or asteroids
    checkHits: function () {

        // If the game is over, no hitchecks
        if (!game.running) return;

        game.shots.forEach(function (shot) {

            // Ship hits
            game.ships.forEach(function (ship) {
                if (ship.id === shot.owner) {
                    return;
                }

                var check = ship.item.bounds.contains(shot.bullet.position)
                //console.log(check);
                if (check && !ship.isDieing() && !ship.isInvincible()) {
                    console.log(ship.name + ' hit by ' + shot.owner);
                    ship.hitBy(shot.owner);
                }
            });
        });

    },

    //Send data to clients
    //See "Optimisations" in trello list for possible improvements over sending game state
    sendData: function () {

        var ships_position = [];

        game.ships.forEach(function (ship) {
            //console.log(ship.item.position.x + ' ' + ship.item.position.y);
            //console.log(ship.item.position.x + ' ' + ship.position.x);
            ships_position.push([
                ship.id,
                Math.round(ship.item.position.x),
                Math.round(ship.item.position.y),
                ship.angle
            ]);
            //console.log('updated angle: ' + ship.angle);
        });

        //console.log(ships_position);
        io.emit('ships position', ships_position);
    },

    // When the round is started
    startRound: function () {
        // Reenable player control & hitchecks
        this.running = true;
        console.log('Round has started');

        var game = this;

        // Reset Scoreboard
        score.reset();

        // Respawn Ships

        this.ships.forEach(function (ship) {
            ship.respawn();
        });

        // Send "game round start" to clients
        io.emit('game round start', GAME_ROUND_LENGTH);
        //DEBUG
        //io.emit('gameinfo', 'Round has started');

        // Save round start timestamp
        GAME_ROUND_START_TIMESTAMP = new Date().getTime();

        // Tell the game when it's over
        setTimeout(function () {
            game.endRound();
        }, GAME_ROUND_LENGTH);
    },

    // When the round is over
    endRound: function () {
        // Disable player control & hitchecks
        this.running = false;
        var game = this;
        console.log('Round has ended');

        // Send "game round end" to clients
        io.emit('game round end', GAME_ROUND_INBETWEEN);
        // DEBUG
        //io.emit('gameinfo', 'Round has ended');

        // Let ships movement fade out
        this.ships.forEach(function(ship) {
            game.stopShipMovement(ship);
        });

        // Set round end timestamp
        GAME_ROUND_END_TIMESTAMP = new Date().getTime();

        // Tell the game when to start again
        setTimeout(function () {
            game.startRound();
        }, GAME_ROUND_INBETWEEN);
    }

};

game = new GameServer();
score = new Scoreboard();

//Start a new round
game.startRound();


setInterval(function () {
    var perf = process.hrtime();
    //console.log(perf)
    game.update();
    game.checks();
    game.sendData();
    if (SHOW_PERFORMANCE) {
        console.log('executed in ' + ((process.hrtime()[1] - perf[1]) * 0.000001) + 'ms')
    }
}, 1000 / 60);

/* Merge singleplayer version */


var assets = {
    destroyedShip: new function () {
        var group = new paper.Group(
            new paper.Path([-10, -8], [10, 0]),
            new paper.Path([10, 0], [-10, 8]),
            new paper.Path([-8, 4], [-8, -4])
        );
        group.visible = false;
        return group;
    },
    explosion: new function () {
        var explosionPath = new paper.Path.Circle(new paper.Point(), 1);
        explosionPath.fillColor = 'white';
        explosionPath.strokeColor = null;
        return new paper.SymbolDefinition(explosionPath);
    },
    spawnProtection: new function () {
        var circle = new paper.Path.Circle(new paper.Point(), 20);
        circle.visible = false;
        return circle;
    }
};

// PaperJS has no absolute scaling.
//You can calculate the scaling by dividing the intended width/height of your rectangle with the current width/height of your rectangle.
//Then you can use that scaling 'coefficient' to apply the scaling.

function normalizeGroup(group) {

    //group.bounds

    // Get the larger of width & height
    var longside = Math.max(group.bounds.width, group.bounds.height);

    // Get the scaling factor by dividing the the desired size by the current size
    var factor = SHIP_SIZE / longside;

    group = group.scale(factor);

    //console.log(group.bounds.width);

    return group;
}

function Scoreboard() {
    //array of objects
    //object: Player ID, name, score, kills, deaths

    //Add player on join
    //Remove player on leave

    //Add points, kills, deaths to player-id

    var players = [];

    return {
        score: players,

        getPlayers: function () {
            return players;
        },

        addPlayer: function (id, name, color) {
            var player = {
                id: id,
                name: name,
                color: color,
                score: 0,
                kills: 0,
                deaths: 0
            };
            players.push(player);

            //console.log(players);

            //Send new player to clients
            io.emit('scoreboard add player', player);

        },

        removePlayer: function (id) {
            players = players.filter(function (t) {
                return t.id !== id
            })

            //Remove player from clients
            io.emit('scoreboard remove player', id);
        },

        updateScore: function (id, points, kills, deaths) {
            var player = players.find(function (player) {
                return player.id === id
            });
            player.score += points;
            player.kills += kills;
            player.deaths += deaths;
            //console.log(player);

            //Send score to clients
            io.emit('scoreboard update player', player);
        },

        // Resets all scores to 0
        reset: function () {
            players.forEach(function (player) {
                player.score = 0;
                player.kills = 0;
                player.deaths = 0;
            });

        }
    }
}

function Ship(options) {

    var path = new paper.Group().importJSON(options.group);
    //path.closed = true;
    //var thrust = new paper.Path([-8, -4], [-14, 0], [-8, 4]);
    var group = new paper.Group(path);
    //console.log(group.bounds.width);
    group = normalizeGroup(group);
    //console.log(group.bounds.width);

    group.applyMatrix = false;
    //console.log(options.ship);
    //var group = new paper.Group().importJSON(options.group);
    //console.log(group);
    group.position = new paper.Point(options.pos.x, options.pos.y);

    //group.position = new paper.Point(options.pos.x, options.pos.y);
    //console.log(group.position.x + ', ' + group.position.y);
    var hit = false;

    //var id = options.id;
    return {
        item: group,
        angle: options.angle,
        color: options.color,
        movement: options.movement,
        id: options.id,
        name: options.name,
        position: group.position,

        vector: new paper.Point({
            angle: 0.2,
            length: 1
        }),

        destroyedShip: assets.destroyedShip.clone(),

        turnLeft: function () {
            group.rotate(-SHIP_TURNRATE);
            this.angle -= SHIP_TURNRATE;
            //console.log('group.rotation = ' + group.rotation + ', this.angle = ' + this.angle);
        },

        turnRight: function () {
            group.rotate(SHIP_TURNRATE);
            this.angle += SHIP_TURNRATE;
            //console.log('group.rotation = ' + group.rotation + ', this.angle = ' + this.angle);
        },

        thrust: function () {
            //thrust.visible = true;

            this.vector = this.vector.add(new paper.Point({
                angle: this.angle,
                length: SHIP_ACCELERATION
            }));
            //console.log(this.vector);
            if (this.vector.length > SHIP_TOPSPEED) {
                this.vector.length = SHIP_TOPSPEED;
            }
        },

        isInvincible: function () {
            return this.invincible;
        },

        stop: function () {
            this.vector.length = 0;
        },

        fire: function () {

            if (!this.dying) {
                Shot.fire(this.item.position, this.angle);
                console.log('firing');
            }
        },

        coast: function () {
            //thrust.visible = false;
            this.vector = this.vector.multiply(.992);
        },

        move: function () {
            //console.log(this.item.position.x + ' ' + this.item.position.y);
            group.position = group.position.add(this.vector);
            keepInView(group);
        },

        moveTo: function (position) {
            group.position = position;
            keepInView(group);
        },

        hitBy: function (id) {
            if (hit) {
                return;
            }

            hit = true;
            //Send destroy message to clients
            io.emit('ship destroyed', {ship_id: this.id, by: id});
            // Update killer score
            score.updateScore(id, POINTS_PER_KILL, 1, 0);

            // Update victim score
            score.updateScore(this.id, POINTS_PER_DEATH, 0, 1);
            console.log('ship destroyed');
            this.destroy();
        },

        destroy: function () {
            this.destroyedShip.position = this.item.position;
            this.destroyedShip.visible = true;
            this.item.visible = false;
            this.stop();
            //this.item.position = paper.view.center;
            this.dying = true;

            var ship = this;
            setTimeout(function () {
                ship.respawn();
            }, SHIP_RESPAWN_TIME);
        },

        isDieing: function () {
            return this.dying;
        },

        isProtected: function () {
            return this.dying;
        },

        respawn: function () {
            hit = false;
            //console.log('ship respawned');
            this.item.visible = true;
            this.stop();
            this.item.position = new paper.Point(Math.floor(Math.random() * map_width), Math.floor(Math.random() * map_height));
            this.dying = false;
            this.destroyedShip.visible = false;

            //Activate spawn protection
            this.spawnProtection();

        },

        spawnProtection: function () {
            this.invincible = true;
            this.spawnProtectionCircle = assets.spawnProtection.clone();
            this.spawnProtectionCircle.position = this.item.position;
            this.spawnProtectionCircle.visible = true;
            var ship = this;

            //Deactivate after x seconds
            setTimeout(function () {
                ship.invincible = false;
                ship.spawnProtectionCircle.visible = false;
                //console.log('spawn protection deactivated');
            }, SHIP_SPAWN_PROTECTION);
            //return console.log('spawn protection activated');
        },

        checkCollisions: function () {
            var crashRock;

            // move rocks and do a hit-test
            // between bounding rect of rocks and ship
            for (var i = 0; i < Rocks.children.length; i++) {
                var rock = Rocks.children[i];
                rock.position += rock.vector;
                if (rock.bounds.intersects(this.item.bounds))
                    crashRock = rock;
                keepInView(rock);
            }

            if (this.dying) {
                var children = this.destroyedShip.children;
                children[0].position.x++;
                children[1].position.x--;
                children[2].position.x--;
                children[2].position.y++;
                children[0].rotate(1);
                children[1].rotate(-1);
                children[2].rotate(1);
                this.destroyedShip.opacity *= 0.98;

                // don't update anything else if the ship is already dead.
                return;
            }


            // if bounding rect collision, do a line intersection test
            if (crashRock) {
                var tempRock = crashRock.symbol.definition.clone();
                tempRock.transform(crashRock.matrix);
                tempRock.remove();
                var intersections = this.item.firstChild.getIntersections(tempRock);
                if (intersections.length > 0)
                    Lives.remove();
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
            applyMatrix: true,
            center: pos.add(vec),
            radius: 0.5,
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

var Rocks = new function () {
    var group = new paper.Group();
    var shapes = [
        new paper.Path(
            [-23, -40.5], [0, -30.5], [24, -40.5], [45, -21.5], [25, -12.5],
            [46, 9.5], [22, 38.5], [-10, 30.5], [-22, 40.5], [-46, 18.5],
            [-33, 0.5], [-44, -21.5], [-23, -40.5]),
        new paper.Path(
            [-45, -9.5], [-12, -40.5], [24, -40.5], [46, -11.5], [45, 10.5],
            [24, 40.5], [0, 40.5], [0, 10.5], [-23, 38.5], [-46, 9.5], [-25, 0.5],
            [-45, -9.5]),
        new paper.Path([-21.5, -39.5], [11.5, -39.5], [45.5, -20.5],
            [45.5, -8.5], [9.5, 0.5], [44.5, 21.5], [22.5, 39.5], [9.5, 31.5],
            [-20.5, 39.5], [-45.5, 10.5], [-45.5, -20.5], [-11.5, -21.5],
            [-21.5, -39.5]),
        new paper.Path(
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
        rockSymbols[i] = new paper.SymbolDefinition(shapes[i]);
    }

    var explosions = new paper.Group();

    return {
        shapes: shapes,
        children: group.children,
        make: function (type, pos) {
            var randomRock = type + Math.floor(4 * Math.random());
            var rock = rockSymbols[randomRock].place();
            rock.position = pos ? pos : Point.random() * view.size;
            rock.vector = new paper.Point({
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

function keepInView(item) {
    var position = item.position;
    var itemBounds = item.bounds;
    var bounds = {
        width: map_width,
        height: map_height
    };

    if (itemBounds.left > bounds.width) {
        position.x = -item.bounds.width;
    }

    if (position.x < -itemBounds.width) {
        position.x = bounds.width;
    }

    if (itemBounds.top > paper.view.size.height) {
        position.y = -itemBounds.height;
    }

    if (position.y < -itemBounds.height) {
        position.y = bounds.height + itemBounds.height / 2;
    }
}