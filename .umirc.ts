import { defineConfig } from 'umi';

export default defineConfig({
  npmClient: 'npm',

  routes: [
    { path: '/health', component: 'health/index' },
    { path: '/', redirect: '/dashboard' },
    { path: '/login', component: 'login/index' },
    { path: '/register', component: 'register/index' },
    { path: '/dashboard', component: 'dashboard/index' },
    { path: '/signals', component: 'signals/index' },
    { path: '/profile', component: 'profile/index' },
  ],


  styles: [
    `
      html, body, #root {
        height: 100%;
      }
      body {
        margin: 0;
        background: #0a0a0a;
        color: #fff;
        font-family: 'SF Mono', 'Fira Code', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
          'Liberation Mono', 'Courier New', monospace;
      }
      a { color: #00ff88; }
    `,
  ],
});