import { PostScope, PostSection } from '@prisma/client';
import { z } from 'zod';

const id = z.string().uuid().or(z.literal('')).nullish().transform((v) => v || undefined);

export const createCommunityPostSchema = z.object({
  body: z.object({
    scope: z.nativeEnum(PostScope).optional(),
    departmentId: id,
    academicYearId: id,
    sectionId: id,
    section: z.nativeEnum(PostSection).optional(),
    title: z.string().trim().max(160).nullish().transform((v) => v || undefined),
    content: z.string().trim().min(1, 'Post content is required').max(10000),
    images: z.array(z.string().url()).max(10).nullish().transform((v) => v || undefined),
    documents: z
      .array(
        z.object({
          name: z.string().trim().min(1).max(160),
          url: z.string().url(),
          size: z.number().nonnegative().optional(),
        })
      )
      .max(10)
      .nullish()
      .transform((v) => v || undefined),
    links: z.array(z.string().url()).max(20).nullish().transform((v) => v || undefined),
    hashtags: z.array(z.string().trim().min(1).max(60)).max(20).nullish().transform((v) => v || undefined),
    mentions: z.array(z.string().uuid()).max(50).nullish().transform((v) => v || undefined),
    isVerifiedAnnouncement: z.boolean().optional(),
    isPinned: z.boolean().optional(),
    poll: z
      .object({
        question: z.string().trim().min(1, 'Poll question is required').max(300),
        options: z.array(z.string().trim().min(1).max(200)).min(2).max(6),
        expiresAt: z.preprocess(
          (val) => (val === '' || val === null || val === undefined ? undefined : val),
          z.coerce.date().optional()
        ),
      })
      .nullish()
      .transform((v) => v || undefined),
  }),
});
