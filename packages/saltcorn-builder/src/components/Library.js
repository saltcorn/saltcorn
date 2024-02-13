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
import { useEditor, useNode } from "@craftjs/core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTimes } from "@fortawesome/free-solid-svg-icons";
import FontIconPicker from "@fonticonpicker/react-fonticonpicker";
import faIcons from "./elements/faicons";
import { craftToSaltcorn, layoutToNodes } from "./storage";
import optionsCtx from "./context";
import { WrapElem } from "./Toolbox";
import { isEqual, throttle, chunk } from "lodash";

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
 * @param {object} props
 * @param {object} props.nodekeys
 * @returns {object[]}
 * @category saltcorn-builder
 * @subcategory components
 * @namespace
 */
const InitNewElement = ({ nodekeys, savingState, setSavingState }) => {
  const [saveTimeout, setSaveTimeout] = useState(false);
  const savedData = useRef(false);
  const { actions, query, connectors } = useEditor((state, query) => {
    return {};
  });
  const options = useContext(optionsCtx);
  const doSave = (query) => {
    if (!query.serialize) return;

    const data = craftToSaltcorn(JSON.parse(query.serialize()));
    const urlroot = options.page_id ? "pageedit" : "viewedit";
    if (savedData.current === false) {
      //do not save on first call
      savedData.current = JSON.stringify(data.layout);

      return;
    }
    if (isEqual(savedData.current, JSON.stringify(data.layout))) return;
    savedData.current = JSON.stringify(data.layout);
    setSavingState({ isSaving: true });

    fetch(`/${urlroot}/savebuilder/${options.page_id || options.view_id}`, {
      method: "POST", // or 'PUT'
      headers: {
        "Content-Type": "application/json",
        "CSRF-Token": options.csrfToken,
      },
      body: JSON.stringify(data),
    })
      .then((response) => {
        response.json().then((data) => {
          if (typeof data?.error === "string") {
            // don't log duplicates
            if (!savingState.error)
              window.notifyAlert({ type: "danger", text: data.error });
            setSavingState({ isSaving: false, error: data.error });
          } else setSavingState({ isSaving: false });
        });
      })
      .catch((e) => {
        const text =
          e.message === "Failed to fetch"
            ? "Network connection lost"
            : e || "Unable to save";
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
        const layout = node.props.layout;
        layoutToNodes(
          layout.layout ? layout.layout : layout,
          query,
          actions,
          node.parent
        );
        setTimeout(() => {
          actions.delete(id);
        }, 0);
      } else if (node.displayName !== "Column") {
        actions.selectNode(id);
      }
    }

    throttledSave();
  };
  useEffect(() => {
    const nodes = query.getSerializedNodes();
    nodekeys.current = Object.keys(nodes);
    actions.setOptions((options) => {
      const oldf = options.onNodesChange(
        (options.onNodesChange = oldf
          ? (q) => {
              oldf(q);
              onNodesChange(q);
            }
          : onNodesChange)
      );
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
  const { actions, selected, query, connectors } = useEditor((state, query) => {
    return {
      selected: state.events.selected,
    };
  });
  const options = useContext(optionsCtx);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [icon, setIcon] = useState();
  const [recent, setRecent] = useState([]);

  /**
   * @returns {void}
   */
  const addSelected = () => {
    const layout = craftToSaltcorn(JSON.parse(query.serialize()), selected);
    const data = { layout, icon, name: newName };
    fetch(`/library/savefrombuilder`, {
      method: "POST", // or 'PUT'
      headers: {
        "Content-Type": "application/json",
        "CSRF-Token": options.csrfToken,
      },
      body: JSON.stringify(data),
    });
    setAdding(false);
    setIcon();
    setNewName("");
    setRecent([...recent, data]);
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
          id="dropdownMenuButton"
          aria-haspopup="true"
          aria-expanded="false"
          disabled={!selected}
          onClick={() => setAdding(!adding)}
        >
          <FontAwesomeIcon icon={faPlus} className="me-1" />
          Add
        </button>
        <div
          className={`dropdown-menu py-3 px-4 ${adding ? "show" : ""}`}
          aria-labelledby="dropdownMenuButton"
        >
          <label>Name</label>
          <input
            type="text"
            className="form-control"
            value={newName}
            onChange={(e) => e?.target && setNewName(e.target.value)}
          />
          <br />
          <label>Icon</label>
          <FontIconPicker
            className="w-100"
            value={icon}
            icons={faIcons}
            onChange={setIcon}
            isMulti={false}
          />
          <button className={`btn btn-primary mt-3`} onClick={addSelected}>
            <FontAwesomeIcon icon={faPlus} className="me-1" />
            Add
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
                <LibraryElem name={l.name} layout={l.layout}></LibraryElem>
              </WrapElem>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
