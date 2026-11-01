export type PostScope = 'INSTITUTION' | 'DEPARTMENT' | 'YEAR' | 'SECTION' | 'PRIVATE_GROUP';

export type PostSection =
  | 'UNIVERSITY_FEED'
  | 'DEPARTMENT'
  | 'YEAR_AND_SECTION'
  | 'CLUBS'
  | 'EVENTS'
  | 'ACHIEVEMENTS'
  | 'LOST_AND_FOUND'
  | 'PLACEMENTS';

export interface PollOption {
  id: string;
  text: string;
  voteCount: number;
}

export interface PollData {
  id: string;
  question: string;
  options: PollOption[];
  totalVotes: number;
  expiresAt: string | null;
  userVotedOption: number | null;
  hasExpired: boolean;
}

export interface PostComment {
  id: string;
  postId: string;
  content: string;
  createdAt: string;
  author: {
    id: string;
    firstName: string;
    lastName: string;
    role: string;
  };
}

export interface CommunityPost {
  id: string;
  scope: PostScope;
  section: PostSection;
  title: string | null;
  content: string;
  images: string[];
  documents: { name: string; url: string; size?: number; kind?: 'image' | 'file' }[];
  links: string[];
  hashtags: string[];
  mentions: string[];
  isVerifiedAnnouncement: boolean;
  isPinned: boolean;
  likesCount: number;
  commentsCount: number;
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    firstName: string;
    lastName: string;
    role: string;
  };
  department?: { id: string; name: string; code: string } | null;
  sectionRef?: { id: string; name: string } | null;
  isLikedByMe: boolean;
  poll: PollData | null;
}

export type ContentReportTarget = 'POST' | 'COMMENT' | 'DOUBT' | 'DOUBT_REPLY';
export type ContentReportStatus = 'PENDING' | 'REVIEWED' | 'DISMISSED' | 'ACTION_TAKEN';

export interface ContentReport {
  id: string;
  targetType: ContentReportTarget;
  targetId: string;
  postId?: string | null;
  reason: string;
  details?: string | null;
  status: ContentReportStatus;
  createdAt: string;
  reporter: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
  };
  reviewedBy?: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  post?: {
    id: string;
    title?: string | null;
    content: string;
  } | null;
  actionNotes?: string | null;
}

export interface DoubtReply {
  id: string;
  doubtId: string;
  author: {
    id: string;
    firstName: string;
    lastName: string;
    role: string;
  };
  content: string;
  codeSnippet?: string | null;
  codeLanguage?: string | null;
  isFacultyVerified: boolean;
  verifiedBy?: { firstName: string; lastName: string } | null;
  isAccepted: boolean;
  upvotesCount: number;
  isUpvotedByMe: boolean;
  createdAt: string;
}

export interface Doubt {
  id: string;
  subjectId: string;
  subject: {
    id: string;
    name: string;
    code: string;
  };
  student: {
    id: string;
    firstName: string;
    lastName: string;
    role: string;
    email?: string;
  };
  isAuthor: boolean;
  title: string;
  content: string;
  codeSnippet?: string | null;
  codeLanguage?: string | null;
  attachments: { name: string; url: string; size?: number }[];
  tags: string[];
  isAnonymous: boolean;
  isPinned: boolean;
  isResolved: boolean;
  upvotesCount: number;
  repliesCount: number;
  acceptedReplyId?: string | null;
  acceptedReply?: {
    id: string;
    content: string;
    author: { id: string; firstName: string; lastName: string; role: string };
  } | null;
  isUpvotedByMe: boolean;
  createdAt: string;
  resolvedAt?: string | null;
  replies?: DoubtReply[];
}
