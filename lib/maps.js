module.exports = RED => {
    function getMaps(n) {
        RED.nodes.createNode(this, n);
        const node = this;
        node.client = RED.nodes.getNode(n.client);
        node.client.subscribe(node.id, 'state', state => node.status(state));
        const id = n.robotid || '';

        this.on('input', (message, send, done) => {
            const robot = node.client.getRobot(id);
            if (robot && robot._serial === id)
            {
                node.client.getMapsAndRooms(robot, function(maps) {
                    if (maps && Array.isArray(maps)) {
                        robot.maps = maps;
                    } else {
                        robot.maps = [];
                    }
                    node.status({fill: 'green', shape: 'ring', text: `${robot.name} has ${maps.length} map${maps.length === 1 ? '' : 's'} available`});
                    message.payload = maps;
                    send(message);
                    done();
                })
            } else {
                node.status({fill: 'red', shape: 'ring', text: 'robot not available'});
                done('robot not available');
            }
        });
    }
    RED.nodes.registerType('kobold-maps', getMaps);
}
