#!/usr/bin/env bash

mkdir -p /tmp/scfiles/public
cd /tmp/scfiles/public
if ! test -f 1.webp; then
  wget https://www.gstatic.com/webp/gallery/1.webp
fi
setfattr --name=user.saltcorn.min_role_read --value="100" 1.webp 
mkdir -p /tmp/test
cd /tmp/test

docker run -it -v /tmp/scfiles:/db --name saltdocktest -e SQLITE_FILEPATH=/db/db.sqlite -e SALTCORN_SESSION_SECRET=s3cr3t saltcorn/saltcorn reset-schema -f
docker rm -f saltdocktest
docker run -it -v /tmp/scfiles:/db --name saltdocktest -e SQLITE_FILEPATH=/db/db.sqlite -e SALTCORN_SESSION_SECRET=s3cr3t saltcorn/saltcorn set-cfg log_level 6
docker rm -f saltdocktest

docker run -d -v /tmp/scfiles:/db --name saltdocktest -e SQLITE_FILEPATH=/db/db.sqlite -e SALTCORN_FILE_STORE=/db -p 3000:3000 saltcorn/saltcorn serve
#trap "docker rm -f saltdocktest" EXIT

sleep 8

wget -v -O /dev/null http://localhost:3000/files/serve/1.webp
sleep 5
echo "Logs:"
docker logs saltdocktest
docker rm -f saltdocktest
