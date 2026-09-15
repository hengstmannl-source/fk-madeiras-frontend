from __future__ import annotations

import re
from collections import defaultdict, Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
files = sorted((ROOT / "drizzle").glob("*.sql"))


def statements(path: Path):
    text = path.read_text(encoding="utf-8")
    chunks = re.split(r"-->\s*statement-breakpoint", text, flags=re.I)
    for chunk in chunks:
        for statement in chunk.split(";"):
            statement = re.sub(r"--[^\n]*", "", statement).strip()
            if statement:
                yield re.sub(r"\s+", " ", statement)

all_statements: list[tuple[str, str]] = []
for path in files:
    for statement in statements(path):
        all_statements.append((path.name, statement))

print(f"files={len(files)}")
print(f"statements={len(all_statements)}")

exact = defaultdict(list)
for filename, statement in all_statements:
    exact[statement].append(filename)
print("\nEXACT_DUPLICATES")
for statement, origins in exact.items():
    if len(origins) > 1:
        print(f"count={len(origins)} files={','.join(origins)}")
        print(statement)

print("\nADD_COLUMN_BY_TABLE_COLUMN")
adds = defaultdict(list)
for filename, statement in all_statements:
    match = re.search(r"(?is)ALTER TABLE [`]?([A-Za-z0-9_]+)[`]?.*?ADD(?: COLUMN)? [`]?([A-Za-z0-9_]+)[`]?(?: |$)", statement)
    if match:
        adds[(match.group(1), match.group(2))].append((filename, statement))
for (table, column), entries in adds.items():
    if len(entries) > 1:
        print(f"{table}.{column}: {', '.join(filename for filename, _ in entries)}")
        for _, statement in entries:
            print(f"  {statement}")

print("\nCREATE_OBJECTS")
creates = defaultdict(list)
for filename, statement in all_statements:
    match = re.match(r"(?is)CREATE\s+(TABLE|INDEX|UNIQUE INDEX|VIEW)\s+(?:IF\s+(?:NOT\s+)?EXISTS\s+)?[`]?([A-Za-z0-9_]+)[`]?...", statement)
    if match:
        creates[(match.group(1).upper(), match.group(2))].append(filename)
for key, origins in creates.items():
    if len(origins) > 1:
        print(f"{key}: {', '.join(origins)}")

print("\nDROP_OR_RENAME")
for filename, statement in all_statements:
    if re.search(r"(?i)\b(DROP|RENAME)\b", statement):
        print(f"{filename}: {statement}")

print("\nSTATEMENTS_PER_FILE")
for filename, count in Counter(filename for filename, _ in all_statements).items():
    print(f"{filename}: {count}")
