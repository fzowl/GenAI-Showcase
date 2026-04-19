import React from 'react';
import type { FeedbackEntry, ConflictInfo } from '../types';

interface FeedbackPanelProps {
  feedback: FeedbackEntry[];
  currentTime: number;
  conflicts: ConflictInfo[];
  onSeek?: (time: number) => void;
}

const FeedbackPanel: React.FC<FeedbackPanelProps> = ({
  feedback,
  currentTime,
  conflicts,
  onSeek,
}) => {
  // Filter feedback covering current playhead time
  const activeFeedback = (feedback || []).filter(
    (fb) => currentTime >= fb.timestamp_range.start && currentTime <= fb.timestamp_range.end
  );

  // Check if a feedback entry is in a conflict zone
  const isConflict = (fb: FeedbackEntry): boolean => {
    return (conflicts || []).some((c) => {
      const conflictTime = parseFloat(c.timestamp);
      return (
        !isNaN(conflictTime) &&
        conflictTime >= fb.timestamp_range.start &&
        conflictTime <= fb.timestamp_range.end
      );
    });
  };

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>Feedback</h3>
        <span style={styles.count}>
          {activeFeedback.length} at {formatTime(currentTime)}
        </span>
      </div>

      {activeFeedback.length === 0 ? (
        <div style={styles.empty}>
          No feedback at current position. Scrub the timeline to view comments.
        </div>
      ) : (
        <div style={styles.list}>
          {activeFeedback.map((fb) => {
            const conflict = isConflict(fb);
            return (
              <div
                key={fb.feedback_id}
                style={{
                  ...styles.entry,
                  borderLeft: conflict
                    ? '3px solid #f97316'
                    : '3px solid rgba(255,255,255,0.1)',
                  background: conflict
                    ? 'rgba(249,115,22,0.08)'
                    : 'rgba(255,255,255,0.03)',
                }}
                onClick={() => onSeek?.(fb.timestamp_range.start)}
              >
                <div style={styles.entryHeader}>
                  <span style={styles.author}>{fb.author}</span>
                  <span style={styles.range}>
                    {formatTime(fb.timestamp_range.start)} - {formatTime(fb.timestamp_range.end)}
                  </span>
                </div>
                <p style={styles.comment}>{fb.comment_text}</p>
                {conflict && <span style={styles.conflictBadge}>Conflict</span>}
              </div>
            );
          })}
        </div>
      )}

      {/* All feedback (collapsed) */}
      {(feedback || []).length > 0 && activeFeedback.length === 0 && (
        <div style={styles.allSection}>
          <div style={styles.allLabel}>All feedback ({(feedback || []).length})</div>
          {(feedback || []).slice(0, 5).map((fb) => (
            <div
              key={fb.feedback_id}
              style={styles.allEntry}
              onClick={() => onSeek?.(fb.timestamp_range.start)}
            >
              <span style={styles.allTime}>
                {formatTime(fb.timestamp_range.start)}
              </span>
              <span style={styles.allAuthor}>{fb.author}</span>
              <span style={styles.allComment}>{fb.comment_text}</span>
            </div>
          ))}
          {(feedback || []).length > 5 && (
            <div style={styles.moreLabel}>+{(feedback || []).length - 5} more</div>
          )}
        </div>
      )}

    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
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
  empty: {
    padding: '24px 16px',
    color: '#52525b',
    fontSize: '0.82rem',
    textAlign: 'center',
  },
  list: {
    maxHeight: 260,
    overflowY: 'auto',
  },
  entry: {
    padding: '10px 14px',
    cursor: 'pointer',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
    transition: 'background 0.15s ease',
  },
  entryHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  author: {
    fontSize: '0.8rem',
    fontWeight: 600,
    color: '#d4d4d8',
  },
  range: {
    fontSize: '0.72rem',
    color: '#71717a',
  },
  comment: {
    margin: 0,
    fontSize: '0.82rem',
    color: '#a1a1aa',
    lineHeight: 1.4,
  },
  conflictBadge: {
    display: 'inline-block',
    marginTop: 6,
    fontSize: '0.68rem',
    fontWeight: 600,
    color: '#f97316',
    background: 'rgba(249,115,22,0.15)',
    padding: '2px 8px',
    borderRadius: 4,
  },
  allSection: {
    borderTop: '1px solid rgba(255,255,255,0.06)',
    padding: '10px 14px',
  },
  allLabel: {
    fontSize: '0.75rem',
    color: '#71717a',
    marginBottom: 8,
    fontWeight: 600,
  },
  allEntry: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    padding: '4px 0',
    cursor: 'pointer',
    fontSize: '0.78rem',
  },
  allTime: {
    color: '#71717a',
    fontWeight: 600,
    minWidth: 40,
  },
  allAuthor: {
    color: '#a1a1aa',
    fontWeight: 500,
    minWidth: 60,
  },
  allComment: {
    color: '#52525b',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
  },
  moreLabel: {
    fontSize: '0.72rem',
    color: '#52525b',
    marginTop: 4,
  },
};

export default FeedbackPanel;
