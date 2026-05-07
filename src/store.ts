import { create } from 'zustand';

export type UserRole = 'super-admin' | 'admin' | 'senior-editor' | 'editor' | 'viewer';

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  name: string;
  role: UserRole;
  two_factor_enabled?: boolean;
}

interface AuthState {
  user: AuthUser | null;
  role: UserRole | null;
  setUser: (user: AuthUser | null) => void;
  setRole: (role: UserRole | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  role: null,
  setUser: (user) => set({ user, role: user?.role ?? null }),
  setRole: (role) => set({ role }),
  logout: () => {
    localStorage.removeItem('auth_token');
    set({ user: null, role: null });
  },
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
