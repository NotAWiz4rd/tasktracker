import type { AuthUser } from '../hooks/useAuth';
import { LogOut, Moon, Sun, LayoutDashboard, BookOpen, Columns2 } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export type View = 'board' | 'kb';

interface Props {
  user: AuthUser;
  view: View;
  onViewChange: (view: View) => void;
  onLogout: () => void;
  splitView: boolean;
  onSplitViewChange: (enabled: boolean) => void;
}

export function Header({ user, view, onViewChange, onLogout, splitView, onSplitViewChange }: Props) {
  const initials = user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const { dark, toggle } = useTheme();

  const tabClass = (v: View) =>
    `flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
      view === v
        ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-medium'
        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
    }`;

  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">TaskTracker</h1>
        <nav className="flex items-center gap-1">
          <button className={tabClass('board')} onClick={() => onViewChange('board')}>
            <LayoutDashboard size={14} /> Board
          </button>
          <button className={tabClass('kb')} onClick={() => onViewChange('kb')}>
            <BookOpen size={14} /> Knowledge Base
          </button>
        </nav>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => onSplitViewChange(!splitView)}
          className={`p-1.5 rounded-lg transition-colors ${
            splitView
              ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/40 hover:bg-indigo-200 dark:hover:bg-indigo-900/60'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
          title={splitView ? 'Disable split view' : 'Enable split view'}
        >
          <Columns2 size={16} />
        </button>
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold"
            style={{ backgroundColor: user.avatar_color }}
          >
            {initials}
          </div>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{user.name}</span>
        </div>
        <button
          onClick={toggle}
          className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {dark ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <button
          onClick={onLogout}
          className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          title="Logout"
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}
