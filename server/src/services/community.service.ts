import { PostScope, PostSection, ContentReportStatus, ContentReportTarget, RoleType, NotificationCategory } from '@prisma/client';
import { Request } from 'express';
import { NotificationService } from './notification.service.js';
import { createAuditLog } from './audit.service.js';
import { prisma } from '../utils/prisma.js';
import { PrivacyService } from './privacy.service.js';

export interface CreatePostInput {
  scope?: PostScope;
  departmentId?: string;
  academicYearId?: string;
  sectionId?: string;
  section?: PostSection;
  title?: string;
  content: string;
  images?: string[];
  documents?: { name: string; url: string; size?: number }[];
  links?: string[];
  hashtags?: string[];
  mentions?: string[];
  isVerifiedAnnouncement?: boolean;
  isPinned?: boolean;
  poll?: {
    question: string;
    options: string[];
    expiresAt?: Date | string;
  };
}

export interface CreateDoubtInput {
  subjectId: string;
  title: string;
  content: string;
  codeSnippet?: string;
  codeLanguage?: string;
  attachments?: { name: string; url: string; size?: number }[];
  tags?: string[];
  isAnonymous?: boolean;
}

export class CommunityService {
  // ================= FEED POSTS =================

  static async getAnnouncementTargets(institutionId: string) {
    const [departments, academicYears, sections] = await Promise.all([
      prisma.department.findMany({ where: { institutionId }, select: { id: true, name: true, code: true }, orderBy: { name: 'asc' } }),
      prisma.academicYear.findMany({ where: { institutionId }, select: { id: true, name: true }, orderBy: { startDate: 'desc' } }),
      prisma.section.findMany({ where: { institutionId }, select: { id: true, name: true, semester: { select: { academicYear: { select: { name: true } }, program: { select: { name: true, department: { select: { name: true } } } } } } }, orderBy: { name: 'asc' } }),
    ]);
    return { departments, academicYears, sections };
  }

  static async getFeedPosts(
    institutionId: string,
    userId: string,
    filters?: {
      section?: PostSection;
      scope?: PostScope;
      search?: string;
      hashtag?: string;
      isVerifiedAnnouncement?: boolean;
      postId?: string;
    }
  ) {
    // 1. Fetch requesting user's academic and departmental context
    const user = await prisma.user.findFirst({
      where: { id: userId, institutionId, isActive: true },
      include: {
        enrollments: {
          where: { institutionId, status: 'ACTIVE' },
          include: {
            section: {
              include: {
                semester: {
                  include: { program: true, academicYear: true },
                },
              },
            },
          },
        },
        facultyAssignments: {
          where: { institutionId },
          select: { sectionId: true, section: { select: { semester: { select: { academicYearId: true, program: { select: { departmentId: true } } } } } } },
        },
      },
    });

    if (!user) throw new Error('User not found');

    const isAdmin = user.role === RoleType.ADMIN || user.role === RoleType.SUPER_ADMIN;

    // Determine relevant scope identifiers for user
    const userDeptIds = new Set<string>([
      ...(user.departmentId ? [user.departmentId] : []),
      ...(user.enrollments || []).map((e) => e.section.semester.program.departmentId),
      ...(user.facultyAssignments || []).map((a) => a.section.semester.program.departmentId),
    ]);
    const userYearIds = new Set<string>([
      ...(user.enrollments || []).map((e) => e.section.semester.academicYearId),
      ...(user.facultyAssignments || []).map((a) => a.section.semester.academicYearId),
    ]);
    const userSectionIds = [
      ...(user.enrollments || []).map((enrollment) => enrollment.sectionId),
      ...(user.facultyAssignments?.map((fa) => fa.sectionId) || []),
    ];

    // Construct server-side visibility query
    let scopeCondition: any = {};
    if (!isAdmin) {
      const orClauses: any[] = [
        { scope: PostScope.INSTITUTION },
        { authorId: userId },
      ];

      if (userDeptIds.size) {
        orClauses.push({ scope: PostScope.DEPARTMENT, departmentId: { in: [...userDeptIds] } });
      }
      if (userYearIds.size) {
        orClauses.push({ scope: PostScope.YEAR, academicYearId: { in: [...userYearIds] } });
      }
      if (userSectionIds.length > 0) {
        orClauses.push({ scope: PostScope.SECTION, sectionId: { in: userSectionIds } });
      }

      scopeCondition = { OR: orClauses };
    }

    // Additional filters
    const whereClause: any = {
      institutionId,
      AND: [scopeCondition, ...(filters?.search ? [{ OR: [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { content: { contains: filters.search, mode: 'insensitive' } },
      ] }] : [])],
    };

    if (filters?.section) {
      whereClause.section = filters.section;
    }
    if (filters?.postId) whereClause.id = filters.postId;
    if (filters?.scope) {
      whereClause.scope = filters.scope;
    }
    if (filters?.isVerifiedAnnouncement !== undefined) {
      whereClause.isVerifiedAnnouncement = filters.isVerifiedAnnouncement;
    }
    const posts = await prisma.communityPost.findMany({
      where: whereClause,
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
        department: { select: { id: true, name: true, code: true } },
        sectionRef: { select: { id: true, name: true } },
        poll: {
          include: {
            votes: {
              where: { userId },
              select: { optionIndex: true },
            },
          },
        },
        likes: {
          where: { userId },
          select: { id: true },
        },
        _count: {
          select: {
            comments: true,
            likes: true,
          },
        },
      },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      take: 50,
    });

