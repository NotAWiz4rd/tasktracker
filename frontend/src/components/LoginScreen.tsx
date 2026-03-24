import { useState, useEffect } from 'react';
import { api } from '../api';

interface Props {
  onLogin: (username: string, password: string) => Promise<void>;
}

interface UserOption {
  id: string;
  name: string;
  avatar_color: string;
}

export function LoginScreen({ onLogin }: Props) {
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getConfig().then(c => setUsers(c.users)).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) { setError('Please select a user'); return; }
    setLoading(true);
    setError('');
    try {
      await onLogin(selected, password);
    } catch {
      setError('Invalid password');
    } finally {
      setLoading(false);
    }
  };

  const initials = (name: string) => name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">TaskTracker</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Who are you?</label>
            <div className="grid grid-cols-3 gap-3">
              {users.map(u => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => { setSelected(u.id); setPassword(''); setError(''); }}
                  className={`flex flex-col items-center p-3 rounded-xl border-2 transition-all ${
                    selected === u.id
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  }`}
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm mb-1"
                    style={{ backgroundColor: u.avatar_color }}
                  >
                    {initials(u.name)}
                  </div>
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{u.name}</span>
                </button>
              ))}
            </div>
          </div>

          {selected && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter password"
                autoFocus
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={!selected || loading}
            className="w-full bg-indigo-600 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
