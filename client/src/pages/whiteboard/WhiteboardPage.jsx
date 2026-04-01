import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import WhiteboardCanvasSurface from './components/WhiteboardCanvasSurface';
import WhiteboardCursors from './components/WhiteboardCursors';
import WhiteboardHistoryPanel from './components/WhiteboardHistoryPanel';
import WhiteboardTextInput from './components/WhiteboardTextInput';
import WhiteboardToolbar from './components/WhiteboardToolbar';
import WhiteboardTopbar from './components/WhiteboardTopbar';
import { useWhiteboardCanvas } from './hooks/useWhiteboardCanvas';
import './Whiteboard.css';

const WhiteboardPage = () => {
  const { roomId } = useParams();
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();
  const {
    constants,
    refs,
    state,
    derived,
    actions,
  } = useWhiteboardCanvas({ roomId, user, userProfile });

  return (
    <div className={`wb-container ${state.theme === 'light' ? 'light' : 'dark'}`}>
      <WhiteboardTopbar
        roomId={roomId}
        connected={state.connected}
        saved={state.saved}
        participants={state.participants}
        theme={state.theme}
        onBack={() => navigate(-1)}
        onToggleTheme={() => actions.setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
        onUpload={actions.handleAssetButtonClick}
        onClear={actions.handleClear}
        onCopyLink={actions.handleCopyLink}
        onSave={actions.handleSave}
        onExport={actions.handleExport}
        onToggleHistory={() => actions.setHistoryOpen((prev) => !prev)}
        historyOpen={state.historyOpen}
        fileInputRef={refs.fileInputRef}
        onAssetUpload={actions.handleAssetUpload}
      />

      <div className="wb-main">
        <div className="wb-canvas-wrap">
          <WhiteboardToolbar
            toolbarRef={refs.toolbarRef}
            tool={state.tool}
            tools={constants.tools}
            activePalette={state.activePalette}
            colors={constants.colors}
            color={state.color}
            strokeWidths={constants.strokeWidths}
            strokeWidth={state.strokeWidth}
            onToolSelect={actions.handleToolSelect}
            onTogglePalette={actions.handleTogglePalette}
            onColorSelect={actions.handleColorSelect}
            onStrokeWidthSelect={actions.handleStrokeWidthSelect}
            onUndo={() => {
              actions.handleUndo();
              actions.handleTogglePalette(null);
            }}
          />

          <WhiteboardCanvasSurface
            canvasRef={refs.canvasRef}
            tool={state.tool}
            isPanning={derived.isPanning}
            onPointerDown={actions.startDrawing}
            onPointerMove={actions.draw}
            onPointerUp={actions.stopDrawing}
          />

          <WhiteboardCursors cursors={state.cursors} viewportOffset={state.viewportOffset} />

          <WhiteboardHistoryPanel
            open={state.historyOpen}
            versions={state.versions}
            onClose={() => actions.setHistoryOpen(false)}
            onLoadVersion={actions.loadVersion}
          />

          <WhiteboardTextInput
            show={state.showTextInput}
            textPos={state.textPos}
            viewportOffset={state.viewportOffset}
            textValue={state.textValue}
            color={state.color}
            strokeWidth={state.strokeWidth}
            onChange={actions.setTextValue}
            onSubmit={actions.addText}
            onCancel={actions.dismissTextInput}
          />
        </div>
      </div>
    </div>
  );
};

export default WhiteboardPage;
