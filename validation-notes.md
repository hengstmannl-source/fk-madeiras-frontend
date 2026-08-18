# Registo de validação visual

## Nova Venda — disponibilidade, modelos e madeira

- Validada a rota `/orcamentos/novo` em resolução desktop.
- O formulário apresenta a lista padronizada de **Madeira**, o controlo **Aplicar modelo...** e a ação **Guardar medida**.
- A grelha apresenta vários comprimentos, quantidades e a área de disponibilidade de estoque junto de cada linha.
- A interface mantém o resumo da venda visível ao lado do romaneio em tela ampla.
- A tentativa inicial na rota `/vendas/nova` retornou 404; a rota operacional correta permanece `/orcamentos/novo`.

## Produção — aproveitamento manual

- A tela `/producao` carregou os indicadores, o alerta de variação e os romaneios existentes em resolução desktop.
- O romaneio diário exibido possui 8 toras, 10,066 m³ de matéria-prima, 406 peças e 6,253 m³ de produção romaneada.
- A validação do painel de aproveitamento será feita pelo diálogo de edição, sem confirmar ou alterar nenhum registro real durante a inspeção.
- A edição do romaneio existente abriu corretamente na etapa de Peças produzidas, preservando a grade de medidas sem disparar qualquer salvamento.
- O painel complementar permanece abaixo das linhas de comprimentos; a inspeção visual continuará somente por navegação não destrutiva.
