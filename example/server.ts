import { jqm } from './index.ts';
import { Hono } from 'jsr:@hono/hono';
import { HonoAdaptor } from '../src/adaptors/hono.adaptor.ts';

const server = new Hono();
const dashboard = new HonoAdaptor(jqm);
server.route('/', dashboard.initRouter());

Deno.serve({ port: 8000 }, server.fetch);
