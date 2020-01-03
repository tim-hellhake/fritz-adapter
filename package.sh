#!/bin/bash

rm -rf node_modules
npm install --production
rm -rf node_modules/.bin

sha256sum package.json manifest.json lib/*.js LICENSE README.md > SHA256SUMS
find node_modules -type f -exec sha256sum {} \; >> SHA256SUMS

TARFILE=`npm pack`
tar xzf ${TARFILE}
cp -r node_modules ./package
tar czf ${TARFILE} package

sha256sum ${TARFILE} > ${TARFILE}.sha256sum

rm SHA256SUMS
rm -rf package
