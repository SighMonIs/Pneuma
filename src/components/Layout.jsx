import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import Dashboard from './Dashboard.jsx';
import SchedulerPage from './SchedulerPage.jsx';
import SettingsPage from './SettingsPage.jsx';

export default function Layout({ subscriptions, categories, onDataChange, authStatus, onAuthChange }) {
  const [selectedChannelId, setSelectedChannelId] = useState(null);
  const location = useLocation();

  const page = location.pathname === '/scheduler'
    ? 'scheduler'
    : location.pathname === '/settings'
    ? 'settings'
    : 'dashboard';

  return (
    <div className="flex min-h-screen bg-[#0f0f0f]">
      <Sidebar
        subscriptions={subscriptions}
        categories={categories}
        onDataChange={onDataChange}
        selectedChannelId={selectedChannelId}
        onSelectChannel={setSelectedChannelId}
        authStatus={authStatus}
      />
      <div className="ml-[260px] flex-1 flex flex-col">
        {page === 'scheduler' && <SchedulerPage />}
        {page === 'settings' && (
          <SettingsPage
            authStatus={authStatus}
            onAuthChange={onAuthChange}
            onDataChange={onDataChange}
          />
        )}
        {page === 'dashboard' && (
          <Dashboard
            selectedChannelId={selectedChannelId}
            onClearChannel={() => setSelectedChannelId(null)}
            subscriptions={subscriptions}
          />
        )}
      </div>
    </div>
  );
}