    return posts.map((post) => {
      const isLikedByMe = post.likes.length > 0;
      const userVote = post.poll?.votes[0]?.optionIndex ?? null;

      let pollData = null;
      if (post.poll) {
        const options = (post.poll.options as any[]) || [];
        const totalVotes = options.reduce((sum, opt) => sum + (opt.voteCount || 0), 0);
        pollData = {
          id: post.poll.id,
          question: post.poll.question,
          options,
          totalVotes,
          expiresAt: post.poll.expiresAt,
          userVotedOption: userVote,
          hasExpired: post.poll.expiresAt ? new Date(post.poll.expiresAt) < new Date() : false,
        };
      }

      return {
        id: post.id,
        scope: post.scope,
        section: post.section,
        title: post.title,
        content: post.content,
        images: (post.images as string[]) || [],
        documents: ((post.documents as any[]) || []).map(({ name, url, size, kind }) => ({ name, url, size, ...(kind ? { kind } : {}) })),
        links: (post.links as string[]) || [],
        hashtags: (post.hashtags as string[]) || [],
        mentions: (post.mentions as string[]) || [],
        isVerifiedAnnouncement: post.isVerifiedAnnouncement,
        isPinned: post.isPinned,
        likesCount: post._count.likes,
        commentsCount: post._count.comments,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        author: post.author,
        department: post.department,
        sectionRef: post.sectionRef,
        isLikedByMe,
        poll: pollData,
      };
    });
  }

  static async setPostAttachments(institutionId: string, postId: string, attachments: Array<{
    name: string; url: string; size: number; mimeType: string; storageKey: string; kind: 'image' | 'file';
  }>) {
    const images = attachments.filter((attachment) => attachment.kind === 'image').map((attachment) => attachment.url);
    const updated = await prisma.communityPost.updateMany({
      where: { id: postId, institutionId },
      data: { images, documents: attachments },
    });
    if (!updated.count) throw new Error('Post not found');
  }

  static async getVisibleAttachment(institutionId: string, userId: string, postId: string, attachmentIndex: number) {
    const visiblePosts = await this.getFeedPosts(institutionId, userId, { postId });
    if (!visiblePosts.length) return null;
    const post = await prisma.communityPost.findFirst({ where: { id: postId, institutionId }, select: { documents: true } });
    const attachments = (post?.documents as any[]) || [];
    if (!Number.isInteger(attachmentIndex) || attachmentIndex < 0 || attachmentIndex >= attachments.length) return null;
    const attachment = attachments[attachmentIndex];
    if (!attachment?.storageKey || !attachment?.name || !attachment?.mimeType) return null;
    return attachment as { name: string; mimeType: string; storageKey: string; kind: 'image' | 'file' };
  }

  static async createPost(institutionId: string, authorId: string, data: CreatePostInput) {
    const author = await prisma.user.findFirst({
      where: { id: authorId, institutionId, isActive: true },
      select: { role: true, departmentId: true },
    });

    if (!author) throw new Error('Author not found');

    // Rule: Verified announcements only by Admin and Faculty
    if (data.isVerifiedAnnouncement) {
      const canVerify =
        author.role === RoleType.ADMIN ||
        author.role === RoleType.SUPER_ADMIN ||
        author.role === RoleType.FACULTY;

      if (!canVerify) {
        throw new Error('Only faculty and administrators can post verified announcements.');
      }
    }

    const scope = data.scope || PostScope.INSTITUTION;
    if (data.isVerifiedAnnouncement && scope === PostScope.PRIVATE_GROUP) {
      throw new Error('Verified announcements must target the institution, a department, an academic year, or a section.');
    }
    if ((data.departmentId && !await prisma.department.findFirst({ where: { id: data.departmentId, institutionId }, select: { id: true } })) ||
        (data.academicYearId && !await prisma.academicYear.findFirst({ where: { id: data.academicYearId, institutionId }, select: { id: true } })) ||
        (data.sectionId && !await prisma.section.findFirst({ where: { id: data.sectionId, institutionId }, select: { id: true } }))) {
      throw new Error('Announcement targets must belong to this institution.');
    }
    if (scope === PostScope.DEPARTMENT) {
      if (!data.departmentId) {
        throw new Error('Choose a department in this institution for this announcement.');
      }
    } else if (scope === PostScope.YEAR) {
      if (!data.academicYearId) {
        throw new Error('Choose an academic year in this institution for this announcement.');
      }
    } else if (scope === PostScope.SECTION) {
      if (!data.sectionId) {
        throw new Error('Choose a section in this institution for this announcement.');
      }
    }

    const post = await prisma.communityPost.create({
      data: {
        institutionId,
        authorId,
        scope,
        departmentId: data.departmentId || null,
        academicYearId: data.academicYearId || null,
        sectionId: data.sectionId || null,
        section: data.section || PostSection.UNIVERSITY_FEED,
        title: data.title || null,
        content: data.content,
        images: data.images || [],
        documents: data.documents || [],
        links: data.links || [],
        hashtags: data.hashtags || [],
        mentions: data.mentions || [],
        isVerifiedAnnouncement: data.isVerifiedAnnouncement || false,
        isPinned: data.isPinned || false,
      },
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
      },
    });

    // Handle Poll Creation
    if (data.poll && data.poll.question && data.poll.options?.length > 1) {
      const formattedOptions = data.poll.options.map((opt, idx) => ({
        id: idx.toString(),
        text: opt,
        voteCount: 0,
      }));

      await prisma.postPoll.create({
        data: {
          institutionId,
          postId: post.id,
          question: data.poll.question,
          options: formattedOptions,
          expiresAt: data.poll.expiresAt ? new Date(data.poll.expiresAt) : null,
        },
      });
    }

    // If verified announcement, broadcast notification to target scope users
    if (post.isVerifiedAnnouncement) {
      const recipientUserIds = await resolveAnnouncementRecipients(institutionId, authorId, post.scope, {
        departmentId: post.departmentId, academicYearId: post.academicYearId, sectionId: post.sectionId,
      });

      if (recipientUserIds.length > 0) {
        await NotificationService.createNotification(
          institutionId,
          recipientUserIds,
          NotificationCategory.ANNOUNCEMENT,
          `Verified Announcement: ${post.title || 'New Announcement'}`,
          post.content.slice(0, 150),
          `/community`
        );
      }
    }

    return post;
  }

  static async togglePostLike(institutionId: string, userId: string, postId: string) {
    const post = await prisma.communityPost.findFirst({
      where: { id: postId, institutionId },
      select: { id: true },
    });
    if (!post) throw { status: 404, message: 'Post not found' };

    const existing = await prisma.postLike.findFirst({
      where: { institutionId, postId, userId },
    });

    if (existing) {
      await prisma.$transaction([
        prisma.postLike.delete({ where: { id: existing.id } }),
        prisma.communityPost.updateMany({
          where: { id: postId, institutionId },
          data: { likesCount: { decrement: 1 } },
        }),
      ]);
      return { liked: false };
    } else {
      await prisma.$transaction([
        prisma.postLike.create({
          data: { institutionId, postId, userId },
        }),
        prisma.communityPost.updateMany({
          where: { id: postId, institutionId },
          data: { likesCount: { increment: 1 } },
        }),
      ]);
      return { liked: true };
    }
  }

  // ================= COMMENTS =================

  static async getPostComments(institutionId: string, postId: string) {
    return prisma.postComment.findMany({
      where: { institutionId, postId },
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  static async addPostComment(institutionId: string, authorId: string, postId: string, content: string) {
    const post = await prisma.communityPost.findFirst({
      where: { id: postId, institutionId },
      select: { authorId: true, title: true },
    });
    if (!post) throw { status: 404, message: 'Post not found' };

    const comment = await prisma.$transaction(async (tx) => {
      const created = await tx.postComment.create({
        data: { institutionId, postId, authorId, content },
        include: {
          author: { select: { id: true, firstName: true, lastName: true, role: true } },
        },
      });
      await tx.communityPost.updateMany({
        where: { id: postId, institutionId },
        data: { commentsCount: { increment: 1 } },
      });
      return created;
    });

    // Notify post author if commenter is someone else
    if (post.authorId !== authorId) {
      await NotificationService.createNotification(
        institutionId,
        [post.authorId],
        NotificationCategory.COMMUNITY,
        'New Comment on your Post',
        `${comment.author.firstName} commented: "${content.slice(0, 100)}"`,
        `/community`
      );
    }

    return comment;
  }

  static async deletePostComment(institutionId: string, userId: string, commentId: string) {
    const comment = await prisma.postComment.findFirst({
      where: { id: commentId, institutionId },
      include: { post: true },
    });
    if (!comment) throw new Error('Comment not found');

    const user = await prisma.user.findUnique({ where: { id: userId } });
    const canDelete =
      comment.authorId === userId ||
      user?.role === RoleType.ADMIN ||
      user?.role === RoleType.SUPER_ADMIN;

    if (!canDelete) throw new Error('Not authorized to delete this comment');

    await prisma.$transaction([
      prisma.postComment.delete({ where: { id: commentId } }),
      prisma.communityPost.update({
        where: { id: comment.postId },
        data: { commentsCount: { decrement: 1 } },
      }),
    ]);

    return { success: true };
  }

  // ================= POLLS =================

  static async votePoll(institutionId: string, userId: string, pollId: string, optionIndex: number) {
    const poll = await prisma.postPoll.findFirst({
      where: { id: pollId, institutionId },
    });
    if (!poll) throw new Error('Poll not found');

    if (poll.expiresAt && new Date(poll.expiresAt) < new Date()) {
      throw new Error('This poll has expired and is no longer accepting votes.');
    }

    const existingVote = await prisma.pollVote.findUnique({
      where: { pollId_userId: { pollId, userId } },
    });

    if (existingVote) {
      throw new Error('You have already voted in this poll.');
    }

    const options = (poll.options as any[]) || [];
    if (!options[optionIndex]) {
      throw new Error('Invalid option index');
    }

    // Increment vote count on selected option
    options[optionIndex].voteCount = (options[optionIndex].voteCount || 0) + 1;

    await prisma.$transaction([
      prisma.pollVote.create({
        data: { institutionId, pollId, userId, optionIndex },
      }),
      prisma.postPoll.update({
        where: { id: pollId },
        data: { options },
      }),
    ]);

    const totalVotes = options.reduce((sum, opt) => sum + (opt.voteCount || 0), 0);

    return {
      success: true,
      options,
      totalVotes,
      userVotedOption: optionIndex,
    };
  }

  // ================= MODERATION & REPORTS =================

  static async reportContent(
    institutionId: string,
    reporterId: string,
    data: {
      targetType: ContentReportTarget;
      targetId: string;
      postId?: string;
      reason: string;
      details?: string;
    }
  ) {
    return prisma.contentReport.create({
      data: {
        institutionId,
        reporterId,
        targetType: data.targetType,
        targetId: data.targetId,
        postId: data.postId || null,
        reason: data.reason,
        details: data.details || null,
      },
    });
  }

  static async getModerationQueue(institutionId: string, status?: ContentReportStatus) {
    return prisma.contentReport.findMany({
      where: {
        institutionId,
        ...(status ? { status } : { status: ContentReportStatus.PENDING }),
      },
      include: {
        reporter: {
          select: { id: true, firstName: true, lastName: true, role: true, email: true },
        },
        reviewedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        post: {
          select: { id: true, title: true, content: true, authorId: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async resolveModerationReport(
    institutionId: string,
    adminId: string,
    reportId: string,
    data: {
      status: ContentReportStatus;
      actionNotes?: string;
      removeContent?: boolean;
    },
    req?: Request
  ) {
    const report = await prisma.contentReport.findFirst({
      where: { id: reportId, institutionId },
    });
    if (!report) throw new Error('Report not found');

    if (data.removeContent) {
      if (report.targetType === ContentReportTarget.POST) {
        await prisma.communityPost.delete({ where: { id: report.targetId } }).catch(() => {});
      } else if (report.targetType === ContentReportTarget.COMMENT) {
        await prisma.postComment.delete({ where: { id: report.targetId } }).catch(() => {});
      } else if (report.targetType === ContentReportTarget.DOUBT) {
        await prisma.doubt.delete({ where: { id: report.targetId } }).catch(() => {});
      } else if (report.targetType === ContentReportTarget.DOUBT_REPLY) {
        await prisma.doubtReply.delete({ where: { id: report.targetId } }).catch(() => {});
      }
    }

    const updated = await prisma.contentReport.update({
      where: { id: reportId },
      data: {
        status: data.status,
        reviewedById: adminId,
        reviewedAt: new Date(),
        actionNotes: data.actionNotes || null,
      },
    });

    // Write audit log
    await createAuditLog({
      institutionId,
      userId: adminId,
      action: 'RESOLVE_CONTENT_REPORT',
      resource: report.targetType.toLowerCase(),
      resourceId: report.targetId,
      details: {
        reportId,
        status: data.status,
        removeContent: !!data.removeContent,
        actionNotes: data.actionNotes,
      },
      req,
    });

    return updated;
  }

  // ================= DOUBTS PORTAL =================

  static async getDoubts(
    institutionId: string,
    currentUserId: string,
    filters?: {
      subjectId?: string;
      search?: string;
      status?: 'all' | 'resolved' | 'unresolved';
      tag?: string;
    }
  ) {
    const whereClause: any = { institutionId };

    if (filters?.subjectId) {
      whereClause.subjectId = filters.subjectId;
    }
    if (filters?.status === 'resolved') {
      whereClause.isResolved = true;
    } else if (filters?.status === 'unresolved') {
      whereClause.isResolved = false;
    }
    if (filters?.search) {
      whereClause.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { content: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const doubts = await prisma.doubt.findMany({
      where: whereClause,
      include: {
        subject: { select: { id: true, name: true, code: true } },
        student: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
        acceptedReply: {
          select: {
            id: true,
            content: true,
            author: { select: { id: true, firstName: true, lastName: true, role: true } },
          },
        },
        votes: {
          where: { userId: currentUserId },
          select: { id: true },
        },
        _count: {
          select: {
            replies: true,
            votes: true,
          },
        },
      },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
    });

    return doubts.map((doubt) => {
      const isUpvotedByMe = doubt.votes.length > 0;
      const isAuthor = doubt.studentId === currentUserId;

      // Identity is only revealed through the separately audited admin endpoint.
      let displayAuthor = doubt.student;
      if (doubt.isAnonymous && !isAuthor) {
        displayAuthor = {
          id: 'anonymous',
          firstName: 'Anonymous',
          lastName: 'Student',
          role: RoleType.STUDENT,
        };
      }

      return {
        id: doubt.id,
        subjectId: doubt.subjectId,
        subject: doubt.subject,
        student: displayAuthor,
        isAuthor,
        title: doubt.title,
        content: doubt.content,
        codeSnippet: doubt.codeSnippet,
        codeLanguage: doubt.codeLanguage,
        attachments: (doubt.attachments as any[]) || [],
        tags: (doubt.tags as string[]) || [],
        isAnonymous: doubt.isAnonymous,
        isPinned: doubt.isPinned,
        isResolved: doubt.isResolved,
        upvotesCount: doubt._count.votes,
        repliesCount: doubt._count.replies,
        acceptedReplyId: doubt.acceptedReplyId,
        acceptedReply: doubt.acceptedReply,
        isUpvotedByMe,
        createdAt: doubt.createdAt,
        resolvedAt: doubt.resolvedAt,
      };
    });
  }

  static async getDoubtById(institutionId: string, currentUserId: string, doubtId: string) {
    const doubt = await prisma.doubt.findFirst({
      where: { id: doubtId, institutionId },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        student: {
          select: { id: true, firstName: true, lastName: true, role: true, email: true },
        },
        votes: {
          where: { userId: currentUserId },
          select: { id: true },
        },
        replies: {
          include: {
            author: { select: { id: true, firstName: true, lastName: true, role: true } },
            verifiedBy: { select: { id: true, firstName: true, lastName: true } },
            votes: {
              where: { userId: currentUserId },
              select: { id: true },
            },
            _count: {
              select: { votes: true },
            },
          },
          orderBy: [{ isFacultyVerified: 'desc' }, { upvotesCount: 'desc' }, { createdAt: 'asc' }],
        },
        _count: {
          select: { votes: true, replies: true },
        },
      },
    });

    if (!doubt) throw new Error('Doubt question not found');

    const isAuthor = doubt.studentId === currentUserId;
    let displayAuthor: any = doubt.student;
    if (doubt.isAnonymous && !isAuthor) {
      displayAuthor = {
        id: 'anonymous',
        firstName: 'Anonymous',
        lastName: 'Student',
        role: RoleType.STUDENT,
      };
    }

    const formattedReplies = doubt.replies.map((reply) => ({
      id: reply.id,
      doubtId: reply.doubtId,
      author: reply.author,
      content: reply.content,
      codeSnippet: reply.codeSnippet,
      codeLanguage: reply.codeLanguage,
      isFacultyVerified: reply.isFacultyVerified,
      verifiedBy: reply.verifiedBy,
      isAccepted: reply.id === doubt.acceptedReplyId,
      upvotesCount: reply._count.votes,
      isUpvotedByMe: reply.votes.length > 0,
      createdAt: reply.createdAt,
    }));

    return {
      id: doubt.id,
      subjectId: doubt.subjectId,
      subject: doubt.subject,
      student: displayAuthor,
      isAuthor,
      title: doubt.title,
      content: doubt.content,
      codeSnippet: doubt.codeSnippet,
      codeLanguage: doubt.codeLanguage,
      attachments: (doubt.attachments as any[]) || [],
      tags: (doubt.tags as string[]) || [],
      isAnonymous: doubt.isAnonymous,
      isPinned: doubt.isPinned,
      isResolved: doubt.isResolved,
      upvotesCount: doubt._count.votes,
      repliesCount: doubt._count.replies,
      acceptedReplyId: doubt.acceptedReplyId,
      isUpvotedByMe: doubt.votes.length > 0,
      createdAt: doubt.createdAt,
      resolvedAt: doubt.resolvedAt,
      replies: formattedReplies,
    };
  }

  static async createDoubt(institutionId: string, studentId: string, data: CreateDoubtInput) {
    if (!await PrivacyService.canUseCommunity(institutionId, studentId)) {
      throw new Error('Guardian consent is required before community features can be used.');
    }
    const doubt = await prisma.doubt.create({
      data: {
        institutionId,
        subjectId: data.subjectId,
        studentId,
        title: data.title,
        content: data.content,
        codeSnippet: data.codeSnippet || null,
        codeLanguage: data.codeLanguage || null,
        attachments: data.attachments || [],
        tags: data.tags || [],
        isAnonymous: data.isAnonymous ?? false,
      },
      include: {
        student: { select: { firstName: true, lastName: true } },
        subject: { select: { code: true, name: true } },
      },
    });

    // Notify assigned faculty for this subject
    const facultyAssignments = await prisma.facultyAssignment.findMany({
      where: { institutionId, subjectId: data.subjectId },
      select: { facultyId: true },
    });

    const facultyIds = Array.from(new Set(facultyAssignments.map((fa) => fa.facultyId)));
    if (facultyIds.length > 0) {
      const askName = doubt.isAnonymous ? 'A student' : `${doubt.student.firstName} ${doubt.student.lastName}`;
      await NotificationService.createNotification(
        institutionId,
        facultyIds,
        NotificationCategory.ACADEMIC,
        `New Doubt: ${doubt.subject.code}`,
        `${askName} asked: "${doubt.title}"`,
        `/doubts`
      );
    }

    return doubt;
  }

  static async replyDoubt(
    institutionId: string,
    authorId: string,
    doubtId: string,
    data: { content: string; codeSnippet?: string; codeLanguage?: string }
  ) {
    const doubt = await prisma.doubt.findFirst({
      where: { id: doubtId, institutionId },
    });
    if (!doubt) throw new Error('Doubt not found');

    const reply = await prisma.doubtReply.create({
      data: {
        institutionId,
        doubtId,
        authorId,
        content: data.content,
        codeSnippet: data.codeSnippet || null,
        codeLanguage: data.codeLanguage || null,
      },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, role: true } },
      },
    });

    // Notify question author
    if (doubt.studentId !== authorId) {
      await NotificationService.createNotification(
        institutionId,
        [doubt.studentId],
        NotificationCategory.COMMUNITY,
        `Reply to your Doubt: "${doubt.title}"`,
        `${reply.author.firstName} replied: "${data.content.slice(0, 100)}"`,
        `/doubts`
      );
    }

    return reply;
  }

  static async toggleDoubtVote(institutionId: string, userId: string, doubtId: string) {
    const existing = await prisma.doubtVote.findUnique({
      where: { userId_doubtId: { userId, doubtId } },
    });

    if (existing) {
      await prisma.$transaction([
        prisma.doubtVote.delete({ where: { id: existing.id } }),
        prisma.doubt.update({
          where: { id: doubtId },
          data: { upvotesCount: { decrement: 1 } },
        }),
      ]);
      return { upvoted: false };
    } else {
      await prisma.$transaction([
        prisma.doubtVote.create({
          data: { institutionId, userId, doubtId },
        }),
        prisma.doubt.update({
          where: { id: doubtId },
          data: { upvotesCount: { increment: 1 } },
        }),
      ]);
      return { upvoted: true };
    }
  }

  static async toggleReplyVote(institutionId: string, userId: string, replyId: string) {
    const existing = await prisma.doubtVote.findUnique({
      where: { userId_replyId: { userId, replyId } },
    });

    if (existing) {
      await prisma.$transaction([
        prisma.doubtVote.delete({ where: { id: existing.id } }),
        prisma.doubtReply.update({
          where: { id: replyId },
          data: { upvotesCount: { decrement: 1 } },
        }),
      ]);
      return { upvoted: false };
    } else {
      await prisma.$transaction([
        prisma.doubtVote.create({
          data: { institutionId, userId, replyId },
        }),
        prisma.doubtReply.update({
          where: { id: replyId },
          data: { upvotesCount: { increment: 1 } },
        }),
      ]);
      return { upvoted: true };
    }
  }

  static async acceptReply(institutionId: string, userId: string, doubtId: string, replyId: string) {
    const doubt = await prisma.doubt.findFirst({
      where: { id: doubtId, institutionId },
    });
    if (!doubt) throw new Error('Doubt not found');

    if (doubt.studentId !== userId) {
      throw new Error('Only the author of the question can mark an accepted solution.');
    }

    const reply = await prisma.doubtReply.findFirst({
      where: { id: replyId, doubtId, institutionId },
    });
    if (!reply) throw new Error('Reply not found');

    const updated = await prisma.doubt.update({
      where: { id: doubtId },
      data: {
        acceptedReplyId: replyId,
        isResolved: true,
        resolvedAt: new Date(),
      },
    });

    // Notify reply author
    if (reply.authorId !== userId) {
      await NotificationService.createNotification(
        institutionId,
        [reply.authorId],
        NotificationCategory.COMMUNITY,
        'Answer Accepted!',
        `Your reply was marked as the accepted solution for "${doubt.title}"!`,
        `/doubts`
      );
    }

    return updated;
  }

  static async verifyReply(institutionId: string, facultyId: string, doubtId: string, replyId: string) {
    const faculty = await prisma.user.findUnique({ where: { id: facultyId } });
    const canVerify =
      faculty?.role === RoleType.FACULTY ||
      faculty?.role === RoleType.HOD ||
      faculty?.role === RoleType.ADMIN ||
      faculty?.role === RoleType.SUPER_ADMIN;

    if (!canVerify) {
      throw new Error('Only faculty and administrators can verify answers.');
    }

    const reply = await prisma.doubtReply.findFirst({
      where: { id: replyId, doubtId, institutionId },
    });
    if (!reply) throw new Error('Reply not found');

    const newStatus = !reply.isFacultyVerified;
    const updated = await prisma.doubtReply.update({
      where: { id: replyId },
      data: {
        isFacultyVerified: newStatus,
        verifiedById: newStatus ? facultyId : null,
      },
      include: {
        verifiedBy: { select: { firstName: true, lastName: true } },
      },
    });

    if (newStatus && reply.authorId !== facultyId) {
      await NotificationService.createNotification(
        institutionId,
        [reply.authorId],
        NotificationCategory.ACADEMIC,
        'Answer Verified by Faculty!',
        `Your reply was verified by ${faculty?.firstName} ${faculty?.lastName}.`,
        `/doubts`
      );
    }

    return updated;
  }

  static async togglePinDoubt(institutionId: string, userId: string, doubtId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const canPin =
      user?.role === RoleType.FACULTY ||
      user?.role === RoleType.HOD ||
      user?.role === RoleType.ADMIN ||
      user?.role === RoleType.SUPER_ADMIN;

    if (!canPin) throw new Error('Only faculty and administrators can pin doubts.');

    const doubt = await prisma.doubt.findFirst({
      where: { id: doubtId, institutionId },
    });
    if (!doubt) throw new Error('Doubt not found');

    return prisma.doubt.update({
      where: { id: doubtId },
      data: { isPinned: !doubt.isPinned },
    });
  }

  static async revealAnonymousAuthor(institutionId: string, adminId: string, doubtId: string, req?: Request) {
    const admin = await prisma.user.findUnique({ where: { id: adminId } });
    if (admin?.role !== RoleType.ADMIN && admin?.role !== RoleType.SUPER_ADMIN) {
      throw new Error('Access denied. Only administrators can reveal anonymous authors for moderation.');
    }

    const doubt = await prisma.doubt.findFirst({
      where: { id: doubtId, institutionId },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            department: { select: { name: true, code: true } },
          },
        },
      },
    });

    if (!doubt) throw new Error('Doubt question not found');

    // Rule: Log access in audit_logs
    await createAuditLog({
      institutionId,
      userId: adminId,
      action: 'REVEAL_ANONYMOUS_AUTHOR',
      resource: 'doubt',
      resourceId: doubtId,
      details: {
        realAuthorId: doubt.studentId,
        realAuthorName: `${doubt.student.firstName} ${doubt.student.lastName}`,
        realAuthorEmail: doubt.student.email,
        doubtTitle: doubt.title,
      },
      req,
    });

    return doubt.student;
  }
}

export async function resolveAnnouncementRecipients(
  institutionId: string,
  authorId: string,
  scope: PostScope,
  target: { departmentId?: string | null; academicYearId?: string | null; sectionId?: string | null }
): Promise<string[]> {
  const base = { institutionId, isActive: true, id: { not: authorId } };
  let where: any = base;
  if (scope === PostScope.DEPARTMENT && target.departmentId) {
    where = { ...base, OR: [
      { departmentId: target.departmentId },
      { enrollments: { some: { institutionId, status: 'ACTIVE', section: { semester: { program: { departmentId: target.departmentId } } } } } },
      { facultyAssignments: { some: { institutionId, section: { semester: { program: { departmentId: target.departmentId } } } } } },
    ] };
  } else if (scope === PostScope.YEAR && target.academicYearId) {
    where = { ...base, OR: [
      { enrollments: { some: { institutionId, status: 'ACTIVE', section: { semester: { academicYearId: target.academicYearId } } } } },
      { facultyAssignments: { some: { institutionId, section: { semester: { academicYearId: target.academicYearId } } } } },
    ] };
  } else if (scope === PostScope.SECTION && target.sectionId) {
    where = { ...base, OR: [
      { enrollments: { some: { institutionId, status: 'ACTIVE', sectionId: target.sectionId } } },
      { facultyAssignments: { some: { institutionId, sectionId: target.sectionId } } },
    ] };
  }
  const users = await prisma.user.findMany({ where, select: { id: true } });
  return users.map((user) => user.id);
}
