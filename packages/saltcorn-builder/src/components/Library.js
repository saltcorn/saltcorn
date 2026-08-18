/**
 * @category saltcorn-builder
 * @module components/Library
 * @subcategory components
 */

import React, {
  useEffect,
  useContext,
  useState,
  Fragment,
  useRef,
  useMemo,
} from "react";
import useTranslation from "../hooks/useTranslation";
import { useEditor, useNode } from "@craftjs/core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTimes } from "@fortawesome/free-solid-svg-icons";
import FontIconPicker from "@fonticonpicker/react-fonticonpicker";
import { craftToSaltcorn, layoutToNodes, resolveLibraryRefs } from "./storage";
import optionsCtx from "./context";
import { WrapElem } from "./Toolbox";
import { isEqual, throttle, chunk } from "lodash";
import { LibraryInstance } from "./elements/LibraryInstance";

// true while loading a saved layout into the canvas, so nothing gets
// accidentally auto-selected along the way
export const hydratingRef = { current: false };

const getSelectedNodes = (selected) => {
  if (!selected) return [];
  if (typeof selected.has === "function") {
    return [...selected];
  }
  return [selected];
};

export /**
 * @param {object} props
 * @param {*} props.name
 * @param {*} props.layout
 * @returns {Fraggment}
 * @category saltcorn-builder
 * @subcategory components
 * @namespace
 */
const LibraryElem = ({ name, layout }) => {
  const {
    selected,
    connectors: { connect, drag },
  } = useNode((node) => ({ selected: node.events.selected }));
  return (
    <Fragment>
      <span
        className={selected ? "selected-node" : ""}
        ref={(dom) => connect(drag(dom))}
      >
        LibElem
      </span>
      <br />
    </Fragment>
  );
};

/**
 * @type {object}
 */
LibraryElem.craft = {
  displayName: "LibraryElem",
};

// https://www.developerway.com/posts/debouncing-in-react
const useThrottle = (callback) => {
  const ref = useRef();

  useEffect(() => {
    ref.current = callback;
  }, [callback]);

  const debouncedCallback = useMemo(() => {
    const func = () => {
      ref.current?.();
    };

    return throttle(func, 3000);
  }, []);

  return debouncedCallback;
};

export /**
 * Renders nothing - just wires up autosave and turns a freshly dropped
 * library item into a real linked instance.
 * @param {object} props
 * @param {object} props.nodekeys
 * @returns {object[]}
 * @category saltcorn-builder
 * @subcategory components
 * @namespace
 */
