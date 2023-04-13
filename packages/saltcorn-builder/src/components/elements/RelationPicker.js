/*global $, notifyAlert */
import React, { Fragment, useContext, useState } from "react";
import { parseRelationPath, parseLegacyRelation } from "./utils";

const parseRelations = (allOptions, viewname, parentTbl) => {
  const viewtable = allOptions.view_name_opts
    ? allOptions.view_name_opts.find((opt) => opt.name === viewname)?.table
    : undefined;
  const options = allOptions.view_relation_opts[viewname] || [];
  const result = { table: parentTbl, inboundKeys: [], fkeys: [] };
  if (!viewtable) return result;
  const warnings = [];
  for (const { value } of options) {
    let path = null;
    if (value.startsWith(".")) {
      path = parseRelationPath(value, allOptions.fk_options);
    } else {
      const [prefix, rest] = value.split(":");
      path = parseLegacyRelation(prefix, rest, parentTbl);
    }
    if (path.length > 0) buildLevels(value, path, result, parentTbl);
    else warnings.push(`The relation path '${value}' is invalid`);
  }
  if (warnings.length === 1) {
    notifyAlert({
      type: "danger",
      text: warnings[0],
    });
  } else if (warnings.length > 1) {
    notifyAlert({
      type: "danger",
      text: `Found multiple invalid relation paths`,
    });
    for (const warning of warnings) console.log(warning);
  }
  return result;
};

const buildLevels = (path, parsed, result, parentTbl) => {
  let currentLevel = result;
  for (const relation of parsed) {
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
      result.fkeys.push({
        name: "None (no relation)",
        table: "",
        inboundKeys: [],
        fkeys: [],
        relPath: path,
      });
    } else if (relation.type === "Own") {
      result.fkeys.push({
        name: `${parentTbl} (same table)`,
        table: "",
        inboundKeys: [],
        fkeys: [],
        relPath: path,
      });
    } else if (relation.type === "OneToOneShow") {
      result.inboundKeys.push({
        name: relation.key,
        table: relation.table,
        inboundKeys: [],
        fkeys: [],
        relPath: path,
      });
    }
  }
  currentLevel.relPath = path;
};

export const RelationPicker = ({ options, viewname, update }) => {
  const maxRecLevelDefault = 10;
  const [maxRecLevel, setMaxRecLevel] = useState(maxRecLevelDefault);
  const relationLevels = parseRelations(options, viewname, options.tableName);

  const levelClasses = (level) => {
    const classes = [];
    for (let i = level; i < maxRecLevel; i++) {
      classes.push(`.dropdown_level_${i}.show`);
    }
    return classes.join(",");
  };

  const activeClasses = (level) => {
    const classes = [];
    for (let i = level; i < maxRecLevel; i++) {
      classes.push(`.item_level_${i}.active`);
    }
    return classes.join(",");
  };

  const buildPicker = (level, reclevel) => {
    return (
      <div className="dropdown-menu">
        <h5 className="join-table-header text-center">{level.table}</h5>
        <ul className="ps-0 mb-0">
          {
            // foreign keys
            level.fkeys.map((fkey) => {
              const hasSubLevels =
                fkey.fkeys.length > 0 || fkey.inboundKeys.length > 0;
              const identifier = `${fkey.name}_${fkey.table}_${level.table}_${reclevel}`;
              return hasSubLevels ? (
                <li
                  key={`${identifier}_fkey_key`}
                  className={`dropdown-item ${identifier}_fkey_item item_level_${reclevel} ${
                    reclevel < 5 ? "dropstart" : "dropdown"
                  }`}
                  role="button"
                >
                  <div
                    className={`dropdown-toggle ${identifier}_fkey_toggle dropdown_level_${reclevel}`}
                    role="button"
                    aria-expanded="false"
                    onClick={() => {
                      $(
                        `.${identifier}_fkey_toggle,${levelClasses(reclevel)}`
                      ).dropdown("toggle");
                      if (reclevel > maxRecLevel) setMaxRecLevel(reclevel);
                      $(activeClasses(reclevel)).removeClass("active");
                      $(`.${identifier}_fkey_item`).addClass(() => "active");
                    }}
                  >
                    {fkey.name}
                  </div>
                  {buildPicker(fkey, reclevel + 1)}
                </li>
              ) : (
                <li
                  key={`${identifier}_fkey_key`}
                  className="dropdown-item"
                  role="button"
                  onClick={() => {
                    update(fkey.relPath);
                    $(".dropdown-item.active").removeClass("active");
                    $(`${levelClasses(0)}`).dropdown("toggle");
                    setMaxRecLevel(maxRecLevelDefault);
                  }}
                >
                  {fkey.name}
                </li>
              );
            })
          }
          {
            // inbound keys
            level.inboundKeys.map((inboundKey) => {
              const hasSubLevels =
                inboundKey.fkeys.length > 0 ||
                inboundKey.inboundKeys.length > 0;
              const identifier = `${inboundKey.name}_${inboundKey.table}_${inboundKey.table}_${reclevel}`;
              return hasSubLevels ? (
                <li
                  key={`${identifier}_inboundkey_key`}
                  className={`dropdown-item ${identifier}_inbound_item item_level_${reclevel} ${
                    reclevel < 5 ? "dropstart" : "dropdown"
                  }`}
                  role="button"
                >
                  <div
                    className={`dropdown-toggle ${identifier}_inbound_toggle dropdown_level_${reclevel}`}
                    role="button"
                    aria-expanded="false"
                    onClick={() => {
                      $(
                        `.${identifier}_inbound_toggle,${levelClasses(
                          reclevel
                        )}`
                      ).dropdown("toggle");
                      if (reclevel > maxRecLevel) setMaxRecLevel(reclevel);
                      $(activeClasses(reclevel)).removeClass("active");
                      $(`.${identifier}_inbound_item`).addClass(() => "active");
                    }}
                  >
                    {inboundKey.name} (from {inboundKey.table})
                  </div>
                  {buildPicker(inboundKey, reclevel + 1)}
                </li>
              ) : (
                <li
                  key={`${identifier}_inboundkey_key`}
                  className="dropdown-item"
                  role="button"
                  onClick={() => {
                    update(inboundKey.relPath);
                    $(".dropdown-item.active").removeClass("active");
                    $(`${levelClasses(0)}`).dropdown("toggle");
                    setMaxRecLevel(maxRecLevelDefault);
                  }}
                >
                  {inboundKey.name} (from {inboundKey.table})
                </li>
              );
            })
          }
        </ul>
      </div>
    );
  };

  return (
    <div>
      <label>Relation</label>
      <div style={{ zIndex: 10000 }} className="dropstart">
        <button
          id="_relation_picker_toggle_"
          className="btn btn-outline-primary dropdown-toggle dropdown_level_0 mb-1"
          aria-expanded="false"
          onClick={() => {
            $(".dropdown-item.active").removeClass("active");
            $(`#_relation_picker_toggle_,${levelClasses(0)}`).dropdown(
              "toggle"
            );
            setMaxRecLevel(maxRecLevelDefault);
          }}
        >
          Select
        </button>
        {buildPicker(relationLevels, 1)}
      </div>
    </div>
  );
};
