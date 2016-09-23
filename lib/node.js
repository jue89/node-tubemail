'use strict';

const events = require( 'events' );

function newNode( socket, localID ) { return new Promise( ( resolve ) => {

	let node = new Node( socket, localID );

	node.once( 'identified', () => resolve( node ) );

} ); }

class Node extends events.EventEmitter {

	constructor( socket, localID ) {

		super();

		// Store socket handle
		this._socket = socket;

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
		// TODO

		// Install close listener
		// TODO

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

				// Emit event
				return this.emit( 'identified' );

			case 'c':
				// TODO: Valid ID?

				// Emit new neighbor event
				return this.emit( 'newNeigh', datagram.slice(1) );

			case 'd':
				// Emit data event
				// TODO: revive function. Valid JSON?
				return this.emit( 'data', JSON.parse( datagram.slice(1) ) );

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
		let json = JSON.stringify( obj );
		this._socket.write( `d${json}\n` );
	}

}

module.exports = { newNode };
