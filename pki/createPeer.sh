#!/bin/bash

err() {
	echo $1
	exit
}

[ $# -le 1 ] && err "Usage: createPeer [hood] [name]"

# Prepare some vars
[ ! -e config.sh ] && err "The config is missing! Please create \"config.sh\""
. $(pwd)/config.sh
[ -z $COUNTRY ] && err "Variable COUNTRY is not set in config.sh"
[ -z $STATE ] && err "Variable STATE is not set in config.sh"
[ -z $LOCALITY ] && err "Variable LOCALITY is not set in config.sh"
HOOD=$1
PEER=$2

# Check if hood stuff is present
[ ! -e $HOOD.crt ] && err "Hood certificate is missing"
[ ! -e $HOOD.key ] && err "Hood key is missing"
[ -e $HOOD.$PEER.key -o -e $HOOD.$PEER.key ] && err "Peer is already existing"

# Create key, csr and finally sign the csr
openssl genrsa -out $HOOD.$PEER.key 4096 || exit
openssl req -new -key $HOOD.$PEER.key -out $HOOD.$PEER.csr  -subj "/C=$COUNTRY/ST=$STATE/L=$LOCALITY/O=$HOOD/OU=Peer/CN=$PEER" || exit
openssl x509 -req -days 1095 -in $HOOD.$PEER.csr -CA $HOOD.crt -CAkey $HOOD.key -out $HOOD.$PEER.crt -set_serial $(date +%s) || exit
rm $HOOD.$PEER.csr
