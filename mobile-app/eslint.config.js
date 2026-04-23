// @ts-check
const expoConfig = require("eslint-config-expo/flat")

/**
 * AST selector that matches any `messagesCollection.insert(...)` call.
 * Using `no-restricted-syntax` keeps this plugin-free while still enforcing
 * a project-specific contract.
 */
const DIRECT_MESSAGE_INSERT = {
  selector:
    "CallExpression[callee.type='MemberExpression'][callee.object.name='messagesCollection'][callee.property.name='insert']",
  message:
    "Do not call messagesCollection.insert() directly — it bypasses the offline executor and the server will never see the message. Use insertMessageOffline() from @/src/application/offline/message-executor instead.",
}

module.exports = [
  ...expoConfig,
  {
    ignores: [
      "node_modules/**",
      ".expo/**",
      "dist/**",
      "android/**",
      "ios/**",
      "babel.config.js",
      "metro.config.js",
    ],
  },
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    rules: {
      "no-restricted-syntax": ["error", DIRECT_MESSAGE_INSERT],
    },
  },
  {
    // The executor is the one legitimate caller — it owns the optimistic
    // insert and delegates server sync to @tanstack/offline-transactions.
    files: ["src/application/offline/message-executor.ts"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
]
