import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docs: [
    'index',
    'getting-started',
    'ai',
    {
      type: 'category',
      label: 'API',
      items: ['api/use-timer', 'api/use-timer-group', 'api/types'],
    },
    {
      type: 'category',
      label: 'Recipes',
      items: ['recipes/basic', 'recipes/intermediate', 'recipes/advanced'],
    },
    {
      type: 'category',
      label: 'Project',
      items: ['project/debug-logs', 'project/release-channels', 'project/contributing'],
    },
  ],
};

export default sidebars;
