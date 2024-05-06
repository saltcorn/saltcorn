#!/bin/bash

BUILD_TYPE="$1"
KEYSTORE_FILE="$2"
KEYSTORE_ALIAS="$3"
KEYSTORE_PASSWORD="$4"

echo "BUILD_TYPE: $BUILD_TYPE"
echo "KEYSTORE_FILE: $KEYSTORE_FILE"
echo "KEYSTORE_ALIAS: $KEYSTORE_ALIAS"
#echo "KEYSTORE_PASSWORD: $KEYSTORE_PASSWORD"

export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export ANDROID_SDK_ROOT=/android_sdk
export ANDROID_HOME=/android_sdk
export GRADLE_HOME=/opt/gradle-7.5.1
export PATH=$PATH:/opt/gradle-7.5.1/bin
# stop gradle from downloading itself
export CORDOVA_ANDROID_GRADLE_DISTRIBUTION_URL=file\:/gradle-7.5.1-all.zip

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
npm run add-plugin /init_project/project/plugins/cordova-plugin-geolocation
npm run add-plugin /init_project/project/plugins/cordova-plugin-camera

if [ -n "$KEYSTORE_FILE" ]; then
  echo "building signed app with keystore"
  cordova build android --"$BUILD_TYPE" -- --keystore="$KEYSTORE_FILE" --alias="$KEYSTORE_ALIAS" --storePassword="$KEYSTORE_PASSWORD" --password="$KEYSTORE_PASSWORD"
else
  echo "building unsigned app"
  cordova build android --"$BUILD_TYPE"
fi

chmod -R o+rwx /saltcorn-mobile-app
