function TemporaryEventListener (eventEmitter) {
	this.eventEmitter = eventEmitter;
	this.registeredEvents = [];
}

TemporaryEventListener.prototype.on = function (eventName, eventHandler) {
	this.registeredEvents.push({eventName, eventHandler});
	this.eventEmitter.on(eventName, eventHandler);
	return this;
};

TemporaryEventListener.prototype.clear = function () {
	this.registeredEvents.forEach((e) => {
		this.eventEmitter.removeListener(e.eventName, e.eventHandler);
	});
	this.registeredEvents = [];
};

module.exports = { TemporaryEventListener };
