/* const obj = {};

const data = new FSM({
	onStateLeave: (obj) => obj._socket.removeAllListeners(),
	onStateEnter: (obj) => {},
	onCreate: (obj) => { obj._connected = false; },
	onDestroy: (obj, reason) => {
		if (!obj._socket.destroyed) obj._socket.destroy();
		obj._connected = false;
	},
	firstState: 'incomingConnection',
	states: {
		incomingConnection: (obj, resolve, reject) => {
			// resolve: next state, reject: destroy fsm
			obj._socket.on('data', (chunk) => resolve('checkAuth'));
			setTimeout(() => reject('Timeout'), 3000);
		},
		checkAuth: (obj) => {
			if (obj.authorized) return Promise.resolve();
			else return Promise.reject('nope');
		},
		connected: (obj, resolve, reject) => {
			obj._connected = true;
			obj._socket.on('error', (e) => obj.emit('error', e));
			obj._socket.on('close', () => reject('Connection closed'));
			obj._socket.on('data', (chunk) => obj.emit('message', chunk));
		}
	}
}).create(obj);

console.log(data);

data.obj = current ObjectData;
data.state = currentFSMstate;
data.fsm = handleOfStatemachine;
data.on('state', (newState, oldState) => {});
data.on('destroy', (reason, oldState) => {});

const spy = (arg) => {
	console.log(arg);
	return Promise.resolve(arg);
};
*/
const EventEmitter = require('events');
const util = require('util');

function FSM (config, data) {
	EventEmitter.call(this);

	this.onDestroy = config.onDestroy;
	this.states = config.states;
	this.data = data;
	this.state = undefined;

	setImmediate(() => this.enterState(config.firstState));
}

util.inherits(FSM, EventEmitter);

FSM.prototype.enterState = function (newState) {
	new Promise((resolve, reject) => {
		const oldState = this.state;

		// Try to enter new state and setup resolve / reject listener
		const ret = this.states[newState](this.data, resolve, reject);
		if (ret instanceof Promise) {
			ret.then((nextState) => resolve(nextState)).catch((e) => reject(e));
		}

		// We entered the new state! Update FSM and call events
		this.state = newState;
		this.emit('state', this.data, newState, oldState);
	}).then((nextState) => {
		this.enterState(nextState);
	}).catch((err) => {
		// Leave the FSM
		const oldState = this.state;
		this.state = undefined;

		// Call events
		if (typeof this.onDestroy === 'function') this.onDestroy(this.data, err, oldState);
		this.emit('destroy', this.data, err, oldState);
	});
};

module.exports = (config) => (data) => new FSM(config, data);
