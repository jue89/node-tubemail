module.exports.__randomBytes = jest.fn((size) => Buffer.alloc(size, 'a'));
module.exports.randomBytes = (size, cb) => cb(null, module.exports.__randomBytes(size));
