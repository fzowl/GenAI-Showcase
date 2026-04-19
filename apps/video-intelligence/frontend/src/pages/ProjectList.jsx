import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { projectApi } from '../services/api';

const statusColors = {
  published: { bg: 'rgba(34, 197, 94, 0.15)', text: '#22c55e', label: 'Published' },
  in_progress: { bg: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6', label: 'In Progress' },
  draft: { bg: 'rgba(161, 161, 170, 0.15)', text: '#a1a1aa', label: 'Draft' },
};

const ProjectList = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const loadProjects = async () => {
      try {
        const data = await projectApi.listProjects();
        setProjects(data);
      } catch (err) {
        setError('Failed to load projects');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadProjects();
  }, []);

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.container}>
          <div style={styles.header}>
            <h1 style={styles.title}>Social Media Content Editor</h1>
            <p style={styles.subtitle}>AI-powered video clip generation</p>
          </div>
          <div style={styles.loading}>
            <div style={styles.spinner} />
            Loading projects...
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.page}>
        <div style={styles.container}>
          <div style={styles.header}>
            <h1 style={styles.title}>Social Media Content Editor</h1>
            <p style={styles.subtitle}>AI-powered video clip generation</p>
          </div>
          <div style={styles.error}>{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>Social Media Content Editor</h1>
          <p style={styles.subtitle}>AI-powered video clip generation</p>
        </div>
        <div style={styles.grid}>
          {projects.map((project) => {
            const status = statusColors[project.status];
            return (
              <div
                key={project.project_id}
                style={styles.card}
                onClick={() => navigate(`/project/${project.project_id}`)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)';
                  e.currentTarget.style.transform = 'translateY(-4px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div style={styles.cardHeader}>
                  <h3 style={styles.cardTitle}>{project.title}</h3>
                  <span
                    style={{
                      ...styles.badge,
                      backgroundColor: status.bg,
                      color: status.text,
                      border: `1px solid ${status.text}33`,
                    }}
                  >
                    {status.label}
                  </span>
                </div>
                <div style={styles.cardBody}>
                  <div style={styles.cardMeta}>
                    <span style={styles.metaLabel}>Campaign</span>
                    <span style={styles.metaValue}>{project.campaign_id}</span>
                  </div>
                  <div style={styles.cardMeta}>
                    <span style={styles.metaLabel}>Clips</span>
                    <span style={styles.metaValue}>{(project.recommended_cuts || []).length}</span>
                  </div>
                  {project.duration && (
                    <div style={styles.cardMeta}>
                      <span style={styles.metaLabel}>Duration</span>
                      <span style={styles.metaValue}>
                        {Math.floor(project.duration / 60)}:{String(Math.floor(project.duration % 60)).padStart(2, '0')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const styles = {
  page: {
    minHeight: '100vh',
    padding: '40px 20px',
    background: 'radial-gradient(ellipse at center, #111 0%, #000 100%)',
  },
  container: {
    maxWidth: 1100,
    margin: '0 auto',
  },
  header: {
    textAlign: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: '2.6rem',
    fontWeight: 700,
    background: 'linear-gradient(135deg, #fafafa 0%, #a1a1aa 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: '1.1rem',
    color: '#71717a',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: 24,
  },
  card: {
    background: 'rgba(10,10,10,0.8)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: '24px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    backdropFilter: 'blur(10px)',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    gap: 12,
  },
  cardTitle: {
    fontSize: '1.15rem',
    fontWeight: 600,
    color: '#fafafa',
    margin: 0,
    lineHeight: 1.3,
  },
  badge: {
    padding: '4px 10px',
    borderRadius: 8,
    fontSize: '0.75rem',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  cardBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  cardMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaLabel: {
    fontSize: '0.85rem',
    color: '#71717a',
  },
  metaValue: {
    fontSize: '0.85rem',
    color: '#d4d4d8',
    fontWeight: 500,
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 60,
    color: '#a1a1aa',
    gap: 12,
  },
  spinner: {
    width: 20,
    height: 20,
    border: '2px solid rgba(255,255,255,0.1)',
    borderTop: '2px solid #fafafa',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  error: {
    textAlign: 'center',
    padding: 40,
    color: '#f87171',
    background: 'rgba(30,10,10,0.6)',
    borderRadius: 12,
  },
};

export default ProjectList;
