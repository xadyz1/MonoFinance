-- SwiftFinance migration: OCR/AI receipt fields, RLS policies and LLM context RPC
-- Run this in Supabase SQL Editor

-- =============================================================================
-- 1. Verificacao / adicao de colunas OCR na tabela de transacoes
-- =============================================================================
-- Atualmente as transacoes sao guardadas como JSONB na coluna `data`.
-- receipt_url ja existe no JSON, mas para IA local e auditoria fiscal e
-- preferivel normalizar os campos extraidos por OCR.

ALTER TABLE swiftfinance.swiftfinance_transactions
    ADD COLUMN IF NOT EXISTS receipt_url TEXT,
    ADD COLUMN IF NOT EXISTS merchant_nif TEXT,
    ADD COLUMN IF NOT EXISTS base_amount NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS ocr_extracted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS ocr_confidence NUMERIC(5,2);

CREATE INDEX IF NOT EXISTS idx_transactions_merchant_nif
    ON swiftfinance.swiftfinance_transactions(merchant_nif);



-- =============================================================================
-- 2. Auditoria / politicas RLS
-- =============================================================================
-- RLS ja esta ativo no schema mas nao existem politicas. Sem politicas,
-- utilizadores autenticados via anon/key auth nao conseguem ler/alterar dados.
-- A service_role key faz bypass ao RLS, pelo que o backend Node.js consegue
-- aceder a todos os user_ids isoladamente usando .eq('user_id', ...).
-- As politicas abaixo restringem o acesso do frontend ao proprio user_id.

CREATE POLICY IF NOT EXISTS users_select_own
    ON swiftfinance.swiftfinance_users
    FOR SELECT
    TO authenticated
    USING (id = (auth.uid())::int);

CREATE POLICY IF NOT EXISTS users_update_own
    ON swiftfinance.swiftfinance_users
    FOR UPDATE
    TO authenticated
    USING (id = (auth.uid())::int)
    WITH CHECK (id = (auth.uid())::int);

CREATE POLICY IF NOT EXISTS users_admin_all
    ON swiftfinance.swiftfinance_users
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY IF NOT EXISTS user_data_select_own
    ON swiftfinance.swiftfinance_user_data
    FOR SELECT
    TO authenticated
    USING (user_id = (auth.uid())::int);

CREATE POLICY IF NOT EXISTS user_data_update_own
    ON swiftfinance.swiftfinance_user_data
    FOR UPDATE
    TO authenticated
    USING (user_id = (auth.uid())::int)
    WITH CHECK (user_id = (auth.uid())::int);

CREATE POLICY IF NOT EXISTS user_data_insert_own
    ON swiftfinance.swiftfinance_user_data
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = (auth.uid())::int);

CREATE POLICY IF NOT EXISTS user_data_service_all
    ON swiftfinance.swiftfinance_user_data
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY IF NOT EXISTS transactions_select_own
    ON swiftfinance.swiftfinance_transactions
    FOR SELECT
    TO authenticated
    USING (user_id = (auth.uid())::int);

CREATE POLICY IF NOT EXISTS transactions_insert_own
    ON swiftfinance.swiftfinance_transactions
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = (auth.uid())::int);

CREATE POLICY IF NOT EXISTS transactions_update_own
    ON swiftfinance.swiftfinance_transactions
    FOR UPDATE
    TO authenticated
    USING (user_id = (auth.uid())::int)
    WITH CHECK (user_id = (auth.uid())::int);

CREATE POLICY IF NOT EXISTS transactions_delete_own
    ON swiftfinance.swiftfinance_transactions
    FOR DELETE
    TO authenticated
    USING (user_id = (auth.uid())::int);

CREATE POLICY IF NOT EXISTS transactions_service_all
    ON swiftfinance.swiftfinance_transactions
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY IF NOT EXISTS receipts_select_own
    ON swiftfinance.swiftfinance_receipts
    FOR SELECT
    TO authenticated
    USING (user_id = (auth.uid())::int);

CREATE POLICY IF NOT EXISTS receipts_insert_own
    ON swiftfinance.swiftfinance_receipts
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = (auth.uid())::int);

CREATE POLICY IF NOT EXISTS receipts_update_own
    ON swiftfinance.swiftfinance_receipts
    FOR UPDATE
    TO authenticated
    USING (user_id = (auth.uid())::int)
    WITH CHECK (user_id = (auth.uid())::int);

CREATE POLICY IF NOT EXISTS receipts_delete_own
    ON swiftfinance.swiftfinance_receipts
    FOR DELETE
    TO authenticated
    USING (user_id = (auth.uid())::int);

CREATE POLICY IF NOT EXISTS receipts_service_all
    ON swiftfinance.swiftfinance_receipts
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY IF NOT EXISTS settings_select_own
    ON swiftfinance.swiftfinance_settings
    FOR SELECT
    TO authenticated
    USING (user_id = (auth.uid())::int);

CREATE POLICY IF NOT EXISTS settings_update_own
    ON swiftfinance.swiftfinance_settings
    FOR UPDATE
    TO authenticated
    USING (user_id = (auth.uid())::int)
    WITH CHECK (user_id = (auth.uid())::int);

CREATE POLICY IF NOT EXISTS settings_insert_own
    ON swiftfinance.swiftfinance_settings
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = (auth.uid())::int);

