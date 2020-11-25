#!/usr/bin/python
# -*- coding: utf-8 -*-

from fabric import task
import os

f = open('./packages.txt', 'r')
APT_PACKAGES = f.read()


def clean_up(cxn):
    """
    Clean up remote machine before taking snapshot.
    """
    cxn.run(r'rm -rf /tmp/* /var/tmp/*')
    cxn.run(r'history -c')
    cxn.run(r'cat /dev/null > /root/.bash_history')
    cxn.run(r'unset HISTFILE')
    cxn.run(r'apt-get -y autoremove')
    cxn.run(r'apt-get -y autoclean')
    cxn.run(r'find /var/log -mtime -1 -type f -exec truncate -s 0 {} \;')
    cxn.run(r'rm -rf /var/log/*.gz /var/log/*.[0-9] /var/log/*-????????')
    cxn.run(r'rm -rf /var/lib/cloud/instances/*')
    cxn.run(r'rm -rf /var/lib/cloud/instance')
    cxn.run(r': > /var/mail/$USER')
    cxn.run(r'echo "Removing keys..."')
    cxn.run(r'rm -f /root/.ssh/authorized_keys /etc/ssh/*key*')
    cxn.run(r'echo "Compressing image..."')
    cxn.run(r'dd if=/dev/zero of=/zerofile; sync; rm /zerofile; sync')
    cxn.run(r'cat /dev/null > /var/log/lastlog; cat /dev/null > /var/log/wtmp')


def install_files(cxn):
    """
    Install files onto remote machine.

    Walk through the files in the 'files' directory and copy them to the build
    system.

    File permissions will be inherited.  If you need to change permissions on
    uploaded files you can do so in a script placed in the 'scripts' directory.
    """

    print('--------------------------------------------------')
    print('Copying files in ./files to remote server')
    print('--------------------------------------------------')
    rootDir = './files'
    for dirName, subdirList, fileList in os.walk(rootDir):
        cDir = dirName.replace('./files', '')
        print("Entering Directory: %s" % cDir)
        if cDir:
            cxn.run("mkdir -p %s" % cDir)
        for fname in fileList:
            cwd = os.getcwd()
            rpath = cDir + '/' + fname
            lpath = cwd + '/files' + cDir + '/' + fname
            print('Moving File: %s' % lpath)
            cxn.put(lpath, rpath)


def install_pkgs(cxn):
    """
    Install apt packages listed in APT_PACKAGES
    """
    cxn.run(r'DEBIAN_FRONTEND=noninteractive')
    print('--------------------------------------------------')
    print('Installing apt packages in packages.txt')
    print('--------------------------------------------------')
    cxn.run(r'apt-get -qqy update')
    cxn.run(r'apt-get -qqy -o Dpkg::Options::="--force-confdef" '
            r'-o Dpkg::Options::="--force-confold" upgrade')
    cxn.run(r'apt-get -qqy -o Dpkg::Options::="--force-confdef" '
            r'-o Dpkg::Options::="--force-confold" install {}'
            .format(APT_PACKAGES))

    # example 3rd paty repo and install certbot
    # cxn.run('apt-get -qqy install software-properties-common')
    # cxn.run('add-apt-repository ppa:certbot/certbot -y')
    # cxn.run('apt-get -qqy update')
    # cxn.run('apt-get -qqy install python-certbot-apache')


def run_scripts(cxn):
    """
    Run all scripts in the 'scripts' directory on the build system
    Scripts are run in alpha-numeric order.  We recommend naming your scripts
    with a name that starts with a two digit number 01-99 to ensure run order.
    """
    print('--------------------------------------------------')
    print('Running scripts in ./scripts')
    print('--------------------------------------------------')

    cwd = os.getcwd()
    directory = cwd + '/scripts'

    for f in sorted(os.listdir(directory)):
        lfile = cwd + '/scripts/' + f
        rfile = '/tmp/' + f
        print("Processing script in %s" % lfile)
        cxn.put(lfile, rfile)
        cxn.run("chmod +x %s" % rfile)
        cxn.run(rfile)


@task
def build(cxn):
    """
    Configure the build droplet, clean up and shut down for snapshotting
    """
    install_pkgs(cxn)
    install_files(cxn)
    run_scripts(cxn)
    clean_up(cxn)
    cxn.run('exit')
    print('----------------------------------------------------------------')
    print('Build Complete.  Shut down your build droplet from the control')
    print('panel before creating your snapshot.')
    print('----------------------------------------------------------------')


@task
def testbuild(cxn):
    """
    Configure the build droplet, but do not clean up or shut down
    """
    install_pkgs(cxn)
    install_files(cxn)
    run_scripts(cxn)
    print('Build complete.  This droplet is NOT ready for use.  ' +
          'Use build instead of testbuild for your final build')