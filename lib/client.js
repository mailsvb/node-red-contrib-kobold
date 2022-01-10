module.exports = RED => {
    const util = require('util')
    const kobold = require('node-kobold-api');
    const availableRobots = {}

    const State = Object.freeze({
        Undefined: 'Undefinded',
        Initialized: 'Initialized',
        Ready: 'Ready',
        Stopping: 'Stopping'
    })

    function tokenHandler(n) {
        RED.nodes.createNode(this, n)
        if (!n || !n._users || !n._users.length) {
            // if no nodes use this server return
            return
        }
        const node = this
        node.token = n.token || ''
        node.subscriptions = {}
        node.state = State.Undefinded
        node.running = false

        // broadcast events to subscribed nodes
        node.broadcast = (type, data) => {
            node.log(`broadcasting: type[${type}] data[${util.inspect(data, { showHidden: true, depth: null })}]`)
            for (const id in node.subscriptions) {
                if (node.subscriptions[id].hasOwnProperty(type)) {
                    node.debug(`broadcasting: type[${type}] id[${id}]`)
                    if (type === 'state') {
                        let shape, fill
                        switch (node.state) {
                            case State.Initialized:
                                shape = 'ring'
                                fill = 'yellow'
                                break
                            case State.Ready:
                                shape = 'dot'
                                fill = 'green'
                                break
                            case State.Stopping:
                                shape = 'dot'
                                fill = 'red'
                                break
                            default:
                                shape = 'dot'
                                fill = 'grey'
                        }
                        node.subscriptions[id][type]({fill: fill, shape: shape, text: data || node.state})
                    } else {
                        node.subscriptions[id][type]({data: data})
                    }
                }
            }
        };

        // subscribe and unsubscribe handling
        node.subscribe = (id, type, cb) => {
            node.log('receive subscribe for >' + type + '< from >' + id + '<');
            node.subscriptions[id] = node.subscriptions[id] || {};
            node.subscriptions[id][type] = cb;
            if (type === 'state') {
                node.broadcast('state', node.state);
            }
        };
        node.unsubscribe = (id, type) => {
            if (node.subscriptions[id].hasOwnProperty(type)) {
                delete node.subscriptions[id][type];
            }
            if (Object.keys(node.subscriptions[id]).length === 0 || type === '') {
                delete node.subscriptions[id];
            }
        };
        node.getRobot = (id) => {
            for (let i = 0; i < availableRobots[node.id].length; i++) {
                if (availableRobots[node.id][i]._serial === id) {
                    return availableRobots[node.id][i];
                }
            }
            return null;
        };
        node.getMapsAndRooms = (robot, cb) => {
            const newMaps = []
            robot.getPersistentMaps(function (error, maps) {
                if (error) {
                    node.error(error)
                    return cb();
                } else {
                    var mapsProcessed = 0;
                    maps.forEach(map => {
                        const newMap = {
                            id: map.id,
                            name: map.name,
                            rooms: []
                        }
                        robot.getMapBoundaries(newMap.id, function(error, rooms) {
                            if (error) {
                                node.error(error)
                                return cb();
                            } else {
                                rooms.boundaries && rooms.boundaries.filter(elem => elem.type === 'polygon' && elem.enabled === true).forEach(room => {
                                    newMap.rooms.push({ id: room.id, name: room.name })
                                })
                                node.log(`Map ${newMap.name} from ${robot.name} has ${newMap.rooms.length} room${newMap.rooms.length === 1 ? '' : 's'}: ${newMap.rooms.map(elem => elem.name).join(', ')}`)
                                newMaps.push(newMap)
                                mapsProcessed++;
                                if (maps.length === mapsProcessed) {
                                    node.log(`${robot.name} has ${newMaps.length} map${newMaps.length === 1 ? '' : 's'}: ${newMaps.map(elem => elem.name).join(', ')}`)
                                    cb(newMaps)
                                }
                            }
                        })
                    })
                }
            })
        };

        if (!node.token) {
            node.error('token required to get new client')
            node.state = State.Undefinded
            node.broadcast('state', 'missing token')
            return
        }

        if (!node.client) {
            node.client = new kobold.Client(node.token);
            node.state = State.Initialized
        }

        node.broadcast('state', node.state)
        if (!node.running) {
            availableRobots[node.id] = []
            node.client.getRobots(function (error, robots) {
                if (error) {
                    node.error(error)
                    node.state = State.Stopping
                    node.broadcast('state', 'error getting robots')
                    return
                }
                if (robots.length) {
                    for (const robot of robots) {
                        availableRobots[node.id].push(robot)
                    }
                }
                const robotCount = availableRobots[node.id].length
                node.state = State.Ready
                node.broadcast('state', `${robotCount} Robot${robotCount === 1 ? '' : 's'} available`)
                availableRobots[node.id].forEach(robot => {
                    node.getMapsAndRooms(robot, function(maps) {
                        if (maps && Array.isArray(maps)) {
                            robot.maps = maps;
                        } else {
                            robot.maps = [];
                        }
                    })
                });
            });
        }

        this.on('close', function(done) {
            delete node.client
            node.state = State.Stopping
            node.broadcast('state', node.state)
            node.running = false
            done()
        });
    }
    RED.nodes.registerType('kobold-client', tokenHandler);

    RED.httpAdmin.get("/getavailablerobots/:id", RED.auth.needsPermission('kobold-client.read'), function(req,res) {
        if (req.params.id && availableRobots[req.params.id]) {
            const robotList = []
            availableRobots[req.params.id].forEach(robot => {
                robotList.push({ serial: robot._serial, name: robot.name });
            })
            res.json({robots: robotList});
        } else {
            res.json({robots: []});
        }
    });
};
