import { useCallback } from 'react';
import { buildAssetStrokes } from '../utils/assetUpload';

export const useWhiteboardBoardActions = ({
  roomId,
  user,
  fileInputRef,
  canvasRef,
  viewportOffsetRef,
  strokes,
  history,
  appendStrokes,
  redrawAll,
  socketRef,
  getCtx,
  setSelectedStrokeId,
}) => {
  const handleUndo = useCallback(() => {
    if (!history.current.length || !user?.uid) return;
    history.current.pop();
    strokes.current = [...history.current];
    redrawAll();
    socketRef.current?.emit('undo', { uid: user.uid });
  }, [history, redrawAll, socketRef, strokes, user?.uid]);

  const handleClear = useCallback(() => {
    if (!window.confirm('Clear the entire whiteboard?')) return;
    strokes.current = [];
    history.current = [];
    setSelectedStrokeId(null);
    getCtx()?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    socketRef.current?.emit('clear-canvas');
  }, [canvasRef, getCtx, history, setSelectedStrokeId, socketRef, strokes]);

  const handleSave = useCallback(() => {
    socketRef.current?.emit('save-canvas', { canvasData: strokes.current });
  }, [socketRef, strokes]);

  const handleExport = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !roomId) return;
    const link = document.createElement('a');
    link.download = `whiteboard-${roomId.slice(0, 8)}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }, [canvasRef, roomId]);

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(window.location.href);
  }, []);

  const handleAssetButtonClick = useCallback(() => {
    fileInputRef.current?.click();
  }, [fileInputRef]);

  const handleAssetUpload = useCallback(async (event) => {
    const file = event.target.files?.[0];
    if (!file || !user?.uid) return;

    try {
      const canvas = canvasRef.current;
      const viewportWidth = canvas?.getBoundingClientRect().width || 800;
      const viewportHeight = canvas?.getBoundingClientRect().height || 600;
      const newStrokes = await buildAssetStrokes({
        file,
        viewportWidth,
        viewportHeight,
        viewportOffset: viewportOffsetRef.current,
        uid: user.uid,
      });
      appendStrokes(newStrokes);
    } catch (error) {
      window.alert(error.message || 'Could not upload the selected asset.');
    } finally {
      event.target.value = '';
    }
  }, [appendStrokes, canvasRef, user?.uid, viewportOffsetRef]);

  return {
    handleUndo,
    handleClear,
    handleSave,
    handleExport,
    handleCopyLink,
    handleAssetButtonClick,
    handleAssetUpload,
  };
};
