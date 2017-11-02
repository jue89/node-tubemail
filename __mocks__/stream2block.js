const EventEmitter = require('events');
const util = require('util');

module.exports = jest.fn(function () {
	EventEmitter.call(this);
});

util.inherits(module.exports, EventEmitter);

module.exports.prototype.send = jest.fn((data, cb) => cb());
