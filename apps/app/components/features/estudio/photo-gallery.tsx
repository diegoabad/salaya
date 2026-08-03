"use client";

import { useEffect, useState } from "react";

type Props = {
  images: string[];
  alt?: string;
  className?: string;
  intervalMs?: number;
  /** Contenido sobre la imagen (título, etc.) */
  overlay?: React.ReactNode;
  /** Sin bordes redondeados / full bleed */
  flush?: boolean;
};

export function PhotoGallery({
  images,
  alt = "",
  className = "aspect-[21/9] md:aspect-[2.5/1]",
  intervalMs = 4500,
  overlay,
  flush = false,
}: Props) {
  const slides = images.filter((src) => Boolean(src?.trim()));
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    setIdx(0);
  }, [slides.join("|")]);

  useEffect(() => {
    if (slides.length < 2 || intervalMs <= 0 || paused) return;
    const id = window.setInterval(() => {
      setIdx((i) => (i + 1) % slides.length);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [slides.length, intervalMs, paused]);

  const frame = flush
    ? `relative w-full overflow-hidden bg-paper ${className}`
    : `relative w-full overflow-hidden rounded-2xl border border-line bg-paper ${className}`;

  if (slides.length === 0) {
    return (
      <div
        className={`${frame} flex items-center justify-center bg-gradient-to-br from-surface-2 to-paper text-muted`}
      >
        {overlay ? (
          <div className="absolute inset-0 z-[5] bg-gradient-to-t from-black/85 via-black/40 to-black/50">
            {overlay}
          </div>
        ) : (
          <span className="text-sm font-medium">Sin imagen disponible</span>
        )}
      </div>
    );
  }

  const go = (dir: -1 | 1) => {
    setIdx((i) => (i + dir + slides.length) % slides.length);
  };

  return (
    <div
      className={`group/hero ${frame}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {slides.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`${src}-${i}`}
          src={src}
          alt={i === idx ? alt : ""}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
            i === idx ? "opacity-100" : "opacity-0"
          }`}
        />
      ))}

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/92 via-black/45 to-black/35" />

      {overlay ? (
        <div className="absolute inset-0 z-[5] flex flex-col">{overlay}</div>
      ) : null}

      {slides.length > 1 ? (
        <>
          <button
            type="button"
            aria-label="Foto anterior"
            onClick={() => go(-1)}
            className="absolute left-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/70 text-3xl leading-none text-white opacity-100 drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)] transition md:left-3 md:opacity-0 md:group-hover/hero:opacity-100"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Foto siguiente"
            onClick={() => go(1)}
            className="absolute right-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/70 text-3xl leading-none text-white opacity-100 drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)] transition md:right-3 md:opacity-0 md:group-hover/hero:opacity-100"
          >
            ›
          </button>
          <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-1.5 rounded-full bg-black/40 px-2.5 py-1.5 backdrop-blur-sm md:bottom-5">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Foto ${i + 1}`}
                onClick={() => setIdx(i)}
                className={`h-1.5 rounded-full transition ${
                  i === idx ? "w-5 bg-brand" : "w-1.5 bg-white/50 hover:bg-white/80"
                }`}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
