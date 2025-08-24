// test-phase6-feedback-system.js
// Comprehensive testing script for Phase 6 Feedback System

const axios = require('axios');
const colors = require('colors');

// Configuration
const CONFIG = {
  baseURL: 'http://localhost:3000/api',
  timeout: 10000,
  adminToken: '', // To be set after login
  userToken: '', // To be set after login
  testEventId: '', // To be set during testing
  testFeedbackFormId: '', // To be set during testing
  testFieldIds: [] // To be set during testing
};

// Test statistics
let testStats = {
  total: 0,
  passed: 0,
  failed: 0,
  skipped: 0
};

// Utility functions
const log = (message, type = 'info') => {
  const timestamp = new Date().toISOString();
  switch(type) {
    case 'success': console.log(`[${timestamp}] ✅ ${message}`.green); break;
    case 'error': console.log(`[${timestamp}] ❌ ${message}`.red); break;
    case 'warning': console.log(`[${timestamp}] ⚠️  ${message}`.yellow); break;
    case 'info': console.log(`[${timestamp}] ℹ️  ${message}`.blue); break;
    default: console.log(`[${timestamp}] ${message}`);
  }
};

const makeRequest = async (method, url, data = null, token = null) => {
  try {
    const config = {
      method,
      url: `${CONFIG.baseURL}${url}`,
      timeout: CONFIG.timeout,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data || error.message,
      status: error.response?.status || 500
    };
  }
};

const runTest = async (testName, testFunction) => {
  testStats.total++;
  log(`Running: ${testName}`, 'info');
  
  try {
    const result = await testFunction();
    if (result.success) {
      testStats.passed++;
      log(`PASSED: ${testName}`, 'success');
      return true;
    } else {
      testStats.failed++;
      log(`FAILED: ${testName} - ${result.error}`, 'error');
      return false;
    }
  } catch (error) {
    testStats.failed++;
    log(`ERROR: ${testName} - ${error.message}`, 'error');
    return false;
  }
};

// =============================================================================
// AUTHENTICATION TESTS
// =============================================================================

const setupAuthentication = async () => {
  log('Setting up authentication...', 'info');
  
  // Login as admin
  const adminLogin = await makeRequest('POST', '/auth/login', {
    email: 'admin@example.com', // Adjust based on your test data
    password: 'your-admin-password'
  });
  
  if (adminLogin.success) {
    CONFIG.adminToken = adminLogin.data.data.token;
    log('Admin authentication successful', 'success');
  } else {
    throw new Error('Admin login failed');
  }
  
  // Login as regular user
  const userLogin = await makeRequest('POST', '/auth/login', {
    email: 'user@example.com', // Adjust based on your test data
    password: 'your-user-password'
  });
  
  if (userLogin.success) {
    CONFIG.userToken = userLogin.data.data.token;
    log('User authentication successful', 'success');
  } else {
    log('User login failed, will test with admin only', 'warning');
  }
};

// =============================================================================
// SETUP TESTS
// =============================================================================

const setupTestEvent = async () => {
  return await runTest('Setup Test Event', async () => {
    // Get first available event or create one
    const eventsResponse = await makeRequest('GET', '/events', null, CONFIG.adminToken);
    
    if (eventsResponse.success && eventsResponse.data.data.length > 0) {
      CONFIG.testEventId = eventsResponse.data.data[0].id;
      return { success: true };
    }
    
    // Create a test event if none exist
    const eventData = {
      title: 'Test Event for Feedback',
      description: 'This is a test event for feedback system testing',
      categoryId: 'some-category-id', // Adjust based on your test data
      eventDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
      venue: 'Test Venue',
      maxCapacity: 100,
      eventMode: 'PHYSICAL',
      hasRegistration: true
    };
    
    const createResponse = await makeRequest('POST', '/events', eventData, CONFIG.adminToken);
    
    if (createResponse.success) {
      CONFIG.testEventId = createResponse.data.data.id;
      return { success: true };
    }
    
    return { success: false, error: 'Failed to setup test event' };
  });
};

// =============================================================================
// FEEDBACK FORM MANAGEMENT TESTS
// =============================================================================

const testCreateFeedbackForm = async () => {
  return await runTest('Create Feedback Form', async () => {
    const formData = {
      title: 'Test Feedback Form',
      description: 'This is a test feedback form for our event',
      allowAnonymous: true,
      showAfterEvent: true,
      autoSendReminders: true,
      reminderDelayHours: 24,
      closeAfterHours: 168,
      completionMessage: 'Thank you for your valuable feedback!'
    };
    
    const response = await makeRequest(
      'POST', 
      `/events/${CONFIG.testEventId}/feedback/form`,
      formData,
      CONFIG.adminToken
    );
    
    if (response.success) {
      CONFIG.testFeedbackFormId = response.data.data.id;
      return { success: true };
    }
    
    return { success: false, error: response.error };
  });
};

