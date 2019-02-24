jest.mock('crypto');
const mockCrypto = require('crypto');

jest.mock('../x509.js');
const mockX509 = require('../x509.js');

jest.mock('../connectionManager.js');
const mockConnectionManager = require('../connectionManager.js');

jest.mock('edfsm');
const mockFsm = require('edfsm').MockFSM;

jest.mock('../neigh.js');
const mockNeigh = require('../neigh.js');

const tubemail = require('../tubemail.js');

const nextEventLoop = () => new Promise((resolve) => setImmediate(resolve));

describe('Hood', () => {
	test('complain about missing key', () => {
		return tubemail({
			cert: Buffer.alloc(0),
			ca: Buffer.alloc(0)
		}).catch((e) => {
			expect(e).toHaveProperty('message', 'key is missing');
		});
	});

	test('complain about key not being a Buffer', () => {
		return tubemail({
			key: true,
			cert: Buffer.alloc(0),
			ca: Buffer.alloc(0)
		}).catch((e) => {
			expect(e).toHaveProperty('message', 'key must be a buffer');
		});
	});

	test('complain about missing cert', () => {
		return tubemail({
			key: Buffer.alloc(0),
			ca: Buffer.alloc(0)
		}).catch((e) => {
			expect(e).toHaveProperty('message', 'cert is missing');
		});
	});

	test('complain about cert not being a Buffer', () => {
		return tubemail({
			cert: true,
			key: Buffer.alloc(0),
			ca: Buffer.alloc(0)
		}).catch((e) => {
			expect(e).toHaveProperty('message', 'cert must be a buffer');
		});
	});

	test('complain about missing ca', () => {
		return tubemail({
			key: Buffer.alloc(0),
			cert: Buffer.alloc(0)
		}).catch((e) => {
			expect(e).toHaveProperty('message', 'ca is missing');
		});
	});

	test('complain about ca not being a Buffer', () => {
		return tubemail({
			ca: true,
			key: Buffer.alloc(0),
			cert: Buffer.alloc(0)
		}).catch((e) => {
			expect(e).toHaveProperty('message', 'ca must be a buffer');
		});
	});

	test('emit static discovery', () => {
		const discovery = {host: 'abc', port: 1234};
		tubemail({
			ca: Buffer.alloc(0),
			key: Buffer.alloc(0),
			cert: Buffer.alloc(0),
			discovery
		});
		const onDiscovery = jest.fn();
		expect(mockFsm.mock.instances[0].ctx.startDiscovery[0]({}, onDiscovery));
		expect(onDiscovery.mock.calls[0][0]).toBe(discovery);
	});

	test('convert old discovery API to the new API', () => {
		const discovery = jest.fn();
		tubemail({
			ca: Buffer.alloc(0),
			key: Buffer.alloc(0),
			cert: Buffer.alloc(0),
			discovery: (port, fingerprint, onPeer) => discovery(port, fingerprint, onPeer)
		});
		const ctx = mockFsm.mock.instances[0].ctx;
		const port = 123;
		const fingerprint = 'abc';
		const onPeer = () => {};
		ctx.startDiscovery[0]({port, fingerprint}, onPeer);
		expect(discovery.mock.calls[0][0]).toBe(port);
		expect(discovery.mock.calls[0][1]).toBe(fingerprint);
		expect(discovery.mock.calls[0][2]).toBe(onPeer);
	});

	test('complain about wrong formated static discovery: port', () => {
		return tubemail({
			ca: Buffer.alloc(0),
			key: Buffer.alloc(0),
			cert: Buffer.alloc(0),
			discovery: {host: 'abc'}
		}).catch((e) => {
			expect(e).toHaveProperty('message', 'port for discovery is missing');
		});
	});

	test('complain about wrong formated static discovery: host', () => {
		return tubemail({
			ca: Buffer.alloc(0),
			key: Buffer.alloc(0),
			cert: Buffer.alloc(0),
			discovery: {port: 123}
		}).catch((e) => {
			expect(e).toHaveProperty('message', 'host for discovery is missing');
		});
	});

	test('set port to 4816/4817/4818/4819 by default', () => {
		tubemail({
			ca: Buffer.alloc(0),
			key: Buffer.alloc(0),
			cert: Buffer.alloc(0)
		});
		expect(mockFsm.mock.instances[0].ctx.portCandidates).toEqual([4816, 4817, 4818, 4819]);
	});

	test('store specified port', () => {
		const port = 1234;
		tubemail({
			ca: Buffer.alloc(0),
			key: Buffer.alloc(0),
			cert: Buffer.alloc(0),
			port: port
		});
		expect(mockFsm.mock.instances[0].ctx.portCandidates).toEqual([port]);
	});

	test('store specified port as string', () => {
		const port = '1234';
		tubemail({
			ca: Buffer.alloc(0),
			key: Buffer.alloc(0),
			cert: Buffer.alloc(0),
			port: port
		});
		expect(mockFsm.mock.instances[0].ctx.portCandidates).toEqual([parseInt(port)]);
	});

	test('store specified port candidates', () => {
		const port = [1234, 5678];
		tubemail({
			ca: Buffer.alloc(0),
			key: Buffer.alloc(0),
			cert: Buffer.alloc(0),
			port: port
		});
		expect(mockFsm.mock.instances[0].ctx.portCandidates).toEqual(port);
	});

	test('store specified port range', () => {
		tubemail({
			ca: Buffer.alloc(0),
			key: Buffer.alloc(0),
			cert: Buffer.alloc(0),
			discovery: () => {},
			port: {from: 1234, to: 1236}
		});
		expect(mockFsm.mock.instances[0].ctx.portCandidates).toEqual([1234, 1235, 1236]);
	});

	test('get fingerprint from given ca cert', () => {
		const fingerprint = 'abcdef';
		mockX509.getFingerprint.mockImplementationOnce(() => fingerprint);
		const ca = Buffer.from('chucky');
		tubemail({
			ca: ca,
			key: Buffer.alloc(0),
			cert: Buffer.alloc(0)
		});
		expect(mockX509.getFingerprint.mock.calls[0][0]).toBe(ca);
		expect(mockFsm.mock.instances[0].ctx.fingerprint).toBe(fingerprint);
	});

	test('parse cert info', () => {
		const info = {test: true};
		mockX509.parseCert.mockImplementationOnce(() => (info));
		const cert = Buffer.from('chucky');
		tubemail({
			ca: Buffer.alloc(0),
			key: Buffer.alloc(0),
			cert: cert
		});
		expect(mockX509.parseCert.mock.calls[0][0]).toBe(cert);
		expect(mockFsm.mock.instances[0].ctx.info).toBe(info);
	});

	test('create new server', () => {
		const tm = {
			ca: Buffer.alloc(0),
			key: Buffer.alloc(0),
			cert: Buffer.alloc(0)
		};
		tubemail(tm);
		expect(mockConnectionManager.mock.calls[0][0].key).toBe(tm.key);
		expect(mockConnectionManager.mock.calls[0][0].cert).toBe(tm.cert);
		expect(mockConnectionManager.mock.calls[0][0].ca[0]).toBe(tm.ca);
		expect(mockConnectionManager.mock.calls[0][0].requestCert).toBe(true);
		expect(mockConnectionManager.mock.calls[0][0].rejectUnauthorized).toBe(true);
		expect(mockConnectionManager.mock.calls[0][0].checkServerIdentity()).toBeUndefined();
	});

	test('send data to all neighs', () => {
		const neigh = [
			{send: jest.fn()},
			{send: jest.fn()}
		];
		tubemail({
			ca: Buffer.alloc(0),
			key: Buffer.alloc(0),
			cert: Buffer.alloc(0)
		});
		const tm = mockFsm.mock.instances[0].ctx;
		tm.neighbours = neigh;
		const msg = Buffer.alloc(0);
		tm.send(msg);
		neigh.forEach((n) => {
			expect(n.send.mock.calls[0][0]).toBe(msg);
		});
	});

	test('get neighbour by id', () => {
		const neigh = [
			{id: 'a'},
			{id: 'b'}
		];
		tubemail({
			ca: Buffer.alloc(0),
			key: Buffer.alloc(0),
			cert: Buffer.alloc(0)
		});
		const tm = mockFsm.mock.instances[0].ctx;
		tm.neighbours = neigh;
		expect(tm.getNeigh({id: 'a'})).toBe(neigh[0]);
	});

	test('get neighbour by host and port', () => {
		const neigh = [
			{host: 'a', listenPort: 1234},
			{host: 'b', listenPort: 1234}
		];
		tubemail({
			ca: Buffer.alloc(0),
			key: Buffer.alloc(0),
			cert: Buffer.alloc(0)
		});
		const tm = mockFsm.mock.instances[0].ctx;
		tm.neighbours = neigh;
		expect(tm.getNeigh({host: 'a', port: 1234})).toBe(neigh[0]);
	});

	test('resolve on listening event', () => {
		const q = tubemail({
			ca: Buffer.alloc(0),
			key: Buffer.alloc(0),
			cert: Buffer.alloc(0)
		});
		const tm = mockFsm.mock.instances[0].ctx;
		tm.emit('listening');
		return q.then((ctx) => {
			expect(ctx).toBe(tm);
		});
	});

	test('install leave method', () => {
		const q = tubemail({
			ca: Buffer.alloc(0),
			key: Buffer.alloc(0),
			cert: Buffer.alloc(0)
		});
		const tm = mockFsm.mock.instances[0];
		tm.next = jest.fn();
		tm.ctx.emit('listening');
		return q.then((ctx) => {
			const q = ctx.leave();
			expect(tm.next.mock.calls[0][0]).toBe(null);
			tm.ctx.emit('goodbye');
			return q;
		});
	});

	test('reject on error', () => {
		const q = tubemail({
			ca: Buffer.alloc(0),
			key: Buffer.alloc(0),
			cert: Buffer.alloc(0)
		});
		const tm = mockFsm.mock.instances[0].ctx;
		const err = new Error();
		tm.emit('error', err);
		return q.catch((e) => {
			expect(e).toBe(err);
		});
	});
});

