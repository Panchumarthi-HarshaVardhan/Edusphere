import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  CheckCheck,
  Settings,
  AlertTriangle,
  BookOpen,
  GraduationCap,
  MessageSquare,
  Megaphone,
  Shield,
  FileCheck,
} from 'lucide-react';
import api from '../api/client';
import type { NotificationItem, NotificationCategory } from '../types/notification';
import { NotificationPreferencesModal } from './NotificationPreferencesModal';

export const NotificationBell: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isPrefsOpen, setIsPrefsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data.notifications || []);
      setUnreadCount(res.data.unreadCount || 0);
    } catch (err) {
      console.error('Failed to load notifications:');
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // 30s heartbeat
    return () => clearInterval(interval);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAsRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error('Failed to mark read:');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.patch('/notifications/mark-all-read');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all read:');
    }
  };

  const getCategoryIcon = (category: NotificationCategory) => {
    switch (category) {
      case 'ATTENDANCE':
        return <AlertTriangle className="w-3.5 h-3.5 text-red-400" />;
      case 'EXAM':
        return <GraduationCap className="w-3.5 h-3.5 text-purple-400" />;
      case 'ACADEMIC':
        return <BookOpen className="w-3.5 h-3.5 text-indigo-400" />;
      case 'COMMUNITY':
        return <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />;
      case 'ANNOUNCEMENT':
        return <Megaphone className="w-3.5 h-3.5 text-cyan-400" />;
      case 'ADMIN':
        return <Shield className="w-3.5 h-3.5 text-amber-400" />;
      default:
        return <FileCheck className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-xl transition cursor-pointer border border-slate-700/60"
        title="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white font-mono font-bold text-[10px] w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden animate-fade-in">
          {/* Header */}
          <div className="p-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
            <div className="flex items-center space-x-2">
              <span className="font-bold text-xs text-white">Notifications</span>
              {unreadCount > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-950 text-red-300 border border-red-800 font-mono">
                  {unreadCount} unread
                </span>
              )}
            </div>

            <div className="flex items-center space-x-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  title="Mark all as read"
                  className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg text-xs transition cursor-pointer flex items-center space-x-1"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span className="text-[10px]">Read all</span>
                </button>
              )}
              <button
                onClick={() => {
                  setIsOpen(false);
                  setIsPrefsOpen(true);
                }}
                title="Delivery preferences"
                className="p-1 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-lg text-xs transition cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-slate-800/60">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                You're all caught up! No notifications.
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={(e) => {
                    if (!n.isRead) {
                      handleMarkAsRead(n.id, e);
                    }
                  }}
                  className={`p-3.5 transition cursor-pointer flex items-start space-x-3 ${
                    n.isRead ? 'bg-slate-900/40 opacity-75' : 'bg-slate-800/25 hover:bg-slate-800/40'
                  }`}
                >
                  <div className="p-2 bg-slate-950 rounded-xl border border-slate-800 shrink-0 mt-0.5">
                    {getCategoryIcon(n.category)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p
                        className={`text-xs truncate ${
                          n.isRead ? 'text-slate-300 font-medium' : 'text-white font-bold'
                        }`}
                      >
                        {n.title}
                      </p>
                      {!n.isRead && (
                        <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{n.body}</p>
                    <div className="flex items-center justify-between mt-2 text-[10px] text-slate-500 font-mono">
                      <span>{new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="uppercase text-[9px] px-1.5 py-0.2 bg-slate-950 text-slate-400 rounded border border-slate-800">
                        {n.category}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Preferences Modal */}
      <NotificationPreferencesModal
        isOpen={isPrefsOpen}
        onClose={() => setIsPrefsOpen(false)}
      />
    </div>
  );
};
