const EventEmitter = require('events');

jest.mock('tls');
const tls = require('tls');

jest.mock('crypto');
const crypto = require('crypto');

jest.mock('x509');
const x509 = require('x509');

jest.mock('../fsm.js');
const FSM = require('../fsm.js');

jest.mock('../neigh.js');
const neigh = require('../neigh.js');

const tubemail = require('../tubemail.js');

test('complain about missing key', () => {
	return tubemail({
		cert: Buffer.alloc(0),
		ca: Buffer.alloc(0),
		discovery: () => {}
	}).catch((e) => {
		expect(e).toHaveProperty('message', 'key is missing');
	});
});

test('complain about key not being a Buffer', () => {
	return tubemail({
		key: true,
		cert: Buffer.alloc(0),
		ca: Buffer.alloc(0),
		discovery: () => {}
	}).catch((e) => {
		expect(e).toHaveProperty('message', 'key must be a buffer');
	});
});

test('complain about missing cert', () => {
	return tubemail({
		key: Buffer.alloc(0),
		ca: Buffer.alloc(0),
		discovery: () => {}
	}).catch((e) => {
		expect(e).toHaveProperty('message', 'cert is missing');
	});
});

test('complain about cert not being a Buffer', () => {
	return tubemail({
		cert: true,
		key: Buffer.alloc(0),
		ca: Buffer.alloc(0),
		discovery: () => {}
	}).catch((e) => {
		expect(e).toHaveProperty('message', 'cert must be a buffer');
	});
});

test('complain about missing ca', () => {
	return tubemail({
		key: Buffer.alloc(0),
		cert: Buffer.alloc(0),
		discovery: () => {}
	}).catch((e) => {
		expect(e).toHaveProperty('message', 'ca is missing');
	});
});

test('complain about ca not being a Buffer', () => {
	return tubemail({
		ca: true,
		key: Buffer.alloc(0),
		cert: Buffer.alloc(0),
		discovery: () => {}
	}).catch((e) => {
		expect(e).toHaveProperty('message', 'ca must be a buffer');
	});
});

test('complain about missing discovery', () => {
	return tubemail({
		ca: Buffer.alloc(0),
		key: Buffer.alloc(0),
		cert: Buffer.alloc(0)
	}).catch((e) => {
		expect(e).toHaveProperty('message', 'discovery is missing');
	});
});

test('store specified port', () => {
	const port = 1234;
	tubemail({
		ca: Buffer.alloc(0),
		key: Buffer.alloc(0),
		cert: Buffer.alloc(0),
		discovery: () => {},
		port: port
	});
	expect(FSM.__data.port).toEqual(port);
});

test('set port to 4816 by default', () => {
	tubemail({
		ca: Buffer.alloc(0),
		key: Buffer.alloc(0),
		cert: Buffer.alloc(0),
		discovery: () => {}
	});
	expect(FSM.__data.port).toEqual(4816);
});

test('get fingerprint from given ca cert', () => {
	const fingerPrint = 'AB:cd:ef:12';
	x509.parseCert.mockImplementationOnce(() => ({ fingerPrint }));
	const ca = Buffer.from('chucky');
	tubemail({
		ca: ca,
		key: Buffer.alloc(0),
		cert: Buffer.alloc(0),
		discovery: () => {}
	});
	expect(x509.parseCert.mock.calls[0][0]).toEqual(ca.toString());
	expect(FSM.__data.fingerPrint).toEqual(fingerPrint.replace(/:/g, '').toLowerCase());
});

test('parse cert info', () => {
	x509.parseCert.mockImplementationOnce(() => ({ fingerPrint: '' }));
	const info = { test: true };
	x509.parseCert.mockImplementationOnce(() => (info));
	const cert = Buffer.from('chucky');
	tubemail({
		ca: Buffer.alloc(0),
		key: Buffer.alloc(0),
		cert: cert,
		discovery: () => {}
	});
	expect(x509.parseCert.mock.calls[1][0]).toEqual(cert.toString());
	expect(FSM.__data.info).toBe(info);
});

test('resolve once server is listening', () => {
	const fingerPrint = 'AB:cd:ef:12';
	x509.parseCert.mockImplementationOnce(() => ({ fingerPrint }));
	const tm = {
		ca: Buffer.alloc(0),
		key: Buffer.alloc(0),
		cert: Buffer.alloc(0),
		port: 4321,
		discovery: () => {}
	};
	const q = tubemail(tm).then((realm) => {
		expect(realm.ca).toBe(tm.ca);
		expect(realm.key).toBe(tm.key);
		expect(realm.cert).toBe(tm.cert);
		expect(realm.port).toEqual(tm.port);
		expect(realm.discovery).toBe(tm.discovery);
		expect(realm.knownIDs).toBeInstanceOf(Array);
		expect(realm.neigh).toEqual({});
		expect(realm.fingerPrint).toEqual(fingerPrint.replace(/:/g, '').toLocaleLowerCase());
	});
	FSM.__fsm.emit('state:listening', FSM.__data);
	return q;
});

