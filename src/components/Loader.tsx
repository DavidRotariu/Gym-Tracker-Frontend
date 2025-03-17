import React from "react";

export const Loader = () => {
  return (
    <div className="running">
      <div className="outer">
        <div className="body">
          <div className="arm behind"></div>
          <div className="arm front"></div>
          <div className="leg behind"></div>
          <div className="leg front"></div>
        </div>
      </div>
    </div>
  );
};
