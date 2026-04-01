import React from 'react';

const SHAPE_TOOL_IDS = ['point', 'line', 'arrow', 'rect', 'circle', 'ellipse', 'polygon', 'arc'];

const WhiteboardToolbar = ({
  toolbarRef,
  tool,
  tools,
  activePalette,
  colors,
  color,
  strokeWidths,
  strokeWidth,
  onToolSelect,
  onTogglePalette,
  onColorSelect,
  onStrokeWidthSelect,
  onUndo,
}) => {
  const shapeTools = tools.filter((item) => SHAPE_TOOL_IDS.includes(item.id));
  const primaryTools = tools.filter((item) => !SHAPE_TOOL_IDS.includes(item.id));
  const activeShapeTool = shapeTools.find((item) => item.id === tool) || shapeTools[0];
  const shapeButtonTitle = activeShapeTool ? `Shapes: ${activeShapeTool.label}` : 'Shapes';

  return (
    <div className="wb-toolbar" ref={toolbarRef}>
      <div className="wb-tool-group">
        {primaryTools.map((item) => (
          <button
            key={item.id}
            className={`wb-tool-btn ${tool === item.id ? 'active' : ''}`}
            onClick={() => onToolSelect(item.id)}
            title={item.label}
          >
            <span>{item.icon}</span>
          </button>
        ))}

        <div className="wb-toolbar-anchor">
          <button
            className={`wb-tool-btn ${activePalette === 'shape' || SHAPE_TOOL_IDS.includes(tool) ? 'active' : ''}`}
            onClick={() => onTogglePalette('shape')}
            title={shapeButtonTitle}
          >
            <span>{activeShapeTool?.icon || '◇'}</span>
          </button>
          {activePalette === 'shape' && (
            <div className="wb-toolbar-popover">
              <div className="wb-shape-grid">
                {shapeTools.map((item) => (
                  <button
                    key={item.id}
                    className={`wb-shape-btn ${tool === item.id ? 'active' : ''}`}
                    onClick={() => onToolSelect(item.id)}
                    title={item.label}
                  >
                    <span>{item.icon}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="wb-toolbar-anchor">
          <button
            className={`wb-tool-btn ${activePalette === 'color' ? 'active' : ''}`}
            onClick={() => onTogglePalette('color')}
            title="Colors"
          >
            <span className="wb-tool-swatch" style={{ background: color }} />
          </button>
          {activePalette === 'color' && (
            <div className="wb-toolbar-popover">
              <div className="wb-color-grid">
                {colors.map((value) => (
                  <button
                    key={value}
                    className={`wb-color-btn ${color === value ? 'active' : ''}`}
                    style={{ background: value, borderColor: value === color ? '#fff' : 'transparent' }}
                    onClick={() => onColorSelect(value)}
                    title={value}
                  />
                ))}
                <input
                  type="color"
                  className="wb-color-picker"
                  value={color}
                  onChange={(event) => onColorSelect(event.target.value)}
                  title="Custom color"
                />
              </div>
            </div>
          )}
        </div>

        <div className="wb-toolbar-anchor">
          <button
            className={`wb-tool-btn ${activePalette === 'size' ? 'active' : ''}`}
            onClick={() => onTogglePalette('size')}
            title="Stroke size"
          >
            <span
              className="wb-tool-size-dot"
              style={{
                width: Math.min(Math.max(strokeWidth * 2, 4), 18),
                height: Math.min(Math.max(strokeWidth * 2, 4), 18),
                background: color,
              }}
            />
          </button>
          {activePalette === 'size' && (
            <div className="wb-toolbar-popover">
              <div className="wb-width-grid">
                {strokeWidths.map((value) => (
                  <button
                    key={value}
                    className={`wb-width-btn ${strokeWidth === value ? 'active' : ''}`}
                    onClick={() => onStrokeWidthSelect(value)}
                    title={`${value}px`}
                  >
                    <div
                      className="wb-width-dot"
                      style={{
                        width: Math.min(Math.max(value * 2, 4), 18),
                        height: Math.min(Math.max(value * 2, 4), 18),
                        background: color,
                      }}
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <button className="wb-action-tool" onClick={onUndo} title="Undo">↩</button>
      </div>
    </div>
  );
};

export default WhiteboardToolbar;
