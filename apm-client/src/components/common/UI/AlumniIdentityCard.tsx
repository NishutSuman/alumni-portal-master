// src/components/common/UI/AlumniIdentityCard.tsx
import React, { useRef } from 'react'
import { Dialog, DialogPanel, DialogTitle, DialogBackdrop } from '@headlessui/react'
import { XMarkIcon, CheckBadgeIcon, ExclamationTriangleIcon, UserIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline'
import { UserProfile, useGetOrganizationInfoQuery } from '../../../store/api/userApi'
import { getApiUrl } from '@/utils/helpers'

interface AlumniIdentityCardProps {
  isOpen: boolean
  onClose: () => void
  profile: UserProfile
}

export const AlumniIdentityCard: React.FC<AlumniIdentityCardProps> = ({ 
  isOpen, 
  onClose, 
  profile 
}) => {
  const { data: organizationInfo } = useGetOrganizationInfoQuery()
  const cardRef = useRef<HTMLDivElement>(null)
  // Format blood group for display
  const formatBloodGroup = (bloodGroup?: string) => {
    if (!bloodGroup) return 'Not Set'
    return bloodGroup
      .replace('_POSITIVE', '+')
      .replace('_NEGATIVE', '-')
      .replace('_', '')
  }

  // Format membership status
  const getMembershipStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'text-green-600 bg-green-100'
      case 'EXPIRED':
        return 'text-red-600 bg-red-100'
      case 'PENDING':
        return 'text-yellow-600 bg-yellow-100'
      case 'SUSPENDED':
        return 'text-gray-600 bg-gray-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  // Get verification status
  const getVerificationStatus = () => {
    if (profile.isAlumniVerified) {
      return {
        text: 'Verified Alumni',
        color: 'text-green-600',
        icon: CheckBadgeIcon,
        bgColor: 'bg-green-50'
      }
    } else if (profile.pendingVerification) {
      return {
        text: 'Pending Verification',
        color: 'text-yellow-600',
        icon: ExclamationTriangleIcon,
        bgColor: 'bg-yellow-50'
      }
    } else {
      return {
        text: 'Unverified',
        color: 'text-red-600',
        icon: ExclamationTriangleIcon,
        bgColor: 'bg-red-50'
      }
    }
  }

  const verificationStatus = getVerificationStatus()
  const VerificationIcon = verificationStatus.icon

  // Download card as image
  const downloadCardAsImage = async () => {
    if (!cardRef.current) return

    try {
      // Dynamically import html2canvas
      const html2canvas = (await import('html2canvas')).default
      
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null, // Transparent to preserve gradient
        scale: 3, // Higher resolution for better quality
        useCORS: true,
        allowTaint: true,
        logging: false,
        windowWidth: 1920,
        windowHeight: 1080,
        x: 0,
        y: 0,
        scrollX: 0,
        scrollY: 0,
        width: cardRef.current.offsetWidth,
        height: cardRef.current.offsetHeight,
      })
      
      // Create download link
      const link = document.createElement('a')
      link.download = `${profile.fullName}_Alumni_ID_Card.png`
      link.href = canvas.toDataURL('image/png')
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error('Error downloading card:', error)
      alert('Failed to download card. Please try again.')
    }
  }

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <DialogBackdrop className="fixed inset-0 bg-black/30" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="mx-auto max-w-2xl w-full bg-white dark:bg-gray-800 rounded-2xl shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-white">
              Alumni Identity Card
            </DialogTitle>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {/* Identity Card */}
          <div className="p-4">
            <div 
              ref={cardRef}
              className="relative bg-gradient-to-br from-blue-600 via-purple-600 to-blue-800 rounded-xl p-6 text-white shadow-xl overflow-hidden max-w-md mx-auto"
            >
              {/* Background Pattern - Contained within card */}
              <div className="absolute inset-0 opacity-10 overflow-hidden">
                <div className="absolute top-0 right-0 w-20 h-20 bg-white rounded-full -translate-y-4 translate-x-4"></div>
                <div className="absolute bottom-0 left-0 w-16 h-16 bg-white rounded-full translate-y-4 -translate-x-4"></div>
              </div>

              {/* Header */}
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-lg font-bold">ALUMNI ID CARD</h2>
                    <p className="text-blue-100 text-xs">{organizationInfo?.organization?.name || 'Alumni Association'}</p>
                  </div>
                  {organizationInfo?.organization?.logoUrl && (
                    <div className="w-12 h-12 bg-white/20 rounded-lg p-2 flex items-center justify-center">
                      <img
                        src={getApiUrl("/api/organization/files/logo")}
                        alt="Organization Logo"
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none'
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Profile Section - Horizontal Layout */}
                <div className="flex items-center gap-4 mb-6">
                  {/* Profile Image */}
                  <div className="flex-shrink-0">
                    <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm border-2 border-white/50 flex items-center justify-center overflow-hidden">
                      {profile.profileImage ? (
                        <img
                          src={getApiUrl(`/api/users/profile-picture/${profile.id}?t=${Date.now()}`)}
                          alt={profile.fullName}
                          className="w-full h-full object-cover rounded-full"
                          onError={(e) => {
                            const img = e.target as HTMLImageElement;
                            img.style.display = 'none';
                            const parent = img.parentElement;
                            if (parent && !parent.querySelector('.fallback-icon')) {
                              const iconDiv = document.createElement('div');
                              iconDiv.className = 'fallback-icon';
                              iconDiv.innerHTML = `
                                <svg class="w-8 h-8 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                                </svg>
                              `;
                              parent.appendChild(iconDiv);
                            }
                          }}
                        />
                      ) : (
                        <UserIcon className="w-8 h-8 text-white/70" />
                      )}
                    </div>
                  </div>

                  {/* Profile Details */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-bold mb-1 truncate">{profile.fullName}</h3>
                    
                    {/* Verification Status */}
                    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold mb-2 ${verificationStatus.bgColor} ${verificationStatus.color}`}>
                      <VerificationIcon className="w-3 h-3" />
                      {verificationStatus.text}
                    </div>

                    {/* Serial ID */}
                    <div className="text-sm">
                      <span className="text-blue-200">ID:</span> 
                      <span className="font-semibold ml-1">{profile.serialId || 'Not Assigned'}</span>
                    </div>
                  </div>
                </div>

                {/* Compact Information Row */}
                <div className="flex items-center justify-between text-center mb-4">
                  <div className="flex-1">
                    <p className="text-blue-100 text-xs uppercase tracking-wider">Blood Group</p>
                    <p className="font-bold text-sm">{formatBloodGroup(profile.bloodGroup)}</p>
                  </div>
                  <div className="w-px h-8 bg-white/20 mx-3"></div>
                  <div className="flex-1">
                    <p className="text-blue-100 text-xs uppercase tracking-wider">Membership</p>
                    <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${getMembershipStatusColor(profile.membershipStatus)}`}>
                      {profile.membershipStatus.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                {/* Footer */}
                <div className="text-center pt-3 border-t border-white/20">
                  <p className="text-blue-100 text-xs">
                    Generated on {new Date().toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={downloadCardAsImage}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
              Download PNG
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
            >
              Close
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}

export default AlumniIdentityCard