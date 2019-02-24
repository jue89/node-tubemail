module.exports = {
	field: Buffer.alloc(1, 3),
	name: 'data-buffer',
	pack: (payload) => {
		if (!(payload instanceof Buffer)) {
			throw new Error('payload is no instance of Buffer');
		}
		return payload;
	},
	unpack: (payload) => payload
};
