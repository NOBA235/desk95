import { defineConfig } from 'vite';
import { iwsdkDev } from '@iwsdk/vite-plugin-dev';

export default defineConfig({
  plugins: [
    iwsdkDev({
      // Desktop browser emulator (IWER) so you can test without a headset.
      emulator: {
        device: 'metaQuest3',
        // On for the deployed site too, so judges without a headset can try it in a desktop browser.
        // It never starts inside a real Quest browser (the plugin skips OculusBrowser by default).
        activation: 'always',
        injectOnBuild: true,
      },
    }),
  ],
  build: { target: 'es2022', chunkSizeWarningLimit: 4000 },
  server: { host: true }, // lets a Quest on the same Wi-Fi open http://<your-pc-ip>:5173 (WebXR needs HTTPS, see README)
});
