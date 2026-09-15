-- READ-ONLY: não contém INSERT, UPDATE, DELETE, ALTER, DROP ou TRUNCATE.
-- Migrations ordinais 50–73 = arquivos 0049–0072 neste repositório.
SELECT 'JOURNAL_SUMMARY' AS section, COUNT(*) AS migration_count, MIN(id) AS first_id, MAX(id) AS last_id FROM `__drizzle_migrations`;
SELECT id, hash, created_at FROM `__drizzle_migrations` ORDER BY id;

SELECT 'EXPECTED_OBJECTS' AS section, migration_tag, object_kind, object_name, operation,
  CASE
    WHEN object_kind = 'TABLE' AND EXISTS (SELECT 1 FROM information_schema.tables t WHERE t.table_schema = DATABASE() AND t.table_name = object_name) THEN 'EXISTS'
    WHEN object_kind = 'COLUMN' AND EXISTS (SELECT 1 FROM information_schema.columns c WHERE c.table_schema = DATABASE() AND CONCAT(c.table_name, '.', c.column_name) = object_name) THEN 'EXISTS'
    WHEN object_kind = 'INDEX' AND EXISTS (SELECT 1 FROM information_schema.statistics s WHERE s.table_schema = DATABASE() AND CONCAT(s.table_name, '.', s.index_name) = object_name) THEN 'EXISTS'
    ELSE 'MISSING'
  END AS physical_status
