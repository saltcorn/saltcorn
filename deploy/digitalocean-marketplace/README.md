To build an image:

`fab build -H <IP ADDRESS>`

Then take a snapshot.

To test the built image, create a droplet with the saved snapshot. SSH in
and run (as root):

`/var/lib/cloud/scripts/per-instance/01-set-secret.sh`

When the image comes through the marketplace, this script will run
automatically.
