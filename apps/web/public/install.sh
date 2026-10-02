#!/bin/sh
set -eu
server=''
next=''
for arg in "$@"; do
  if [ "$next" = server ]; then server="$arg"; next=''; fi
  if [ "$arg" = --server ]; then next=server; fi
done
if [ -z "$server" ]; then echo 'Use the install command from your Token Maxxer Collector page.' >&2; exit 1; fi
case "$server" in https://*|http://localhost:*|http://127.0.0.1:*) ;; *) echo 'An HTTPS server URL is required.' >&2; exit 1;; esac
if ! command -v node >/dev/null 2>&1; then echo 'Install Node.js 20 or newer from https://nodejs.org, then paste this command again.' >&2; exit 1; fi
node -e 'if (Number(process.versions.node.split(".")[0]) < 20) { console.error("Node.js 20 or newer is required."); process.exit(1); }'
install_dir="${TOKEN_MAXXER_HOME:-$HOME/.token-maxxer}"
umask 077
mkdir -p "$install_dir"
collector_tmp=$(mktemp "$install_dir/download.XXXXXX")
checksum_tmp=$(mktemp "$install_dir/checksum.XXXXXX")
trap 'rm -f "$collector_tmp" "$checksum_tmp"' EXIT HUP INT TERM
curl -fsSL --max-time 60 "$server/collector.cjs" -o "$collector_tmp"
curl -fsSL --max-time 60 "$server/collector.cjs.sha256" -o "$checksum_tmp"
node - "$collector_tmp" "$checksum_tmp" <<'JS'
const fs = require('node:fs');
const crypto = require('node:crypto');
const expected = fs.readFileSync(process.argv[3], 'utf8').trim();
const actual = crypto.createHash('sha256').update(fs.readFileSync(process.argv[2])).digest('hex');
if (!/^[a-f0-9]{64}$/.test(expected) || expected !== actual) { console.error('Download verification failed. Retry the command.'); process.exit(1); }
JS
mv "$collector_tmp" "$install_dir/collector.cjs"
node "$install_dir/collector.cjs" setup "$@"
