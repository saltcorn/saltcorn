to get URL of tarball:

npm view @saltcorn/cli dist.tarball

to update checksum

curl https://registry.npmjs.org/@saltcorn/cli/-/cli-0.5.2.tgz --output cli.tgz
/usr/local/bin/sha256sum cli.tgz
