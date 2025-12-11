import React from 'react';
import ComingSoon from '@/components/common/UI/ComingSoon';
import { CalendarDaysIcon } from '@heroicons/react/24/outline';

const EventsManagement: React.FC = () => {
  const features = [
    {
      title: 'Complete Event CRUD',
      description: 'Create, read, update, and delete events with comprehensive management including status updates, archival, and bulk operations.',
    },
    {
      title: 'Event Categories & Classification',
      description: 'Organize events with hierarchical categories for better discovery and filtering. Manage category structure and reordering.',
    },
    {
      title: 'Custom Registration Forms',
      description: 'Build dynamic registration forms with multiple field types (text, dropdown, checkbox, radio, date) and validation rules.',
    },
    {
      title: 'Ticket Management',
      description: 'Configure multiple ticket types with pricing, capacity limits, early bird discounts, and availability windows.',
    },
    {
      title: 'Event Merchandise Store',
      description: 'Sell event-specific merchandise with inventory management, size variants, and integrated cart functionality.',
    },
    {
      title: 'Guest & Companion Management',
      description: 'Track event guests and companions with dedicated forms, approval workflows, and guest ticket allocation.',
    },
    {
      title: 'Registration Management',
      description: 'View and manage all registrations with filtering, sorting, status updates, check-in tracking, and attendance marking.',
    },
    {
      title: 'Payment & Invoice System',
      description: 'Integrated payment processing with Razorpay, automatic invoice generation, payment tracking, and receipt management.',
    },
    {
      title: 'QR Code Generation',
      description: 'Automatic QR code generation for tickets with secure validation for check-in and entry management.',
    },
    {
      title: 'Feedback & Survey System',
      description: 'Create post-event feedback forms with analytics, response collection, and exportable reports for insights.',
    },
    {
      title: 'Event Analytics Dashboard',
      description: 'Comprehensive analytics including registration trends, revenue tracking, attendance rates, and demographic insights.',
    },
    {
      title: 'Communication Tools',
      description: 'Send targeted notifications and announcements to registered participants via email and push notifications.',
    },
    {
      title: 'Advanced Filtering & Search',
      description: 'Filter events by status, category, date range, mode (Physical/Virtual/Hybrid), and full-text search capabilities.',
    },
    {
      title: 'Event Sections & Content',
      description: 'Add rich content sections to events including agenda, speakers, sponsors, FAQs, and custom information blocks.',
    },
    {
      title: 'Multi-format Exports',
      description: 'Export registration data, attendee lists, and reports in Excel, CSV, and PDF formats for offline processing.',
    },
    {
      title: 'Role-Based Access Control',
      description: 'Granular permissions for event creators, coordinators, and admins with audit logging for all operations.',
    },
  ];

  return (
    <ComingSoon
      title="Event Management System"
      description="Complete event management platform with 100+ API endpoints covering registration, ticketing, payments, feedback, analytics, and more. Fully implemented backend with multi-tenant support!"
      features={features}
      estimatedLaunch="Delivering Soon"
      icon={CalendarDaysIcon}
    />
  );
};

export default EventsManagement;
