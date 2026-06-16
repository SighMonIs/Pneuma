import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { getAuthStatus, getSubscriptions, getCategories } from './services/api.js';
import SetupPage from './components/SetupPage.jsx';
import Layout from './components/Layout.jsx';

function AppSkeleton() {
  return (
    <div className="flex min-h-screen bg-[#0f0f0f]">
      <div className="fixed top-0 left-0 bottom-0 w-[260px] bg-[#1a1a1a] border-r border-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-800 flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gray-800 rounded-lg animate-pulse" />
          <div className="h-5 bg-gray-800 rounded w-20 animate-pulse" />
        </div>
        <div className="p-2 border-b border-gray-800 flex flex-col gap-1">
          {[1, 2, 3].map(i => <div key={i} className="h-8 bg-gray-800/50 rounded-lg animate-pulse" />)}
        </div>
        <div className="p-3 border-b border-gray-800 flex flex-col gap-2">
          <div className="h-3 bg-gray-800 rounded w-16 animate-pulse" />
          <div className="h-7 bg-gray-800/50 rounded-lg animate-pulse" />
        </div>
        <div className="flex-1 p-2 flex flex-col gap-0.5">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => (
            <div key={i} className="flex items-center gap-2 px-3 py-1.5">
              <div className="w-6 h-6 bg-gray-800 rounded-full animate-pulse flex-shrink-0" />
              <div className="h-2.5 bg-gray-800/50 rounded animate-pulse flex-1" style={{ width: `${50 + (i * 17) % 40}%` }} />
            </div>
          ))}
        </div>
      </div>
      <div className="ml-[260px] flex-1 flex flex-col">
        <div className="border-b border-gray-800 px-6 py-3 flex flex-col gap-2">
          <div className="flex gap-3">
            <div className="h-9 bg-gray-800/50 rounded-lg flex-1 animate-pulse" />
            <div className="h-9 w-28 bg-gray-800/50 rounded-lg animate-pulse" />
          </div>
          <div className="flex gap-2">
            {[80, 96, 56, 44, 60].map((w, i) => (
              <div key={i} className="h-7 bg-gray-800/50 rounded-lg animate-pulse" style={{ width: w }} />
            ))}
          </div>
        </div>
        <div className="p-6" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="flex flex-col bg-[#1a1a1a] rounded-lg overflow-hidden animate-pulse">
              <div className="aspect-video bg-gray-800/60" />
              <div className="p-3 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-gray-800" />
                  <div className="h-2.5 bg-gray-800/50 rounded w-24" />
                </div>
                <div className="h-3.5 bg-gray-800/50 rounded" />
                <div className="h-3.5 bg-gray-800/50 rounded w-3/4" />
                <div className="h-2.5 bg-gray-800/50 rounded w-20" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AppInner() {
  const [status, setStatus] = useState(null);
  const [subscriptions, setSubscriptions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  const checkStatus = async () => {
    try {
      const s = await getAuthStatus();
      setStatus(s);
      return s;
    } catch (err) {
      console.error('Status check failed:', err);
      setStatus({ isConfigured: false, hasCookies: false, channelCount: 0 });
      return null;
    }
  };

  const loadData = async () => {
    try {
      const [subs, cats] = await Promise.all([getSubscriptions(), getCategories()]);
      setSubscriptions(subs);
      setCategories(cats);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setDataLoaded(true);
    }
  };

  useEffect(() => {
    checkStatus().then(s => {
      if (s?.isConfigured) loadData();
      else setDataLoaded(true);
    });
  }, []);

  const handleDataChange = () => loadData();

  const handleSetupComplete = async () => {
    const s = await checkStatus();
    if (s?.isConfigured) await loadData();
  };

  if (status === null || !dataLoaded) {
    return <AppSkeleton />;
  }

  if (!status.isConfigured) {
    return <SetupPage onComplete={handleSetupComplete} />;
  }

  return (
    <Routes>
      <Route
        path="/*"
        element={
          <Layout
            subscriptions={subscriptions}
            categories={categories}
            onDataChange={handleDataChange}
            authStatus={status}
            onAuthChange={checkStatus}
          />
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  );
}
