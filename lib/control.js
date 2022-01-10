module.exports = RED => {
    function controlRobot(n) {
        RED.nodes.createNode(this, n);
        const node = this;
        node.client = RED.nodes.getNode(n.client);
        node.client.subscribe(node.id, 'state', state => node.status(state));
        const actionsAllowed = [ 'enableSchedule', 'disableSchedule', 'startCleaning', 'stopCleaning', 'sendToBase', 'startCleaningBoundary', 'findMe' ]
        const id = n.robotid || '';

        this.on('input', (message, send, done) => {
            const robot = node.client.getRobot(id);
            if (robot && robot._serial === id)
            {
                if (message.payload && message.payload.action && actionsAllowed.indexOf(message.payload.action) >= 0)
                {
                    node.log(`${robot.name} action ${message.payload.action}`)
                    const responseHandler = function(error, result) {
                        if (error) {
                            node.status({fill: 'red', shape: 'ring', text: 'action failed'});
                            done(error);
                        } else {
                            node.status({fill: 'green', shape: 'ring', text: 'action completed'});
                            message.payload = result
                            send(message)
                            done()
                        }
                    }
                    switch (message.payload.action) {
                        case 'enableSchedule':
                            robot.enableSchedule(responseHandler)
                            break;
                        case 'disableSchedule':
                            robot.disableSchedule(responseHandler)
                            break;
                        case 'startCleaning':
                            robot.startCleaning(message.payload.eco || false, 1 /*1:normal,2:extra care*/, true /*noGoLines*/, responseHandler)
                            break;
                        case 'stopCleaning':
                            robot.stopCleaning(responseHandler)
                            break;
                        case 'sendToBase':
                            robot.sendToBase(responseHandler)
                            break;
                        case 'startCleaningBoundary':
                            robot.startCleaningBoundary(message.payload.eco || false, message.payload.care || true, message.payload.roomid || '', responseHandler)
                            break;
                        case 'findMe':
                            robot.findMe(responseHandler)
                            break;
                        default:
                            node.status({fill: 'red', shape: 'ring', text: 'not supported'});
                            done('not supported');
                    }
                } else {
                    node.status({fill: 'red', shape: 'ring', text: 'not supported'});
                    done('not supported');
                }
            } else {
                node.status({fill: 'red', shape: 'ring', text: 'robot not available'});
                done('robot not available');
            }
        });
    }
    RED.nodes.registerType('kobold-control', controlRobot);
}
