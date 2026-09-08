import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Image as ImageIcon, Pause, Play, Type, Upload, X } from "lucide-react";
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
    position: linePos,
    font,
    color,
    effect,
    setMode,
    setPosition,
    setFont,
    setColor,
    setEffect,
  } = useLyrics();
  const online = useOnline();

  const [chrome, setChrome] = useState(true);
  const [stylesOpen, setStylesOpen] = useState(false);
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
    if (mode !== "scroll") return;
    const box = scrollRef.current;
    const line = activeRef.current;
    if (!box || !line) return;
    const target = line.offsetTop - box.clientHeight / 2 + line.clientHeight / 2;
    box.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
  }, [activeIndex, mode]);

  const singleLine =
    activeIndex >= 0 && lyrics?.synced ? lyrics.synced[activeIndex]?.text : "";
  const alignClass =
    linePos === "top" ? "justify-start pt-24" : linePos === "bottom" ? "justify-end pb-28" : "justify-center";
  const fontClass =
    font === "serif" ? "font-lyrics-serif" : font === "poster" ? "font-lyrics-poster uppercase" : "font-display";
  const effectClass =
    effect === "rise" ? "animate-rise" : effect === "glow" ? "lyric-glow" : effect === "depth" ? "lyric-depth" : "";
  const colorChoices = [
    { name: "Pearl", value: "#f8fafc", className: "bg-foreground" },
    { name: "Gold", value: "#f4d06f", className: "bg-lyrics-gold" },
    { name: "Rose", value: "#f59aae", className: "bg-lyrics-rose" },
    { name: "Sky", value: "#82d8f5", className: "bg-lyrics-sky" },
    { name: "Mint", value: "#77e6bd", className: "bg-lyrics-mint" },
  ];


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
            <button
              onClick={() => setStylesOpen((open) => !open)}
              aria-label="Change lyric text style"
              aria-expanded={stylesOpen}
              className={`rounded-lg p-2 transition-colors ${stylesOpen ? "bg-foreground/15" : ""}`}
            >
              <Type className="size-5" />
            </button>
            <button onClick={toggle} aria-label={isPlaying ? "Pause" : "Play"} className="p-2">
              {isPlaying ? <Pause className="size-5" /> : <Play className="size-5" />}
            </button>
          </div>
        </div>

        {stylesOpen && chrome ? (
          <div
            className="glass mx-4 mt-3 space-y-3 rounded-2xl border border-border p-3 shadow-2xl animate-in fade-in slide-in-from-top-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-background/30 p-1" aria-label="Lyric font">
              {([
                ["modern", "Modern", "font-display"],
                ["serif", "Cinematic", "font-lyrics-serif"],
                ["poster", "Poster", "font-lyrics-poster"],
              ] as const).map(([value, label, sampleClass]) => (
                <button
                  key={value}
                  onClick={() => setFont(value)}
                  className={`min-h-10 rounded-lg px-2 text-xs transition-colors ${sampleClass} ${font === value ? "bg-foreground text-background" : "text-foreground/65"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[10px] font-semibold uppercase text-muted-foreground">Color</span>
              <div className="flex items-center gap-2">
                {colorChoices.map((choice) => (
                  <button
                    key={choice.name}
                    onClick={() => setColor(choice.value)}
                    aria-label={`${choice.name} lyrics`}
                    title={choice.name}
                    className={`size-7 rounded-full border-2 ${choice.className} ${color === choice.value ? "border-foreground" : "border-transparent"}`}
                  />
                ))}
                <label className="relative size-7 overflow-hidden rounded-full border-2 border-border" title="Custom lyric color">
                  <span className="absolute inset-1 rounded-full bg-[conic-gradient(var(--color-lyrics-rose),var(--color-lyrics-gold),var(--color-lyrics-mint),var(--color-lyrics-sky),var(--color-lyrics-rose))]" />
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    aria-label="Custom lyric color"
                    className="absolute inset-0 cursor-pointer opacity-0"
                  />
                </label>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-1" aria-label="Lyric animation">
              {(["clean", "rise", "glow", "depth"] as const).map((value) => (
                <button
                  key={value}
                  onClick={() => setEffect(value)}
                  className={`rounded-lg border px-2 py-2 text-[11px] font-medium capitalize transition-colors ${effect === value ? "border-primary bg-primary/15 text-foreground" : "border-border text-muted-foreground"}`}
                >
                  {value === "depth" ? "3D" : value}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div
          className={`flex flex-wrap items-center justify-center gap-1.5 px-4 pt-2 transition-opacity duration-300 ${chrome ? "opacity-100" : "pointer-events-none opacity-0"}`}
          onClick={(e) => e.stopPropagation()}
        >
          {(["scroll", "single"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-full border px-3 py-1 text-[11px] font-medium ${
                mode === m ? "border-primary bg-primary/15 text-foreground" : "border-border text-muted-foreground"
              }`}
            >
              {m === "scroll" ? "All lines" : "Single line"}
            </button>
          ))}
          {mode === "single"
            ? (["top", "middle", "bottom"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPosition(p)}
                  className={`rounded-full border px-3 py-1 text-[11px] font-medium capitalize ${
                    linePos === p ? "border-primary bg-primary/15 text-foreground" : "border-border text-muted-foreground"
                  }`}
                >
                  {p}
                </button>
              ))
            : null}
        </div>

        {mode === "single" && lyrics?.synced?.length ? (
          <div className={`flex min-h-0 flex-1 flex-col px-7 text-center ${alignClass}`}>
            <p
              key={activeIndex}
              className={`${fontClass} ${effectClass} text-3xl font-semibold leading-snug`}
              style={{ color }}
            >
              {singleLine || "···"}
            </p>
          </div>
        ) : (
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
                   className={`${fontClass} text-xl leading-snug transition-all duration-300 ${
                    i === activeIndex
                       ? `scale-[1.03] ${effectClass}`
                      : "text-foreground/35 blur-[0.4px]"
                  }`}
                   style={i === activeIndex ? { color } : undefined}
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
        )}

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
