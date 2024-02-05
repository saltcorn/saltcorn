import React from "react";
import { removeWhitespaces } from "./utils";
import { parseLegacyRelation, RelationType } from "@saltcorn/common-code";

const buildBadgeCfgs = (sourceTblName, type, path, caches) => {
  if (type === RelationType.OWN)
    return [{ table: `${sourceTblName} (same table)` }];
  else if (type === RelationType.INDEPENDENT)
    return [{ table: "None (no relation)" }];
  else if (path.length === 0) return [{ table: "invalid relation" }];
  else {
    const result = [];
    let currentCfg = null;
    let currentTbl = sourceTblName;
    for (const pathElement of path) {
      if (pathElement.inboundKey) {
        if (currentCfg) result.push(currentCfg);
        currentTbl = pathElement.table;
        currentCfg = { up: pathElement.inboundKey, table: currentTbl };
      } else if (pathElement.fkey) {
        if (!currentCfg)
          result.push({ down: pathElement.fkey, table: currentTbl });
        else {
          currentCfg.down = pathElement.fkey;
          result.push(currentCfg);
        }
        const tblObj = caches.tableNameCache[currentTbl];
        const fkey = tblObj.foreign_keys.find(
          (key) => key.name === pathElement.fkey
        );
        currentTbl = fkey.reftable_name;
        currentCfg = { table: currentTbl };
      }
    }
    if (
      currentCfg &&
      !result.find(
        ({ down, table, up }) =>
          down === currentCfg.down &&
          table === currentCfg.table &&
          up === currentCfg.up
      )
    )
      result.push(currentCfg);
    return result;
  }
};

const buildBadge = ({ up, table, down }, index) => {
  return (
    <div
      key={removeWhitespaces(`badge_${table}_${index}`)}
      className="my-1 d-flex"
    >
      <div className="m-auto badge bg-primary">
        {up ? (
          <div className="mt-1 d-flex justify-content-center">
            <span className="pe-2">{up}</span>
            <i className="fas fa-arrow-up"></i>
          </div>
        ) : (
          ""
        )}
        <div className="m-1 fw-bolder">{table}</div>
        {down ? (
          <div className="mb-1 d-flex justify-content-center">
            <span className="pe-2">{down}</span>
            <i className="fas fa-arrow-down" style={{ marginTop: "-1px" }}></i>
          </div>
        ) : (
          ""
        )}
      </div>
    </div>
  );
};

export const RelationBadges = ({ view, relation, parentTbl, caches }) => {
  if (relation) {
    return (
      <div className="overflow-scroll">
        {buildBadgeCfgs(
          relation.sourceTblName,
          relation.type,
          relation.path,
          caches
        ).map(buildBadge)}
      </div>
    );
  } else {
    if (!view) return buildBadge({ table: "invalid relation" }, 0);
    const [prefix, rest] = view.split(":");
    if (!rest) return buildBadge({ table: "invalid relation" }, 0);
    const { type, path } = parseLegacyRelation(prefix, rest, parentTbl);
    if (path.length === 0) return buildBadge({ table: "invalid relation" }, 0);
    else if (
      path.length === 1 &&
      (path[0].type === "Independent" || path[0].type === "Own")
    )
      return (
        <div className="overflow-scroll">
          {buildBadge({ table: path[0].table }, 0)}
        </div>
      );
    else
      return (
        <div className="overflow-scroll">
          {buildBadgeCfgs(parentTbl, path, type, caches).map(buildBadge)}
        </div>
      );
  }
};
