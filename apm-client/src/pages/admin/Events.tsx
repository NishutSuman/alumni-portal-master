import React from 'react';
import ComingSoon from '@/components/common/UI/ComingSoon';
import { CalendarDaysIcon } from '@heroicons/react/24/outline';

const Events: React.FC = () => {
  const features = [
    {
      title: 'Event Overview Dashboard',
      description: 'Monitor all events at a glance with quick stats, upcoming event timeline, and registration metrics.',
    },
    {
      title: 'Event Creation & Publishing',
      description: 'Create and publish events with rich content, media uploads, and customizable registration requirements.',
    },
    {
      title: 'Registration Monitoring',
      description: 'Track real-time registrations, view attendee lists, and manage participant information efficiently.',
    },
    {
      title: 'Revenue Analytics',
      description: 'Monitor event revenue, ticket sales, merchandise purchases, and payment status with detailed breakdowns.',
    },
    {
      title: 'Attendance Tracking',
      description: 'Mark attendance, scan QR codes for check-in, and generate attendance reports for all events.',
    },
    {
      title: 'Communication Center',
      description: 'Send announcements, reminders, and updates to registered participants directly from the dashboard.',
    },
  ];

  return (
    <ComingSoon
      title="Events Dashboard"
      description="Monitor and manage all event activities from a centralized dashboard. View analytics, track registrations, and communicate with attendees."
      features={features}
      estimatedLaunch="Delivering Soon"
      icon={CalendarDaysIcon}
    />
  );
};

export default Events;
