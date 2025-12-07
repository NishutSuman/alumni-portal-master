import React from 'react';
import ComingSoon from '@/components/common/UI/ComingSoon';
import { LifebuoyIcon } from '@heroicons/react/24/outline';

const Support: React.FC = () => {
  const features = [
    {
      title: 'Create Support Tickets',
      description: 'Submit support tickets with title, description, category selection, and priority levels (Low, Medium, High, Urgent).',
    },
    {
      title: 'File Attachments',
      description: 'Attach multiple files and screenshots to tickets and messages for better context and faster resolution.',
    },
    {
      title: 'Real-time Messaging',
      description: 'Two-way communication with support team through ticket messages. Edit messages, add reactions, and save drafts.',
    },
    {
      title: 'Ticket Status Tracking',
      description: 'Track ticket status in real-time (Open, In Progress, Waiting, Resolved, Closed) with automatic notifications.',
    },
    {
      title: 'User Dashboard',
      description: 'Personal dashboard showing your tickets with statistics, filtering by status, category, and priority.',
    },
    {
      title: 'Reopen Closed Tickets',
      description: 'Reopen resolved or closed tickets if the issue persists with time-based reopening policies.',
    },
    {
      title: 'Satisfaction Ratings',
      description: 'Rate your support experience with 1-5 stars and provide feedback to help improve service quality.',
    },
    {
      title: 'Message Reactions',
      description: 'React to messages with emojis for quick acknowledgment and engagement tracking.',
    },
    {
      title: 'Message Edit History',
      description: 'View complete edit history of messages with timestamps showing what changed and when.',
    },
    {
      title: 'Rich Text Formatting',
      description: 'Format your messages with markdown, mentions, links, and code blocks for better communication.',
    },
  ];

  return (
    <ComingSoon
      title="Support Center"
      description="Comprehensive support ticket system with 70+ API endpoints covering tickets, messaging, categories, and real-time notifications. Full backend implementation!"
      features={features}
      estimatedLaunch="Delivering Soon"
      icon={LifebuoyIcon}
    />
  );
};

export default Support;
