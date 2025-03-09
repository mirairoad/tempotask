import crypto from 'node:crypto';

/**
 * Generates a unique job ID based on the name and data
 * @param name - The name of the job
 * @param data - The data associated with the job
 * @returns A unique job ID
 */
export const genJobId = (name: string, data: unknown): string => {
  const dataString = JSON.stringify(data);
  const hash = crypto.createHash('sha256').update(dataString).digest('hex');
  return `${name}:${hash}`;
};