const testGetFeedbackForm = async () => {
  return await runTest('Get Feedback Form', async () => {
    const response = await makeRequest(
      'GET',
      `/events/${CONFIG.testEventId}/feedback/form`,
      null,
      CONFIG.adminToken
    );
    
    if (response.success && response.data.data.id === CONFIG.testFeedbackFormId) {
      return { success: true };
    }
    
    return { success: false, error: response.error || 'Form not found or incorrect data' };
  });
};

const testAddFeedbackFields = async () => {
  return await runTest('Add Feedback Fields', async () => {
    const fields = [
      {
        fieldName: 'overall_rating',
        fieldLabel: 'Overall Event Rating',
        fieldType: 'RATING',
        minValue: 1,
        maxValue: 5,
        stepValue: 1,
        ratingStyle: 'stars',
        isRequired: true,
        helpText: 'Please rate the overall event experience'
      },
      {
        fieldName: 'event_content',
        fieldLabel: 'How would you rate the event content?',
        fieldType: 'LIKERT',
        isRequired: true
      },
      {
        fieldName: 'favorite_part',
        fieldLabel: 'What was your favorite part of the event?',
        fieldType: 'TEXTAREA',
        isRequired: false,
        placeholder: 'Please describe what you liked most...'
      },
      {
        fieldName: 'event_type_preference',
        fieldLabel: 'What type of events would you like to see more of?',
        fieldType: 'CHECKBOX',
        options: ['Technical Workshops', 'Networking Events', 'Career Guidance', 'Alumni Meetups', 'Industry Talks'],
        isRequired: false
      },
      {
        fieldName: 'recommendation',
        fieldLabel: 'Would you recommend this event to others?',
        fieldType: 'RADIO',
        options: ['Definitely Yes', 'Probably Yes', 'Maybe', 'Probably No', 'Definitely No'],
        isRequired: true
      }
    ];
    
    let allSuccess = true;
    const createdFields = [];
    
    for (const field of fields) {
      const response = await makeRequest(
        'POST',
        `/events/${CONFIG.testEventId}/feedback/fields`,
        field,
        CONFIG.adminToken
      );
      
      if (response.success) {
        createdFields.push(response.data.data.id);
      } else {
        allSuccess = false;
        break;
      }
    }
    
    if (allSuccess) {
      CONFIG.testFieldIds = createdFields;
      return { success: true };
    }
    
    return { success: false, error: 'Failed to create all fields' };
  });
};

const testReorderFeedbackFields = async () => {
  return await runTest('Reorder Feedback Fields', async () => {
    if (CONFIG.testFieldIds.length < 2) {
      return { success: false, error: 'Not enough fields to test reordering' };
    }
    
    // Reverse the order of fields
    const reorderedIds = [...CONFIG.testFieldIds].reverse();
    
    const response = await makeRequest(
      'POST',
      `/events/${CONFIG.testEventId}/feedback/fields/reorder`,
      { fieldIds: reorderedIds },
      CONFIG.adminToken
    );
    
    return { success: response.success, error: response.error };
  });
};

// =============================================================================
// FEEDBACK SUBMISSION TESTS
// =============================================================================

const testSubmitIdentifiedFeedback = async () => {
  return await runTest('Submit Identified Feedback', async () => {
    if (CONFIG.testFieldIds.length === 0) {
      return { success: false, error: 'No fields available for testing' };
    }
    
    const responses = {};
    
    // Create responses for each field based on type
    CONFIG.testFieldIds.forEach((fieldId, index) => {
      switch (index) {
        case 0: // Rating field
          responses[fieldId] = 4;
          break;
        case 1: // Likert field
          responses[fieldId] = 'agree';
          break;
        case 2: // Textarea field
          responses[fieldId] = 'The networking session was excellent and very well organized!';
          break;
        case 3: // Checkbox field
          responses[fieldId] = ['Technical Workshops', 'Career Guidance'];
          break;
        case 4: // Radio field
          responses[fieldId] = 'Definitely Yes';
          break;
        default:
          responses[fieldId] = 'Test response';
      }
    });
    
    const response = await makeRequest(
      'POST',
      `/events/${CONFIG.testEventId}/feedback/submit`,
      {
        responses,
        isAnonymous: false
      },
      CONFIG.userToken || CONFIG.adminToken
    );
    
    return { success: response.success, error: response.error };
  });
};

