'use client';

import Image from 'next/image';

/** Cover als MP4/WebM statt echtem GIF hochgeladen — braucht ein <video>- statt <Image>-Element. */
export function isVideoCoverUrl(url: string): boolean {
  return /\.(mp4|webm|mov)(\?.*)?$/i.test(url);
}

/** Cover-Anzeige, die automatisch zwischen <Image> und <video> wechselt (für MP4/WebM-"GIFs" als Cover). */
export default function CoverMedia({ src, alt, className, unoptimized }: { src: string; alt: string; className?: string; unoptimized?: boolean }) {
  if (isVideoCoverUrl(src)) {
    return <video src={src} autoPlay loop muted playsInline className={`absolute inset-0 w-full h-full ${className ?? ''}`} />;
  }
  return <Image src={src} alt={alt} fill unoptimized={unoptimized} className={className} />;
}
