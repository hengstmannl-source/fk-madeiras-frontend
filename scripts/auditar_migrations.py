from __future__ import annotations

import re
from pathlib import Path
from collections import Counter, defaultdict

ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = sorted((ROOT / "drizzle").glob("*.sql"))

statement_re = re.compile(r"(?is)(?:^|;)(.*?)(?=;|$)")
operation_re = re.compile(
    r"(?is)^\s*(CREATE|ALTER|DROP)\s+(TABLE|INDEX|UNIQUE INDEX|CONSTRAINT|VIEW|DATABASE)\s+(?:IF\s+(?:NOT\s+)?EXISTS\s+)?(?:`?)([A-Za-z0-9_]+)"
)
object_re = re.compile(
    r"(?is)\b(?:ADD\s+(?:COLUMN|CONSTRAINT|INDEX|UNIQUE\s+INDEX)|DROP\s+(?:COLUMN|CONSTRAINT|INDEX)|MODIFY\s+COLUMN|CHANGE\s+COLUMN)\s+(?:IF\s+EXISTS\s+)?`?([A-Za-z0-9_]+)"
)

operations: list[tuple[str, str, str, str]] = []
for path in MIGRATIONS:
    text = path.read_text(encoding="utf-8")
    for match in statement_re.finditer(text):
        statement = re.sub(r"--.*", "", match.group(1)).strip()
        if not statement:
            continue
        normalized = re.sub(r"\s+", " ", statement)
        op = operation_re.match(statement)
        if op:
            operations.append((path.name, op.group(1).upper(), op.group(2).upper(), op.group(3)))
            continue
        alter = re.match(r"(?is)^\s*ALTER\s+TABLE\s+`?([A-Za-z0-9_]+).*", statement)
        if alter:
            table = alter.group(1)
            obj = object_re.search(statement)
            operations.append((path.name, "ALTER", table.upper(), obj.group(1) if obj else normalized[:120]))
        else:
            operations.append((path.name, "OTHER", "", normalized[:160]))

print(f"migration_files={len(MIGRATIONS)}")
print(f"sql_statements={len(operations)}")
print("\noperations_by_type=")
for key, count in Counter((op, obj) for _, op, obj, _ in operations).most_common():
    print(f"{key[0]} {key[1]}: {count}")

print("\nrepeated_object_operations=")
seen: defaultdict[tuple[str, str, str], list[str]] = defaultdict(list)
for file_name, op, obj, detail in operations:
    if op != "OTHER":
        seen[(op, obj, detail)].append(file_name)
for key, files in seen.items():
    if len(files) > 1:
        print(f"{key}: {', '.join(files)}")

print("\nfiles_with_multiple_statements=")
for path in MIGRATIONS:
    count = sum(1 for file_name, *_ in operations if file_name == path.name)
    if count > 1:
        print(f"{path.name}: {count}")
