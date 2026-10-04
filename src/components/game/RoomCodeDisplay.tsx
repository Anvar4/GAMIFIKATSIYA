import { QRCodeSVG } from 'qrcode.react';
import clsx from 'clsx';
import { Copy } from 'lucide-react';
import { useState } from 'react';

export function joinUrl(code: string): string {
  return `${window.location.origin}/join/${code}`;
}

export function RoomCodeDisplay({ code, size = 'md', showQr = true, className }: { code: string; size?: 'sm' | 'md' | 'lg'; showQr?: boolean; className?: string }) {
  const [copied, setCopied] = useState(false);
  const letter = { sm: 'h-10 w-8 text-xl', md: 'h-14 w-11 text-3xl', lg: 'h-[4.6rem] w-[3.6rem] text-5xl' }[size];
  const qr = { sm: 96, md: 140, lg: 210 }[size];
  const url = joinUrl(code);
  return (
    <div className={clsx('flex flex-wrap items-center justify-center gap-5', className)}>
      <div className="text-center">
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-arena-muted">Xona kodi</div>
        <div className="flex gap-1.5" aria-label={`Xona kodi: ${code.split('').join(' ')}`}>
          {code.split('').map((ch, i) => (
            <span
              key={i}
              className={clsx(
                'flex items-center justify-center rounded-xl border border-arena-cyan/40 bg-space-950/70 font-logo font-black text-arena-cyan text-glow-cyan',
                letter,
              )}
            >
              {ch}
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(url).then(() => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            });
          }}
          className="mt-2 inline-flex items-center gap-1.5 text-xs text-arena-muted hover:text-arena-cyan"
        >
          <Copy className="h-3.5 w-3.5" />
          {copied ? 'Havola nusxalandi' : url.replace(/^https?:\/\//, '')}
        </button>
      </div>
      {showQr && (
        <div className="rounded-2xl bg-white p-2.5 shadow-glow">
          <QRCodeSVG value={url} size={qr} level="M" bgColor="#ffffff" fgColor="#07111F" />
        </div>
      )}
    </div>
  );
}
