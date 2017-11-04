const EventEmitter = require('events');

jest.mock('tls');
const tls = require('tls');

jest.mock('../stream2block.js');
const S2B = require('../stream2block.js');

jest.mock('../fsm.js');
const FSM = require('../fsm.js');

const neigh = require('../neigh.js');

jest.useFakeTimers();
beforeEach(() => jest.clearAllTimers());

describe('outbound factory', () => {
	test('connect to discovered host', (done) => {
		const local = {
			id: Buffer.alloc(64, 'z').toString('hex'),
			ca: Buffer.alloc(0),
			key: Buffer.alloc(0),
			cert: Buffer.alloc(0),
			knownIDs: []
		};
		const remote = {
			host: 'peni$',
			port: 69
		};
		neigh.outbound(local, remote);
		FSM.__config.states.connect(FSM.__data, (state) => {
			try {
				expect(state).toEqual('checkAuth');
				expect(tls.connect.mock.calls[0][0]).toMatchObject({
					ca: [local.ca],
					key: local.key,
					cert: local.cert,
					host: remote.host,
					port: remote.port
				});
				done();
			} catch (e) { done(e); }
		});
	});

	test('check authorisation', (done) => {
		neigh.outbound({}, {});
		FSM.__data.socket = new EventEmitter();
		FSM.__data.socket.authorized = true;
		FSM.__config.states.checkAuth(FSM.__data, (state) => {
			try {
				expect(state).toEqual('getSocketInfo');
				expect(FSM.__data.interface).toBeInstanceOf(S2B);
				done();
			} catch (e) { done(e); }
		});
		FSM.__data.socket.emit('secureConnect');
	});

	test('reject if connection attempt failed', (done) => {
		neigh.outbound({}, {});
		FSM.__data.socket = new EventEmitter();
		const err = new Error('Mimimi');
		FSM.__config.states.checkAuth(FSM.__data, () => {}, (e) => {
			try {
				expect(e).toBe(err);
				done();
			} catch (e) { done(e); }
		});
		FSM.__data.socket.emit('error', err);
	});

	test('reject if connection is not authorised', (done) => {
		neigh.outbound({}, {});
		FSM.__data.socket = new EventEmitter();
		const reason = 'Ohne Tasche keine Competition!';
		FSM.__config.states.checkAuth(FSM.__data, () => {}, (err) => {
			try {
				expect(err.message).toEqual(reason);
				done();
			} catch (e) { done(e); }
		});
		FSM.__data.socket.authorized = false;
		FSM.__data.socket.authorizationError = reason;
		FSM.__data.socket.emit('secureConnect');
	});

	test('get remote cert, host and port', (done) => {
		neigh.outbound({}, {});
		const host = '1.2.3.4';
		const port = 9876;
		const cert = { test: 'true' };
		const socket = {
			remoteAddress: host,
			remotePort: port,
			getPeerCertificate: () => cert
		};
		const n = {
			socket: socket
		};
		FSM.__config.states.getSocketInfo(n, (state) => {
			try {
				expect(state).toEqual('receiveRemoteID');
				expect(n.host).toEqual(host);
				expect(n.port).toEqual(port);
				expect(n.cert).toBe(cert);
				done();
			} catch (e) { done(e); }
		});
	});

	test('reject if too short welcome message has been sent', (done) => {
		neigh.outbound({}, {});
		const i = new EventEmitter();
		const n = { interface: i };
		FSM.__config.states.receiveRemoteID(n, () => {}, (err) => {
			try {
				expect(err.message).toEqual('Incomplete welcome message');
				done();
			} catch (e) { done(e); }
		});
		i.emit('data', Buffer.alloc(0));
	});

	test('reject if no magic emoji has been sent', (done) => {
		neigh.outbound({}, {});
		const i = new EventEmitter();
		const n = { interface: i };
		FSM.__config.states.receiveRemoteID(n, () => {}, (err) => {
			try {
				expect(err.message).toEqual('Magic missing');
				done();
			} catch (e) { done(e); }
		});
		i.emit('data', Buffer.alloc(64 + 4));
	});

	test('reject if remote id is higher than ours', (done) => {
		neigh.outbound({ id: Buffer.alloc(64, 'a').toString('hex') }, {});
		const i = new EventEmitter();
		const n = { interface: i };
		FSM.__config.states.receiveRemoteID(n, () => {}, (err) => {
			try {
				expect(err.message).toEqual('Remote ID higher than ours');
				done();
			} catch (e) { done(e); }
		});
		i.emit('data', Buffer.concat([
			Buffer.from('🛰'),
			Buffer.alloc(64, 'b')
		]));
	});

	test('reject if remote id is equal', (done) => {
		neigh.outbound({ id: Buffer.alloc(64, 'a').toString('hex') }, {});
		const i = new EventEmitter();
		const n = { interface: i };
		FSM.__config.states.receiveRemoteID(n, () => {}, (err) => {
			try {
				expect(err.message).toEqual('We connected ourselfes');
				done();
			} catch (e) { done(e); }
		});
		i.emit('data', Buffer.concat([
			Buffer.from('🛰'),
			Buffer.alloc(64, 'a')
		]));
	});

	test('reject if remote id is known', (done) => {
		const id = Buffer.alloc(64, 'a');
		neigh.outbound({
			id: Buffer.alloc(64, 'b').toString('hex'),
			knownIDs: [ id.toString('hex') ]
		}, {});
		const i = new EventEmitter();
		const n = { interface: i };
		FSM.__config.states.receiveRemoteID(n, () => {}, (err) => {
			try {
				expect(err.message).toEqual('Remote ID is already connected');
				done();
			} catch (e) { done(e); }
		});
		i.emit('data', Buffer.concat([
			Buffer.from('🛰'),
			id
		]));
	});

	test('reject if connection is closed', (done) => {
		neigh.outbound({}, {});
		const i = new EventEmitter();
		const n = { interface: i };
		FSM.__config.states.receiveRemoteID(n, () => {}, (err) => {
			try {
				expect(err.message).toEqual('Remote host closed the connection');
				done();
			} catch (e) { done(e); }
		});
		i.emit('close');
	});

	test('reject if remote host hasn\'t sent id within 5s', (done) => {
		neigh.outbound({}, {});
		const i = new EventEmitter();
		const n = { interface: i };
		FSM.__config.states.receiveRemoteID(n, () => {}, (err) => {
			try {
				expect(err.message).toEqual('Remote host has not sent its ID');
				done();
			} catch (e) { done(e); }
		});
		jest.runTimersToTime(5000);
	});

	test('destroy socket if fsm is left', () => {
		const socket = {
			destroyed: false,
			destroy: jest.fn()
		};
		neigh.outbound({}, {});
		FSM.__config.onDestroy({ socket: socket });
		expect(socket.destroy.mock.calls.length).toEqual(1);
	});

	test('go to next state if we accepted the remote host', (done) => {
		const id = Buffer.alloc(64, 'a');
		neigh.outbound({
			id: Buffer.alloc(64, 'b').toString('hex'),
			knownIDs: []
		}, {});
		const i = new EventEmitter();
		const n = { interface: i };
		FSM.__config.states.receiveRemoteID(n, (state) => {
			try {
				expect(state).toEqual('sendLocalID');
				done();
			} catch (e) { done(e); }
		});
		i.emit('data', Buffer.concat([
			Buffer.from('🛰'),
			id
		]));
	});

	test('send local ID if we want to say hi to outbound neigh', (done) => {
		const EMJ = Buffer.from('🛰');
		const localID = Buffer.alloc(64, 'z');
		const localWelcome = Buffer.concat([ EMJ, localID ]);
		neigh.outbound({ id: localID.toString('hex') }, {});
		const i = { send: jest.fn((d, c) => c()) };
		FSM.__config.states.sendLocalID({ interface: i }, (state) => {
			try {
				expect(i.send.mock.calls[0][0].toString('hex')).toEqual(localWelcome.toString('hex'));
				expect(state).toEqual('connected');
				done();
			} catch (e) { done(e); }
		});
	});

	test('forward data events', (done) => {
		neigh.outbound({}, {});
		FSM.__data.interface = new EventEmitter();
		FSM.__config.states.connected(FSM.__data);
		const data = Buffer.alloc(0);
		FSM.__data.on('message', (d) => {
			try {
				expect(d).toBe(data);
				done();
			} catch (e) { done(e); }
		});
		FSM.__data.interface.emit('data', data);
	});

	test('destroy on close event', (done) => {
		neigh.outbound({}, {});
		FSM.__data.interface = new EventEmitter();
		FSM.__config.states.connected(FSM.__data, () => {}, (err) => {
			try {
				expect(err.message).toEqual('Connection closed');
				done();
			} catch (e) { done(e); }
		});
		FSM.__data.interface.emit('close');
	});
});