const InitNewElement = ({ nodekeys, savingState, setSavingState }) => {
  const savedData = useRef(false);
  const { actions, query, connectors } = useEditor((state, query) => {
    return {};
  });
  const { t } = useTranslation();
  const options = useContext(optionsCtx);

  const lastReload = useRef(null);
  const rebuildInProgress = useRef(false);

  const reloadEntityContentFromServer = async () => {
    if (!query.serialize) return;
    if (lastReload.current && new Date() - lastReload.current < 1000) return;
    lastReload.current = new Date();

    const urlroot = options.page_id ? "pageedit" : "viewedit";
    const response = await fetch(
      `/${urlroot}/getlayout/${options.page_id || options.view_id}`
    );
    const { layout } = await response.json();

    if (!layout) return;

    const data = craftToSaltcorn(
      JSON.parse(query.serialize()),
      "ROOT",
      options
    );
    if (
      isEqual(
        JSON.parse(JSON.stringify(layout)),
        JSON.parse(JSON.stringify(data.layout))
      )
    )
      return;

    try {
      rebuildInProgress.current = true;
      hydratingRef.current = true;
      savedData.current = JSON.stringify(layout);
      actions.selectNode();
      query
        .node("ROOT")
        .childNodes()
        .forEach((child) => {
          actions.delete(child);
        });
      await resolveLibraryRefs(layout, options);
      layoutToNodes(layout, query, actions.history.ignore(), "ROOT", options);
    } catch (e) {
      console.error("rebuild error", e);
    } finally {
      rebuildInProgress.current = false;
      hydratingRef.current = false;
    }
  };

  const handleVisibilityChange = () => {
    if (document.hidden === false) reloadEntityContentFromServer();
  };

  const handlePageShow = (event) => {
    if (event.persisted || window.performance?.navigation.type === 2)
      reloadEntityContentFromServer();
  };

  useEffect(() => {
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [handleVisibilityChange]);

  useEffect(() => {
    window.addEventListener("pageshow", handlePageShow);
    return () => {
      document.removeEventListener("pageshow", handlePageShow);
    };
  }, [handlePageShow]);

  // is id (or a child of it) selected? checked via Craft.js, since editing
  // happens in the settings panel, not the canvas DOM
  const isNodeSelected = (id) => {
    const selectedIds = query.getEvent("selected").all();
    const within = query.node(id).descendants(true);
    return selectedIds.some((sid) => within.includes(sid));
  };

  const doSave = (query, keepalive) => {
    if (!query.serialize) return;
    if (rebuildInProgress.current) return;
    const data = craftToSaltcorn(
      JSON.parse(query.serialize()),
      "ROOT",
      options
    );
    const urlroot = options.page_id ? "pageedit" : "viewedit";
    // also compare libraryUpdates - editing a shared component doesn't
    // change this page's own layout, but still needs saving
    const comparable = JSON.stringify({
      layout: data.layout,
      libraryUpdates: data.libraryUpdates,
    });
    if (savedData.current === false) {
      //do not save on first call
      savedData.current = comparable;

      return;
    }
    if (isEqual(savedData.current, comparable)) return;
    savedData.current = comparable;
    setSavingState({ isSaving: true });

    // dedupe by library_id, preferring the selected placement, so an
    // untouched duplicate can't overwrite the one being edited
    const byLibraryId = {};
    (data.libraryUpdates || []).forEach((u) => {
      const existing = byLibraryId[u.library_id];
      if (!existing || (u.node_id && isNodeSelected(u.node_id)))
        byLibraryId[u.library_id] = u;
    });
    const libraryUpdates = Object.values(byLibraryId);

    fetch(`/${urlroot}/savebuilder/${options.page_id || options.view_id}`, {
      method: "POST", // or 'PUT'
      keepalive, //this is conditional bec body size is limited to 64KB
      headers: {
        "Content-Type": "application/json",
        "CSRF-Token": options.csrfToken,
      },
      body: JSON.stringify({
        layout: data.layout,
        columns: data.columns,
        libraryUpdates,
      }),
    })
      .then((response) => {
        response.json().then((respData) => {
          if (typeof respData?.error === "string") {
            // don't log duplicates
            if (!savingState.error)
              window.notifyAlert({ type: "danger", text: respData.error });
            setSavingState({ isSaving: false, error: respData.error });
          } else {
            setSavingState({ isSaving: false });
          }
        });
      })
      .catch((e) => {
        const text =
          e.message === "Failed to fetch"
            ? t("Network connection lost")
            : e || t("Unable to save");
        // don't log duplicates
        if (savingState.error) setSavingState({ isSaving: false, error: text });
        else {
          window.notifyAlert({ type: "danger", text: text });
          setSavingState({
            isSaving: false,
            error: text,
          });
        }
      });
  };
  useEffect(() => {
    window.addEventListener("beforeunload", () => doSave(query, true));
    window.addEventListener("blur", () => doSave(query));
    window.addEventListener("pagehide", () => doSave(query));
  }, []);
  const throttledSave = useThrottle(() => {
    doSave(query);
  });
  const onNodesChange = (arg, arg1) => {
    const nodes = arg.getSerializedNodes();
    const newNodeIds = [];
    Object.keys(nodes).forEach((id) => {
      if (!nodekeys.current.includes(id)) {
        newNodeIds.push(id);
      }
    });
    nodekeys.current = Object.keys(nodes);
    if (newNodeIds.length === 1) {
      const id = newNodeIds[0];
      const node = nodes[id];
      if (node.displayName === "LibraryElem") {
        const parent = node.parent;
        // fetch fresh rather than trust the sidebar's page-load snapshot -
        // the shared component may have been edited since this page loaded
        fetch(`/library/content/${node.props.id}`, {
          headers: { "CSRF-Token": options.csrfToken },
        })
          .then((r) => r.json())
          .then(async (lib) => {
            if (lib.error) {
              window.notifyAlert({ type: "danger", text: lib.error });
              actions.delete(id);
              return;
            }
            const libLayout = lib.layout?.layout ? lib.layout.layout : lib.layout || {};
            // resolve any library references nested inside this one too,
            // so dropping a library-in-a-library doesn't leave a gap
            await resolveLibraryRefs(libLayout, options, new Set([lib.id]));
            const wrapperNode = query
              .parseReactElement(
                <LibraryInstance
                  library_id={lib.id}
                  library_name={lib.name}
                />
              )
              .toNodeTree();
            actions.addNodeTree(wrapperNode, parent);
            layoutToNodes(
              libLayout,
              query,
              actions,
              wrapperNode.rootNodeId,
              options
            );
            actions.delete(id);
          });
      } else if (node.displayName !== "Column" && !hydratingRef.current) {
        actions.selectNode(id);
      }
    }

    throttledSave();
  };
  useEffect(() => {
    const nodes = query.getSerializedNodes();
    nodekeys.current = Object.keys(nodes);
    actions.setOptions((options) => {
      // chain onto any existing handler instead of replacing it
      const oldf = options.onNodesChange;
      options.onNodesChange = oldf
        ? (q) => {
            oldf(q);
            onNodesChange(q);
          }
        : onNodesChange;
    });
  }, []);

  return [];
};

export /**
 * @category saltcorn-builder
 * @returns {div}
 * @subcategory components
 * @namespace
 */
const Library = ({ expanded }) => {
  const { actions, selected, selectedNodes, query, connectors } = useEditor(
    (state, query) => ({
      selected: getSelectedNodes(state.events.selected)[0] || null,
      selectedNodes: getSelectedNodes(state.events.selected),
    })
  );
  const { t } = useTranslation();
  const options = useContext(optionsCtx);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [icon, setIcon] = useState();
  const [recent, setRecent] = useState([]);

  /**
   * @returns {void}
   */
  const addSelected = () => {
    if (!selected && selectedNodes.length === 0) return;
    const nodeToSave = selected || selectedNodes[0];
    const layout = craftToSaltcorn(
      JSON.parse(query.serialize()),
      nodeToSave,
      options
    );
    const data = { layout, icon, name: newName };
    fetch(`/library/savefrombuilder`, {
      method: "POST", // or 'PUT'
      headers: {
        "Content-Type": "application/json",
        "CSRF-Token": options.csrfToken,
      },
      body: JSON.stringify(data),
    })
      .then((r) => r.json())
      .then(({ id }) => {
        // needed so this item can be linked (fetched by id) without a
        // page reload, same as items already loaded from the server
        setRecent((r) => [...r, { ...data, id }]);
        // replace what was just saved with a linked instance of it, so the
        // spot it was saved from also stays in sync with the library from now on
        const savedNode = query.node(nodeToSave).get();
        const parentId = savedNode.data.parent;
        const siblings = query.node(parentId).get().data.nodes;
        const ix = siblings.indexOf(nodeToSave);
        const wrapperNode = query
          .parseReactElement(
            <LibraryInstance library_id={id} library_name={newName} />
          )
          .toNodeTree();
        actions.addNodeTree(wrapperNode, parentId, ix);
        layoutToNodes(
          layout.layout,
          query,
          actions,
          wrapperNode.rootNodeId,
          options
        );
        actions.delete(nodeToSave);
      });
    setAdding(false);
    setIcon();
    setNewName("");
  };

  const elemRows = chunk(
    [...(options.library || []), ...recent],
    expanded ? 3 : 2
  );
  return (
    <div className="builder-library">
      <div className="dropdown">
        <button
          className="btn btn-sm btn-secondary dropdown-toggle mt-2"
          type="button"
          id="library-add-btn"
          aria-haspopup="true"
          aria-expanded="false"
          disabled={!selected && selectedNodes.length === 0}
          onClick={() => setAdding(!adding)}
        >
          <FontAwesomeIcon icon={faPlus} className="me-1" />
          {t("Add")}
        </button>
        <div
          className={`dropdown-menu py-3 px-4 ${adding ? "show" : ""}`}
          aria-labelledby="library-add-btn"
        >
          <label>{t("Name")}</label>
          <input
            type="text"
            className="form-control"
            value={newName}
            onChange={(e) => e?.target && setNewName(e.target.value)}
          />
          <br />
          <label>{t("Icon")}</label>
          <FontIconPicker
            className="w-100"
            value={icon}
            icons={options.icons}
            onChange={setIcon}
            isMulti={false}
          />
          <button className={`btn btn-primary mt-3`} onClick={addSelected}>
            <FontAwesomeIcon icon={faPlus} className="me-1" />
            {t("Add")}
          </button>
          <button
            className={`btn btn-outline-secondary ms-2 mt-3`}
            onClick={() => setAdding(false)}
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
      </div>
      <div className="card mt-2">
        {elemRows.map((els, ix) => (
          <div className="toolbar-row" key={ix}>
            {els.map((l, ix) => (
              <WrapElem
                key={ix}
                connectors={connectors}
                icon={l.icon}
                label={l.name}
              >
                <LibraryElem
                  id={l.id}
                  name={l.name}
                  layout={l.layout}
                ></LibraryElem>
              </WrapElem>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
