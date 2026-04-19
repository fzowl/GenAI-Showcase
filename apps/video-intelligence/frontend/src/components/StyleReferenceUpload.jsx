import React, { useState, useRef } from 'react';
import { projectApi } from '../services/api';

const ACCEPTED_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
const ACCEPTED_EXT = '.mp4,.mov,.webm';

const StyleReferenceUpload = ({
  projectId,
  currentReference,
  onStyleUploaded,
}) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const handleFile = async (file) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Please upload a video file (.mp4, .mov, .webm)');
      return;
    }

    setError(null);
    setUploading(true);
    setProgress(0);

    // Simulate progress since axios doesn't expose upload progress easily here
    const progressInterval = setInterval(() => {
      setProgress((prev) => Math.min(prev + 15, 90));
    }, 300);

    try {
      await projectApi.uploadStyleReference(projectId, file);
      setProgress(100);
      clearInterval(progressInterval);

      // Fetch updated workspace to get the style reference analysis
      const workspace = await projectApi.getProjectWorkspace(projectId);
      if (workspace.project.style_reference) {
        onStyleUploaded(workspace.project.style_reference);
      }
    } catch (err) {
      console.error('Style reference upload failed:', err);
      setError('Upload failed. Please try again.');
      clearInterval(progressInterval);
    } finally {
      setUploading(false);
      setTimeout(() => setProgress(0), 1500);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.label}>Style Reference</span>
      </div>

      {/* Drop zone */}
      <div
        style={{
          ...styles.dropZone,
          borderColor: dragOver ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.1)',
          background: dragOver ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)',
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_EXT}
          onChange={handleInputChange}
          style={{ display: 'none' }}
        />
        {uploading ? (
          <div style={styles.progressWrap}>
            <div style={styles.progressBar}>
              <div style={{ ...styles.progressFill, width: `${progress}%` }} />
            </div>
            <span style={styles.progressText}>{progress}%</span>
          </div>
        ) : (
          <div style={styles.dropLabel}>
            Drop video here or click to browse
            <span style={styles.dropHint}>.mp4, .mov, .webm</span>
          </div>
        )}
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {/* Current reference display */}
      {currentReference && (
        <div style={styles.refInfo}>
          {currentReference.pacing && (
            <div style={styles.refRow}>
              <span style={styles.refKey}>Pacing:</span>
              <span style={styles.refVal}>{currentReference.pacing}</span>
            </div>
          )}
          {currentReference.hook_structure && (
            <div style={styles.refRow}>
              <span style={styles.refKey}>Hook:</span>
              <span style={styles.refVal}>{currentReference.hook_structure}</span>
            </div>
          )}
          {currentReference.caption_tone && (
            <div style={styles.refRow}>
              <span style={styles.refKey}>Tone:</span>
              <span style={styles.refVal}>{currentReference.caption_tone}</span>
            </div>
          )}
          {currentReference.format_notes && (
            <div style={styles.refRow}>
              <span style={styles.refKey}>Notes:</span>
              <span style={styles.refVal}>{currentReference.format_notes}</span>
            </div>
          )}
        </div>
      )}
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
    padding: '10px 14px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  label: {
    fontSize: '0.85rem',
    fontWeight: 600,
    color: '#d4d4d8',
  },
  dropZone: {
    margin: '10px 14px',
    padding: '20px',
    border: '1px dashed rgba(255,255,255,0.1)',
    borderRadius: 8,
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  dropLabel: {
    fontSize: '0.82rem',
    color: '#71717a',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  dropHint: {
    fontSize: '0.7rem',
    color: '#52525b',
  },
  progressWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  progressBar: {
    flex: 1,
    height: 6,
    background: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
    borderRadius: 3,
    transition: 'width 0.3s ease',
  },
  progressText: {
    fontSize: '0.72rem',
    color: '#a1a1aa',
    minWidth: 32,
  },
  error: {
    padding: '6px 14px',
    fontSize: '0.75rem',
    color: '#f87171',
  },
  refInfo: {
    padding: '8px 14px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  refRow: {
    display: 'flex',
    gap: 6,
    fontSize: '0.78rem',
  },
  refKey: {
    color: '#71717a',
    fontWeight: 600,
    minWidth: 50,
  },
  refVal: {
    color: '#a1a1aa',
  },
};

export default StyleReferenceUpload;
