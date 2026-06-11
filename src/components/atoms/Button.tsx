import { memo, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'ghost' | 'accent';
}

/** Full-width text button used for secondary actions (Pick a section, Rescan). */
export const Button = memo(function Button({
  variant = 'ghost',
  className,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        'w-full rounded-md border px-3 py-2 text-sm transition-colors focus-visible:outline-none',
        variant === 'accent'
          ? 'border-accent font-semibold text-accent hover:bg-accent/10'
          : 'border-dashed border-border text-muted hover:border-muted hover:text-fg',
        className,
      )}
      {...rest}
    />
  );
});
