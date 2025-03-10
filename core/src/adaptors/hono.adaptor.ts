import { Hono, type Context } from 'hono';
import type { QueueManager } from '../libs/queue-manager.ts';

/**
 * A closure function that returns a Promise<Response> or a Response.
 * @param c - The context object.
 * @returns A Promise<Response> or a Response.
 */
type HonoClosure = (c: Context) => Promise<Response> | Response;

/**
 * HonoAdaptor is a class that adapts the QueueManager to the Hono framework.
 * It provides a router for the dashboard and the API endpoints.
 * 
 * @param jobQueueManager - The QueueManager instance to adapt.
 * @returns A Hono router with the dashboard and API endpoints.
 */
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

  /**
   * Initializes the router with the dashboard and API endpoints.
   */
  init() {
    // Dashboard routes
    this.router.get('/admin/jobs', this.redirectToDefaultQueue());
    this.router.get('/admin/jobs/:queue', this.redirectToDefaultTab());
    this.router.get('/admin/jobs/:queue/:tab', this.getHTML());
    this.router.get('/admin/jobs/:queue/:tab/:id', this.redirectToDefaultSubtab());
    this.router.get('/admin/jobs/:queue/:tab/:id/:subtab', this.getHTML());
    
    // API endpoints for client
    this.router.get('/admin/api/client-sync', async (c) => c.json(await this.jobQueueManager.getSortedJobs()));

    this.router.get('/admin/api/queues', async (c) => c.json(await this.jobQueueManager.getSortedJobs()));
    // API endpoints RAW
    this.router.get('/admin/api/queues/all', async (c) => c.json(await this.jobQueueManager.getJobs()));
    this.router.get('/admin/api/queues/:id', async (c) => c.json(await this.jobQueueManager.getJobById(c.req.param('id'))));
    this.router.delete('/admin/api/queues/:id', async (c) => c.json(await this.jobQueueManager.deleteJobById(c.req.param('id'))));
    this.router.delete('/admin/api/queues/all/:queue-status', async (c) => c.json(await this.jobQueueManager.deleteAllJobs(c.req.param('queue-status'))));
    this.router.post('/admin/api/queues/:id/pause', async (c) => c.json(await this.jobQueueManager.togglePauseJobById(c.req.param('id'))));
    this.router.post('/admin/api/queue/:name/pause', this.pauseQueueController());
    this.router.post('/admin/api/queue/:name/resume', this.resumeQueueController());
  }

  /**
   * Returns the router with the dashboard and API endpoints.
   * @returns The router with the dashboard and API endpoints.
   */
  initRouter(): Hono {
    return this.router;
  }

  /**
   * Redirects to the default queue.
   * @returns A Promise<Response> or a Response.
   */
  private redirectToDefaultQueue() {
    return async (c: Context) => {
      const queues = await this.jobQueueManager.getSortedJobs();
      const defaultQueue = queues[0]?.name;
      if (!defaultQueue) {
        return c.text('No queues available', 404);
      }
      return c.redirect(`/admin/jobs/${defaultQueue}`);
    };
  }

  /**
   * Redirects to the default tab.
   * @returns A Promise<Response> or a Response.
   */
  private redirectToDefaultTab() {
    return (c: Context) => {
      const { queue } = c.req.param();
      return c.redirect(`/admin/jobs/${queue}/latest`);
    };
  }

  /**
   * Redirects to the default subtab.
   * @returns A Promise<Response> or a Response.
   */
  private redirectToDefaultSubtab() {
    return (c: Context) => {
      const { queue, tab, id } = c.req.param();
      return c.redirect(`/admin/jobs/${queue}/${tab}/${id}/information`);
    };
  }

  /**
   * Returns the HTML for the dashboard.
   * @returns A Promise<Response> or a Response.
   */
  getHTML(): HonoClosure {
    return async (c: Context) => {
      const { queue, tab = 'latest', id, subtab = 'information' } = c.req.param();
      
      // Fix path resolution with URL-based approach
      const clientDir = new URL('../client/', import.meta.url);
      const htmlPath = new URL('index.html', clientDir);
      
      // Read file with proper path
      const fileHtml = Deno.readTextFileSync(htmlPath);
      
      const html = fileHtml
        .replace('{{title}}', this.title)
        .replace('{{selectedQueue}}', queue)
        .replace('{{selectedTab}}', tab)
        .replace('{{selectedJobId}}', id || '')
        .replace('{{selectedSubtab}}', subtab);
      return c.html(html);
    };
  }

  /**
   * Pauses a queue.
   * @returns A Promise<Response> or a Response.
   */
  pauseQueueController(): HonoClosure {
    return (c: Context) => {
      const { name } = c.req.param();
      this.jobQueueManager.pauseQueue(name);
      return c.json({ success: true });
    };
  }

  /**
   * Resumes a queue.
   * @returns A Promise<Response> or a Response.
   */
  resumeQueueController(): HonoClosure {
    return async (c: Context) => {
      const { name } = c.req.param();
      this.jobQueueManager.resumeQueue(name);
      return c.json({ success: true });
    };
  }
}