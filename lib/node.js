'use strict';

const events = require( 'events' );
const utils = require( './utils.js' );

function newNode( socket, localID ) { return new Promise( ( resolve, reject ) => {

	let node = new Node( socket, localID );

	node.once( 'identified', () => resolve( node ) );
	node.once( 'thatisus', () => reject( new Error("That's us") ) );

} ); }

class Node extends events.EventEmitter {

	constructor( socket, localID ) {

		super();

		// Store socket handle
		this._socket = socket;

		// Store local ID
		this._localID = localID;

		// Create stores
		this._remoteID = null;

		// Install data listener
		let recvBuffer = '';
		socket.on( 'data', ( chunk ) => {

			// Add chunk to recv buffer
			recvBuffer += chunk.toString();

			// If message delimiter is present -> process
			let delimiterPos;
			while( ( delimiterPos = recvBuffer.indexOf( '\n' ) ) != -1 ) {
				this._processDatagram( recvBuffer.slice( 0, delimiterPos ) );
				recvBuffer = recvBuffer.slice( delimiterPos + 1 );
			}

		} );

		// Install error listener
		socket.on( 'error', ( e ) => this.emit( 'error', e ) );

		// Install close listener
		socket.on( 'close', () => this.emit( 'close' ) );

		// Transmit local id to remote node
		socket.write( `l${localID}\n` );

	}

	_processDatagram( datagram ) {

		switch( datagram[0] ) {
			case 'l':
				// If the remote node already told us their ID, throw an error
				if( this.id !== null ) return this.emit(
					'remoteError',
					new Error( `Double identification` )
				);

				// TODO: Valid ID?

				// Otherwise store ID
				this._remoteID = datagram.slice( 1 );

				// Maybe that is us on the other side
				if( this._remoteID == this._localID ) {

					// Close the connection
					this.shutdown();
					this.emit( 'thatisus' );

				} else {

					// Emit event
					this.emit( 'identified' );

				}

				break;

			case 'c':
				// TODO: Valid ID?

				// Emit new neighbor event
				this.emit( 'newNeigh', datagram.slice(1) );

				break;

			case 'd':
				try {
					// Interprete datagram and emit data event
					this.emit( 'data', utils.unserialise( datagram.slice(1) ) );
				} catch( e ) {
					// Emit an error if this fails
					this.emit(
						'remoteError',
						new Error( `Invalid JSON in datagram: ${e.message}` )
					);
				}

				break;

			default:
				// Throw error
				return this.emit(
					'remoteError',
					new Error( `Unknown datagram format` )
				);
		}

	}

	get id() { return this._remoteID; }

	newNeigh( id ) {
		// Tell node about new neighbors
		this._socket.write( `c${id}\n` );
	}

	send( obj ) {
		// Serialise data and send to remote node
		let json = utils.serialise( obj );
		this._socket.write( `d${json}\n` );
	}

	shutdown() {

		// Close the connection
		this._socket.destroy();

	}

}

module.exports = { newNode };