test('generate id', (done) => {
	// We need predictable randomness ;)
	const id = Buffer.alloc(64, 'a');
	crypto.__randomBytes.mockImplementationOnce(() => id);
	const tm = {};
	FSM.__config.states.generateLocalID(tm, (state) => {
		try {
			expect(state).toEqual('createServer');
			expect(crypto.randomBytes.mock.calls[0][0]).toEqual(id.length);
			expect(tm._id).toBe(id);
			expect(tm.id).toEqual(id.toString('hex'));
			done();
		} catch (e) { done(e); }
	});
});

test('reject if collecting randomness for the id fails', (done) => {
	const err = new Error('NSA don\'t like randomness');
	crypto.randomBytes.mockImplementationOnce((bytes, cb) => cb(err));
	FSM.__config.states.generateLocalID({}, () => {}, (reason) => {
		try {
			expect(reason).toBe(err);
			done();
		} catch (e) { done(e); }
	});
});

test('create new server', (done) => {
	const tm = {
		ca: Buffer.alloc(0),
		key: Buffer.alloc(0),
		cert: Buffer.alloc(0),
		port: 1234
	};
	FSM.__config.states.createServer(tm, (state) => {
		try {
			expect(state).toEqual('listening');
			expect(tls.createServer.mock.calls[0][0]).toMatchObject({
				ca: [tm.ca],
				cert: tm.cert,
				key: tm.key,
				requestCert: true,
				rejectUnauthorized: true
			});
			expect(tls.__server.listen.mock.calls[0][0]).toEqual(tm.port);
			done();
		} catch (e) { done(e); }
	});
	tls.__server.emit('listening');
});

test('report failed listening attempt', (done) => {
	const tm = {
		ca: Buffer.alloc(0),
		key: Buffer.alloc(0),
		cert: Buffer.alloc(0),
		port: 1234
	};
	FSM.__config.states.createServer(tm, () => {}, (err) => {
		try {
			expect(err.message).toEqual('Listening to port 1234 failed: NOPE');
			done();
		} catch (e) { done(e); }
	});
	tls.__server.emit('error', new Error('NOPE'));
});

test('call discovery with port and fingerprint', () => {
	const discovery = jest.fn();
	const tm = {
		port: 1234,
		fingerPrint: 'abcd',
		discovery: discovery,
		socket: new EventEmitter()
	};
	FSM.__config.states.listening(tm);
	expect(discovery.mock.calls[0][0]).toEqual(tm.port);
	expect(discovery.mock.calls[0][1]).toEqual(tm.fingerPrint);
});

test('call factory if discovery discovered client', () => {
	const discovery = jest.fn();
	const tm = {
		port: 1234,
		fingerPrint: 'abcd',
		discovery: discovery,
		socket: new EventEmitter()
	};
	FSM.__config.states.listening(tm);
	const peer = {
		host: 'foo',
		port: 12345
	};
	discovery.mock.calls[0][2](peer);
	expect(neigh.outbound.mock.calls[0][0]).toBe(tm);
	expect(neigh.outbound.mock.calls[0][1]).toBe(peer);
});

test('add learned outbound id', () => {
	const discovery = jest.fn();
	const tm = {
		port: 1234,
		fingerPrint: 'abcd',
		discovery: discovery,
		socket: new EventEmitter(),
		knownIDs: []
	};
	FSM.__config.states.listening(tm);
	discovery.mock.calls[0][2]({});
	const n = { id: 'hot-neighbour' };
	neigh.__outbound.emit('state:sendLocalID', n);
	expect(tm.knownIDs[0]).toEqual(n.id);
});

test('add learned outbound neigh and raise event', (done) => {
	const discovery = jest.fn();
	const n = { id: 'hot-neighbour', on: jest.fn() };
	const tm = {
		port: 1234,
		fingerPrint: 'abcd',
		discovery: discovery,
		socket: new EventEmitter(),
		neigh: {},
		emit: (e, x) => {
			try {
				expect(e).toEqual('foundNeigh');
				expect(x).toBe(n);
				expect(tm.neigh[n.id]).toBe(n);
				expect(n.on.mock.calls[0][0]).toEqual('message');
				done();
			} catch (e) { done(e); }
		}
	};
	FSM.__config.states.listening(tm);
	discovery.mock.calls[0][2]({});
	neigh.__outbound.emit('state:connected', n);
});

test('expose destroy method in listening state', (done) => {
	const tm = {
		discovery: () => {},
		socket: new EventEmitter()
	};
	FSM.__config.states.listening(tm, () => {}, done);
	tm.leave();
});

test('call factory for incoming connections', () => {
	const socket = new EventEmitter();
	const tm = {
		port: 1234,
		fingerPrint: 'abcd',
		socket: socket,
		discovery: () => {}
	};
	FSM.__config.states.listening(tm);
	const peer = {
		host: 'foo',
		port: 12345
	};
	socket.emit('secureConnection', peer);
	expect(neigh.inbound.mock.calls[0][0]).toBe(tm);
	expect(neigh.inbound.mock.calls[0][1]).toBe(peer);
});

