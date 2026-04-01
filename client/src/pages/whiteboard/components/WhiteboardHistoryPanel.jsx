import React from 'react';

const formatVersionDate = (value) => {
  if (!value) return 'Pending timestamp';
  const date = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Pending timestamp';
  return date.toLocaleString();
};

const WhiteboardHistoryPanel = ({ open, versions, onClose, onLoadVersion }) => {
  if (!open) return null;

  return (
    <div className="wb-history-panel">
      <div className="wb-history-head">
        <div>
          <div className="wb-history-title">Version Timeline</div>
          <div className="wb-history-subtitle">{versions.length} saved version{versions.length === 1 ? '' : 's'}</div>
        </div>
        <button className="wb-history-close" onClick={onClose} title="Close history">✕</button>
      </div>
      <div className="wb-history-list">
        {versions.length === 0 && (
          <div className="wb-history-empty">No saved versions yet. Use the save button to create timeline snapshots.</div>
        )}
        {versions.map((version) => (
          <button key={version.id} className="wb-history-item" onClick={() => onLoadVersion(version.id)}>
            <div className="wb-history-item-row">
              <span className="wb-history-item-title">{version.label || version.source || 'Saved version'}</span>
              <span className="wb-history-item-count">{version.strokeCount || 0} strokes</span>
            </div>
            <div className="wb-history-item-meta">{formatVersionDate(version.createdAt)}</div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default WhiteboardHistoryPanel;
