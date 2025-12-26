// hooks/useKeyboardShortcuts.ts
import { useEffect } from 'react';
import { Platform } from 'react-native';

interface ShortcutConfig {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  callback: () => void;
  description?: string;
}

/**
 * Hook for handling keyboard shortcuts on web
 * Only active on web platform
 */
export const useKeyboardShortcuts = (shortcuts: ShortcutConfig[]) => {
  useEffect(() => {
    // Only run on web
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        const ctrlMatch = shortcut.ctrlKey ? event.ctrlKey : !event.ctrlKey;
        const metaMatch = shortcut.metaKey ? event.metaKey : !event.metaKey;
        const shiftMatch = shortcut.shiftKey ? event.shiftKey : !event.shiftKey;
        const altMatch = shortcut.altKey ? event.altKey : !event.altKey;
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();

        // Allow either Ctrl or Meta (Cmd on Mac) for shortcuts that specify ctrlKey
        const modifierMatch = shortcut.ctrlKey || shortcut.metaKey
          ? (event.ctrlKey || event.metaKey) && shiftMatch && altMatch
          : ctrlMatch && metaMatch && shiftMatch && altMatch;

        if (keyMatch && modifierMatch) {
          event.preventDefault();
          shortcut.callback();
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
};

/**
 * Hook for handling Escape key to close modals/dialogs
 */
export const useEscapeKey = (onEscape: () => void, enabled: boolean = true) => {
  useKeyboardShortcuts(
    enabled
      ? [{ key: 'Escape', callback: onEscape, description: 'Close modal' }]
      : []
  );
};

/**
 * Common keyboard shortcuts for the app
 */
export const createCommonShortcuts = (actions: {
  onSearch?: () => void;
  onNewMatch?: () => void;
  onHome?: () => void;
  onSettings?: () => void;
  onRefresh?: () => void;
}): ShortcutConfig[] => {
  const shortcuts: ShortcutConfig[] = [];

  if (actions.onSearch) {
    shortcuts.push({
      key: 'k',
      ctrlKey: true,
      callback: actions.onSearch,
      description: 'Open search',
    });
  }

  if (actions.onNewMatch) {
    shortcuts.push({
      key: 'n',
      ctrlKey: true,
      callback: actions.onNewMatch,
      description: 'Start new match',
    });
  }

  if (actions.onHome) {
    shortcuts.push({
      key: 'h',
      ctrlKey: true,
      callback: actions.onHome,
      description: 'Go to home',
    });
  }

  if (actions.onSettings) {
    shortcuts.push({
      key: ',',
      ctrlKey: true,
      callback: actions.onSettings,
      description: 'Open settings',
    });
  }

  if (actions.onRefresh) {
    shortcuts.push({
      key: 'r',
      ctrlKey: true,
      callback: actions.onRefresh,
      description: 'Refresh content',
    });
  }

  return shortcuts;
};

