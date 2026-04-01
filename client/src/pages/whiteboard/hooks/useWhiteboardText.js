import { useCallback, useState } from 'react';
import { buildTextStroke } from '../tools/textTool';

export const useWhiteboardText = ({
  color,
  strokeWidth,
  user,
  strokes,
  history,
  redrawAll,
  socketRef,
}) => {
  const [showTextInput, setShowTextInput] = useState(false);
  const [textPos, setTextPos] = useState({ x: 0, y: 0 });
  const [textValue, setTextValue] = useState('');

  const addText = useCallback(() => {
    if (!textValue.trim() || !user?.uid) {
      setShowTextInput(false);
      return;
    }

    const stroke = buildTextStroke({
      color,
      strokeWidth,
      textPos,
      textValue,
      userUid: user.uid,
    });
    strokes.current.push(stroke);
    history.current.push(stroke);
    redrawAll();
    socketRef.current?.emit('add-text', stroke);
    setTextValue('');
    setShowTextInput(false);
  }, [color, history, redrawAll, socketRef, strokeWidth, strokes, textPos, textValue, user?.uid]);

  const dismissTextInput = useCallback(() => {
    setTextValue('');
    setShowTextInput(false);
  }, []);

  return {
    state: {
      showTextInput,
      textPos,
      textValue,
    },
    actions: {
      setTextPos,
      setTextValue,
      setShowTextInput,
      addText,
      dismissTextInput,
    },
  };
};
