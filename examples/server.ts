import { tempotask } from './index.ts';
import { Hono } from 'hono';
import { HonoAdaptor } from "@core/adaptors/hono.adaptor.ts";

const server = new Hono();
const dashboard = new HonoAdaptor(tempotask);
server.route('/', dashboard.initRouter());

Deno.serve({ port: 8000 }, server.fetch);

// IF THE SIMPLE DASHBOARD IS NOT SUFFICIENT FOR YOUR NEEDS YOU CAN USE WRITE YOUR OWN AND USE THIS EXAMPLE BELOW
// API endpoints for client
// router.get('/admin/api/jobs', async (c) => c.json(await this.jobQueueManager.getSortedJobs()));
// router.get('/admin/api/jobs/all', async (c) => c.json(await this.jobQueueManager.getJobs()));
// router.get('/admin/api/jobs/:id', async (c) => c.json(await this.jobQueueManager.getJobById(c.req.param('id'))));
// router.delete('/admin/api/jobs/:id', async (c) => c.json(await this.jobQueueManager.deleteJobById(c.req.param('id'))));
// router.delete('/admin/api/jobs/all/:queue-status', async (c) => c.json(await this.jobQueueManager.deleteAllJobs(c.req.param('queue-status'))));
// router.post('/admin/api/jobs/:id/pause', async (c) => c.json(await this.jobQueueManager.togglePauseJobById(c.req.param('id'))));
// router.post('/admin/api/queue/:name/pause', this.pauseQueueController());
// router.post('/admin/api/queue/:name/resume', this.resumeQueueController());