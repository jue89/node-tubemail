jest.mock('tls');
const tls = require('tls');

jest.mock('crypto');
const crypto = require('crypto');

jest.mock('x509');
const x509 = require('x509');

jest.mock('../neigh.js');
const neigh = require('../neigh.js');

const tubemail = require('../tubemail.js');

test('complain about missing key', () => {
	return tubemail({
		cert: Buffer.alloc(0),
		ca: Buffer.alloc(0),
		discovery: () => {}
	}).then(() => Promise.reject(new Error('FAILED'))).catch((e) => {
		expect(e).toHaveProperty('message', 'key is missing');
	});
});

test('complain about key not being a Buffer', () => {
	return tubemail({
		key: true,
		cert: Buffer.alloc(0),
		ca: Buffer.alloc(0),
		discovery: () => {}
	}).then(() => Promise.reject(new Error('FAILED'))).catch((e) => {
		expect(e).toHaveProperty('message', 'key must be a buffer');
	});
});

test('complain about missing cert', () => {
	return tubemail({
		key: Buffer.alloc(0),
		ca: Buffer.alloc(0),
		discovery: () => {}
	}).then(() => Promise.reject(new Error('FAILED'))).catch((e) => {
		expect(e).toHaveProperty('message', 'cert is missing');
	});
});

test('complain about cert not being a Buffer', () => {
	return tubemail({
		cert: true,
		key: Buffer.alloc(0),
		ca: Buffer.alloc(0),
		discovery: () => {}
	}).then(() => Promise.reject(new Error('FAILED'))).catch((e) => {
		expect(e).toHaveProperty('message', 'cert must be a buffer');
	});
});

test('complain about missing ca', () => {
	return tubemail({
		key: Buffer.alloc(0),
		cert: Buffer.alloc(0),
		discovery: () => {}
	}).then(() => Promise.reject(new Error('FAILED'))).catch((e) => {
		expect(e).toHaveProperty('message', 'ca is missing');
	});
});

test('complain about ca not being a Buffer', () => {
	return tubemail({
		ca: true,
		key: Buffer.alloc(0),
		cert: Buffer.alloc(0),
		discovery: () => {}
	}).then(() => Promise.reject(new Error('FAILED'))).catch((e) => {
		expect(e).toHaveProperty('message', 'ca must be a buffer');
	});
});

test('complain about missing discovery', () => {
	return tubemail({
		ca: Buffer.alloc(0),
		key: Buffer.alloc(0),
		cert: Buffer.alloc(0)
	}).then(() => Promise.reject(new Error('FAILED'))).catch((e) => {
		expect(e).toHaveProperty('message', 'discovery is missing');
	});
});

test('generate id', () => {
	const id = Buffer.alloc(64, 'a');
	crypto.__randomBytes.mockImplementation(() => id);
	return tubemail({
		ca: Buffer.alloc(0),
		key: Buffer.alloc(0),
		cert: Buffer.alloc(0),
		discovery: () => {}
	}).then((realm) => {
		expect(crypto.__randomBytes.mock.calls[0][0]).toEqual(id.length);
		expect(realm.id).toEqual(id);
	});
});

test('create new server', () => {
	const ca = Buffer.alloc(0);
	const cert = Buffer.alloc(0);
	const key = Buffer.alloc(0);
	return tubemail({
		ca: ca,
		key: key,
		cert: cert,
		discovery: () => {}
	}).then(() => {
		expect(tls.createServer.mock.calls[0][0]).toMatchObject({
			ca: [ca],
			cert: cert,
			key: key,
			requestCert: true,
			rejectUnauthorized: true
		});
	});
});

test('listen on specified port', () => {
	const port = 1234;
	return tubemail({
		ca: Buffer.alloc(0),
		key: Buffer.alloc(0),
		cert: Buffer.alloc(0),
		discovery: () => {},
		port: port
	}).then(() => {
		expect(tls.__server.listen.mock.calls[0][0]).toEqual(port);
	});
});

test('listen on 4816 by default', () => {
	return tubemail({
		ca: Buffer.alloc(0),
		key: Buffer.alloc(0),
		cert: Buffer.alloc(0),
		discovery: () => {}
	}).then(() => {
		expect(tls.__server.listen.mock.calls[0][0]).toEqual(4816);
	});
});

test('get fingerprint from given ca cert', () => {
	const fingerPrint = 'AB:cd:ef:12';
	x509.parseCert.mockImplementationOnce(() => ({ fingerPrint }));
	const ca = Buffer.from('chucky');
	return tubemail({
		ca: ca,
		key: Buffer.alloc(0),
		cert: Buffer.alloc(0),
		discovery: () => {}
	}).then((realm) => {
		expect(realm.fingerPrint).toEqual(fingerPrint.replace(/:/g, '').toLowerCase());
		expect(x509.parseCert.mock.calls[0][0]).toEqual(ca.toString());
	});
});

test('call discovery with port and fingerprint', () => {
	const fingerPrint = 'ab:cd';
	x509.parseCert.mockImplementationOnce(() => ({ fingerPrint }));
	const port = 12345;
	const discovery = jest.fn();
	return tubemail({
		ca: Buffer.alloc(0),
		key: Buffer.alloc(0),
		cert: Buffer.alloc(0),
		port: port,
		discovery: discovery
	}).then(() => {
		expect(discovery.mock.calls[0][0]).toEqual(port);
		expect(discovery.mock.calls[0][1]).toEqual(fingerPrint.replace(/:/g, '').toLowerCase());
	});
});

test('call factory if discovery discovered client', () => {
	const ca = Buffer.alloc(0);
	const key = Buffer.alloc(0);
	const cert = Buffer.alloc(0);
	const id = Buffer.alloc(64, 'a');
	const discovery = jest.fn();
	crypto.__randomBytes.mockImplementation(() => id);
	return tubemail({
		ca,
		key,
		cert,
		discovery
	}).then(() => {
		const host = 'peni$';
		const port = 69;
		discovery.mock.calls[0][2]({ host, port });
		expect(neigh.outbound.mock.calls[0][0]).toMatchObject({
			ca,
			key,
			cert,
			id
		});
		expect(neigh.outbound.mock.calls[0][1]).toMatchObject({
			host,
			port
		});
	});
});

test('call factory for incoming connections', () => {
	const ca = Buffer.alloc(0);
	const key = Buffer.alloc(0);
	const cert = Buffer.alloc(0);
	const id = Buffer.alloc(64, 'a');
	crypto.__randomBytes.mockImplementation(() => id);
	return tubemail({
		ca,
		key,
		cert,
		discovery: () => {}
	}).then(() => {
		const socket = {};
		tls.__server.emit('secureConnection', socket);
		expect(neigh.inbound.mock.calls[0][0]).toMatchObject({
			ca,
			key,
			cert,
			id
		});
		expect(neigh.inbound.mock.calls[0][1]).toBe(socket);
	});
});

test('added learned outbound id', () => {
	const id = Buffer.from('abcd');
	const discovery = jest.fn();
	return tubemail({
		ca: Buffer.alloc(0),
		key: Buffer.alloc(0),
		cert: Buffer.alloc(0),
		discovery: discovery
	}).then((realm) => {
		// Advertise discovery
		discovery.mock.calls[0][2]({});
		// Fake that we discovered a new neighbour and are about to send over our ID
		neigh.__outbound.emit('state', {id}, 'sendLocalID');
		return realm;
	}).then((realm) => {
		expect(realm.knownIDs[0]).toEqual(id.toString('hex'));
	});
});
