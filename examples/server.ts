import { tempotask } from './index.ts';
import { Hono } from 'hono';
import { HonoAdaptor } from "@core/adaptors/hono.adaptor.ts";
import { cors } from 'hono/cors';

const server = new Hono();
const dashboard = new HonoAdaptor(tempotask);

// Configure CORS to allow requests from the dashboard
server.use(cors({
  origin: [
    'http://localhost:3001',
    'http://127.0.0.1:3001',
    'http://0.0.0.0:3001'
  ],
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length', 'X-Request-Id'],
  maxAge: 600,
}));

server.route('/', dashboard.initRouter());

Deno.serve({ port: 8000 }, server.fetch);

// IF THE SIMPLE DASHBOARD IS NOT SUFFICIENT FOR YOUR NEEDS YOU CAN USE WRITE YOUR OWN AND USE THIS EXAMPLE BELOW
// API endpoints for client
// router.get('/admin/api/queues', async (c) => c.json(await this.jobQueueManager.getSortedJobs()));
// router.get('/admin/api/queues/all', async (c) => c.json(await this.jobQueueManager.getJobs()));
// router.get('/admin/api/queues/:id', async (c) => c.json(await this.jobQueueManager.getJobById(c.req.param('id'))));
// router.delete('/admin/api/queues/:id', async (c) => c.json(await this.jobQueueManager.deleteJobById(c.req.param('id'))));
// router.delete('/admin/api/queues/all/:queue-status', async (c) => c.json(await this.jobQueueManager.deleteAllJobs(c.req.param('queue-status'))));
// router.post('/admin/api/queues/:id/pause', async (c) => c.json(await this.jobQueueManager.togglePauseJobById(c.req.param('id'))));
// router.post('/admin/api/queue/:name/pause', this.pauseQueueController());
// router.post('/admin/api/queue/:name/resume', this.resumeQueueController());