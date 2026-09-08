import { create } from "zustand";
import { fetchLyrics, lyricsFromFile, type Lyrics } from "@/lib/lyrics";
import { loadLyricsCache, saveLyricsToCache } from "@/lib/lyrics-cache";
import type { Track } from "@/lib/types";

export type LyricsMode = "scroll" | "single";
export type LyricsPosition = "top" | "middle" | "bottom";
export type LyricsFont = "modern" | "serif" | "poster";
export type LyricsEffect = "clean" | "rise" | "glow" | "depth";

type LyricsState = {
  byTrack: Record<string, Lyrics | null>;
  loading: boolean;
  hydrated: boolean;
  prefetching: boolean;
  bgMedia: { url: string; type: "image" | "video" } | null;
  mode: LyricsMode;
  position: LyricsPosition;
  font: LyricsFont;
  color: string;
  effect: LyricsEffect;
  setMode: (m: LyricsMode) => void;
  setPosition: (p: LyricsPosition) => void;
  setFont: (font: LyricsFont) => void;
  setColor: (color: string) => void;
  setEffect: (effect: LyricsEffect) => void;
  hydrate: () => void;
  load: (track: Track, force?: boolean) => Promise<void>;
  prefetchAll: (tracks: Track[]) => Promise<void>;
  importFile: (trackKey: string, file: File) => Promise<void>;
  setBgMedia: (m: { url: string; type: "image" | "video" } | null) => void;
};

const inFlight = new Set<string>();
const STYLE_KEY = "mevet.lyrics-style";

export const useLyrics = create<LyricsState>((set, get) => ({
  byTrack: {},
  loading: false,
  hydrated: false,
  prefetching: false,
  bgMedia: null,
  mode: "scroll",
  position: "middle",
  font: "serif",
  color: "#f8fafc",
  effect: "depth",
  setMode: (m) => {
    if (typeof localStorage !== "undefined") localStorage.setItem("lyrics-mode", m);
    set({ mode: m });
  },
  setPosition: (p) => {
    if (typeof localStorage !== "undefined") localStorage.setItem("lyrics-position", p);
    set({ position: p });
  },
  setFont: (font) => {
    const next = { font, color: get().color, effect: get().effect };
    if (typeof localStorage !== "undefined") localStorage.setItem(STYLE_KEY, JSON.stringify(next));
    set({ font });
  },
  setColor: (color) => {
    const next = { font: get().font, color, effect: get().effect };
    if (typeof localStorage !== "undefined") localStorage.setItem(STYLE_KEY, JSON.stringify(next));
    set({ color });
  },
  setEffect: (effect) => {
    const next = { font: get().font, color: get().color, effect };
    if (typeof localStorage !== "undefined") localStorage.setItem(STYLE_KEY, JSON.stringify(next));
    set({ effect });
  },
  hydrate: () => {
    if (get().hydrated) return;
    let mode: LyricsMode = "scroll";
    let position: LyricsPosition = "middle";
    let font: LyricsFont = "serif";
    let color = "#f8fafc";
    let effect: LyricsEffect = "depth";
    if (typeof localStorage !== "undefined") {
      mode = (localStorage.getItem("lyrics-mode") as LyricsMode | null) ?? mode;
      position = (localStorage.getItem("lyrics-position") as LyricsPosition | null) ?? position;
      try {
        const saved = JSON.parse(localStorage.getItem(STYLE_KEY) ?? "{}") as {
          font?: LyricsFont;
          color?: string;
          effect?: LyricsEffect;
        };
        font = saved.font ?? font;
        color = saved.color ?? color;
        effect = saved.effect ?? effect;
      } catch {
        /* keep cinematic defaults */
      }
    }
    set({
      byTrack: { ...loadLyricsCache(), ...get().byTrack },
      hydrated: true,
      mode,
      position,
      font,
      color,
      effect,
    });
  },
  load: async (track, force = false) => {
    get().hydrate();
    const cached = get().byTrack[track.key];
    if (!force && cached) return;
    if (!force && track.key in get().byTrack && cached === null) return;
    if (inFlight.has(track.key)) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;

    inFlight.add(track.key);
    set({ loading: true });
    try {
      const res = await fetchLyrics({
        title: track.title,
        artist: track.artist,
        album: track.album,
        duration: track.duration,
      });
      if (res) saveLyricsToCache(track.key, res);
      set({ byTrack: { ...get().byTrack, [track.key]: res } });
    } finally {
      inFlight.delete(track.key);
      set({ loading: inFlight.size > 0 });
    }
  },
  /** Fetch and store lyrics for every track in the library, one at a time. */
  prefetchAll: async (tracks) => {
    get().hydrate();
    if (get().prefetching) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    const pending = tracks.filter((t) => !get().byTrack[t.key]);
    if (!pending.length) return;

    set({ prefetching: true });
    try {
      for (const track of pending) {
        if (typeof navigator !== "undefined" && !navigator.onLine) break;
        await get().load(track);
        await new Promise((r) => setTimeout(r, 350));
      }
    } finally {
      set({ prefetching: false });
    }
  },
  importFile: async (trackKey, file) => {
    const text = await file.text();
    const parsed = lyricsFromFile(file.name, text);
    saveLyricsToCache(trackKey, parsed);
    set({ byTrack: { ...get().byTrack, [trackKey]: parsed } });
  },
  setBgMedia: (m) => set({ bgMedia: m }),
}));
