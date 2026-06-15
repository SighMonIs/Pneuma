import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { getAuthStatus, getSubscriptions, getCategories } from './services/api.js';
import SetupPage from './components/SetupPage.jsx';
import Layout from './components/Layout.jsx';

function AppInner() {
  const [status, setStatus] = useState(null); // null = loading
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

  if (status === null) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!status.isConfigured) {
    return <SetupPage onComplete={handleSetupComplete} />;
  }

  if (!dataLoaded) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
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
