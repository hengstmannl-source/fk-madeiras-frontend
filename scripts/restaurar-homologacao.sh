#!/usr/bin/env bash
set -Eeuo pipefail

if [[ $# -ne 1 ]]; then
  echo "Uso: $0 /caminho/para/backup-fkmadeiras-atual.sql" >&2
  exit 2
fi

BACKUP="$1"
COMPOSE_FILE="docker-compose.homologacao.yml"
SERVICE="mysql-homologacao"
DB="fkmadeiras_homologacao"
USER="fk_madeiras_homologacao"
PASSWORD="homologacao_app_password"
ROOT_PASSWORD="homologacao_root_password"
TMP_DIR="${TMPDIR:-/tmp}/fk-madeiras-homologacao"
DECODED="$TMP_DIR/backup-utf8.sql"
SANITIZED="$TMP_DIR/backup-homologacao.sql"

if [[ ! -f "$BACKUP" ]]; then
  echo "Backup não encontrado: $BACKUP" >&2
  exit 1
fi

mkdir -p "$TMP_DIR"

# O backup recebido é UTF-16LE/CRLF. A conversão ocorre apenas numa cópia temporária.
iconv -f UTF-16LE -t UTF-8 "$BACKUP" > "$DECODED"

# O dump original contém CREATE DATABASE/USE fkmadeiras. Eles são removidos da cópia
# importada para impedir qualquer apontamento para o banco real.
awk '
  !/^[[:space:]]*CREATE DATABASE/ && !/^[[:space:]]*USE `fkmadeiras`;/ { print }
' "$DECODED" > "$SANITIZED"

if grep -Eq '^[[:space:]]*(CREATE DATABASE|USE `fkmadeiras`)' "$SANITIZED"; then
  echo "Diretiva do banco original ainda presente; importação cancelada." >&2
  exit 1
fi

# Só sobe o serviço desta homologação, em porta e volume distintos.
docker compose -f "$COMPOSE_FILE" up -d "$SERVICE"
for _ in $(seq 1 60); do
  if docker compose -f "$COMPOSE_FILE" exec -T "$SERVICE" mysqladmin ping -h localhost -u root "-p$ROOT_PASSWORD" --silent >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

docker compose -f "$COMPOSE_FILE" exec -T "$SERVICE" mysqladmin ping -h localhost -u root "-p$ROOT_PASSWORD" --silent >/dev/null

cat "$SANITIZED" | docker compose -f "$COMPOSE_FILE" exec -T "$SERVICE" mysql \
  -u "$USER" "-p$PASSWORD" "$DB"

echo "Backup restaurado exclusivamente em ${SERVICE}:${DB}."
echo "Volume utilizado: fk_madeiras_homologacao_mysql"
echo "Arquivo temporário importado: $SANITIZED"
