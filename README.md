# Tube Mail Network

Once connected, you get a fully meshed network to throw around some Buffers. TLS-secured of course. The - I think - coolest feature is that peers will find each other automagically. Without any central instance. Without an IP address list of the other peers. Just kick off a new peer and it will become a member of the mesh. *It just works. (And if it doesn't, please write an Issue.)*


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
createRealm realm
createPeer realm peer1
createPeer realm peer2
```

Create scripts for the peers in the same directory:

```js
// peer1.js
const fs = require('fs');
const tubemail = require('tubemail');
const mdnsDiscovery = require('tubemail-mdns');

const toBuffer = (obj) => Buffer.from(obj.toString());

tubemail.join({
	key: fs.readFileSync('./realm.peer1.key'),
	cert: fs.readFileSync('./realm.peer1.crt'),
	ca: fs.readFileSync('./realm.crt'),
	discovery: mdnsDiscovery()
}).then((realm) => {
	// Send the current time every second
	setInterval(() => realm.send(toBuffer(new Date())), 1000);

	// Say hello to new neighs
	realm.on('foundNeigh', (n) => n.send(toBuffer(`Hello ${n.info.subject.commonName}!`)));
});
```

```js
// peer2.js
const fs = require('fs');
const tubemail = require('tubemail');
const mdnsDiscovery = require('tubemail-mdns');

const toBuffer = (obj) => Buffer.from(obj.toString());

tubemail.join({
	key: fs.readFileSync('./realm.peer2.key'),
	cert: fs.readFileSync('./realm.peer2.crt'),
	ca: fs.readFileSync('./realm.crt'),
	discovery: mdnsDiscovery()
}).then((realm) => {
	realm.on('message', (msg) => console.log(msg.toString()));
});
```

Start the scripts. It doesn't matter if they are started on the same machine or on a different machine on the same network! :)


## API

```js
const tubemail = require('tubemail');
tubemail.join(opts).then((realm) => {...});
```

Joins / create a new realm. ```opts``` is an object:
 * ```ca```: Realm's certificate. Required.
 * ```key```: Peer's private key. Required.
 * ```cert```: Peer's certificate. Required.
 * ```port```: The port to listen on. Default: ```{from: 4816, to: 4819}```. It can be of type:
   * ```Number```: Listen on the specified port.
   * ```Array```: A list of ports. *Tube Mail* will select a free one.
   * ```Object```: A port range. First port is specified by item ```from```, last one by item ```to```.
 * ```discovery```: Factory for discovery. Required. The factory's interface: ```(port, fingerPrint, newPeer) => stopDiscovery```:
   * ```port```: The actual port this peer is listening on.
   * ```fingerPrint```: The realm's finger print for finding other peers. All peers using the same realm certificate will receive the same finger print to search for.
   * ```newPeer```: A callback function that shall be called if discovery discovered a new peer. It awaits one object with the items ```host``` and ```port```. I think you know what to fill in ;)
   * ```stopDiscovery```: Will be called by *Tube Mail* if discovery shall be stopped.

You do not have to implement the discovery by yourself if you don't want to. Check out:
 * [tubemail-mdns](https://github.com/jue89/node-tubemail-mdns): Discovers other peers on the local network using mDNS / DNS-SD.
 * [tubemail-dht](https://github.com/jue89/node-tubemail-dht): (Ab)uses the Bittorrent DHT for discovering peers on the internet. TBH: This feels a little bit magical :) Don't forget to forward the ports if you are forced to have your peer behind some *evil* NAT.

Resolved ```realm``` is an instance of Realm.

### Class: Realm

#### Property: port

The actual port *Tube Mail* is listening on for incoming connections. This is quite handy if you specified several ports.

#### Property: fingerPrint

The realm's finger print that is used to identify other peers belonging to the same realm.

#### Property: info

All information hold by the local peer's certificate. This is useful for obtaining the local common name: ```realm.info.subject.commonName```.

#### Property: id

The local ID. It will be generated on startup and is random.

#### Event: foundNeigh

```js
realm.on('foundNeigh', (neigh) => {...});
```

Will be emitted if a new connection as been successfully established to ```neigh```.

#### Event: lostNeigh

```js
realm.on('lostNeigh', (neigh) => {...});
```

Will be emitted if ```neigh``` disappeared.

#### Event: message

```js
realm.on('message', (message, neigh) => {...});
```

Will be fired if a message has been received form ```neigh```. ```message```is always a *Buffer*.

#### Event: goodbye

```js
realm.on('goodbye', () => {...});
```

Once we have left the realm (i.e. stopped discovery, disconnected from all neighbours and closed the port), the goodbye event will be fired.


#### Method: send

```js
realm.send(message);
```

Broadcast ```message``` to all connected neighbours. ```meassge``` must be a *Buffer*.

#### Method: leave

```js
realm.leave();
```

Shutdown *Tube Mail*.

### Class: Neighbour

#### Property: host

The remote IP address of our neighbour.

#### Property: port

The remote port.

#### Property: info

Information contained by the remote peer's certificate. This is handy for identifying the neighbour by reading ```neigh.info.subject.commonName```.

#### Property: id

The remote ID. This one is (or: should be) random.

#### Event: message

```js
neigh.on('message', (message) => {...});
```

Will be fired if a message has been received form ```neigh```. ```message```is always a *Buffer*.

#### Event: goodbye

```js
neigh.on('goodbye', () => {...});
```

*Tube Mail* neighbours are kind neighbours. They always say goodbye if they are leaving.

#### Method: send

```js
neigh.send(message);
```

Send ```message``` to ```neigh```. ```meassge``` must be a *Buffer*.
