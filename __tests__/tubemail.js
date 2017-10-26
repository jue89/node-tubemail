jest.mock('tls');
const tls = require('tls');

const tubemail = require('../tubemail.js');

test('complain about missing key', () => {
	expect.assertions(1);
	tubemail({
		cert: Buffer.alloc(0),
		ca: Buffer.alloc(0),
		discovery: () => {}
	}).catch((e) => {
		expect(e).toHaveProperty('message', 'key is missing');
	});
});

test('complain about key not being a Buffer', () => {
	expect.assertions(1);
	tubemail({
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
	tubemail({
		key: Buffer.alloc(0),
		ca: Buffer.alloc(0),
		discovery: () => {}
	}).catch((e) => {
		expect(e).toHaveProperty('message', 'cert is missing');
	});
});

test('complain about cert not being a Buffer', () => {
	expect.assertions(1);
	tubemail({
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
	tubemail({
		key: Buffer.alloc(0),
		cert: Buffer.alloc(0),
		discovery: () => {}
	}).catch((e) => {
		expect(e).toHaveProperty('message', 'ca is missing');
	});
});

test('complain about ca not being a Buffer', () => {
	expect.assertions(1);
	tubemail({
		ca: true,
		key: Buffer.alloc(0),
		cert: Buffer.alloc(0),
		discovery: () => {}
	}).catch((e) => {
		expect(e).toHaveProperty('message', 'ca must be a buffer');
	});
});

test('complain about missing discovery', () => {
	const q = tubemail({
		ca: Buffer.alloc(0),
		key: Buffer.alloc(0),
		cert: Buffer.alloc(0)
	});
	expect.assertions(1);
	expect(q).rejects.toHaveProperty('message', 'discovery is missing');
});

test('create new server', () => {
	const ca = Buffer.alloc(0);
	const cert = Buffer.alloc(0);
	const key = Buffer.alloc(0);
	expect.assertions(1);
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
	expect.assertions(1);
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
	expect.assertions(1);
	return tubemail({
		ca: Buffer.alloc(0),
		key: Buffer.alloc(0),
		cert: Buffer.alloc(0),
		discovery: () => {}
	}).then(() => {
		expect(tls.__server.listen.mock.calls[0][0]).toEqual(4816);
	});
});
