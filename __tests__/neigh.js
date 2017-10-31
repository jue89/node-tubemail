jest.mock('tls');
const tls = require('tls');

const neigh = require('../neigh.js');

test('connect to discovered host', (done) => {
	const local = {
		id: Buffer.alloc(64, 'z'),
		ca: Buffer.alloc(0),
		key: Buffer.alloc(0),
		cert: Buffer.alloc(0),
		knownIDs: []
	};
	const remote = {
		host: 'peni$',
		port: 69
	};
	neigh.outbound(local, remote).on('state', (data, newState, oldState) => {
		if (oldState !== 'connect') return;
		try {
			expect(tls.connect.mock.calls[0][0]).toMatchObject({
				ca: [local.ca],
				key: local.key,
				cert: local.cert,
				host: remote.host,
				port: remote.port
			});
			done();
		} catch (e) { done(e); }
	}).on('destroy', (e) => done(e));
});

test('destroy connection if connection is not authorised', (done) => {
	tls.__onConnect.mockImplementationOnce(() => 'Nope');
	neigh.outbound({}, {}).on('destroy', (data, reason, state) => {
		try {
			expect(state).toEqual('connect');
			expect(reason.message).toEqual('Nope');
			expect(tls.__socket.destroy.mock.calls.length).toEqual(1);
			done();
		} catch (e) { done(e); }
	});
});

test('destroy connection if too short welcome message has been sent', (done) => {
	tls.__onConnect.mockImplementationOnce(() => Buffer.alloc(64 + 3, 'X'));
	neigh.outbound({}, {}).on('destroy', (data, reason, state) => {
		try {
			expect(state).toEqual('receiveRemoteID');
			expect(reason.message).toEqual('Incomplete welcome message');
			expect(tls.__socket.destroy.mock.calls.length).toEqual(1);
			done();
		} catch (e) { done(e); }
	});
});

test('destroy connection if no magic emoji has been sent', (done) => {
	tls.__onConnect.mockImplementationOnce(() => Buffer.alloc(64 + 4, 'X'));
	neigh.outbound({}, {}).on('destroy', (data, reason, state) => {
		try {
			expect(state).toEqual('receiveRemoteID');
			expect(reason.message).toEqual('Magic missing');
			expect(tls.__socket.destroy.mock.calls.length).toEqual(1);
			done();
		} catch (e) { done(e); }
	});
});

test('destroy connection if remote id is higher than ours', (done) => {
	tls.__onConnect.mockImplementationOnce(() => Buffer.concat([
		Buffer.from('🛰'),
		Buffer.alloc(64, 'b')
	]));
	neigh.outbound({ id: Buffer.alloc(64, 'a') }, {}).on('destroy', (data, reason, state) => {
		try {
			expect(state).toEqual('receiveRemoteID');
			expect(reason.message).toEqual('Remote ID higher than ours');
			expect(tls.__socket.destroy.mock.calls.length).toEqual(1);
			done();
		} catch (e) { done(e); }
	});
});

test('destroy connection if remote id is equal', (done) => {
	tls.__onConnect.mockImplementationOnce(() => Buffer.concat([
		Buffer.from('🛰'),
		Buffer.alloc(64, 'a')
	]));
	neigh.outbound({ id: Buffer.alloc(64, 'a') }, {}).on('destroy', (data, reason, state) => {
		try {
			expect(state).toEqual('receiveRemoteID');
			expect(reason.message).toEqual('We connected ourselfes');
			expect(tls.__socket.destroy.mock.calls.length).toEqual(1);
			done();
		} catch (e) { done(e); }
	});
});

test('destroy connection if remote id is known', (done) => {
	const id = Buffer.alloc(64, 'a');
	tls.__onConnect.mockImplementationOnce(() => Buffer.concat([ Buffer.from('🛰'), id ]));
	neigh.outbound({
		id: Buffer.alloc(64, 'x'),
		knownIDs: [ id.toString('hex') ]
	}, {}).on('destroy', (data, reason, state) => {
		try {
			expect(state).toEqual('receiveRemoteID');
			expect(reason.message).toEqual('Remote ID is already connected');
			expect(tls.__socket.destroy.mock.calls.length).toEqual(1);
			done();
		} catch (e) { done(e); }
	});
});

test('send local ID if we wan\'t to say hi to outbound neigh', (done) => {
	const EMJ = Buffer.from('🛰');
	const localID = Buffer.alloc(64, 'z');
	const localWelcome = Buffer.concat([ EMJ, localID ]);
	const remoteID = Buffer.alloc(64, 'a');
	const remoteWelcome = Buffer.concat([ EMJ, remoteID ]);
	tls.__onConnect.mockImplementationOnce(() => remoteWelcome);
	const local = {
		id: localID,
		ca: Buffer.alloc(0),
		key: Buffer.alloc(0),
		cert: Buffer.alloc(0),
		knownIDs: [],
		neigh: {}
	};
	const remote = {
		host: 'peni$',
		port: 69
	};
	neigh.outbound(local, remote).on('state:connected', (data, oldState) => {
		try {
			expect(tls.__socket.write.mock.calls[0][0].toString('hex')).toEqual(localWelcome.toString('hex'));
			done();
		} catch (e) { done(e); }
	}).on('destroy', (e) => done(e));
});
