FROM archlinux:base-devel
RUN pacman -Syyu --noconfirm && pacman-db-upgrade && pacman -Sy git fakeroot binutils --noconfirm
WORKDIR /opt/saltcorn

COPY ./cli /opt/saltcorn
ENV EUID=1
RUN makepkg -si --noconfirm
RUN saltcorn --help

WORKDIR /opt/saltcorn-server

COPY ./server /opt/saltcorn-server
RUN pwd
RUN ls
RUN makepkg -si --noconfirm