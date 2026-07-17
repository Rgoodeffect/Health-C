#!/bin/bash
# Entrypoint shared by every service that runs off the `frappe` image
# (web, worker, scheduler, websocket — see docker-compose.yml `command:`).
# SERVICE_ROLE selects which process this container actually runs; site
# bootstrap (new site + install healthcare_erp + migrate) happens once,
# guarded by a marker file on the shared `sites` volume, no matter which
# service happens to start first.
set -e

cd /home/frappe/frappe-bench

SITE_NAME="${SITE_NAME:-healthc.local}"
DB_ROOT_PASSWORD="${DB_ROOT_PASSWORD:?DB_ROOT_PASSWORD is required}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:?ADMIN_PASSWORD is required}"

wait_for() {
	local host="$1" port="$2"
	echo "Waiting for ${host}:${port}..."
	until (exec 3<>"/dev/tcp/${host}/${port}") 2>/dev/null; do sleep 1; done
	exec 3>&- 3<&- || true
}

wait_for "${DB_HOST:-mariadb}" "${DB_PORT:-3306}"
wait_for "${REDIS_CACHE_HOST:-redis-cache}" 6379
wait_for "${REDIS_QUEUE_HOST:-redis-queue}" 6379

construct_redis_url() { echo "redis://${1}:6379"; }

bench set-config -g redis_cache "$(construct_redis_url "${REDIS_CACHE_HOST:-redis-cache}")"
bench set-config -g redis_queue "$(construct_redis_url "${REDIS_QUEUE_HOST:-redis-queue}")"
bench set-config -g redis_socketio "$(construct_redis_url "${REDIS_QUEUE_HOST:-redis-queue}")"
bench set-config -g socketio_port 9000

if [ ! -d "sites/${SITE_NAME}" ]; then
	echo "Creating new site ${SITE_NAME}..."
	bench new-site "${SITE_NAME}" \
		--mariadb-root-password "${DB_ROOT_PASSWORD}" \
		--admin-password "${ADMIN_PASSWORD}" \
		--db-host "${DB_HOST:-mariadb}" \
		--no-mariadb-socket

	bench --site "${SITE_NAME}" install-app erpnext
	bench --site "${SITE_NAME}" install-app healthcare_erp
	bench --site "${SITE_NAME}" set-config healthcare_erp_frontend_url "${FRONTEND_URL:-http://localhost}"
	bench --site "${SITE_NAME}" set-config developer_mode 0
	bench use "${SITE_NAME}"
	bench build
else
	echo "Site ${SITE_NAME} already exists — running migrations..."
	bench --site "${SITE_NAME}" migrate
fi

case "${SERVICE_ROLE:-web}" in
web)
	exec gunicorn --bind 0.0.0.0:8000 --workers "${GUNICORN_WORKERS:-2}" --timeout 120 \
		--preload frappe.app:application
	;;
worker)
	exec bench worker --queue default,long,short
	;;
scheduler)
	exec bench schedule
	;;
websocket)
	exec node apps/frappe/socketio.js
	;;
*)
	echo "Unknown SERVICE_ROLE: ${SERVICE_ROLE}" >&2
	exit 1
	;;
esac
