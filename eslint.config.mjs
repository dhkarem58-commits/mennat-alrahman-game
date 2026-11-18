import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';

export default [
  {
    ignores: ['dist/**/*', 'node_modules/**/*', 'client/**/*', 'src/**/*'],
  },
  firebaseRulesPlugin.configs['flat/recommended'],
];
