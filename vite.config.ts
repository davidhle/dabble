import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages serves the site from https://<user>.github.io/<repo>/,
  // not from the domain root, so every asset URL Vite generates needs this
  // prefix or the deployed page will 404 on its JS/CSS. The dev server
  // ignores `base` for local URLs, so this has no effect on `npm run dev`.
  // Must exactly match the GitHub repo name ('dabble') — if the repo is
  // ever renamed, update this value too or the deployed build will break.
  base: '/dabble/',
});
