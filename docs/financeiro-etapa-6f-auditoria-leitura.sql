-- FINANCEIRO V2 — Etapa 6F
-- Registro das consultas de auditoria executadas somente em leitura em 27/08/2026.
-- Este arquivo não é uma migration e não deve ser executado como alteração de schema.

-- 1. Cobertura de custo de matéria-prima das toras consumidas em produções próprias confirmadas.
SELECT
  COUNT(irt.id) AS torasConsumidas,
  ROUND(COALESCE(SUM(irt.volume), 0), 6) AS volumeConsumidoM3,
  ROUND(COALESCE(SUM(CASE WHEN p.romaneioCargaId IS NOT NULL AND p.valorMetroCubico > 0 AND rc.id IS NOT NULL THEN irt.volume ELSE 0 END), 0), 6) AS volumeCobertoM3,
  ROUND(COALESCE(SUM(CASE WHEN p.romaneioCargaId IS NULL OR p.valorMetroCubico <= 0 OR rc.id IS NULL THEN irt.volume ELSE 0 END), 0), 6) AS volumeSemCustoM3,
  ROUND(COALESCE(SUM(CASE WHEN p.romaneioCargaId IS NOT NULL AND p.valorMetroCubico > 0 AND rc.id IS NOT NULL THEN irt.volume * p.valorMetroCubico ELSE 0 END), 0), 2) AS custoTorasRastreavel,
  ROUND(COALESCE(SUM(CASE WHEN p.romaneioCargaId IS NOT NULL AND p.valorMetroCubico > 0 AND rc.id IS NOT NULL THEN irt.volume * rc.fretePorMetroCubico ELSE 0 END), 0), 2) AS freteEntradaRastreavel,
  ROUND(CASE WHEN COALESCE(SUM(irt.volume), 0) > 0 THEN 100 * COALESCE(SUM(CASE WHEN p.romaneioCargaId IS NOT NULL AND p.valorMetroCubico > 0 AND rc.id IS NOT NULL THEN irt.volume ELSE 0 END), 0) / SUM(irt.volume) ELSE 0 END, 2) AS coberturaVolumePercentual,
  COUNT(DISTINCT irt.romaneioId) AS producoesComConsumo
FROM itensRomaneioToras irt
INNER JOIN romaneiosProducao rp ON rp.id = irt.romaneioId AND rp.empresaId = irt.empresaId AND rp.estado = 'confirmado'
LEFT JOIN plaquetas p ON p.id = irt.plaquetaId AND p.empresaId = irt.empresaId
LEFT JOIN romaneiosCargaToras rc ON rc.id = p.romaneioCargaId AND rc.empresaId = p.empresaId
WHERE irt.empresaId = 1;

-- 2. Integridade da ligação romaneio de entrada ↔ título financeiro derivado.
SELECT
  COUNT(rc.id) AS romaneiosEntrada,
  COUNT(tf.id) AS titulosFinanceirosVinculados,
  SUM(CASE WHEN tf.id IS NULL THEN 1 ELSE 0 END) AS romaneiosSemTituloVinculado,
  ROUND(COALESCE(SUM(rc.valorTotal), 0), 2) AS valorTotalRomaneios,
  ROUND(COALESCE(SUM(tf.valorOriginal), 0), 2) AS valorTitulosVinculados,
  SUM(CASE WHEN tf.centroCustoId IS NOT NULL THEN 1 ELSE 0 END) AS titulosComCentro,
  SUM(CASE WHEN tf.origem = 'romaneio_carga' THEN 1 ELSE 0 END) AS titulosOrigemRomaneioCarga
FROM romaneiosCargaToras rc
LEFT JOIN titulosFinanceiros tf ON tf.empresaId = rc.empresaId AND tf.romaneioCargaId = rc.id
WHERE rc.empresaId = 1;

-- 3. Consistência entre itens produzidos e lotes próprios de produção.
SELECT
  (SELECT COUNT(*) FROM itensRomaneioProducao irp INNER JOIN romaneiosProducao rp ON rp.id = irp.romaneioId AND rp.empresaId = irp.empresaId WHERE irp.empresaId = 1 AND rp.estado = 'confirmado') AS itensProducaoConfirmados,
  (SELECT ROUND(COALESCE(SUM(irp.volume), 0), 6) FROM itensRomaneioProducao irp INNER JOIN romaneiosProducao rp ON rp.id = irp.romaneioId AND rp.empresaId = irp.empresaId WHERE irp.empresaId = 1 AND rp.estado = 'confirmado') AS volumeItensProducaoM3,
  (SELECT COUNT(*) FROM lotesPecasSerradas l INNER JOIN romaneiosProducao rp ON rp.id = l.romaneioId AND rp.empresaId = l.empresaId WHERE l.empresaId = 1 AND l.propriedade = 'proprio' AND l.tipo = 'peca' AND rp.estado = 'confirmado') AS lotesPecasConfirmados,
  (SELECT ROUND(COALESCE(SUM(l.volume), 0), 6) FROM lotesPecasSerradas l INNER JOIN romaneiosProducao rp ON rp.id = l.romaneioId AND rp.empresaId = l.empresaId WHERE l.empresaId = 1 AND l.propriedade = 'proprio' AND l.tipo = 'peca' AND rp.estado = 'confirmado') AS volumeLotesPecasM3;

-- 4. Classificação explícita de lacunas de origem das toras consumidas.
SELECT
  CASE
    WHEN p.romaneioCargaId IS NULL THEN 'sem_romaneio_de_entrada'
    WHEN p.valorMetroCubico IS NULL OR p.valorMetroCubico <= 0 THEN 'sem_valor_da_tora_por_m3'
    WHEN rc.id IS NULL THEN 'romaneio_de_entrada_nao_localizado'
    WHEN rc.fretePorMetroCubico IS NULL THEN 'sem_frete_de_entrada_registrado'
    ELSE 'custo_de_origem_completo'
  END AS situacao,
  COUNT(*) AS toras,
  ROUND(SUM(irt.volume), 6) AS volumeM3
FROM itensRomaneioToras irt
INNER JOIN romaneiosProducao rp ON rp.id = irt.romaneioId AND rp.empresaId = irt.empresaId AND rp.estado = 'confirmado'
LEFT JOIN plaquetas p ON p.id = irt.plaquetaId AND p.empresaId = irt.empresaId
LEFT JOIN romaneiosCargaToras rc ON rc.id = p.romaneioCargaId AND rc.empresaId = p.empresaId
WHERE irt.empresaId = 1
GROUP BY situacao;
