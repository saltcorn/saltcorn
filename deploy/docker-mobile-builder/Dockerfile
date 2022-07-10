FROM node:16

RUN apt update && apt install -y wget unzip \
  openjdk-11-jdk openjdk-11-demo openjdk-11-doc openjdk-11-jre-headless openjdk-11-source 

# install android commandline tools and sdk
RUN wget https://dl.google.com/android/repository/commandlinetools-linux-8512546_latest.zip
RUN unzip commandlinetools-linux-8512546_latest.zip
RUN mkdir android_sdk
RUN yes | cmdline-tools/bin/sdkmanager --sdk_root=android_sdk --install "cmdline-tools;latest"
RUN android_sdk/cmdline-tools/latest/bin/sdkmanager --list
RUN android_sdk/cmdline-tools/latest/bin/sdkmanager "platforms;android-11"
RUN android_sdk/cmdline-tools/latest/bin/sdkmanager "build-tools;30.0.3"

# download gradle
RUN wget -q https://services.gradle.org/distributions/gradle-7.1.1-all.zip \
    && unzip gradle-7.1.1-all.zip -d /opt

RUN npm install -g cordova

# create an empty project, the first init seems to take longer
WORKDIR /init_project
RUN cordova create project
WORKDIR /init_project/project
RUN cordova platform add android
ENV JAVA_HOME=/usr/lib/jvm/java-11-openjdk-amd64
ENV ANDROID_SDK_ROOT=/android_sdk
ENV GRADLE_HOME=/opt/gradle-7.1.1
ENV PATH=$PATH:/opt/gradle-7.1.1/bin
# stop gradle from downloading itself
ENV CORDOVA_ANDROID_GRADLE_DISTRIBUTION_URL=file\:/gradle-7.1.1-all.zip
RUN cordova build

# prepare entry point
WORKDIR /
COPY entry.bash ./
RUN chmod u+x entry.bash

RUN chmod o+rwx ~
RUN chmod -R o+rwx ~/.config

ENTRYPOINT ["./entry.bash"]
