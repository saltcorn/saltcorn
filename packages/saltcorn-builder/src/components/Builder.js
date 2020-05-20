import React, { Component } from "react";
import ReactDOM from "react-dom";

const Builder = ({}) => <div>Hello from react builder!</div>

export default Builder;

const wrapper = document.getElementById("saltcorn-builder");
wrapper ? ReactDOM.render(<Builder />, wrapper) : false;