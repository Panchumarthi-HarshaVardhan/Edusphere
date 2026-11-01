import { PostScope, PostSection } from '@prisma/client';
import { z } from 'zod';

const id = z.string().uuid();
export const createCommunityPostSchema = z.object({ body: z.object({
  scope: z.nativeEnum(PostScope).optional(),
  departmentId: id.optional(), academicYearId: id.optional(), sectionId: id.optional(),
  section: z.nativeEnum(PostSection).optional(),
  title: z.string().trim().max(160).optional(), content: z.string().trim().min(1).max(10000),
  images: z.array(z.string().url()).max(10).optional(),
  documents: z.array(z.object({ name: z.string().trim().min(1).max(160), url: z.string().url(), size: z.number().nonnegative().optional() })).max(10).optional(),
  links: z.array(z.string().url()).max(20).optional(),
  hashtags: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  mentions: z.array(z.string().uuid()).max(50).optional(),
  isVerifiedAnnouncement: z.boolean().optional(),
  isPinned: z.boolean().optional(),
  poll: z.object({ question: z.string().trim().min(1).max(300), options: z.array(z.string().trim().min(1).max(200)).min(2).max(6), expiresAt: z.coerce.date().optional() }).optional(),
}) });
