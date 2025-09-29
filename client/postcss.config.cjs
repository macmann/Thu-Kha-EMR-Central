// client/postcss.config.cjs
module.exports = {
  plugins: {
    // explicitly point to the ESM config so there's no ambiguity
    tailwindcss: { config: "./tailwind.config.js" },
    autoprefixer: {},
  },
};
