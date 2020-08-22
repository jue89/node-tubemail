module.exports = jest.fn(function () {
	this.add = jest.fn();
	this.remove = jest.fn();
	this.removeAll = jest.fn();
});