describe('State: generateLocalID', () => {
	test('generate id', () => {
		// We need predictable randomness ;)
		const id = Buffer.from('a');
		mockCrypto.__randomBytes.mockImplementationOnce(() => id);
		tubemail({
			ca: Buffer.alloc(0),
			key: Buffer.alloc(0),
			cert: Buffer.alloc(0)
		});
		const tm = mockFsm.mock.instances[0];
		tm.testState('generateLocalID');
		expect(tm.ctx.id).toEqual(id.toString('hex'));
		expect(tm.next.mock.calls[0][0]).toEqual('listen');
	});

	test('reject if collecting randomness for the id fails', () => {
		const err = new Error('NSA don\'t like randomness');
		mockCrypto.randomBytes.mockImplementationOnce((bytes, cb) => cb(err));
		tubemail({
			ca: Buffer.alloc(0),
			key: Buffer.alloc(0),
			cert: Buffer.alloc(0)
		});
		const tm = mockFsm.mock.instances[0];
		tm.testState('generateLocalID');
		expect(tm.next.mock.calls[0][0]).toBe(err);
	});
});

describe('State: listen', () => {
	test('listen on port candidate', async () => {
		const port = 1234;
		tubemail({
			ca: Buffer.alloc(0),
			key: Buffer.alloc(0),
			cert: Buffer.alloc(0)
		});
		const tm = mockFsm.mock.instances[0];
		tm.ctx.portCandidates = [port];
		tm.testState('listen');
		await nextEventLoop();
		expect(tm.ctx.port).toBe(port);
		expect(tm.ctx.portCandidates).toBeUndefined();
		expect(tm.next.mock.calls[0][0]).toEqual('active');
	});

	test('try next port candidate if port is in use', async () => {
		tubemail({
			ca: Buffer.alloc(0),
			key: Buffer.alloc(0),
			cert: Buffer.alloc(0)
		});
		const tm = mockFsm.mock.instances[0];
		tm.ctx.portCandidates = [1234];
		const err = new Error();
		err.code = 'EADDRINUSE';
		mockConnectionManager.prototype.listen.mockReturnValue(Promise.reject(err));
		tm.testState('listen');
		await nextEventLoop();
		expect(tm.ctx.portCandidates.length).toBe(0);
		expect(tm.next.mock.calls[0][0]).toEqual('listen');
	});

	test('abort listen attempts on other errors', async () => {
		tubemail({
			ca: Buffer.alloc(0),
			key: Buffer.alloc(0),
			cert: Buffer.alloc(0)
		});
		const tm = mockFsm.mock.instances[0];
		tm.ctx.portCandidates = [1234];
		const err = new Error();
		mockConnectionManager.prototype.listen.mockReturnValue(Promise.reject(err));
		tm.testState('listen');
		await nextEventLoop();
		expect(tm.ctx.portCandidates.length).toBe(0);
		expect(tm.next.mock.calls[0][0]).toBe(err);
	});

	test('abort listen attempts if no candidates are available', () => {
		tubemail({
			ca: Buffer.alloc(0),
			key: Buffer.alloc(0),
			cert: Buffer.alloc(0)
		});
		const tm = mockFsm.mock.instances[0];
		tm.ctx.portCandidates = [];
		tm.testState('listen');
		expect(tm.next.mock.calls[0][0].message).toEqual('Listening failed');
	});
});

