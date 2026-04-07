import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docs: [
    'index',
    'getting-started',
    'ai',
    {
      type: 'category',
      label: 'Use cases',
      link: { type: 'doc', id: 'use-cases/index' },
      items: ['use-cases/core', 'use-cases/schedules', 'use-cases/groups', 'use-cases/composition'],
    },
    {
      type: 'category',
      label: 'API',
      items: ['api/use-timer', 'api/use-scheduled-timer', 'api/use-timer-group', 'api/types'],
    },
    {
      type: 'category',
      label: 'Recipes',
      items: [
        {
          type: 'category',
          label: 'Basic',
          link: { type: 'doc', id: 'recipes/basic/index' },
          items: [
            'recipes/basic/wall-clock',
            'recipes/basic/stopwatch',
            'recipes/basic/absolute-countdown',
            'recipes/basic/pausable-countdown',
            'recipes/basic/otp-resend',
            'recipes/basic/manual-controls',
          ],
        },
        {
          type: 'category',
          label: 'Intermediate',
          link: { type: 'doc', id: 'recipes/intermediate/index' },
          items: [
            'recipes/intermediate/once-only-on-end',
            'recipes/intermediate/polling-schedule',
            'recipes/intermediate/autosave-heartbeat',
            'recipes/intermediate/poll-and-cancel',
            'recipes/intermediate/backend-event-stop',
            'recipes/intermediate/debug-logs',
          ],
        },
        {
          type: 'category',
          label: 'Advanced',
          link: { type: 'doc', id: 'recipes/advanced/index' },
          items: [
            'recipes/advanced/many-display-countdowns',
            'recipes/advanced/timer-group',
            'recipes/advanced/group-controls',
            'recipes/advanced/checkout-holds',
            'recipes/advanced/per-item-polling',
            'recipes/advanced/dynamic-items',
            'recipes/advanced/toast-auto-dismiss',
          ],
        },
      ],
    },
    {
      type: 'category',
      label: 'Project',
      items: ['project/caveats', 'project/debug-logs', 'project/release-channels', 'project/contributing'],
    },
  ],
};

export default sidebars;
