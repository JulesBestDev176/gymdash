'use client';
/* eslint-disable @next/next/no-img-element -- Native images preserve GIF playback. */
import { useEffect, useRef, useState } from 'react';

export default function HoverImage({ poster, animation }: { poster: string; animation?: string | null }) {
  const image = useRef<HTMLImageElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const card = image.current?.closest('button');
    if (!card || !animation) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const start = () => { if (!motion.matches) setPlaying(true); };
    const enter = (event: PointerEvent) => { if (event.pointerType !== 'touch') start(); };
    const stop = () => setPlaying(false);
    card.addEventListener('pointerenter', enter);
    card.addEventListener('pointerleave', stop);
    card.addEventListener('focus', start);
    card.addEventListener('blur', stop);
    motion.addEventListener('change', stop);
    return () => {
      card.removeEventListener('pointerenter', enter);
      card.removeEventListener('pointerleave', stop);
      card.removeEventListener('focus', start);
      card.removeEventListener('blur', stop);
      motion.removeEventListener('change', stop);
    };
  }, [animation]);

  return <img ref={image} loading="lazy" src={playing && animation ? animation : poster} alt="" onError={() => setPlaying(false)} />;
}
