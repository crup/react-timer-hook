import type { Config } from '@docusaurus/types';
import type { Options as PresetOptions, ThemeConfig } from '@docusaurus/preset-classic';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { themes as prismThemes } from 'prism-react-renderer';

const docsSiteDir = path.dirname(fileURLToPath(import.meta.url));

const config: Config = {
  title: '@crup/react-timer-hook',
  tagline: 'Deterministic React timer primitives for real apps.',
  favicon: 'img/favicon.svg',
  url: 'https://crup.github.io',
  baseUrl: '/react-timer-hook/',
  organizationName: 'crup',
  projectName: 'react-timer-hook',
  trailingSlash: true,
  onBrokenLinks: 'throw',
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },
  presets: [
    [
      'classic',
      {
        docs: {
          routeBasePath: '/',
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/crup/react-timer-hook/edit/main/docs-site/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies PresetOptions,
    ],
  ],
  plugins: [
    function generatedFilesWebpackParser() {
      return {
        name: 'generated-files-webpack-parser',
        configureWebpack() {
          return {
            module: {
              rules: [
                {
                  include: path.join(docsSiteDir, '.docusaurus'),
                  test: /\.js$/,
                  type: 'javascript/auto',
                },
              ],
            },
          };
        },
      };
    },
  ],
  themeConfig: {
    image: 'img/social-card.svg',
    navbar: {
      title: '@crup/react-timer-hook',
      logo: {
        alt: '@crup/react-timer-hook',
        src: 'img/logo.svg',
      },
      items: [
        { to: '/', label: 'Docs', position: 'left' },
        { to: '/getting-started', label: 'Start', position: 'left' },
        { to: '/recipes/basic', label: 'Recipes', position: 'left' },
        { href: 'https://www.npmjs.com/package/@crup/react-timer-hook', label: 'npm', position: 'right' },
        { href: 'https://github.com/crup/react-timer-hook', label: 'GitHub', position: 'right' },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            { label: 'Getting started', to: '/getting-started' },
            { label: 'useTimer', to: '/api/use-timer' },
            { label: 'useTimerGroup', to: '/api/use-timer-group' },
          ],
        },
        {
          title: 'Recipes',
          items: [
            { label: 'Basic', to: '/recipes/basic' },
            { label: 'Intermediate', to: '/recipes/intermediate' },
            { label: 'Advanced', to: '/recipes/advanced' },
          ],
        },
        {
          title: 'Project',
          items: [
            { label: 'GitHub', href: 'https://github.com/crup/react-timer-hook' },
            { label: 'npm', href: 'https://www.npmjs.com/package/@crup/react-timer-hook' },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Crup. Released under MIT.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash'],
    },
  } satisfies ThemeConfig,
};

export default config;
