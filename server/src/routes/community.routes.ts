import { Router } from 'express';
import { CommunityController } from '../controllers/community.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { scopeTenant } from '../middleware/scopeTenant.js';
import { authorize } from '../middleware/authorize.js';
import { RoleType } from '@prisma/client';
import { validateRequest } from '../middleware/validate.js';
import { createCommunityPostSchema } from '../utils/community.validators.js';
import { requireCommunityConsent } from '../middleware/communityConsent.js';
import { uploadLimiter } from '../middleware/rateLimit.js';
import { uploadMany } from '../middleware/upload.js';
import type { RequestHandler } from 'express';

const router = Router();
const parseMultipartPost: RequestHandler = (req, res, next) => {
  if (!req.is('multipart/form-data')) return next();
  try {
    if (typeof req.body.postData !== 'string') return res.status(400).json({ message: 'Post data is required.' });
    req.body = JSON.parse(req.body.postData);
    return next();
  } catch {
    return res.status(400).json({ message: 'Post data must be valid JSON.' });
  }
};

// Protect all routes with authentication & tenant scoping (Rule 1 & Rule 2)
router.use(authenticate, scopeTenant, requireCommunityConsent);

// ================= Community Feed =================
router.get('/feed', CommunityController.getFeed);
router.get('/announcement-targets', CommunityController.getAnnouncementTargets);
router.post('/posts', uploadLimiter, uploadMany('community', 20 * 1024 * 1024, 8), parseMultipartPost, validateRequest(createCommunityPostSchema), CommunityController.createPost);
router.get('/posts/:postId/attachments/:index', CommunityController.streamAttachment);
router.post('/posts/:id/like', CommunityController.toggleLike);
router.get('/posts/:id/comments', CommunityController.getComments);
router.post('/posts/:id/comments', CommunityController.addComment);
router.delete('/comments/:commentId', CommunityController.deleteComment);
router.post('/polls/:pollId/vote', CommunityController.votePoll);

// ================= Content Moderation =================
router.post('/reports', CommunityController.reportContent);
router.get(
  '/moderation/queue',
  authorize(RoleType.ADMIN, RoleType.SUPER_ADMIN),
  CommunityController.getModerationQueue
);
router.patch(
  '/moderation/reports/:reportId',
  authorize(RoleType.ADMIN, RoleType.SUPER_ADMIN),
  CommunityController.resolveReport
);

// ================= Doubts Portal =================
router.get('/doubts', CommunityController.getDoubts);
router.get('/doubts/:id', CommunityController.getDoubtById);
router.post('/doubts', authorize(RoleType.STUDENT), CommunityController.createDoubt);
router.post('/doubts/:id/replies', authorize(RoleType.FACULTY, RoleType.HOD, RoleType.CLASS_INCHARGE, RoleType.ADMIN, RoleType.SUPER_ADMIN), CommunityController.replyDoubt);
router.post('/doubts/:id/vote', CommunityController.toggleDoubtVote);
router.post('/replies/:replyId/vote', CommunityController.toggleReplyVote);
router.patch('/doubts/:id/replies/:replyId/accept', CommunityController.acceptReply);
router.patch(
  '/doubts/:id/replies/:replyId/verify',
  authorize(RoleType.FACULTY, RoleType.HOD, RoleType.CLASS_INCHARGE, RoleType.ADMIN, RoleType.SUPER_ADMIN),
  CommunityController.verifyReply
);
router.patch(
  '/doubts/:id/pin',
  authorize(RoleType.FACULTY, RoleType.HOD, RoleType.CLASS_INCHARGE, RoleType.ADMIN, RoleType.SUPER_ADMIN),
  CommunityController.togglePin
);

// Anonymous Author Reveal (Audit Logged - ADMIN & SUPER_ADMIN only)
router.get(
  '/doubts/:id/reveal-author',
  authorize(RoleType.ADMIN, RoleType.SUPER_ADMIN),
  CommunityController.revealAnonymousAuthor
);

export default router;
