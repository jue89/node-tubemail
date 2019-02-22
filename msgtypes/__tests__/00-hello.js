const hello = require('../00-hello.js');

test('msg attributes', () => {
	expect(hello.field).toBeInstanceOf(Buffer);
	expect(hello.field.toString('hex')).toEqual('00');
	expect(hello.name).toEqual('hello');
});

test('pack message', () => {
	const pkt = hello.pack();
	expect(pkt.toString('hex')).toEqual(Buffer.from('🍾').toString('hex'));
});

test('unpack message', () => {
	hello.unpack(Buffer.from('🍾'));
});

test('complain about wrong magic', () => {
	try {
		hello.unpack(Buffer.from('💩'));
		throw new Error('Failed');
	} catch (err) {
		expect(err.message).toEqual('Wrong magic');
	}
});
