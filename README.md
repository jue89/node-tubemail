# Tube Mail Network

Once connected, you get a fully meshed network to throw around some Buffers. TLS-secured of course. The - I think - coolest feature is that peers will find each other automagically. Without any central instance. Without an IP address list of the other peers. Just kick off a new peer and it will become a member of the mesh.

*Hot and fresh in Version 2.0.0:* Even more robust discovery of other peers! Peers now exchange their lists of connected neighbours. This eliminate the need for a discovery service that finds all other peers. No problems, if it misses some one ...


## Example

Install *tubemail* and *tubemail-mdns*. You will need the *avahi dnssd dev package* for the latter. It is named *libavahi-compat-libdnssd-dev* on Debian-flavoured systems.

```sh
apt install libavahi-compat-libdnssd-dev
npm install -g tubemail tubemail-mdns
```

Create some certificates and keys:

```sh
mkdir example
cd example
cat > config.sh <<EOF
COUNTRY="VA"
STATE="Fairyland"
LOCALITY="Rainbow"
EOF
createHood hood
createPeer hood peer1
createPeer hood peer2
```

Create scripts for the peers in the same directory:

```js
// peer1.js
const fs = require('fs');
const tubemail = require('tubemail');
const mdnsDiscovery = require('tubemail-mdns');

const toBuffer = (obj) => Buffer.from(obj.toString());

tubemail.join({
	key: fs.readFileSync('./hood.peer1.key'),
	cert: fs.readFileSync('./hood.peer1.crt'),
	ca: fs.readFileSync('./hood.crt'),
	discovery: mdnsDiscovery()
}).then((hood) => {
	// Send the current time every second
	setInterval(() => hood.send(toBuffer(new Date())), 1000);

	// Say hello to new neighs
	hood.on('foundNeigh', (n) => n.send(toBuffer(`Hello ${n.info.subject.commonName}!`)));
});
```

```js
// peer2.js
const fs = require('fs');
const tubemail = require('tubemail');
const mdnsDiscovery = require('tubemail-mdns');

const toBuffer = (obj) => Buffer.from(obj.toString());

tubemail.join({
	key: fs.readFileSync('./hood.peer2.key'),
	cert: fs.readFileSync('./hood.peer2.crt'),
	ca: fs.readFileSync('./hood.crt'),
	discovery: mdnsDiscovery()
}).then((hood) => {
	hood.on('message', (msg) => console.log(msg.toString()));
});
```

Start the scripts. It doesn't matter if they are started on the same machine or on a different machine on the same network! :)


## API

```js
const tubemail = require('tubemail');
tubemail.join(opts).then((hood) => {...});
```

Joins / create a new hood. ```opts``` is an object:
 * `ca`: Hood's certificate. Required.
 * `key`: Peer's private key. Required.
 * `cert`: Peer's certificate. Required.
 * `port`: The port to listen on. Default: `{from: 4816, to: 4819}`. It can be of type:
   * `Number`: Listen on the specified port.
   * `Array`: A list of ports. *Tube Mail* will select a free one.
   * `Object`: A port range. First port is specified by item `from`, last one by item `to`.
 * `discovery`: A discovery service or an `Array` of discovery services. The service can been a `Function` or an `Object`. If the service is an `Object`, it must contain the items `host` and `port` pointing to another instance of *Tube Mail*. If the discovery service is a `Function`, it is a factory. The factory's interface: `(port, fingerprint, newPeer) => stopDiscovery`:
   * `port`: The actual port this peer is listening on.
   * `fingerprint`: The hood's fingerprint for finding other peers. All peers using the same hood certificate will receive the same fingerprint to search for.
   * `newPeer`: A callback function that shall be called if discovery discovered a new peer. It awaits one object with the items `host` and `port`. I think you know what to fill in ;)
   * `stopDiscovery`: Will be called by *Tube Mail* if discovery shall be stopped. If can be a `Promise`, that is fulfilled once the service fully shut down.

You do not have to implement the discovery by yourself if you don't want to. Check out:
 * [tubemail-mdns](https://github.com/jue89/node-tubemail-mdns): Discovers other peers on the local network using mDNS / DNS-SD.
 * [tubemail-dht](https://github.com/jue89/node-tubemail-dht): (Ab)uses the Bittorrent DHT for discovering peers on the internet. TBH: This feels a little bit magical :) Don't forget to forward the ports if you are forced to have your peer behind some *evil* NAT.

Resolved ```hood``` is an instance of Hood.

### Class: Hood

#### Property: port

The actual port *Tube Mail* is listening on for incoming connections. This is quite handy if you specified several ports.

#### Property: fingerprint

The hood's fingerprint that is used to identify other peers belonging to the same hood.

#### Property: info

All information hold by the local peer's certificate. This is useful for obtaining the local common name: `hood.info.subject.commonName`.

#### Property: id

The local ID. It will be generated on startup and is random.

#### Event: foundNeigh

```js
hood.on('foundNeigh', (neigh) => {...});
```

Will be emitted if a new connection as been successfully established to `neigh`.

#### Event: lostNeigh

```js
hood.on('lostNeigh', (neigh) => {...});
```

Will be emitted if `neigh` disappeared.

#### Event: message

```js
hood.on('message', (message, neigh) => {...});
```

Will be fired if a message has been received form `neigh`. `message` is always a *Buffer*.

#### Event: goodbye

```js
hood.on('goodbye', () => {...});
```

Once we have left the hood (i.e. stopped discovery, disconnected from all neighbours and closed the port), the goodbye event will be fired.


#### Method: send

```js
hood.send(message);
```

Broadcast `message` to all connected neighbours. `message` must be a *Buffer*.

#### Method: leave

```js
hood.leave().then(() => {...});
```

Shutdown *Tube Mail*. Will resolve once the listening socket and connections have been closed.

### Class: Neighbour

#### Property: host

The remote IP address of our neighbour.

#### Property: port

The remote port.

#### Property: info

Information contained by the remote peer's certificate. This is handy for identifying the neighbour by reading `neigh.info.subject.commonName`.

#### Property: id

The remote ID. This one is (or: should be) random.

#### Event: message

```js
neigh.on('message', (message) => {...});
```

Will be fired if a message has been received form `neigh`. `message`is always a *Buffer*.

#### Event: goodbye

```js
neigh.on('goodbye', () => {...});
```

*Tube Mail* neighbours are kind neighbours. They always say goodbye if they are leaving.

#### Method: send

```js
neigh.send(message);
```

Send `message` to `neigh`. `message` must be a *Buffer*.

## Debugging

If you are experiencing unexpected behaviour and wonder why other peers aren't connecting, you can make *Tube Mail* more verbose and report changes of the internal state machine by setting this environment variable:

`export NODE_DEBUG=tubemail-hood,tubemail-connection,tubemail-neigh`
