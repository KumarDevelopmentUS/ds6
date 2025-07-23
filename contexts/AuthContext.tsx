// contexts/AuthContext.tsx
import { supabase } from '@/supabase';
import { Session } from '@supabase/supabase-js';
import React, { createContext, useContext, useEffect, useState } from 'react';

// Create an authentication context.
const AuthContext = createContext<{
  session: Session | null;
  isReady: boolean;
  signOut: () => Promise<void>;
}>({
  session: null,
  isReady: false,
  signOut: async () => {},
});

// Custom hook to use the AuthContext.
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Auth provider component
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Fetch initial session.
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('🔐 AuthContext: Initial session loaded:', session ? 'User logged in' : 'No session');
      setSession(session);
      setIsReady(true);
    });

    // Listen for auth state changes.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔐 AuthContext: Auth state changed:', event, session ? 'Session present' : 'No session');
      
      // Handle token refresh events
      if (event === 'TOKEN_REFRESHED') {
        console.log('🔄 AuthContext: Token refreshed successfully');
      }
      
      // Handle sign out events
      if (event === 'SIGNED_OUT') {
        console.log('🚪 AuthContext: User signed out');
      }
      
      setSession(session);
    });

    // Set up periodic token refresh check (every 23 hours to be safe)
    const refreshInterval = setInterval(async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (currentSession) {
          console.log('🔄 AuthContext: Periodic session check - session still valid');
        }
      } catch (error) {
        console.error('❌ AuthContext: Error during periodic session check:', error);
      }
    }, 23 * 60 * 60 * 1000); // 23 hours

    // Unsubscribe from the listener when the component unmounts.
    return () => {
      subscription.unsubscribe();
      clearInterval(refreshInterval);
    };
  }, []);

  const signOut = async () => {
    try {
      console.log('🚪 AuthContext: User initiated sign out');
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('❌ AuthContext: Error during sign out:', error);
        throw error;
      }
      console.log('✅ AuthContext: Sign out successful');
    } catch (error) {
      console.error('❌ AuthContext: Sign out failed:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ session, isReady, signOut }}>
      {children}
    </AuthContext.Provider>
  );
} 