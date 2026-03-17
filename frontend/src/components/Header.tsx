import type { AuthUser } from '../hooks/useAuth';
import { LogOut } from 'lucide-react';

interface Props {
  user: AuthUser;
  onLogout: () => void;
}

export function Header({ user, onLogout }: Props) {
  const initials = user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
      <h1 className="text-xl font-bold text-gray-900">TaskTracker</h1>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold"
            style={{ backgroundColor: user.avatar_color }}
          >
            {initials}
          </div>
          <span className="text-sm font-medium text-gray-700">{user.name}</span>
        </div>
        <button
          onClick={onLogout}
          className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          title="Logout"
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}
