import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { Wordmark } from '@/components/wordmark';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: <Wordmark />,
    },
    links: [
      { text: 'Documentation', url: '/docs', active: 'nested-url' },
      { text: 'First mod', url: '/docs/first-mod' },
      { text: 'Reference', url: '/docs/reference', active: 'nested-url' },
      { text: 'Explorer', url: '/explorer' },
      { text: 'Mods', url: '/mods' },
      { text: 'Icons', url: '/icons' },
    ],
  };
}