FROM (
  SELECT '0049_steep_eddie_brock' AS migration_tag, 'COLUMN' AS object_kind, 'folhasPagamentoRh.tituloEncargosFinanceiroId' AS object_name, 'ALTER ADD' AS operation
  UNION ALL
  SELECT '0050_demonic_caretaker' AS migration_tag, 'TABLE' AS object_kind, 'regrasReducaoIrrfRh' AS object_name, 'CREATE TABLE' AS operation
  UNION ALL
  SELECT '0050_demonic_caretaker' AS migration_tag, 'COLUMN' AS object_kind, 'itensFolhaPagamentoRh.baseIrrf' AS object_name, 'ALTER ADD' AS operation
  UNION ALL
  SELECT '0050_demonic_caretaker' AS migration_tag, 'COLUMN' AS object_kind, 'itensFolhaPagamentoRh.deducoesLegaisIrrf' AS object_name, 'ALTER ADD' AS operation
  UNION ALL
  SELECT '0050_demonic_caretaker' AS migration_tag, 'COLUMN' AS object_kind, 'itensFolhaPagamentoRh.descontoSimplificadoIrrf' AS object_name, 'ALTER ADD' AS operation
  UNION ALL
  SELECT '0050_demonic_caretaker' AS migration_tag, 'COLUMN' AS object_kind, 'itensFolhaPagamentoRh.metodoDeducaoIrrf' AS object_name, 'ALTER ADD' AS operation
  UNION ALL
  SELECT '0050_demonic_caretaker' AS migration_tag, 'COLUMN' AS object_kind, 'itensFolhaPagamentoRh.tabelaIrrfId' AS object_name, 'ALTER ADD' AS operation
  UNION ALL
  SELECT '0050_demonic_caretaker' AS migration_tag, 'COLUMN' AS object_kind, 'itensFolhaPagamentoRh.memoriaIrrf' AS object_name, 'ALTER ADD' AS operation
  UNION ALL
  SELECT '0050_demonic_caretaker' AS migration_tag, 'COLUMN' AS object_kind, 'tabelasTributariasRh.descontoSimplificado' AS object_name, 'ALTER ADD' AS operation
  UNION ALL
  SELECT '0051_robust_darwin' AS migration_tag, 'COLUMN' AS object_kind, 'eventosFolhaRh.deduzIrrf' AS object_name, 'ALTER ADD' AS operation
  UNION ALL
  SELECT '0051_robust_darwin' AS migration_tag, 'COLUMN' AS object_kind, 'eventosItensFolhaRh.deduzIrrf' AS object_name, 'ALTER ADD' AS operation
  UNION ALL
  SELECT '0052_dry_mysterio' AS migration_tag, 'TABLE' AS object_kind, 'configuracoesCustosRh' AS object_name, 'CREATE TABLE' AS operation
  UNION ALL
  SELECT '0052_dry_mysterio' AS migration_tag, 'TABLE' AS object_kind, 'custosColaboradorRh' AS object_name, 'CREATE TABLE' AS operation
  UNION ALL
  SELECT '0052_dry_mysterio' AS migration_tag, 'TABLE' AS object_kind, 'custosEmpresaRh' AS object_name, 'CREATE TABLE' AS operation
  UNION ALL
  SELECT '0052_dry_mysterio' AS migration_tag, 'INDEX' AS object_kind, 'custosColaboradorRh.custos_colaborador_rh_colaborador_ativo_indice' AS object_name, 'CREATE INDEX' AS operation
  UNION ALL
  SELECT '0052_dry_mysterio' AS migration_tag, 'INDEX' AS object_kind, 'custosEmpresaRh.custos_empresa_rh_empresa_ativo_indice' AS object_name, 'CREATE INDEX' AS operation
  UNION ALL
  SELECT '0053_tan_the_phantom' AS migration_tag, 'COLUMN' AS object_kind, 'custosColaboradorRh.categoria' AS object_name, 'ALTER ADD' AS operation
  UNION ALL
  SELECT '0054_famous_synch' AS migration_tag, 'COLUMN' AS object_kind, 'configuracoesCustosRh.descontoInssEstimadoAtivo' AS object_name, 'ALTER ADD' AS operation
  UNION ALL
  SELECT '0055_daffy_garia' AS migration_tag, 'COLUMN' AS object_kind, 'custosColaboradorRh.descontarDoLiquido' AS object_name, 'ALTER ADD' AS operation
  UNION ALL
  SELECT '0056_magical_ben_grimm' AS migration_tag, 'TABLE' AS object_kind, 'parcelasAdiantamentosRh' AS object_name, 'CREATE TABLE' AS operation
  UNION ALL
  SELECT '0056_magical_ben_grimm' AS migration_tag, 'INDEX' AS object_kind, 'parcelasAdiantamentosRh.parcelas_adiantamentos_rh_competencia_indice' AS object_name, 'CREATE INDEX' AS operation
  UNION ALL
  SELECT '0057_plain_giant_man' AS migration_tag, 'TABLE' AS object_kind, 'categoriasLancamentosRh' AS object_name, 'CREATE TABLE' AS operation
  UNION ALL
  SELECT '0057_plain_giant_man' AS migration_tag, 'TABLE' AS object_kind, 'competenciasFinanceirasRh' AS object_name, 'CREATE TABLE' AS operation
  UNION ALL
  SELECT '0057_plain_giant_man' AS migration_tag, 'TABLE' AS object_kind, 'encargosGerenciaisRh' AS object_name, 'CREATE TABLE' AS operation
  UNION ALL
  SELECT '0057_plain_giant_man' AS migration_tag, 'TABLE' AS object_kind, 'lancamentosColaboradoresRh' AS object_name, 'CREATE TABLE' AS operation
  UNION ALL
  SELECT '0057_plain_giant_man' AS migration_tag, 'TABLE' AS object_kind, 'salariosCompetenciasRh' AS object_name, 'CREATE TABLE' AS operation
  UNION ALL
  SELECT '0057_plain_giant_man' AS migration_tag, 'COLUMN' AS object_kind, 'configuracoesCustosRh.inssPatronalPercentual' AS object_name, 'ALTER ADD' AS operation
  UNION ALL
  SELECT '0057_plain_giant_man' AS migration_tag, 'COLUMN' AS object_kind, 'configuracoesCustosRh.inssPatronalEstimadoAtivo' AS object_name, 'ALTER ADD' AS operation
  UNION ALL
  SELECT '0057_plain_giant_man' AS migration_tag, 'INDEX' AS object_kind, 'lancamentosColaboradoresRh.lancamentos_colaboradores_rh_colaborador_competencia_indice' AS object_name, 'CREATE INDEX' AS operation
  UNION ALL
  SELECT '0057_plain_giant_man' AS migration_tag, 'INDEX' AS object_kind, 'lancamentosColaboradoresRh.lancamentos_colaboradores_rh_competencia_estado_indice' AS object_name, 'CREATE INDEX' AS operation
  UNION ALL
  SELECT '0058_aspiring_peter_parker' AS migration_tag, 'COLUMN' AS object_kind, 'orcamentos.fretePorTonelada' AS object_name, 'ALTER ADD' AS operation
  UNION ALL
  SELECT '0058_aspiring_peter_parker' AS migration_tag, 'COLUMN' AS object_kind, 'orcamentos.pesoCargaToneladas' AS object_name, 'ALTER ADD' AS operation
  UNION ALL
  SELECT '0058_aspiring_peter_parker' AS migration_tag, 'COLUMN' AS object_kind, 'orcamentos.abatimentoFrete' AS object_name, 'ALTER ADD' AS operation
  UNION ALL
  SELECT '0058_aspiring_peter_parker' AS migration_tag, 'COLUMN' AS object_kind, 'orcamentos.baseAposFrete' AS object_name, 'ALTER ADD' AS operation
  UNION ALL
  SELECT '0058_aspiring_peter_parker' AS migration_tag, 'COLUMN' AS object_kind, 'orcamentos.comissaoTipo' AS object_name, 'ALTER ADD' AS operation
  UNION ALL
  SELECT '0058_aspiring_peter_parker' AS migration_tag, 'COLUMN' AS object_kind, 'orcamentos.comissaoValor' AS object_name, 'ALTER ADD' AS operation
  UNION ALL
  SELECT '0058_aspiring_peter_parker' AS migration_tag, 'COLUMN' AS object_kind, 'orcamentos.comissaoCalculada' AS object_name, 'ALTER ADD' AS operation
  UNION ALL
  SELECT '0058_aspiring_peter_parker' AS migration_tag, 'COLUMN' AS object_kind, 'orcamentos.taxaDescricao' AS object_name, 'ALTER ADD' AS operation
  UNION ALL
  SELECT '0058_aspiring_peter_parker' AS migration_tag, 'COLUMN' AS object_kind, 'orcamentos.taxaTipo' AS object_name, 'ALTER ADD' AS operation
  UNION ALL
  SELECT '0058_aspiring_peter_parker' AS migration_tag, 'COLUMN' AS object_kind, 'orcamentos.taxaValor' AS object_name, 'ALTER ADD' AS operation
  UNION ALL
  SELECT '0058_aspiring_peter_parker' AS migration_tag, 'COLUMN' AS object_kind, 'orcamentos.taxaCalculada' AS object_name, 'ALTER ADD' AS operation
  UNION ALL
  SELECT '0059_polite_hardball' AS migration_tag, 'TABLE' AS object_kind, 'taxasAdicionaisOrcamento' AS object_name, 'CREATE TABLE' AS operation
  UNION ALL
  SELECT '0060_broken_crusher_hogan' AS migration_tag, 'TABLE' AS object_kind, 'sequenciasDocumentos' AS object_name, 'CREATE TABLE' AS operation
  UNION ALL
  SELECT '0061_mixed_mulholland_black' AS migration_tag, 'COLUMN' AS object_kind, 'users.empresaAtivaId' AS object_name, 'ALTER ADD' AS operation
  UNION ALL
  SELECT '0062_glossy_peter_parker' AS migration_tag, 'COLUMN' AS object_kind, 'users.papel' AS object_name, 'ALTER ADD' AS operation
  UNION ALL
  SELECT '0063_colossal_rocket_racer' AS migration_tag, 'COLUMN' AS object_kind, 'contasFinanceiras.banco' AS object_name, 'ALTER ADD' AS operation
  UNION ALL
  SELECT '0063_colossal_rocket_racer' AS migration_tag, 'COLUMN' AS object_kind, 'contasFinanceiras.agencia' AS object_name, 'ALTER ADD' AS operation
  UNION ALL
  SELECT '0063_colossal_rocket_racer' AS migration_tag, 'COLUMN' AS object_kind, 'contasFinanceiras.numeroConta' AS object_name, 'ALTER ADD' AS operation
  UNION ALL
  SELECT '0063_colossal_rocket_racer' AS migration_tag, 'COLUMN' AS object_kind, 'contasFinanceiras.dataInicio' AS object_name, 'ALTER ADD' AS operation
  UNION ALL
  SELECT '0064_yielding_lady_mastermind' AS migration_tag, 'TABLE' AS object_kind, 'movimentosTransferenciasFinanceiras' AS object_name, 'CREATE TABLE' AS operation
  UNION ALL
  SELECT '0064_yielding_lady_mastermind' AS migration_tag, 'TABLE' AS object_kind, 'transferenciasFinanceiras' AS object_name, 'CREATE TABLE' AS operation
  UNION ALL
  SELECT '0064_yielding_lady_mastermind' AS migration_tag, 'INDEX' AS object_kind, 'movimentosTransferenciasFinanceiras.movimentos_transferencia_conta_data_indice' AS object_name, 'CREATE INDEX' AS operation
  UNION ALL
  SELECT '0064_yielding_lady_mastermind' AS migration_tag, 'INDEX' AS object_kind, 'transferenciasFinanceiras.transferencias_financeiras_origem_indice' AS object_name, 'CREATE INDEX' AS operation
  UNION ALL
  SELECT '0064_yielding_lady_mastermind' AS migration_tag, 'INDEX' AS object_kind, 'transferenciasFinanceiras.transferencias_financeiras_destino_indice' AS object_name, 'CREATE INDEX' AS operation
  UNION ALL
  SELECT '0064_yielding_lady_mastermind' AS migration_tag, 'INDEX' AS object_kind, 'transferenciasFinanceiras.transferencias_financeiras_estado_indice' AS object_name, 'CREATE INDEX' AS operation
  UNION ALL
  SELECT '0065_foamy_rumiko_fujikawa' AS migration_tag, 'TABLE' AS object_kind, 'auditoriasConciliacaoBancaria' AS object_name, 'CREATE TABLE' AS operation
  UNION ALL
  SELECT '0065_foamy_rumiko_fujikawa' AS migration_tag, 'TABLE' AS object_kind, 'vinculosConciliacaoBancaria' AS object_name, 'CREATE TABLE' AS operation
  UNION ALL
  SELECT '0065_foamy_rumiko_fujikawa' AS migration_tag, 'COLUMN' AS object_kind, 'baixasFinanceiras.origemBaixa' AS object_name, 'ALTER ADD' AS operation
  UNION ALL
  SELECT '0065_foamy_rumiko_fujikawa' AS migration_tag, 'COLUMN' AS object_kind, 'extratosBancarios.saldoFinalBanco' AS object_name, 'ALTER ADD' AS operation
  UNION ALL
  SELECT '0065_foamy_rumiko_fujikawa' AS migration_tag, 'COLUMN' AS object_kind, 'extratosBancarios.dataSaldoFinalBanco' AS object_name, 'ALTER ADD' AS operation
  UNION ALL
  SELECT '0065_foamy_rumiko_fujikawa' AS migration_tag, 'COLUMN' AS object_kind, 'movimentosExtratoBancario.memoOriginal' AS object_name, 'ALTER ADD' AS operation
  UNION ALL
  SELECT '0065_foamy_rumiko_fujikawa' AS migration_tag, 'COLUMN' AS object_kind, 'movimentosExtratoBancario.numeroDocumento' AS object_name, 'ALTER ADD' AS operation
  UNION ALL
  SELECT '0065_foamy_rumiko_fujikawa' AS migration_tag, 'COLUMN' AS object_kind, 'movimentosExtratoBancario.saldoAposMovimento' AS object_name, 'ALTER ADD' AS operation
  UNION ALL
  SELECT '0065_foamy_rumiko_fujikawa' AS migration_tag, 'COLUMN' AS object_kind, 'movimentosExtratoBancario.movimentoTransferenciaFinanceiraId' AS object_name, 'ALTER ADD' AS operation
  UNION ALL
  SELECT '0065_foamy_rumiko_fujikawa' AS migration_tag, 'INDEX' AS object_kind, 'auditoriasConciliacaoBancaria.auditorias_conciliacao_movimento_data_indice' AS object_name, 'CREATE INDEX' AS operation
  UNION ALL
  SELECT '0065_foamy_rumiko_fujikawa' AS migration_tag, 'INDEX' AS object_kind, 'vinculosConciliacaoBancaria.vinculos_conciliacao_movimento_indice' AS object_name, 'CREATE INDEX' AS operation
  UNION ALL
  SELECT '0065_foamy_rumiko_fujikawa' AS migration_tag, 'INDEX' AS object_kind, 'vinculosConciliacaoBancaria.vinculos_conciliacao_baixa_indice' AS object_name, 'CREATE INDEX' AS operation
  UNION ALL
  SELECT '0065_foamy_rumiko_fujikawa' AS migration_tag, 'INDEX' AS object_kind, 'movimentosExtratoBancario.movimentos_extrato_conta_estado_data_indice' AS object_name, 'CREATE INDEX' AS operation
  UNION ALL
  SELECT '0066_premium_darkstar' AS migration_tag, 'TABLE' AS object_kind, 'categoriasCustosGerenciais' AS object_name, 'CREATE TABLE' AS operation
  UNION ALL
  SELECT '0066_premium_darkstar' AS migration_tag, 'TABLE' AS object_kind, 'centrosCustosGerenciais' AS object_name, 'CREATE TABLE' AS operation
  UNION ALL
  SELECT '0066_premium_darkstar' AS migration_tag, 'TABLE' AS object_kind, 'itensRateiosCustosGerenciais' AS object_name, 'CREATE TABLE' AS operation
  UNION ALL
  SELECT '0066_premium_darkstar' AS migration_tag, 'TABLE' AS object_kind, 'lancamentosCustosGerenciais' AS object_name, 'CREATE TABLE' AS operation
  UNION ALL
  SELECT '0066_premium_darkstar' AS migration_tag, 'TABLE' AS object_kind, 'rateiosCustosGerenciais' AS object_name, 'CREATE TABLE' AS operation
  UNION ALL
  SELECT '0066_premium_darkstar' AS migration_tag, 'INDEX' AS object_kind, 'categoriasCustosGerenciais.categorias_custos_gerenciais_centro_indice' AS object_name, 'CREATE INDEX' AS operation
  UNION ALL
  SELECT '0066_premium_darkstar' AS migration_tag, 'INDEX' AS object_kind, 'itensRateiosCustosGerenciais.itens_rateios_custos_gerenciais_categoria_indice' AS object_name, 'CREATE INDEX' AS operation
  UNION ALL
  SELECT '0066_premium_darkstar' AS migration_tag, 'INDEX' AS object_kind, 'lancamentosCustosGerenciais.lancamentos_custos_gerenciais_competencia_indice' AS object_name, 'CREATE INDEX' AS operation
  UNION ALL
  SELECT '0066_premium_darkstar' AS migration_tag, 'INDEX' AS object_kind, 'lancamentosCustosGerenciais.lancamentos_custos_gerenciais_categoria_competencia_indice' AS object_name, 'CREATE INDEX' AS operation
  UNION ALL
  SELECT '0066_premium_darkstar' AS migration_tag, 'INDEX' AS object_kind, 'lancamentosCustosGerenciais.lancamentos_custos_gerenciais_venda_indice' AS object_name, 'CREATE INDEX' AS operation
  UNION ALL
  SELECT '0066_premium_darkstar' AS migration_tag, 'INDEX' AS object_kind, 'rateiosCustosGerenciais.rateios_custos_gerenciais_competencia_estado_indice' AS object_name, 'CREATE INDEX' AS operation
  UNION ALL
  SELECT '0067_black_abomination' AS migration_tag, 'COLUMN' AS object_kind, 'lancamentosCustosGerenciais.unidadeValor' AS object_name, 'ALTER ADD' AS operation
  UNION ALL
  SELECT '0067_black_abomination' AS migration_tag, 'COLUMN' AS object_kind, 'lancamentosCustosGerenciais.valor' AS object_name, 'ALTER MODIFY' AS operation
  UNION ALL
  SELECT '0068_omniscient_quasimodo' AS migration_tag, 'TABLE' AS object_kind, 'calculosCustosGerenciais' AS object_name, 'CREATE TABLE' AS operation
  UNION ALL
  SELECT '0068_omniscient_quasimodo' AS migration_tag, 'TABLE' AS object_kind, 'componentesCalculosCustosGerenciais' AS object_name, 'CREATE TABLE' AS operation
  UNION ALL
  SELECT '0068_omniscient_quasimodo' AS migration_tag, 'COLUMN' AS object_kind, 'lancamentosCustosGerenciais.competenciaOriginal' AS object_name, 'ALTER ADD' AS operation
  UNION ALL
  SELECT '0068_omniscient_quasimodo' AS migration_tag, 'COLUMN' AS object_kind, 'lancamentosCustosGerenciais.competenciaAlteradaEm' AS object_name, 'ALTER ADD' AS operation
  UNION ALL
  SELECT '0068_omniscient_quasimodo' AS migration_tag, 'COLUMN' AS object_kind, 'lancamentosCustosGerenciais.competenciaAlteradaPor' AS object_name, 'ALTER ADD' AS operation
  UNION ALL
  SELECT '0068_omniscient_quasimodo' AS migration_tag, 'COLUMN' AS object_kind, 'lancamentosCustosGerenciais.justificativaCompetencia' AS object_name, 'ALTER ADD' AS operation
  UNION ALL
  SELECT '0068_omniscient_quasimodo' AS migration_tag, 'INDEX' AS object_kind, 'calculosCustosGerenciais.calculos_custos_gerenciais_entidade_estado_indice' AS object_name, 'CREATE INDEX' AS operation
  UNION ALL
  SELECT '0068_omniscient_quasimodo' AS migration_tag, 'INDEX' AS object_kind, 'calculosCustosGerenciais.calculos_custos_gerenciais_rateio_indice' AS object_name, 'CREATE INDEX' AS operation
  UNION ALL
  SELECT '0068_omniscient_quasimodo' AS migration_tag, 'INDEX' AS object_kind, 'componentesCalculosCustosGerenciais.componentes_calculos_custos_gerenciais_calculo_indice' AS object_name, 'CREATE INDEX' AS operation
  UNION ALL
  SELECT '0068_omniscient_quasimodo' AS migration_tag, 'INDEX' AS object_kind, 'componentesCalculosCustosGerenciais.componentes_calculos_custos_gerenciais_categoria_indice' AS object_name, 'CREATE INDEX' AS operation
  UNION ALL
  SELECT '0068_omniscient_quasimodo' AS migration_tag, 'INDEX' AS object_kind, 'componentesCalculosCustosGerenciais.componentes_calculos_custos_gerenciais_lancamento_indice' AS object_name, 'CREATE INDEX' AS operation
  UNION ALL
  SELECT '0069_sturdy_electro' AS migration_tag, 'COLUMN' AS object_kind, 'categoriasCustosGerenciais.incluirComissaoVendaAutomatica' AS object_name, 'ALTER ADD' AS operation
  UNION ALL
  SELECT '0070_short_tana_nile' AS migration_tag, 'TABLE' AS object_kind, 'regularizacoesVolumePlaquetas' AS object_name, 'CREATE TABLE' AS operation
  UNION ALL
  SELECT '0070_short_tana_nile' AS migration_tag, 'INDEX' AS object_kind, 'regularizacoesVolumePlaquetas.regularizacoes_volume_plaquetas_plaqueta_indice' AS object_name, 'CREATE INDEX' AS operation
  UNION ALL
  SELECT '0070_short_tana_nile' AS migration_tag, 'INDEX' AS object_kind, 'regularizacoesVolumePlaquetas.regularizacoes_volume_plaquetas_romaneio_indice' AS object_name, 'CREATE INDEX' AS operation
  UNION ALL
  SELECT '0071_optimal_ghost_rider' AS migration_tag, 'COLUMN' AS object_kind, 'centrosCustosGerenciais.codigo' AS object_name, 'ALTER MODIFY' AS operation
  UNION ALL
  SELECT '0071_optimal_ghost_rider' AS migration_tag, 'COLUMN' AS object_kind, 'centrosCustosGerenciais.tipo' AS object_name, 'ALTER ADD' AS operation
  UNION ALL
  SELECT '0071_optimal_ghost_rider' AS migration_tag, 'COLUMN' AS object_kind, 'centrosCustosGerenciais.observacoes' AS object_name, 'ALTER ADD' AS operation
  UNION ALL
  SELECT '0071_optimal_ghost_rider' AS migration_tag, 'COLUMN' AS object_kind, 'recorrenciasFinanceiras.centroCustoId' AS object_name, 'ALTER ADD' AS operation
  UNION ALL
  SELECT '0071_optimal_ghost_rider' AS migration_tag, 'COLUMN' AS object_kind, 'titulosFinanceiros.centroCustoId' AS object_name, 'ALTER ADD' AS operation
  UNION ALL
  SELECT '0071_optimal_ghost_rider' AS migration_tag, 'INDEX' AS object_kind, 'centrosCustosGerenciais.centros_custos_gerenciais_empresa_tipo_ativo_indice' AS object_name, 'CREATE INDEX' AS operation
  UNION ALL
  SELECT '0071_optimal_ghost_rider' AS migration_tag, 'INDEX' AS object_kind, 'recorrenciasFinanceiras.recorrencias_financeiras_centro_ativa_indice' AS object_name, 'CREATE INDEX' AS operation
  UNION ALL
  SELECT '0071_optimal_ghost_rider' AS migration_tag, 'INDEX' AS object_kind, 'titulosFinanceiros.titulos_financeiros_centro_competencia_indice' AS object_name, 'CREATE INDEX' AS operation
  UNION ALL
  SELECT '0072_dashing_changeling' AS migration_tag, 'COLUMN' AS object_kind, 'abastecimentosDiesel.centroCustoId' AS object_name, 'ALTER ADD' AS operation
  UNION ALL
  SELECT '0072_dashing_changeling' AS migration_tag, 'COLUMN' AS object_kind, 'colaboradoresRh.centroCustoId' AS object_name, 'ALTER ADD' AS operation
  UNION ALL
  SELECT '0072_dashing_changeling' AS migration_tag, 'COLUMN' AS object_kind, 'notasDiesel.centroCustoId' AS object_name, 'ALTER ADD' AS operation
  UNION ALL
  SELECT '0072_dashing_changeling' AS migration_tag, 'COLUMN' AS object_kind, 'orcamentos.centroCustoId' AS object_name, 'ALTER ADD' AS operation
  UNION ALL
  SELECT '0072_dashing_changeling' AS migration_tag, 'COLUMN' AS object_kind, 'romaneiosCargaToras.centroCustoId' AS object_name, 'ALTER ADD' AS operation
  UNION ALL
  SELECT '0072_dashing_changeling' AS migration_tag, 'COLUMN' AS object_kind, 'serragensTerceiros.centroCustoId' AS object_name, 'ALTER ADD' AS operation
) expected ORDER BY migration_tag, object_kind, object_name;

SELECT 'PHYSICAL_TABLES' AS section, table_name, table_rows, create_time, update_time
FROM information_schema.tables WHERE table_schema = DATABASE() ORDER BY table_name;

SELECT 'PHYSICAL_COLUMNS' AS section, table_name, ordinal_position, column_name, column_type, is_nullable, column_default, extra
FROM information_schema.columns WHERE table_schema = DATABASE() ORDER BY table_name, ordinal_position;

SELECT 'PHYSICAL_INDEXES' AS section, table_name, index_name, non_unique, GROUP_CONCAT(column_name ORDER BY seq_in_index SEPARATOR ',') AS columns_in_index
FROM information_schema.statistics WHERE table_schema = DATABASE() GROUP BY table_name, index_name, non_unique ORDER BY table_name, index_name;
