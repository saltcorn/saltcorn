const sql_pg = `
DO $$                  
    BEGIN 
        IF EXISTS
            ( SELECT 1
              FROM   information_schema.tables 
              WHERE  table_schema = 'public'
              AND    table_name = '_sc_session'
            )
        THEN
             TRUNCATE public._sc_session;
        END IF ;
    END
   $$ ;`;

module.exports = { sql_pg };
