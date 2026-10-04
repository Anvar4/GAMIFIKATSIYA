import { Volume2, VolumeX } from 'lucide-react';
import clsx from 'clsx';
import type { SoundChannel } from '../../lib/sound';
import { useSound } from '../../hooks/useUi';

/** Ovoz faqat foydalanuvchi tugmani bosganida yoqiladi (avtomatik ijro yoʻq) */
export function SoundControls({ channel, className, showSlider = true }: { channel: SoundChannel; className?: string; showSlider?: boolean }) {
  const { engine, settings } = useSound(channel);
  return (
    <div className={clsx('flex items-center gap-2', className)}>
      <button
        type="button"
        className={clsx('btn btn-sm', settings.enabled ? 'btn-ghost' : 'btn-ghost border-arena-warning/40 text-arena-warning')}
        onClick={() => (settings.enabled ? engine.disable() : void engine.enable())}
        aria-pressed={settings.enabled}
        title={settings.enabled ? 'Ovozni oʻchirish' : 'Ovozni yoqish'}
      >
        {settings.enabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        <span className="hidden sm:inline">{settings.enabled ? 'Ovoz' : 'Ovozni yoqish'}</span>
      </button>
      {showSlider && settings.enabled && (
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={settings.volume}
          onChange={(e) => engine.setVolume(Number(e.target.value))}
          className="w-20 accent-[#3EE7FF]"
          aria-label="Ovoz balandligi"
        />
      )}
    </div>
  );
}
