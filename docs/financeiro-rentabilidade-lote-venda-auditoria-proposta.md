# Rentabilidade da Madeira — auditoria de essência, lote e venda

**Status:** regra comercial confirmada; leitura implementada e validada localmente.
**Escopo deste documento:** registrar a auditoria da cadeia existente entre produção, lote, estoque e venda e a implementação da leitura de rentabilidade que preserva fonte única, múltiplos lotes por venda e cobertura explícita de custo.

> A rentabilidade por venda deve usar a saída física de estoque como evidência do lote consumido. Um item vendido pode ter várias saídas e, portanto, vários lotes; o custo não pode ser substituído por uma média global da essência.[1] [2]

## 1. Resultado da auditoria de integração

A rastreabilidade física necessária já existe. O lote de peça serrada preserva sua origem em um item de produção, um item de serragem de terceiros ou um aproveitamento. A movimentação de estoque serrado registra obrigatoriamente o lote e, quando a saída é por entrega, registra o item do pedido. O item do pedido, por sua vez, aponta para a venda comercial. Logo, a cadeia física disponível é:

```text
produção própria → item produzido → lote próprio → movimentação de saída → item de venda → venda entregue
```

Um mesmo item de venda pode possuir mais de uma movimentação de saída, com lotes distintos. Isto permite somar o custo efetivamente vinculado a cada lote, sem pressupor que toda a venda veio de uma única produção ou de uma única essência.[1] [3]

| Elemento auditado | Evidência existente | Conclusão |
|---|---|---|
| Origem do lote | `lotesPecasSerradas.itemRomaneioId`, `romaneioId`, `tipo` e `propriedade`. | O lote identifica produção própria, terceiro ou aproveitamento. |
| Saída da venda | `movimentacoesEstoqueSerrado.loteId` e `itemVendaId`, com tipo `saida_entrega`. | A entrega pode ser ligada ao lote que reduziu o estoque. |
| Item comercial | `itensOrcamento.orcamentoId`, espécie, medidas, quantidade e valor. | O item identifica o pedido comercial, mas não deve ser usado sozinho para inferir o custo de lote. |
| Múltiplos lotes | Várias movimentações podem apontar ao mesmo item da venda. | A soma deve ocorrer por movimentação/lote, sem escolher um lote arbitrário. |
| Volume da saída | A movimentação armazena quantidade e volume; o lote conserva quantidade produzida e volume. | Para peças, o volume é reconstituído pela quantidade líquida × volume do lote ÷ quantidade produzida, pois movimentos históricos podem registrar volume zero. Aproveitamento usa o volume líquido movimentado. |

As consultas de leitura também confirmaram que há situações históricas sem um vínculo físico suficiente para custo por lote ou com dados de quantidade que não permitem derivação segura de volume. Esses registros não devem receber custo aproximado por regra geral. A interface futura deve classificá-los como **custo de madeira indisponível** e informar o motivo.[1]

## 2. Custo direto da madeira por essência e lote

O custo direto de madeira pode ser rastreado em duas camadas complementares, sem misturá-las:

| Nível | Base de custo proposta | Regra |
|---|---|---|
| **Essência** | Produção própria e consumo de toras da espécie, conforme a regra já publicada de custo real prioritário. | Resume custo, volume produzido, cobertura e custo por m³ de matéria-prima por espécie. |
| **Lote** | Item de produção que originou o lote, mais a distribuição da matéria-prima daquela produção pelos volumes próprios elegíveis. | Cada lote recebe custo unitário de sua produção de origem; movimentações de saída apropriam apenas o volume que saiu. |
| **Venda** | Soma das movimentações de saída vinculadas aos itens da venda. | Uma venda com vários lotes soma os custos individuais de todos os lotes; não usa média global da espécie. |

Para lote próprio, a proposta calcula o custo de matéria-prima da produção pela cadeia de tora consumida. Esse valor é dividido pelo volume próprio elegível da mesma produção e aplicado ao volume do lote que foi efetivamente vendido. Quando a produção tiver matéria-prima por referência de essência, o lote e a venda apresentam a parcela como **referência**, sem apagar a distinção do custo real. Quando não houver base, o custo permanece indisponível.[2] [4]

```text
custo unitário do lote = custo de matéria-prima da produção de origem ÷ volume próprio elegível da produção
custo da saída do lote = volume efetivamente saído × custo unitário do lote
custo de madeira da venda = Σ(custo da saída de cada lote vinculado)
```

Lotes de terceiros e saídas de terceiro não entram no custo de madeira própria nem na margem de venda própria. Se uma venda futura puder consumir lote de terceiro, a leitura deverá mostrá-lo como **origem não própria**, sem atribuir a ele custo de matéria-prima da produção da FK Madeiras.[1]

## 3. Regra confirmada de receita líquida e custos da venda

Os campos comerciais já registram subtotal, total, desconto, frete, abatimento de frete, comissão, taxa principal e taxas adicionais. A regra confirmada esclareceu que o preço informado para a madeira já contém o efeito comercial de frete e comissão: para conhecer o valor realmente disponível para cobrir os custos da madeira, estes componentes devem reduzir a receita bruta da madeira uma única vez.[3]

Consequentemente, frete comercial e comissão **não são novamente somados ao custo**. Eles são deduções da receita da madeira. Impostos e taxas acrescidos ao pedido e cobrados do cliente também não ampliam a receita da madeira; eventual despesa econômica da empresa continua dependente de título financeiro classificado no Centro de Custo adequado, sem inferência a partir da cobrança comercial.

