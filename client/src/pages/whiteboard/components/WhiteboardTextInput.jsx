import React from 'react';

const WhiteboardTextInput = ({
  show,
  textPos,
  viewportOffset,
  zoom = 1,
  textValue,
  color,
  strokeWidth,
  onChange,
  onSubmit,
  onCancel,
}) => {
  if (!show) return null;

  return (
    <div
      className="wb-text-input-wrap"
      style={{
        left: textPos.x * zoom + viewportOffset.x,
        top: textPos.y * zoom + viewportOffset.y,
      }}
    >
      <input
        autoFocus
        className="wb-text-input"
        placeholder="Type here…"
        value={textValue}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onSubmit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            onSubmit();
          }
          if (event.key === 'Escape') {
            onCancel();
          }
        }}
        style={{ color, fontSize: `${(strokeWidth * 4 + 12) * zoom}px` }}
      />
    </div>
  );
};

export default WhiteboardTextInput;
