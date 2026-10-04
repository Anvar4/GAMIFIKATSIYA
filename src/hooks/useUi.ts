import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { readLocal, writeLocal } from '../lib/storage';
import { soundEngine, type SoundChannel, type SoundSettings } from '../lib/sound';

// ---------- Harakatni kamaytirish (reduced motion) ----------
const RM_KEY = 'it-arena-reduced-motion';
const rmListeners = new Set<() => void>();
let rmOverride: boolean | null = readLocal<boolean | null>(RM_KEY, null);

function systemReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function subscribeReducedMotion(cb: () => void) {
  rmListeners.add(cb);
  return () => {
    rmListeners.delete(cb);
  };
}

function reducedMotionSnapshot() {
  return rmOverride ?? systemReducedMotion();
}

export function useReducedMotion(): [boolean, (v: boolean) => void] {
  const value = useSyncExternalStore(subscribeReducedMotion, reducedMotionSnapshot);
  const set = useCallback((v: boolean) => {
    rmOverride = v;
    writeLocal(RM_KEY, v);
    rmListeners.forEach((l) => l());
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', value);
  }, [value]);
  return [value, set];
}

// ---------- Ovoz ----------
export function useSound(channel: SoundChannel) {
  const engine = soundEngine(channel);
  const [settings, setSettings] = useState<SoundSettings>(engine.state);
  useEffect(() => engine.subscribe(setSettings), [engine]);
  return { engine, settings };
}

// ---------- Toʻliq ekran ----------
export function useFullscreen() {
  const [active, setActive] = useState(() => Boolean(document.fullscreenElement));
  useEffect(() => {
    const on = () => setActive(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);
  const toggle = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      /* brauzer ruxsat bermasa eʼtiborsiz */
    }
  }, []);
  return { active, toggle };
}

// ---------- Katta ekran uchun shrift masshtabi ----------
/** Arena va taqdimotda butun interfeys ekran kengligiga mos kattalashadi */
export function useStageScale(enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const html = document.documentElement;
    const prev = html.style.fontSize;
    html.style.fontSize = 'clamp(13px, min(1.05vw, 1.9vh), 40px)';
    return () => {
      html.style.fontSize = prev;
    };
  }, [enabled]);
}

// ---------- Hujjat sarlavhasi ----------
export function useDocumentTitle(title: string) {
  useEffect(() => {
    const prev = document.title;
    document.title = title ? `${title} • IT ARENA` : 'IT ARENA — Galaktik Jang';
    return () => {
      document.title = prev;
    };
  }, [title]);
}
