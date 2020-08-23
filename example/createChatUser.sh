#!/bin/bash

NAME=$1

../pki/createPeer.sh hood $NAME
ln -s peer.js $NAME