describe('State: active', () => {
	test('emit listening event', () => {
		tubemail({
			ca: Buffer.alloc(0),
			key: Buffer.alloc(0),
			cert: Buffer.alloc(0)
		});
		const tm = mockFsm.mock.instances[0];
		const onListening = jest.fn();
		tm.ctx.on('listening', onListening);
		tm.testState('active');
		expect(onListening.mock.calls.length).toBe(1);
	});

	test('start new connection on discovery event', () => {
		tubemail({
			ca: Buffer.alloc(0),
			key: Buffer.alloc(0),
			cert: Buffer.alloc(0)
		});
		const tm = mockFsm.mock.instances[0];
		tm.testState('active');
		const peer = {};
		tm.ctx.emit('discovery', peer);
		expect(mockConnectionManager.prototype.connect.mock.calls[0][0]).toBe(peer);
	});

	test('suppress discovery if neigh already known', () => {
		tubemail({
			ca: Buffer.alloc(0),
			key: Buffer.alloc(0),
			cert: Buffer.alloc(0)
		});
		const tm = mockFsm.mock.instances[0];
		const host = 'abc';
		const port = 1234;
		tm.ctx.neighbours.push({host, listenPort: port});
		tm.testState('active');
		const peer = {host, port};
		tm.ctx.emit('discovery', peer);
		expect(mockConnectionManager.prototype.connect.mock.calls.length).toBe(0);
	});

	test('suppress discovery events if connection already exists', () => {
		tubemail({
			ca: Buffer.alloc(0),
			key: Buffer.alloc(0),
			cert: Buffer.alloc(0)
		});
		const tm = mockFsm.mock.instances[0];
		tm.testState('active');
		const peer = {host: 'abc', port: 1234};
		tm.ctx.emit('discovery', peer);
		tm.ctx.emit('discovery', peer);
		expect(mockConnectionManager.prototype.connect.mock.calls.length).toBe(1);
		mockConnectionManager.prototype.connect.mock.calls[0][1]();
		tm.ctx.emit('discovery', peer);
		expect(mockConnectionManager.prototype.connect.mock.calls.length).toBe(2);
	});

	test('start discovery', () => {
		const stop = () => {};
		const discovery = jest.fn(() => stop);
		tubemail({
			ca: Buffer.alloc(0),
			key: Buffer.alloc(0),
			cert: Buffer.alloc(0),
			discovery
		});
		const tm = mockFsm.mock.instances[0];
		tm.ctx.port = 1234;
		tm.ctx.fingerprint = 'abc';
		tm.testState('active');
		expect(discovery.mock.calls[0][0]).toBe(tm.ctx);
		expect(tm.ctx.stopDiscovery[0]).toBe(stop);
		const onDiscovery = jest.fn();
		tm.ctx.on('discovery', onDiscovery);
		const info = {};
		discovery.mock.calls[0][1](info);
		expect(onDiscovery.mock.calls[0][0]).toBe(info);
	});

	test('start multiple discovery', () => {
		const stop1 = () => {};
		const discovery1 = jest.fn(() => stop1);
		const stop2 = () => {};
		const discovery2 = jest.fn(() => stop2);
		tubemail({
			ca: Buffer.alloc(0),
			key: Buffer.alloc(0),
			cert: Buffer.alloc(0),
			discovery: [discovery1, discovery2]
		});
		const tm = mockFsm.mock.instances[0];
		tm.ctx.port = 1234;
		tm.ctx.fingerprint = 'abc';
		tm.testState('active');
		expect(discovery1.mock.calls[0][0]).toBe(tm.ctx);
		expect(discovery2.mock.calls[0][0]).toBe(tm.ctx);
		expect(tm.ctx.stopDiscovery[0]).toBe(stop1);
		expect(tm.ctx.stopDiscovery[1]).toBe(stop2);
	});

	test('run neigh factory', () => {
		tubemail({
			ca: Buffer.alloc(0),
			key: Buffer.alloc(0),
			cert: Buffer.alloc(0)
		});
		const tm = mockFsm.mock.instances[0];
		tm.testState('active');
		const connection = {};
		mockConnectionManager.mock.instances[0].emit('connection', connection);
		expect(mockNeigh.mock.calls[0][0]).toBe(tm.ctx);
		expect(mockNeigh.mock.calls[0][1]).toBe(connection);
	});

	test('add neighbour after success handshake', () => {
		tubemail({
			ca: Buffer.alloc(0),
			key: Buffer.alloc(0),
			cert: Buffer.alloc(0)
		});
		const tm = mockFsm.mock.instances[0];
		tm.testState('active');
		const neigh = {};
		tm.ctx.emit('foundNeigh', neigh);
		expect(tm.ctx.neighbours[0]).toBe(neigh);
	});

	test('remove neighbour after disconnect', () => {
		tubemail({
			ca: Buffer.alloc(0),
			key: Buffer.alloc(0),
			cert: Buffer.alloc(0)
		});
		const tm = mockFsm.mock.instances[0];
		tm.testState('active');
		const neigh1 = {};
		const neigh2 = {};
		tm.ctx.neighbours.push(neigh1);
		tm.ctx.neighbours.push(neigh2);
		tm.ctx.emit('lostNeigh', neigh1);
		expect(tm.ctx.neighbours[0]).toBe(neigh2);
		expect(tm.ctx.neighbours.length).toBe(1);
	});
});