| Componente | Tratamento proposto | Condição de inclusão |
|---|---|---|
| Receita bruta da madeira | `subtotal` da venda. | É a base do preço comercial da madeira, sem somar taxas cobradas ao cliente. |
| Desconto comercial | `desconto`. | Reduz a receita líquida uma vez. |
| Frete comercial | `abatimentoFrete`. | Reduz a receita líquida uma vez; permanece separado do frete de entrada da tora. |
| Comissão | `comissaoCalculada`. | Reduz a receita líquida uma vez; não é adicionada novamente ao custo. |
| Impostos e taxas cobrados | `taxaCalculada` e taxas adicionais. | Permanecem fora da receita da madeira e são apenas informativos até existir uma despesa financeira classificada. |
| Custos comercial/administrativo | Títulos classificados por Centro de Custo na competência da produção de origem. | São aplicados por m³, separadamente de frete e comissão. |

Assim, a comparação solicitada é expressa como: **preço líquido da madeira por m³ = (subtotal − desconto − frete comercial − comissão) ÷ volume negociado**. A margem só é considerada determinada quando todos os lotes físicos da venda têm volume e custo rastreáveis; do contrário, a tela mostra os custos conhecidos, a cobertura e a margem como parcial ou indisponível, sem média global.[1] [2]

## 4. Proposta de apresentação

A tela permanecerá em **Financeiro → Rentabilidade da madeira**. A nova leitura será complementar ao resumo mensal existente e não substituirá o acerto comercial da venda.

| Seção | Conteúdo proposto | Garantia de interpretação |
|---|---|---|
| Resumo por essência | Custo de madeira, volume produzido, volume vendido, cobertura e custo de matéria-prima por m³. | Não rateia industrial ou comercial por espécie sem regra específica. |
| Lotes vendidos | Número do lote, espécie, produção de origem, volume vendido, custo por m³, custo da saída e situação de rastreabilidade. | Cada linha usa a origem física do lote. |
| Venda | Receita líquida, custo de madeira, frete comercial, comissão, impostos/taxas classificados, margem bruta e margem após custos específicos. | Custos comerciais só entram se estiverem explicitamente marcados como custo. |
| Múltiplos lotes | Expansão dentro da venda com todos os lotes e volumes que atenderam cada item. | Não há média global ou ocultação dos lotes. |
| Cobertura e alertas | Venda/lote com custo real, referência ou indisponível; item sem lote; saída com volume não derivável; taxa sem classificação de custo. | A margem fica identificada como parcial quando faltar custo direto de madeira. |

Os custos industriais e comercial/administrativos de competência continuam como análise mensal por Centro de Custo. Eles não serão misturados à margem direta de uma venda, pois o escopo não definiu um direcionador auditável para distribuí-los por pedido, essência ou lote.[2] [4]

## 5. Plano técnico após confirmação

| Ordem | Entrega | Salvaguarda |
|---:|---|---|
| 1 | Consulta de leitura para lote próprio, produção de origem, custo unitário e movimentações de saída por item de venda. | Não cria custo, não muda estoque e não atualiza títulos. |
| 2 | Consolidação por essência do volume produzido, vendido e custo de madeira das saídas. | Não usa lotes de terceiro e não duplica movimentação/volume. |
| 3 | Detalhe por venda com múltiplos lotes, receita líquida, custo de madeira e cobertura. | Margem parcial quando houver custo indisponível. |
| 4 | Campo explícito para determinar se frete, comissão, imposto ou taxa adicional é custo da empresa. | Sem conversão automática de taxas históricas. |
| 5 | Interface de rentabilidade, testes unitários/integrados, revisão visual e documentação. | Mantém fonte única, competência e estruturas existentes. |

## 6. Implementação e validação

Após a confirmação da regra comercial, a tela **Financeiro → Rentabilidade da madeira** passou a apresentar uma seção de margem por venda entregue. A leitura consulta exclusivamente vendas entregues no mês, saídas líquidas de estoque e lotes já existentes. Ela recupera matéria-prima por essência da produção de origem e aplica as taxas industrial e comercial/administrativa por m³ da competência da produção, sem criar tabela, rateio persistido, título ou alteração operacional.

> **Regra aplicada: frete comercial e comissão reduzem uma única vez a receita bruta da madeira; a margem compara a receita líquida por m³ com matéria-prima, produção e comercial/administrativo rastreáveis.**

A validação automatizada cobriu a composição de receita líquida, a exclusão de frete e comissão do custo, lacunas de origem física e a reconstrução de volume para peça, estorno líquido e aproveitamento. A interface foi verificada em desktop e móvel; os testes de tipos, a suíte completa e a geração de produção concluíram sem erro. O aviso de tamanho de chunk do Vite permanece não bloqueante.

## Referências

[1]: ../drizzle/schema.ts "Lotes, movimentações de estoque serrado, vendas e itens comerciais"
[2]: ../server/rentabilidade-financeira.logic.ts "Custo real prioritário e referência de matéria-prima"
[3]: ../server/repositories/vendas.ts "Composição comercial e entrega da venda"
[4]: ../../upload/pasted_content_30.txt "Escopo da rentabilidade por essência, lote e venda"
