import React, { useRef, useEffect, useCallback } from 'react';
import type { SegmentBoundary, FeedbackEntry } from '../types';

interface VideoTimelineProps {
  videoPath: string;
  segmentBoundaries: SegmentBoundary[];
  feedback: FeedbackEntry[];
  onTimeUpdate: (time: number) => void;
  seekTo?: number;
}

const VideoTimeline: React.FC<VideoTimelineProps> = ({
  videoPath,
  segmentBoundaries,
  feedback,
  onTimeUpdate,
  seekTo,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  // Seek when seekTo changes
  useEffect(() => {
    if (seekTo !== undefined && videoRef.current) {
      videoRef.current.currentTime = seekTo;
      videoRef.current.play().catch(() => {});
    }
  }, [seekTo]);

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      onTimeUpdate(videoRef.current.currentTime);
    }
  }, [onTimeUpdate]);

  const getDuration = (): number => {
    return videoRef.current?.duration || 1;
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || !videoRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    const time = pct * getDuration();
    videoRef.current.currentTime = time;
  };

  const handleSegmentClick = (start: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = start;
      videoRef.current.play().catch(() => {});
    }
  };

  const duration = getDuration();

  return (
    <div style={styles.container}>
      {/* Video player */}
      <div style={styles.videoWrap}>
        {videoPath ? (
          <video
            ref={videoRef}
            src={videoPath}
            controls
            style={styles.video}
            onTimeUpdate={handleTimeUpdate}
          />
        ) : (
          <div style={styles.noVideo}>No video loaded</div>
        )}
      </div>

      {/* Timeline bar */}
      <div
        ref={timelineRef}
        style={styles.timeline}
        onClick={handleTimelineClick}
      >
        {/* Segment boundaries */}
        {(segmentBoundaries || []).map((seg, idx) => {
          const left = (seg.start / duration) * 100;
          const width = ((seg.end - seg.start) / duration) * 100;
          const colors = ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b'];
          const color = colors[idx % colors.length];
          return (
            <div
              key={idx}
              title={`${seg.speaker} (${formatTime(seg.start)} - ${formatTime(seg.end)})`}
              onClick={(e) => {
                e.stopPropagation();
                handleSegmentClick(seg.start);
              }}
              style={{
                position: 'absolute',
                left: `${left}%`,
                width: `${width}%`,
                height: '100%',
                background: `${color}33`,
                borderLeft: `2px solid ${color}`,
                cursor: 'pointer',
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = `${color}55`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = `${color}33`;
              }}
            />
          );
        })}

        {/* Feedback markers (orange dots) */}
        {(feedback || []).map((fb, idx) => {
          const pos = (fb.timestamp_range.start / duration) * 100;
          return (
            <div
              key={`fb-${idx}`}
              title={`${fb.author}: ${fb.comment_text}`}
              style={{
                position: 'absolute',
                left: `${pos}%`,
                top: '50%',
                transform: 'translate(-50%, -50%)',
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#f97316',
                border: '1px solid #000',
                cursor: 'pointer',
                zIndex: 2,
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (videoRef.current) {
                  videoRef.current.currentTime = fb.timestamp_range.start;
                }
              }}
            />
          );
        })}

        {/* Playhead indicator */}
        {videoRef.current && (
          <div
            style={{
              position: 'absolute',
              left: `${(videoRef.current.currentTime / duration) * 100}%`,
              top: 0,
              width: 2,
              height: '100%',
              background: '#fafafa',
              zIndex: 3,
              pointerEvents: 'none',
            }}
          />
        )}
      </div>

      {/* Segment labels */}
      {(segmentBoundaries || []).length > 0 && (
        <div style={styles.segmentLabels}>
          {(segmentBoundaries || []).map((seg, idx) => (
            <span
              key={idx}
              style={styles.segLabel}
              onClick={() => handleSegmentClick(seg.start)}
            >
              {seg.speaker} ({formatTime(seg.start)})
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: 'rgba(10,10,10,0.7)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  videoWrap: {
    background: '#000',
  },
  video: {
    width: '100%',
    display: 'block',
    maxHeight: 420,
  },
  noVideo: {
    padding: '80px 20px',
    textAlign: 'center',
    color: '#52525b',
    fontSize: '0.9rem',
  },
  timeline: {
    position: 'relative',
    height: 28,
    background: 'rgba(255,255,255,0.06)',
    cursor: 'pointer',
    borderTop: '1px solid rgba(255,255,255,0.08)',
  },
  segmentLabels: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    padding: '8px 12px',
    borderTop: '1px solid rgba(255,255,255,0.06)',
  },
  segLabel: {
    fontSize: '0.72rem',
    color: '#71717a',
    cursor: 'pointer',
    padding: '2px 6px',
    borderRadius: 4,
    background: 'rgba(255,255,255,0.04)',
  },
};

export default VideoTimeline;