describe('State: final', () => {
	test('stop discovery and server', async () => {
		tubemail({
			ca: Buffer.alloc(0),
			key: Buffer.alloc(0),
			cert: Buffer.alloc(0),
			discovery: () => () => Promise.resolve()
		});
		const tm = mockFsm.mock.instances[0];
		tm.ctx.stopDiscovery = [jest.fn()];
		const onGoodbye = jest.fn();
		tm.ctx.on('goodbye', onGoodbye);
		tm.testState('_final');
		expect(tm.ctx.stopDiscovery[0].mock.calls.length).toBe(1);
		expect(mockConnectionManager.prototype.close.mock.calls.length).toBe(1);
		expect(onGoodbye.mock.calls.length).toBe(0);
		await nextEventLoop();
		expect(onGoodbye.mock.calls.length).toBe(1);
		expect(tm.next.mock.calls.length).toBe(1);
	});

	test('emit errors', () => {
		tubemail({
			ca: Buffer.alloc(0),
			key: Buffer.alloc(0),
			cert: Buffer.alloc(0)
		}).catch(() => {});
		const tm = mockFsm.mock.instances[0];
		const onError = jest.fn();
		tm.ctx.on('error', onError);
		const err = new Error();
		tm.testState('_final', err);
		expect(onError.mock.calls[0][0]).toBe(err);
	});
});
