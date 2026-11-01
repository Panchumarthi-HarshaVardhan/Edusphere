export type NotificationCategory =
  | 'ATTENDANCE'
  | 'ACADEMIC'
  | 'EXAM'
  | 'ASSIGNMENT'
  | 'COMMUNITY'
  | 'ANNOUNCEMENT'
  | 'ADMIN';

export interface NotificationItem {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  link?: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationPreferenceItem {
  category: NotificationCategory;
  inAppEnabled: boolean;
  emailEnabled: boolean;
  isUnmutable: boolean;
}
