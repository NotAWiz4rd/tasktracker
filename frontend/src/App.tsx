import { useState, useEffect, useRef } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { useTickets } from './hooks/useTickets';
import { LoginScreen } from './components/LoginScreen';
import { Header } from './components/Header';
import type { View } from './components/Header';
import { Board } from './components/Board';
import { KnowledgeBase } from './components/KnowledgeBase';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SharedArticleView } from './components/SharedArticleView';
import { ToastProvider } from './contexts/ToastContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { api } from './api';
import type { Column, Config } from './types';

function AppInner() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading: authLoading, login, logout } = useAuth();
  const { tickets, pollingFailed, createTicket, updateTicket, deleteTicket, moveTicket, reorderTickets, addComment } = useTickets(!!user);
  const [columns, setColumns] = useState<Column[]>([]);
  const [config, setConfig] = useState<Config>({ users: [], priorities: [], labels: [] });
  const [splitView, setSplitView] = useState(false);
  const { dark, setDark } = useTheme();
  const prefsApplied = useRef(false);

  const view: View = location.pathname.startsWith('/kb') ? 'kb' : 'board';

  // Parse deep-link targets from URL
  const pathParts = location.pathname.split('/').filter(Boolean);
  const urlTicketId = view === 'board' && pathParts.length > 1 ? pathParts.slice(1).join('/') : null;
  const urlSlug = view === 'kb' && pathParts.length > 1 ? pathParts.slice(1).join('/') : null;

  useEffect(() => {
    if (!user) {
      prefsApplied.current = false;
      return;
    }
    api.getColumns().then(r => setColumns(r.columns)).catch(console.error);
    api.getConfig().then(c => setConfig(c)).catch(console.error);
    // Apply saved preferences once per login
    if (!prefsApplied.current) {
      prefsApplied.current = true;
      setDark(user.preferences.dark_mode);
      setSplitView(user.preferences.split_view);
    }
  }, [user]);

  const handleDarkToggle = () => {
    const newDark = !dark;
    setDark(newDark);
    api.updatePreferences({ dark_mode: newDark }).catch(console.error);
  };

  const handleSplitViewChange = (val: boolean) => {
    setSplitView(val);
    api.updatePreferences({ split_view: val }).catch(console.error);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center dark:bg-gray-900">
        <div className="text-gray-400 dark:text-gray-500">Loading…</div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen onLogin={login} />;
  }

  const handleViewChange = (v: View) => navigate(v === 'board' ? '/board' : '/kb');
  const handleTicketSelect = (id: string | null) => navigate(id ? `/board/${id}` : '/board');
  const handleArticleSelect = (slug: string | null) => navigate(slug ? `/kb/${slug}` : '/kb');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      <Header user={user} view={view} onViewChange={handleViewChange} onLogout={logout} splitView={splitView} onSplitViewChange={handleSplitViewChange} onThemeToggle={handleDarkToggle} />
      {pollingFailed && (view === 'board' || (splitView && view === 'kb')) && (
        <div className="bg-yellow-100 dark:bg-yellow-900/30 border-b border-yellow-300 dark:border-yellow-700 text-yellow-800 dark:text-yellow-200 text-sm text-center py-2 px-4">
          Connection lost — showing cached data
        </div>
      )}
      <div className="flex-1 flex overflow-hidden">
        {/* Primary pane */}
        <div className={`flex flex-col overflow-hidden ${splitView ? 'w-1/2 border-r border-gray-200 dark:border-gray-700' : 'flex-1'}`}>
          {view === 'board' ? (
            <Board
              columns={columns}
              config={config}
              currentUser={user ?? undefined}
              tickets={tickets}
              onMove={moveTicket}
              onReorder={reorderTickets}
              onCreate={createTicket}
              onUpdate={updateTicket}
              onDelete={deleteTicket}
              onAddComment={addComment}
              selectedTicketId={urlTicketId}
              onTicketSelect={handleTicketSelect}
            />
          ) : (
            <KnowledgeBase
              initialSlug={urlSlug}
              onArticleSelect={handleArticleSelect}
            />
          )}
        </div>
        {/* Secondary pane — only shown in split view */}
        {splitView && (
          <div className="w-1/2 flex flex-col overflow-hidden">
            {view === 'board' ? (
              <KnowledgeBase
                initialSlug={null}
                onArticleSelect={() => {}}
              />
            ) : (
              <Board
                columns={columns}
                config={config}
                currentUser={user ?? undefined}
                tickets={tickets}
                onMove={moveTicket}
                onReorder={reorderTickets}
                onCreate={createTicket}
                onUpdate={updateTicket}
                onDelete={deleteTicket}
                onAddComment={addComment}
                selectedTicketId={null}
                onTicketSelect={() => {}}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <Routes>
            <Route path="/share/:slug/:token" element={<SharedArticleView />} />
            <Route path="/" element={<Navigate to="/board" replace />} />
            <Route path="/*" element={<AppInner />} />
          </Routes>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
