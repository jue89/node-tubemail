const EventEmitter = require('events');
const util = require('util');

const funcOrNop = (func) => (typeof func === 'function') ? func : () => {};

function FSM (config, data) {
	EventEmitter.call(this);

	this.onEnter = funcOrNop(config.onEnter);
	this.onLeave = funcOrNop(config.onLeave);
	this.onDestroy = funcOrNop(config.onDestroy);
	this.states = config.states;
	this.data = data;
	this.state = undefined;

	setImmediate(() => this.enterState(config.firstState));
}

util.inherits(FSM, EventEmitter);

FSM.prototype.enterState = function (newState) {
	new Promise((resolve, reject) => {
		const oldState = this.state;

		// Enter callback shall be called before the new state is entered!
		this.onEnter(this.data);

		// Try to enter new state and setup resolve / reject listener
		const ret = this.states[newState](this.data, resolve, reject);
		if (ret instanceof Promise) {
			ret.then((nextState) => resolve(nextState)).catch((e) => reject(e));
		}

		// We entered the new state! Update FSM and call events
		this.state = newState;
		this.emit('state', this.data, newState, oldState);
	}).then((nextState) => {
		// We left the state
		this.onLeave(this.data);
		this.enterState(nextState);
	}).catch((err) => {
		// Leave the FSM
		this.onLeave(this.data);
		const oldState = this.state;
		this.state = undefined;

		// Call events
		this.onDestroy(this.data, err, oldState);
		this.emit('destroy', this.data, err, oldState);
	});
};

module.exports = (config) => (data) => new FSM(config, data);
