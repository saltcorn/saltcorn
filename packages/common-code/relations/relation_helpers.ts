import { RelationType } from "./relation_types";

/**
 * when we don't have the saltcorn state those caches can be used
 * @param allTables
 * @returns tableIdCache, tableNameCache, fieldCache
 */
export const buildTableCaches = (allTables: any[]) => {
  const tableIdCache: any = {};
  const tableNameCache: any = {};
  const fieldCache: any = {};
  for (const table of allTables) {
    tableIdCache[table.id] = table;
    tableNameCache[table.name] = table;
    for (const field of table.foreign_keys) {
      if (!fieldCache[field.reftable_name])
        fieldCache[field.reftable_name] = [];
      fieldCache[field.reftable_name].push(field);
    }
  }
  return { tableIdCache, tableNameCache, fieldCache };
};

/**
 * build an array from the relation string
 * @param s relation syntax
 * @returns the first table (source) and the relation as path array
 */
export const parseRelationPath = (s: string): any => {
  const tokens = s.split(".");
  const path = [];
  for (const relation of tokens.slice(2)) {
    if (relation.indexOf("$") > 0) {
      const [table, inboundKey] = relation.split("$");
      path.push({ table, inboundKey });
    } else {
      path.push({ fkey: relation });
    }
  }
  return { sourcetable: tokens[1], path };
};

/**
 * convert a relation array back to string
 * @param sourcetable the first table (source)
 * @param path relation as path array
 * @returns relation syntax as string
 */
export const buildRelationPath = (
  sourcetable: string,
  path: { table: string; fkey?: string; inboundKey?: string }[]
) => {
  return `.${sourcetable}.${path
    .map(({ table, fkey, inboundKey }) => {
      return inboundKey ? `${table}$${inboundKey} ` : fkey;
    })
    .join(".")}`;
};

/**
 * @param type
 * @param relation
 * @param parentTbl
 * @returns
 */
export const parseLegacyRelation = (
  type: any,
  relation: string,
  parentTbl: string
) => {
  switch (type) {
    case "ChildList": {
      const path = relation ? relation.split(".") : [];
      if (path.length === 3) {
        const [viewName, table, key] = path;
        return {
          type: RelationType.CHILD_LIST,
          path: [
            {
              table,
              inboundKey: key,
            },
          ],
        };
      } else if (path.length === 5) {
        const [viewName, thrTbl, thrTblFkey, fromTbl, fromTblFkey] = path;
        return {
          type: RelationType.CHILD_LIST,
          path: [
            {
              table: thrTbl,
              inboundKey: thrTblFkey,
            },
            {
              table: fromTbl,
              inboundKey: fromTblFkey,
            },
          ],
        };
      }
      break;
    }
    case "Independent": {
      return {
        type: RelationType.INDEPENDENT,
        path: [{ table: "None (no relation)" }],
      };
    }
    case "Own": {
      return {
        type: RelationType.OWN,
        path: [{ table: `${parentTbl} (same table)` }],
      };
    }
    case "OneToOneShow": {
      const tokens = relation ? relation.split(".") : [];
      if (tokens.length !== 3) break;
      const [viewname, relatedTbl, fkey] = tokens;
      return {
        type: RelationType.ONE_TO_ONE_SHOW,
        path: [{ table: relatedTbl, inboundKey: fkey }],
      };
    }
    case "ParentShow": {
      const tokens = relation ? relation.split(".") : [];
      if (tokens.length !== 3) break;
      const [viewname, parentTbl, fkey] = tokens;
      return { type: RelationType.PARENT_SHOW, path: [{ fkey }] };
    }
  }
  return [];
};
