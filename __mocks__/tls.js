const EventEmitter = require('events');

module.exports.createServer = jest.fn(() => {
	module.exports.__server = new EventEmitter();
	module.exports.__server.listen = jest.fn(() => module.exports.__server);
	return module.exports.__server;
});

module.exports.connect = jest.fn(() => {
	module.exports.__socket = new EventEmitter();
	return module.exports.__socket;
});
