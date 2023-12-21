import React from "react";
import { removeWhitespaces } from "./utils";

const buildBadgeCfgs = (parsed, parentTbl) => {
  const result = [];
  let currentCfg = null;
  for (const { type, table, key } of parsed) {
    if (type === "Inbound") {
      if (currentCfg) result.push(currentCfg);
      currentCfg = { up: key, table };
    } else {
      if (!currentCfg && key) result.push({ down: key, table: parentTbl });
      else if (currentCfg) {
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

export const RelationBadges = ({
  view,
  relation,
  parentTbl,
  tableNameCache,
}) => {
  if (relation) {
    const parsed = relationHelpers.parseRelationPath(relation, tableNameCache);

    return (
      <div className="overflow-scroll">
        {parsed.length > 0
          ? buildBadgeCfgs(parsed, parentTbl).map(buildBadge)
          : buildBadge({ table: "invalid relation" }, 0)}
      </div>
    );
  } else {
    if (!view) return buildBadge({ table: "invalid relation" }, 0);
    const [prefix, rest] = view.split(":");
    const parsed = relationHelpers.parseLegacyRelation(prefix, rest, parentTbl);
    if (parsed.length === 0)
      return buildBadge({ table: "invalid relation" }, 0);
    else if (
      parsed.length === 1 &&
      (parsed[0].type === "Independent" || parsed[0].type === "Own")
    )
      return (
        <div className="overflow-scroll">
          {buildBadge({ table: parsed[0].table }, 0)}
        </div>
      );
    else
      return (
        <div className="overflow-scroll">
          {buildBadgeCfgs(parsed, parentTbl).map(buildBadge)}
        </div>
      );
  }
};
