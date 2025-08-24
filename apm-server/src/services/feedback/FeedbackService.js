// src/services/feedback/FeedbackService.js
const { prisma } = require('../../config/database');

class FeedbackService {
  /**
   * Validate feedback responses against form fields
   * @param {Array} formFields - Array of form field definitions
   * @param {Object} responses - User responses object
   * @returns {Object} - Validation result
   */
  static async validateFeedbackResponses(formFields, responses) {
    const errors = [];

    // Check required fields
    for (const field of formFields) {
      const responseValue = responses[field.id];

      if (field.isRequired && (!responseValue || responseValue.toString().trim() === '')) {
        errors.push(`${field.fieldLabel} is required`);
        continue;
      }

      if (responseValue !== undefined && responseValue !== null && responseValue !== '') {
        // Validate by field type
        const validation = this.validateFieldResponse(field, responseValue);
        if (!validation.isValid) {
          errors.push(`${field.fieldLabel}: ${validation.error}`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate individual field response
   * @param {Object} field - Field definition
   * @param {any} value - Response value
   * @returns {Object} - Validation result
   */
  static validateFieldResponse(field, value) {
    const valueStr = value?.toString?.() || '';

    switch (field.fieldType) {
      case 'TEXT':
        return this.validateTextResponse(field, valueStr);
      
      case 'EMAIL':
        return this.validateEmailResponse(valueStr);
      
      case 'PHONE':
        return this.validatePhoneResponse(valueStr);
      
      case 'TEXTAREA':
        return this.validateTextareaResponse(field, valueStr);
      
      case 'SELECT':
        return this.validateSelectResponse(field, value);
      
      case 'RADIO':
        return this.validateRadioResponse(field, value);
      
      case 'CHECKBOX':
        return this.validateCheckboxResponse(field, value);
      
      case 'RATING':
        return this.validateRatingResponse(field, value);
      
      case 'LIKERT':
        return this.validateLikertResponse(field, value);
      
      case 'SENTIMENT':
        return this.validateSentimentResponse(field, valueStr);
      
      default:
        return { isValid: true };
    }
  }

  /**
   * Validate text field response
   */
  static validateTextResponse(field, value) {
    if (field.validation) {
      const validation = field.validation;
      
      if (validation.minLength && value.length < validation.minLength) {
        return { 
          isValid: false, 
          error: `Minimum length is ${validation.minLength} characters` 
        };
      }
      
      if (validation.maxLength && value.length > validation.maxLength) {
        return { 
          isValid: false, 
          error: `Maximum length is ${validation.maxLength} characters` 
        };
      }
      
      if (validation.pattern) {
        const regex = new RegExp(validation.pattern);
        if (!regex.test(value)) {
          return { 
            isValid: false, 
            error: validation.patternMessage || 'Invalid format' 
          };
        }
      }
    }
    
    return { isValid: true };
  }

  /**
   * Validate email response
   */
  static validateEmailResponse(value) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!emailRegex.test(value)) {
      return { isValid: false, error: 'Invalid email format' };
    }
    
    return { isValid: true };
  }

  /**
   * Validate phone response
   */
  static validatePhoneResponse(value) {
    // Remove all non-digits
    const digitsOnly = value.replace(/\D/g, '');
    
    // Check if it's a valid Indian mobile number (10 digits starting with 6-9)
    if (digitsOnly.length !== 10 || !/^[6-9]/.test(digitsOnly)) {
      return { isValid: false, error: 'Invalid phone number format' };
    }
    
    return { isValid: true };
  }

  /**
   * Validate textarea response
   */
  static validateTextareaResponse(field, value) {
    if (field.validation) {
      const validation = field.validation;
      
      if (validation.minLength && value.length < validation.minLength) {
        return { 
          isValid: false, 
          error: `Minimum length is ${validation.minLength} characters` 
        };
      }
      
      if (validation.maxLength && value.length > validation.maxLength) {
        return { 
          isValid: false, 
          error: `Maximum length is ${validation.maxLength} characters` 
        };
      }
    }
    
    return { isValid: true };
  }

  /**
   * Validate select field response
   */
  static validateSelectResponse(field, value) {
    if (!field.options || !Array.isArray(field.options)) {
      return { isValid: true };
    }
    
    const validOptions = field.options.map(opt => typeof opt === 'string' ? opt : opt.value);
    
    if (!validOptions.includes(value)) {
      return { isValid: false, error: 'Invalid option selected' };
    }
    
    return { isValid: true };
  }

  /**
   * Validate radio field response
   */
  static validateRadioResponse(field, value) {
    return this.validateSelectResponse(field, value);
  }

  /**
   * Validate checkbox field response
   */
  static validateCheckboxResponse(field, value) {
    if (!Array.isArray(value)) {
      return { isValid: false, error: 'Checkbox value must be an array' };
    }
    
    if (!field.options || !Array.isArray(field.options)) {
      return { isValid: true };
    }
    
    const validOptions = field.options.map(opt => typeof opt === 'string' ? opt : opt.value);
    
    for (const item of value) {
      if (!validOptions.includes(item)) {
        return { isValid: false, error: `Invalid option: ${item}` };
      }
    }
    
    return { isValid: true };
  }

  /**
   * Validate rating field response
   */
  static validateRatingResponse(field, value) {
    const numValue = Number(value);
    
    if (isNaN(numValue)) {
      return { isValid: false, error: 'Rating must be a number' };
    }
    
    const minValue = field.minValue || 1;
    const maxValue = field.maxValue || 5;
    
    if (numValue < minValue || numValue > maxValue) {
      return { 
        isValid: false, 
        error: `Rating must be between ${minValue} and ${maxValue}` 
      };
    }
    
    // Check step value
    if (field.stepValue) {
      const steps = (numValue - minValue) / field.stepValue;
      if (steps !== Math.floor(steps)) {
        return { 
          isValid: false, 
          error: `Rating must be in steps of ${field.stepValue}` 
        };
      }
    }
    
    return { isValid: true };
  }

  /**
   * Validate Likert scale response
   */
  static validateLikertResponse(field, value) {
    const likertOptions = [
      'strongly_disagree',
      'disagree', 
      'neutral', 
      'agree', 
      'strongly_agree'
    ];
    
    if (!likertOptions.includes(value)) {
      return { isValid: false, error: 'Invalid Likert scale response' };
    }
    
    return { isValid: true };
  }

  /**
   * Validate sentiment field response
   */
  static validateSentimentResponse(field, value) {
    // Sentiment fields are typically text fields with sentiment analysis
    return this.validateTextareaResponse(field, value);
  }

  /**
   * Generate export data for feedback responses
   * @param {Object} feedbackForm - Feedback form with fields
   * @param {Array} responses - Array of responses
   * @param {String} format - Export format ('csv' or 'excel')
   * @returns {String|Buffer} - Export data
   */
  static async generateExportData(feedbackForm, responses, format = 'csv') {
    // Group responses by user/session
    const responsesByUser = this.groupResponsesByUser(responses);
    
    // Create headers
    const headers = ['Submitted At', 'User', 'Email', 'Anonymous'];
    feedbackForm.fields.forEach(field => {
      headers.push(field.fieldLabel);
    });
    headers.push('Overall Sentiment');

    // Create data rows
    const rows = [];
    
    for (const [userKey, userResponses] of Object.entries(responsesByUser)) {
      const row = [];
      const firstResponse = userResponses[0];
      
      // Basic info
      row.push(firstResponse.submittedAt ? new Date(firstResponse.submittedAt).toLocaleString() : '');
      row.push(firstResponse.user?.fullName || 'Anonymous');
      row.push(firstResponse.user?.email || '');
      row.push(firstResponse.isAnonymous ? 'Yes' : 'No');
      
      // Response values
      feedbackForm.fields.forEach(field => {
        const response = userResponses.find(r => r.fieldId === field.id);
        row.push(response ? this.formatResponseForExport(response.response, field.fieldType) : '');
      });
      
      // Overall sentiment
      const sentiments = userResponses.filter(r => r.sentimentScore).map(r => r.sentimentScore);
      const avgSentiment = sentiments.length > 0 
        ? this.calculateAverageSentiment(sentiments)
        : '';
      row.push(avgSentiment);
      
      rows.push(row);
    }

    if (format === 'csv') {
      return this.generateCSV(headers, rows);
    } else {
      return this.generateExcel(headers, rows, feedbackForm.event?.title || 'Feedback Export');
    }
  }

  /**
   * Group responses by user or anonymous session
   */
  static groupResponsesByUser(responses) {
    const grouped = {};
    
    responses.forEach(response => {
      // Use userId for identified responses, or create anonymous key based on IP+UserAgent+time
      const userKey = response.userId || 
        `anonymous_${response.ipAddress}_${response.submittedAt}`;
      
      if (!grouped[userKey]) {
        grouped[userKey] = [];
      }
      grouped[userKey].push(response);
    });
    
    return grouped;
  }

  /**
   * Format response value for export
   */
  static formatResponseForExport(value, fieldType) {
    switch (fieldType) {
      case 'CHECKBOX':
        try {
          const parsed = JSON.parse(value);
          return Array.isArray(parsed) ? parsed.join(', ') : value;
        } catch {
          return value;
        }
      
      case 'RATING':
        return `${value}/5`;
      
      case 'LIKERT':
        const likertMap = {
          strongly_disagree: 'Strongly Disagree',
          disagree: 'Disagree',
          neutral: 'Neutral',
          agree: 'Agree',
          strongly_agree: 'Strongly Agree'
        };
        return likertMap[value] || value;
      
      default:
        return value;
    }
  }

  /**
   * Calculate average sentiment from sentiment scores
   */
  static calculateAverageSentiment(sentiments) {
    const sentimentValues = {
      'VERY_NEGATIVE': -2,
      'NEGATIVE': -1,
      'NEUTRAL': 0,
      'POSITIVE': 1,
      'VERY_POSITIVE': 2
    };
    
    const total = sentiments.reduce((sum, sentiment) => {
      return sum + (sentimentValues[sentiment] || 0);
    }, 0);
    
    const average = total / sentiments.length;
    
    // Convert back to sentiment label
    if (average <= -1.5) return 'Very Negative';
    if (average <= -0.5) return 'Negative';
    if (average <= 0.5) return 'Neutral';
    if (average <= 1.5) return 'Positive';
    return 'Very Positive';
  }

  /**
   * Generate CSV data
   */
  static generateCSV(headers, rows) {
    const csvContent = [];
    
    // Add headers
    csvContent.push(headers.map(header => `"${header}"`).join(','));
    
    // Add data rows
    rows.forEach(row => {
      const csvRow = row.map(cell => {
        const cellStr = String(cell || '');
        // Escape quotes and wrap in quotes if contains comma, quote, or newline
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
          return `"${cellStr.replace(/"/g, '""')}"`;
        }
        return cellStr;
      });
      csvContent.push(csvRow.join(','));
    });
    
    return csvContent.join('\n');
  }

  /**
   * Generate Excel data (placeholder - would need xlsx library)
   */
  static generateExcel(headers, rows, sheetName) {
    // This is a placeholder - in real implementation, you'd use a library like 'xlsx'
    // For now, return CSV format
    console.log(`Excel export requested for sheet: ${sheetName}`);
    return this.generateCSV(headers, rows);
  }

  /**
   * Calculate completion rate for a feedback form
   */
  static async calculateCompletionRate(feedbackFormId) {
    try {
      // Get total registered users for the event
      const feedbackForm = await prisma.eventFeedbackForm.findUnique({
        where: { id: feedbackFormId },
        include: {
          event: {
            include: {
              registrations: {
                where: { status: 'CONFIRMED' },
                select: { id: true }
              }
            }
          }
        }
      });

      if (!feedbackForm) {
        return 0;
      }

      const totalRegistrations = feedbackForm.event.registrations.length;
      
      if (totalRegistrations === 0) {
        return 0;
      }

      // Get unique respondents (excluding anonymous)
      const uniqueRespondents = await prisma.eventFeedbackResponse.groupBy({
        by: ['userId'],
        where: {
          feedbackFormId,
          userId: { not: null }
        }
      });

      const completionRate = (uniqueRespondents.length / totalRegistrations) * 100;
      return Math.round(completionRate * 100) / 100; // Round to 2 decimal places

    } catch (error) {
      console.error('Calculate completion rate error:', error);
      return 0;
    }
  }

  /**
   * Get response rate statistics
   */
  static async getResponseStats(feedbackFormId) {
    try {
      const [totalResponses, anonymousCount, identifiedCount] = await Promise.all([
        prisma.eventFeedbackResponse.groupBy({
          by: ['userId'],
          where: { feedbackFormId },
          _count: true
        }),
        prisma.eventFeedbackResponse.groupBy({
          by: ['userId'],
          where: { 
            feedbackFormId, 
            isAnonymous: true 
          },
          _count: true
        }),
        prisma.eventFeedbackResponse.groupBy({
          by: ['userId'],
          where: { 
            feedbackFormId, 
            isAnonymous: false 
          },
          _count: true
        })
      ]);

      return {
        totalResponses: totalResponses.length,
        anonymousResponses: anonymousCount.length,
        identifiedResponses: identifiedCount.length,
        completionRate: await this.calculateCompletionRate(feedbackFormId)
      };

    } catch (error) {
      console.error('Get response stats error:', error);
      return {
        totalResponses: 0,
        anonymousResponses: 0,
        identifiedResponses: 0,
        completionRate: 0
      };
    }
  }

  /**
   * Schedule feedback reminders for event attendees
   */
  static async scheduleFeedbackReminders(feedbackFormId) {
    try {
      const feedbackForm = await prisma.eventFeedbackForm.findUnique({
        where: { id: feedbackFormId },
        include: {
          event: {
            include: {
              registrations: {
                where: { status: 'CONFIRMED' },
                select: { userId: true }
              }
            }
          }
        }
      });

      if (!feedbackForm || !feedbackForm.autoSendReminders) {
        return;
      }

      const eventDate = new Date(feedbackForm.event.eventDate);
      const reminderDate = new Date(eventDate.getTime() + (feedbackForm.reminderDelayHours * 60 * 60 * 1000));

      // Create reminder records
      const reminderData = feedbackForm.event.registrations.map(reg => ({
        feedbackFormId,
        userId: reg.userId,
        eventId: feedbackForm.eventId,
        reminderType: 'initial',
        scheduledAt: reminderDate
      }));

      await prisma.eventFeedbackReminder.createMany({
        data: reminderData,
        skipDuplicates: true
      });

      console.log(`Scheduled ${reminderData.length} feedback reminders for event ${feedbackForm.eventId}`);

    } catch (error) {
      console.error('Schedule feedback reminders error:', error);
    }
  }
}

module.exports = FeedbackService;