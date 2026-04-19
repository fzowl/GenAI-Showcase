import React, { useState } from 'react';
import { projectApi } from '../services/api';

const SearchBar = ({ projectId, onResultSelect }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!query.trim() || loading) return;

    setLoading(true);
    try {
      const response = await projectApi.searchMoments(projectId, query.trim());
      setResults(response.results);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div>
      <form onSubmit={handleSubmit} style={styles.form}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search moments... (e.g. 'keynote about AI agents')"
          style={styles.input}
          disabled={loading}
        />
        <button type="submit" disabled={loading || !query.trim()} style={styles.button}>
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {results.length > 0 && (
        <div style={styles.strip}>
          {results.map((result, idx) => (
            <div
              key={idx}
              style={styles.thumbCard}
              onClick={() => onResultSelect(result)}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <img
                src={projectApi.getFrameUrl(result.thumbnail_path || result.file_path || '')}
                alt={result.description}
                style={styles.thumb}
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
              <div style={styles.thumbOverlay}>
                <span style={styles.thumbTime}>{formatTime(result.timestamp)}</span>
                <span style={styles.thumbScore}>
                  {(result.similarity_score * 100).toFixed(0)}%
                </span>
              </div>
              <div style={styles.thumbDesc} title={result.description}>{result.description}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const styles = {
  form: {
    display: 'flex',
    gap: 12,
  },
  input: {
    flex: 1,
    padding: '12px 16px',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: 10,
    background: 'rgba(10,10,10,0.8)',
    color: '#fafafa',
    fontSize: '0.95rem',
    outline: 'none',
  },
  button: {
    padding: '12px 22px',
    background: 'linear-gradient(135deg, #fafafa 0%, #d4d4d8 100%)',
    color: '#000',
    border: 'none',
    borderRadius: 10,
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: '0.9rem',
    whiteSpace: 'nowrap',
  },
  strip: {
    display: 'flex',
    gap: 12,
    overflowX: 'auto',
    paddingTop: 14,
    paddingBottom: 6,
  },
  thumbCard: {
    flexShrink: 0,
    width: 160,
    background: 'rgba(10,10,10,0.8)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10,
    overflow: 'hidden',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  thumb: {
    width: '100%',
    height: 90,
    objectFit: 'cover',
    display: 'block',
    background: '#1a1a1a',
  },
  thumbOverlay: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '4px 8px',
    background: 'rgba(0,0,0,0.6)',
  },
  thumbTime: {
    fontSize: '0.7rem',
    color: '#fafafa',
    fontWeight: 600,
  },
  thumbScore: {
    fontSize: '0.7rem',
    color: '#a1a1aa',
  },
  thumbDesc: {
    padding: '6px 8px',
    fontSize: '0.72rem',
    color: '#a1a1aa',
    lineHeight: 1.3,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
};

export default SearchBar;
