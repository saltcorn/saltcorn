const sql_pg = ({ schema }) => `
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT name FROM "${schema}"."_sc_tables" WHERE has_sync_info = true
    LOOP
        EXECUTE format(
            'ALTER TABLE "${schema}".%I ADD COLUMN IF NOT EXISTS owner_id integer',
            r.name || '_sync_info'
        );
        EXECUTE format(
            'ALTER TABLE "${schema}".%I ADD COLUMN IF NOT EXISTS owner_fields jsonb',
            r.name || '_sync_info'
        );
    END LOOP;
END;
$$;
`;

module.exports = { sql_pg };
