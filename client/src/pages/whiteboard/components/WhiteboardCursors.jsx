import React from 'react';

const WhiteboardCursors = ({ cursors, viewportOffset, zoom = 1 }) => (
  <>
    {Object.entries(cursors).map(([id, cursor]) => (
      <div
        key={id}
        className="wb-cursor"
        style={{
          left: cursor.x * zoom + viewportOffset.x,
          top: cursor.y * zoom + viewportOffset.y,
        }}
      >
        <div className="wb-cursor-dot" />
        <div className="wb-cursor-name">{cursor.name}</div>
      </div>
    ))}
  </>
);

export default WhiteboardCursors;
