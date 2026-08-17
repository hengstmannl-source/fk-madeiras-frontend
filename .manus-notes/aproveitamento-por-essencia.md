# Mapeamento — Aproveitamento por Essência

- As toras da Produção Diária e da Serragem de Terceiros já possuem `madeiraNome` e volume.
- As peças produzidas dos dois fluxos já possuem `madeiraNome`, dimensões, quantidade e volume calculável.
- Os serviços persistem somente os totais gerais; o resumo por essência pode ser derivado de toras e itens, sem alterar o esquema de banco.
- A regra reutilizável deve somar volume de toras e volume produzido por essência, calculando `volumeProduzido / volumeToras × 100` em cada grupo.
- O resumo geral deve permanecer como consolidado independente, enquanto a interface mostrará os grupos por essência nos dois diálogos de produção.
