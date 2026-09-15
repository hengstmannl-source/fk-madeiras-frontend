#!/usr/bin/env bash
set -euo pipefail

CONTAINER="${MYSQL_CONTAINER:-fk-madeiras-mysql}"
OUTPUT="${1:-auditoria-banco-real.txt}"

if ! docker inspect "$CONTAINER" >/dev/null 2>&1; then
  echo "Container não encontrado: $CONTAINER" >&2
  exit 2
fi

running="$(docker inspect -f '{{.State.Running}}' "$CONTAINER")"
if [[ "$running" != "true" ]]; then
  echo "Container não está em execução: $CONTAINER" >&2
  exit 2
fi

# O SQL chamado abaixo é exclusivamente SELECT/SHOW via information_schema.
# Não usa o banco, o volume, o journal ou qualquer tabela de negócio para escrever.
docker exec -i "$CONTAINER" sh -lc \
  'mysql --protocol=TCP -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' \
  < "$(dirname "$0")/auditar-banco-real.sql" > "$OUTPUT"

printf 'Auditoria gravada em %s\n' "$OUTPUT"
grep -E 'JOURNAL_SUMMARY|EXPECTED_OBJECTS|PHYSICAL_TABLES|PHYSICAL_COLUMNS|PHYSICAL_INDEXES' "$OUTPUT" | head -20 || true
