#!/usr/bin/env bash
set -euo pipefail

export PATH="$HOME/.docker/bin:$PATH"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTRACT="/app/security/forseti/WithdrawalApprovalContract.cs"
HARNESS=".tide-pack/templates/forseti-compile-harness"

if ! docker info >/dev/null 2>&1; then
  echo "Docker Desktop is required and its engine must be running." >&2
  exit 1
fi
if [[ ! -f "$ROOT/$HARNESS/check.csproj" ]]; then
  echo "Official Tide Agent Pack is missing at .tide-pack/. Follow README setup first." >&2
  exit 1
fi

for typing in bytes rom; do
  docker run --rm -v "$ROOT:/app:ro" -w /app mcr.microsoft.com/dotnet/sdk:8.0 \
    dotnet build "$HARNESS/check.csproj" \
    -p:ContractPath="$CONTRACT" \
    -p:DataTyping="$typing" \
    -p:BaseIntermediateOutputPath="/tmp/obj/$typing/" \
    -p:BaseOutputPath="/tmp/bin/$typing/" \
    --nologo -v quiet
done

python3 "$ROOT/$HARNESS/scan-sandbox.py" "$ROOT/security/forseti/WithdrawalApprovalContract.cs"
echo "Forseti contract compile and sandbox checks passed."
