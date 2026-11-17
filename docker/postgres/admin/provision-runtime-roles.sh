#!/bin/sh
set -eu

/opt/edebou-admin/provision-checkout-role.sh
/opt/edebou-admin/provision-admin-role.sh

echo "EDebou runtime database roles are ready."