const testSubmitAnonymousFeedback = async () => {
  return await runTest('Submit Anonymous Feedback', async () => {
    if (CONFIG.testFieldIds.length === 0) {
      return { success: false, error: 'No fields available for testing' };
    }
    
    const responses = {};
    
    // Create different responses for anonymous submission
    CONFIG.testFieldIds.forEach((fieldId, index) => {
      switch (index) {
        case 0: // Rating field
          responses[fieldId] = 5;
          break;
        case 1: // Likert field
          responses[fieldId] = 'strongly_agree';
          break;
        case 2: // Textarea field
          responses[fieldId] = 'Great event overall, learned a lot!';
          break;
        case 3: // Checkbox field
          responses[fieldId] = ['Industry Talks', 'Alumni Meetups'];
          break;
        case 4: // Radio field
          responses[fieldId] = 'Probably Yes';
          break;
        default:
          responses[fieldId] = 'Anonymous test response';
      }
    });
    
    const response = await makeRequest(
      'POST',
      `/events/${CONFIG.testEventId}/feedback/submit`,
      {
        responses,
        isAnonymous: true
      }
      // No token for anonymous submission
    );
    
    return { success: response.success, error: response.error };
  });
};

const testGetMyFeedbackResponse = async () => {
  return await runTest('Get My Feedback Response', async () => {
    const response = await makeRequest(
      'GET',
      `/events/${CONFIG.testEventId}/feedback/my-response`,
      null,
      CONFIG.userToken || CONFIG.adminToken
    );
    
    if (response.success && Array.isArray(response.data.data)) {
      return { success: true };
    }
    
    return { success: false, error: response.error || 'Invalid response format' };
  });
};

// =============================================================================
// ADMIN ANALYTICS & REPORTING TESTS
// =============================================================================

const testGetFeedbackAnalytics = async () => {
  return await runTest('Get Feedback Analytics', async () => {
    const response = await makeRequest(
      'GET',
      `/events/${CONFIG.testEventId}/feedback/analytics`,
      null,
      CONFIG.adminToken
    );
    
    if (response.success && response.data.data.totalResponses !== undefined) {
      return { success: true };
    }
    
    return { success: false, error: response.error || 'Invalid analytics format' };
  });
};

const testGetFeedbackResponses = async () => {
  return await runTest('Get Feedback Responses', async () => {
    const response = await makeRequest(
      'GET',
      `/events/${CONFIG.testEventId}/feedback/responses?page=1&limit=10`,
      null,
      CONFIG.adminToken
    );
    
    if (response.success && Array.isArray(response.data.data)) {
      return { success: true };
    }
    
    return { success: false, error: response.error || 'Invalid responses format' };
  });
};

const testGetFeedbackSummary = async () => {
  return await runTest('Get Feedback Summary', async () => {
    const response = await makeRequest(
      'GET',
      `/events/${CONFIG.testEventId}/feedback/summary`,
      null,
      CONFIG.adminToken
    );
    
    if (response.success && response.data.data.totalResponses !== undefined) {
      return { success: true };
    }
    
    return { success: false, error: response.error || 'Invalid summary format' };
  });
};

const testExportFeedbackData = async () => {
  return await runTest('Export Feedback Data', async () => {
    const response = await makeRequest(
      'GET',
      `/events/${CONFIG.testEventId}/feedback/export?format=csv&includeAnonymous=true`,
      null,
      CONFIG.adminToken
    );
    
    // For export, we expect either CSV content or an error
    if (response.success || response.status === 200) {
      return { success: true };
    }
    
    return { success: false, error: response.error || 'Export failed' };
  });
};

// =============================================================================
// UTILITY & ADMIN TESTS
// =============================================================================

const testRefreshAnalytics = async () => {
  return await runTest('Refresh Analytics Cache', async () => {
    const response = await makeRequest(
      'POST',
      `/events/${CONFIG.testEventId}/feedback/refresh-analytics`,
      null,
      CONFIG.adminToken
    );
    
    return { success: response.success, error: response.error };
  });
};

const testScheduleReminders = async () => {
  return await runTest('Schedule Feedback Reminders', async () => {
    const response = await makeRequest(
      'POST',
      `/events/${CONFIG.testEventId}/feedback/schedule-reminders`,
      null,
      CONFIG.adminToken
    );
    
    return { success: response.success, error: response.error };
  });
};

const testBulkCreateForms = async () => {
  return await runTest('Bulk Create Feedback Forms', async () => {
    // This test would need multiple event IDs
    // For now, we'll skip if we only have one test event
    
    const response = await makeRequest(
      'POST',
      `/events/feedback/bulk-create`,
      {
        eventIds: [CONFIG.testEventId],
        formTemplate: {
          title: 'Bulk Created Feedback Form',
          description: 'Created via bulk operation',
          allowAnonymous: true,
          showAfterEvent: false
        }
      },
      CONFIG.adminToken
    );
    
    if (response.success) {
      return { success: true };
    }
    
    // If it fails because form already exists, that's okay for this test
    if (response.error && response.error.message && response.error.message.includes('already')) {
      return { success: true };
    }
    
    return { success: false, error: response.error };
  });
};

