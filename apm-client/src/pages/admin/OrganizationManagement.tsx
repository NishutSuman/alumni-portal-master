// src/pages/admin/OrganizationManagement.tsx
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import {
  BuildingOfficeIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon,
  PhotoIcon,
  DocumentIcon,
  GlobeAltIcon,
  EnvelopeIcon,
  PhoneIcon,
  MapPinIcon,
  CalendarIcon,
  UserGroupIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  SparklesIcon,
  ChatBubbleBottomCenterTextIcon
} from '@heroicons/react/24/outline';
import {
  useGetOrganizationAdminQuery,
  useInitializeOrganizationMutation,
  useUpsertOrganizationMutation,
  useUpdateSocialLinksMutation,
  useUploadOrganizationFilesMutation,
  adminApi
} from '@/store/api/adminApi';
import { useDispatch } from 'react-redux';
import { useAuth } from '@/hooks/useAuth';
import LoadingSpinner from '@/components/common/UI/LoadingSpinner';
import PDFViewer from '@/components/common/UI/PDFViewer';
import PDFModal from '@/components/common/UI/PDFModal';

// Validation schemas
const basicInfoSchema = yup.object({
  name: yup.string().required('Organization name is required').min(3, 'Name must be at least 3 characters'),
  shortName: yup.string().required('Short name is required').min(2, 'Short name must be at least 2 characters').max(10, 'Short name cannot exceed 10 characters'),
  foundationYear: yup.number().required('Foundation year is required').min(1800, 'Invalid year').max(new Date().getFullYear(), 'Cannot be future year'),
  officialEmail: yup.string().email('Invalid email').required('Official email is required'),
  officialContactNumber: yup.string().optional(),
  officeAddress: yup.string().optional()
});

const socialLinksSchema = yup.object({
  websiteUrl: yup.string().url('Invalid URL').optional().nullable(),
  facebookUrl: yup.string().url('Invalid URL').optional().nullable(),
  instagramUrl: yup.string().url('Invalid URL').optional().nullable(),
  twitterUrl: yup.string().url('Invalid URL').optional().nullable(),
  linkedinUrl: yup.string().url('Invalid URL').optional().nullable(),
  youtubeUrl: yup.string().url('Invalid URL').optional().nullable()
});

const aboutSchema = yup.object({
  description: yup.string().optional().nullable(),
  mission: yup.string().optional().nullable(),
  vision: yup.string().optional().nullable(),
  presidentMessage: yup.string().optional().nullable(),
  secretaryMessage: yup.string().optional().nullable(),
  treasurerMessage: yup.string().optional().nullable()
});

interface BasicInfoFormData {
  name: string;
  shortName: string;
  foundationYear: number;
  officialEmail: string;
  officialContactNumber?: string;
  officeAddress?: string;
}

interface SocialLinksFormData {
  websiteUrl?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  twitterUrl?: string;
  linkedinUrl?: string;
  youtubeUrl?: string;
}

interface AboutFormData {
  description?: string;
  mission?: string;
  vision?: string;
  presidentMessage?: string;
  secretaryMessage?: string;
  treasurerMessage?: string;
}

interface FoundingMember {
  name: string;
  role: string;
  year: number;
}

