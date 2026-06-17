import { Routes, Route } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import Dashboard from './Dashboard.jsx';
import SettingsPage from './SettingsPage.jsx';
import ChannelPage from './ChannelPage.jsx';
import CategoryPage from './CategoryPage.jsx';

export default function Layout({ subscriptions, categories, onDataChange, authStatus, onAuthChange }) {
  return (
    <div className="flex min-h-screen bg-[#0f0f0f]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:bg-black focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:text-sm focus:font-medium"
      >
        Skip to content
      </a>
      <Sidebar
        subscriptions={subscriptions}
        categories={categories}
        onDataChange={onDataChange}
        authStatus={authStatus}
      />
      <div id="main-content" className="ml-[260px] flex-1 flex flex-col min-w-0">
        <Routes>
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
