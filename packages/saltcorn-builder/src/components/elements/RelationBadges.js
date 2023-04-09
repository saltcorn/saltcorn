import React, { Fragment, useContext, useState } from "react";
import { parseRelationPath, parseLegacyRelation } from "./utils";

const buildBadgeCfgs = (parsed, parentTbl) => {
  const result = [];
  let currentCfg = null;
  for (const { type, table, key } of parsed) {
    if (type === "Inbound") {
      if (currentCfg) result.push(currentCfg);
      currentCfg = { up: key, table };
    } else {
      if (!currentCfg) result.push({ down: key, table: parentTbl });
      else {
        currentCfg.down = key;
        result.push(currentCfg);
      }
      currentCfg = { table };
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
};

const buildBadge = ({ up, table, down }, index) => {
  return (
    <div
      key={`badge_${table}_${index}`}
      className="my-2 d-flex justify-content-center"
    >
      <div className="d-flex flex-column align-items-center badge bg-primary">
        {up ? (
          <div className="mt-1 d-flex justify-content-center">
            <span className="pe-2">{up}</span>
            <i className="fas fa-arrow-up"></i>
          </div>
        ) : (
          ""
        )}
        <div className="m-1 h6">{table}</div>
        {down ? (
          <div className="mb-1 d-flex justify-content-center">
            <span className="pe-2">{down}</span>
            <i className="fas fa-arrow-down"></i>
          </div>
        ) : (
          ""
        )}
      </div>
    </div>
  );
};

export const RelationBadges = ({ view, parentTbl, fk_options }) => {
  const [prefix, rest] = view.split(":");
  if (rest.startsWith(".")) {
    const parsed = parseRelationPath(rest, fk_options);
    return buildBadgeCfgs(parsed, parentTbl).map(buildBadge);
  } else {
    const parsed = parseLegacyRelation(prefix, rest, parentTbl);
    if (
      parsed.length === 1 &&
      (parsed[0].type === "Independent" || parsed[0].type === "Own")
    )
      return buildBadge({ table: parsed[0].table }, 0);
    else return buildBadgeCfgs(parsed, parentTbl).map(buildBadge);
  }
};
