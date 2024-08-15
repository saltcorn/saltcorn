#!/bin/bash

set -e

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

cd /saltcorn-mobile-app
npm install @capacitor/cli @capacitor/core @capacitor/android
npm run add-platform android
npx capacitor-assets generate
plugins="cordova-sqlite-ext cordova-plugin-file@7.0.0 cordova-plugin-inappbrowser cordova-plugin-network-information cordova-plugin-geolocation cordova-plugin-camera" && \
for plugin in $plugins; do \
  npm install "$plugin"; \
done
npx cap sync
cd ./android
cat <<EOF > /saltcorn-mobile-app/android/gradle/wrapper/gradle-wrapper.properties
distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
distributionUrl=file\:/gradle-8.4-all.zip
networkTimeout=10000
validateDistributionUrl=true
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists
EOF

if [ -n "$KEYSTORE_FILE" ]; then
  echo "building signed app with keystore"
  npm run write-gradle-cfg -- --keystore-file=$KEYSTORE_FILE --keystore-alias=$KEYSTORE_ALIAS --keystore-password=$KEYSTORE_PASSWORD  
fi

if [ "$BUILD_TYPE" == "release" ]; then
  ./gradlew assembleRelease
else
  ./gradlew assembleDebug
fi
