const MAGIC = Buffer.from('🍾');

module.exports = {
	field: Buffer.alloc(1, 0),
	name: 'hello',
	pack: () => MAGIC,
	unpack: (pkt) => {
		if (Buffer.compare(MAGIC, pkt) !== 0) {
			throw new Error('Wrong magic');
		}
	}
};
