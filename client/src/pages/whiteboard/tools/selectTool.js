export const startSelection = ({
  pos,
  strokes,
  doesStrokeHitPoint,
  setSelectedStrokeId,
  selectionDrag,
  redrawAll,
}) => {
  const hitStroke = [...strokes.current].reverse().find((stroke) => doesStrokeHitPoint(stroke, pos));
  setSelectedStrokeId(hitStroke?.id || null);

  if (hitStroke) {
    selectionDrag.current = {
      active: true,
      strokeId: hitStroke.id,
      origin: pos,
      snapshot: hitStroke,
      lastDelta: { x: 0, y: 0 },
    };
  } else {
    selectionDrag.current = {
      active: false,
      strokeId: null,
      origin: null,
      snapshot: null,
      lastDelta: { x: 0, y: 0 },
    };
  }

  redrawAll();
};

export const stopSelection = ({ selectionDrag }) => {
  selectionDrag.current = {
    active: false,
    strokeId: null,
    origin: null,
    snapshot: null,
    lastDelta: { x: 0, y: 0 },
  };
};
