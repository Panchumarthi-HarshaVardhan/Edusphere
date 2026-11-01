import { Request, Response } from 'express';
import { CommunityService } from '../services/community.service.js';
import { StorageService } from '../services/storage.service.js';

export class CommunityController {
  static async getAnnouncementTargets(req: Request, res: Response) {
    try {
      const result = await CommunityService.getAnnouncementTargets(req.institutionId!);
      return res.status(200).json(result);
    } catch (err: any) { return res.status(400).json({ message: err.message || 'Could not load announcement targets' }); }
  }
  // ================= FEED POSTS =================

  static async getFeed(req: Request, res: Response) {
    try {
      const institutionId = req.institutionId!;
      const userId = req.user!.userId;
      const { section, scope, search, hashtag, isVerifiedAnnouncement } = req.query;

      const posts = await CommunityService.getFeedPosts(institutionId, userId, {
        section: section as any,
        scope: scope as any,
        search: search ? String(search) : undefined,
        hashtag: hashtag ? String(hashtag) : undefined,
        isVerifiedAnnouncement:
          isVerifiedAnnouncement === 'true'
            ? true
            : isVerifiedAnnouncement === 'false'
            ? false
            : undefined,
      });

      return res.status(200).json(posts);
    } catch (err: any) {
      return res.status(400).json({ message: err.message || 'Failed to fetch community feed' });
    }
  }

  static async createPost(req: Request, res: Response) {
    const institutionId = req.institutionId!;
    const files = (req.files as Express.Multer.File[] | undefined) || [];
    const storedFiles: Array<{ name: string; size: number; mimeType: string; storageKey: string; kind: 'image' | 'file' }> = [];
    try {
      const authorId = req.user!.userId;
      for (const file of files) {
        const stored = await StorageService.uploadFile(institutionId, 'community', file.originalname, file.buffer, file.mimetype);
        const isImage = file.mimetype.startsWith('image/');
        storedFiles.push({
          name: file.originalname,
          size: stored.fileSizeBytes,
          mimeType: stored.mimeType,
          storageKey: stored.s3Key,
          kind: isImage ? 'image' as const : 'file' as const,
        });
      }
      const post = await CommunityService.createPost(institutionId, authorId, req.body);
      const uploaded = storedFiles.map((file, index) => ({
        ...file,
        url: `${req.protocol}://${req.get('host')}/api/community/posts/${post.id}/attachments/${index}`,
      }));
      if (uploaded.length) await CommunityService.setPostAttachments(institutionId, post.id, uploaded);
      const attachments = uploaded.map(({ name, url, size, kind }) => ({ name, url, size, kind }));
      return res.status(201).json({ message: 'Post created successfully', post: {
        ...post,
        images: uploaded.filter((file) => file.kind === 'image').map((file) => file.url),
        documents: attachments,
      } });
    } catch (err: any) {
      await Promise.allSettled(storedFiles.map((file) => StorageService.deleteFile(file.storageKey)));
      return res.status(err.status || 400).json({ message: err.message || 'Failed to create post' });
    }
  }

  static async streamAttachment(req: Request, res: Response) {
    try {
      const attachment = await CommunityService.getVisibleAttachment(
        req.institutionId!, req.user!.userId, req.params.postId, Number(req.params.index)
      );
      if (!attachment) return res.status(404).json({ message: 'Attachment not found' });
      let buffer: Buffer;
      try { buffer = await StorageService.getFileBuffer(attachment.storageKey); }
      catch { return res.status(404).json({ message: 'Attachment not found' }); }
      const disposition = attachment.kind === 'image' ? 'inline' : 'attachment';
      res.setHeader('Cache-Control', 'private, no-store');
      res.setHeader('Content-Type', attachment.mimeType);
      res.setHeader('Content-Length', buffer.length);
      res.setHeader('Content-Disposition', `${disposition}; filename*=UTF-8''${encodeURIComponent(attachment.name)}`);
      return res.status(200).send(buffer);
    } catch (err: any) {
      return res.status(404).json({ message: 'Attachment not found' });
    }
  }

  static async toggleLike(req: Request, res: Response) {
    try {
      const institutionId = req.institutionId!;
      const userId = req.user!.userId;
      const { id } = req.params;

      const result = await CommunityService.togglePostLike(institutionId, userId, id);
      return res.status(200).json(result);
    } catch (err: any) {
      return res.status(400).json({ message: err.message || 'Failed to toggle like' });
    }
  }

  // ================= COMMENTS =================

