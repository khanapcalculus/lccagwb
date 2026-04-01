export const startPan = ({ event, getPointerClientPos, viewportOffsetRef, panState, isPanning }) => {
  isPanning.current = true;
  panState.current = {
    pointer: getPointerClientPos(event),
    offset: viewportOffsetRef.current,
  };
};

export const updatePan = ({ pointer, panState, setViewportOffset }) => {
  setViewportOffset({
    x: panState.current.offset.x + (pointer.x - panState.current.pointer.x),
    y: panState.current.offset.y + (pointer.y - panState.current.pointer.y),
  });
};

export const stopPan = ({ isPanning }) => {
  if (!isPanning.current) return false;
  isPanning.current = false;
  return true;
};
