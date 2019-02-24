const iam = require('../01-iam.js');

test('msg attributes', () => {
	expect(iam.field).toBeInstanceOf(Buffer);
	expect(iam.field.toString('hex')).toEqual('01');
	expect(iam.name).toEqual('iam');
});

test('pack message', () => {
	const obj = {
		id: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
		port: 12345
	};
	const pkt = iam.pack(obj);
	expect(pkt.toString()).toEqual(JSON.stringify(obj));
});

test('complain about wrong id format', () => {
	try {
		iam.pack({
			id: 'x123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
			port: 12345
		});
		throw new Error('Failed');
	} catch (err) {
		expect(err.message).toEqual('instance.id does not match pattern "^[0-9a-f]{128}$"');
	}
});

test('complain about wrong port format', () => {
	try {
		iam.pack({
			id: 'f123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
			port: 99999
		});
		throw new Error('Failed');
	} catch (err) {
		expect(err.message).toEqual('instance.port must have a maximum value of 65535');
	}
});

test('unpack message', () => {
	const obj = {
		id: 'f123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
		port: 4321
	};
	const unpacked = iam.unpack(Buffer.from(JSON.stringify(obj)));
	expect(unpacked).toMatchObject(obj);
});

test('complain about wrong message format', () => {
	try {
		const obj = {port: 4321};
		const unpacked = iam.unpack(Buffer.from(JSON.stringify(obj)));
		expect(unpacked).toMatchObject(obj);
		throw new Error('Failed');
	} catch (e) {
		expect(e.message).toEqual('instance requires property "id"');
	}
});
