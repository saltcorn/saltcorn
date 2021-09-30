import React, { useEffect, useContext, useState, Fragment } from "react";
import { Editor, Frame, Element, Selector, useEditor } from "@craftjs/core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus } from "@fortawesome/free-solid-svg-icons";
export const Library = () => {
  const addSelected = () => {};
  return (
    <button className="btn btn-primary mt-2" onClick={addSelected}>
      <FontAwesomeIcon icon={faPlus} className="mr-1" />
      Add
    </button>
  );
};
