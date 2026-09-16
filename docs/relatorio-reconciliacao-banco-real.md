# Relatório técnico — reconciliação do banco real
## Escopo e conclusão preliminar
O banco real reportado contém 49 registros em `__drizzle_migrations`, enquanto o código atual possui 73 migrations. A auditoria física marca como ausentes praticamente todos os objetos esperados da janela ordinal 50–73. Há, contudo, pelo menos uma evidência de aplicação parcial: `folhasPagamentoRh.tituloEncargosFinanceiroId` existe fisicamente, embora a migration correspondente não esteja registrada no journal. Portanto, não é seguro executar diretamente `drizzle-kit migrate` no banco real sem primeiro testar uma reconciliação em cópia do backup e sem explicar essa divergência.
## Regra de numeração
O journal do Drizzle utiliza `id` ordinal começando em 1, enquanto os arquivos deste repositório começam em `0000`. Assim, a migration ordinal 50 corresponde ao arquivo `0049_steep_eddie_brock.sql`, e a ordinal 73 corresponde ao arquivo `0072_dashing_changeling.sql`.
## Inventário das migrations 0049–0072
| Ordinal no journal | Arquivo | Operações | Estado físico reportado | Risco preliminar |
|---:|---|---|---|---|
| 50 | `0049_steep_eddie_brock.sql` | ALTER TABLE | parcial: coluna folhasPagamentoRh.tituloEncargosFinanceiroId existe, mas migration ordinal 50 não está no journal | alto: o objeto existe fora do journal; executar cegamente pode falhar por duplicidade |
| 51 | `0050_demonic_caretaker.sql` | CREATE TABLE | ausente segundo o relatório recebido: objetos esperados marcados MISSING | alto: precisa verificar tipos, defaults, índices e FKs; presença/ausência simples não basta |
| 52 | `0051_robust_darwin.sql` | ALTER TABLE | ausente segundo o relatório recebido: objetos esperados marcados MISSING | alto: precisa verificar tipos, defaults, índices e FKs; presença/ausência simples não basta |
| 53 | `0052_dry_mysterio.sql` | CREATE TABLE | ausente segundo o relatório recebido: objetos esperados marcados MISSING | alto: precisa verificar tipos, defaults, índices e FKs; presença/ausência simples não basta |
| 54 | `0053_tan_the_phantom.sql` | ALTER TABLE | ausente segundo o relatório recebido: objetos esperados marcados MISSING | alto: precisa verificar tipos, defaults, índices e FKs; presença/ausência simples não basta |
| 55 | `0054_famous_synch.sql` | ALTER TABLE | ausente segundo o relatório recebido: objetos esperados marcados MISSING | alto: precisa verificar tipos, defaults, índices e FKs; presença/ausência simples não basta |
| 56 | `0055_daffy_garia.sql` | ALTER TABLE | ausente segundo o relatório recebido: objetos esperados marcados MISSING | alto: precisa verificar tipos, defaults, índices e FKs; presença/ausência simples não basta |
| 57 | `0056_magical_ben_grimm.sql` | CREATE TABLE | ausente segundo o relatório recebido: objetos esperados marcados MISSING | alto: precisa verificar tipos, defaults, índices e FKs; presença/ausência simples não basta |
| 58 | `0057_plain_giant_man.sql` | CREATE TABLE | ausente segundo o relatório recebido: objetos esperados marcados MISSING | alto: precisa verificar tipos, defaults, índices e FKs; presença/ausência simples não basta |
| 59 | `0058_aspiring_peter_parker.sql` | ALTER TABLE | ausente segundo o relatório recebido: objetos esperados marcados MISSING | alto: precisa verificar tipos, defaults, índices e FKs; presença/ausência simples não basta |
| 60 | `0059_polite_hardball.sql` | CREATE TABLE | ausente segundo o relatório recebido: objetos esperados marcados MISSING | alto: precisa verificar tipos, defaults, índices e FKs; presença/ausência simples não basta |
| 61 | `0060_broken_crusher_hogan.sql` | CREATE TABLE | ausente segundo o relatório recebido: objetos esperados marcados MISSING | alto: precisa verificar tipos, defaults, índices e FKs; presença/ausência simples não basta |
| 62 | `0061_mixed_mulholland_black.sql` | ALTER TABLE | ausente segundo o relatório recebido: objetos esperados marcados MISSING | alto: precisa verificar tipos, defaults, índices e FKs; presença/ausência simples não basta |
| 63 | `0062_glossy_peter_parker.sql` | ALTER TABLE | ausente segundo o relatório recebido: objetos esperados marcados MISSING | alto: precisa verificar tipos, defaults, índices e FKs; presença/ausência simples não basta |
| 64 | `0063_colossal_rocket_racer.sql` | ALTER TABLE | ausente segundo o relatório recebido: objetos esperados marcados MISSING | alto: precisa verificar tipos, defaults, índices e FKs; presença/ausência simples não basta |
| 65 | `0064_yielding_lady_mastermind.sql` | CREATE TABLE | ausente segundo o relatório recebido: objetos esperados marcados MISSING | alto: precisa verificar tipos, defaults, índices e FKs; presença/ausência simples não basta |
| 66 | `0065_foamy_rumiko_fujikawa.sql` | CREATE TABLE | ausente segundo o relatório recebido: objetos esperados marcados MISSING | alto: precisa verificar tipos, defaults, índices e FKs; presença/ausência simples não basta |
| 67 | `0066_premium_darkstar.sql` | CREATE TABLE | ausente segundo o relatório recebido: objetos esperados marcados MISSING | alto: precisa verificar tipos, defaults, índices e FKs; presença/ausência simples não basta |
| 68 | `0067_black_abomination.sql` | ALTER TABLE | ausente segundo o relatório recebido: objetos esperados marcados MISSING | alto: precisa verificar tipos, defaults, índices e FKs; presença/ausência simples não basta |
| 69 | `0068_omniscient_quasimodo.sql` | CREATE TABLE | ausente segundo o relatório recebido: objetos esperados marcados MISSING | alto: precisa verificar tipos, defaults, índices e FKs; presença/ausência simples não basta |
| 70 | `0069_sturdy_electro.sql` | ALTER TABLE | ausente segundo o relatório recebido: objetos esperados marcados MISSING | alto: precisa verificar tipos, defaults, índices e FKs; presença/ausência simples não basta |
| 71 | `0070_short_tana_nile.sql` | CREATE TABLE | ausente segundo o relatório recebido: objetos esperados marcados MISSING | alto: precisa verificar tipos, defaults, índices e FKs; presença/ausência simples não basta |
| 72 | `0071_optimal_ghost_rider.sql` | ALTER TABLE | ausente segundo o relatório recebido: objetos esperados marcados MISSING | alto: precisa verificar tipos, defaults, índices e FKs; presença/ausência simples não basta |
| 73 | `0072_dashing_changeling.sql` | ALTER TABLE | ausente segundo o relatório recebido: objetos esperados marcados MISSING | alto: precisa verificar tipos, defaults, índices e FKs; presença/ausência simples não basta |

