import { useState } from 'react';

interface NoirImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackTitle?: string;
}

export function NoirImage({ src, alt, className = '', fallbackTitle }: NoirImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#171B24] via-[#11141B] to-[#0B0D11] text-[#98A2B3] ${className}`}
      >
        <svg viewBox="0 0 48 48" className="h-10 w-10 text-[#D99B38]/60" fill="none" aria-hidden="true">
          <rect x="6" y="10" width="36" height="28" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="24" cy="24" r="7" stroke="currentColor" strokeWidth="1.5" />
          <path d="M6 34L17 25L24 30L32 22L42 32" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        <span className="mt-2 font-mono-tabular text-xs tracking-wide text-[#98A2B3]">
          {fallbackTitle ?? alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
