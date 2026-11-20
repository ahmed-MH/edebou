#!/usr/bin/env bash
set -euo pipefail

public_interface=${PUBLIC_INTERFACE:-enp0s6}

configure_family() {
  local command=$1

  if ! "$command" -S DOCKER-USER >/dev/null 2>&1; then
    return 0
  fi

  "$command" -N EDEBOU-DOCKER 2>/dev/null || true
  "$command" -F EDEBOU-DOCKER
  "$command" -C DOCKER-USER -j EDEBOU-DOCKER 2>/dev/null || \
    "$command" -I DOCKER-USER 1 -j EDEBOU-DOCKER

  "$command" -A EDEBOU-DOCKER \
    -m conntrack --ctstate RELATED,ESTABLISHED -j RETURN
  "$command" -A EDEBOU-DOCKER -i "$public_interface" -p tcp \
    -m conntrack --ctstate NEW --ctorigdstport 80 -j RETURN
  "$command" -A EDEBOU-DOCKER -i "$public_interface" -p tcp \
    -m conntrack --ctstate NEW --ctorigdstport 443 -j RETURN
  "$command" -A EDEBOU-DOCKER -i "$public_interface" -p udp \
    -m conntrack --ctstate NEW --ctorigdstport 443 -j RETURN
  "$command" -A EDEBOU-DOCKER -i "$public_interface" -j DROP
  "$command" -A EDEBOU-DOCKER -j RETURN
}

for _ in $(seq 1 30); do
  if iptables -S DOCKER-USER >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

configure_family iptables
configure_family ip6tables
