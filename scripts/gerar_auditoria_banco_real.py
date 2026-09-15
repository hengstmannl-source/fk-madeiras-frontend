from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DRIZZLE = ROOT / "drizzle"
OUT = ROOT / "scripts" / "auditar-banco-real.sql"

# A migration ordinal is journal idx + 1. Therefore ordinal 50 is file 0049
# and ordinal 73 is file 0072 in this repository.
records: list[tuple[str, str, str, str]] = []

def add(tag: str, kind: str, name: str, detail: str = ""):
    records.append((tag, kind, name, detail))

for path in sorted(DRIZZLE.glob("*.sql")):
    idx = int(path.name[:4])
    if not 49 <= idx <= 72:
        continue
    tag = path.stem
    for raw in path.read_text().split("--> statement-breakpoint"):
        stmt = " ".join(raw.split())
        if not stmt:
            continue
        match = re.match(r"CREATE TABLE `([^`]+)`", stmt, re.I)
        if match:
            add(tag, "TABLE", match.group(1), "CREATE TABLE")
            continue
        match = re.match(r"ALTER TABLE `([^`]+)` ADD `([^`]+)`", stmt, re.I)
        if match:
            add(tag, "COLUMN", f"{match.group(1)}.{match.group(2)}", "ALTER ADD")
            continue
        match = re.match(r"ALTER TABLE `([^`]+)` MODIFY COLUMN `([^`]+)`", stmt, re.I)
        if match:
            add(tag, "COLUMN", f"{match.group(1)}.{match.group(2)}", "ALTER MODIFY")
            continue
        match = re.match(r"CREATE (UNIQUE )?INDEX `([^`]+)` ON `([^`]+)`", stmt, re.I)
        if match:
            add(tag, "INDEX", f"{match.group(3)}.{match.group(2)}", "CREATE UNIQUE INDEX" if match.group(1) else "CREATE INDEX")
            continue


def q(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"

lines = [
    "-- READ-ONLY: não contém INSERT, UPDATE, DELETE, ALTER, DROP ou TRUNCATE.",
    "-- Migrations ordinais 50–73 = arquivos 0049–0072 neste repositório.",
    "SELECT 'JOURNAL_SUMMARY' AS section, COUNT(*) AS migration_count, MIN(id) AS first_id, MAX(id) AS last_id FROM `__drizzle_migrations`;",
    "SELECT id, hash, created_at FROM `__drizzle_migrations` ORDER BY id;",
    "",
    "SELECT 'EXPECTED_OBJECTS' AS section, migration_tag, object_kind, object_name, operation,",
    "  CASE",
    "    WHEN object_kind = 'TABLE' AND EXISTS (SELECT 1 FROM information_schema.tables t WHERE t.table_schema = DATABASE() AND t.table_name = object_name) THEN 'EXISTS'",
    "    WHEN object_kind = 'COLUMN' AND EXISTS (SELECT 1 FROM information_schema.columns c WHERE c.table_schema = DATABASE() AND CONCAT(c.table_name, '.', c.column_name) = object_name) THEN 'EXISTS'",
    "    WHEN object_kind = 'INDEX' AND EXISTS (SELECT 1 FROM information_schema.statistics s WHERE s.table_schema = DATABASE() AND CONCAT(s.table_name, '.', s.index_name) = object_name) THEN 'EXISTS'",
    "    ELSE 'MISSING'",
    "  END AS physical_status",
    "FROM (",
]

rows = []
for tag, kind, name, operation in records:
    rows.append(f"  SELECT {q(tag)} AS migration_tag, {q(kind)} AS object_kind, {q(name)} AS object_name, {q(operation)} AS operation")
lines.append("\n  UNION ALL\n".join(rows))
lines += [
    ") expected ORDER BY migration_tag, object_kind, object_name;",
    "",
    "SELECT 'PHYSICAL_TABLES' AS section, table_name, table_rows, create_time, update_time",
    "FROM information_schema.tables WHERE table_schema = DATABASE() ORDER BY table_name;",
    "",
    "SELECT 'PHYSICAL_COLUMNS' AS section, table_name, ordinal_position, column_name, column_type, is_nullable, column_default, extra",
    "FROM information_schema.columns WHERE table_schema = DATABASE() ORDER BY table_name, ordinal_position;",
    "",
    "SELECT 'PHYSICAL_INDEXES' AS section, table_name, index_name, non_unique, GROUP_CONCAT(column_name ORDER BY seq_in_index SEPARATOR ',') AS columns_in_index",
    "FROM information_schema.statistics WHERE table_schema = DATABASE() GROUP BY table_name, index_name, non_unique ORDER BY table_name, index_name;",
]
OUT.write_text("\n".join(lines) + "\n")
print(f"generated {OUT} with {len(records)} expected objects")
