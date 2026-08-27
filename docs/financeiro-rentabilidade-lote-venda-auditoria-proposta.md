# Rentabilidade da Madeira — auditoria de essência, lote e venda

**Status:** diagnóstico concluído; implementação aguardando confirmação.  
**Escopo deste documento:** validar a cadeia já existente entre produção, lote, estoque e venda e propor uma leitura de rentabilidade que preserve fonte única, múltiplos lotes por venda e custos específicos de venda. Nenhum dado, schema, cálculo ou tela foi alterado por esta auditoria.

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
| Volume da saída | A movimentação armazena quantidade e volume; o lote conserva quantidade produzida e volume. | O volume efetivo da saída deve priorizar `movimentacao.volume`; quando ausente, pode ser derivado do lote somente se a quantidade produzida for positiva. |

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

## 3. Receita líquida e custos específicos da venda

Os campos comerciais já registram subtotal, total, desconto, frete, abatimento de frete, comissão, taxa principal e taxas adicionais. Eles são suficientes para mostrar a composição comercial da venda, mas a auditoria identificou uma limitação semântica: uma taxa adicional pode ser uma cobrança repassada ao cliente, e um valor de frete pode atuar como abatimento comercial, não necessariamente como despesa paga pela empresa.[3]

Portanto, a implementação não deve pressupor que todo valor chamado de “taxa” ou “frete” é custo da venda. A proposta separa **receita líquida** de **custo específico** e só apropria como custo aquilo que estiver explicitamente identificado como custo da empresa.

| Componente | Tratamento proposto | Condição de inclusão |
|---|---|---|
| Receita da venda | `total` comercial da venda. | Valor efetivamente negociado. |
| Desconto e abatimento de frete | Reduzem a receita líquida quando já aplicados no acerto comercial. | Nunca subtrair novamente como custo. |
| Frete comercial | Custo direto somente se for informado como despesa operacional da entrega. | Deve permanecer separado de frete de entrada da tora. |
| Comissão | Custo direto somente quando a comissão calculada representa valor devido pelo vendedor. | Deve ser indicada como despesa da empresa, não como mero preço de referência. |
| Impostos e taxas | Custo direto apenas quando houver marcação explícita de encargo da empresa. | Taxa cobrada do cliente ou repassada não reduz a margem. |

Como as taxas adicionais atuais não armazenam uma classificação explícita de **custo da empresa**, a alternativa segura é acrescentar esse atributo ao lançar/editar taxa no futuro, preservando o comportamento e os valores históricos. Valores históricos sem a classificação permanecem exibidos como **sem tratamento de custo definido**, em vez de serem reprocessados ou deduzidos automaticamente.[3]

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

## 6. Confirmação solicitada

A auditoria confirma que a cadeia física está integrada para a leitura de custo por lote e por venda, inclusive para múltiplos lotes. A implementação depende de confirmação da regra comercial abaixo:

> **Confirmar que frete comercial, comissão, imposto e taxa só entram na margem da venda quando estiverem explicitamente marcados como custo da empresa; valores históricos sem essa marcação permanecerão fora da margem até revisão manual.**

Essa confirmação permite implementar a proposta sem supor que toda taxa cobrada do cliente, desconto ou abatimento comercial seja um custo interno.

## Referências

[1]: ../drizzle/schema.ts "Lotes, movimentações de estoque serrado, vendas e itens comerciais"
[2]: ../server/rentabilidade-financeira.logic.ts "Custo real prioritário e referência de matéria-prima"
[3]: ../server/repositories/vendas.ts "Composição comercial e entrega da venda"
[4]: ../../upload/pasted_content_30.txt "Escopo da rentabilidade por essência, lote e venda"
