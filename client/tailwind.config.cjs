// client/tailwind.config.cjs
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "../packages/ui/**/*.{js,ts,jsx,tsx}"   // adjust to your layout
  ],
  theme: { extend: {} },
  plugins: [],
};
