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
export GRADLE_HOME=/opt/gradle-8.4
export PATH=$PATH:/opt/gradle-8.4/bin
# stop gradle from downloading itself
export CORDOVA_ANDROID_GRADLE_DISTRIBUTION_URL=file\:/gradle-8.4-all.zip

cd /saltcorn-mobile-app
echo "adding android platform"
cordova platform add android
echo "writing gradle.properties"
cat <<EOF > /saltcorn-mobile-app/platforms/android/gradle.properties
org.gradle.jvmargs=-Xmx2048m
android.useAndroidX=true
android.enableJetifier=true
distributionUrl=file\:/gradle-8.4-all.zip
EOF

echo "adding plugins"
cordova plugin add /init_project/project/plugins/cordova-plugin-inappbrowser
cordova plugin add /init_project/project/plugins/cordova-plugin-file
cordova plugin add /init_project/project/plugins/cordova-sqlite-ext
cordova plugin add /init_project/project/plugins/cordova-plugin-network-information
cordova plugin add /init_project/project/plugins/cordova-plugin-geolocation
cordova plugin add /init_project/project/plugins/cordova-plugin-camera

echo "calling cordova build"
cordova build android --verbose


if [ -n "$KEYSTORE_FILE" ]; then
  echo "building signed app with keystore"
  cordova build android --"$BUILD_TYPE" --verbose -- --keystore="$KEYSTORE_FILE" --alias="$KEYSTORE_ALIAS" --storePassword="$KEYSTORE_PASSWORD" --password="$KEYSTORE_PASSWORD"
else
  echo "building unsigned app"
  cordova build android --"$BUILD_TYPE" --verbose
fi

chmod -R o+rwx /saltcorn-mobile-app
