import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docs: [
    'index',
    'getting-started',
    'ai',
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
            'recipes/advanced/per-item-polling',
            'recipes/advanced/dynamic-items',
          ],
        },
      ],
    },
    {
      type: 'category',
      label: 'Project',
      items: ['project/debug-logs', 'project/release-channels', 'project/contributing'],
    },
  ],
};

export default sidebars;
