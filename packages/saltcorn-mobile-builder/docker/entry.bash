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
plugins="cordova-plugin-file@7.0.0 cordova-plugin-inappbrowser cordova-plugin-network-information cordova-plugin-geolocation" && \
for plugin in $plugins; do \
  npm install "$plugin"; \
done
npx cap sync

npm install @capacitor/filesystem
npm install @capacitor-community/sqlite
npm install @capacitor/camera


# data extraction rules
cat <<EOF > /saltcorn-mobile-app/android/app/src/main/res/xml/data_extraction_rules.xml
<?xml version="1.0" encoding="utf-8"?>
<data-extraction-rules>
    <cloud-backup>
      <exclude domain="root" />
      <exclude domain="database" />
      <exclude domain="sharedpref" />
      <exclude domain="external" />
    </cloud-backup>
    <device-transfer>
      <exclude domain="root" />
      <exclude domain="database" />
      <exclude domain="sharedpref" />
      <exclude domain="external" />
    </device-transfer>
</data-extraction-rules>
EOF

# network security config
cat <<EOF > /saltcorn-mobile-app/android/app/src/main/res/xml/network_security_config.xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <domain-config cleartextTrafficPermitted="true">
    <domain includeSubdomains="true">10.0.2.2</domain>
  </domain-config>
</network-security-config>
EOF

npm run modify-android-manifest
npx cap sync

# gradle wrapper
cat <<EOF > /saltcorn-mobile-app/android/gradle/wrapper/gradle-wrapper.properties
distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
distributionUrl=file\:/gradle-8.4-all.zip
networkTimeout=10000
validateDistributionUrl=true
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists
EOF

npm run build
npx cap sync

# install the corodva-file-plugin
npm install cordova-plugin-file@8.1.2
npx cap sync

# copy prepopulated db
mkdir -p /saltcorn-mobile-app/android/app/src/main/assets/public/assets/databases
cp /saltcorn-mobile-app/www/scdb.sqlite /saltcorn-mobile-app/android/app/src/main/assets/public/assets/databases/prepopulated.db

cd ./android

# modify gradle config for keystore
if [ -n "$KEYSTORE_FILE" ]; then
  echo "building signed app with keystore"
  npm run write-gradle-cfg -- --keystore-file=$KEYSTORE_FILE --keystore-alias=$KEYSTORE_ALIAS --keystore-password=$KEYSTORE_PASSWORD  
fi

if [ "$BUILD_TYPE" == "release" ]; then
  ./gradlew assembleRelease
else
  ./gradlew assembleDebug
fi
