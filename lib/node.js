'use strict';

const events = require( 'events' );
const utils = require( './utils.js' );

function newNode( socket, localID, listen ) { return new Promise( ( resolve, reject ) => {

	// Timeout and keepalive
	socket.setKeepAlive( true, 10000 );
	socket.setTimeout( 20000, () => socket.destroy() );

	let node = new Node( socket, localID, listen );

	node.once( 'identified', () => resolve( node ) );
	node.once( 'thatisus', () => reject( new Error("That's us") ) );

} ); }

class Node extends events.EventEmitter {

	constructor( socket, localID, listen ) {

		super();

		// Store socket handle
		this._socket = socket;

		// Store local ID
		this._localID = localID;

		// Create exposed ip and port
		this._localListen = {
			host: listen.host,
			port: listen.port
		};

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
		socket.on( 'close', () => {
			// If the remote ID is still set, we lost the remote node
			this.emit( ( this._remoteID === null ) ? 'shutdown' : 'lost' );
		} );

		// Transmit local id to remote node
		this._createDatagram( 'l', {
			id: this._localID,
			listen: this._localListen
		} );

	}

	_processDatagram( datagram ) {

		// Decode datagram
		try {

			// Extract data
			let data = utils.unserialise( datagram.slice(1) );

			// Extract type
			let type = datagram[0];

			// Call package decoder
			this._processPackage( type, data );

		} catch( e ) {

			// Emit an error if this fails
			this.emit(
				'remoteError',
				new Error( `Invalid JSON in datagram: ${e.message}` )
			);

		}

	}

	_createDatagram( type, data ) {

		// Serialise data and send to remote node
		let json = utils.serialise( data );
		this._socket.write( `${type}${json}\n` );

	}

	_processPackage( type, data ) {
console.log( type, data );
		switch( type ) {
			case 'l':
				// If the remote node already told us their ID, throw an error
				if( this.id !== null ) return this.emit(
					'remoteError',
					new Error( `Double identification` )
				);

				// TODO: Valid ID?

				// Otherwise store ID and connection address
				this._remoteID = data.id;
				this._remoteListen = data.listen;

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
				this.emit( 'newNeigh', data );

				break;

			case 's':
				// Remove remote ID -> Graceful shutdown
				this._remoteID = null;

				this.shutdown();

				break;

			case 'd':
				// Emit data event
				this.emit( 'data', data );

				break;

			default:
				// Throw error
				return this.emit(
					'remoteError',
					new Error( `Unknown datagram type: ${type}` )
				);

		}

	}

	get id() { return this._remoteID; }

	get listen() { return this._remoteListen; }

	newNeigh( neighInfo ) {

		// Tell node about new neighbors
		this._createDatagram( 'c', neighInfo );

	}

	send( obj ) {

		// Serialise data and send to remote node
		this._createDatagram( 'd', obj );

	}

	getCert() {

		// Get peer certificate if not already present
		if( ! this._cert ) {
			this._cert = this._socket.getPeerCertificate( true );
		}

		return this._cert;

	}

	shutdown() {

		// Send shutdown packet
		this._createDatagram( 's', true );

		// Close the connection
		this._socket.end();

	}

}

module.exports = { newNode };
