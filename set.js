module.exports = {
	readonly: (obj, key, value) => Object.defineProperty(obj, key, {
		value: value,
		writable: false,
		enumerable: true,
		configurable: false
	}),
	hidden: (obj, key, value) => Object.defineProperty(obj, key, {
		value: value,
		writable: false,
		enumerable: false,
		configurable: false
	})
};
