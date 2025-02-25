import { Hono, Context } from 'jsr:@hono/hono';
// import { serveStatic } from 'jsr:@hono/hono/serve-static';
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
    // API endpoints
    this.router.get('/admin/jobs', this.getHTML());
    this.router.get('/admin/api/jobs', async (c) => c.json(await this.jobQueueManager.getJobsForUI()));
    this.router.post('/admin/api/queue/:name/pause', this.pauseQueueController());
    this.router.post('/admin/api/queue/:name/resume', this.resumeQueueController());
  }

  initRouter() {
    return this.router;
  }

  getHTML() {
    return (c: Context) => {
      const fileHtml = Deno.readTextFileSync('./src/client/index.html');
      const html = fileHtml.replace('{{title}}', this.title);
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