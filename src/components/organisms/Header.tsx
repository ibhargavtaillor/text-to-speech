import { memo } from 'react';
import { Text } from '@/components/atoms/Text';

export const Header = memo(function Header() {
  return (
    <header className="flex items-center gap-2">
      <span aria-hidden className="text-xl">
        🎧
      </span>
      <Text as="h1" size="lg" className="font-semibold">
        Podcastify
      </Text>
    </header>
  );
});
