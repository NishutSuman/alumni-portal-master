// src/pages/common/OrganizationView.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BuildingOfficeIcon,
  EnvelopeIcon,
  PhoneIcon,
  MapPinIcon,
  CalendarIcon,
  UserGroupIcon,
  GlobeAltIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  DocumentIcon,
  EyeIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';
import LoadingSpinner from '@/components/common/UI/LoadingSpinner';
import OrganizationLogo from '@/components/common/UI/OrganizationLogo';
import PDFModal from '@/components/common/UI/PDFModal';
import ProfileMarquee from '@/components/common/UI/ProfileMarquee';
import { useGetPublicOrganizationQuery } from '@/store/api/apiSlice';
import { useGetPublicGroupsQuery } from '@/store/api/groupsApi';

interface FoundingMember {
  name: string;
  role: string;
  year: number;
}

// Social Media Icon Components
const FacebookIcon = () => (
  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

const InstagramIcon = () => (
  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
  </svg>
);

const TwitterIcon = () => (
  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

const LinkedInIcon = () => (
  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
);

const YouTubeIcon = () => (
  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

const OrganizationView = () => {
  const { data: orgData, isLoading, error } = useGetPublicOrganizationQuery();
  const { data: groupsData, isLoading: groupsLoading } = useGetPublicGroupsQuery();
  const [showBylawModal, setShowBylawModal] = useState(false);
  const [showCertModal, setShowCertModal] = useState(false);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [expandedCards, setExpandedCards] = useState<{ [key: string]: boolean }>({
    description: false,
    mission: false,
    vision: false,
  });

  // Prepare leadership messages for carousel - MUST BE BEFORE CONDITIONAL RETURNS
  // Now fetching actual user data from OFFICE_BEARERS group
  const messages = useMemo(() => {
    // Early return if data is not loaded yet
    if (!orgData || !groupsData) {
      return [];
    }

    const msgs = [];
    const organization = orgData;

    // Find the OFFICE_BEARERS group
    const officeBearersGroup = groupsData.find((group: any) => group.type === 'OFFICE_BEARERS');

    // Helper to get user by role
    const getUserByRole = (role: string) => {
      return officeBearersGroup?.members?.find((member: any) => member.role === role);
    };

    // Helper to convert R2 URL to proxy URL to avoid CORS issues
    const getProxyImageUrl = (r2Url: string | null, userId: string) => {
      if (!r2Url) return null;
      // Use the backend proxy to serve the image (avoids CORS)
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      return `${baseUrl}/api/users/profile-picture/${userId}`;
    };

    // President
    if (organization.presidentMessage) {
      const president = getUserByRole('PRESIDENT');
      msgs.push({
        title: "President",
        content: organization.presidentMessage,
        gradient: "from-blue-500 to-blue-600",
        bgGradient: "from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20",
        initial: "P",
        user: president ? {
          id: president.id,
          name: president.name,
          profileImage: getProxyImageUrl(president.profileImage, president.id),
          batch: president.batch
        } : null
      });
    }

    // Secretary
    if (organization.secretaryMessage) {
      const secretary = getUserByRole('SECRETARY');
      msgs.push({
        title: "Secretary",
        content: organization.secretaryMessage,
        gradient: "from-green-500 to-green-600",
        bgGradient: "from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20",
        initial: "S",
        user: secretary ? {
          id: secretary.id,
          name: secretary.name,
          profileImage: getProxyImageUrl(secretary.profileImage, secretary.id),
          batch: secretary.batch
        } : null
      });
    }

    // Treasurer
    if (organization.treasurerMessage) {
      const treasurer = getUserByRole('TREASURER');
      msgs.push({
        title: "Treasurer",
        content: organization.treasurerMessage,
        gradient: "from-purple-500 to-purple-600",
        bgGradient: "from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20",
        initial: "T",
        user: treasurer ? {
          id: treasurer.id,
          name: treasurer.name,
          profileImage: getProxyImageUrl(treasurer.profileImage, treasurer.id),
          batch: treasurer.batch
        } : null
      });
    }

    return msgs;
  }, [orgData, groupsData]);

  // Auto-rotate messages every 10 seconds - MUST BE BEFORE CONDITIONAL RETURNS
  useEffect(() => {
    if (messages.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentMessageIndex((prev) => (prev + 1) % messages.length);
    }, 10000); // 10 seconds

    return () => clearInterval(interval);
  }, [messages.length]);

  // Generate file URLs for display using proxy
  const getFileUrl = (fileType: string) => {
    if (!orgData) return '';

    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

    switch (fileType) {
      case 'bylaw':
        return `${baseUrl}/organization/files/bylaw`;
      case 'certificate':
        return `${baseUrl}/organization/files/certificate`;
      default:
        return '';
    }
  };

  const toggleCard = (cardName: string) => {
    setExpandedCards(prev => ({
      ...prev,
      [cardName]: !prev[cardName]
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 sm:p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <div className="flex items-center">
            <ExclamationTriangleIcon className="h-6 w-6 text-red-600 dark:text-red-400 mr-3" />
            <div>
              <h3 className="text-lg font-medium text-red-800 dark:text-red-300">
                Failed to load organization information
              </h3>
              <p className="text-red-600 dark:text-red-400 mt-1">
                Please check your connection and try again.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!orgData) {
    return (
      <div className="p-4 sm:p-6">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
          <div className="flex">
            <InformationCircleIcon className="h-5 w-5 text-yellow-500 mt-0.5" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
                Organization Information Not Available
              </h3>
              <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
                The organization details have not been configured yet. Please contact an administrator.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const organization = orgData;

  // Parse founding members
  let foundingMembers: FoundingMember[] = [];
  if (organization?.foundingMembers) {
    try {
      foundingMembers = typeof organization.foundingMembers === 'string'
        ? JSON.parse(organization.foundingMembers)
        : organization.foundingMembers;
    } catch {
      foundingMembers = [];
    }
  }

  // Social links with proper icons
  const socialLinks = [
    { name: 'Website', url: organization?.websiteUrl, icon: GlobeAltIcon },
    { name: 'Facebook', url: organization?.facebookUrl, icon: FacebookIcon },
    { name: 'Instagram', url: organization?.instagramUrl, icon: InstagramIcon },
    { name: 'Twitter', url: organization?.twitterUrl, icon: TwitterIcon },
    { name: 'LinkedIn', url: organization?.linkedinUrl, icon: LinkedInIcon },
    { name: 'YouTube', url: organization?.youtubeUrl, icon: YouTubeIcon }
  ].filter(link => link.url);

  const nextMessage = () => {
    setCurrentMessageIndex((prev) => (prev + 1) % messages.length);
  };

  const prevMessage = () => {
    setCurrentMessageIndex((prev) => (prev - 1 + messages.length) % messages.length);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6">
      {/* Hero Banner - Reduced font size */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-2xl overflow-hidden shadow-xl"
      >
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative px-6 py-8 sm:px-10 sm:py-12">
          <div className="flex flex-col lg:flex-row items-center lg:items-start gap-6 lg:gap-10">
            {/* Logo - Properly aligned */}
            <div className="flex-shrink-0">
              <div className="w-32 h-32 sm:w-40 sm:h-40 bg-white/20 backdrop-blur-sm rounded-2xl p-4 shadow-2xl flex items-center justify-center">
                <OrganizationLogo size="2xl" />
              </div>
            </div>

            {/* Organization Info */}
            <div className="flex-1 text-center lg:text-left text-white">
              {/* Reduced font sizes */}
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2 drop-shadow-lg">
                {organization?.name || 'Jawahar Navodaya Vidyalaya Alumni'}
              </h1>
              <p className="text-base sm:text-lg opacity-95 mb-4 font-medium">
                {organization?.shortName || 'JNV'} • Est. {organization?.foundationYear || 1986}
              </p>

              {/* Contact Info and Social Links in Banner - All in one row */}
              <div className="mt-6 flex flex-wrap gap-3 justify-center lg:justify-start items-center">
                {organization?.officialEmail && (
                  <a
                    href={`mailto:${organization.officialEmail}`}
                    className="inline-flex items-center px-4 py-2 bg-white/20 backdrop-blur-sm rounded-lg hover:bg-white/30 transition-all text-sm font-medium"
                  >
                    <EnvelopeIcon className="h-4 w-4 mr-2" />
                    {organization.officialEmail}
                  </a>
                )}
                {organization?.officialContactNumber && (
                  <a
                    href={`tel:${organization.officialContactNumber}`}
                    className="inline-flex items-center px-4 py-2 bg-white/20 backdrop-blur-sm rounded-lg hover:bg-white/30 transition-all text-sm font-medium"
                  >
                    <PhoneIcon className="h-4 w-4 mr-2" />
                    {organization.officialContactNumber}
                  </a>
                )}
                {organization?.officeAddress && (
                  <div className="inline-flex items-center px-4 py-2 bg-white/20 backdrop-blur-sm rounded-lg text-sm font-medium">
                    <MapPinIcon className="h-4 w-4 mr-2" />
                    <span className="line-clamp-1">{organization.officeAddress.split('\n')[0]}</span>
                  </div>
                )}

                {/* Social Links Icons - Inline with contact info */}
                {socialLinks.length > 0 && (
                  <>
                    {socialLinks.map((link, index) => {
                      const IconComponent = link.icon;
                      return (
                        <a
                          key={index}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center hover:bg-white/30 transition-all hover:scale-110"
                          title={link.name}
                        >
                          <IconComponent />
                        </a>
                      );
                    })}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Alumni Showcase Marquee - Moved to top */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="py-6"
      >
        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Our Proud Alumni
          </h2>
        </div>

        <ProfileMarquee speed="medium" />
      </motion.div>

      {/* Stats Cards - Moved from banner */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-md border border-gray-200 dark:border-gray-700 text-center hover:shadow-lg transition-shadow">
          <CalendarIcon className="h-10 w-10 mx-auto mb-3 text-blue-600 dark:text-blue-400" />
          <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
            {new Date().getFullYear() - (organization?.foundationYear || 1986)}+
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Years Active</div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-md border border-gray-200 dark:border-gray-700 text-center hover:shadow-lg transition-shadow">
          <UserGroupIcon className="h-10 w-10 mx-auto mb-3 text-purple-600 dark:text-purple-400" />
          <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
            {foundingMembers.length}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Founders</div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-md border border-gray-200 dark:border-gray-700 text-center hover:shadow-lg transition-shadow">
          <UsersIcon className="h-10 w-10 mx-auto mb-3 text-green-600 dark:text-green-400" />
          <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
            {socialLinks.length}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Social Links</div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-md border border-gray-200 dark:border-gray-700 text-center hover:shadow-lg transition-shadow">
          <BuildingOfficeIcon className="h-10 w-10 mx-auto mb-3 text-pink-600 dark:text-pink-400" />
          <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
            {organization?.foundationYear || 1986}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Founded</div>
        </div>
      </motion.div>

      {/* Description, Mission, Vision - Expandable Cards */}
      {(organization?.description || organization?.mission || organization?.vision) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid md:grid-cols-3 gap-4"
        >
          {/* Description */}
          {organization?.description && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-md overflow-hidden">
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center mr-3 shadow-md">
                      <InformationCircleIcon className="h-5 w-5 text-white" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Our Story</h3>
                  </div>
                  <button
                    onClick={() => toggleCard('description')}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    {expandedCards.description ? (
                      <ChevronUpIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                    ) : (
                      <ChevronDownIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                    )}
                  </button>
                </div>
                <div className={`text-sm text-gray-700 dark:text-gray-300 leading-relaxed ${expandedCards.description ? '' : 'line-clamp-3'}`}>
                  {organization.description}
                </div>
                {!expandedCards.description && organization.description.length > 150 && (
                  <button
                    onClick={() => toggleCard('description')}
                    className="mt-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                  >
                    Read More
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Mission */}
          {organization?.mission && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-md overflow-hidden">
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center mr-3 shadow-md">
                      <InformationCircleIcon className="h-5 w-5 text-white" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Our Mission</h3>
                  </div>
                  <button
                    onClick={() => toggleCard('mission')}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    {expandedCards.mission ? (
                      <ChevronUpIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                    ) : (
                      <ChevronDownIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                    )}
                  </button>
                </div>
                <div className={`text-sm text-gray-700 dark:text-gray-300 leading-relaxed ${expandedCards.mission ? '' : 'line-clamp-3'}`}>
                  {organization.mission}
                </div>
                {!expandedCards.mission && organization.mission.length > 150 && (
                  <button
                    onClick={() => toggleCard('mission')}
                    className="mt-2 text-sm font-medium text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300"
                  >
                    Read More
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Vision */}
          {organization?.vision && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-md overflow-hidden">
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center mr-3 shadow-md">
                      <InformationCircleIcon className="h-5 w-5 text-white" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Our Vision</h3>
                  </div>
                  <button
                    onClick={() => toggleCard('vision')}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    {expandedCards.vision ? (
                      <ChevronUpIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                    ) : (
                      <ChevronDownIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                    )}
                  </button>
                </div>
                <div className={`text-sm text-gray-700 dark:text-gray-300 leading-relaxed ${expandedCards.vision ? '' : 'line-clamp-3'}`}>
                  {organization.vision}
                </div>
                {!expandedCards.vision && organization.vision.length > 150 && (
                  <button
                    onClick={() => toggleCard('vision')}
                    className="mt-2 text-sm font-medium text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300"
                  >
                    Read More
                  </button>
                )}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Leader's Message - Changed title */}
      {messages.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 sm:p-8"
        >
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 text-center">
            Leader's Message
          </h2>

          <div className="relative max-w-3xl mx-auto">
            <AnimatePresence mode="wait">
              {messages[currentMessageIndex] && (
                <motion.div
                  key={currentMessageIndex}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.4 }}
                  className="text-center"
                >
                  {/* Profile Image/Avatar in Center */}
                  <div className="flex justify-center mb-6">
                    {messages[currentMessageIndex].user?.profileImage ? (
                      <img
                        src={messages[currentMessageIndex].user.profileImage}
                        alt={messages[currentMessageIndex].user.name}
                        className="w-24 h-24 rounded-full object-cover shadow-xl ring-4 ring-white dark:ring-gray-800"
                        onError={(e) => {
                          console.error('❌ Image failed to load:', messages[currentMessageIndex].user.profileImage);
                          // Replace with fallback div
                          const parent = e.currentTarget.parentElement;
                          if (parent) {
                            parent.innerHTML = `<div class="w-24 h-24 bg-gradient-to-br ${messages[currentMessageIndex].gradient} rounded-full flex items-center justify-center shadow-xl ring-4 ring-white dark:ring-gray-800"><span class="text-white font-bold text-3xl">${messages[currentMessageIndex].initial}</span></div>`;
                          }
                        }}
                        onLoad={() => {
                          // Image loaded successfully
                        }}
                      />
                    ) : (
                      <div className={`w-24 h-24 bg-gradient-to-br ${messages[currentMessageIndex].gradient} rounded-full flex items-center justify-center shadow-xl ring-4 ring-white dark:ring-gray-800`}>
                        <span className="text-white font-bold text-3xl">
                          {messages[currentMessageIndex].initial}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Title and Name */}
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                    {messages[currentMessageIndex].title}
                  </h3>
                  {messages[currentMessageIndex].user && (
                    <p className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      {messages[currentMessageIndex].user.name}
                    </p>
                  )}
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                    {messages[currentMessageIndex].user?.batch && `Batch ${messages[currentMessageIndex].user.batch} • `}
                    Message from our {messages[currentMessageIndex].title}
                  </p>

                  {/* Message Content */}
                  <div className={`bg-gradient-to-br ${messages[currentMessageIndex].bgGradient} rounded-xl p-6 sm:p-8 border border-gray-200 dark:border-gray-600`}>
                    <p className="text-base text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                      {messages[currentMessageIndex].content}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Carousel Controls */}
            {messages.length > 1 && (
              <div className="flex items-center justify-center mt-8 gap-8">
                <button
                  onClick={prevMessage}
                  className="p-3 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors shadow-md"
                  aria-label="Previous message"
                >
                  <ChevronLeftIcon className="h-6 w-6 text-gray-600 dark:text-gray-300" />
                </button>

                <div className="flex space-x-2">
                  {messages.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentMessageIndex(index)}
                      className={`h-2.5 rounded-full transition-all ${
                        index === currentMessageIndex
                          ? 'w-10 bg-blue-600'
                          : 'w-2.5 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400'
                      }`}
                      aria-label={`Go to message ${index + 1}`}
                    />
                  ))}
                </div>

                <button
                  onClick={nextMessage}
                  className="p-3 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors shadow-md"
                  aria-label="Next message"
                >
                  <ChevronRightIcon className="h-6 w-6 text-gray-600 dark:text-gray-300" />
                </button>
              </div>
            )}
          </div>
        </motion.div>
      )}


      {/* Official Documents */}
      {orgData && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-6"
        >
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center">
            <DocumentIcon className="h-6 w-6 mr-2 text-blue-600 dark:text-blue-400" />
            Official Documents
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Bylaw Document */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 rounded-lg p-5 border border-blue-200 dark:border-blue-700">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center mr-3 shadow-md">
                  <DocumentIcon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">Bylaw Document</h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Governance & policies</p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowBylawModal(true)}
                  className="flex-1 flex items-center justify-center px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm"
                >
                  <EyeIcon className="h-4 w-4 mr-2" />
                  View
                </button>
                <a
                  href={getFileUrl('bylaw')}
                  download="bylaw-document.pdf"
                  className="flex items-center justify-center px-4 py-2.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors shadow-sm"
                >
                  <DocumentIcon className="h-4 w-4" />
                </a>
              </div>
            </div>

            {/* Registration Certificate */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/10 dark:to-emerald-900/10 rounded-lg p-5 border border-green-200 dark:border-green-700">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center mr-3 shadow-md">
                  <DocumentIcon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">Registration Certificate</h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Official registration</p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowCertModal(true)}
                  className="flex-1 flex items-center justify-center px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium shadow-sm"
                >
                  <EyeIcon className="h-4 w-4 mr-2" />
                  View
                </button>
                <a
                  href={getFileUrl('certificate')}
                  download="registration-certificate.pdf"
                  className="flex items-center justify-center px-4 py-2.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors shadow-sm"
                >
                  <DocumentIcon className="h-4 w-4" />
                </a>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Founding Members */}
      {foundingMembers.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-6"
        >
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center">
            <UserGroupIcon className="h-6 w-6 mr-2 text-blue-600 dark:text-blue-400" />
            Founding Members
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {foundingMembers.map((member, index) => {
              const colors = [
                'from-blue-500 to-blue-600',
                'from-purple-500 to-purple-600',
                'from-green-500 to-green-600',
                'from-red-500 to-red-600',
                'from-yellow-500 to-yellow-600',
                'from-pink-500 to-pink-600',
                'from-indigo-500 to-indigo-600',
                'from-teal-500 to-teal-600'
              ];
              const gradientClass = colors[index % colors.length];

              return (
                <div
                  key={index}
                  className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 border border-gray-200 dark:border-gray-600 hover:shadow-md transition-shadow"
                >
                  <div className="text-center">
                    <div className={`w-14 h-14 bg-gradient-to-br ${gradientClass} rounded-full flex items-center justify-center mx-auto mb-2 shadow-md`}>
                      <span className="text-white font-bold text-base">
                        {member.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                      </span>
                    </div>
                    <h3 className="font-semibold text-sm text-gray-900 dark:text-white mb-0.5 leading-tight line-clamp-2">{member.name}</h3>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1 line-clamp-1">{member.role}</p>
                    <div className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                      {member.year}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Footer Note */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 rounded-xl p-8 text-center border border-gray-200 dark:border-gray-600"
      >
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-center mb-4">
            <OrganizationLogo size="md" className="mr-4" />
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                {organization?.name || 'Alumni Network'}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Building connections, Creating opportunities
              </p>
            </div>
          </div>

          <div className="border-t border-gray-200 dark:border-gray-600 pt-4 mt-4">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
              Organization information is maintained by administrators.
              For updates or corrections, please contact the admin team.
            </p>

            <div className="flex items-center justify-center space-x-6 text-xs text-gray-400 dark:text-gray-500">
              <span>© {organization?.foundationYear || 1986} - {new Date().getFullYear()}</span>
              <span>•</span>
              <span>Alumni Portal Management System</span>
              <span>•</span>
              <span>Last updated: {new Date().toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* PDF Modals */}
      <PDFModal
        isOpen={showBylawModal}
        onClose={() => setShowBylawModal(false)}
        fileUrl={getFileUrl('bylaw')}
        fileName="Bylaw Document"
        title="Organization Bylaw Document"
      />

      <PDFModal
        isOpen={showCertModal}
        onClose={() => setShowCertModal(false)}
        fileUrl={getFileUrl('certificate')}
        fileName="Registration Certificate"
        title="Organization Registration Certificate"
      />
    </div>
  );
};

export default OrganizationView;
