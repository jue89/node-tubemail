const EventEmitter = require('events');

module.exports.outbound = jest.fn(() => {
	module.exports.__outbound = new EventEmitter();
	return module.exports.__outbound;
});
module.exports.inbound = jest.fn(() => {
	module.exports.__inbound = new EventEmitter();
	return module.exports.__inbound;
});
