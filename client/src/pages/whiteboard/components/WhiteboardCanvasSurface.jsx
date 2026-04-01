import React from 'react';

const WhiteboardCanvasSurface = ({
  canvasRef,
  tool,
  isPanning,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}) => (
  <canvas
    ref={canvasRef}
    className="wb-canvas"
    onPointerDown={onPointerDown}
    onPointerMove={onPointerMove}
    onPointerUp={onPointerUp}
    onPointerCancel={onPointerUp}
    style={{
      cursor: tool === 'pan'
        ? (isPanning ? 'grabbing' : 'grab')
        : tool === 'select'
          ? 'default'
          : tool === 'eraser'
            ? 'not-allowed'
            : tool === 'text'
              ? 'text'
              : 'crosshair',
    }}
  />
);

export default WhiteboardCanvasSurface;
