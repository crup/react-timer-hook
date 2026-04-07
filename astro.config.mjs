import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://crup.github.io',
  base: '/react-timer-hook',
  srcDir: './docs-site',
  outDir: './docs-dist',
  integrations: [
    starlight({
      title: '@crup/react-timer-hook',
      description: 'Deterministic React timer lifecycle hooks for timers, schedules, and many independent timers.',
      editLink: {
        baseUrl: 'https://github.com/crup/react-timer-hook/edit/main',
      },
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/crup/react-timer-hook',
        },
      ],
      customCss: ['./docs-site/styles/starlight.css'],
      sidebar: [
        {
          label: 'Start',
          items: [
            { label: 'Overview', link: '/' },
            { label: 'Getting started', link: '/getting-started/' },
            { label: 'AI-first usage', link: '/ai/' },
          ],
        },
        {
          label: 'API',
          items: [
            { label: 'useTimer', link: '/api/use-timer/' },
            { label: 'useTimerGroup', link: '/api/use-timer-group/' },
            { label: 'Types', link: '/api/types/' },
          ],
        },
        {
          label: 'Recipes',
          items: [
            { label: 'Countdowns', link: '/recipes/countdowns/' },
            { label: 'Stopwatch and clock', link: '/recipes/stopwatch-clock/' },
            { label: 'Polling and schedules', link: '/recipes/polling/' },
            { label: 'Many independent timers', link: '/recipes/many-timers/' },
          ],
        },
        {
          label: 'Project',
          items: [
            { label: 'Debug logs', link: '/project/debug-logs/' },
            { label: 'Release channels', link: '/project/release-channels/' },
            { label: 'Contributing', link: '/project/contributing/' },
          ],
        },
      ],
    }),
  ],
});
