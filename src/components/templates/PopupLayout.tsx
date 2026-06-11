import { memo, type ReactNode } from 'react';

/** Structural shell for the popup: fixed width, padding, theme background. */
export const PopupLayout = memo(function PopupLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-[300px] flex-col gap-3 bg-bg p-3.5 font-sans text-fg">
      {children}
    </div>
  );
});
