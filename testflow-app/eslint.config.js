const js = require("@eslint/js");
const security = require("eslint-plugin-security");
const globals = require("globals");

module.exports = [
    js.configs.recommended,
    security.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "commonjs",
            globals: {
                ...globals.node
            }
        },
        rules: {
            "no-console": "warn",
            "security/detect-object-injection": "off",
            "no-unused-vars": "warn"
        }
    },
    {
        ignores: ["node_modules/", "dist/", "coverage/"]
    }
];
