// src/pages/common/OrganizationView.tsx
import React, { useState } from 'react';
import { motion } from 'framer-motion';
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
  EyeIcon
} from '@heroicons/react/24/outline';
import LoadingSpinner from '@/components/common/UI/LoadingSpinner';
import OrganizationLogo from '@/components/common/UI/OrganizationLogo';
import PDFViewer from '@/components/common/UI/PDFViewer';
import PDFModal from '@/components/common/UI/PDFModal';
import { useGetPublicOrganizationQuery } from '@/store/api/apiSlice';

interface FoundingMember {
  name: string;
  role: string;
  year: number;
}

const OrganizationView = () => {
  const { data: orgData, isLoading, error } = useGetPublicOrganizationQuery();
  const [showBylawModal, setShowBylawModal] = useState(false);
  const [showCertModal, setShowCertModal] = useState(false);

  // Generate file URLs for display using proxy
  const getFileUrl = (fileType: string) => {
    if (!orgData) return '';
    
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';
    
    switch (fileType) {
      case 'bylaw':
        // Always try the proxy endpoint - files exist even if URLs aren't in DB
        return `${baseUrl}/organization/files/bylaw`;
      case 'certificate':
        // Always try the proxy endpoint - files exist even if URLs aren't in DB  
        return `${baseUrl}/organization/files/certificate`;
      default:
        return '';
    }
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

  // Social links
  const socialLinks = [
    { name: 'Website', url: organization?.websiteUrl, icon: GlobeAltIcon },
    { name: 'Facebook', url: organization?.facebookUrl, icon: null },
    { name: 'Instagram', url: organization?.instagramUrl, icon: null },
    { name: 'Twitter', url: organization?.twitterUrl, icon: null },
    { name: 'LinkedIn', url: organization?.linkedinUrl, icon: null },
    { name: 'YouTube', url: organization?.youtubeUrl, icon: null }
  ].filter(link => link.url);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-8 text-white shadow-lg"
      >
        <div className="flex flex-col lg:flex-row items-center lg:items-start gap-6">
          <OrganizationLogo size="2xl" className="drop-shadow-lg bg-white/10 backdrop-blur rounded-xl p-4" />
          <div className="text-center lg:text-left flex-1">
            <h1 className="text-3xl lg:text-4xl font-bold mb-2">
              {organization?.name || 'Jawahar Navodaya Vidyalaya Alumni'}
            </h1>
            <p className="text-xl opacity-90 mb-4">
              {organization?.shortName || 'JNV'} • Est. {organization?.foundationYear || 1986}
            </p>
            {organization?.officeAddress && (
              <p className="text-white/80 max-w-2xl">
                {organization.officeAddress}
              </p>
            )}
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contact Information */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6"
        >
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center">
            <EnvelopeIcon className="h-7 w-7 mr-3 text-blue-600 dark:text-blue-400" />
            Contact Information
          </h2>
          
          <div className="space-y-6">
            {organization?.officialEmail && (
              <div className="flex items-center space-x-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-l-4 border-blue-500">
                <div className="flex-shrink-0 w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                  <EnvelopeIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Official Email</p>
                  <a
                    href={`mailto:${organization.officialEmail}`}
                    className="text-lg font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {organization.officialEmail}
                  </a>
                </div>
              </div>
            )}

            {organization?.officialContactNumber && (
              <div className="flex items-center space-x-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border-l-4 border-green-500">
                <div className="flex-shrink-0 w-10 h-10 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
                  <PhoneIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Contact Number</p>
                  <a
                    href={`tel:${organization.officialContactNumber}`}
                    className="text-lg font-semibold text-green-600 dark:text-green-400 hover:underline"
                  >
                    {organization.officialContactNumber}
                  </a>
                </div>
              </div>
            )}

            {organization?.officeAddress && (
              <div className="flex items-start space-x-4 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border-l-4 border-purple-500">
                <div className="flex-shrink-0 w-10 h-10 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center mt-1">
                  <MapPinIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Office Address</p>
                  <p className="text-lg font-medium text-gray-900 dark:text-white whitespace-pre-wrap leading-relaxed">
                    {organization.officeAddress}
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center space-x-4 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border-l-4 border-orange-500">
              <div className="flex-shrink-0 w-10 h-10 bg-orange-100 dark:bg-orange-900 rounded-lg flex items-center justify-center">
                <CalendarIcon className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Founded</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">{organization?.foundationYear || 1986}</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Social Links */}
        {socialLinks.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6"
          >
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center">
              <GlobeAltIcon className="h-7 w-7 mr-3 text-blue-600 dark:text-blue-400" />
              Connect With Us
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {socialLinks.map((link, index) => {
                const colors = [
                  'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/30',
                  'bg-pink-50 dark:bg-pink-900/20 border-pink-200 dark:border-pink-700 hover:bg-pink-100 dark:hover:bg-pink-900/30',
                  'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700 hover:bg-green-100 dark:hover:bg-green-900/30',
                  'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-700 hover:bg-purple-100 dark:hover:bg-purple-900/30',
                  'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-700 hover:bg-indigo-100 dark:hover:bg-indigo-900/30',
                  'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700 hover:bg-red-100 dark:hover:bg-red-900/30'
                ];
                const colorClass = colors[index % colors.length];
                
                return (
                  <a
                    key={index}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center space-x-4 p-4 rounded-xl border transition-all duration-200 transform hover:scale-105 hover:shadow-md ${colorClass}`}
                  >
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                      {link.icon ? (
                        <link.icon className="h-6 w-6" />
                      ) : (
                        <GlobeAltIcon className="h-6 w-6" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-white text-lg">{link.name}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                        {link.url?.replace(/^https?:\/\//, '') || ''}
                      </p>
                    </div>
                  </a>
                );
              })}
            </div>
          </motion.div>
        )}
      </div>

      {/* Organization Documents - Always show since files exist via proxy */}
      {orgData && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-8"
        >
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 flex items-center">
            <DocumentIcon className="h-8 w-8 mr-4 text-blue-600 dark:text-blue-400" />
            Official Documents
          </h2>
          
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            {/* Bylaw Document */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5 }}
              className="group"
            >
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 rounded-xl p-6 border border-blue-200 dark:border-blue-700 hover:shadow-lg transition-all duration-300">
                <div className="flex items-center mb-6">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mr-4 shadow-lg">
                    <DocumentIcon className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Bylaw Document</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Organization governance and policies</p>
                  </div>
                </div>
                
                {/* Desktop: Show PDF preview */}
                <div className="hidden md:block bg-white dark:bg-gray-800 rounded-lg p-4 mb-6 shadow-inner">
                  <PDFViewer
                    fileUrl={getFileUrl('bylaw')}
                    fileName="Bylaw Document"
                    maxWidth={500}
                    maxHeight={600}
                    showControls={true}
                    className="w-full"
                  />
                </div>
                
                {/* Mobile: Show document icon only */}
                <div className="md:hidden bg-white dark:bg-gray-800 rounded-lg p-8 mb-6 shadow-inner">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <DocumentIcon className="h-8 w-8 text-white" />
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 mb-2">Page 1 of 3</p>
                    <p className="text-sm text-gray-500 dark:text-gray-500">Click "View Full Document" to open in full screen</p>
                  </div>
                </div>
                
                <div className="flex space-x-3">
                  <button
                    onClick={() => setShowBylawModal(true)}
                    className="flex-1 flex items-center justify-center px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 transform hover:scale-105 shadow-lg"
                  >
                    <EyeIcon className="h-4 w-4 mr-2" />
                    View Full Document
                  </button>
                  <a
                    href={getFileUrl('bylaw')}
                    download="bylaw-document.pdf"
                    className="flex items-center justify-center px-4 py-3 bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-lg hover:from-gray-600 hover:to-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all duration-200 transform hover:scale-105 shadow-lg"
                  >
                    <DocumentIcon className="h-4 w-4" />
                  </a>
                </div>
              </div>
            </motion.div>

            {/* Registration Certificate */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6 }}
              className="group"
            >
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/10 dark:to-emerald-900/10 rounded-xl p-6 border border-green-200 dark:border-green-700 hover:shadow-lg transition-all duration-300">
                <div className="flex items-center mb-6">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center mr-4 shadow-lg">
                    <DocumentIcon className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Registration Certificate</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Official registration documentation</p>
                  </div>
                </div>
                
                {/* Desktop: Show PDF preview */}
                <div className="hidden md:block bg-white dark:bg-gray-800 rounded-lg p-4 mb-6 shadow-inner">
                  <PDFViewer
                    fileUrl={getFileUrl('certificate')}
                    fileName="Registration Certificate"
                    maxWidth={500}
                    maxHeight={600}
                    showControls={true}
                    className="w-full"
                  />
                </div>
                
                {/* Mobile: Show document icon only */}
                <div className="md:hidden bg-white dark:bg-gray-800 rounded-lg p-8 mb-6 shadow-inner">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <DocumentIcon className="h-8 w-8 text-white" />
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 mb-2">Page 1 of 12</p>
                    <p className="text-sm text-gray-500 dark:text-gray-500">Click "View Full Document" to open in full screen</p>
                  </div>
                </div>
                
                <div className="flex space-x-3">
                  <button
                    onClick={() => setShowCertModal(true)}
                    className="flex-1 flex items-center justify-center px-4 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-all duration-200 transform hover:scale-105 shadow-lg"
                  >
                    <EyeIcon className="h-4 w-4 mr-2" />
                    View Full Document
                  </button>
                  <a
                    href={getFileUrl('certificate')}
                    download="registration-certificate.pdf"
                    className="flex items-center justify-center px-4 py-3 bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-lg hover:from-gray-600 hover:to-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all duration-200 transform hover:scale-105 shadow-lg"
                  >
                    <DocumentIcon className="h-4 w-4" />
                  </a>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}

      {/* Founding Members */}
      {foundingMembers.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-8"
        >
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 flex items-center">
            <UserGroupIcon className="h-8 w-8 mr-4 text-blue-600 dark:text-blue-400" />
            Founding Members
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.6 + (index * 0.1) }}
                  className="group"
                >
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-600 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
                    <div className="text-center">
                      <div className={`w-16 h-16 bg-gradient-to-br ${gradientClass} rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                        <span className="text-white font-bold text-xl">
                          {member.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                        </span>
                      </div>
                      <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-1">{member.name}</h3>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">{member.role}</p>
                      <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                        <CalendarIcon className="h-3 w-3 mr-1" />
                        {member.year}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Organization Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-xl shadow-lg p-8 text-white"
      >
        <h2 className="text-3xl font-bold mb-8 text-center">Organization Overview</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white/10 backdrop-blur rounded-xl p-6 text-center">
            <CalendarIcon className="h-12 w-12 mx-auto mb-4 text-white/90" />
            <div className="text-3xl font-bold mb-2">{new Date().getFullYear() - (organization?.foundationYear || 1986)}</div>
            <div className="text-white/80 font-medium">Years of Excellence</div>
          </div>
          
          <div className="bg-white/10 backdrop-blur rounded-xl p-6 text-center">
            <BuildingOfficeIcon className="h-12 w-12 mx-auto mb-4 text-white/90" />
            <div className="text-3xl font-bold mb-2">Est</div>
            <div className="text-white/80 font-medium">{organization?.foundationYear || 1986}</div>
          </div>
          
          <div className="bg-white/10 backdrop-blur rounded-xl p-6 text-center">
            <UserGroupIcon className="h-12 w-12 mx-auto mb-4 text-white/90" />
            <div className="text-3xl font-bold mb-2">{foundingMembers.length}</div>
            <div className="text-white/80 font-medium">Founding Members</div>
          </div>
          
          <div className="bg-white/10 backdrop-blur rounded-xl p-6 text-center">
            <GlobeAltIcon className="h-12 w-12 mx-auto mb-4 text-white/90" />
            <div className="text-3xl font-bold mb-2">{socialLinks.length}</div>
            <div className="text-white/80 font-medium">Social Platforms</div>
          </div>
        </div>
      </motion.div>

      {/* Mission & Vision (if available) */}
      {(organization?.description || organization?.mission || organization?.vision) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-8"
        >
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 flex items-center">
            <InformationCircleIcon className="h-8 w-8 mr-4 text-blue-600 dark:text-blue-400" />
            About Our Organization
          </h2>
          
          <div className="space-y-6">
            {organization?.description && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 rounded-xl p-6 border-l-4 border-blue-500">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Our Story</h3>
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{organization.description}</p>
              </div>
            )}
            
            {organization?.mission && (
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/10 dark:to-emerald-900/10 rounded-xl p-6 border-l-4 border-green-500">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Our Mission</h3>
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{organization.mission}</p>
              </div>
            )}
            
            {organization?.vision && (
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/10 dark:to-pink-900/10 rounded-xl p-6 border-l-4 border-purple-500">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Our Vision</h3>
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{organization.vision}</p>
              </div>
            )}
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