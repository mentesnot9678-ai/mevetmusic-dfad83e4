import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Image as ImageIcon, Pause, Play, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { usePlayer } from "@/store/player";
import { useLyrics } from "@/store/lyrics";
import { useOnline } from "@/hooks/useOnline";


export const Route = createFileRoute("/lyrics")({
  head: () => ({
    meta: [
      { title: "Lyrics — Mevet Player" },
      {
        name: "description",
        content:
          "Immersive full-screen lyrics with automatic syncing, your own background image or video, and manual .lrc import.",
      },
      { property: "og:title", content: "Lyrics — Mevet Player" },
      { property: "og:description", content: "Full-screen synced lyrics with a custom backdrop." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LyricsScreen,
});

function LyricsScreen() {
  const track = usePlayer((s) => (s.index >= 0 ? s.queue[s.index] : null));
  const position = usePlayer((s) => s.position);
  const isPlaying = usePlayer((s) => s.isPlaying);
  const toggle = usePlayer((s) => s.toggle);
  const {
    byTrack,
    loading,
    load,
    importFile,
    bgMedia,
    setBgMedia,
    mode,
    position,
    setMode,
    setPosition,
  } = useLyrics();
  const online = useOnline();

  const [chrome, setChrome] = useState(true);
  const lrcRef = useRef<HTMLInputElement>(null);
  const bgRef = useRef<HTMLInputElement>(null);
  const activeRef = useRef<HTMLParagraphElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (track) void load(track);
  }, [track, load, online]);

  const lyrics = track ? byTrack[track.key] : null;


  const activeIndex = useMemo(() => {
    if (!lyrics?.synced) return -1;
    let idx = -1;
    lyrics.synced.forEach((l, i) => {
      if (l.time <= position + 0.25) idx = i;
    });
    return idx;
  }, [lyrics, position]);

  // Keep the active line centred by scrolling the lyrics container itself
  // (scrollIntoView would scroll the page instead on mobile).
  useEffect(() => {
    const box = scrollRef.current;
    const line = activeRef.current;
    if (!box || !line) return;
    const target = line.offsetTop - box.clientHeight / 2 + line.clientHeight / 2;
    box.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
  }, [activeIndex]);


  return (
    <div
      className="relative h-[100dvh] overflow-hidden bg-background"
      onClick={() => setChrome((c) => !c)}
    >
      {bgMedia?.type === "video" ? (
        <video
          src={bgMedia.url}
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 size-full object-cover"
        />
      ) : bgMedia?.type === "image" ? (
        <img src={bgMedia.url} alt="" className="absolute inset-0 size-full object-cover" />
      ) : track?.artUrl ? (
        <img src={track.artUrl} alt="" className="absolute inset-0 size-full scale-110 object-cover blur-2xl" />
      ) : null}
      <div className="absolute inset-0 bg-background/70" />

      <div className="relative mx-auto flex h-full max-w-md flex-col">
        <div
          className={`flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)+12px)] transition-opacity duration-300 ${chrome ? "opacity-100" : "pointer-events-none opacity-0"}`}
          onClick={(e) => e.stopPropagation()}
        >
          <Link to="/now-playing" aria-label="Close lyrics" className="p-2">
            <X className="size-6" />
          </Link>
          <div className="flex items-center gap-1">
            <button onClick={() => lrcRef.current?.click()} aria-label="Import lyrics file" className="p-2">
              <Upload className="size-5" />
            </button>
            <button onClick={() => bgRef.current?.click()} aria-label="Set background" className="p-2">
              <ImageIcon className="size-5" />
            </button>
            <button onClick={toggle} aria-label={isPlaying ? "Pause" : "Play"} className="p-2">
              {isPlaying ? <Pause className="size-5" /> : <Play className="size-5" />}
            </button>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="no-scrollbar relative min-h-0 flex-1 overflow-y-auto px-7 py-[40vh] text-center"
        >

          {!track ? (
            <p className="text-sm text-muted-foreground">Play a song to see its lyrics.</p>
          ) : loading && !lyrics ? (
            <p className="text-sm text-muted-foreground">Looking for lyrics…</p>
          ) : lyrics?.synced?.length ? (
            <div className="space-y-4">
              {lyrics.synced.map((line, i) => (
                <p
                  key={`${line.time}-${i}`}
                  ref={i === activeIndex ? activeRef : undefined}
                  className={`font-display text-xl leading-snug transition-all duration-300 ${
                    i === activeIndex
                      ? "scale-[1.03] text-foreground"
                      : "text-foreground/35 blur-[0.4px]"
                  }`}
                >
                  {line.text || "···"}
                </p>
              ))}
            </div>
          ) : lyrics?.plain ? (
            <p className="whitespace-pre-wrap font-display text-lg leading-relaxed text-foreground/85">
              {lyrics.plain}
            </p>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {online
                  ? "No lyrics found for this track."
                  : "You're offline — no saved lyrics for this track yet."}
              </p>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  lrcRef.current?.click();
                }}
                className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
              >
                Import .lrc or .txt
              </button>
            </div>
          )}
        </div>

        <p
          className={`pb-8 text-center text-[11px] text-muted-foreground transition-opacity ${chrome ? "opacity-100" : "opacity-0"}`}
        >
          {lyrics?.source ? `Lyrics via ${lyrics.source} · ` : ""}Tap anywhere to hide controls
        </p>
      </div>

      <input
        ref={lrcRef}
        type="file"
        accept=".lrc,.txt,text/plain"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file || !track) return;
          await importFile(track.key, file);
          toast.success("Lyrics imported");
        }}
      />
      <input
        ref={bgRef}
        type="file"
        accept="image/*,video/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setBgMedia({
            url: URL.createObjectURL(file),
            type: file.type.startsWith("video") ? "video" : "image",
          });
        }}
      />
    </div>
  );
}
