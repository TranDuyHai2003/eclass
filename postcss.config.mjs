const config = {
  plugins: {
    "@tailwindcss/postcss": {},
    // Transpile @layer, oklch(), etc. for older Safari/iPadOS (< 15.4)
    "postcss-preset-env": {
      browsers: [
        "last 2 versions",
        "Safari >= 12",
        "iOS >= 12",
        "not dead",
      ],
      features: {
        "cascade-layers": true,
        "oklab-function": { preserve: false },
        "relative-color-syntax": { preserve: false },
      },
    },
  },
};

export default config;
