import { Hono, Context } from 'jsr:@hono/hono';
import type { QueueManager } from '../libs/queue-manager.ts';

export class HonoAdaptor {
  private router: Hono;
  private title: string;
  private jobQueueManager: QueueManager;

  constructor(jobQueueManager: QueueManager) {
    this.jobQueueManager = jobQueueManager;
    this.router = new Hono();
    this.title = 'Redis-MQ Dashboard';
    this.init();
  }

  init() {
    // Dashboard routes
    this.router.get('/admin/jobs', this.redirectToDefaultQueue());
    this.router.get('/admin/jobs/:queue', this.redirectToDefaultTab());
    this.router.get('/admin/jobs/:queue/:tab', this.getHTML());
    this.router.get('/admin/jobs/:queue/:tab/:id', this.redirectToDefaultSubtab());
    this.router.get('/admin/jobs/:queue/:tab/:id/:subtab', this.getHTML());
    
    // API endpoints for client
    this.router.get('/admin/api/jobs', async (c) => c.json(await this.jobQueueManager.getJobsForUI()));
    // API endpoints RAW
    this.router.get('/admin/api/jobs/all', async (c) => c.json(await this.jobQueueManager.getJobs()));
    this.router.get('/admin/api/jobs/:id', async (c) => c.json(await this.jobQueueManager.getJobById(c.req.param('id'))));
    this.router.delete('/admin/api/jobs/:id', async (c) => c.json(await this.jobQueueManager.deleteJobById(c.req.param('id'))));
    this.router.delete('/admin/api/jobs/all/:queue-status', async (c) => c.json(await this.jobQueueManager.deleteAllJobs(c.req.param('queue-status'))));
    this.router.post('/admin/api/queue/:name/pause', this.pauseQueueController());
    this.router.post('/admin/api/queue/:name/resume', this.resumeQueueController());
  }

  initRouter() {
    return this.router;
  }

  private redirectToDefaultQueue() {
    return async (c: Context) => {
      const queues = await this.jobQueueManager.getJobsForUI();
      const defaultQueue = queues[0]?.name;
      if (!defaultQueue) {
        return c.text('No queues available', 404);
      }
      return c.redirect(`/admin/jobs/${defaultQueue}`);
    };
  }

  private redirectToDefaultTab() {
    return (c: Context) => {
      const { queue } = c.req.param();
      return c.redirect(`/admin/jobs/${queue}/latest`);
    };
  }

  private redirectToDefaultSubtab() {
    return (c: Context) => {
      const { queue, tab, id } = c.req.param();
      return c.redirect(`/admin/jobs/${queue}/${tab}/${id}/information`);
    };
  }

  getHTML() {
    return (c: Context) => {
      const { queue, tab = 'latest', id, subtab = 'information' } = c.req.param();
      const fileHtml = Deno.readTextFileSync('./src/client/index.html');
      const html = fileHtml
        .replace('{{title}}', this.title)
        .replace('{{selectedQueue}}', queue)
        .replace('{{selectedTab}}', tab)
        .replace('{{selectedJobId}}', id || '')
        .replace('{{selectedSubtab}}', subtab);
      return c.html(html);
    };
  }

  pauseQueueController() {
    return (c: Context) => {
      const { name } = c.req.param();
      this.jobQueueManager.pauseQueue(name);
      return c.json({ success: true });
    };
  }

  resumeQueueController() {
    return (c: Context) => {
      const { name } = c.req.param();
      this.jobQueueManager.resumeQueue(name);
      return c.json({ success: true });
    };
  }
}