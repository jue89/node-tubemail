const EventEmitter = require('events');
const util = require('util');

function Stream2Block (socket) {
	EventEmitter.call(this);

	this.socket = socket;

	let chunks = [];
	let chunksLength = 0;
	let length = -1;
	const squashChunks = () => { if (chunks.length > 1) chunks = [ Buffer.concat(chunks) ]; };
	this.socket.on('data', (chunk) => {
		chunks.push(chunk);
		chunksLength += chunk.length;

		// Try to convert stream data into blocks
		while (true) {
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
	});
}

util.inherits(Stream2Block, EventEmitter);

Stream2Block.prototype.send = function (block, done) {
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

	this.socket.write(Buffer.concat(payload), done);
};

module.exports = Stream2Block;