  static async getComments(req: Request, res: Response) {
    try {
      const institutionId = req.institutionId!;
      const { id } = req.params;

      const comments = await CommunityService.getPostComments(institutionId, id);
      return res.status(200).json(comments);
    } catch (err: any) {
      return res.status(400).json({ message: err.message || 'Failed to fetch comments' });
    }
  }

  static async addComment(req: Request, res: Response) {
    try {
      const institutionId = req.institutionId!;
      const authorId = req.user!.userId;
      const { id } = req.params;
      const { content } = req.body;

      if (!content || !content.trim()) {
        return res.status(400).json({ message: 'Comment content cannot be empty' });
      }

      const comment = await CommunityService.addPostComment(institutionId, authorId, id, content);
      return res.status(201).json({ message: 'Comment posted', comment });
    } catch (err: any) {
      return res.status(400).json({ message: err.message || 'Failed to post comment' });
    }
  }

  static async deleteComment(req: Request, res: Response) {
    try {
      const institutionId = req.institutionId!;
      const userId = req.user!.userId;
      const { commentId } = req.params;

      const result = await CommunityService.deletePostComment(institutionId, userId, commentId);
      return res.status(200).json(result);
    } catch (err: any) {
      return res.status(400).json({ message: err.message || 'Failed to delete comment' });
    }
  }

  // ================= POLLS =================

  static async votePoll(req: Request, res: Response) {
    try {
      const institutionId = req.institutionId!;
      const userId = req.user!.userId;
      const { pollId } = req.params;
      const { optionIndex } = req.body;

      if (optionIndex === undefined || optionIndex === null) {
        return res.status(400).json({ message: 'optionIndex is required' });
      }

      const result = await CommunityService.votePoll(
        institutionId,
        userId,
        pollId,
        Number(optionIndex)
      );
      return res.status(200).json(result);
    } catch (err: any) {
      return res.status(400).json({ message: err.message || 'Failed to vote in poll' });
    }
  }

  // ================= MODERATION & REPORTS =================

  static async reportContent(req: Request, res: Response) {
    try {
      const institutionId = req.institutionId!;
      const reporterId = req.user!.userId;
      const { targetType, targetId, postId, reason, details } = req.body;

      if (!targetType || !targetId || !reason) {
        return res.status(400).json({ message: 'targetType, targetId, and reason are required' });
      }

      const report = await CommunityService.reportContent(institutionId, reporterId, {
        targetType,
        targetId,
        postId,
        reason,
        details,
      });

      return res.status(201).json({ message: 'Content reported to administrators for review', report });
    } catch (err: any) {
      return res.status(400).json({ message: err.message || 'Failed to report content' });
    }
  }

  static async getModerationQueue(req: Request, res: Response) {
    try {
      const institutionId = req.institutionId!;
      const { status } = req.query;

      const reports = await CommunityService.getModerationQueue(institutionId, status as any);
      return res.status(200).json(reports);
    } catch (err: any) {
      return res.status(400).json({ message: err.message || 'Failed to fetch moderation queue' });
    }
  }

  static async resolveReport(req: Request, res: Response) {
    try {
      const institutionId = req.institutionId!;
      const adminId = req.user!.userId;
      const { reportId } = req.params;
      const { status, actionNotes, removeContent } = req.body;

      if (!status) {
        return res.status(400).json({ message: 'status is required (DISMISSED, ACTION_TAKEN, REVIEWED)' });
      }

      const report = await CommunityService.resolveModerationReport(
        institutionId,
        adminId,
        reportId,
        { status, actionNotes, removeContent: Boolean(removeContent) },
        req
      );

      return res.status(200).json({ message: 'Report resolved', report });
    } catch (err: any) {
      return res.status(400).json({ message: err.message || 'Failed to resolve report' });
    }
  }

  // ================= DOUBTS PORTAL =================

  static async getDoubts(req: Request, res: Response) {
    try {
      const institutionId = req.institutionId!;
      const userId = req.user!.userId;
      const { subjectId, search, status, tag } = req.query;

      const doubts = await CommunityService.getDoubts(institutionId, userId, {
        subjectId: subjectId ? String(subjectId) : undefined,
        search: search ? String(search) : undefined,
        status: status as any,
        tag: tag ? String(tag) : undefined,
      });

      return res.status(200).json(doubts);
    } catch (err: any) {
      return res.status(400).json({ message: err.message || 'Failed to fetch doubts' });
    }
  }

