from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = ROOT / "drizzle"
OUT = ROOT / "docs" / "relatorio-reconciliacao-banco-real.md"

physical = {
    "0049": "parcial: coluna folhasPagamentoRh.tituloEncargosFinanceiroId existe, mas migration ordinal 50 não está no journal",
    "0050-0072": "ausente segundo o relatório recebido: objetos esperados marcados MISSING",
}

entries = []
for path in sorted(MIGRATIONS.glob("*.sql")):
    match = re.match(r"(\d{4})_.*\.sql$", path.name)
    if not match:
        continue
    number = int(match.group(1))
    if not 49 <= number <= 72:
        continue
    text = path.read_text(encoding="utf-8")
    statements = [s.strip() for s in re.split(r"-- statement-breakpoint", text) if s.strip()]
    operations = []
    for statement in statements:
        compact = " ".join(statement.split())
        upper = compact.upper()
        if upper.startswith("CREATE TABLE"):
            kind = "CREATE TABLE"
        elif upper.startswith("ALTER TABLE"):
            kind = "ALTER TABLE"
        elif upper.startswith("CREATE INDEX") or upper.startswith("CREATE UNIQUE INDEX"):
            kind = "CREATE INDEX"
        elif upper.startswith("DROP INDEX"):
            kind = "DROP INDEX"
        elif upper.startswith("INSERT"):
            kind = "INSERT"
        elif upper.startswith("UPDATE"):
            kind = "UPDATE"
        elif upper.startswith("DELETE"):
            kind = "DELETE"
        else:
            kind = "OUTRO"
        operations.append((kind, compact))
    entries.append((number, path.name, operations))

lines = []
lines.append("# Relatório técnico — reconciliação do banco real\n")
lines.append("## Escopo e conclusão preliminar\n")
lines.append("O banco real reportado contém 49 registros em `__drizzle_migrations`, enquanto o código atual possui 73 migrations. A auditoria física marca como ausentes praticamente todos os objetos esperados da janela ordinal 50–73. Há, contudo, pelo menos uma evidência de aplicação parcial: `folhasPagamentoRh.tituloEncargosFinanceiroId` existe fisicamente, embora a migration correspondente não esteja registrada no journal. Portanto, não é seguro executar diretamente `drizzle-kit migrate` no banco real sem primeiro testar uma reconciliação em cópia do backup e sem explicar essa divergência.\n")
lines.append("## Regra de numeração\n")
lines.append("O journal do Drizzle utiliza `id` ordinal começando em 1, enquanto os arquivos deste repositório começam em `0000`. Assim, a migration ordinal 50 corresponde ao arquivo `0049_steep_eddie_brock.sql`, e a ordinal 73 corresponde ao arquivo `0072_dashing_changeling.sql`.\n")
lines.append("## Inventário das migrations 0049–0072\n")
lines.append("| Ordinal no journal | Arquivo | Operações | Estado físico reportado | Risco preliminar |\n|---:|---|---|---|---|\n")
for number, filename, operations in entries:
    ordinal = number + 1
    kinds = ", ".join(kind for kind, _ in operations) or "sem statements"
    if number == 49:
        status = physical["0049"]
        risk = "alto: o objeto existe fora do journal; executar cegamente pode falhar por duplicidade"
    else:
        status = physical["0050-0072"]
        risk = "alto: precisa verificar tipos, defaults, índices e FKs; presença/ausência simples não basta"
    lines.append(f"| {ordinal} | `{filename}` | {kinds} | {status} | {risk} |\n")
lines.append("\n## O que pode ser concluído a partir do relatório recebido\n")
lines.append("A janela posterior ao journal não está simplesmente atrasada: o banco possui um estado parcialmente divergente. A existência da coluna da migration `0049` sem o respectivo registro indica que uma execução anterior pode ter sido interrompida após o DDL, que o journal pode ter sido perdido/incompleto, ou que a alteração foi feita por outro procedimento. Não se deve editar o journal para corrigir esse caso.\n")
lines.append("As migrations `0050`–`0072` parecem necessárias para o código atual, porque introduzem estruturas referenciadas por rotas e pelo schema moderno. Porém, o relatório atual é um inventário de presença; ele não demonstra igualdade de tipo, nulidade, default, collation, foreign keys ou expressão de índices. Por isso, a lista de objetos `MISSING` é suficiente para indicar divergência, mas não para autorizar a aplicação no banco real.\n")
lines.append("## Tratamento especial\n")
lines.append("O primeiro tratamento especial é a migration ordinal 50 (`0049_steep_eddie_brock`): antes de qualquer execução, deve-se comparar o DDL esperado com `SHOW CREATE TABLE folhasPagamentoRh` e com a definição da coluna em `information_schema.COLUMNS`. Se a coluna for semanticamente igual, a migration não pode ser marcada manualmente; a reconciliação deve usar um mecanismo que registre a migration apenas depois de provar que o DDL já está representado. Se for diferente, deve-se elaborar uma alteração compatível em cópia do backup, preservando os dados.\n")
lines.append("## Estratégia recomendada\n")
lines.append("1. Preservar o backup existente e gerar uma segunda cópia imutável, com hash SHA-256.\n2. Restaurar o backup numa base de homologação separada, nunca sobre `fkmadeiras`.\n3. Reproduzir o estado físico reportado e executar a reconciliação nessa cópia.\n4. Aplicar as migrations em ordem, começando pela migration ordinal 50, mas interrompendo antes de qualquer DDL conflitante para comparar o objeto existente.\n5. Para cada migration, validar tabelas, colunas, tipos, defaults, índices e foreign keys.\n6. Só após o DDL correspondente estar comprovado, permitir que o migrator registre a migration; nunca inserir, apagar ou editar linhas de `__drizzle_migrations` manualmente.\n7. Comparar contagens de linhas, chaves primárias, somas de controle e lista de objetos antes/depois.\n")
lines.append("\n## Drizzle ou procedimento específico\n")
lines.append("O mecanismo padrão do Drizzle é adequado para um banco que esteja exatamente no prefixo histórico esperado. Neste banco, a coluna existente fora do journal torna arriscado executar o fluxo padrão sem uma etapa de reconciliação idempotente. A recomendação é criar um procedimento controlado de reconciliação em cópia, que use transações quando suportadas, valide cada objeto e delegue o registro final ao comportamento do migrator; não se recomenda alterar o journal para fazer o contador chegar a 73.\n")
lines.append("## Validação pós-reconciliação\n")
lines.append("A validação deverá confirmar: 73 hashes esperados no journal; nenhuma hash divergente; todas as tabelas e colunas de `drizzle/schema.ts`; tipos, nulidade e defaults equivalentes; índices e foreign keys presentes; empresa FK Madeiras preservada; contagens e amostras de dados inalteradas; aplicação iniciando sem erro; e testes de leitura dos módulos Financeiro, Vendas, Estoque, Produção e RH.\n")
lines.append("## Limitações desta etapa\n")
lines.append("Este relatório é análise בלבד: não executa SQL no banco real, não faz dump, restore, migration, reset ou alteração do volume. A auditoria recebida não contém, por si só, todos os detalhes de índices, constraints e tipos das estruturas ausentes; esses detalhes devem ser extraídos na cópia do backup antes da implementação do reconciliador.\n")
OUT.write_text("".join(lines), encoding="utf-8")
print(OUT)
print(f"migrations_analyzed={len(entries)}")
