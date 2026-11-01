import { z } from 'zod';

export const demoRequestSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(120),
    institution: z.string().trim().min(2).max(160),
    role: z.enum(['School leader', 'Administrator', 'Faculty', 'IT / technology', 'Other']),
    email: z.string().trim().email().max(254),
    message: z.string().trim().min(10).max(3000),
    website: z.string().max(500).optional().default(''),
  }).strict(),
});

export type DemoRequestInput = z.infer<typeof demoRequestSchema>['body'];