const OrganizationManagement = () => {
  const { user: currentUser, auth } = useAuth();
  const dispatch = useDispatch();
  const [activeTab, setActiveTab] = useState<'basic' | 'about' | 'social' | 'members' | 'files'>('basic');
  const [isEditingBasic, setIsEditingBasic] = useState(false);
  const [isEditingSocial, setIsEditingSocial] = useState(false);
  const [isEditingAbout, setIsEditingAbout] = useState(false);
  const [isUpdatingAbout, setIsUpdatingAbout] = useState(false);
  const [foundingMembers, setFoundingMembers] = useState<FoundingMember[]>([]);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [bylawFile, setBylawFile] = useState<File | null>(null);
  const [certFile, setCertFile] = useState<File | null>(null);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const [showBylawModal, setShowBylawModal] = useState(false);
  const [showCertModal, setShowCertModal] = useState(false);

  // API queries and mutations
  const { data: orgData, isLoading, error, refetch } = useGetOrganizationAdminQuery();
  const [initializeOrganization, { isLoading: isInitializing }] = useInitializeOrganizationMutation();
  const [updateOrganization, { isLoading: isUpdatingBasic }] = useUpsertOrganizationMutation();
  const [updateSocialLinks, { isLoading: isUpdatingSocial }] = useUpdateSocialLinksMutation();
  const [uploadOrganizationFiles, { isLoading: isUploadingApi }] = useUploadOrganizationFilesMutation();

  // Computed values
  const isConfigured = !!orgData?.organization;

  // Form setup
  const basicForm = useForm<BasicInfoFormData>({
    resolver: yupResolver(basicInfoSchema),
    defaultValues: {
      name: 'Jawahar Navodaya Vidyalaya Alumni',
      shortName: 'JNV',
      foundationYear: 1986,
      officialEmail: '',
      officialContactNumber: '',
      officeAddress: ''
    }
  });

  const socialForm = useForm<SocialLinksFormData>({
    resolver: yupResolver(socialLinksSchema),
    defaultValues: {
      websiteUrl: '',
      facebookUrl: '',
      instagramUrl: '',
      twitterUrl: '',
      linkedinUrl: '',
      youtubeUrl: ''
    }
  });

  const aboutForm = useForm<AboutFormData>({
    resolver: yupResolver(aboutSchema),
    defaultValues: {
      description: '',
      mission: '',
      vision: '',
      presidentMessage: '',
      secretaryMessage: '',
      treasurerMessage: ''
    }
  });

  // Update form data when organization data is loaded
  useEffect(() => {
    if (isConfigured && orgData.organization) {
      const org = orgData.organization;
      basicForm.reset({
        name: org.name || 'Jawahar Navodaya Vidyalaya Alumni',
        shortName: org.shortName || 'JNV',
        foundationYear: org.foundationYear || 1986,
        officialEmail: org.officialEmail || '',
        officialContactNumber: org.officialContactNumber || '',
        officeAddress: org.officeAddress || ''
      });

      socialForm.reset({
        websiteUrl: org.websiteUrl || '',
        facebookUrl: org.facebookUrl || '',
        instagramUrl: org.instagramUrl || '',
        twitterUrl: org.twitterUrl || '',
        linkedinUrl: org.linkedinUrl || '',
        youtubeUrl: org.youtubeUrl || ''
      });

      aboutForm.reset({
        description: org.description || '',
        mission: org.mission || '',
        vision: org.vision || '',
        presidentMessage: org.presidentMessage || '',
        secretaryMessage: org.secretaryMessage || '',
        treasurerMessage: org.treasurerMessage || ''
      });

      if (org.foundingMembers) {
        try {
          const members = typeof org.foundingMembers === 'string' 
            ? JSON.parse(org.foundingMembers)
            : org.foundingMembers;
          
          if (Array.isArray(members)) {
            // Ensure all members have role property
            const normalizedMembers = members.map(member => ({
              name: member.name || '',
              role: member.role || 'Founder',
              year: member.year || new Date().getFullYear()
            }));
            setFoundingMembers(normalizedMembers);
          } else {
            setFoundingMembers([]);
          }
        } catch {
          setFoundingMembers([]);
        }
      }
    } else {
      // Set default values for new organization
      basicForm.reset({
        name: 'Jawahar Navodaya Vidyalaya Alumni',
        shortName: 'JNV',
        foundationYear: 1986,
        officialEmail: '',
        officialContactNumber: '',
        officeAddress: ''
      });

      socialForm.reset({
        websiteUrl: '',
        facebookUrl: '',
        instagramUrl: '',
        twitterUrl: '',
        linkedinUrl: '',
        youtubeUrl: ''
      });

      aboutForm.reset({
        description: '',
        mission: '',
        vision: '',
        presidentMessage: '',
        secretaryMessage: '',
        treasurerMessage: ''
      });

      setFoundingMembers([]);
    }
  }, [orgData, basicForm, socialForm, aboutForm]);

  // Handle basic info submission
  const handleBasicInfoSubmit = async (data: BasicInfoFormData) => {
    try {
      if (!orgData?.isConfigured) {
        await initializeOrganization(data).unwrap();
      } else {
        await updateOrganization(data).unwrap();
      }
      setIsEditingBasic(false);
      refetch();
    } catch (error: any) {
      console.error('Failed to save organization details:', error);
      alert(error?.data?.message || 'Failed to save organization details');
    }
  };

  // Handle social links submission
  const handleSocialLinksSubmit = async (data: SocialLinksFormData) => {
    try {
      await updateSocialLinks(data).unwrap();
      setIsEditingSocial(false);
      refetch();
    } catch (error: any) {
      console.error('Failed to update social links:', error);
      alert(error?.data?.message || 'Failed to update social links');
    }
  };

  // Handle About section submission
  const handleAboutSubmit = async (data: AboutFormData) => {
    if (!orgData?.organization) {
      alert('Organization data not loaded');
      return;
    }

    setIsUpdatingAbout(true);
    try {
      const org = orgData.organization;
      const basicFormData = basicForm.getValues();

      // Include all organization data along with the about fields
      await updateOrganization({
        name: basicFormData.name,
        shortName: basicFormData.shortName,
        foundationYear: basicFormData.foundationYear,
        officialEmail: basicFormData.officialEmail,
        officialContactNumber: basicFormData.officialContactNumber,
        officeAddress: basicFormData.officeAddress,
        logoUrl: org.logoUrl,
        bylawDocumentUrl: org.bylawDocumentUrl,
        registrationCertUrl: org.registrationCertUrl,
        websiteUrl: org.websiteUrl,
        instagramUrl: org.instagramUrl,
        facebookUrl: org.facebookUrl,
        youtubeUrl: org.youtubeUrl,
        twitterUrl: org.twitterUrl,
        linkedinUrl: org.linkedinUrl,
        foundingMembers: foundingMembers,
        // About section fields
        description: data.description,
        mission: data.mission,
        vision: data.vision,
        presidentMessage: data.presidentMessage,
        secretaryMessage: data.secretaryMessage,
        treasurerMessage: data.treasurerMessage
      }).unwrap();

      setIsEditingAbout(false);
      refetch();
    } catch (error: any) {
      console.error('Failed to update about section:', error);
      alert(error?.data?.message || 'Failed to update organization details');
    } finally {
      setIsUpdatingAbout(false);
    }
  };

  // Add founding member
  const addFoundingMember = () => {
    setFoundingMembers(prev => [...prev, { name: '', role: 'Founder', year: new Date().getFullYear() }]);
  };

  // Remove founding member
  const removeFoundingMember = (index: number) => {
    setFoundingMembers(prev => prev.filter((_, i) => i !== index));
  };

  // Update founding member
  const updateFoundingMember = (index: number, field: keyof FoundingMember, value: string | number) => {
    setFoundingMembers(prev => prev.map((member, i) => 
      i === index ? { ...member, [field]: value } : member
    ));
  };

  // Save founding members
  const saveFoundingMembers = async () => {
    try {
      if (!orgData?.organization) {
        alert('Organization data not loaded');
        return;
      }

      const org = orgData.organization;
      const basicFormData = basicForm.getValues();
      
      await updateOrganization({
        name: basicFormData.name,
        shortName: basicFormData.shortName,
        foundationYear: basicFormData.foundationYear,
        officialEmail: basicFormData.officialEmail,
        officialContactNumber: basicFormData.officialContactNumber,
        officeAddress: basicFormData.officeAddress,
        logoUrl: org.logoUrl,
        bylawDocumentUrl: org.bylawDocumentUrl,
        registrationCertUrl: org.registrationCertUrl,
        websiteUrl: org.websiteUrl,
        instagramUrl: org.instagramUrl,
        facebookUrl: org.facebookUrl,
        youtubeUrl: org.youtubeUrl,
        twitterUrl: org.twitterUrl,
        linkedinUrl: org.linkedinUrl,
        foundingMembers
      }).unwrap();
      refetch();
    } catch (error: any) {
      console.error('Failed to update founding members:', error);
      alert(error?.data?.message || 'Failed to update founding members');
    }
  };

  // Generate proxied file URL for display
  const getFileProxyUrl = (fileType: string) => {
    // Use simple path without token in URL for images (will use cookie auth)
    return `/api/organization/files/${fileType}`;
  };

  // Handle replacing files
  const handleReplaceFile = (fileType: 'logo' | 'bylaw' | 'certificate') => {
    const input = document.createElement('input');
    input.type = 'file';
    
    switch (fileType) {
      case 'logo':
        input.accept = 'image/*';
        break;
      case 'bylaw':
        input.accept = '.pdf,.doc,.docx';
        break;
      case 'certificate':
        input.accept = '.pdf,image/*';
        break;
    }
    
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        switch (fileType) {
          case 'logo':
            setLogoFile(file);
            break;
          case 'bylaw':
            setBylawFile(file);
            break;
          case 'certificate':
            setCertFile(file);
            break;
        }
        // Auto-upload the replacement file
        setTimeout(() => handleFileUpload(), 100);
      }
    };
    
    input.click();
  };

  // Handle deleting files
  const handleDeleteFile = async (fileType: 'logo' | 'bylaw' | 'certificate') => {
    const fileNames = {
      logo: 'Organization Logo',
      bylaw: 'Bylaw Document',
      certificate: 'Registration Certificate'
    };
    
    if (!confirm(`Are you sure you want to delete the ${fileNames[fileType]}? This action cannot be undone.`)) {
      return;
    }

    try {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';
      const response = await fetch(`${apiBaseUrl}/admin/organization/files/delete`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${auth?.token}`,
          'Content-Type': 'application/json',
          'X-Tenant-Code': auth?.tenantCode || ''
        },
        body: JSON.stringify({ fileType })
      });

      const result = await response.json();

      if (response.ok) {
        // Invalidate cache and refresh data
        dispatch(adminApi.util.invalidateTags(['Admin', 'Organization']));
        await refetch();
        alert(`${fileNames[fileType]} deleted successfully`);
      } else {
        alert(result.message || 'Failed to delete file');
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      alert('Failed to delete file. Please try again.');
    }
  };

  // Handle file uploads
  const handleFileUpload = async () => {
    if (!logoFile && !bylawFile && !certFile) {
      alert('Please select at least one file to upload');
      return;
    }

    setIsUploadingFiles(true);
    
    try {
      const formData = new FormData();
      
      if (logoFile) {
        formData.append('logoFile', logoFile);
      }
      
      if (bylawFile) {
        formData.append('bylawFile', bylawFile);
      }
      
      if (certFile) {
        formData.append('certFile', certFile);
      }

      console.log('📤 Uploading files with FormData:', {
        logoFile: logoFile?.name,
        bylawFile: bylawFile?.name, 
        certFile: certFile?.name
      });

      // Use plain fetch instead of RTK Query for FormData uploads
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';
      const response = await fetch(`${apiBaseUrl}/admin/organization/admin/upload/files`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${auth?.token}`,
          'X-Tenant-Code': auth?.tenantCode || ''
          // Don't set Content-Type - let browser set it with boundary
        },
        body: formData
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'Upload failed');
      }
      
      // Clear file states after successful upload
      setLogoFile(null);
      setBylawFile(null);
      setCertFile(null);
      
      // Manually invalidate cache tags since we're using plain fetch instead of RTK Query mutation
      dispatch(adminApi.util.invalidateTags(['Admin', 'Organization']));
      
      // Refresh data - force refresh to get updated file URLs
      await refetch();
      
      // Show success message
      const uploadedFiles = Object.keys(result.uploadedFiles || {});
      alert(`Successfully uploaded ${uploadedFiles.join(', ')} files`);
      
    } catch (error: any) {
      console.error('Failed to upload files:', error);
      alert(error?.message || 'Failed to upload files. Please try again.');
    } finally {
      setIsUploadingFiles(false);
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
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <div className="flex items-center">
            <ExclamationTriangleIcon className="h-6 w-6 text-red-600 dark:text-red-400 mr-3" />
            <div>
              <h3 className="text-lg font-medium text-red-800 dark:text-red-300">
                Failed to load organization data
              </h3>
              <p className="text-red-600 dark:text-red-400 mt-1">
                Please check your connection and try again.
              </p>
            </div>
          </div>
          <button
            onClick={() => refetch()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            Organization Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {isConfigured 
              ? 'Manage your organization details and settings' 
              : 'Initialize your organization profile'
            }
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`px-3 py-1 rounded-full text-xs font-medium ${
            isConfigured
              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
              : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
          }`}>
            {isConfigured ? 'Configured' : 'Not Configured'}
          </div>
        </div>
      </div>

      {/* Alert for non-configured organization */}
      {!isConfigured && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex">
            <InformationCircleIcon className="h-5 w-5 text-blue-500 mt-0.5" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300">
                Organization Setup Required
              </h3>
              <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
                Please configure your organization details to enable all features. This is a one-time setup.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {[
            { id: 'basic', label: 'Basic Information', icon: BuildingOfficeIcon },
            { id: 'about', label: 'About Organization', icon: SparklesIcon },
            { id: 'social', label: 'Social Links', icon: GlobeAltIcon },
            { id: 'members', label: 'Founding Members', icon: UserGroupIcon },
            { id: 'files', label: 'File Uploads', icon: DocumentIcon }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
              }`}
            >
              <tab.icon className="h-5 w-5 mr-2" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {/* Basic Information Tab */}
        {activeTab === 'basic' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6"
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Basic Information
              </h2>
              {isConfigured && (
                <button
                  onClick={() => setIsEditingBasic(!isEditingBasic)}
                  className="flex items-center px-3 py-2 text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 border border-blue-600 dark:border-blue-400 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                >
                  {isEditingBasic ? (
                    <>
                      <XMarkIcon className="h-4 w-4 mr-2" />
                      Cancel
                    </>
                  ) : (
                    <>
                      <PencilIcon className="h-4 w-4 mr-2" />
                      Edit
                    </>
                  )}
                </button>
              )}
            </div>

            <form onSubmit={basicForm.handleSubmit(handleBasicInfoSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Organization Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Organization Name *
                  </label>
                  <input
                    {...basicForm.register('name')}
                    disabled={isConfigured && !isEditingBasic}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="Enter organization name"
                  />
                  {basicForm.formState.errors.name && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                      {basicForm.formState.errors.name.message}
                    </p>
                  )}
                </div>

                {/* Short Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Short Name *
                    <span className="text-xs text-gray-500 ml-1">(Max 10 chars, used for Serial IDs)</span>
                  </label>
                  <input
                    {...basicForm.register('shortName')}
                    disabled={isConfigured && !isEditingBasic}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed uppercase"
                    placeholder="JNV"
                    maxLength={10}
                  />
                  {basicForm.formState.errors.shortName && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                      {basicForm.formState.errors.shortName.message}
                    </p>
                  )}
                </div>

                {/* Foundation Year */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Foundation Year *
                  </label>
                  <input
                    {...basicForm.register('foundationYear')}
                    type="number"
                    disabled={isConfigured && !isEditingBasic}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="1986"
                    min={1800}
                    max={new Date().getFullYear()}
                  />
                  {basicForm.formState.errors.foundationYear && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                      {basicForm.formState.errors.foundationYear.message}
                    </p>
                  )}
                </div>

                {/* Official Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Official Email *
                  </label>
                  <input
                    {...basicForm.register('officialEmail')}
                    type="email"
                    disabled={isConfigured && !isEditingBasic}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="contact@organization.com"
                  />
                  {basicForm.formState.errors.officialEmail && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                      {basicForm.formState.errors.officialEmail.message}
                    </p>
                  )}
                </div>

                {/* Contact Number */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Contact Number
                  </label>
                  <input
                    {...basicForm.register('officialContactNumber')}
                    type="tel"
                    disabled={isConfigured && !isEditingBasic}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="+91-XXXXXXXXXX"
                  />
                </div>
              </div>

              {/* Office Address */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Office Address
                </label>
                <textarea
                  {...basicForm.register('officeAddress')}
                  disabled={isConfigured && !isEditingBasic}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="Enter complete office address"
                />
              </div>

              {/* Submit Button */}
              {(!isConfigured || isEditingBasic) && (
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="submit"
                    disabled={isInitializing || isUpdatingBasic}
                    className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {(isInitializing || isUpdatingBasic) ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        {isConfigured ? 'Updating...' : 'Initializing...'}
                      </>
                    ) : (
                      <>
                        <CheckIcon className="h-4 w-4 mr-2" />
                        {isConfigured ? 'Update Information' : 'Initialize Organization'}
                      </>
                    )}
                  </button>
                </div>
              )}
            </form>
          </motion.div>
        )}

        {/* About Organization Tab */}
        {activeTab === 'about' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6"
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                About Organization
              </h2>
              {isConfigured && (
                <button
                  onClick={() => setIsEditingAbout(!isEditingAbout)}
                  className="flex items-center px-3 py-2 text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 border border-blue-600 dark:border-blue-400 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                >
                  {isEditingAbout ? (
                    <>
                      <XMarkIcon className="h-4 w-4 mr-2" />
                      Cancel
                    </>
                  ) : (
                    <>
                      <PencilIcon className="h-4 w-4 mr-2" />
                      Edit
                    </>
                  )}
                </button>
              )}
            </div>

            <form onSubmit={aboutForm.handleSubmit(handleAboutSubmit)} className="space-y-8">
              {/* Vision, Mission, Description Section */}
              <div className="space-y-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center">
                  <SparklesIcon className="h-5 w-5 mr-2 text-blue-500" />
                  Vision, Mission & Description
                </h3>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Organization Description
                    <span className="text-xs text-gray-500 ml-1">(Tell your story)</span>
                  </label>
                  <textarea
                    {...aboutForm.register('description')}
                    disabled={!isEditingAbout}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="Describe your organization, its history, and what makes it special..."
                  />
                </div>

                {/* Vision */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Vision
                    <span className="text-xs text-gray-500 ml-1">(Long-term aspirations)</span>
                  </label>
                  <textarea
                    {...aboutForm.register('vision')}
                    disabled={!isEditingAbout}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="What does your organization aspire to become or achieve in the future?"
                  />
                </div>

                {/* Mission */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Mission
                    <span className="text-xs text-gray-500 ml-1">(Purpose and values)</span>
                  </label>
                  <textarea
                    {...aboutForm.register('mission')}
                    disabled={!isEditingAbout}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="What is the core purpose and guiding principles of your organization?"
                  />
                </div>
              </div>

              {/* Desk Messages Section */}
              <div className="space-y-6 border-t border-gray-200 dark:border-gray-700 pt-8">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center">
                  <ChatBubbleBottomCenterTextIcon className="h-5 w-5 mr-2 text-purple-500" />
                  Messages from Office Bearers
                </h3>

                {/* President's Message */}
                <div className="bg-gradient-to-r from-blue-50 to-transparent dark:from-blue-900/20 dark:to-transparent p-4 rounded-lg">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    President's Message
                  </label>
                  <textarea
                    {...aboutForm.register('presidentMessage')}
                    disabled={!isEditingAbout}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="A message from the President to the alumni community..."
                  />
                </div>

                {/* Secretary's Message */}
                <div className="bg-gradient-to-r from-green-50 to-transparent dark:from-green-900/20 dark:to-transparent p-4 rounded-lg">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Secretary's Message
                  </label>
                  <textarea
                    {...aboutForm.register('secretaryMessage')}
                    disabled={!isEditingAbout}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="A message from the Secretary to the alumni community..."
                  />
                </div>

                {/* Treasurer's Message */}
                <div className="bg-gradient-to-r from-purple-50 to-transparent dark:from-purple-900/20 dark:to-transparent p-4 rounded-lg">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Treasurer's Message
                  </label>
                  <textarea
                    {...aboutForm.register('treasurerMessage')}
                    disabled={!isEditingAbout}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="A message from the Treasurer to the alumni community..."
                  />
                </div>
              </div>

              {/* Submit Button */}
              {isEditingAbout && (
                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={isUpdatingAbout}
                    className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isUpdatingAbout ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Saving...
                      </>
                    ) : (
                      <>
                        <CheckIcon className="h-4 w-4 mr-2" />
                        Save About Information
                      </>
                    )}
                  </button>
                </div>
              )}
            </form>
          </motion.div>
        )}

        {/* Social Links Tab */}
        {activeTab === 'social' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6"
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Social Media Links
              </h2>
              {isConfigured && (
                <button
                  onClick={() => setIsEditingSocial(!isEditingSocial)}
                  className="flex items-center px-3 py-2 text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 border border-blue-600 dark:border-blue-400 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                >
                  {isEditingSocial ? (
                    <>
                      <XMarkIcon className="h-4 w-4 mr-2" />
                      Cancel
                    </>
                  ) : (
                    <>
                      <PencilIcon className="h-4 w-4 mr-2" />
                      Edit
                    </>
                  )}
                </button>
              )}
            </div>

            <form onSubmit={socialForm.handleSubmit(handleSocialLinksSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Website */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Website URL
                  </label>
                  <input
                    {...socialForm.register('websiteUrl')}
                    type="url"
                    disabled={!isEditingSocial}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="https://www.organization.com"
                  />
                  {socialForm.formState.errors.websiteUrl && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                      {socialForm.formState.errors.websiteUrl.message}
                    </p>
                  )}
                </div>

                {/* Facebook */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Facebook URL
                  </label>
                  <input
                    {...socialForm.register('facebookUrl')}
                    type="url"
                    disabled={!isEditingSocial}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="https://www.facebook.com/organization"
                  />
                </div>

                {/* Instagram */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Instagram URL
                  </label>
                  <input
                    {...socialForm.register('instagramUrl')}
                    type="url"
                    disabled={!isEditingSocial}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="https://www.instagram.com/organization"
                  />
                </div>

                {/* Twitter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Twitter URL
                  </label>
                  <input
                    {...socialForm.register('twitterUrl')}
                    type="url"
                    disabled={!isEditingSocial}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="https://www.twitter.com/organization"
                  />
                </div>

                {/* LinkedIn */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    LinkedIn URL
                  </label>
                  <input
                    {...socialForm.register('linkedinUrl')}
                    type="url"
                    disabled={!isEditingSocial}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="https://www.linkedin.com/company/organization"
                  />
                </div>

                {/* YouTube */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    YouTube URL
                  </label>
                  <input
                    {...socialForm.register('youtubeUrl')}
                    type="url"
                    disabled={!isEditingSocial}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="https://www.youtube.com/channel/organization"
                  />
                </div>
              </div>

              {/* Submit Button */}
              {isEditingSocial && (
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="submit"
                    disabled={isUpdatingSocial}
                    className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isUpdatingSocial ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Updating...
                      </>
                    ) : (
                      <>
                        <CheckIcon className="h-4 w-4 mr-2" />
                        Update Social Links
                      </>
                    )}
                  </button>
                </div>
              )}
            </form>
          </motion.div>
        )}

        {/* Founding Members Tab */}
        {activeTab === 'members' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6"
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Founding Members
              </h2>
              <button
                onClick={addFoundingMember}
                className="flex items-center px-3 py-2 text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 border border-blue-600 dark:border-blue-400 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
              >
                <UserGroupIcon className="h-4 w-4 mr-2" />
                Add Member
              </button>
            </div>

            <div className="space-y-4">
              {foundingMembers.length === 0 ? (
                <div className="text-center py-8">
                  <UserGroupIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    No founding members added
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400">
                    Add founding members to showcase the organization's history.
                  </p>
                </div>
              ) : (
                foundingMembers.map((member, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
                    <div>
                      <input
                        type="text"
                        placeholder="Member name"
                        value={member.name}
                        onChange={(e) => updateFoundingMember(index, 'name', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder="Role"
                        value={member.role}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        placeholder="Year"
                        value={member.year}
                        onChange={(e) => updateFoundingMember(index, 'year', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        min={1800}
                        max={new Date().getFullYear()}
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        onClick={() => removeFoundingMember(index)}
                        className="p-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-md transition-colors"
                      >
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {foundingMembers.length > 0 && (
              <div className="mt-6">
                <button
                  onClick={saveFoundingMembers}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                >
                  <CheckIcon className="h-4 w-4 mr-2" />
                  Save Founding Members
                </button>
              </div>
            )}
          </motion.div>
        )}

        {/* File Uploads Tab */}
        {activeTab === 'files' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6"
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                File Uploads
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Logo Upload */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Organization Logo
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {logoFile && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Selected: {logoFile.name}
                  </p>
                )}
              </div>

              {/* Bylaw Document Upload */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Bylaw Document
                </label>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => setBylawFile(e.target.files?.[0] || null)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {bylawFile && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Selected: {bylawFile.name}
                  </p>
                )}
              </div>

              {/* Certificate Upload */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Registration Certificate
                </label>
                <input
                  type="file"
                  accept=".pdf,image/*"
                  onChange={(e) => setCertFile(e.target.files?.[0] || null)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {certFile && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Selected: {certFile.name}
                  </p>
                )}
              </div>
            </div>

            {/* Upload Button */}
            {(logoFile || bylawFile || certFile) && (
              <div className="mt-6 flex justify-end">
                <button
                  onClick={handleFileUpload}
                  disabled={isUploadingFiles || isUploadingApi}
                  className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {(isUploadingFiles || isUploadingApi) ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  ) : (
                    <DocumentIcon className="h-4 w-4 mr-2" />
                  )}
                  {(isUploadingFiles || isUploadingApi) ? 'Uploading...' : 'Upload Files'}
                </button>
              </div>
            )}

            {/* File Management Section */}
            <div className="mt-8 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Organization Files</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Manage your organization documents and media
                </p>
              </div>
              
              <div className="space-y-4">
                {/* Logo Section */}
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center mb-4">
                        <PhotoIcon className="h-6 w-6 text-blue-600 dark:text-blue-400 mr-3" />
                        <h4 className="text-lg font-medium text-gray-900 dark:text-white">Organization Logo</h4>
                      </div>
                      
                      {orgData?.organization?.logoUrl ? (
                        <div className="space-y-4">
                          {/* Logo Preview */}
                          <div className="w-full max-w-sm mx-auto">
                            <img 
                              src={getFileProxyUrl('logo')}
                              alt="Organization Logo" 
                              className="w-full h-32 object-contain border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                              onError={(e) => {
                                e.currentTarget.src = `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#f3f4f6"/><text x="50" y="50" text-anchor="middle" dy=".3em" fill="#6b7280" font-family="system-ui" font-size="12">LOGO</text></svg>`)}`;
                              }}
                            />
                          </div>
                          
                          {/* Logo Status and Actions */}
                          <div className="text-center space-y-3">
                            <p className="text-sm text-green-800 dark:text-green-200">✓ Logo uploaded and active</p>
                            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded p-3">
                              <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-2">
                                📁 Logo file is already uploaded. Upload is disabled.
                              </p>
                              <p className="text-xs text-yellow-700 dark:text-yellow-300">
                                To upload a new logo, replace or delete the existing one first.
                              </p>
                            </div>
                            <div className="flex justify-center gap-2">
                              <button 
                                onClick={() => handleReplaceFile('logo')}
                                className="px-4 py-2 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700 transition-colors"
                              >
                                Replace Logo
                              </button>
                              <button 
                                onClick={() => handleDeleteFile('logo')}
                                className="px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
                              >
                                Delete Logo
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
                          <PhotoIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                          <p className="text-gray-600 dark:text-gray-400 mb-4 text-lg">No logo uploaded</p>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                setLogoFile(file);
                                setTimeout(() => handleFileUpload(), 100);
                              }
                            }}
                            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bylaw Document Section */}
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center mb-4">
                        <DocumentIcon className="h-6 w-6 text-green-600 dark:text-green-400 mr-3" />
                        <h4 className="text-lg font-medium text-gray-900 dark:text-white">Bylaw Document</h4>
                      </div>
                      
                      {orgData?.organization?.bylawDocumentUrl ? (
                        <div className="space-y-4">
                          {/* PDF Preview */}
                          <div className="w-full flex justify-center">
                            <PDFViewer
                              fileUrl={getFileProxyUrl('bylaw')}
                              fileName="Bylaw Document"
                              maxWidth={600}
                              maxHeight={650}
                              className=""
                            />
                          </div>
                          
                          {/* Document Status and Actions */}
                          <div className="text-center space-y-3">
                            <p className="text-sm text-green-800 dark:text-green-200">✓ Bylaw document uploaded and active</p>
                            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded p-3">
                              <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-2">
                                📁 Bylaw document is already uploaded. Upload is disabled.
                              </p>
                              <p className="text-xs text-yellow-700 dark:text-yellow-300">
                                To upload a new document, replace or delete the existing one first.
                              </p>
                            </div>
                            <div className="flex justify-center gap-2 flex-wrap">
                              <button 
                                onClick={() => setShowBylawModal(true)}
                                className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                              >
                                View Full Document
                              </button>
                              <button 
                                onClick={() => handleReplaceFile('bylaw')}
                                className="px-4 py-2 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700 transition-colors"
                              >
                                Replace Document
                              </button>
                              <button 
                                onClick={() => handleDeleteFile('bylaw')}
                                className="px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
                              >
                                Delete Document
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
                          <DocumentIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                          <p className="text-gray-600 dark:text-gray-400 mb-4 text-lg">No bylaw document uploaded</p>
                          <input
                            type="file"
                            accept=".pdf,.doc,.docx"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                setBylawFile(file);
                                setTimeout(() => handleFileUpload(), 100);
                              }
                            }}
                            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Registration Certificate Section */}
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center mb-4">
                        <DocumentIcon className="h-6 w-6 text-purple-600 dark:text-purple-400 mr-3" />
                        <h4 className="text-lg font-medium text-gray-900 dark:text-white">Registration Certificate</h4>
                      </div>
                      
                      {orgData?.organization?.registrationCertUrl ? (
                        <div className="space-y-4">
                          {/* Certificate Preview */}
                          <div className="w-full flex justify-center">
                            <PDFViewer
                              fileUrl={getFileProxyUrl('certificate')}
                              fileName="Registration Certificate"
                              maxWidth={600}
                              maxHeight={650}
                              className=""
                            />
                          </div>
                          
                          {/* Certificate Status and Actions */}
                          <div className="text-center space-y-3">
                            <p className="text-sm text-green-800 dark:text-green-200">✓ Registration certificate uploaded and active</p>
                            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded p-3">
                              <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-2">
                                📁 Registration certificate is already uploaded. Upload is disabled.
                              </p>
                              <p className="text-xs text-yellow-700 dark:text-yellow-300">
                                To upload a new certificate, replace or delete the existing one first.
                              </p>
                            </div>
                            <div className="flex justify-center gap-2 flex-wrap">
                              <button 
                                onClick={() => setShowCertModal(true)}
                                className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                              >
                                View Full Document
                              </button>
                              <button 
                                onClick={() => handleReplaceFile('certificate')}
                                className="px-4 py-2 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700 transition-colors"
                              >
                                Replace Certificate
                              </button>
                              <button 
                                onClick={() => handleDeleteFile('certificate')}
                                className="px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
                              >
                                Delete Certificate
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
                          <DocumentIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                          <p className="text-gray-600 dark:text-gray-400 mb-4 text-lg">No registration certificate uploaded</p>
                          <input
                            type="file"
                            accept=".pdf,image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                setCertFile(file);
                                setTimeout(() => handleFileUpload(), 100);
                              }
                            }}
                            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* PDF Modals */}
      <PDFModal
        isOpen={showBylawModal}
        onClose={() => setShowBylawModal(false)}
        fileUrl={getFileProxyUrl('bylaw')}
        fileName="Bylaw Document"
        title="Organization Bylaw Document"
      />

      <PDFModal
        isOpen={showCertModal}
        onClose={() => setShowCertModal(false)}
        fileUrl={getFileProxyUrl('certificate')}
        fileName="Registration Certificate"
        title="Organization Registration Certificate"
      />
    </div>
  );
};

export default OrganizationManagement;