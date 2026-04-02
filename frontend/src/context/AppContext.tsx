import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User as UserType, Article } from '../types';
import { getMe } from '../api/auth';

interface AppContextType {
  currentUser: UserType | null;
  setCurrentUser: (u: UserType | null) => void;
  authModal: 'login' | 'register' | null;
  setAuthModal: (m: 'login' | 'register' | null) => void;
  selectedArticle: Article | null;
  setSelectedArticle: (a: Article | null) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [authModal, setAuthModal] = useState<'login' | 'register' | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

  useEffect(() => {
    getMe().then(u => setCurrentUser(u)).catch(() => {});
  }, []);

  return (
    <AppContext.Provider value={{ currentUser, setCurrentUser, authModal, setAuthModal, selectedArticle, setSelectedArticle }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextType {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
