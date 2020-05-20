import React from "react";
import {useNode} from "@craftjs/core";

export const Text = ({text}) => {
  const { connectors:{connect,drag} } = useNode();
  return (
    <div ref={dom => connect(drag(dom))}>
      {text}
    </div>
  )
}

export const TextSettings = () => {
    const { setProp, text } = useNode((node) => ({
      text: node.data.props.text
    }));
    return (
      <div>
        <h2>Text settings</h2>
        <input 
          type = "text" 
          value={text} 
          onChange={e => 
            setProp(prop => prop.text = e.target.value) 
          }
         />
      </div>
    )
  }
  
Text.craft = {
    related: {
        toolbar: TextSettings
      }
}
