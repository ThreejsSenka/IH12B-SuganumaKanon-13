import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

// サイト(index.html)と過去作品(kakosakuhin.html)の2ページをビルドする
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        kakosakuhin: fileURLToPath(new URL('./kakosakuhin.html', import.meta.url)),
      },
    },
  },
})
