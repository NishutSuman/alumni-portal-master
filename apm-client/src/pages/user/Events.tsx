import React from 'react';
import ComingSoon from '@/components/common/UI/ComingSoon';
import { CalendarDaysIcon } from '@heroicons/react/24/outline';

const Events: React.FC = () => {
  const features = [
    {
      title: 'Event Discovery',
      description: 'Browse upcoming and past events with advanced filtering by category, date, location, and event mode (In-Person/Virtual/Hybrid).',
    },
    {
      title: 'Event Registration',
      description: 'Register for events with multiple ticket types, guest management, and custom registration forms with field validation.',
    },
    {
      title: 'Payment Integration',
      description: 'Secure online payment processing for event tickets and merchandise with automatic invoice generation.',
    },
    {
      title: 'Event Merchandise',
      description: 'Purchase event-specific merchandise with size selection, quantity management, and cart functionality.',
    },
    {
      title: 'Guest Management',
      description: 'Add and manage guests for events with dedicated guest forms, status tracking, and companion tickets.',
    },
    {
      title: 'Event Feedback',
      description: 'Submit detailed feedback after attending events through customizable feedback forms with various field types.',
    },
    {
      title: 'QR Code Tickets',
      description: 'Digital tickets with unique QR codes for contactless check-in and entry verification at events.',
    },
    {
      title: 'Event Notifications',
      description: 'Receive timely notifications about event updates, registration confirmations, and important announcements.',
    },
    {
      title: 'Registration History',
      description: 'View your complete event registration history with payment receipts and ticket downloads.',
    },
    {
      title: 'Calendar Integration',
      description: 'Add events to your personal calendar with reminders and automatic updates for schedule changes.',
    },
    {
      title: 'Event Details',
      description: 'Access comprehensive event information including description, schedule, venue details, speakers, and agenda.',
    },
    {
      title: 'Social Features',
      description: 'See who else is attending, share events with friends, and engage with event-related posts and discussions.',
    },
  ];

  return (
    <ComingSoon
      title="Events & Registrations"
      description="Discover, register, and participate in alumni events. Complete event management with ticketing, payments, merchandise, and feedback system."
      features={features}
      estimatedLaunch="Delivering Soon"
      icon={CalendarDaysIcon}
    />
  );
};

export default Events;
