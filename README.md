# Mail Tube Network

Once connected, you get a fully meshed network. TLS-secured of course.


## Concept

 - Discovered new neighbour
   - Connect
   - Receive remote ID
   - Remote ID already connected?
     - Disconnect
   - Remote ID > Local ID
     - Disconnect
   - Send local ID
   - Create handle for remote Host
   - Raise event: new neighbour

 - Incoming connection
   - Send local ID
   - Connection closed?
     - Abort
   - Receive remote ID
   - Create handle for remote neighbour
   - Raise event: new neighbour

```js
function Discovery(myPort, needle, onHostFound) {
	...
	return stopFunction;
}

Tubemail.join({
	key: <Buffer>,
	cert: <Buffer>,
	ca: <Buffer>,
	port: 1234,
	discovery: Discovery // Can also be an array of different discovery helper
}).then((realm) => {...});

realm.on('foundNeigh', (neigh) => {});
realm.on('lostNeigh', (neigh) => {});
realm.on('message', (message, neigh) => {});
realm.send(message); // Broadcast
realm.leave();

neigh.on('message', (message, neigh) => {});
neigh.send(message);
```
