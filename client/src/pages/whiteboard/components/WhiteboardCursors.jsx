import React from 'react';

const WhiteboardCursors = ({ cursors, viewportOffset }) => (
  <>
    {Object.entries(cursors).map(([id, cursor]) => (
      <div key={id} className="wb-cursor" style={{ left: cursor.x + viewportOffset.x, top: cursor.y + viewportOffset.y }}>
        <div className="wb-cursor-dot" />
        <div className="wb-cursor-name">{cursor.name}</div>
      </div>
    ))}
  </>
);

export default WhiteboardCursors;
