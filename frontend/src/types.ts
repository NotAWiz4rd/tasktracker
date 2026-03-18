export interface Comment {
  id: string;
  author: string;
  body: string;
  created_at: string;
}

export interface HistoryEntry {
  at: string;
  by: string;
  change: string;
}

export interface Ticket {
  id: string;
  title: string;
  description: string;
  status: string;
  assignee: string | null;
  priority: string;
  labels: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
  comments: Comment[];
  history: HistoryEntry[];
}

export interface Column {
  id: string;
  name: string;
  order: number;
}

export interface User {
  id: string;
  name: string;
  avatar_color: string;
}

export interface Config {
  users: User[];
  priorities: string[];
  labels: string[];
}

export interface TicketCreate {
  title: string;
  description?: string;
  status?: string;
  assignee?: string | null;
  priority?: string;
  labels?: string[];
}

export interface TicketUpdate {
  title?: string;
  description?: string;
  assignee?: string | null;
  priority?: string;
  labels?: string[];
}

// --- Knowledge Base ---

export interface Article {
  slug: string;
  title: string;
  parent: string | null;
  tags: string[];
  created_by: string;
  created_at: string;
  updated_by: string;
  updated_at: string;
}

export interface ArticleWithContent extends Article {
  content: string;
  children: Article[];
}

export interface ArticleCreate {
  title: string;
  slug?: string;
  content?: string;
  tags?: string[];
  parent?: string | null;
}

export interface ArticleUpdate {
  title?: string;
  content?: string;
  tags?: string[];
  parent?: string | null;
}

export interface ArticleTreeNode extends Article {
  children: ArticleTreeNode[];
}
