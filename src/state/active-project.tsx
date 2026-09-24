import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, type ReactNode, use, useEffect, useState } from 'react';

const KEY = 'activeProjectId';

interface ActiveProjectValue {
  /** undefined while loading from storage, null when none picked. */
  projectId: string | null | undefined;
  setProjectId: (id: string | null) => void;
}

const ActiveProjectContext = createContext<ActiveProjectValue | null>(null);

export function ActiveProjectProvider({ children }: { children: ReactNode }) {
  const [projectId, setState] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => setState(v));
  }, []);

  function setProjectId(id: string | null) {
    setState(id);
    if (id) AsyncStorage.setItem(KEY, id);
    else AsyncStorage.removeItem(KEY);
  }

  return <ActiveProjectContext value={{ projectId, setProjectId }}>{children}</ActiveProjectContext>;
}

export function useActiveProject() {
  const ctx = use(ActiveProjectContext);
  if (!ctx) throw new Error('useActiveProject outside ActiveProjectProvider');
  return ctx;
}
