/* globals $ */

import React from "react";
import { createRoot } from "react-dom/client";
import { removeWhitespaces, rand_ident } from "./utils";
import useTranslation from "../../hooks/useTranslation";

const maxLevelDefault = 10;
const renderInto = (container, node) => {
  if (!container) return;
  const root = container.__scRoot || createRoot(container);
  container.__scRoot = root;
  root.render(node);
};

const keyLabel = (key, type) =>
  type === "fk" ? `${key.name}` : `${key.name} (from ${key.table})`;

const toggleLayers = (layer, maxLevel, additionalSelectors = []) => {
  const selectors = [];
  for (let i = layer; i < maxLevel; i++) {
    selectors.push(`.dropdown_level_${i}.show`);
  }
  selectors.push(...additionalSelectors);
  if (selectors.length) $(`${selectors.join(",")}`).dropdown("toggle");
};

const setActiveClasses = (level, maxLevel, itemId) => {
  const classes = [];
  for (let i = level; i < maxLevel; i++) {
    classes.push(`.item_level_${i}.active`);
  }
  if (classes.length > 0) $(classes.join(",")).removeClass("active");
  $(`#${itemId}`).addClass(() => "active");
};

const removeAllActiveClasses = () => {
  $(".dropdown-item.active").removeClass("active");
};

const hasSubLevels = (relation) =>
  relation.fkeys?.length > 0 || relation.inboundKeys?.length > 0;

/**
 *
 * @param {*} param0
 * @returns
 */
const Relation = ({ cfg }) => {
  const { relation, ix, level, type, update, maxLevel, setMaxLevel } = cfg;

  const setRelation = (key) => {
    update(key.relPath);
    removeAllActiveClasses();
    toggleLayers(0, maxLevel);
    setMaxLevel(maxLevelDefault, maxLevel);
  };
  const identifier = removeWhitespaces(
    `${relation.name}_${relation.table}_${type}_${ix}_${level}_${rand_ident()}`
  );

  if (hasSubLevels(relation)) {
    const itemId = `${identifier}_sub_key`;
    const toggleId = `${identifier}_toggle`;
    const nextDropId = `${identifier}_next_drop`;
    return (
      <div key={`${identifier}_key_div`}>
        <li
          id={itemId}
          key={itemId}
          className={`dropdown-item item_level_${level} ${
            level < 5 ? "dropstart" : "dropdown"
          } `}
          role="button"
        >
          <div
            key={toggleId}
            id={toggleId}
            className={`dropdown-toggle dropdown_level_${level}`}
            role="button"
            aria-expanded="false"
            onClick={() => {
              const layerCfg = {
                layer: relation,
                level: level + 1,
                update,
                maxLevel,
                setMaxLevel,
              };
              const container = document.getElementById(nextDropId);
              renderInto(container, <RelationLayer cfg={layerCfg} />);
              toggleLayers(level, maxLevel, [`#${toggleId}`]);
              setActiveClasses(level, maxLevel, itemId);
              if (level > maxLevel) setMaxLevel(level);
            }}
          >
            {keyLabel(relation, type)}
          </div>
          <div key={nextDropId} id={nextDropId} className="dropdown-menu"></div>
        </li>
        {/* has the layer a direct link ? */}
        {relation.relPath ? (
          <li
            key={`${identifier}_direct_key`}
            className="dropdown-item"
            role="button"
            onClick={() => {
              setRelation(relation);
            }}
          >
            {keyLabel(relation, type)}
          </li>
        ) : (
          ""
        )}
      </div>
    );
  } else {
    return (
      <li
        key={`${identifier}_key`}
        className="dropdown-item"
        role="button"
        onClick={() => {
          setRelation(relation);
        }}
      >
        {keyLabel(relation, type)}
      </li>
    );
  }
};

/**
 *
 * @param {*} param0
 * @returns
 */
const RelationLayer = ({ cfg }) => {
  const { layer, level, update, maxLevel, setMaxLevel } = cfg;
  const reactKey = (relation, type, ix) =>
    `_rel_layer_${level}_${type}_${ix}_${relation.name}_`;
  return (
    <div>
      <h5 className="join-table-header text-center">{layer.table}</h5>
      <ul className="ps-0 mb-0">
        {layer.fkeys.map((relation, ix) => (
          <Relation
            key={reactKey(relation, "fk", ix)}
            cfg={{
              relation,
              ix,
              level,
              type: "fk",
              update,
              maxLevel,
              setMaxLevel,
            }}
          />
        ))}
        {layer.inboundKeys.map((relation, ix) => (
          <Relation
            key={reactKey(relation, "inbound", ix)}
            cfg={{
              relation,
              ix,
              level,
              type: "inbound",
              update,
              maxLevel,
              setMaxLevel,
            }}
          />
        ))}
      </ul>
    </div>
  );
};

/**
 *
 * @param {*} param0
 * @returns
 */
export const RelationOnDemandPicker = ({ relations, update }) => {
  const { t } = useTranslation();
  const [maxLevel, setMaxLevel] = React.useState(maxLevelDefault);
  const toggleId = "_relation_picker_toggle_";
  const layerCfg = {
    layer: relations,
    level: 1,
    update,
    maxLevel,
    setMaxLevel,
  };
  return (
    <div>
      <label>{t("Relation")}</label>
      <div style={{ zIndex: 10000 }} className="dropstart">
        <button
          id={toggleId}
          className="btn btn-outline-primary dropdown-toggle dropdown_level_0 mb-1"
          aria-expanded="false"
          onClick={() => {
            removeAllActiveClasses();
            toggleLayers(0, maxLevel, [`#${toggleId}`]);
            setMaxLevel(maxLevelDefault);
          }}
        >
          {t("Select")}
        </button>
        <div className="dropdown-menu">
          <RelationLayer cfg={layerCfg} />
        </div>
      </div>
    </div>
  );
};
