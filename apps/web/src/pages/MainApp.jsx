import { Component, useState } from 'react';
import Header from '../components/Header.jsx';
import BottomNav from '../components/BottomNav.jsx';
import IssuesPage from './IssuesPage.jsx';
import ProfilePage from './ProfilePage.jsx';
import SettingsPage from './SettingsPage.jsx';
import CreateIssuePage from './CreateIssuePage.jsx';
import IssueDetailPage from './IssueDetailPage.jsx';

// ── Error boundary ────────────────────────────────────────────────────────────

class DetailErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[IssueDetailPage crash]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ background: 'var(--color-bg)', minHeight: '100dvh' }}>
          <div
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 50,
              background: 'linear-gradient(135deg, #0D4F4F 0%, #14897A 100%)',
              padding: '12px 16px',
            }}
          >
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                this.props.onBack?.();
              }}
              style={{
                background: 'rgba(255,255,255,0.15)',
                border: 'none',
                borderRadius: 8,
                color: '#fff',
                fontSize: 13,
                fontWeight: 600,
                padding: '6px 14px',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              ← Back
            </button>
          </div>
          <div
            style={{ maxWidth: 820, margin: '0 auto', padding: '60px 16px', textAlign: 'center' }}
          >
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>
              Failed to load issue
            </div>
            <div style={{ fontSize: 13, color: '#888', marginBottom: 4, fontFamily: 'monospace' }}>
              {this.state.error?.message}
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function MainApp() {
  const [currentTab, setCurrentTab] = useState('feed');
  const [prevTab, setPrevTab] = useState('feed');
  const [detailIssueId, setDetailIssueId] = useState(null);

  function handleTabChange(tab) {
    if (tab === 'notifications') return;
    if (detailIssueId) setDetailIssueId(null);
    setPrevTab(currentTab);
    setCurrentTab(tab);
  }

  function handleOpenIssue(issueId) {
    console.log('[MainApp] opening issue:', issueId);
    setDetailIssueId(issueId);
  }

  function handleCloseDetail() {
    setDetailIssueId(null);
  }

  function handleCreateSuccess() {
    setCurrentTab('feed');
    setDetailIssueId(null);
  }

  function handleCreateCancel() {
    setCurrentTab(prevTab === 'create' ? 'feed' : prevTab);
  }

  const isCreating = currentTab === 'create';
  const showingDetail = !!detailIssueId;

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--color-bg)' }}>
      {/* Main layout — always mounted, hidden behind overlay when detail is open */}
      <div style={{ visibility: showingDetail ? 'hidden' : 'visible' }}>
        {!isCreating && <Header currentTab={currentTab} onTabChange={handleTabChange} />}

        <main>
          {currentTab === 'feed' && (
            <IssuesPage
              onCreateIssue={() => handleTabChange('create')}
              onOpenIssue={handleOpenIssue}
            />
          )}
          {currentTab === 'profile' && <ProfilePage />}
          {currentTab === 'settings' && <SettingsPage />}
          {currentTab === 'create' && (
            <CreateIssuePage onSuccess={handleCreateSuccess} onCancel={handleCreateCancel} />
          )}
        </main>

        {!isCreating && <BottomNav currentTab={currentTab} onTabChange={handleTabChange} />}
      </div>

      {/* Issue detail — fixed full-screen overlay */}
      {showingDetail && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 300,
            background: 'var(--color-bg)',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <DetailErrorBoundary onBack={handleCloseDetail}>
            <IssueDetailPage
              key={detailIssueId}
              issueId={detailIssueId}
              onBack={handleCloseDetail}
              onOpenIssue={handleOpenIssue}
            />
          </DetailErrorBoundary>
        </div>
      )}
    </div>
  );
}
