import { create } from "zustand";
import { fetchLyrics, lyricsFromFile, type Lyrics } from "@/lib/lyrics";
import { loadLyricsCache, saveLyricsToCache } from "@/lib/lyrics-cache";
import type { Track } from "@/lib/types";

export type LyricsMode = "scroll" | "single";
export type LyricsPosition = "top" | "middle" | "bottom";

type LyricsState = {
  byTrack: Record<string, Lyrics | null>;
  loading: boolean;
  hydrated: boolean;
  prefetching: boolean;
  bgMedia: { url: string; type: "image" | "video" } | null;
  mode: LyricsMode;
  position: LyricsPosition;
  setMode: (m: LyricsMode) => void;
  setPosition: (p: LyricsPosition) => void;
  hydrate: () => void;
  load: (track: Track, force?: boolean) => Promise<void>;
  prefetchAll: (tracks: Track[]) => Promise<void>;
  importFile: (trackKey: string, file: File) => Promise<void>;
  setBgMedia: (m: { url: string; type: "image" | "video" } | null) => void;
};

const inFlight = new Set<string>();

export const useLyrics = create<LyricsState>((set, get) => ({
  byTrack: {},
  loading: false,
  hydrated: false,
  prefetching: false,
  bgMedia: null,
  hydrate: () => {
    if (get().hydrated) return;
    set({ byTrack: { ...loadLyricsCache(), ...get().byTrack }, hydrated: true });
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
