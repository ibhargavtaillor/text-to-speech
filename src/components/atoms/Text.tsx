import { memo, type HTMLAttributes, type ElementType } from 'react';
import { cn } from '@/utils/cn';

interface TextProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  tone?: 'default' | 'muted' | 'accent' | 'danger';
  size?: 'sm' | 'base' | 'lg';
  truncate?: boolean;
}

const TONE: Record<NonNullable<TextProps['tone']>, string> = {
  default: 'text-fg',
  muted: 'text-muted',
  accent: 'text-accent',
  danger: 'text-danger',
};

/** Typography primitive — the single place text color/size tokens are applied. */
export const Text = memo(function Text({
  as: Tag = 'span',
  tone = 'default',
  size = 'base',
  truncate = false,
  className,
  ...rest
}: TextProps) {
  return (
    <Tag
      className={cn(
        TONE[tone],
        size === 'sm' && 'text-sm',
        size === 'base' && 'text-base',
        size === 'lg' && 'text-lg',
        truncate && 'truncate',
        className,
      )}
      {...rest}
    />
  );
});
