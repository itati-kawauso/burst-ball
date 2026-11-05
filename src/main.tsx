import React, { Component, ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class RootErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Burst Chamber caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          width: '100vw',
          backgroundColor: '#070914',
          color: '#f8fafc',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          textAlign: 'center',
          boxSizing: 'border-box'
        }}>
          <div style={{
            maxWidth: '480px',
            backgroundColor: '#0f172a',
            border: '1px solid #ef4444',
            borderRadius: '12px',
            padding: '28px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
          }}>
            <h1 style={{ color: '#ef4444', fontSize: '20px', fontWeight: 800, margin: '0 0 12px 0' }}>
              ⚠ 実行時エラーが発生しました
            </h1>
            <p style={{ color: '#cbd5e1', fontSize: '13px', lineHeight: 1.6, margin: '0 0 16px 0' }}>
              ゲームの描画中に予期せぬエラーが発生しました。キャッシュをクリアして再読み込みしてください。
            </p>
            {this.state.error && (
              <pre style={{
                backgroundColor: '#020617',
                color: '#f87171',
                padding: '12px',
                borderRadius: '8px',
                fontSize: '11px',
                textAlign: 'left',
                overflowX: 'auto',
                marginBottom: '20px',
                maxHeight: '120px'
              }}>
                {this.state.error.message || String(this.state.error)}
              </pre>
            )}
            <button
              onClick={() => window.location.reload()}
              style={{
                backgroundColor: '#38bdf8',
                color: '#020617',
                fontWeight: 700,
                fontSize: '13px',
                padding: '10px 20px',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              ページを再読み込み
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Global unhandled error fallback
window.addEventListener('error', (event) => {
  console.error('Global unhandled error:', event.error || event.message);
  const loader = document.getElementById('app-loader');
  if (loader) {
    loader.innerHTML = `
      <div style="color: #ef4444; font-weight: bold; font-size: 16px; margin-bottom: 8px;">読み込みエラーが発生しました</div>
      <div style="color: #94a3b8; font-size: 12px; margin-bottom: 16px; max-width: 360px;">${event.message || 'スクリプトの読み込みに失敗しました'}</div>
      <button onclick="window.location.reload()" style="background: #38bdf8; color: #020617; border: none; padding: 8px 16px; border-radius: 6px; font-weight: bold; cursor: pointer;">再読み込み</button>
    `;
  }
});

function mountApp() {
  let rootElement = document.getElementById('root');
  if (!rootElement) {
    rootElement = document.createElement('div');
    rootElement.id = 'root';
    document.body.appendChild(rootElement);
  }

  const root = createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <RootErrorBoundary>
        <App />
      </RootErrorBoundary>
    </React.StrictMode>
  );
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountApp);
} else {
  mountApp();
}
