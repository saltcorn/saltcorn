#!/usr/bin/env bash

set -e

docker run -it -v ~/tmp:/db -e SQLITE_FILEPATH=/db/db.sqlite -e SALTCORN_SESSION_SECRET=s3cr3t saltcorn/saltcorn reset-schema -f
mkdir /tmp/scfiles
docker run -d -v ~/tmp:/db -e SQLITE_FILEPATH=/db/db.sqlite -e SALTCORN_FILE_STORE=/db/scfiles -p 3000:3000 saltcorn/saltcorn serve
cd /tmp/scfiles
wget https://www.gstatic.com/webp/gallery/1.webp
setfattr --name=user.saltcorn.min_role_read --value="100" 1.webp 
mkdir ../test
cd ../test
wget http://localhost:3000/files/serve/1.webp
