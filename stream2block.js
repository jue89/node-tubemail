const EventEmitter = require('events');
const util = require('util');

function Stream2Block (stream) {
	EventEmitter.call(this);

	this.stream = stream;

	// Internal chunk processor
	let chunks = [];
	let chunksLength = 0;
	let length = -1;
	const squashChunks = () => { if (chunks.length > 1) chunks = [ Buffer.concat(chunks) ]; };
	const processChunk = () => {
		// Try to convert stream data into blocks
		while (this.listenerCount('data')) {
			if (length === -1 && chunksLength >= 4) {
				// No length has been read, yet -> try to read it
				squashChunks();
				length = chunks[0].readUInt32BE(0);
			} else if (length !== -1 && chunksLength >= length + 4) {
				// Length is known -> Make sure we have enough bytes received
				squashChunks();
				this.emit('data', chunks[0].slice(4, length + 4));
				if (chunks[0].length > length + 4) {
					chunks[0] = chunks[0].slice(length + 4);
				} else {
					chunks = [];
				}
				chunksLength -= length + 4;
				length = -1;
			} else {
				// Nothing happend -> break the loop
				break;
			}
		}
	};

	// Listen to events
	const onData = (chunk) => {
		chunks.push(chunk);
		chunksLength += chunk.length;
		processChunk();
	};
	this.stream.on('data', onData);
	// We want to process stored data after (-> setImmediate) a new listener
	// has been added to the event emitter. This ensures that defered data is
	// emitted after the data event listener has been added.
	const onNewListener = () => {
		setImmediate(() => processChunk());
	};
	this.on('newListener', onNewListener);
	// Bypass all errors
	const onError = (err) => {
		this.emit('error', err);
	};
	this.stream.on('error', onError);
	this.stream.on('clientError', onError);
	this.stream.on('tlsClientError', onError);
	// Once the stream has been closed, we release the handle and remove our
	// event listeners. So if you want to destroy s2b, just close the stream.
	this.stream.on('close', () => {
		this.stream.removeListener('data', onData);
		this.stream.removeListener('newListener', onNewListener);
		this.stream.removeListener('error', onError);
		this.stream.removeListener('clientError', onError);
		this.stream.removeListener('tlsClientError', onError);
		delete this.stream;
		this.emit('close');
	});
}

util.inherits(Stream2Block, EventEmitter);

Stream2Block.prototype.send = function (block, done) {
	if (!this.stream) throw new Error('Stream has been closed');

	// Alloc buffer for length field
	const payload = [ Buffer.alloc(4) ];
	let length = 0;

	// Append block argument to payload based on its type
	if (block instanceof Array) {
		block.forEach((b) => {
			payload.push(b);
			length += b.length;
		});
	} else {
		payload.push(block);
		length = block.length;
	}

	// Write length field
	payload[0].writeUInt32BE(length, 0);

	this.stream.write(Buffer.concat(payload), done);
};

module.exports = Stream2Block;
