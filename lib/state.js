module.exports = RED => {
    function getState(n) {
        RED.nodes.createNode(this, n);
        const node = this;
        node.client = RED.nodes.getNode(n.client);
        node.client.subscribe(node.id, 'state', state => node.status(state));
        const id = n.robotid || '';

        this.on('input', (message, send, done) => {
            const robot = node.client.getRobot(id);
            if (robot && robot._serial === id)
            {
                robot.getState(function (error, result) {
                    if (error) {
                        done(error);
                    }
                    node.status({fill: 'green', shape: 'ring', text: `${robot.name}: Battery:${result.details.charge}%`});
                    message.payload = result;
                    send(message);
                    done();
                });
            } else {
                node.status({fill: 'red', shape: 'ring', text: 'robot not available'});
                done('robot not available');
            }
        });
    }
    RED.nodes.registerType('kobold-state', getState);
}
