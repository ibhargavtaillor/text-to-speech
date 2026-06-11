import { memo, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible label — required because the button content is an icon glyph. */
  label: string;
  variant?: 'default' | 'primary';
}

/**
 * Square control button. `label` is mandatory and maps to aria-label, so every
 * icon button is screen-reader navigable by construction.
 */
export const IconButton = memo(function IconButton({
  label,
  variant = 'default',
  className,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'flex h-10 items-center justify-center rounded-lg border text-base transition-colors active:scale-95',
        'focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40',
        variant === 'primary'
          ? 'w-[52px] border-accent bg-accent text-accent-fg hover:bg-accent-hover'
          : 'w-11 border-border bg-surface text-fg hover:bg-surface-hover',
        className,
      )}
      {...rest}
    />
  );
});
