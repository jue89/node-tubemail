const EventEmitter = require('events');
const util = require('util');
module.exports = jest.fn(() => { EventEmitter.call(this); });
util.inherits(module.exports, EventEmitter);
module.exports.prototype.listen = jest.fn(() => Promise.resolve());
module.exports.prototype.connect = jest.fn(() => Promise.resolve());
module.exports.prototype.close = jest.fn(() => Promise.resolve());