  static async getDoubtById(req: Request, res: Response) {
    try {
      const institutionId = req.institutionId!;
      const userId = req.user!.userId;
      const { id } = req.params;

      const doubt = await CommunityService.getDoubtById(institutionId, userId, id);
      return res.status(200).json(doubt);
    } catch (err: any) {
      return res.status(404).json({ message: err.message || 'Doubt not found' });
    }
  }

  static async createDoubt(req: Request, res: Response) {
    try {
      const institutionId = req.institutionId!;
      const studentId = req.user!.userId;

      const { subjectId, title, content, codeSnippet, codeLanguage, attachments, tags, isAnonymous } =
        req.body;

      if (!subjectId || !title || !content) {
        return res.status(400).json({ message: 'subjectId, title, and content are required' });
      }

      const doubt = await CommunityService.createDoubt(institutionId, studentId, {
        subjectId,
        title,
        content,
        codeSnippet,
        codeLanguage,
        attachments,
        tags,
        isAnonymous: Boolean(isAnonymous),
      });

      return res.status(201).json({ message: 'Doubt question submitted', doubt });
    } catch (err: any) {
      return res.status(400).json({ message: err.message || 'Failed to submit doubt' });
    }
  }

  static async replyDoubt(req: Request, res: Response) {
    try {
      const institutionId = req.institutionId!;
      const authorId = req.user!.userId;
      const { id } = req.params;
      const { content, codeSnippet, codeLanguage } = req.body;

      if (!content || !content.trim()) {
        return res.status(400).json({ message: 'Reply content cannot be empty' });
      }

      const reply = await CommunityService.replyDoubt(institutionId, authorId, id, {
        content,
        codeSnippet,
        codeLanguage,
      });

      return res.status(201).json({ message: 'Reply posted', reply });
    } catch (err: any) {
      return res.status(400).json({ message: err.message || 'Failed to post reply' });
    }
  }

  static async toggleDoubtVote(req: Request, res: Response) {
    try {
      const institutionId = req.institutionId!;
      const userId = req.user!.userId;
      const { id } = req.params;

      const result = await CommunityService.toggleDoubtVote(institutionId, userId, id);
      return res.status(200).json(result);
    } catch (err: any) {
      return res.status(400).json({ message: err.message || 'Failed to vote' });
    }
  }

  static async toggleReplyVote(req: Request, res: Response) {
    try {
      const institutionId = req.institutionId!;
      const userId = req.user!.userId;
      const { replyId } = req.params;

      const result = await CommunityService.toggleReplyVote(institutionId, userId, replyId);
      return res.status(200).json(result);
    } catch (err: any) {
      return res.status(400).json({ message: err.message || 'Failed to vote' });
    }
  }

  static async acceptReply(req: Request, res: Response) {
    try {
      const institutionId = req.institutionId!;
      const userId = req.user!.userId;
      const { id, replyId } = req.params;

      const result = await CommunityService.acceptReply(institutionId, userId, id, replyId);
      return res.status(200).json({ message: 'Solution accepted', result });
    } catch (err: any) {
      return res.status(400).json({ message: err.message || 'Failed to accept solution' });
    }
  }

  static async verifyReply(req: Request, res: Response) {
    try {
      const institutionId = req.institutionId!;
      const facultyId = req.user!.userId;
      const { id, replyId } = req.params;

      const result = await CommunityService.verifyReply(institutionId, facultyId, id, replyId);
      return res.status(200).json({ message: 'Reply faculty verification updated', result });
    } catch (err: any) {
      return res.status(400).json({ message: err.message || 'Failed to verify reply' });
    }
  }

  static async togglePin(req: Request, res: Response) {
    try {
      const institutionId = req.institutionId!;
      const userId = req.user!.userId;
      const { id } = req.params;

      const result = await CommunityService.togglePinDoubt(institutionId, userId, id);
      return res.status(200).json({ message: 'Pin toggled', doubt: result });
    } catch (err: any) {
      return res.status(400).json({ message: err.message || 'Failed to pin/unpin question' });
    }
  }

  static async revealAnonymousAuthor(req: Request, res: Response) {
    try {
      const institutionId = req.institutionId!;
      const adminId = req.user!.userId;
      const { id } = req.params;

      const author = await CommunityService.revealAnonymousAuthor(institutionId, adminId, id, req);
      return res.status(200).json({ message: 'Author identity revealed for moderation', author });
    } catch (err: any) {
      return res.status(403).json({ message: err.message || 'Permission denied' });
    }
  }
}
