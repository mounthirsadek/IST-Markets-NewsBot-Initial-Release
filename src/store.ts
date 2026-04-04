import { create } from 'zustand';
import { User } from 'firebase/auth';

export type UserRole = 'super-admin' | 'admin' | 'senior-editor' | 'editor' | 'viewer';

interface AuthState {
  user: User | null;
  role: UserRole | null;
  setUser: (user: User | null) => void;
  setRole: (role: UserRole | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  role: null,
  setUser: (user) => set({ user }),
  setRole: (role) => set({ role }),
}));

interface NewsState {
  articles: any[];
  setArticles: (articles: any[]) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
}

export const useNewsStore = create<NewsState>((set) => ({
  articles: [],
  setArticles: (articles) => set({ articles }),
  loading: false,
  setLoading: (loading) => set({ loading }),
}));
