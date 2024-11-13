FROM gradle:7.5 AS build
LABEL stage=builder
ARG GRADLE_TASKS="clean build"
# All following dependencies are required for chromium which renders the SVGs:
RUN apt-get update && \
  DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
  fonts-uralic \
  libalut0 \
  libc6 \
  libgcc-s1 \
  libgl1 \
  libglc0 \
  libglu1-mesa \
  libglu1 \
  libopenal1 \
  libsdl2-2.0-0 \
  libsdl2-image-2.0-0 \
  libstdc++6 \
  libxdamage1 \
  libxtst6 \
  libglib2.0-0 \
  libnss3 \
  libcups2 \
  libatk1.0-0 \
  libatk-bridge2.0-0 \
  libpangocairo-1.0-0 \
  libgtk-3-0 \
  libxcomposite1
COPY --chown=gradle:gradle . /home/gradle/faust-gen
COPY --chown=gradle:gradle init.gradle.kts /home/gradle/.gradle/init.gradle.kts
WORKDIR /home/gradle/faust-gen
USER gradle
ARG CACHEBUST=0
RUN gradle ${GRADLE_TASKS} --no-daemon --info --continue
VOLUME ["/home/gradle/faust-gen/build"]

FROM php:8-apache AS www
COPY --from=build /home/gradle/faust-gen/build/www /var/www/html
