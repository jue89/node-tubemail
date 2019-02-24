#!/bin/bash

err() {
	echo $1
	exit
}

[ $# -eq 0 ] && err "Usage: createHood [name]"

# Prepare some vars
[ ! -e config.sh ] && err "The config is missing! Please create \"config.sh\""
. $(pwd)/config.sh
[ -z $COUNTRY ] && err "Variable COUNTRY is not set in config.sh"
[ -z $STATE ] && err "Variable STATE is not set in config.sh"
[ -z $LOCALITY ] && err "Variable LOCALITY is not set in config.sh"
HOOD=$1

[ -e $HOOD.key -o -e $HOOD.key ] && err "Hood is already existing"

openssl req -new -newkey rsa:4096 -x509 -keyout $HOOD.key -out $HOOD.crt -days 3650 -subj "/C=$COUNTRY/ST=$STATE/L=$LOCALITY/O=$HOOD/OU=God/CN=$HOOD"
