import React from 'react';
import type { StyleMemory, ProjectMemory } from '../types';

interface MemorySidebarProps {
  styleMemory?: StyleMemory;
  projectMemory?: ProjectMemory;
  isLoading: boolean;
}

const MemorySidebar: React.FC<MemorySidebarProps> = ({
  styleMemory,
  projectMemory,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>
          <div className="spinner" />
          Loading memory...
        </div>
      </div>
    );
  }

  if (!styleMemory && !projectMemory) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h3 style={styles.title}>Agent Memory</h3>
        </div>
        <div style={styles.empty}>
          No memory data available. Publish clips to build memory.
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>Agent Memory</h3>
      </div>

      {/* Style Memory */}
      {styleMemory && (
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <span style={styles.sectionTitle}>Style Memory</span>
            <span style={styles.crossProject}>Loaded from SF</span>
          </div>

          <div style={styles.row}>
            <span style={styles.rowLabel}>Clip Lengths:</span>
            <span style={styles.rowVal}>
              Reels: {styleMemory.preferred_clip_lengths.reels}s |
              LinkedIn: {styleMemory.preferred_clip_lengths.linkedin}s |
              Twitter: {styleMemory.preferred_clip_lengths.twitter}s
            </span>
          </div>

          <div style={styles.row}>
            <span style={styles.rowLabel}>Pacing:</span>
            <span style={styles.rowVal}>{styleMemory.pacing}</span>
          </div>

          <div style={styles.row}>
            <span style={styles.rowLabel}>Hook Style:</span>
            <span style={styles.rowVal}>{styleMemory.hook_style}</span>
          </div>

          {styleMemory.feedback_patterns.length > 0 && (
            <div style={styles.listSection}>
              <span style={styles.rowLabel}>Feedback Patterns:</span>
              <ul style={styles.list}>
                {styleMemory.feedback_patterns.map((pattern, idx) => (
                  <li key={idx} style={styles.listItem}>
                    {pattern}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Learning trajectory */}
          <div style={styles.trajectory}>
            <span style={styles.trajectoryItem}>
              Accepted: {styleMemory.accepted_cuts.length} cuts
            </span>
            <span style={styles.trajectorySep}>|</span>
            <span style={styles.trajectoryItem}>
              Rejected: {styleMemory.rejected_cuts.length} drafts
            </span>
          </div>
        </div>
      )}

      {/* Project Memory */}
      {projectMemory && (
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <span style={styles.sectionTitle}>Project Memory</span>
            <span style={styles.eventName}>{projectMemory.event_name}</span>
          </div>

          <div style={styles.row}>
            <span style={styles.rowLabel}>Brand Voice:</span>
            <span style={styles.rowVal}>{projectMemory.brand_voice_rules}</span>
          </div>

          {projectMemory.target_platforms.length > 0 && (
            <div style={styles.row}>
              <span style={styles.rowLabel}>Platforms:</span>
              <span style={styles.rowVal}>
                {projectMemory.target_platforms.join(', ')}
              </span>
            </div>
          )}

          {/* Speaker profiles */}
          {Object.keys(projectMemory.speaker_profiles).length > 0 && (
            <div style={styles.listSection}>
              <span style={styles.rowLabel}>Speakers:</span>
              {Object.entries(projectMemory.speaker_profiles).map(
                ([name, profile]) => (
                  <div key={name} style={styles.speakerCard}>
                    <span style={styles.speakerName}>{name}</span>
                    <span style={styles.speakerNotes}>
                      {profile.voice_notes}
                    </span>
                    {profile.quirks.length > 0 && (
                      <span style={styles.speakerQuirks}>
                        {profile.quirks.join(', ')}
                      </span>
                    )}
                  </div>
                )
              )}
            </div>
          )}

          {projectMemory.previous_campaigns.length > 0 && (
            <div style={styles.listSection}>
              <span style={styles.rowLabel}>Previous Campaigns:</span>
              <ul style={styles.list}>
                {projectMemory.previous_campaigns.map((campaign, idx) => (
                  <li key={idx} style={styles.listItem}>
                    {campaign}
                  </li>
                ))}
              </ul>
            </div>
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
    padding: '12px 16px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  title: {
    margin: 0,
    fontSize: '0.95rem',
    fontWeight: 600,
    color: '#fafafa',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px 16px',
    color: '#a1a1aa',
    gap: 8,
    fontSize: '0.82rem',
  },
  empty: {
    padding: '24px 16px',
    color: '#52525b',
    fontSize: '0.82rem',
    textAlign: 'center',
  },
  section: {
    padding: '10px 14px',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: '0.82rem',
    fontWeight: 600,
    color: '#d4d4d8',
  },
  crossProject: {
    fontSize: '0.65rem',
    color: '#8b5cf6',
    background: 'rgba(139,92,246,0.15)',
    padding: '2px 6px',
    borderRadius: 4,
    fontWeight: 600,
  },
  eventName: {
    fontSize: '0.65rem',
    color: '#71717a',
    background: 'rgba(255,255,255,0.06)',
    padding: '2px 6px',
    borderRadius: 4,
  },
  row: {
    display: 'flex',
    gap: 6,
    marginBottom: 4,
    fontSize: '0.75rem',
  },
  rowLabel: {
    color: '#71717a',
    fontWeight: 600,
    minWidth: 80,
    flexShrink: 0,
    fontSize: '0.75rem',
  },
  rowVal: {
    color: '#a1a1aa',
    fontSize: '0.75rem',
  },
  listSection: {
    marginTop: 6,
    marginBottom: 4,
  },
  list: {
    margin: '4px 0 0 0',
    paddingLeft: 16,
  },
  listItem: {
    fontSize: '0.72rem',
    color: '#a1a1aa',
    marginBottom: 2,
    lineHeight: 1.4,
  },
  trajectory: {
    marginTop: 8,
    padding: '6px 0',
    borderTop: '1px solid rgba(255,255,255,0.04)',
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    fontSize: '0.72rem',
  },
  trajectoryItem: {
    color: '#71717a',
  },
  trajectorySep: {
    color: '#3f3f46',
  },
  speakerCard: {
    padding: '4px 8px',
    marginTop: 4,
    background: 'rgba(255,255,255,0.03)',
    borderRadius: 4,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  speakerName: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: '#d4d4d8',
  },
  speakerNotes: {
    fontSize: '0.72rem',
    color: '#a1a1aa',
  },
  speakerQuirks: {
    fontSize: '0.68rem',
    color: '#71717a',
    fontStyle: 'italic',
  },
};

export default MemorySidebar;
