import { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.alumni.guild.mvp',
  appName: 'GUILD - Alumni Network',
  webDir: 'dist',
  server: {
    androidScheme: 'http'
  },
  plugins: {
    // Splash Screen Configuration
    SplashScreen: {
      launchShowDuration: 3000,
      launchAutoHide: true,
      launchFadeOutDuration: 500,
      backgroundColor: '#3b82f6',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      androidSpinnerStyle: 'large',
      iosSpinnerStyle: 'small',
      spinnerColor: '#ffffff',
      splashFullScreen: true,
      splashImmersive: true,
    },

    // Push Notifications
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },

    // Local Notifications  
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#3b82f6',
      sound: 'beep.wav',
    },

    // Camera Configuration
    Camera: {
      permissions: ['camera', 'photos', 'gallery']
    },

    // File System
    Filesystem: {
      iosCopyBundledWebAssetsToDocuments: false,
      iosDocumentsPath: 'Documents',
      androidPublicDirectory: 'DOCUMENTS',
    },

    // Status Bar
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#3b82f6',
      overlaysWebView: false,
    },

    // Keyboard
    Keyboard: {
      resize: 'body',
      style: 'DARK',
      resizeOnFullScreen: true,
    },

    // Haptics
    Haptics: {
      impactLightIntensity: 0.5,
      impactMediumIntensity: 0.7,
      impactHeavyIntensity: 0.9,
    },

    // Device Info
    Device: {},

    // Network
    Network: {},

    // App State
    App: {
      launchUrl: '',
      iosCustomApplicationProtocol: 'guild',
      androidCustomApplicationProtocol: 'guild',
    },

    // Browser
    Browser: {
      presentationStyle: 'popover',
      toolbarColor: '#3b82f6',
    },

    // Share
    Share: {},

    // Toast
    Toast: {
      duration: 'short',
    },

    // Clipboard
    Clipboard: {},

    // Geolocation
    Geolocation: {
      permissions: ['location', 'coarseLocation'],
    },
  },

  // iOS specific configuration
  ios: {
    contentInset: 'automatic',
    allowsLinkPreview: false,
    handleApplicationNotifications: false,
    scheme: 'GUILD',
  },

  // Android specific configuration
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true,
    appendUserAgent: 'GUILD-Alumni-App',
    backgroundColor: '#3b82f6',
    // Custom intent filters for deep linking
    
  },

  // Build configuration
  cordova: {},

  // Server configuration for development
  // Uncomment for development with live reload
  /*
  server: {
    url: 'http://192.168.1.100:5173',
    cleartext: true
  }
  */
}

export default config