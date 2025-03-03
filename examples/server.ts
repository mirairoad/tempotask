import { tempotask } from './index.ts';
import { Hono } from 'hono';
import { HonoAdaptor } from "@core/adaptors/hono.adaptor.ts";

const server = new Hono();
const dashboard = new HonoAdaptor(tempotask);
server.route('/', dashboard.initRouter());

Deno.serve({ port: 8000 }, server.fetch);
