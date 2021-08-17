FROM archlinux:base-devel
RUN pacman -Syyu --noconfirm && pacman-db-upgrade && pacman -Sy git fakeroot binutils --noconfirm
WORKDIR /opt/saltcorn

COPY . /opt/saltcorn
ENV EUID=1
RUN makepkg -si --noconfirm