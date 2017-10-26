const EventEmitter = require('events');

module.exports.createServer = jest.fn(() => {
	module.exports.__server = new EventEmitter();
	module.exports.__server.listen = jest.fn((port, cb) => cb());
	return module.exports.__server;
});
