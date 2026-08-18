# Validação visual de relatórios PDF

## 18/08/2026 — Produção Diária

A página de Produção carregou com dois romaneios diários reais, cada um com ação **PDF**, confirmando que há documentos disponíveis para o fluxo de pré-visualização. A lista exibe os volumes de toras, a contagem de peças e o rendimento por romaneio. A validação funcional automatizada cobre a abertura do diálogo e a confirmação do download; a renderização da grade compacta é coberta pelo cenário de múltiplas toras e peças no teste do gerador PDF.

Ao acionar **PDF** no romaneio `ROM-120001`, o navegador abriu um diálogo modal com o título do romaneio, a mensagem de conferência, a área de visualização integrada e os controles separados **Voltar** e **Confirmar download**. Nenhum download foi iniciado ao abrir a prévia.

Após o carregamento, o visualizador integrado exibiu o romaneio em **duas páginas**. A primeira permanece dedicada às toras, e a segunda reúne a nova grade de peças por bitola com a consolidação prevista, mantendo o comando de download separado da visualização. O diálogo foi fechado pelo botão **Voltar**, sem baixar o arquivo.
