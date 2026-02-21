import { useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Home, Project, ToolDetail, Settings, Models } from './pages';
import { useAppStore } from './stores/appStore';
import { useThemeStore } from './stores/themeStore';
import { useModelStore } from './stores/modelStore';
import type { Toast as ToastType } from './stores/appStore';
import { Toast } from './components/common';
import { QuickSwitcher } from './components/QuickSwitcher';

function App() {
  const toasts = useAppStore(state => state.toasts);
  const removeToast = useAppStore(state => state.removeToast);
  const { mode, setMode } = useThemeStore();
  const loadProviders = useModelStore(state => state.loadProviders);
  const loadActiveProvider = useModelStore(state => state.loadActiveProvider);

  // Quick Switcher state
  const [isQuickSwitcherOpen, setIsQuickSwitcherOpen] = useState(false);

  // Initialize theme on mount
  useEffect(() => {
    setMode(mode);
  }, []);

  // Load providers on mount
  useEffect(() => {
    loadProviders().catch(console.error);
    loadActiveProvider().catch(console.error);
  }, [loadProviders, loadActiveProvider]);

  // Listen for global shortcut trigger
  useEffect(() => {
    const cleanup = window.electronAPI.quickSwitcher.onTriggered(() => {
      setIsQuickSwitcherOpen(true);
    });
    return cleanup;
  }, []);

  return (
    <>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/project" element={<Project />} />
          <Route path="/project/tool/:toolId" element={<ToolDetail />} />
          <Route path="/models" element={<Models />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Layout>

      {/* Quick Switcher */}
      <QuickSwitcher
        isOpen={isQuickSwitcherOpen}
        onClose={() => setIsQuickSwitcherOpen(false)}
      />

      {/* Toast notifications */}
      <div className="fixed top-16 right-4 z-[100] flex flex-col gap-2">
        {toasts.map((toast: ToastType) => (
          <Toast
            key={toast.id}
            id={toast.id}
            type={toast.type}
            message={toast.title}
            description={toast.message}
            duration={toast.duration}
            onClose={removeToast}
          />
        ))}
      </div>
    </>
  );
}

export default App;
