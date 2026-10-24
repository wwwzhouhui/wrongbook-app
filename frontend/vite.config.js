import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 开发期代理：npm run dev 时把 /api 转发到本地 FastAPI(8000)，避免 CORS 与跨域配置；
// 生产构建由 nginx 做同样的反向代理（见 nginx.conf），前端代码里永远只用相对路径 /api。
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:8000' },
  },
})
