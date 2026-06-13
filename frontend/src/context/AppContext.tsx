import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User as UserType, Article } from '../types';
import { getMe, getPreferences } from '../api/auth';
import type { UserPreferences } from '../api/auth';

interface AppContextType {
  currentUser: UserType | null;
  setCurrentUser: (u: UserType | null) => void;
  authModal: 'login' | 'register' | null;
  setAuthModal: (m: 'login' | 'register' | null) => void;
  selectedArticle: Article | null;
  setSelectedArticle: (a: Article | null) => void;
  preferences: UserPreferences;
  setPreferences: (p: UserPreferences) => void;
}

const DEFAULT_PREFS: UserPreferences = { sports: [], fav_teams: {} };

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [authModal, setAuthModal] = useState<'login' | 'register' | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFS);

  useEffect(() => {
    getMe().then(u => {
      setCurrentUser(u);
      if (u) getPreferences().then(setPreferences).catch(() => {});
    }).catch(() => {});
  }, []);

  // Reload preferences whenever user logs in
  useEffect(() => {
    if (currentUser) {
      getPreferences().then(setPreferences).catch(() => {});
    } else {
      setPreferences(DEFAULT_PREFS);
    }
  }, [currentUser?.id]);

  return (
    <AppContext.Provider value={{
      currentUser, setCurrentUser,
      authModal, setAuthModal,
      selectedArticle, setSelectedArticle,
      preferences, setPreferences,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextType {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
