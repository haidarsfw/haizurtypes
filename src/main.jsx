import React from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Error boundary for catching render errors
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('React error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          background: '#323437',
          color: '#e2b714',
          fontFamily: 'monospace',
          padding: '20px',
          textAlign: 'center'
        }}>
          <h1>Something went wrong</h1>
          <p style={{ color: '#d1d0c5', fontSize: '14px', maxWidth: '300px' }}>
            {this.state.error?.message || 'Unknown error'}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '20px',
              padding: '10px 20px',
              background: '#e2b714',
              color: '#323437',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Try to render the app with error handling
try {
  const root = document.getElementById('root');
  if (root) {
    createRoot(root).render(
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    );
  } else {
    console.error('Root element not found');
  }
} catch (error) {
  console.error('Fatal initialization error:', error);
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `
      <div style="display:flex;flex-direction:column;justify-content:center;align-items:center;height:100vh;background:#323437;color:#e2b714;font-family:monospace;padding:20px;text-align:center;">
        <h1>Failed to load</h1>
        <p style="color:#d1d0c5;font-size:14px;">${error.message || 'Unknown error'}</p>
      </div>
    `;
  }
}
