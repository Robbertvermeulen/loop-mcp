import { createSignal } from 'solid-js';
import type { Answers } from '../types';

export type AutosaveStatus = 'idle' | 'pending' | 'saving' | 'error';

export interface AutosaveOpts {
  saveFn: (data: Answers) => Promise<void>;
  debounceMs?: number;
  retryMs?: number;
  maxRetries?: number;
}

export interface Autosave {
  schedule: (data: Answers) => void;
  flush: () => Promise<void>;
  status: () => AutosaveStatus;
}

export function createAutosave(opts: AutosaveOpts): Autosave {
  const debounceMs = opts.debounceMs ?? 800;
  const retryMs = opts.retryMs ?? 1000;
  const maxRetries = opts.maxRetries ?? 3;

  const [status, setStatus] = createSignal<AutosaveStatus>('idle');
  let pendingData: Answers | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let saving = false;

  const schedule = (data: Answers) => {
    pendingData = data;
    setStatus('pending');
    if (timer) clearTimeout(timer);
    timer = setTimeout(runSave, debounceMs);
  };

  async function runSave() {
    if (saving) return;
    if (pendingData === null) return;
    saving = true;
    setStatus('saving');
    let attempt = 0;
    while (attempt <= maxRetries) {
      const dataToSave = pendingData as Answers;
      try {
        await opts.saveFn(dataToSave);
        if (pendingData === dataToSave) {
          pendingData = null;
          setStatus('idle');
        } else {
          setStatus('pending');
          if (timer) clearTimeout(timer);
          timer = setTimeout(runSave, debounceMs);
        }
        saving = false;
        return;
      } catch {
        attempt += 1;
        if (attempt > maxRetries) {
          setStatus('error');
          saving = false;
          return;
        }
        await new Promise((r) => setTimeout(r, retryMs));
      }
    }
    saving = false;
  }

  const flush = async () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    await runSave();
  };

  return { schedule, flush, status };
}
