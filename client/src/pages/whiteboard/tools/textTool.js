export const beginTextInput = ({
  pos,
  showTextInput,
  textValue,
  addText,
  setTextPos,
  setTextValue,
  setShowTextInput,
}) => {
  if (showTextInput && textValue.trim()) {
    addText();
  }
  setTextPos(pos);
  setTextValue('');
  setShowTextInput(true);
};

export const buildTextStroke = ({ color, strokeWidth, textPos, textValue, userUid }) => ({
  tool: 'text',
  color,
  width: strokeWidth,
  points: [textPos],
  text: textValue,
  uid: userUid,
  id: Date.now(),
});
