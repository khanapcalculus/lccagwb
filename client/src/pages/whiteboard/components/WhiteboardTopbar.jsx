import React from 'react';

const WhiteboardTopbar = ({
  roomId,
  connected,
  saved,
  participants,
  theme,
  onBack,
  onToggleTheme,
  onUpload,
  onClear,
  onCopyLink,
  onSave,
  onExport,
  onToggleHistory,
  historyOpen,
  fileInputRef,
  onAssetUpload,
}) => (
  <div className="wb-topbar">
    <div className="wb-topbar-left">
      <button className="wb-back-btn" onClick={onBack}>← Back</button>
      <div className="wb-room-info">
        <div className="wb-room-icon">🖊️</div>
        <div>
          <div className="wb-room-title">Whiteboard Session</div>
          <div className="wb-room-id">Room: {roomId?.slice(0, 8)}…</div>
        </div>
      </div>
    </div>

    <div className="wb-topbar-center">
      <div className={`wb-connection ${connected ? 'connected' : 'disconnected'}`}>
        <span className="wb-dot" />{connected ? 'Live' : 'Connecting…'}
      </div>
      {saved && <div className="wb-saved">✓ Saved</div>}
    </div>

    <div className="wb-topbar-right">
      <div className="wb-participants">
        {participants.slice(0, 4).map((participant, index) => (
          <div key={participant.uid || `${participant.name}-${index}`} className="wb-avatar" title={participant.name} style={{ zIndex: 10 - index }}>
            {participant.name?.[0]?.toUpperCase() || '?'}
          </div>
        ))}
        {participants.length > 4 && <div className="wb-avatar wb-avatar-more">+{participants.length - 4}</div>}
      </div>
      <button className="wb-action-btn" onClick={onToggleTheme} title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>
      <button className="wb-action-btn" onClick={onUpload} title="Upload image or PDF">📄</button>
      <button className={`wb-action-btn ${historyOpen ? 'active' : ''}`} onClick={onToggleHistory} title="Version timeline">🕘</button>
      <button className="wb-action-btn danger" onClick={onClear} title="Clear canvas">🗑</button>
      <button className="wb-action-btn" onClick={onCopyLink} title="Copy link">🔗</button>
      <button className="wb-action-btn" onClick={onSave} title="Save to cloud">💾</button>
      <button className="wb-action-btn" onClick={onExport} title="Export PNG">⬇️</button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf,application/pdf"
        style={{ display: 'none' }}
        onChange={onAssetUpload}
      />
    </div>
  </div>
);

export default WhiteboardTopbar;
