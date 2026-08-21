# Verificação de paginação do PDF de vendas

- PDF de referência analisado: `venda-VND-090001.pdf`.
- Problema identificado: a primeira página mantinha apenas o cabeçalho e os dados do cliente, enquanto a grade, o resumo de peças e o acerto comercial eram renderizados na segunda.
- Correção implementada: o resumo de peças e o acerto comercial são renderizados antes da quebra obrigatória; o romaneio em grade inicia em página exclusiva posterior.
- A rota autenticada da venda `VND-090001` foi aberta após a alteração. O visualizador do navegador não disponibilizou captura, portanto a confirmação estrutural foi coberta por teste de página e a geração real foi acionada com sucesso.
