import { createRouter, createWebHashHistory } from 'vue-router';

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/split-audio',
      name: 'split-audio',
      component: () => import('@/views/SplitAudio/index.vue')
    }
  ]
});
export default router;
