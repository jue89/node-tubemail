#!/bin/bash


err() {
	echo $1
	exit
}

[ $# -le 1 ] && err "Usage: createPeer [realm] [name]"

# Prepare some vars
. config.sh
REALM=$1
PEER=$2

# Check if realm stuff is present


[ ! -e $REALM.crt ] && err "Realm certificate is missing"
[ ! -e $REALM.key ] && err "Realm key is missing"
[ -e $REALM.$PEER.key -o -e $REALM.$PEER.key ] && err "Peer is already existing"

# Create key, csr and finally sign the csr
openssl genrsa -out $REALM.$PEER.key 4096 || exit
openssl req -new -key $REALM.$PEER.key -out $REALM.$PEER.csr  -subj "/C=$COUNTRY/ST=$STATE/L=$LOCALITY/O=$REALM/OU=Peer/CN=$PEER" || exit
openssl x509 -req -days 1095 -in $REALM.$PEER.csr -CA $REALM.crt -CAkey $REALM.key -out $REALM.$PEER.crt -set_serial $(date +%s) || exit
rm $REALM.$PEER.csr
