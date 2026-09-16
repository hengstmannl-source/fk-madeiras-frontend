# Auditoria de reconciliação do banco local

## Escopo

Este documento trata exclusivamente da reconciliação do banco MySQL local existente com o histórico atual do Drizzle. Nenhum `DROP`, reset, restauração ou alteração de dados deve ser executado como parte desta auditoria.

O banco limpo já foi validado separadamente: as 73 migrations executaram em MySQL 8.4 vazio, foram registradas em `__drizzle_migrations`, foram criadas 86 tabelas e as 9 tabelas essenciais foram encontradas.

## Diagnóstico preliminar

O erro em `0049_steep_eddie_brock.sql` corresponde à **migration ordinal 50**, porque o journal usa índice zero: `idx = 49` representa a 50.ª migration. Portanto, a janela ordinal 50–73 corresponde aos arquivos `drizzle/0049_steep_eddie_brock.sql` até `drizzle/0072_dashing_changeling.sql`.

O banco real possui 49 registros no journal, mas a coluna `folhasPagamentoRh.tituloEncargosFinanceiroId` já existe fisicamente. Isso demonstra divergência entre o histórico lógico e o estado físico: a alteração foi aplicada anteriormente, mas o registro correspondente não foi persistido no journal. Não é seguro resolver isso apagando, inserindo ou editando manualmente registros de `__drizzle_migrations` sem antes conhecer todos os objetos físicos.

## Procedimento de diagnóstico read-only

O arquivo `scripts/auditar-banco-real.sh` executa `scripts/auditar-banco-real.sql` dentro do container informado por `MYSQL_CONTAINER` ou, por padrão, `fk-madeiras-mysql`. O SQL usa apenas `SELECT` e `information_schema`; não contém operações de escrita, DDL, transações de alteração ou comandos de limpeza.

Executar no WSL, na raiz do projeto:

```bash
./scripts/auditar-banco-real.sh auditoria-banco-real.txt
```

O relatório deve ser preservado. Ele contém o resumo do journal, os registros existentes, o estado físico de cada tabela/coluna/índice esperado pelas migrations ordinais 50–73 e o inventário estrutural do banco. Não enviar senhas nem o arquivo `.env`.

## Evidência do backup recebido

O arquivo recebido é um dump MySQL 8.4.11 em UTF-16LE com CRLF, de 174.578 bytes, SHA-256 `41cdb04850fbe93316671d5d9085fa7c055096b5c9a196fdfcd47ef35f63fd97`. O dump contém `CREATE DATABASE fkmadeiras` e `USE fkmadeiras`; o restaurador de homologação remove somente essas duas diretivas da cópia temporária antes da importação, impedindo qualquer apontamento para o banco real. O backup contém 49 linhas no journal e a definição física de `folhasPagamentoRh.tituloEncargosFinanceiroId`.

A migration ordinal 50, arquivo `0049_steep_eddie_brock.sql`, não cria a coluna: ela adiciona exclusivamente a constraint única `folhasPagamentoRh_tituloEncargosFinanceiroId_unique`. O DDL do backup mostra a coluna, mas não essa constraint. Portanto, nesta cópia, o tratamento especial correto é executar a migration 0049 normalmente e verificar que a constraint foi criada; não é necessário marcar a migration manualmente nem alterar o journal.

## Estratégia recomendada

Primeiro, comparar o relatório com o backup já existente e classificar cada objeto como `EXISTS` ou `MISSING`. Nenhum comando de reconciliação deve ser gerado antes dessa classificação.

Se um objeto já existir com a mesma definição, a estratégia preferencial será tornar a aplicação da alteração **idempotente no código da migration**, sem remover dados e sem editar o journal para fingir execução. Se um objeto estiver ausente, ele deverá ser aplicado pela migration correspondente. Diferenças de tipo, nulidade, enum, default ou índice exigem pausa e revisão específica; não devem ser corrigidas automaticamente.

As migrations históricas só devem ser modificadas depois de a matriz física do banco ser conhecida e depois de a mesma sequência ser testada em uma cópia isolada do backup. O banco `fk-madeiras-mysql` não deve ser usado como ambiente de teste para essa validação.

## Artefatos de homologação

`docker-compose.homologacao.yml` define somente `fk-madeiras-homologacao-mysql`, porta 3309 e volume `fk_madeiras_homologacao_mysql`. `scripts/restaurar-homologacao.sh` converte o dump temporariamente, remove as diretivas do banco original e restaura a cópia. `scripts/testar-reconciliacao-homologacao.sh` captura baseline, executa o migrator duas vezes, verifica 73 migrations e guarda o inventário antes/depois. Nenhum desses artefatos referencia o container ou o volume do ambiente principal.

## Próxima evidência necessária

A reconciliação ainda não está concluída. É necessário obter o arquivo `auditoria-banco-real.txt` produzido pelo comando read-only. Com esse relatório será possível informar, migration por migration, quais objetos já existem, quais faltam e qual alteração idempotente, se alguma, pode ser preparada sem apagar ou alterar dados de negócio.

## Execução autorizada somente em homologação

No WSL, a partir da raiz do projeto, usar o caminho do backup recebido:

```bash
BACKUP=/caminho/para/backup-fkmadeiras-atual.sql
./scripts/restaurar-homologacao.sh "$BACKUP"
./scripts/testar-reconciliacao-homologacao.sh
```

O primeiro comando sobe apenas `fk-madeiras-homologacao-mysql`, restaura no banco `fkmadeiras_homologacao` e utiliza o volume `fk_madeiras_homologacao_mysql`. O segundo executa `pnpm drizzle-kit migrate` duas vezes no runner `fk-madeiras-homologacao-runner`; a primeira aplica as migrations pendentes e a segunda deve ser um no-op bem-sucedido. Os artefatos `artifacts/homologacao-baseline.txt` e `artifacts/homologacao-final.txt` devem ser preservados para comparar journal, tabelas e contagens.

Não executar `docker compose -f docker-compose.local.yml`, não usar `fk-madeiras-mysql`, não usar `fk_madeiras_mysql` e não apontar `DATABASE_URL` para `fkmadeiras` nesta etapa.
