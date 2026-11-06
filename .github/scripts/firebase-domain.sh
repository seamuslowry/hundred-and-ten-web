#!/usr/bin/env bash
# Add or remove a hostname in the Firebase Auth authorized domains list.
# Usage: firebase-domain.sh add|remove <hostname>
# Env: GCP_ACCESS_TOKEN, FIREBASE_PROJECT_ID
set -euo pipefail

action="${1:?usage: $0 add|remove <hostname>}"
host="${2:?usage: $0 add|remove <hostname>}"
url="https://identitytoolkit.googleapis.com/admin/v2/projects/${FIREBASE_PROJECT_ID}/config"
auth=(-H "Authorization: Bearer ${GCP_ACCESS_TOKEN}" -H "x-goog-user-project: ${FIREBASE_PROJECT_ID}")

current() {
  curl -fsS "${auth[@]}" "$url" | jq -c '.authorizedDomains // []'
}

# The config has no etag, so this is read-modify-write. Concurrent PRs can race;
# verify the result and retry a few times.
for attempt in 1 2 3 4 5; do
  domains="$(current)"
  if [ "$action" = add ]; then
    updated="$(jq -c --arg h "$host" 'if index($h) then . else . + [$h] end' <<<"$domains")"
  else
    updated="$(jq -c --arg h "$host" 'map(select(. != $h))' <<<"$domains")"
  fi

  if [ "$updated" != "$domains" ]; then
    curl -fsS -X PATCH "${auth[@]}" -H "Content-Type: application/json" \
      -d "$(jq -c -n --argjson d "$updated" '{authorizedDomains: $d}')" \
      "${url}?updateMask=authorizedDomains" >/dev/null
  fi

  sleep $((attempt + RANDOM % 3))
  if [ "$action" = add ]; then
    jq -e --arg h "$host" 'index($h)' <<<"$(current)" >/dev/null && { echo "$host authorized"; exit 0; }
  else
    jq -e --arg h "$host" 'index($h) | not' <<<"$(current)" >/dev/null && { echo "$host removed"; exit 0; }
  fi
  echo "attempt $attempt: $host not in expected state, retrying" >&2
done
echo "failed to $action $host" >&2
exit 1
