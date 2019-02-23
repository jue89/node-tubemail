jest.mock('tls');
const mockTls = require('tls');

jest.mock('bloxycrats');
const mockBloxycrats = require('bloxycrats');

jest.mock('../x509.js');
const mockX509 = require('../x509.js');

const CM = require('../connectionManager.js');

test('start tls server', () => {
	const opts = {};
	const cm = new CM(opts);
	expect(cm).toBeInstanceOf(CM);
	expect(mockTls.createServer.mock.calls[0][0]).toBe(opts);
});

test('listen on port', () => {
	const cm = new CM();
	const port = 123;
	const q = cm.listen(port);
	expect(mockTls.__createServer.listen.mock.calls[0][0]).toBe(port);
	mockTls.__createServer.emit('listening');
	return q;
});

test('reject listen errors', () => {
	const cm = new CM();
	const q = cm.listen(1234);
	const error = new Error();
	mockTls.__createServer.emit('error', error);
	return q.then(() => Promise.reject(new Error('FAILED'))).catch((err) => {
		expect(err).toBe(error);
	});
});

test('raise connection event for inbound connections', () => {
	const cm = new CM();
	const onConnection = jest.fn();
	cm.on('connection', onConnection);
	const socket = mockTls._createSocket();
	socket.remoteAddress = 'abc';
	socket.remotePort = 123;
	const rawCert = Buffer.alloc(0);
	socket.getPeerCertificate.mockReturnValue({raw: rawCert});
	const pemCert = '';
	mockX509.raw2pem.mockReturnValue(pemCert);
	const objCert = {};
	mockX509.parseCert.mockReturnValue(objCert);
	mockTls.__createServer.emit('secureConnection', socket);
	expect(mockBloxycrats.mock.calls[0][0]).toBe(socket);
	expect(onConnection.mock.calls[0][0]).toBe(mockBloxycrats.mock.instances[0]);
	expect(mockBloxycrats.mock.instances[0].direction).toEqual('in');
	expect(mockX509.raw2pem.mock.calls[0][0]).toBe(rawCert);
	expect(mockX509.parseCert.mock.calls[0][0]).toBe(pemCert);
	expect(mockBloxycrats.mock.instances[0].info).toBe(objCert);
	expect(mockBloxycrats.mock.instances[0].host).toBe(socket.remoteAddress);
	expect(mockBloxycrats.mock.instances[0].port).toBe(socket.remotePort);
});

test('reject unauthorized connections', () => {
	const cm = new CM();
	const onConnection = jest.fn();
	cm.on('connection', onConnection);
	const socket = {authorized: false};
	mockTls.__createServer.emit('secureConnection', socket);
	expect(onConnection.mock.calls.length).toBe(0);
});

test('raise connection event for outbound connections', () => {
	const opts = {a: 1, b: 2};
	const cm = new CM(opts);
	const onConnection = jest.fn();
	cm.on('connection', onConnection);
	const peer = {c: 2};
	cm.connect(peer);
	expect(mockTls.connect.mock.calls[0][0]).toMatchObject({...opts, ...peer});
	mockTls.__connect.emit('secureConnect');
	expect(mockBloxycrats.mock.calls[0][0]).toBe(mockTls.__connect);
	expect(onConnection.mock.calls[0][0]).toBe(mockBloxycrats.mock.instances[0]);
	expect(mockBloxycrats.mock.instances[0].direction).toEqual('out');
});

test('call closed callback for terminated outbound connections', () => {
	const cm = new CM();
	const onClose = jest.fn();
	cm.connect({}, onClose);
	mockTls.__connect.emit('close');
	expect(onClose.mock.calls.length).toBe(1);
	mockTls.__connect.emit('error', new Error());
	expect(onClose.mock.calls.length).toBe(2);
});

test('close listen socket', () => {
	const cm = new CM();
	const q = cm.close();
	mockTls.__createServer.close.mock.calls[0][0]();
	return q;
});

test('return from close if listen socket isn\'t listening', () => {
	const cm = new CM();
	mockTls.__createServer.listening = false;
	return cm.close();
});

test('destroy all exisiting connections', () => {
	const cm = new CM();
	const s1 = mockTls._createSocket();
	mockTls.__createServer.emit('connection', s1);
	const s2 = mockTls._createSocket();
	mockTls.__createServer.emit('connection', s2);
	s1.destroyed = true;
	s1.emit('close');
	const s3 = mockTls._createSocket();
	mockTls.__createServer.emit('connection', s3);
	s2.destroyed = true;
	cm.connect();
	const s4 = mockTls.__connect;
	mockTls.__connect.emit('connect');
	cm.close();
	expect(s1.destroy.mock.calls.length).toBe(0);
	expect(s2.destroy.mock.calls.length).toBe(0);
	expect(s3.destroy.mock.calls.length).toBe(1);
	expect(s4.destroy.mock.calls.length).toBe(1);
});
