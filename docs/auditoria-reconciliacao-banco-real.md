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

## Estratégia recomendada

Primeiro, comparar o relatório com o backup já existente e classificar cada objeto como `EXISTS` ou `MISSING`. Nenhum comando de reconciliação deve ser gerado antes dessa classificação.

Se um objeto já existir com a mesma definição, a estratégia preferencial será tornar a aplicação da alteração **idempotente no código da migration**, sem remover dados e sem editar o journal para fingir execução. Se um objeto estiver ausente, ele deverá ser aplicado pela migration correspondente. Diferenças de tipo, nulidade, enum, default ou índice exigem pausa e revisão específica; não devem ser corrigidas automaticamente.

As migrations históricas só devem ser modificadas depois de a matriz física do banco ser conhecida e depois de a mesma sequência ser testada em uma cópia isolada do backup. O banco `fk-madeiras-mysql` não deve ser usado como ambiente de teste para essa validação.

## Próxima evidência necessária

A reconciliação ainda não está concluída. É necessário obter o arquivo `auditoria-banco-real.txt` produzido pelo comando read-only. Com esse relatório será possível informar, migration por migration, quais objetos já existem, quais faltam e qual alteração idempotente, se alguma, pode ser preparada sem apagar ou alterar dados de negócio.
