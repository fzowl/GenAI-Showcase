import React, { useState } from 'react';
import { projectApi } from '../services/api';

const FeedbackInput = ({
  projectId,
  currentTime,
  segmentBoundaries,
  onFeedbackSubmitted,
}) => {
  const [comment, setComment] = useState('');
  const [author, setAuthor] = useState('Editor');
  const [submitting, setSubmitting] = useState(false);

  const currentSegment = (segmentBoundaries || []).find(
    (seg) => currentTime >= seg.start && currentTime <= seg.end
  );

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const handleSubmit = async () => {
    if (!comment.trim() || submitting) return;

    setSubmitting(true);
    try {
      const result = await projectApi.submitFeedback(projectId, {
        author,
        comment_text: comment.trim(),
        playhead_time: currentTime,
      });
      setComment('');
      onFeedbackSubmitted({
        feedback_id: result.feedback_id,
        project_id: projectId,
        timestamp_range: result.timestamp_range,
        author,
        comment_text: comment.trim(),
        created_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Failed to submit feedback:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSubmit();
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.label}>Add Feedback</span>
        <span style={styles.segmentInfo}>
          {currentSegment
            ? `${currentSegment.speaker} (${formatTime(currentSegment.start)} - ${formatTime(currentSegment.end)})`
            : `Playhead: ${formatTime(currentTime)}`}
        </span>
      </div>

      <div style={styles.fields}>
        <input
          type="text"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          placeholder="Author"
          style={styles.authorInput}
        />
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a comment at this timestamp..."
          rows={3}
          style={styles.textarea}
        />
        <button
          onClick={handleSubmit}
          disabled={!comment.trim() || submitting}
          style={{
            ...styles.submitBtn,
            opacity: !comment.trim() || submitting ? 0.4 : 1,
            cursor: !comment.trim() || submitting ? 'not-allowed' : 'pointer',
          }}
        >
          {submitting ? 'Submitting...' : 'Submit Feedback'}
        </button>
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
    padding: '10px 14px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  label: {
    fontSize: '0.85rem',
    fontWeight: 600,
    color: '#d4d4d8',
  },
  segmentInfo: {
    fontSize: '0.72rem',
    color: '#71717a',
    background: 'rgba(255,255,255,0.06)',
    padding: '2px 8px',
    borderRadius: 4,
  },
  fields: {
    padding: '10px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  authorInput: {
    padding: '6px 10px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 6,
    color: '#fafafa',
    fontSize: '0.8rem',
    outline: 'none',
    width: 120,
  },
  textarea: {
    padding: '8px 10px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 6,
    color: '#fafafa',
    fontSize: '0.82rem',
    outline: 'none',
    resize: 'vertical',
    fontFamily: 'inherit',
    lineHeight: 1.4,
  },
  submitBtn: {
    padding: '8px 16px',
    background: 'linear-gradient(135deg, #fafafa 0%, #d4d4d8 100%)',
    color: '#000',
    border: 'none',
    borderRadius: 8,
    fontWeight: 600,
    fontSize: '0.82rem',
    alignSelf: 'flex-end',
    transition: 'opacity 0.2s ease',
  },
};

export default FeedbackInput;
