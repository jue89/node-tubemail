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
	expect.assertions(1);
	return tubemail({
		cert: Buffer.alloc(0),
		ca: Buffer.alloc(0),
		discovery: () => {}
	}).catch((e) => {
		expect(e).toHaveProperty('message', 'key is missing');
	});
});

test('complain about key not being a Buffer', () => {
	expect.assertions(1);
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
	expect.assertions(1);
	return tubemail({
		key: Buffer.alloc(0),
		ca: Buffer.alloc(0),
		discovery: () => {}
	}).catch((e) => {
		expect(e).toHaveProperty('message', 'cert is missing');
	});
});

test('complain about cert not being a Buffer', () => {
	expect.assertions(1);
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
	expect.assertions(1);
	return tubemail({
		key: Buffer.alloc(0),
		cert: Buffer.alloc(0),
		discovery: () => {}
	}).catch((e) => {
		expect(e).toHaveProperty('message', 'ca is missing');
	});
});

test('complain about ca not being a Buffer', () => {
	expect.assertions(1);
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
	expect.assertions(1);
	return tubemail({
		ca: Buffer.alloc(0),
		key: Buffer.alloc(0),
		cert: Buffer.alloc(0)
	}).catch((e) => {
		expect(e).toHaveProperty('message', 'discovery is missing');
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
	const discovery = jest.fn();
	return tubemail({
		ca: Buffer.alloc(0),
		key: Buffer.alloc(0),
		cert: Buffer.alloc(0),
		discovery
	}).then(() => {
		const host = 'peni$';
		const port = 69;
		discovery.mock.calls[0][2]({ host, port });
		expect(neigh.outbound.mock.calls[0][0]).toMatchObject({
			host,
			port
		});
	});
});

test('call factory for incoming connections', () => {
	return tubemail({
		ca: Buffer.alloc(0),
		key: Buffer.alloc(0),
		cert: Buffer.alloc(0),
		discovery: () => {}
	}).then(() => {
		const socket = {};
		tls.__server.emit('secureConnection', socket);
		expect(neigh.inbound.mock.calls[0][0]).toBe(socket);
	});
});
