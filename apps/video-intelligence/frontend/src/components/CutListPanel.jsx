import React, { useState } from 'react';
import { projectApi } from '../services/api';

const formatTime = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

const statusColors = {
  pending: { bg: 'rgba(113,113,122,0.15)', text: '#a1a1aa', border: '#71717a' },
  approved: { bg: 'rgba(34,197,94,0.15)', text: '#4ade80', border: '#22c55e' },
  rejected: { bg: 'rgba(239,68,68,0.15)', text: '#f87171', border: '#ef4444' },
};

const CutListPanel = ({
  projectId,
  cuts,
  conflicts,
  isRegenerating,
  onCutUpdated,
  onSeekTo,
}) => {
  const [editingCaptions, setEditingCaptions] = useState({});

  const handleCaptionChange = (clipId, field, value) => {
    setEditingCaptions((prev) => ({
      ...prev,
      [clipId]: { ...prev[clipId], [field]: value },
    }));
  };

  const handleCaptionBlur = async (clip, field) => {
    const edits = editingCaptions[clip.clip_id];
    if (!edits || edits[field] === undefined) return;

    const newCaption = {
      ...clip.suggested_caption,
      ...edits,
    };

    try {
      await projectApi.updateClipCaption(projectId, clip.clip_id, newCaption);
      onCutUpdated(clip.clip_id, { suggested_caption: newCaption });
    } catch (err) {
      console.error('Failed to update caption:', err);
    }

    // Clear the edit buffer for this clip/field
    setEditingCaptions((prev) => {
      const updated = { ...prev };
      if (updated[clip.clip_id]) {
        const { [field]: _removed, ...rest } = updated[clip.clip_id];
        updated[clip.clip_id] = rest;
      }
      return updated;
    });
  };

  const handleStatusChange = async (clipId, status) => {
    try {
      await projectApi.updateClipStatus(projectId, clipId, status);
      onCutUpdated(clipId, { status });
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const getCaptionValue = (clip, field) => {
    const editing = editingCaptions[clip.clip_id];
    if (editing && editing[field] !== undefined) {
      return editing[field];
    }
    return clip.suggested_caption[field] || '';
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>Cut List</h3>
        <span style={styles.count}>{(cuts || []).length} clips</span>
      </div>

      <div
        style={{
          ...styles.body,
          opacity: isRegenerating ? 0.5 : 1,
          position: 'relative',
        }}
      >
        {isRegenerating && (
          <div style={styles.spinnerOverlay}>
            <div className="spinner" />
            <span style={styles.spinnerText}>Regenerating cuts...</span>
          </div>
        )}

        {/* Conflicts */}
        {(conflicts || []).length > 0 && (
          <div style={styles.conflictSection}>
            {(conflicts || []).map((conflict, idx) => (
              <div key={idx} style={styles.conflictCard}>
                <div style={styles.conflictHeader}>
                  Conflict at {conflict.timestamp}
                </div>
                <div style={styles.conflictAuthors}>
                  {conflict.authors.join(' vs ')}
                </div>
                {conflict.positions.map((pos, pIdx) => (
                  <div key={pIdx} style={styles.conflictPos}>
                    {conflict.authors[pIdx]}: {pos}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Clip cards */}
        {(cuts || []).length === 0 && !isRegenerating && (
          <div style={styles.empty}>
            No cuts yet. Submit feedback to trigger generation.
          </div>
        )}

        {(cuts || []).map((clip) => {
          const statusStyle = statusColors[clip.status] || statusColors.pending;

          return (
            <div key={clip.clip_id} style={styles.clipCard}>
              {/* Top row: thumbnail + info */}
              <div style={styles.clipTop}>
                <div
                  style={styles.thumbWrap}
                  onClick={() => onSeekTo(clip.start_time)}
                >
                  {clip.thumbnail_path ? (
                    <img
                      src={projectApi.getFrameUrl(clip.thumbnail_path)}
                      alt="clip thumbnail"
                      style={styles.thumb}
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div style={styles.thumbPlaceholder} />
                  )}
                </div>

                <div style={styles.clipInfo}>
                  <div
                    style={styles.timestamps}
                    onClick={() => onSeekTo(clip.start_time)}
                  >
                    {formatTime(clip.start_time)} - {formatTime(clip.end_time)}
                  </div>
                  <div style={styles.speaker}>{clip.speaker}</div>
                  <div style={styles.transcript}>{clip.transcript_excerpt}</div>
                </div>

                {/* Status badge */}
                <div
                  style={{
                    ...styles.statusBadge,
                    background: statusStyle.bg,
                    color: statusStyle.text,
                    borderColor: statusStyle.border,
                  }}
                >
                  {clip.status}
                </div>
              </div>

              {/* Captions */}
              <div style={styles.captionSection}>
                <div style={styles.captionRow}>
                  <span style={styles.captionLabel}>LinkedIn:</span>
                  <input
                    type="text"
                    value={getCaptionValue(clip, 'linkedin')}
                    onChange={(e) =>
                      handleCaptionChange(clip.clip_id, 'linkedin', e.target.value)
                    }
                    onBlur={() => handleCaptionBlur(clip, 'linkedin')}
                    style={styles.captionInput}
                  />
                </div>
                <div style={styles.captionRow}>
                  <span style={styles.captionLabel}>Reels:</span>
                  <input
                    type="text"
                    value={getCaptionValue(clip, 'reels')}
                    onChange={(e) =>
                      handleCaptionChange(clip.clip_id, 'reels', e.target.value)
                    }
                    onBlur={() => handleCaptionBlur(clip, 'reels')}
                    style={styles.captionInput}
                  />
                </div>
              </div>

              {/* Hashtags */}
              {(clip.suggested_hashtags.linkedin.length > 0 ||
                clip.suggested_hashtags.reels.length > 0) && (
                <div style={styles.hashtagRow}>
                  {clip.suggested_hashtags.linkedin.map((tag, i) => (
                    <span key={`li-${i}`} style={styles.hashtag}>
                      {tag}
                    </span>
                  ))}
                  {clip.suggested_hashtags.reels.map((tag, i) => (
                    <span key={`r-${i}`} style={{ ...styles.hashtag, color: '#c084fc' }}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Asset recommendation */}
              {clip.asset_recommendation && (
                <div style={styles.assetRec}>{clip.asset_recommendation}</div>
              )}

              {/* Memory notes */}
              {clip.memory_notes && (
                <div style={styles.memoryNotes}>{clip.memory_notes}</div>
              )}

              {/* Action buttons */}
              <div style={styles.actions}>
                <button
                  style={{
                    ...styles.actionBtn,
                    ...styles.approveBtn,
                    opacity: clip.status === 'approved' ? 0.5 : 1,
                  }}
                  onClick={() => handleStatusChange(clip.clip_id, 'approved')}
                  disabled={clip.status === 'approved'}
                >
                  Approve
                </button>
                <button
                  style={{
                    ...styles.actionBtn,
                    ...styles.rejectBtn,
                    opacity: clip.status === 'rejected' ? 0.5 : 1,
                  }}
                  onClick={() => handleStatusChange(clip.clip_id, 'rejected')}
                  disabled={clip.status === 'rejected'}
                >
                  Reject
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const styles = {
  container: {
    background: 'rgba(10,10,10,0.7)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  title: {
    margin: 0,
    fontSize: '0.95rem',
    fontWeight: 600,
    color: '#fafafa',
  },
  count: {
    fontSize: '0.75rem',
    color: '#71717a',
  },
  body: {
    maxHeight: 600,
    overflowY: 'auto',
    transition: 'opacity 0.3s ease',
  },
  spinnerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0,0,0,0.4)',
    zIndex: 10,
    gap: 8,
  },
  spinnerText: {
    fontSize: '0.8rem',
    color: '#a1a1aa',
  },
  empty: {
    padding: '32px 16px',
    textAlign: 'center',
    color: '#52525b',
    fontSize: '0.82rem',
  },
  conflictSection: {
    padding: '8px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  conflictCard: {
    background: 'rgba(249,115,22,0.08)',
    border: '1px solid rgba(249,115,22,0.3)',
    borderRadius: 8,
    padding: '8px 12px',
  },
  conflictHeader: {
    fontSize: '0.8rem',
    fontWeight: 600,
    color: '#f97316',
    marginBottom: 4,
  },
  conflictAuthors: {
    fontSize: '0.75rem',
    color: '#fb923c',
    marginBottom: 4,
  },
  conflictPos: {
    fontSize: '0.75rem',
    color: '#a1a1aa',
    paddingLeft: 8,
    borderLeft: '2px solid rgba(249,115,22,0.3)',
    marginBottom: 2,
  },
  clipCard: {
    padding: '12px 14px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  clipTop: {
    display: 'flex',
    gap: 10,
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  thumbWrap: {
    flexShrink: 0,
    width: 80,
    height: 52,
    borderRadius: 6,
    overflow: 'hidden',
    cursor: 'pointer',
    background: '#1a1a1a',
  },
  thumb: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  thumbPlaceholder: {
    width: '100%',
    height: '100%',
    background: '#1a1a1a',
  },
  clipInfo: {
    flex: 1,
    minWidth: 0,
  },
  timestamps: {
    fontSize: '0.78rem',
    fontWeight: 600,
    color: '#3b82f6',
    cursor: 'pointer',
    marginBottom: 2,
  },
  speaker: {
    fontSize: '0.72rem',
    color: '#71717a',
    marginBottom: 4,
  },
  transcript: {
    fontSize: '0.78rem',
    color: '#a1a1aa',
    lineHeight: 1.4,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
  },
  statusBadge: {
    flexShrink: 0,
    fontSize: '0.68rem',
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: 4,
    border: '1px solid',
    textTransform: 'capitalize',
  },
  captionSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    marginBottom: 6,
  },
  captionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  captionLabel: {
    fontSize: '0.72rem',
    color: '#71717a',
    fontWeight: 600,
    minWidth: 58,
  },
  captionInput: {
    flex: 1,
    padding: '4px 8px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 4,
    color: '#d4d4d8',
    fontSize: '0.78rem',
    outline: 'none',
    fontFamily: 'inherit',
  },
  hashtagRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 6,
  },
  hashtag: {
    fontSize: '0.68rem',
    color: '#60a5fa',
    background: 'rgba(96,165,250,0.1)',
    padding: '1px 6px',
    borderRadius: 3,
  },
  assetRec: {
    fontSize: '0.75rem',
    color: '#71717a',
    marginBottom: 4,
  },
  memoryNotes: {
    fontSize: '0.75rem',
    color: '#a1a1aa',
    fontStyle: 'italic',
    marginBottom: 8,
    paddingLeft: 8,
    borderLeft: '2px solid rgba(255,255,255,0.08)',
  },
  actions: {
    display: 'flex',
    gap: 6,
  },
  actionBtn: {
    padding: '4px 12px',
    border: '1px solid',
    borderRadius: 6,
    fontSize: '0.75rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.15s ease',
  },
  approveBtn: {
    background: 'rgba(34,197,94,0.1)',
    borderColor: 'rgba(34,197,94,0.3)',
    color: '#4ade80',
  },
  rejectBtn: {
    background: 'rgba(239,68,68,0.1)',
    borderColor: 'rgba(239,68,68,0.3)',
    color: '#f87171',
  },
};

export default CutListPanel;
