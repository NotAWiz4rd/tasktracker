import type { AuthUser } from '../hooks/useAuth';
import { LogOut, Moon, Sun } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface Props {
  user: AuthUser;
  onLogout: () => void;
}

export function Header({ user, onLogout }: Props) {
  const initials = user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const { dark, toggle } = useTheme();

  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center justify-between">
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">TaskTracker</h1>
      <div className="flex items-center gap-3">
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