// =============================================================================
// NEGATIVE TESTS (Error Handling)
// =============================================================================

const testInvalidEventId = async () => {
  return await runTest('Invalid Event ID Handling', async () => {
    const response = await makeRequest(
      'GET',
      `/events/invalid-event-id/feedback/form`,
      null,
      CONFIG.adminToken
    );
    
    // We expect this to fail with 404 or 400
    if (!response.success && (response.status === 404 || response.status === 400)) {
      return { success: true };
    }
    
    return { success: false, error: 'Expected error response for invalid event ID' };
  });
};

const testUnauthorizedAccess = async () => {
  return await runTest('Unauthorized Access Handling', async () => {
    const response = await makeRequest(
      'POST',
      `/events/${CONFIG.testEventId}/feedback/form`,
      { title: 'Unauthorized Test' }
      // No token provided
    );
    
    // We expect this to fail with 401
    if (!response.success && response.status === 401) {
      return { success: true };
    }
    
    return { success: false, error: 'Expected 401 unauthorized error' };
  });
};

const testInvalidFieldData = async () => {
  return await runTest('Invalid Field Data Handling', async () => {
    const response = await makeRequest(
      'POST',
      `/events/${CONFIG.testEventId}/feedback/fields`,
      {
        fieldName: '', // Invalid: empty name
        fieldLabel: 'Test Field',
        fieldType: 'INVALID_TYPE', // Invalid type
        isRequired: 'not-a-boolean' // Invalid boolean
      },
      CONFIG.adminToken
    );
    
    // We expect this to fail with validation error
    if (!response.success && response.status === 400) {
      return { success: true };
    }
    
    return { success: false, error: 'Expected validation error for invalid field data' };
  });
};

// =============================================================================
// MAIN TEST RUNNER
// =============================================================================

const runAllTests = async () => {
  console.log('🚀 Starting Phase 6 Feedback System Tests'.cyan.bold);
  console.log('=' * 60);
  
  try {
    // Setup
    await setupAuthentication();
    await setupTestEvent();
    
    // Core functionality tests
    await testCreateFeedbackForm();
    await testGetFeedbackForm();
    await testAddFeedbackFields();
    await testReorderFeedbackFields();
    
    // Wait a moment for any async operations
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Submission tests
    await testSubmitIdentifiedFeedback();
    await testSubmitAnonymousFeedback();
    await testGetMyFeedbackResponse();
    
    // Analytics tests
    await testGetFeedbackAnalytics();
    await testGetFeedbackResponses();
    await testGetFeedbackSummary();
    await testExportFeedbackData();
    
    // Utility tests
    await testRefreshAnalytics();
    await testScheduleReminders();
    await testBulkCreateForms();
    
    // Error handling tests
    await testInvalidEventId();
    await testUnauthorizedAccess();
    await testInvalidFieldData();
    
  } catch (error) {
    log(`Setup failed: ${error.message}`, 'error');
  }
  
  // Print summary
  console.log('\n' + '=' * 60);
  console.log('📊 TEST SUMMARY'.cyan.bold);
  console.log('=' * 60);
  console.log(`Total Tests: ${testStats.total}`.white);
  console.log(`✅ Passed: ${testStats.passed}`.green);
  console.log(`❌ Failed: ${testStats.failed}`.red);
  console.log(`⏭️  Skipped: ${testStats.skipped}`.yellow);
  
  const successRate = testStats.total > 0 ? ((testStats.passed / testStats.total) * 100).toFixed(1) : 0;
  console.log(`📈 Success Rate: ${successRate}%`.cyan);
  
  if (testStats.failed === 0) {
    console.log('\n🎉 All tests passed! Phase 6 Feedback System is working correctly.'.green.bold);
  } else {
    console.log('\n⚠️  Some tests failed. Please review the errors above.'.yellow.bold);
  }
  
  console.log('\n📝 Test Configuration:'.blue);
  console.log(`Event ID: ${CONFIG.testEventId}`);
  console.log(`Feedback Form ID: ${CONFIG.testFeedbackFormId}`);
  console.log(`Field IDs: ${CONFIG.testFieldIds.join(', ')}`);
};

// Run the tests
if (require.main === module) {
  runAllTests()
    .then(() => process.exit(testStats.failed > 0 ? 1 : 0))
    .catch(error => {
      console.error('Test runner failed:', error);
      process.exit(1);
    });
}

module.exports = {
  runAllTests,
  testStats,
  CONFIG
};