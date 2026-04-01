export const eraseStrokeAtPoint = ({
  pos,
  strokes,
  history,
  doesStrokeHitPoint,
  redrawAll,
  socketRef,
}) => {
  const hitStroke = [...strokes.current].reverse().find((stroke) => doesStrokeHitPoint(stroke, pos));
  if (!hitStroke) return false;

  const nextStrokes = strokes.current.filter((stroke) => stroke.id !== hitStroke.id);
  strokes.current = nextStrokes;
  history.current = nextStrokes;
  redrawAll();
  socketRef.current?.emit('delete-stroke', { strokeId: hitStroke.id });
  return true;
};
