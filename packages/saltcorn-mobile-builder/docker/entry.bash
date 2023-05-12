#!/bin/bash

export JAVA_HOME=/usr/lib/jvm/java-11-openjdk-amd64
export ANDROID_SDK_ROOT=/android_sdk
export GRADLE_HOME=/opt/gradle-7.1.1
export PATH=$PATH:/opt/gradle-7.1.1/bin
# stop gradle from downloading itself
export CORDOVA_ANDROID_GRADLE_DISTRIBUTION_URL=file\:/gradle-7.1.1-all.zip

cd /saltcorn-mobile-app
echo "adding android platform"
npm run add-platform android
echo "calling cordova clean";
cordova clean
echo "adding plugins"
npm run add-plugin /init_project/project/plugins/cordova-plugin-inappbrowser
npm run add-plugin /init_project/project/plugins/cordova-plugin-file
npm run add-plugin /init_project/project/plugins/cordova-sqlite-ext
npm run add-plugin /init_project/project/plugins/cordova-plugin-network-information
echo "calling cordova build";
cordova build android

chmod -R o+rwx /saltcorn-mobile-app