test('add learned inbound neigh and raise event', (done) => {
	const socket = new EventEmitter();
	const n = { id: 'hot-neighbour', on: jest.fn() };
	const tm = {
		socket,
		discovery: () => {},
		knownIDs: [],
		neigh: {},
		emit: (e, x) => {
			try {
				expect(e).toEqual('foundNeigh');
				expect(x).toBe(n);
				expect(tm.knownIDs[0]).toEqual(n.id);
				expect(tm.neigh[n.id]).toBe(n);
				expect(n.on.mock.calls[0][0]).toEqual('message');
				done();
			} catch (e) { done(e); }
		}
	};
	FSM.__config.states.listening(tm);
	socket.emit('secureConnection', {});
	neigh.__inbound.emit('state:connected', n);
});

test('remove id and handle of inbound connection', (done) => {
	const n1 = new EventEmitter();
	n1.data = { id: 'abc' };
	n1.state = undefined;
	neigh.inbound.mockImplementationOnce(() => n1);
	const n2 = new EventEmitter();
	n2.data = { id: 'def' };
	n2.state = 'connected';
	neigh.inbound.mockImplementationOnce(() => n2);
	const tm = new EventEmitter();
	tm.discovery = jest.fn();
	tm.socket = new EventEmitter();
	tm.knownIDs = [ 'abc', 'def' ];
	tm.neigh = { 'abc': n1, 'def': n2 };
	FSM.__config.states.listening(tm);
	tm.socket.emit('secureConnection');
	tm.socket.emit('secureConnection');
	tm.on('lostNeigh', (n) => {
		try {
			expect(n).toBe(n1.data);
			expect(tm.knownIDs).toEqual(['def']);
			expect(tm.neigh).toEqual({'def': n2});
			done();
		} catch (e) {
			done(e);
		}
	});
	n1.emit('destroy');
});

test('remove id and handle of outbound connection', (done) => {
	const n1 = new EventEmitter();
	n1.data = { id: 'abc' };
	n1.state = undefined;
	neigh.outbound.mockImplementationOnce(() => n1);
	const n2 = new EventEmitter();
	n2.data = { id: 'def' };
	n2.state = 'connected';
	neigh.outbound.mockImplementationOnce(() => n2);
	const tm = new EventEmitter();
	tm.discovery = jest.fn();
	tm.socket = new EventEmitter();
	tm.knownIDs = [ 'abc', 'def' ];
	tm.neigh = { 'abc': n1, 'def': n2 };
	FSM.__config.states.listening(tm);
	tm.discovery.mock.calls[0][2]();
	tm.discovery.mock.calls[0][2]();
	tm.on('lostNeigh', (n) => {
		try {
			expect(n).toBe(n1.data);
			expect(tm.knownIDs).toEqual(['def']);
			expect(tm.neigh).toEqual({'def': n2});
			done();
		} catch (e) {
			done(e);
		}
	});
	n1.emit('destroy');
});

test('install destory of all neigh FSMs method', () => {
	const n = ['abc', 'def'].map((id) => {
		const tmp = new EventEmitter();
		tmp.data = {id};
		tmp.destroy = jest.fn();
		neigh.outbound.mockImplementationOnce(() => tmp);
		return tmp;
	});
	const tm = {
		discovery: jest.fn(),
		socket: new EventEmitter(),
		knownIDs: [],
		neigh: {}
	};
	FSM.__config.states.listening(tm);
	n.forEach(() => tm.discovery.mock.calls[0][2]());
	tm._leave();
	n.forEach((n) => expect(n.destroy.mock.calls.length).toEqual(1));
});

test('send data to all neighs', (done) => {
	const neigh = ['a', 'b'].map((id) => ({
		send: jest.fn()
	}));
	const msg = Buffer.alloc(0);
	const tm = {
		ca: Buffer.alloc(0),
		key: Buffer.alloc(0),
		cert: Buffer.alloc(0),
		port: 4321,
		discovery: () => {}
	};
	tubemail(tm).then((realm) => {
		realm.send(msg);
		try {
			neigh.forEach((n) => {
				expect(n.send.mock.calls[0][0]).toBe(msg);
			});
			done();
		} catch (e) {
			done(e);
		}
	});
	FSM.__data.neigh = neigh;
	FSM.__fsm.emit('state:listening', FSM.__data);
});

test('stop discovery on leave', (done) => {
	const tm = new EventEmitter();
	tm.stopDiscovery = jest.fn();
	FSM.__config.onDestroy(tm);
	expect(tm.stopDiscovery.mock.calls.length).toEqual(1);
	tm.on('goodbye', () => done());
});

test('quit all FSMs on leave', (done) => {
	const tm = new EventEmitter();
	tm._leave = jest.fn();
	FSM.__config.onDestroy(tm);
	expect(tm._leave.mock.calls.length).toEqual(1);
	tm.on('goodbye', () => done());
});

test('close socket on leave', (done) => {
	const tm = new EventEmitter();
	tm.socket = new EventEmitter();
	tm.socket.listening = true;
	tm.socket.close = jest.fn();
	FSM.__config.onDestroy(tm);
	expect(tm.socket.close.mock.calls.length).toEqual(1);
	tm.on('goodbye', () => done());
	tm.socket.emit('close');
});
