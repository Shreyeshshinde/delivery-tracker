#!/bin/bash
set -e

API="https://delivery-tracker-4prz.onrender.com/api/v1"

ADMIN_TOKEN=$(curl -s -X POST "$API/auth/login" -H "Content-Type: application/json" -d '{"email":"admin@prod.com","password":"admin123"}' | jq -r '.access_token')

if [ "$ADMIN_TOKEN" == "null" ] || [ -z "$ADMIN_TOKEN" ]; then
  echo "Could not get admin token. Check the email/password on this line of the script."
  exit 1
fi

echo "Admin token acquired."

ZONES=$(curl -s "$API/zones" -H "Authorization: Bearer $ADMIN_TOKEN")
ZONE_COUNT=$(echo "$ZONES" | jq 'length')
echo "Found $ZONE_COUNT zones."

i=0
echo "$ZONES" | jq -c '.[]' | while read -r zone; do
  i=$((i+1))
  ZONE_ID=$(echo "$zone" | jq -r '.id')
  ZONE_NAME=$(echo "$zone" | jq -r '.name')
  SAFE_NAME=$(echo "$ZONE_NAME" | tr -cd '[:alnum:]' | tr '[:upper:]' '[:lower:]')
  EMAIL="agent.${SAFE_NAME}@demo.com"

  AGENT_TOKEN=$(curl -s -X POST "$API/auth/register" -H "Content-Type: application/json" \
    -d "{\"name\": \"Agent - $ZONE_NAME\", \"email\": \"$EMAIL\", \"phone\": \"90000$(printf '%05d' $i)\", \"password\": \"agent123\", \"role\": \"agent\"}" \
    | jq -r '.access_token')

  if [ "$AGENT_TOKEN" == "null" ] || [ -z "$AGENT_TOKEN" ]; then
    # Already registered from a previous run — log in instead
    AGENT_TOKEN=$(curl -s -X POST "$API/auth/login" -H "Content-Type: application/json" \
      -d "{\"email\": \"$EMAIL\", \"password\": \"agent123\"}" | jq -r '.access_token')
  fi

  RESULT=$(curl -s -X POST "$API/agents/me" -H "Authorization: Bearer $AGENT_TOKEN" -H "Content-Type: application/json" \
    -d "{\"current_zone_id\": \"$ZONE_ID\"}")

  echo "[$ZONE_NAME] $EMAIL -> $(echo "$RESULT" | jq -c '.is_available // .detail')"
done

echo "Done seeding agents for all zones."
