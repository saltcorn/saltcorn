var relationHelpers = (() => {
  const buildLayers = (path, pathArr, result) => {
    let currentLevel = result;
    for (const relation of pathArr) {
      if (relation.type === "Inbound") {
        const existing = currentLevel.inboundKeys.find(
          (key) => key.name === relation.key && key.table === relation.table
        );
        if (existing) {
          currentLevel = existing;
        } else {
          const nextLevel = {
            name: relation.key,
            table: relation.table,
            inboundKeys: [],
            fkeys: [],
          };
          currentLevel.inboundKeys.push(nextLevel);
          currentLevel = nextLevel;
        }
      } else if (relation.type === "Foreign") {
        const existing = currentLevel.fkeys.find(
          (key) => key.name === relation.key
        );
        if (existing) {
          currentLevel = existing;
        } else {
          const nextLevel = {
            name: relation.key,
            table: relation.table,
            inboundKeys: [],
            fkeys: [],
          };
          currentLevel.fkeys.push(nextLevel);
          currentLevel = nextLevel;
        }
      } else if (relation.type === "Independent") {
        currentLevel.fkeys.push({
          name: "None (no relation)",
          table: relation.table,
          inboundKeys: [],
          fkeys: [],
          relPath: path,
        });
      } else if (relation.type === "Own") {
        currentLevel.fkeys.push({
          name: "Same table",
          table: "",
          inboundKeys: [],
          fkeys: [],
          relPath: path,
        });
      }
    }
    currentLevel.relPath = path;
  };

  const parseRelationPath = (path, tableNameCache) => {
    if (path === ".")
      return [{ type: "Independent", table: "None (no relation)" }];
    const tokens = path.split(".");
    if (tokens.length === 2)
      return [{ type: "Own", table: `${tokens[1]} (same table)` }];
    else if (tokens.length >= 3) {
      const result = [];
      let currentTbl = tokens[1];
      for (const relation of tokens.slice(2)) {
        if (relation.indexOf("$") > 0) {
          const [inboundTbl, inboundKey] = relation.split("$");
          result.push({ type: "Inbound", table: inboundTbl, key: inboundKey });
          currentTbl = inboundTbl;
        } else {
          const srcTbl = tableNameCache[currentTbl];
          const fk = srcTbl.foreign_keys.find((fk) => fk.name === relation);
          if (fk) {
            const targetTbl = tableNameCache[fk.reftable_name];
            result.push({
              type: "Foreign",
              table: targetTbl.name,
              key: relation,
            });
            currentTbl = targetTbl.name;
          }
        }
      }
      return result;
    }
  };

  const parseLegacyRelation = (type, rest, parentTbl) => {
    switch (type) {
      case "ChildList": {
        const path = rest ? rest.split(".") : [];
        if (path.length === 3) {
          const [viewName, table, key] = path;
          return [
            {
              type: "Inbound",
              table,
              key,
            },
          ];
        } else if (path.length === 5) {
          const [viewName, thrTbl, thrTblFkey, fromTbl, fromTblFkey] = path;
          return [
            {
              type: "Inbound",
              table: thrTbl,
              key: thrTblFkey,
            },
            {
              type: "Inbound",
              table: fromTbl,
              key: fromTblFkey,
            },
          ];
        }
        break;
      }
      case "Independent": {
        return [{ type: "Independent", table: "None (no relation)" }];
      }
      case "Own": {
        return [{ type: "Own", table: `${parentTbl} (same table)` }];
      }
      case "OneToOneShow": {
        const tokens = rest ? rest.split(".") : [];
        if (tokens.length !== 3) break;
        const [viewname, relatedTbl, fkey] = tokens;
        return [{ type: "Inbound", table: relatedTbl, key: fkey }];
      }
      case "ParentShow": {
        const tokens = rest ? rest.split(".") : [];
        if (tokens.length !== 3) break;
        const [viewname, parentTbl, fkey] = tokens;
        return [{ type: "Foreign", table: parentTbl, key: fkey }];
      }
    }
    return [];
  };

  const ViewDisplayType = {
    SINGLE: "SINGLE_ROW",
    MULTI: "MULTIPLE_ROWS",
    NO_ROWS: "NO_ROWS",
    INVALID: "INVALID",
  };

  const RelationsFinder = function (tablesCache, allViews, maxDepth) {
    this.maxDepth = +maxDepth;
    this.allViews = allViews;
    const { tableIdCache, tableNameCache, fieldCache } = tablesCache;
    this.tableIdCache = tableIdCache;
    this.tableNameCache = tableNameCache;
    this.fieldCache = fieldCache;
  };

  RelationsFinder.prototype.findRelations = function (sourceTblName, subView) {
    const layers = { table: sourceTblName, inboundKeys: [], fkeys: [] };
    const view = this.allViews.find((v) => v.name === subView);
    const paths =
      view.display_type === ViewDisplayType.SINGLE
        ? this.singleRelationPaths(sourceTblName, subView)
        : view.display_type === ViewDisplayType.MULTI
        ? this.multiRelationPaths(sourceTblName, subView)
        : [];
    for (const path of paths)
      buildLayers(path, parseRelationPath(path, this.tableNameCache), layers);
    return { paths, layers };
  };

  RelationsFinder.prototype.singleRelationPaths = function (
    sourceTblName,
    subView
  ) {
    const result = [];
    const subViewObj = this.allViews.find((v) => v.name === subView);
    const sourceTbl = this.tableNameCache[sourceTblName];
    const relations = sourceTbl.foreign_keys;
    if (sourceTbl.id === subViewObj.table_id) result.push(`.${sourceTblName}`);
    for (const relation of relations) {
      const targetTbl = this.tableNameCache[relation.reftable_name];
      if (targetTbl.id === subViewObj.table_id)
        result.push(`.${sourceTblName}.${relation.name}`);
    }
    const uniqueRelations = (this.fieldCache[sourceTblName] || []).filter(
      (f) => f.is_unique
    );
    for (const relation of uniqueRelations) {
      const targetTbl = this.tableIdCache[relation.table_id];
      if (targetTbl.id === subViewObj.table_id)
        result.push(`.${sourceTblName}.${targetTbl.name}$${relation.name}`);
    }
    const targetFields = sourceTbl.foreign_keys;
    for (const field of uniqueRelations) {
      const refTable = this.tableIdCache[field.table_id];
      const fromTargetToRef = targetFields.filter(
        (field) => field.reftable_name === refTable.name
      );
      for (const toRef of fromTargetToRef) {
        if (field.reftable_name === sourceTblName)
          result.push(`.${sourceTblName}.${toRef.name}.${field.name}`);
      }
    }
    return result;
  };

  RelationsFinder.prototype.multiRelationPaths = function (
    sourceTblName,
    subView
  ) {
    const relations = ["."]; // none no relation
    const subViewObj = this.allViews.find((v) => v.name === subView);
    const sourceTbl = this.tableNameCache[sourceTblName];
    const searcher = (current, path, level, visited) => {
      if (level > this.maxDepth) return;
      const visitedFkCopy = new Set(visited);
      const fks = current.foreign_keys.filter((f) => !visitedFkCopy.has(f.id));
      for (const fk of fks) {
        visitedFkCopy.add(fk.id);
        const target = this.tableNameCache[fk.reftable_name];
        const newPath = `${path}.${fk.name}`;
        if (target.id === subViewObj.table_id) relations.push(newPath);
        searcher(target, newPath, level + 1, visitedFkCopy);
      }

      const visitedInboundCopy = new Set(visited);
      const inbounds = (this.fieldCache[current.name] || []).filter(
        (f) => !visitedInboundCopy.has(f.id)
      );
      for (const inbound of inbounds) {
        visitedInboundCopy.add(inbound.id);
        const target = this.tableIdCache[inbound.table_id];
        const newPath = `${path}.${target.name}$${inbound.name}`;
        if (target.id === subViewObj.table_id) relations.push(newPath);
        searcher(target, newPath, level + 1, visitedInboundCopy);
      }
    };
    const path = `.${sourceTblName}`;
    const visited = new Set();
    searcher(sourceTbl, path, 0, visited);
    return relations;
  };

  return {
    RelationsFinder: RelationsFinder,
    ViewDisplayType: ViewDisplayType,
    parseRelationPath: parseRelationPath,
    parseLegacyRelation: parseLegacyRelation,
  };
})();

// make the module available for jest with react
if (typeof process !== "undefined" && process.env?.NODE_ENV === "test") {
  module.exports = relationHelpers;
}
