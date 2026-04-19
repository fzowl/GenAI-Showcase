import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { projectApi } from '../services/api';
import SearchBar from '../components/SearchBar';
import VideoTimeline from '../components/VideoTimeline';
import FeedbackPanel from '../components/FeedbackPanel';
import FeedbackInput from '../components/FeedbackInput';
import StyleReferenceUpload from '../components/StyleReferenceUpload';
import CutListPanel from '../components/CutListPanel';
import PublishButton from '../components/PublishButton';
import MemorySidebar from '../components/MemorySidebar';
import type {
  Project, FeedbackEntry, StyleMemory, ProjectMemory,
  SearchResult, ConflictInfo, AgentMessage, SuggestedClip,
  StyleReference,
} from '../types';

const ProjectWorkspace: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  // Core state
  const [project, setProject] = useState<Project | null>(null);
  const [feedback, setFeedback] = useState<FeedbackEntry[]>([]);
  const [styleMemory, setStyleMemory] = useState<StyleMemory | null>(null);
  const [projectMemory, setProjectMemory] = useState<ProjectMemory | null>(null);

  // UI state
  const [currentTime, setCurrentTime] = useState(0);
  const [seekTarget, setSeekTarget] = useState<number | undefined>(undefined);
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([]);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);

  // Load workspace data
  useEffect(() => {
    if (!projectId) return;

    const loadWorkspace = async () => {
      try {
        const data = await projectApi.getProjectWorkspace(projectId);
        setProject({
          ...data.project,
          segment_boundaries: data.project.segment_boundaries ?? [],
          recommended_cuts: data.project.recommended_cuts ?? [],
        });
        setFeedback(data.feedback ?? []);
        setStyleMemory(data.style_memory ?? null);
        setProjectMemory(data.project_memory ?? null);
      } catch (err) {
        setError('Failed to load project workspace');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadWorkspace();
  }, [projectId]);

  // WebSocket for agent streaming
  useEffect(() => {
    if (!projectId) return;

    const ws = projectApi.createAgentWebSocket(projectId);
    wsRef.current = ws;

    ws.onmessage = (event: MessageEvent) => {
      try {
        const msg: AgentMessage = JSON.parse(event.data);
        if (msg.type === 'clip') {
          setProject((prev) => {
            if (!prev) return prev;
            const cuts = prev.recommended_cuts || [];
            const exists = cuts.some(
              (c: SuggestedClip) => c.clip_id === msg.data.clip_id
            );
            if (exists) return prev;
            return {
              ...prev,
              recommended_cuts: [...cuts, msg.data],
            };
          });
        } else if (msg.type === 'conflicts') {
          setConflicts(msg.data);
        } else if (msg.type === 'complete') {
          setIsRegenerating(false);
        }
      } catch {
        // ignore malformed messages
      }
    };

    ws.onerror = () => {
      console.error('Agent WebSocket error');
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const handleResultSelect = useCallback((result: SearchResult) => {
    setSeekTarget(result.timestamp);
  }, []);

  const handleTimeUpdate = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  const handleFeedbackSeek = useCallback((time: number) => {
    setSeekTarget(time);
  }, []);

  const handleFeedbackSubmitted = useCallback(
    (newFeedback: FeedbackEntry) => {
      setFeedback((prev) => [...prev, newFeedback]);
    },
    []
  );

  const handleStyleUploaded = useCallback((style: StyleReference) => {
    setProject((prev) => (prev ? { ...prev, style_reference: style } : prev));
  }, []);

  const handleCutUpdated = useCallback(
    (clipId: string, updates: Partial<SuggestedClip>) => {
      setProject((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          recommended_cuts: (prev.recommended_cuts || []).map((c) =>
            c.clip_id === clipId ? { ...c, ...updates } : c
          ),
        };
      });
    },
    []
  );

  const handleSeekTo = useCallback((time: number) => {
    setSeekTarget(time);
  }, []);

  const handlePublished = useCallback(() => {
    if (!projectId) return;
    projectApi.getProjectWorkspace(projectId).then((data) => {
      setProject({
        ...data.project,
        segment_boundaries: data.project.segment_boundaries ?? [],
        recommended_cuts: data.project.recommended_cuts ?? [],
      });
      setFeedback(data.feedback ?? []);
      setStyleMemory(data.style_memory ?? null);
      setProjectMemory(data.project_memory ?? null);
    });
  }, [projectId]);

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.loadingWrap}>
          <div className="spinner" />
          Loading workspace...
        </div>
      </div>
    );
  }

  if (error || !project || !projectId) {
    return (
      <div style={styles.page}>
        <div style={styles.errorWrap}>{error ?? 'Project not found'}</div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      {/* Top bar */}
      <div style={styles.topBar}>
        <button style={styles.backBtn} onClick={() => navigate('/')}>
          &larr; Projects
        </button>
        <h2 style={styles.projectTitle}>{project.title}</h2>
        <span style={styles.campaignLabel}>{project.campaign_id}</span>
      </div>

      {/* Search */}
      <div style={styles.searchRow}>
        <SearchBar
          projectId={projectId}
          onResultSelect={handleResultSelect}
        />
      </div>

      {/* Main layout: left + right */}
      <div style={styles.mainGrid}>
        {/* Left column: video + feedback */}
        <div style={styles.leftCol}>
          <VideoTimeline
            videoPath={project.video_path ? projectApi.getFrameUrl(`/${project.video_path}`) : ''}
            segmentBoundaries={project.segment_boundaries}
            feedback={feedback}
            onTimeUpdate={handleTimeUpdate}
            seekTo={seekTarget}
          />
          <FeedbackPanel
            feedback={feedback}
            currentTime={currentTime}
            conflicts={conflicts}
            onSeek={handleFeedbackSeek}
          />
          <FeedbackInput
            projectId={projectId}
            currentTime={currentTime}
            segmentBoundaries={project.segment_boundaries}
            onFeedbackSubmitted={handleFeedbackSubmitted}
          />
          <StyleReferenceUpload
            projectId={projectId}
            currentReference={project.style_reference}
            onStyleUploaded={handleStyleUploaded}
          />
        </div>

        {/* Right column: cut list + publish + memory */}
        <div style={styles.rightCol}>
          <CutListPanel
            projectId={projectId}
            cuts={project.recommended_cuts}
            conflicts={conflicts}
            isRegenerating={isRegenerating}
            onCutUpdated={handleCutUpdated}
            onSeekTo={handleSeekTo}
          />
          <PublishButton
            projectId={projectId}
            cuts={project.recommended_cuts}
            onPublished={handlePublished}
          />
          <MemorySidebar
            styleMemory={styleMemory ?? undefined}
            projectMemory={projectMemory ?? undefined}
            isLoading={loading}
          />
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    padding: '20px',
    background: 'radial-gradient(ellipse at center, #111 0%, #000 100%)',
    color: '#fafafa',
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    marginBottom: 20,
    paddingBottom: 16,
    borderBottom: '1px solid rgba(255,255,255,0.1)',
  },
  backBtn: {
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 8,
    color: '#d4d4d8',
    padding: '8px 14px',
    cursor: 'pointer',
    fontSize: '0.9rem',
    transition: 'all 0.2s ease',
  },
  projectTitle: {
    fontSize: '1.4rem',
    fontWeight: 700,
    margin: 0,
    flex: 1,
  },
  campaignLabel: {
    fontSize: '0.8rem',
    color: '#71717a',
    background: 'rgba(255,255,255,0.06)',
    padding: '4px 10px',
    borderRadius: 6,
  },
  searchRow: {
    marginBottom: 20,
  },
  mainGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 380px',
    gap: 20,
    alignItems: 'start',
  },
  leftCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    minWidth: 0,
  },
  rightCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  loadingWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    color: '#a1a1aa',
    gap: 12,
  },
  errorWrap: {
    textAlign: 'center',
    padding: 60,
    color: '#f87171',
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
};

export default ProjectWorkspace;
