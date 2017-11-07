const EventEmitter = require('events');

jest.mock('tls');
const tls = require('tls');

jest.mock('x509');
const x509 = require('x509');

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
			ca: Buffer.alloc(0),
			key: Buffer.alloc(0),
			cert: Buffer.alloc(0)
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
		FSM.__data.socket.emit('secureConnect');
	});

	test('reject if connection attempt failed', (done) => {
		neigh.outbound({}, {});
		const err = new Error('Mimimi');
		FSM.__config.states.connect(FSM.__data, () => {}, (e) => {
			try {
				expect(e).toBe(err);
				done();
			} catch (e) { done(e); }
		});
		FSM.__data.socket.emit('error', err);
	});

	test('check authorisation', (done) => {
		neigh.outbound({}, {});
		FSM.__data.socket = {
			authorized: true
		};
		FSM.__config.states.checkAuth(FSM.__data, (state) => {
			try {
				expect(state).toEqual('getSocketInfo');
				expect(FSM.__data.interface).toBeInstanceOf(S2B);
				done();
			} catch (e) { done(e); }
		});
	});

	test('reject if connection is not authorised', (done) => {
		neigh.outbound({}, {});
		const reason = 'Ohne Tasche keine Competition!';
		FSM.__data.socket = {
			authorized: false,
			authorizationError: reason
		};
		FSM.__config.states.checkAuth(FSM.__data, () => {}, (err) => {
			try {
				expect(err.message).toEqual(reason);
				done();
			} catch (e) { done(e); }
		});
	});

	test('get remote cert, host and port', (done) => {
		neigh.outbound({}, {});
		const host = '1.2.3.4';
		const port = 9876;
		const rawCert = { raw: Buffer.from('hello') };
		const pemCert = '-----BEGIN CERTIFICATE-----\n' +
			rawCert.raw.toString('base64') +
			'\n-----END CERTIFICATE-----';
		const cert = { test: true };
		const socket = {
			remoteAddress: host,
			remotePort: port,
			getPeerCertificate: () => rawCert
		};
		const n = {
			socket: socket
		};
		x509.parseCert.mockImplementationOnce(() => cert);
		FSM.__config.states.getSocketInfo(n, (state) => {
			try {
				expect(state).toEqual('receiveRemoteID');
				expect(n.host).toEqual(host);
				expect(n.port).toEqual(port);
				expect(x509.parseCert.mock.calls[0][0]).toEqual(pemCert);
				expect(n.info).toBe(cert);
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
		const id = Buffer.alloc(64, 'a');
		neigh.outbound({ _id: id, id: id.toString('hex') }, {});
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
		const id = Buffer.alloc(64, 'a');
		neigh.outbound({ _id: id, id: id.toString('hex') }, {});
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
			id
		]));
	});

	test('reject if remote id is known', (done) => {
		const idRemote = Buffer.alloc(64, 'a');
		const idLocal = Buffer.alloc(64, 'b');
		neigh.outbound({
			_id: idLocal,
			id: idLocal.toString('hex'),
			knownIDs: [ idRemote.toString('hex') ]
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
			idRemote
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
		const idLocal = Buffer.alloc(64, 'b');
		const idRemote = Buffer.alloc(64, 'a');
		neigh.outbound({
			_id: idLocal,
			id: idLocal.toString('hex'),
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
			idRemote
		]));
	});

	test('send local ID if we want to say hi to outbound neigh', (done) => {
		const EMJ = Buffer.from('🛰');
		const localID = Buffer.alloc(64, 'z');
		const localWelcome = Buffer.concat([ EMJ, localID ]);
		neigh.outbound({ _id: localID, id: localID.toString('hex') }, {});
		const i = { send: jest.fn() };
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

describe('inbound factory', () => {
	test('store socket', () => {
		const socket = {};
		neigh.inbound({}, socket);
		expect(FSM.__data.socket).toBe(socket);
	});

	test('check authorisation', (done) => {
		const socket = {
			authorized: true
		};
		neigh.inbound({}, socket);
		FSM.__config.states.checkAuth(FSM.__data, (state) => {
			try {
				expect(state).toEqual('getSocketInfo');
				expect(FSM.__data.interface).toBeInstanceOf(S2B);
				done();
			} catch (e) { done(e); }
		});
	});

	test('send local ID', (done) => {
		const id = Buffer.alloc(64, 'z');
		neigh.inbound({ _id: id, id: id.toString('hex') }, {});
		const i = { send: jest.fn() };
		FSM.__config.states.sendLocalID({ interface: i }, (state) => {
			try {
				expect(state).toEqual('receiveRemoteID');
				done();
			} catch (e) { done(e); }
		});
	});

	test('get remote cert, host and port', (done) => {
		const socket = {
			remoteAddress: '1.2.3.4',
			remotePort: 9876,
			getPeerCertificate: () => ({ raw: Buffer.from('hello') })
		};
		neigh.inbound({}, socket);
		FSM.__config.states.getSocketInfo(FSM.__data, (state) => {
			try {
				expect(state).toEqual('sendLocalID');
				done();
			} catch (e) { done(e); }
		});
	});

	test('reject if remote id is lower than ours', (done) => {
		const id = Buffer.alloc(64, 'b');
		neigh.inbound({ _id: id, id: id.toString('hex') }, {});
		const i = new EventEmitter();
		const n = { interface: i };
		FSM.__config.states.receiveRemoteID(n, () => {}, (err) => {
			try {
				expect(err.message).toEqual('Remote ID lower than ours');
				done();
			} catch (e) { done(e); }
		});
		i.emit('data', Buffer.concat([
			Buffer.from('🛰'),
			Buffer.alloc(64, 'a')
		]));
	});

	test('go to next state if we accepted the remote host', (done) => {
		const idLocal = Buffer.alloc(64, 'a');
		const idRemote = Buffer.alloc(64, 'b');
		neigh.inbound({
			_id: idLocal,
			id: idLocal.toString('hex'),
			knownIDs: []
		}, {});
		const i = new EventEmitter();
		const n = { interface: i };
		FSM.__config.states.receiveRemoteID(n, (state) => {
			try {
				expect(state).toEqual('connected');
				done();
			} catch (e) { done(e); }
		});
		i.emit('data', Buffer.concat([
			Buffer.from('🛰'),
			idRemote
		]));
	});

	test('send message', () => {
		const msg = Buffer.alloc(0);
		neigh.inbound({}, {});
		FSM.__data.interface = {
			send: jest.fn()
		};
		FSM.__data.send(msg);
		expect(FSM.__data.interface.send.mock.calls[0][0]).toBe(msg);
	});

	test('complain about non-buffer', () => {
		const msg = 'hello';
		neigh.inbound({}, {});
		expect(() => {
			FSM.__data.send(msg);
		}).toThrowError('Payload must be a Buffer');
	});
});
