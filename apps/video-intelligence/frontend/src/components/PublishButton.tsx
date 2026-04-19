import React, { useState } from 'react';
import { projectApi } from '../services/api';
import type { SuggestedClip } from '../types';

interface PublishButtonProps {
  projectId: string;
  cuts: SuggestedClip[];
  onPublished: () => void;
}

const PublishButton: React.FC<PublishButtonProps> = ({
  projectId,
  cuts,
  onPublished,
}) => {
  const [publishing, setPublishing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const approvedClips = (cuts || []).filter((c) => c.status === 'approved');
  const disabled = approvedClips.length === 0 || publishing;

  const handlePublish = async () => {
    if (disabled) return;

    setPublishing(true);
    try {
      const clipIds = approvedClips.map((c) => c.clip_id);
      const result = await projectApi.publishClips(projectId, clipIds);
      setToast(
        result.message ||
          `${approvedClips.length} clips sent to social team. Content memory updated.`
      );
      onPublished();
      setTimeout(() => setToast(null), 4000);
    } catch (err) {
      console.error('Publish failed:', err);
      setToast('Publish failed. Please try again.');
      setTimeout(() => setToast(null), 3000);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div style={styles.container}>
      <button
        style={{
          ...styles.btn,
          opacity: disabled ? 0.4 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
        onClick={handlePublish}
        disabled={disabled}
      >
        {publishing
          ? 'Publishing...'
          : `Publish Approved Clips (${approvedClips.length})`}
      </button>

      {toast && <div style={styles.toast}>{toast}</div>}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'relative',
  },
  btn: {
    width: '100%',
    padding: '12px 20px',
    background: 'linear-gradient(135deg, #fafafa 0%, #d4d4d8 100%)',
    color: '#000',
    border: 'none',
    borderRadius: 10,
    fontWeight: 700,
    fontSize: '0.9rem',
    transition: 'opacity 0.2s ease',
  },
  toast: {
    marginTop: 8,
    padding: '8px 14px',
    background: 'rgba(34,197,94,0.15)',
    border: '1px solid rgba(34,197,94,0.3)',
    borderRadius: 8,
    color: '#4ade80',
    fontSize: '0.78rem',
    textAlign: 'center',
  },
};

export default PublishButton;
