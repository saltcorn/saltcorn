const sql_pg = ({ schema }) => ` 
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT tc.table_name, tc.constraint_name
        FROM information_schema.table_constraints AS tc
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.constraint_schema = '${schema}'
    LOOP
        EXECUTE format(
            'ALTER TABLE "${schema}".%I ALTER CONSTRAINT %I DEFERRABLE',
            r.table_name, r.constraint_name
        );
    END LOOP;
END;
$$;
`;

module.exports = { sql_pg };
