jest.mock('tls');
const tls = require('tls');

const neigh = require('../neigh.js');

test('connect to discovered host', () => {
	const local = {
		id: Buffer.alloc(64, 'z'),
		ca: Buffer.alloc(0),
		key: Buffer.alloc(0),
		cert: Buffer.alloc(0)
	};
	const remote = {
		host: 'peni$',
		port: 69
	};
	neigh.outbound(local, remote);
	expect(tls.connect.mock.calls[0][0]).toMatchObject({
		ca: [local.ca],
		key: local.key,
		cert: local.cert,
		host: remote.host,
		port: remote.port
	});
});

test('destroy connection if connection is not authorised', () => {
	expect.assertions(1);
	tls.__onConnect.mockImplementationOnce(() => 'Nope');
	return neigh.outbound({}, {}).catch((e) => {
		expect(tls.__socket.destroy.mock.calls.length).toEqual(1);
	});
});

test('destroy connection if too short welcome message has been sent', () => {
	expect.assertions(2);
	tls.__onConnect.mockImplementationOnce(() => Buffer.alloc(64 + 3, 'X'));
	return neigh.outbound({}, {}).catch((e) => {
		expect(e.message).toEqual('Incomplete welcome message');
		expect(tls.__socket.destroy.mock.calls.length).toEqual(1);
	});
});

test('destroy connection if no magic emoji has been sent', () => {
	expect.assertions(2);
	tls.__onConnect.mockImplementationOnce(() => Buffer.alloc(64 + 4, 'X'));
	return neigh.outbound({}, {}).catch((e) => {
		expect(e.message).toEqual('Magic missing');
		expect(tls.__socket.destroy.mock.calls.length).toEqual(1);
	});
});

test('destroy connection if remote id is higher than ours', () => {
	expect.assertions(2);
	tls.__onConnect.mockImplementationOnce(() => Buffer.concat([
		Buffer.from('🛰'),
		Buffer.alloc(64, 'b')
	]));
	return neigh.outbound({ id: Buffer.alloc(64, 'a') }, {}).catch((e) => {
		expect(e.message).toEqual('Remote ID higher than ours');
		expect(tls.__socket.destroy.mock.calls.length).toEqual(1);
	});
});

test('destroy connection if remote id is equal', () => {
	expect.assertions(2);
	tls.__onConnect.mockImplementationOnce(() => Buffer.concat([
		Buffer.from('🛰'),
		Buffer.alloc(64, 'a')
	]));
	return neigh.outbound({ id: Buffer.alloc(64, 'a') }, {}).catch((e) => {
		expect(e.message).toEqual('We connected ourselfes');
		expect(tls.__socket.destroy.mock.calls.length).toEqual(1);
	});
});
