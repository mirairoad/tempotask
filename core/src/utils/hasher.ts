import crypto from 'node:crypto';

export const genJobId = (name: string, data: unknown): string => {
  const dataString = JSON.stringify(data);
  const hash = crypto.createHash('sha256').update(dataString).digest('hex');
  return `${name}:${hash}`;
};