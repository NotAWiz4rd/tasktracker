import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Ticket } from '../types';
import type { User } from '../types';

interface Props {
  ticket: Ticket;
  users: User[];
  onClick: () => void;
}

const PRIORITY_STYLES: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400',
  urgent: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
};

const LABEL_COLORS = [
  'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400',
  'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
  'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400',
  'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-400',
  'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-400',
];

function hashColor(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % LABEL_COLORS.length;
  return LABEL_COLORS[h];
}

export function TicketCard({ ticket, users, onClick }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: ticket.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const assigneeUser = users.find(u => u.id === ticket.assignee);
  const initials = assigneeUser ? assigneeUser.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 shadow-sm hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-600 cursor-pointer transition-all select-none"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">{ticket.id}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_STYLES[ticket.priority] ?? PRIORITY_STYLES.medium}`}>
          {ticket.priority}
        </span>
      </div>
      <p className="text-sm font-medium text-gray-800 dark:text-gray-100 mb-2 line-clamp-2">{ticket.title}</p>
      {ticket.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {ticket.labels.map(l => (
            <span key={l} className={`text-xs px-1.5 py-0.5 rounded ${hashColor(l)}`}>{l}</span>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between mt-1">
        {ticket.comments.length > 0 && (
          <span className="text-xs text-gray-400 dark:text-gray-500">💬 {ticket.comments.length}</span>
        )}
        {assigneeUser && (
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-semibold ml-auto"
            style={{ backgroundColor: assigneeUser.avatar_color }}
            title={assigneeUser.name}
          >
            {initials}
          </div>
        )}
      </div>
    </div>
  );
}
