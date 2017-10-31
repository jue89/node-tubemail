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

	this.states = config.states;
	this.data = data;
	this.state = undefined;

	setImmediate(() => this.enterState(config.firstState));
}

util.inherits(FSM, EventEmitter);

FSM.prototype.enterState = function (stateName) {
	new Promise((resolve) => {
		const ret = this.states[stateName](this.data, resolve);

		this.emit('state', stateName, this.state);
		this.state = stateName;

		if (ret instanceof Promise) {
			ret.then((nextState) => resolve(nextState));
		}
	}).then((nextState) => this.enterState(nextState));
};

module.exports = (config) => (data) => new FSM(config, data);
