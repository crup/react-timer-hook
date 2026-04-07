module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      [
        'api',
        'build',
        'ci',
        'debug',
        'deps',
        'docs',
        'group',
        'release',
        'schedules',
        'state',
        'timer',
        'types',
      ],
    ],
    'subject-case': [0],
  },
};
