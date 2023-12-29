var relationHelpers = (() => {
  // internal helper to build an object, structured for the picker
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

  /**
   * build an array of relation objects from a path string
   * '.' stands for no relation
   * '.table' stands for same table
   * @param {*} path relation path string separated by '.', the first token is the source table
   * @param {*} tableNameCache an object with table name as key and table object as value
   * @returns
   */
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

  /**
   * build an array of relation objects from a legacy relation
   * @param {string} type relation type (ChildList, Independent, Own, OneToOneShow, ParentShow)
   * @param {string} rest rest of the legaccy relation
   * @param {string} parentTbl source table
   * @returns
   */
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
    ROW_REQUIRED: "ROW_REQUIRED",
    NO_ROW_LIMIT: "NO_ROW_LIMIT",
    INVALID: "INVALID",
  };

  /**
   * prepare the relations finder
   * @param {object} tablesCache
   * @param {object} allViews
   * @param {number} maxDepth
   */
  const RelationsFinder = function (tablesCache, allViews, maxDepth) {
    this.maxDepth = +maxDepth;
    if (isNaN(this.maxDepth)) {
      console.log(`maxDepth '${maxDepth}' is not a number, set to 6`);
      this.maxDepth = 6;
    }
    this.allViews = allViews;
    const { tableIdCache, tableNameCache, fieldCache } = tablesCache;
    this.tableIdCache = tableIdCache;
    this.tableNameCache = tableNameCache;
    this.fieldCache = fieldCache;
  };

  /**
   * find relations between a source table and a subview
   * @param {string} sourceTblName
   * @param {string} subView
   * @param {string[]} excluded
   * @returns {object} {paths: string[], layers: object}
   */
  RelationsFinder.prototype.findRelations = function (
    sourceTblName,
    subView,
    excluded
  ) {
    let paths = [];
    const layers = { table: sourceTblName, inboundKeys: [], fkeys: [] };
    try {
      const view = this.allViews.find((v) => v.name === subView);
      if (!view) throw new Error(`The view ${subView} does not exist`);
      if (excluded?.find((e) => e === view.viewtemplate)) {
        console.log(`view ${subView} is excluded`);
        return { paths, layers };
      }
      switch (view.display_type) {
        case ViewDisplayType.ROW_REQUIRED:
          paths = this.singleRelationPaths(sourceTblName, subView, excluded);
          break;
        case ViewDisplayType.NO_ROW_LIMIT:
          paths = this.multiRelationPaths(sourceTblName, subView, excluded);
          break;
        default:
          throw new Error(
            `view ${subView}: The displayType (${view.display_type}) is not valid`
          );
      }
      for (const path of paths)
        buildLayers(path, parseRelationPath(path, this.tableNameCache), layers);
    } catch (error) {
      console.log(error);
    } finally {
      return { paths, layers };
    }
  };

  /**
   * find relations between a source table and a subview with single row display (e.g. show)
   * @param {string} sourceTblName
   * @param {string} subView
   * @param {string[]} excluded
   * @returns
   */
  RelationsFinder.prototype.singleRelationPaths = function (
    sourceTblName,
    subView,
    excluded
  ) {
    const result = [];
    const subViewObj = this.allViews.find((v) => v.name === subView);
    if (!subViewObj) throw new Error(`The view ${subView} does not exist`);
    if (excluded?.find((e) => e === subViewObj.viewtemplate)) {
      console.log(`view ${subView} is excluded`);
      return result;
    }
    const sourceTbl = this.tableNameCache[sourceTblName];
    if (!sourceTbl)
      throw new Error(`The table ${sourceTblName} does not exist`);
    // 1. parent relations
    const parentRelations = sourceTbl.foreign_keys;
    if (sourceTbl.id === subViewObj.table_id) result.push(`.${sourceTblName}`);
    for (const relation of parentRelations) {
      const targetTbl = this.tableNameCache[relation.reftable_name];
      if (!targetTbl)
        throw new Error(`The table ${relation.reftable_name} does not exist`);
      if (targetTbl.id === subViewObj.table_id)
        result.push(`.${sourceTblName}.${relation.name}`);
    }
    // 2. OneToOneShow
    const uniqueFksToSrc = (this.fieldCache[sourceTblName] || []).filter(
      (f) => f.is_unique
    );
    for (const relation of uniqueFksToSrc) {
      const targetTbl = this.tableIdCache[relation.table_id];
      if (!targetTbl)
        throw new Error(`The table ${relation.table_id} does not exist`);
      if (targetTbl.id === subViewObj.table_id)
        result.push(`.${sourceTblName}.${targetTbl.name}$${relation.name}`);
    }
    // 3. inbound_self_relations
    const srcFks = sourceTbl.foreign_keys;
    for (const fkToSrc of uniqueFksToSrc) {
      const refTable = this.tableIdCache[fkToSrc.table_id];
      if (!refTable)
        throw new Error(`The table ${fkToSrc.table_id} does not exist`);
      const fromSrcToRef = srcFks.filter(
        (field) => field.reftable_name === refTable.name
      );
      for (const toRef of fromSrcToRef) {
        if (fkToSrc.reftable_name === sourceTblName)
          result.push(`.${sourceTblName}.${toRef.name}.${fkToSrc.name}`);
      }
    }
    return result;
  };

  /**
   * find relations between a source table and a subview with multiple rows display (e.g. list)
   * @param {string} sourceTblName
   * @param {string} subView
   * @param {string[]} excluded
   * @returns
   */
  RelationsFinder.prototype.multiRelationPaths = function (
    sourceTblName,
    subView,
    excluded
  ) {
    const result = ["."]; // none no relation
    const subViewObj = this.allViews.find((v) => v.name === subView);
    if (!subViewObj) throw new Error(`The view ${subView} does not exist`);
    if (excluded?.find((e) => e === subViewObj.viewtemplate)) {
      console.log(`view ${subView} is excluded`);
      return result;
    }
    const sourceTbl = this.tableNameCache[sourceTblName];
    if (!sourceTbl)
      throw new Error(`The table ${sourceTblName} does not exist`);
    const searcher = (current, path, level, visited) => {
      if (level > this.maxDepth) return;
      const visitedFkCopy = new Set(visited);
      const fks = current.foreign_keys.filter((f) => !visitedFkCopy.has(f.id));
      for (const fk of fks) {
        visitedFkCopy.add(fk.id);
        const target = this.tableNameCache[fk.reftable_name];
        if (!target)
          throw new Error(`The table ${fk.reftable_name} does not exist`);
        const newPath = `${path}.${fk.name}`;
        if (target.id === subViewObj.table_id) result.push(newPath);
        searcher(target, newPath, level + 1, visitedFkCopy);
      }

      const visitedInboundCopy = new Set(visited);
      const inbounds = (this.fieldCache[current.name] || []).filter(
        (f) => !visitedInboundCopy.has(f.id)
      );
      for (const inbound of inbounds) {
        visitedInboundCopy.add(inbound.id);
        const target = this.tableIdCache[inbound.table_id];
        if (!target)
          throw new Error(`The table ${inbound.table_id} does not exist`);
        const newPath = `${path}.${target.name}$${inbound.name}`;
        if (target.id === subViewObj.table_id) result.push(newPath);
        searcher(target, newPath, level + 1, visitedInboundCopy);
      }
    };
    const path = `.${sourceTblName}`;
    const visited = new Set();
    searcher(sourceTbl, path, 0, visited);
    return result;
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
