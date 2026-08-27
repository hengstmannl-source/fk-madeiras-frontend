# FINANCEIRO V2 — Etapa 6F: matéria-prima por consumo físico e estimativa identificada

**Status:** implementado após aprovação explícita.  
**Escopo:** leitura de custo da matéria-prima pela tora efetivamente consumida na produção própria, com estimativa documentada por essência somente para tora sem romaneio de entrada.  
**Preservação:** nenhum dado histórico, valor de plaqueta, romaneio, título financeiro, baixa, conciliação, estoque ou schema foi modificado por esta etapa.

> Esta leitura é gerencial e auditável. Uma estimativa melhora a cobertura do indicador, mas não transforma a origem em custo histórico rastreável nem substitui uma conferência contábil quando aplicável.

## 1. Regra econômica implantada

A fonte econômica exclusiva da matéria-prima passou a ser a cadeia física `romaneio de entrada → plaqueta → consumo em produção própria`. Cada tora consumida apropria seu próprio custo de origem pela multiplicação do volume consumido pelo valor por metro cúbico da plaqueta. O frete de entrada segue a mesma tora e usa o frete por metro cúbico do respectivo romaneio de entrada.[1] [2]

O título financeiro derivado do romaneio de carga continua sendo o documento de Contas a Pagar, baixas, conciliação e Fluxo de Caixa. Ele é explicitamente excluído da Rentabilidade da Madeira para que uma compra de tora não seja somada novamente quando a tora for consumida.[3]

| Elemento | Fonte usada na rentabilidade | Tratamento |
|---|---|---|
| Valor da tora com origem | Plaqueta consumida, com `romaneioCargaId` e `valorMetroCubico` válido. | Rastreável: `volume consumido × valor/m³`. |
| Frete de entrada | Romaneio de entrada da mesma plaqueta. | Rastreável: `volume consumido × frete/m³`. |
| Tora sem romaneio de entrada | Média ponderada por volume das plaquetas de **mesma essência** que possuem preço de origem. | Estimativa identificada; não altera a plaqueta nem gera título. |
| Frete de tora sem romaneio | Não é estimado. | Permanece R$ 0,00 no componente estimado e é exposto no detalhe. |
| Tora sem referência da mesma essência | Nenhuma apropriação monetária. | Permanece sem referência e fora do custo até existir base documental. |
| Título de romaneio de carga | Nunca é componente adicional de matéria-prima. | Excluído, preservado como documento financeiro. |

## 2. Estimativa por essência e volume

A regra solicitada usa a essência normalizada — sem acento, com espaços normalizados e sem distinção de maiúsculas/minúsculas — para localizar uma base comparável. O preço de referência é uma média **ponderada pelo volume físico da plaqueta de origem**, evitando que uma tora pequena tenha o mesmo peso de uma tora de maior volume.[2]

```text
preço médio estimado da essência = Σ(volume da plaqueta de origem × valor/m³) ÷ Σ(volume da plaqueta de origem)

valor estimado da tora consumida = volume consumido × preço médio estimado da mesma essência
```

A condição para estimar é restrita: a tora deve não possuir romaneio de entrada e deve existir ao menos uma referência de preço com volume e valor positivos para sua essência. Se a tora possui romaneio, mas o preço de origem está inválido, ou se não há referência da mesma essência, ela não recebe média substitutiva. Dessa forma, o sistema não mascara lacunas de origem nem cria estimativas amplas por fornecedor, data, categoria ou texto livre.[2]

## 3. Competência, produção própria e aproveitamento

A competência da matéria-prima é a data do romaneio de **produção confirmada**, que representa o consumo físico da tora. A data de entrada, o vencimento, o pagamento e a baixa do título não deslocam esse custo entre competências. A consulta considera apenas produções próprias confirmadas; serragem de terceiros, lotes de terceiros e volumes de terceiros ficam fora da apropriação.[1] [3]

O denominador de custo unitário é a soma dos itens de produção próprios confirmados. O aproveitamento só entra uma vez, quando o próprio romaneio registrou a opção `incluirAproveitamentoNoRendimento`. Não há multiplicação por percentual de rendimento ou reutilização de volume de lote como nova produção.[2]

