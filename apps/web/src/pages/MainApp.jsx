import { useState } from 'react';
import Header from '../components/Header.jsx';
import BottomNav from '../components/BottomNav.jsx';
import FeedPlaceholder from './FeedPlaceholder.jsx';
import ProfilePage from './ProfilePage.jsx';
import SettingsPage from './SettingsPage.jsx';

export default function MainApp() {
  const [currentTab, setCurrentTab] = useState('feed');

  function handleTabChange(tab) {
    // "create" and "notifications" are not pages yet — show toast-like behaviour via
    // the feed placeholder. For now just switch to feed with a hint.
    if (tab === 'create' || tab === 'notifications') {
      setCurrentTab('feed');
      return;
    }
    setCurrentTab(tab);
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--color-bg)' }}>
      <Header currentTab={currentTab} onTabChange={handleTabChange} />

      <main>
        {currentTab === 'feed' && (
          <FeedPlaceholder onGoToProfile={() => setCurrentTab('profile')} />
        )}
        {currentTab === 'profile' && <ProfilePage />}
        {currentTab === 'settings' && <SettingsPage />}
      </main>

      <BottomNav currentTab={currentTab} onTabChange={handleTabChange} />
    </div>
  );
}
