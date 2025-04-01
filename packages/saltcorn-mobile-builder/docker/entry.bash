#!/bin/bash

set -e
cd /saltcorn-mobile-app

BUILD_TYPE=$(jq -r '.buildType' saltcorn-mobile-cfg.json)
APP_VERSION=$(jq -r '.appVersion' saltcorn-mobile-cfg.json)
SERVER_DOMAIN=$(jq -r '.serverDomain' saltcorn-mobile-cfg.json)
KEYSTORE_FILE=$(jq -r '.keystoreFile' saltcorn-mobile-cfg.json)
KEYSTORE_ALIAS=$(jq -r '.keystoreAlias' saltcorn-mobile-cfg.json)
KEYSTORE_PASSWORD=$(jq -r '.keystorePassword' saltcorn-mobile-cfg.json)

echo "BUILD_TYPE: $BUILD_TYPE"
echo "APP_VERSION: $APP_VERSION"
echo "KEYSTORE_FILE: $KEYSTORE_FILE"
echo "KEYSTORE_ALIAS: $KEYSTORE_ALIAS"
#echo "KEYSTORE_PASSWORD: $KEYSTORE_PASSWORD"

export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export ANDROID_SDK_ROOT=/android_sdk
export ANDROID_HOME=/android_sdk
export GRADLE_HOME=/opt/gradle-8.4
export PATH=$PATH:/opt/gradle-8.4/bin

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
    <domain includeSubdomains="true">$SERVER_DOMAIN</domain>
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

# copy prepopulated db
mkdir -p /saltcorn-mobile-app/android/app/src/main/assets/public/assets/databases
cp /saltcorn-mobile-app/www/scdb.sqlite /saltcorn-mobile-app/android/app/src/main/assets/public/assets/databases/prepopulated.db

# set app version and code in build.gradle
npm run modify-gradle-cfg -- --app-version=$APP_VERSION

# .aab files are generated with 'npx cap build'
if [ "$BUILD_TYPE" == "release" ]; then
  # if KEYSTORE_FILE is not empty
  if [ -n "$KEYSTORE_FILE" ]; then
    echo "building signed app"
    npx cap build android \
      --androidreleasetype "AAB" \
      --keystorepath "/saltcorn-mobile-app/$KEYSTORE_FILE" \
      --keystorepass "$KEYSTORE_PASSWORD" \
      --keystorealias "$KEYSTORE_ALIAS" \
      --keystorealiaspass "$KEYSTORE_PASSWORD" 
  else
    echo "building unsigned app"
    npx cap build android \
      --androidreleasetype "AAB" \
      --keystorepath "/saltcorn-mobile-app/unsecure-default-key.jks" \
      --keystorepass "unsecurepassw" \
      --keystorealias "unsecure-default-alias" \
      --keystorealiaspass "unsecurepassw"
  fi
fi

# .apk files are generated with './gradlew assembleDebug'
# there seems to be a problem with apks generated with 'npx cap build'
if [ "$BUILD_TYPE" == "debug" ]; then
  echo "building debug app"
  cd /saltcorn-mobile-app/android
  ./gradlew assembleDebug
fi