| Indicador exibido | Composição |
|---|---|
| Toras e frete rastreáveis | Custo da tora com origem + frete de entrada rastreável. |
| Valor estimado por essência | Apenas valor da tora sem romaneio, quando existe referência da mesma essência. |
| Sem referência de preço | Volume sem base comparável; permanece fora do custo monetário. |
| Custo de matéria-prima | Rastreável + estimado por essência, sempre discriminados. |
| Cobertura rastreável | Volume com origem completa ÷ volume de tora consumida. |
| Cobertura com estimativa | Volume rastreável + estimado ÷ volume de tora consumida. |
| Custo por m³ da produção | Custo da produção ÷ volume elegível de peças, com aproveitamento somente quando marcado. |

## 4. Interface e rastreabilidade

A página **Financeiro → Rentabilidade da madeira** continua sendo a única tela de leitura por competência. Ela recebeu um painel de matéria-prima com valores rastreáveis, estimados e sem referência, além de cobertura física. A tabela **Custeio por produção** permite expandir cada romaneio e visualizar plaqueta, essência, volume, situação do custo, referência da estimativa, valor de tora, frete e total apropriado.[4]

Os estados são apresentados com distinção visual e textual:

| Situação | Rótulo na linha | Base apresentada |
|---|---|---|
| Rastreável | `Rastreável` | Número do romaneio de entrada e valor efetivo por m³. |
| Estimado | `Estimado por essência` | Média ponderada por m³, quantidade de plaquetas e espécie usada como referência. |
| Sem base | `Sem referência` | Motivo explícito; nenhum valor é inventado. |

O painel de qualidade também mostra títulos sem Centro de Custo, títulos sem competência, notas de diesel excluídas e títulos de romaneio de carga excluídos. Assim, a regra de fonte única permanece verificável na própria leitura, sem ocultar documentos financeiros que continuam válidos para suas funções originais.[3] [4]

## 5. Cobertura observada na implantação

Na competência validada durante a implementação, a tela apresentou **213 toras consumidas**, cobertura física rastreável de **91,7%** e cobertura de **100%** após a estimativa específica por essência. O painel exibiu separadamente R$ 142.142,94 rastreáveis, R$ 12.001,45 estimados e R$ 154.144,39 de matéria-prima composta. Esses números são uma leitura do período validado; não foram gravados nos registros de origem.[4]

## 6. Validação realizada

| Camada | Resultado |
|---|---|
| Lógica pura | Testes incluem tora e frete rastreáveis, estimativa ponderada por essência, ausência de referência, aproveitamento desmarcado, exclusão de títulos de romaneio e indicador sem produção. |
| Regressão completa | `pnpm vitest run` aprovado: **73 arquivos e 374 testes**. |
| TypeScript | `pnpm run check` aprovado. |
| Build de produção | `pnpm run build` aprovado. O aviso de chunk Vite acima de 500 kB permanece não bloqueante. |
| Revisão visual | Página validada em desktop e viewport móvel de 390 px, incluindo cartões, cobertura, tabela de custeio, alerta de qualidade e rolagem horizontal apenas dentro das tabelas extensas. |
| Persistência | Não houve migration nem comando de escrita no banco nesta etapa. |

A auditoria final, executada somente em leitura, confirmou **52 títulos financeiros** preservados e ainda sem Centro de Custo, dos quais **17** possuem origem `romaneio_carga` e também permanecem sem classificação. Foram mantidas **16 produções confirmadas**, **213 consumos de tora** e **203,772182 m³** de volume consumido. A implementação não grava a estimativa na origem: ela é calculada na consulta de rentabilidade e identificada no retorno.[1] [2]

## 7. Limites preservados

Esta etapa não reclassifica títulos, não altera romaneios ou plaquetas, não estima frete, não cria lançamento financeiro, não cria novo rateio e não usa o pagamento como competência. Também não altera as regras de diesel, folha, comissão, frete comercial, taxas ou custos de terceiros. Qualquer evolução dessas regras exige uma nova decisão de escopo.

## Referências

[1]: ../server/repositories/rentabilidadeFinanceira.ts "Consulta de rentabilidade: produção, consumo, plaqueta e romaneio"
[2]: ../server/rentabilidade-financeira.logic.ts "Lógica pura de custeio físico, referência por essência e consolidação"
[3]: ../server/repositories/financeiro.ts "Título derivado de romaneio de carga e ciclo financeiro canônico"
[4]: ../client/src/pages/RentabilidadeMadeiraPage.tsx "Interface de cobertura, custeio por produção e detalhe rastreável"