CREATE POLICY IF NOT EXISTS settings_service_all
    ON swiftfinance.swiftfinance_settings
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY IF NOT EXISTS subscriptions_select_own
    ON swiftfinance.swiftfinance_subscriptions
    FOR SELECT
    TO authenticated
    USING (user_id = (auth.uid())::int);



-- =============================================================================
-- 3. Funcao SQL RPC para contexto do agente IA / LLM
-- =============================================================================
-- Devolve um JSON limpo com: total_expenses, total_income, balance,
-- transaction_count e top 3 categorias de despesa do mes.
-- As transacoes sao lidas da coluna JSONB `transactions` em
-- swiftfinance_user_data, compativel com a estrutura actual do backend Node.js.

CREATE OR REPLACE FUNCTION swiftfinance.get_financial_summary(
    p_user_id INTEGER,
    p_month INTEGER,
    p_year INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = swiftfinance, public
AS $$
DECLARE
    v_start_date DATE;
    v_end_date DATE;
    v_transactions JSONB;
    v_total_expenses NUMERIC(12,2) := 0;
    v_total_income NUMERIC(12,2) := 0;
    v_balance NUMERIC(12,2) := 0;
    v_transaction_count INTEGER := 0;
    v_top_categories JSONB;
    v_result JSONB;
BEGIN
    v_start_date := make_date(p_year, p_month, 1);
    v_end_date := v_start_date + INTERVAL '1 month' - INTERVAL '1 day';

    SELECT transactions INTO v_transactions
    FROM swiftfinance.swiftfinance_user_data
    WHERE user_id = p_user_id;

    IF v_transactions IS NULL OR jsonb_array_length(v_transactions) = 0 THEN
        RETURN jsonb_build_object(
            'user_id', p_user_id,
            'month', p_month,
            'year', p_year,
            'period', to_char(v_start_date, 'YYYY-MM'),
            'total_expenses', 0,
            'total_income', 0,
            'balance', 0,
            'transaction_count', 0,
            'top_categories', '[]'::jsonb,
            'currency', 'EUR'
        );
    END IF;

    SELECT
        COALESCE(SUM((elem->>'amount')::numeric), 0) FILTER (WHERE elem->>'type' = 'expense'),
        COALESCE(SUM((elem->>'amount')::numeric), 0) FILTER (WHERE elem->>'type' = 'income'),
        COUNT(*) FILTER (WHERE (elem->>'date')::date BETWEEN v_start_date AND v_end_date)
    INTO v_total_expenses, v_total_income, v_transaction_count
    FROM jsonb_array_elements(v_transactions) AS elem
    WHERE (elem->>'date')::date BETWEEN v_start_date AND v_end_date
      AND (elem->>'type') IN ('expense', 'income');

    v_balance := v_total_income - v_total_expenses;

    SELECT COALESCE(jsonb_agg(cat ORDER BY cat.total DESC), '[]'::jsonb)
    INTO v_top_categories
    FROM (
        SELECT
            COALESCE(elem->>'category', 'Sem categoria') AS category,
            COALESCE(SUM((elem->>'amount')::numeric), 0) AS total,
            COUNT(*) AS count
        FROM jsonb_array_elements(v_transactions) AS elem
        WHERE (elem->>'date')::date BETWEEN v_start_date AND v_end_date
          AND elem->>'type' = 'expense'
        GROUP BY COALESCE(elem->>'category', 'Sem categoria')
        ORDER BY total DESC
        LIMIT 3
    ) AS cat;

    v_result := jsonb_build_object(
        'user_id', p_user_id,
        'month', p_month,
        'year', p_year,
        'period', to_char(v_start_date, 'YYYY-MM'),
        'total_expenses', v_total_expenses,
        'total_income', v_total_income,
        'balance', v_balance,
        'transaction_count', v_transaction_count,
        'top_categories', v_top_categories,
        'currency', 'EUR'
    );

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION swiftfinance.get_financial_summary(INTEGER, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION swiftfinance.get_financial_summary(INTEGER, INTEGER, INTEGER) TO authenticated;

-- =============================================================================
-- Notas de implementacao
-- =============================================================================
-- A. service_role key: no Supabase, pedidos autenticados com a service_role
--    key fazem bypass ao RLS. O backend Node.js pode portanto fazer:
--      supabase.schema('swiftfinance').rpc('get_financial_summary',
--        { p_user_id: 7, p_month: 6, p_year: 2026 })
--    e obter apenas os dados desse user_id.
--
-- B. Para queries directas por user_id, o backend pode usar:
--      supabase.schema('swiftfinance').from('swiftfinance_user_data')
--        .select('*').eq('user_id', userId).single()
--    pois a service_role key ignora as politicas RLS.
--
-- C. O frontend (auth anonima/autenticada) so ve os seus proprios dados
--    gracas as politicas `*_own`. Se a app nao utilizar auth do Supabase
--    e sim sessao propria no Node.js, as politicas para `authenticated`
--    nao sao usadas, mas nao causam problema.
--
-- D. Os campos base_amount / tax_amount / tax_rate sao normalizados na
--    tabela swiftfinance_transactions. Para manter compatibilidade com o
--    JSON existente, o backend pode continuar a guardar receipt_url dentro
--    do JSON e replicar para a coluna receipt_url quando conveniente.
;


