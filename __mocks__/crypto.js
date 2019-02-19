module.exports.__randomBytes = jest.fn((size) => Buffer.alloc(size, 'a'));
module.exports.randomBytes = jest.fn((size, cb) => cb(null, module.exports.__randomBytes(size)));
module.exports.__createHash = {
	update: jest.fn(),
	digest: jest.fn()
};
module.exports.createHash = jest.fn(() => module.exports.__createHash);
