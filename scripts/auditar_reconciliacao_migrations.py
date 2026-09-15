from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = ROOT / "drizzle"

statement_re = re.compile(r"(?is)(.*?)(?:--> statement-breakpoint|$)")

def statements(sql: str):
    for match in statement_re.finditer(sql):
        value = " ".join(match.group(1).split())
        if value:
            yield value

def classify(stmt: str) -> str:
    upper = stmt.upper()
    if upper.startswith("CREATE TABLE"):
        return "CREATE TABLE"
    if upper.startswith("ALTER TABLE") and " ADD " in upper:
        return "ALTER ADD"
    if upper.startswith("ALTER TABLE") and " MODIFY COLUMN" in upper:
        return "ALTER MODIFY"
    if upper.startswith("CREATE INDEX"):
        return "CREATE INDEX"
    if upper.startswith("CREATE UNIQUE INDEX"):
        return "CREATE UNIQUE INDEX"
    if upper.startswith("DROP INDEX"):
        return "DROP INDEX"
    if upper.startswith("DROP TABLE"):
        return "DROP TABLE"
    return upper.split(" ", 2)[0] if upper else "UNKNOWN"

for path in sorted(MIGRATIONS.glob("*.sql")):
    number = int(path.name[:4])
    if not 50 <= number <= 72:
        continue
    print(f"\n===== {path.name} =====")
    for index, stmt in enumerate(statements(path.read_text()), 1):
        print(f"{index:02d} [{classify(stmt)}] {stmt}")
