import { Routes, Route } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import Dashboard from './Dashboard.jsx';
import SchedulerPage from './SchedulerPage.jsx';
import SettingsPage from './SettingsPage.jsx';
import ChannelPage from './ChannelPage.jsx';
import CategoryPage from './CategoryPage.jsx';

export default function Layout({ subscriptions, categories, onDataChange, authStatus, onAuthChange }) {
  return (
    <div className="flex min-h-screen bg-[#0f0f0f]">
      <Sidebar
        subscriptions={subscriptions}
        categories={categories}
        onDataChange={onDataChange}
        authStatus={authStatus}
      />
      <div className="ml-[260px] flex-1 flex flex-col min-w-0">
        <Routes>
          <Route path="/scheduler" element={<SchedulerPage />} />
          <Route
            path="/settings"
            element={
              <SettingsPage
                authStatus={authStatus}
                onAuthChange={onAuthChange}
                onDataChange={onDataChange}
                categories={categories}
              />
            }
          />
          <Route
            path="/channel/:id"
            element={
              <ChannelPage
                subscriptions={subscriptions}
                categories={categories}
                onDataChange={onDataChange}
              />
            }
          />
          <Route
            path="/category/:id"
            element={
              <CategoryPage
                subscriptions={subscriptions}
                categories={categories}
              />
            }
          />
          <Route
            path="/*"
            element={<Dashboard subscriptions={subscriptions} categories={categories} />}
          />
        </Routes>
      </div>
    </div>
  );
}
