import { z } from 'zod';

const password = z.string().min(8).max(16).regex(/[A-Z]/, 'Password needs an uppercase letter').regex(/[^A-Za-z0-9]/, 'Password needs a special character');
export const userInput = z.object({
  name: z.string().trim().min(20).max(60), email: z.string().trim().email().max(254),
  address: z.string().trim().min(1).max(400), password
});
export const adminUserInput = userInput.extend({ role: z.enum(['admin', 'user', 'owner']) });
export const storeInput = z.object({
  name: z.string().trim().min(2).max(120), email: z.string().trim().email().max(254),
  address: z.string().trim().min(1).max(400), ownerUserId: z.string().uuid().nullable().optional()
});
export const messageFrom = (error) => error?.issues?.[0]?.message || 'Invalid input';
