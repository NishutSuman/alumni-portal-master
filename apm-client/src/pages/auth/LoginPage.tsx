// src/pages/auth/LoginPage.tsx
// Multi-step login: Email -> Organization Selection -> Password
import React, { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { selectIsDark } from '@/store/slices/themeSlice'
import { loginSuccess } from '@/store/slices/authSlice'
import ThemeToggle from '@/components/common/UI/ThemeToggle'
import { ArrowLeftIcon, BuildingOfficeIcon, ArrowPathIcon, CheckIcon, EnvelopeIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'
import {
  useRequestReactivationMutation,
  useVerifyReactivationMutation,
  useGetOrganizationsByEmailMutation,
  useLazyGetAllOrganizationsQuery,
  useLazyGetOrganizationByCodeQuery,
  type Organization
} from '@/store/api/authApi'
import { getApiBaseUrl, getOrganizationByCode } from '@/config/organizations'
import toast from 'react-hot-toast'

// Helper to get organization logo URL (uses proxy for R2 files)
const getOrgLogoUrl = (org: Organization): string | null => {
  // If logoProxyUrl is available, use it with the API base URL
  if (org.logoProxyUrl) {
    const baseUrl = getApiBaseUrl()
    // Remove /api from baseUrl if present since logoProxyUrl starts with /api
    const serverUrl = baseUrl.replace(/\/api$/, '')
    return `${serverUrl}${org.logoProxyUrl}`
  }
  // Fallback to direct URL if no proxy URL (should not happen with R2)
  return org.logoUrl || null
}

// Login flow steps
type LoginStep = 'email' | 'organization' | 'password'

const LoginPage = () => {
  // Form state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)

  // Multi-step flow state
  const [currentStep, setCurrentStep] = useState<LoginStep>('email')
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null)
  const [isNewUser, setIsNewUser] = useState(false) // true if email not found in any org

  // Loading states
  const [isCheckingEmail, setIsCheckingEmail] = useState(false)

  // Manual org code entry
  const [manualOrgCode, setManualOrgCode] = useState('')
  const [isCheckingOrgCode, setIsCheckingOrgCode] = useState(false)

  // Password visibility toggle
  const [showPassword, setShowPassword] = useState(false)

  // Auth hook
  const { login, isLoading, error } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const isDark = useSelector(selectIsDark)

  // Reactivation state
  const [showReactivation, setShowReactivation] = useState(false)
  const [reactivationEmail, setReactivationEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)

  // API mutations
  const [getOrganizationsByEmail] = useGetOrganizationsByEmailMutation()
  const [getAllOrganizations] = useLazyGetAllOrganizationsQuery()
  const [getOrganizationByCodeQuery] = useLazyGetOrganizationByCodeQuery()
  const [requestReactivation, { isLoading: isRequestingOtp }] = useRequestReactivationMutation()
  const [verifyReactivation, { isLoading: isVerifying }] = useVerifyReactivationMutation()

  // Check for email verification success
  useEffect(() => {
    if (location.state?.emailVerified) {
      toast.success(location.state.message || 'Email verified successfully! You can now sign in.')
      if (location.state.email) {
        setEmail(location.state.email)
      }
    }
  }, [location.state])

  // Step 1: Handle email submission - check which orgs have this email
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email.trim()) {
      toast.error('Please enter your email address')
      return
    }

    setIsCheckingEmail(true)

    try {
      // Check orgs for this email
      const result = await getOrganizationsByEmail({ email: email.trim().toLowerCase() }).unwrap()

      if (result.success && result.data.organizations.length > 0) {
        // User exists in 1+ orgs - show those orgs
        setOrganizations(result.data.organizations)
        setIsNewUser(false)

        // If only 1 org, auto-select it
        if (result.data.organizations.length === 1) {
          setSelectedOrg(result.data.organizations[0])
          setCurrentStep('password')
        } else {
          setCurrentStep('organization')
        }
      } else {
        // Email not found - fetch all orgs for new user registration
        const allOrgsResult = await getAllOrganizations().unwrap()

        if (allOrgsResult.success && allOrgsResult.data.organizations.length > 0) {
          setOrganizations(allOrgsResult.data.organizations)
          setIsNewUser(true)
          setCurrentStep('organization')
        } else {
          toast.error('No organizations available. Please contact support.')
        }
      }
    } catch (err) {
      console.error('Error checking email:', err)
      toast.error('Failed to check email. Please try again.')
    } finally {
      setIsCheckingEmail(false)
    }
  }

  // Step 2: Handle organization selection
  const handleOrgSelect = (org: Organization) => {
    setSelectedOrg(org)

    // CRITICAL: Save tenant code to localStorage for multi-tenant API calls
    // This is read by apiSlice to set X-Tenant-Code header on all requests
    localStorage.setItem('guild-org-code', org.tenantCode)

    if (isNewUser) {
      // Redirect to registration with selected org
      navigate('/auth/register', {
        state: {
          email,
          organizationId: org.id,
          organizationName: org.name,
          tenantCode: org.tenantCode
        }
      })
    } else {
      // Continue to password step
      setCurrentStep('password')
    }
  }

  // Handle manual org code entry (for developers and power users)
  const handleManualOrgCode = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!manualOrgCode.trim()) {
      toast.error('Please enter an organization code')
      return
    }

    const code = manualOrgCode.trim().toUpperCase()
    setIsCheckingOrgCode(true)

    try {
      // Check if it's LOCAL-DEV - set API URL first before making request
      const localOrg = getOrganizationByCode(code)
      if (localOrg) {
        // Set the API URL for local dev before querying
        localStorage.setItem('guild-api-url', localOrg.apiUrl)
        localStorage.setItem('guild-org-code', localOrg.code)
        localStorage.setItem('guild-org-name', localOrg.name)
      }

      // Always query the API to get the real organization ID
      const result = await getOrganizationByCodeQuery(code).unwrap()

      if (result.success && result.data.organization) {
        const org = result.data.organization

        // Save tenant code
        localStorage.setItem('guild-org-code', org.tenantCode)

        setSelectedOrg(org)

        if (isNewUser) {
          // Redirect to registration
          navigate('/auth/register', {
            state: {
              email,
              organizationId: org.id,
              organizationName: org.name,
              tenantCode: org.tenantCode
            }
          })
        } else {
          setCurrentStep('password')
        }

        toast.success(`Connected to ${org.name}`)
      } else {
        toast.error('Organization not found. Please check the code and try again.')
      }
    } catch (err) {
      console.error('Error checking org code:', err)
      toast.error('Invalid organization code. Please check and try again.')
    } finally {
      setIsCheckingOrgCode(false)
    }
  }

  // Step 3: Handle final login submission
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedOrg) {
      toast.error('Please select an organization first')
      setCurrentStep('organization')
      return
    }

    const result = await login({
      email: email.trim().toLowerCase(),
      password,
      rememberMe,
      organizationId: selectedOrg.id
    })

    if (result && result.success) {
      // Login successful - navigation handled by auth hook
    } else {
      // Check if account is deactivated
      if (result?.error?.includes('deactivated')) {
        setReactivationEmail(email)
        setShowReactivation(true)
      }
    }
  }

  // Go back to previous step
  const handleBack = () => {
    if (currentStep === 'password') {
      // If there's only 1 org, go back to email step
      if (organizations.length === 1) {
        setCurrentStep('email')
        setSelectedOrg(null)
        setOrganizations([])
      } else {
        setCurrentStep('organization')
      }
      setPassword('')
    } else if (currentStep === 'organization') {
      setCurrentStep('email')
      setSelectedOrg(null)
      setOrganizations([])
      setIsNewUser(false)
    }
  }

  // Reset to email step
  const handleStartOver = () => {
    setCurrentStep('email')
    setSelectedOrg(null)
    setOrganizations([])
    setPassword('')
    setIsNewUser(false)
    // Clear tenant code when starting over
    localStorage.removeItem('guild-org-code')
  }

  // Handle reactivation request
  const handleRequestReactivation = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await requestReactivation({ email: reactivationEmail }).unwrap()
      setOtpSent(true)
      toast.success('Reactivation code sent to your email!')
    } catch (err: unknown) {
      const error = err as { data?: { message?: string } }
      toast.error(error.data?.message || 'Failed to send reactivation code')
    }
  }

  // Handle OTP verification
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const result = await verifyReactivation({
        email: reactivationEmail,
        otp,
        organizationId: selectedOrg?.id
      }).unwrap()

      if (result.data?.tokens && result.data?.user) {
        dispatch(loginSuccess({
          user: result.data.user,
          token: result.data.tokens.accessToken,
          refreshToken: result.data.tokens.refreshToken
        }))
        toast.success('Account reactivated! Welcome back!')
        navigate('/user/dashboard')
      }
    } catch (err: unknown) {
      const error = err as { data?: { message?: string } }
      toast.error(error.data?.message || 'Invalid or expired OTP')
    }
  }

  // Common Navbar Component
  const Navbar = () => (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b border-gray-200 dark:border-gray-700">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center h-10">
            <img
              src={isDark ? '/brand/guild-logo-white.png' : '/brand/guild-logo.png'}
              alt="GUILD"
              className="h-full w-auto object-contain"
            />
          </Link>
          <ThemeToggle />
        </div>
      </div>
    </nav>
  )

  // Reactivation Modal/Panel
  if (showReactivation) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-blue-900/20 dark:to-purple-900/20">
        <Navbar />

        <div className="min-h-screen flex items-center justify-center pt-16 px-4">
          <div className="max-w-md w-full">
            <button
              onClick={() => {
                setShowReactivation(false)
                setOtpSent(false)
                setOtp('')
              }}
              className="flex items-center space-x-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6 transition-colors group"
            >
              <ArrowLeftIcon className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
              <span>Back to Login</span>
            </button>

            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 md:p-10">
              <div className="text-center mb-8">
                <div className="flex justify-center mb-4">
                  <div className="p-4 bg-green-100 dark:bg-green-900/30 rounded-full">
                    <ArrowPathIcon className="w-10 h-10 text-green-600 dark:text-green-400" />
                  </div>
                </div>
                <h1 className="text-2xl md:text-3xl font-bold mb-2">
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-blue-600">
                    Reactivate Account
                  </span>
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                  {otpSent ? 'Enter the code sent to your email' : 'We\'ll send you a code to reactivate your account'}
                </p>
              </div>

              {!otpSent ? (
                <form onSubmit={handleRequestReactivation} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={reactivationEmail}
                      onChange={(e) => setReactivationEmail(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                      placeholder="Enter your email"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isRequestingOtp}
                    className="w-full py-4 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-xl font-semibold text-lg hover:shadow-xl hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  >
                    {isRequestingOtp ? 'Sending Code...' : 'Send Reactivation Code'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Enter 6-Digit Code
                    </label>
                    <input
                      type="text"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="w-full px-4 py-4 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all text-center text-2xl tracking-widest font-mono"
                      placeholder="000000"
                      maxLength={6}
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isVerifying || otp.length !== 6}
                    className="w-full py-4 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-xl font-semibold text-lg hover:shadow-xl hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  >
                    {isVerifying ? 'Verifying...' : 'Reactivate Account'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setOtpSent(false)
                      setOtp('')
                    }}
                    className="w-full py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                  >
                    Didn't receive code? Try again
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Step indicators
  const StepIndicator = () => (
    <div className="flex items-center justify-center mb-6 space-x-2">
      <div className={`w-3 h-3 rounded-full transition-all ${currentStep === 'email' ? 'bg-blue-600 scale-125' : 'bg-blue-600'}`} />
      <div className={`w-8 h-0.5 ${currentStep !== 'email' ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`} />
      <div className={`w-3 h-3 rounded-full transition-all ${currentStep === 'organization' ? 'bg-blue-600 scale-125' : currentStep === 'password' ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`} />
      <div className={`w-8 h-0.5 ${currentStep === 'password' ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`} />
      <div className={`w-3 h-3 rounded-full transition-all ${currentStep === 'password' ? 'bg-blue-600 scale-125' : 'bg-gray-300 dark:bg-gray-600'}`} />
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-blue-900/20 dark:to-purple-900/20">
      <Navbar />

      <div className="min-h-screen flex items-center justify-center pt-16 px-4">
        <div className="max-w-md w-full">
          {/* Back Button */}
          <button
            onClick={currentStep === 'email' ? () => navigate('/') : handleBack}
            className="flex items-center space-x-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6 transition-colors group"
          >
            <ArrowLeftIcon className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span>{currentStep === 'email' ? 'Back to Home' : 'Back'}</span>
          </button>

          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 md:p-10">
            {/* Step Indicator */}
            <StepIndicator />

            {/* STEP 1: Email Entry */}
            {currentStep === 'email' && (
              <>
                <div className="text-center mb-8">
                  <div className="flex justify-center mb-4">
                    <div className="p-4 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                      <EnvelopeIcon className="w-10 h-10 text-blue-600 dark:text-blue-400" />
                    </div>
                  </div>
                  <h1 className="text-2xl md:text-3xl font-bold mb-2">
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600">
                      Welcome to GUILD
                    </span>
                  </h1>
                  <p className="text-gray-600 dark:text-gray-400">Enter your email to continue</p>
                </div>

                {/* Success message for email verification */}
                {location.state?.emailVerified && (
                  <div className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-200 p-4 rounded-xl mb-6 border border-green-200 dark:border-green-800">
                    <div className="flex items-center">
                      <CheckIcon className="w-5 h-5 mr-2" />
                      {location.state.message || 'Email verified successfully! You can now sign in.'}
                    </div>
                  </div>
                )}

                <form onSubmit={handleEmailSubmit} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="Enter your email"
                      required
                      disabled={isCheckingEmail}
                      autoFocus
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isCheckingEmail || !email.trim()}
                    className="w-full py-4 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white rounded-xl font-semibold text-lg hover:shadow-xl hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  >
                    {isCheckingEmail ? 'Checking...' : 'Continue'}
                  </button>
                </form>

                <div className="mt-6 text-center">
                  <p className="text-gray-600 dark:text-gray-400">
                    New to GUILD?{' '}
                    <Link
                      to="/auth/register"
                      className="font-semibold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transition-all"
                    >
                      Create an Account
                    </Link>
                  </p>
                </div>
              </>
            )}

            {/* STEP 2: Organization Selection */}
            {currentStep === 'organization' && (
              <>
                <div className="text-center mb-8">
                  <div className="flex justify-center mb-4">
                    <div className="p-4 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                      <BuildingOfficeIcon className="w-10 h-10 text-blue-600 dark:text-blue-400" />
                    </div>
                  </div>
                  <h1 className="text-2xl md:text-3xl font-bold mb-2">
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                      {isNewUser ? 'Select Your Organization' : 'Select Organization'}
                    </span>
                  </h1>
                  <p className="text-gray-600 dark:text-gray-400">
                    {isNewUser
                      ? 'Choose an organization to register with'
                      : 'Select the organization you want to sign in to'}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                    {email}
                  </p>
                </div>

                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {organizations.map((org) => {
                    const logoUrl = getOrgLogoUrl(org)
                    return (
                      <button
                        key={org.id}
                        onClick={() => handleOrgSelect(org)}
                        className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all hover:border-blue-300 dark:hover:border-blue-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                          selectedOrg?.id === org.id
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-200 dark:border-gray-700'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          {logoUrl ? (
                            <img
                              src={logoUrl}
                              alt={org.name}
                              className="w-12 h-12 rounded-lg object-cover"
                              onError={(e) => {
                                // Hide broken image and show fallback
                                (e.target as HTMLImageElement).style.display = 'none'
                                const nextSibling = (e.target as HTMLImageElement).nextElementSibling
                                if (nextSibling) nextSibling.classList.remove('hidden')
                              }}
                            />
                          ) : null}
                          <div className={`w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center ${logoUrl ? 'hidden' : ''}`}>
                            <BuildingOfficeIcon className="w-6 h-6 text-white" />
                          </div>
                          <div className="text-left">
                            <p className="font-semibold text-gray-900 dark:text-white">{org.name}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{org.tenantCode}</p>
                          </div>
                        </div>
                        <CheckIcon className={`w-6 h-6 ${selectedOrg?.id === org.id ? 'text-blue-500' : 'text-transparent'}`} />
                      </button>
                    )
                  })}
                </div>

                {/* Manual Org Code Entry */}
                <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 text-center">
                    Or enter organization code directly
                  </p>
                  <form onSubmit={handleManualOrgCode} className="flex space-x-2">
                    <input
                      type="text"
                      value={manualOrgCode}
                      onChange={(e) => setManualOrgCode(e.target.value.toUpperCase())}
                      className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm uppercase"
                      placeholder="Enter organization code"
                      disabled={isCheckingOrgCode}
                    />
                    <button
                      type="submit"
                      disabled={isCheckingOrgCode || !manualOrgCode.trim()}
                      className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-medium text-sm hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isCheckingOrgCode ? '...' : 'Go'}
                    </button>
                  </form>
                </div>

                {isNewUser && (
                  <p className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
                    Don't see your organization?{' '}
                    <a href="mailto:support@guild.com" className="text-blue-600 hover:underline">
                      Contact support
                    </a>
                  </p>
                )}

                <button
                  onClick={handleStartOver}
                  className="mt-4 w-full py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors text-sm"
                >
                  Use a different email
                </button>
              </>
            )}

            {/* STEP 3: Password Entry */}
            {currentStep === 'password' && selectedOrg && (
              <>
                <div className="text-center mb-8">
                  <div className="flex justify-center mb-4">
                    {(() => {
                      const logoUrl = getOrgLogoUrl(selectedOrg)
                      return logoUrl ? (
                        <img
                          src={logoUrl}
                          alt={selectedOrg.name}
                          className="w-16 h-16 rounded-xl object-cover shadow-lg"
                          onError={(e) => {
                            // Hide broken image and show fallback
                            (e.target as HTMLImageElement).style.display = 'none'
                            const nextSibling = (e.target as HTMLImageElement).nextElementSibling
                            if (nextSibling) nextSibling.classList.remove('hidden')
                          }}
                        />
                      ) : null
                    })()}
                    <div className={`w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg ${getOrgLogoUrl(selectedOrg) ? 'hidden' : ''}`}>
                      <BuildingOfficeIcon className="w-8 h-8 text-white" />
                    </div>
                  </div>
                  <h1 className="text-2xl md:text-3xl font-bold mb-2">
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600">
                      Welcome Back
                    </span>
                  </h1>
                  <p className="text-gray-600 dark:text-gray-400">{selectedOrg.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">{email}</p>
                </div>

                {error && (
                  <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-200 p-4 rounded-xl mb-6 border border-red-200 dark:border-red-800">
                    <div>{error}</div>
                    {error.includes('deactivated') && (
                      <button
                        onClick={() => {
                          setReactivationEmail(email)
                          setShowReactivation(true)
                        }}
                        className="mt-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        Reactivate your account
                      </button>
                    )}
                  </div>
                )}

                <form onSubmit={handleLoginSubmit} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-4 py-3 pr-12 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        placeholder="Enter your password"
                        required
                        disabled={isLoading}
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none transition-colors"
                        tabIndex={-1}
                      >
                        {showPassword ? (
                          <EyeSlashIcon className="w-5 h-5" />
                        ) : (
                          <EyeIcon className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        disabled={isLoading}
                      />
                      <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Remember me</span>
                    </label>
                    <Link
                      to="/auth/forgot-password"
                      state={{ email, organizationId: selectedOrg.id }}
                      className="text-sm font-medium text-blue-600 hover:text-blue-500 transition-colors"
                    >
                      Forgot password?
                    </Link>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-4 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white rounded-xl font-semibold text-lg hover:shadow-xl hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  >
                    {isLoading ? 'Signing in...' : 'Sign In'}
                  </button>
                </form>

                {organizations.length > 1 && (
                  <button
                    onClick={() => setCurrentStep('organization')}
                    className="mt-4 w-full py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors text-sm"
                  >
                    Sign in to a different organization
                  </button>
                )}
              </>
            )}
          </div>

          {/* Company Credit */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Powered by{' '}
              <span className="font-semibold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                Digikite
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