## O que pode ser concluído a partir do relatório recebido
A janela posterior ao journal não está simplesmente atrasada: o banco possui um estado parcialmente divergente. A existência da coluna da migration `0049` sem o respectivo registro indica que uma execução anterior pode ter sido interrompida após o DDL, que o journal pode ter sido perdido/incompleto, ou que a alteração foi feita por outro procedimento. Não se deve editar o journal para corrigir esse caso.
As migrations `0050`–`0072` parecem necessárias para o código atual, porque introduzem estruturas referenciadas por rotas e pelo schema moderno. Porém, o relatório atual é um inventário de presença; ele não demonstra igualdade de tipo, nulidade, default, collation, foreign keys ou expressão de índices. Por isso, a lista de objetos `MISSING` é suficiente para indicar divergência, mas não para autorizar a aplicação no banco real.
## Tratamento especial
O primeiro tratamento especial é a migration ordinal 50 (`0049_steep_eddie_brock`): antes de qualquer execução, deve-se comparar o DDL esperado com `SHOW CREATE TABLE folhasPagamentoRh` e com a definição da coluna em `information_schema.COLUMNS`. Se a coluna for semanticamente igual, a migration não pode ser marcada manualmente; a reconciliação deve usar um mecanismo que registre a migration apenas depois de provar que o DDL já está representado. Se for diferente, deve-se elaborar uma alteração compatível em cópia do backup, preservando os dados.
## Estratégia recomendada
1. Preservar o backup existente e gerar uma segunda cópia imutável, com hash SHA-256.
2. Restaurar o backup numa base de homologação separada, nunca sobre `fkmadeiras`.
3. Reproduzir o estado físico reportado e executar a reconciliação nessa cópia.
4. Aplicar as migrations em ordem, começando pela migration ordinal 50, mas interrompendo antes de qualquer DDL conflitante para comparar o objeto existente.
5. Para cada migration, validar tabelas, colunas, tipos, defaults, índices e foreign keys.
6. Só após o DDL correspondente estar comprovado, permitir que o migrator registre a migration; nunca inserir, apagar ou editar linhas de `__drizzle_migrations` manualmente.
7. Comparar contagens de linhas, chaves primárias, somas de controle e lista de objetos antes/depois.

## Drizzle ou procedimento específico
O mecanismo padrão do Drizzle é adequado para um banco que esteja exatamente no prefixo histórico esperado. Neste banco, a coluna existente fora do journal torna arriscado executar o fluxo padrão sem uma etapa de reconciliação idempotente. A recomendação é criar um procedimento controlado de reconciliação em cópia, que use transações quando suportadas, valide cada objeto e delegue o registro final ao comportamento do migrator; não se recomenda alterar o journal para fazer o contador chegar a 73.
## Validação pós-reconciliação
A validação deverá confirmar: 73 hashes esperados no journal; nenhuma hash divergente; todas as tabelas e colunas de `drizzle/schema.ts`; tipos, nulidade e defaults equivalentes; índices e foreign keys presentes; empresa FK Madeiras preservada; contagens e amostras de dados inalteradas; aplicação iniciando sem erro; e testes de leitura dos módulos Financeiro, Vendas, Estoque, Produção e RH.
## Limitações desta etapa
Este relatório é análise בלבד: não executa SQL no banco real, não faz dump, restore, migration, reset ou alteração do volume. A auditoria recebida não contém, por si só, todos os detalhes de índices, constraints e tipos das estruturas ausentes; esses detalhes devem ser extraídos na cópia do backup antes da implementação do reconciliador.
