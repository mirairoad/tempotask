export const getBuildStage = (env: string) => {
  return process.env[''] || Deno.env.get(env);
};
