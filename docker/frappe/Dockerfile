# Custom Frappe/ERPNext image with the healthcare_erp app layered in.
# Build context is the repo root (see docker-compose.yml), so this app's
# source at apps/healthcare_erp is available to COPY.
#
# Base image: the official frappe_docker `erpnext` image (bench + frappe +
# erpnext already built in). docker-compose.yml runs several services off
# this SAME image with different commands (gunicorn web worker, background
# worker, scheduler, websocket) — that's the standard frappe_docker pattern,
# not separate per-role images.
ARG ERPNEXT_VERSION=version-16

FROM frappe/erpnext:${ERPNEXT_VERSION} AS base

USER frappe
WORKDIR /home/frappe/frappe-bench

# Bring in our custom app's source and install it into the bench's Python
# environment + the `apps` directory the way `bench get-app <path>` would.
COPY --chown=frappe:frappe apps/healthcare_erp /home/frappe/frappe-bench/apps/healthcare_erp

RUN /home/frappe/frappe-bench/env/bin/pip install --no-cache-dir -e /home/frappe/frappe-bench/apps/healthcare_erp \
	&& echo "healthcare_erp" >> /home/frappe/frappe-bench/sites/apps.txt

# `bench build` (compiles JS/CSS assets Frappe still serves for the Desk,
# used only by Administrator/System Manager per docs/ARCHITECTURE.md) runs
# once at container start in docker/frappe/entrypoint.sh, since it needs
# the site's bench context, not just the image.
COPY docker/frappe/entrypoint.sh /entrypoint.sh
USER root
RUN chmod +x /entrypoint.sh
USER frappe

ENTRYPOINT ["/entrypoint.sh"]
