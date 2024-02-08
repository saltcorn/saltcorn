import { buildTableCaches } from "./relation_helpers";
import { ViewDisplayType } from "./relation_types";
import { Relation } from "./relation";

/**
 * RelationsFinder class
 * this finder searches for relations between a sourceTable (table of the topView)
 * and a subView (here the targetTable is used)
 */
export class RelationsFinder {
  private maxDepth: number;
  private allViews: any;
  private tableIdCache: any;
  private tableNameCache: any;
  private fieldCache: any;

  constructor(allTables: any, allViews: any, maxDepth: number) {
    this.maxDepth = +maxDepth;
    if (isNaN(this.maxDepth)) this.maxDepth = 6;
    this.allViews = allViews;
    const { tableIdCache, tableNameCache, fieldCache } =
      buildTableCaches(allTables);
    this.tableIdCache = tableIdCache;
    this.tableNameCache = tableNameCache;
    this.fieldCache = fieldCache;
  }

  /**
   * creates an array of Relation objects
   * @param sourceTblName
   * @param subView
   * @param excluded
   * @returns
   */
  public findRelations(
    sourceTblName: string,
    subView: string,
    excluded: string[]
  ): Array<Relation> {
    let result = new Array<Relation>();
    try {
      const view = this.allViews.find((v: any) => v.name === subView);
      if (!view) throw new Error(`The view ${subView} does not exist`);
      if (excluded?.find((e) => e === view.viewtemplate)) {
        console.log(`view ${subView} is excluded`);
        return result;
      }
      const subViewObj = this.allViews.find((v: any) => v.name === subView);
      const targetTbl = this.tableIdCache[subViewObj.table_id];
      if (!targetTbl) {
        result.push(new Relation(".", "", ViewDisplayType.NO_ROW_LIMIT));
        return result;
      }
      switch (view.display_type) {
        case ViewDisplayType.ROW_REQUIRED: {
          const paths = this.singleRelationPaths(
            sourceTblName,
            subView,
            excluded
          );
          for (const path of paths)
            result.push(
              new Relation(path, targetTbl.name, ViewDisplayType.ROW_REQUIRED)
            );
          break;
        }
        case ViewDisplayType.NO_ROW_LIMIT: {
          const paths = this.multiRelationPaths(
            sourceTblName,
            subView,
            excluded
          );
          for (const path of paths)
            result.push(
              new Relation(path, targetTbl.name, ViewDisplayType.NO_ROW_LIMIT)
            );
          break;
        }
        default:
          throw new Error(
            `view ${subView}: The displayType (${view.display_type}) is not valid`
          );
      }
    } catch (error) {
      console.log(error);
    } finally {
      return result;
    }
  }

  /**
   * This is a helper method for findRelations() it returns raw relation strings
   * @param sourceTblName
   * @param subView
   * @param excluded
   * @returns
   */
  singleRelationPaths(
    sourceTblName: string,
    subView: string,
    excluded: string[]
  ): Array<string> {
    const result = new Set<string>();
    const subViewObj = this.allViews.find((v: any) => v.name === subView);
    if (!subViewObj) throw new Error(`The view ${subView} does not exist`);
    if (excluded?.find((e) => e === subViewObj.viewtemplate)) {
      console.log(`view ${subView} is excluded`);
      return Array.from(result);
    }
    const sourceTbl = this.tableNameCache[sourceTblName];
    if (!sourceTbl)
      throw new Error(`The table ${sourceTblName} does not exist`);

    // 1. parent relations
    const parentRelsFinder = (
      currentTbl: any,
      path: string,
      level: number,
      visited: any
    ) => {
      if (level > this.maxDepth) return;
      const visitedFkCopy = new Set(visited);
      for (const fk of currentTbl.foreign_keys || []) {
        if (visitedFkCopy.has(fk.id)) continue;
        visitedFkCopy.add(fk.id);
        const nextPath = `${path}.${fk.name}`;
        const nextTbl = this.tableNameCache[fk.reftable_name];
        if (!nextTbl)
          throw new Error(`The table ${fk.reftable_name} does not exist`);
        if (nextTbl.id === subViewObj.table_id) result.add(nextPath);
        parentRelsFinder(nextTbl, nextPath, level + 1, visitedFkCopy);
      }
    };
    const startPath = `.${sourceTblName}`;
    if (sourceTbl.id === subViewObj.table_id) result.add(startPath);
    parentRelsFinder(sourceTbl, startPath, 0, new Set());

    // 2. OneToOneShow
    const uniqueFksToSrc = (this.fieldCache[sourceTblName] || []).filter(
      (f: any) => f.is_unique
    );
    for (const relation of uniqueFksToSrc) {
      const targetTbl = this.tableIdCache[relation.table_id];
      if (!targetTbl)
        throw new Error(`The table ${relation.table_id} does not exist`);
      if (targetTbl.id === subViewObj.table_id)
        result.add(`.${sourceTblName}.${targetTbl.name}$${relation.name}`);
    }
    // 3. inbound_self_relations
    const srcFks = sourceTbl.foreign_keys;
    for (const fkToSrc of uniqueFksToSrc) {
      const refTable = this.tableIdCache[fkToSrc.table_id];
      if (!refTable)
        throw new Error(`The table ${fkToSrc.table_id} does not exist`);
      const fromSrcToRef = srcFks.filter(
        (field: any) => field.reftable_name === refTable.name
      );
      for (const toRef of fromSrcToRef) {
        if (fkToSrc.reftable_name === sourceTblName)
          result.add(`.${sourceTblName}.${toRef.name}.${fkToSrc.name}`);
      }
    }
    return Array.from(result);
  }

  /**
   * This is a helper method for findRelations() it returns raw relation strings
   * @param sourceTblName
   * @param subView
   * @param excluded
   * @returns
   */
  multiRelationPaths(
    sourceTblName: string,
    subView: string,
    excluded: string[]
  ) {
    const result = ["."]; // none no relation
    const subViewObj = this.allViews.find((v: any) => v.name === subView);
    if (!subViewObj) throw new Error(`The view ${subView} does not exist`);
    if (excluded?.find((e) => e === subViewObj.viewtemplate)) {
      console.log(`view ${subView} is excluded`);
      return result;
    }
    const sourceTbl = this.tableNameCache[sourceTblName];
    if (!sourceTbl)
      throw new Error(`The table ${sourceTblName} does not exist`);
    if (sourceTbl.id === subViewObj.table_id) result.push(`.${sourceTblName}`);
    const searcher = (current: any, path: any, level: any, visited: any) => {
      if (level > this.maxDepth) return;
      const visitedFkCopy = new Set(visited);
      for (const fk of current.foreign_keys) {
        if (visitedFkCopy.has(fk.id)) continue;
        visitedFkCopy.add(fk.id);
        const target = this.tableNameCache[fk.reftable_name];
        if (!target)
          throw new Error(`The table ${fk.reftable_name} does not exist`);
        const newPath = `${path}.${fk.name}`;
        if (target.id === subViewObj.table_id) result.push(newPath);
        searcher(target, newPath, level + 1, visitedFkCopy);
      }

      const visitedInboundCopy = new Set(visited);
      for (const inbound of this.fieldCache[current.name] || []) {
        if (visitedInboundCopy.has(inbound.id)) continue;
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
  }
}
