function MockFSM (opts) {
	this.states = {};
	this.inputs = opts.inputs;
	this.outputs = opts.outputs;
}

MockFSM.prototype.state = function (name, handler) {
	this.states[name] = handler;
	return this;
};

MockFSM.prototype.final = function (handler) {
	this.states._final = handler;
	return this;
};

MockFSM.prototype.testState = function (state, err) {
	this.next = jest.fn();
	this.next.timeout = jest.fn();
	const i = (name, handler) => this.inputs.main.on(name, handler);
	Object.keys(this.inputs).forEach((key) => {
		i[key] = (name, handler) => this.inputs[key].on(name, handler);
	});
	const o = (name, arg1, arg2) => this.outputs.main.emit(name, arg1, arg2);
	Object.keys(this.outputs).forEach((key) => {
		o[key] = (name, arg1, arg2) => this.outputs[key].emit(name, arg1, arg2);
	});
	this.states[state](this.ctx, i, o, this.next, err);
	return this;
};

MockFSM.prototype.run = function (ctx) {
	this.ctx = ctx;
	return this;
};

module.exports = (opts) => new MockFSM(opts);
