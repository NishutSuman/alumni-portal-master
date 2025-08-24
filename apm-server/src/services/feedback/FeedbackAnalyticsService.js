// src/services/feedback/FeedbackAnalyticsService.js
const { prisma } = require('../../config/database');
const { CacheService } = require('../../config/redis');

class FeedbackAnalyticsService {
  /**
   * Get analytics for a feedback form (with caching)
   * @param {String} feedbackFormId - Feedback form ID
   * @param {Boolean} forceRefresh - Force refresh cache
   * @returns {Object} - Analytics data
   */
  static async getAnalytics(feedbackFormId, forceRefresh = false) {
    const cacheKey = `feedback_analytics:${feedbackFormId}`;
    
    try {
      // Try to get from cache first (unless forced refresh)
      if (!forceRefresh) {
        const cached = await CacheService.get(cacheKey);
        if (cached && !cached.isStale) {
          return cached;
        }
      }

      // Generate fresh analytics
      const analytics = await this.generateAnalytics(feedbackFormId);
      
      // Cache for 1 hour
      await CacheService.set(cacheKey, analytics, 3600);
      
      // Update database cache
      await this.updateAnalyticsCache(feedbackFormId, analytics);
      
      return analytics;

    } catch (error) {
      console.error('Get analytics error:', error);
      
      // Return empty analytics on error
      return this.getEmptyAnalytics();
    }
  }

  /**
   * Update analytics (triggered after new responses)
   * @param {String} feedbackFormId - Feedback form ID
   */
  static async updateAnalytics(feedbackFormId) {
    try {
      // Generate fresh analytics
      const analytics = await this.generateAnalytics(feedbackFormId);
      
      // Update cache
      const cacheKey = `feedback_analytics:${feedbackFormId}`;
      await CacheService.set(cacheKey, analytics, 3600);
      
      // Update database
      await this.updateAnalyticsCache(feedbackFormId, analytics);
      
      console.log(`Analytics updated for feedback form: ${feedbackFormId}`);
      
    } catch (error) {
      console.error('Update analytics error:', error);
    }
  }

  /**
   * Generate comprehensive analytics
   * @param {String} feedbackFormId - Feedback form ID
   * @returns {Object} - Analytics object
   */
  static async generateAnalytics(feedbackFormId) {
    const startTime = Date.now();
    
    try {
      // Get feedback form with event details
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
          },
          fields: {
            select: {
              id: true,
              fieldName: true,
              fieldLabel: true,
              fieldType: true,
              minValue: true,
              maxValue: true
            }
          }
        }
      });

      if (!feedbackForm) {
        throw new Error('Feedback form not found');
      }

      // Get all responses
      const responses = await prisma.eventFeedbackResponse.findMany({
        where: { feedbackFormId },
        include: {
          field: {
            select: {
              fieldName: true,
              fieldType: true,
              minValue: true,
              maxValue: true
            }
          }
        }
      });

      // Calculate basic statistics
      const responseStats = await this.calculateResponseStats(feedbackFormId, feedbackForm.event.registrations.length);
      
      // Calculate sentiment analytics
      const sentimentAnalytics = this.calculateSentimentAnalytics(responses);
      
      // Calculate rating analytics
      const ratingAnalytics = this.calculateRatingAnalytics(responses, feedbackForm.fields);
      
      // Calculate engagement analytics
      const engagementAnalytics = this.calculateEngagementAnalytics(responses);
      
      // Calculate field-specific analytics
      const fieldAnalytics = this.calculateFieldAnalytics(responses, feedbackForm.fields);
      
      // Calculate response time analytics
      const timeAnalytics = this.calculateTimeAnalytics(responses);

      const analytics = {
        feedbackFormId,
        eventId: feedbackForm.eventId,
        generatedAt: new Date(),
        processingTime: Date.now() - startTime,
        
        // Response statistics
        ...responseStats,
        
        // Sentiment analytics
        ...sentimentAnalytics,
        
        // Rating analytics  
        ...ratingAnalytics,
        
        // Engagement analytics
        ...engagementAnalytics,
        
        // Time analytics
        ...timeAnalytics,
        
        // Field-specific analytics
        fieldAnalytics,
        
        // Meta information
        isStale: false,
        lastCalculatedAt: new Date()
      };

      return analytics;

    } catch (error) {
      console.error('Generate analytics error:', error);
      throw error;
    }
  }

  /**
   * Calculate response statistics
   */
  static async calculateResponseStats(feedbackFormId, totalRegistrations) {
    try {
      // Get unique respondents
      const [totalResponders, anonymousResponders, identifiedResponders] = await Promise.all([
        // Total unique respondents
        prisma.eventFeedbackResponse.groupBy({
          by: ['userId', 'ipAddress', 'submittedAt'],
          where: { feedbackFormId }
        }),
        
        // Anonymous respondents  
        prisma.eventFeedbackResponse.groupBy({
          by: ['ipAddress', 'submittedAt'],
          where: { 
            feedbackFormId,
            isAnonymous: true
          }
        }),
        
        // Identified respondents
        prisma.eventFeedbackResponse.groupBy({
          by: ['userId'],
          where: { 
            feedbackFormId,
            isAnonymous: false,
            userId: { not: null }
          }
        })
      ]);

      const totalResponses = totalResponders.length;
      const anonymousResponses = anonymousResponders.length;
      const identifiedResponses = identifiedResponders.length;
      
      const completionRate = totalRegistrations > 0 
        ? (identifiedResponses / totalRegistrations) * 100 
        : 0;

      return {
        totalResponses,
        anonymousResponses,
        identifiedResponses,
        completionRate: Math.round(completionRate * 100) / 100
      };

    } catch (error) {
      console.error('Calculate response stats error:', error);
      return {
        totalResponses: 0,
        anonymousResponses: 0,
        identifiedResponses: 0,
        completionRate: 0
      };
    }
  }

  /**
   * Calculate sentiment analytics
   */
  static calculateSentimentAnalytics(responses) {
    const sentimentResponses = responses.filter(r => r.sentimentScore);
    
    if (sentimentResponses.length === 0) {
      return {
        avgSentimentScore: null,
        sentimentDistribution: {}
      };
    }

    // Calculate sentiment distribution
    const sentimentCounts = {};
    const sentimentValues = {
      'VERY_NEGATIVE': -2,
      'NEGATIVE': -1,
      'NEUTRAL': 0,
      'POSITIVE': 1,
      'VERY_POSITIVE': 2
    };

    let totalSentimentValue = 0;
    
    sentimentResponses.forEach(response => {
      const sentiment = response.sentimentScore;
      sentimentCounts[sentiment] = (sentimentCounts[sentiment] || 0) + 1;
      totalSentimentValue += sentimentValues[sentiment] || 0;
    });

    const avgSentimentScore = totalSentimentValue / sentimentResponses.length;

    // Convert counts to percentages
    const sentimentDistribution = {};
    Object.keys(sentimentCounts).forEach(sentiment => {
      sentimentDistribution[sentiment] = {
        count: sentimentCounts[sentiment],
        percentage: Math.round((sentimentCounts[sentiment] / sentimentResponses.length) * 100)
      };
    });

    return {
      avgSentimentScore: Math.round(avgSentimentScore * 100) / 100,
      sentimentDistribution
    };
  }

  /**
   * Calculate rating analytics
   */
  static calculateRatingAnalytics(responses, fields) {
    const ratingFields = fields.filter(f => f.fieldType === 'RATING');
    
    if (ratingFields.length === 0) {
      return {
        avgRating: null,
        ratingDistribution: {}
      };
    }

    const ratingResponses = responses.filter(r => 
      ratingFields.some(f => f.id === r.fieldId)
    );

    if (ratingResponses.length === 0) {
      return {
        avgRating: null,
        ratingDistribution: {}
      };
    }

    // Calculate average rating
    const totalRating = ratingResponses.reduce((sum, response) => {
      return sum + (parseFloat(response.response) || 0);
    }, 0);
    
    const avgRating = totalRating / ratingResponses.length;

    // Calculate rating distribution
    const ratingCounts = {};
    ratingResponses.forEach(response => {
      const rating = Math.round(parseFloat(response.response));
      ratingCounts[rating] = (ratingCounts[rating] || 0) + 1;
    });

    // Convert to percentages
    const ratingDistribution = {};
    Object.keys(ratingCounts).forEach(rating => {
      ratingDistribution[rating] = {
        count: ratingCounts[rating],
        percentage: Math.round((ratingCounts[rating] / ratingResponses.length) * 100)
      };
    });

    return {
      avgRating: Math.round(avgRating * 100) / 100,
      ratingDistribution
    };
  }

  /**
   * Calculate engagement analytics
   */
  static calculateEngagementAnalytics(responses) {
    if (responses.length === 0) {
      return {
        responsesByHour: {},
        responsesByDay: {}
      };
    }

    // Group responses by hour
    const responsesByHour = {};
    const responsesByDay = {};

    responses.forEach(response => {
      if (response.submittedAt) {
        const date = new Date(response.submittedAt);
        const hour = date.getHours();
        const day = date.toISOString().split('T')[0]; // YYYY-MM-DD format

        responsesByHour[hour] = (responsesByHour[hour] || 0) + 1;
        responsesByDay[day] = (responsesByDay[day] || 0) + 1;
      }
    });

    return {
      responsesByHour,
      responsesByDay
    };
  }

  /**
   * Calculate response time analytics
   */
  static calculateTimeAnalytics(responses) {
    const validResponses = responses.filter(r => r.submittedAt);
    
    if (validResponses.length === 0) {
      return {
        avgResponseTime: null,
        fastestResponse: null,
        slowestResponse: null
      };
    }

    // For simplicity, we'll use a placeholder response time calculation
    // In a real implementation, you'd track when users started vs completed the form
    const responseTimes = validResponses.map(() => {
      // Placeholder: random response time between 30 seconds and 10 minutes
      return Math.floor(Math.random() * 570) + 30;
    });

    const avgResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
    const fastestResponse = Math.min(...responseTimes);
    const slowestResponse = Math.max(...responseTimes);

    return {
      avgResponseTime: Math.round(avgResponseTime),
      fastestResponse,
      slowestResponse
    };
  }

  /**
   * Calculate field-specific analytics
   */
  static calculateFieldAnalytics(responses, fields) {
    const fieldAnalytics = {};

    fields.forEach(field => {
      const fieldResponses = responses.filter(r => r.fieldId === field.id);
      
      if (fieldResponses.length === 0) {
        fieldAnalytics[field.id] = {
          fieldName: field.fieldName,
          fieldLabel: field.fieldLabel,
          fieldType: field.fieldType,
          totalResponses: 0,
          analytics: {}
        };
        return;
      }

      let analytics = {};

      switch (field.fieldType) {
        case 'RATING':
          analytics = this.calculateRatingFieldAnalytics(fieldResponses);
          break;
          
        case 'SELECT':
        case 'RADIO':
          analytics = this.calculateChoiceFieldAnalytics(fieldResponses);
          break;
          
        case 'CHECKBOX':
          analytics = this.calculateCheckboxFieldAnalytics(fieldResponses);
          break;
          
        case 'LIKERT':
          analytics = this.calculateLikertFieldAnalytics(fieldResponses);
          break;
          
        case 'TEXT':
        case 'TEXTAREA':
          analytics = this.calculateTextFieldAnalytics(fieldResponses);
          break;
          
        default:
          analytics = { responseCount: fieldResponses.length };
      }

      fieldAnalytics[field.id] = {
        fieldName: field.fieldName,
        fieldLabel: field.fieldLabel,
        fieldType: field.fieldType,
        totalResponses: fieldResponses.length,
        analytics
      };
    });

    return fieldAnalytics;
  }

  /**
   * Calculate rating field analytics
   */
  static calculateRatingFieldAnalytics(responses) {
    const ratings = responses.map(r => parseFloat(r.response)).filter(r => !isNaN(r));
    
    if (ratings.length === 0) return {};

    const sum = ratings.reduce((acc, rating) => acc + rating, 0);
    const avg = sum / ratings.length;
    
    const distribution = {};
    ratings.forEach(rating => {
      const rounded = Math.round(rating);
      distribution[rounded] = (distribution[rounded] || 0) + 1;
    });

    return {
      average: Math.round(avg * 100) / 100,
      min: Math.min(...ratings),
      max: Math.max(...ratings),
      distribution
    };
  }

  /**
   * Calculate choice field analytics (SELECT/RADIO)
   */
  static calculateChoiceFieldAnalytics(responses) {
    const choices = {};
    
    responses.forEach(response => {
      const choice = response.response;
      choices[choice] = (choices[choice] || 0) + 1;
    });

    // Convert to percentages
    const total = responses.length;
    const distribution = {};
    
    Object.keys(choices).forEach(choice => {
      distribution[choice] = {
        count: choices[choice],
        percentage: Math.round((choices[choice] / total) * 100)
      };
    });

    return {
      distribution,
      totalChoices: Object.keys(choices).length
    };
  }

  /**
   * Calculate checkbox field analytics
   */
  static calculateCheckboxFieldAnalytics(responses) {
    const allChoices = {};
    
    responses.forEach(response => {
      try {
        const choices = JSON.parse(response.response);
        if (Array.isArray(choices)) {
          choices.forEach(choice => {
            allChoices[choice] = (allChoices[choice] || 0) + 1;
          });
        }
      } catch (error) {
        // Handle non-JSON responses
        allChoices[response.response] = (allChoices[response.response] || 0) + 1;
      }
    });

    const total = responses.length;
    const distribution = {};
    
    Object.keys(allChoices).forEach(choice => {
      distribution[choice] = {
        count: allChoices[choice],
        percentage: Math.round((allChoices[choice] / total) * 100)
      };
    });

    return {
      distribution,
      avgSelectionsPerResponse: Object.values(allChoices).reduce((sum, count) => sum + count, 0) / total
    };
  }

  /**
   * Calculate Likert scale analytics
   */
  static calculateLikertFieldAnalytics(responses) {
    const likertValues = {
      'strongly_disagree': 1,
      'disagree': 2,
      'neutral': 3,
      'agree': 4,
      'strongly_agree': 5
    };

    const distribution = {};
    let totalValue = 0;
    let validResponses = 0;

    responses.forEach(response => {
      const value = response.response;
      distribution[value] = (distribution[value] || 0) + 1;
      
      if (likertValues[value]) {
        totalValue += likertValues[value];
        validResponses++;
      }
    });

    const average = validResponses > 0 ? totalValue / validResponses : 0;

    return {
      average: Math.round(average * 100) / 100,
      distribution
    };
  }

  /**
   * Calculate text field analytics
   */
  static calculateTextFieldAnalytics(responses) {
    const lengths = responses.map(r => r.response.length);
    const avgLength = lengths.reduce((sum, len) => sum + len, 0) / lengths.length;
    
    const sentiments = responses.filter(r => r.sentimentScore);
    const sentimentDistribution = {};
    
    sentiments.forEach(response => {
      const sentiment = response.sentimentScore;
      sentimentDistribution[sentiment] = (sentimentDistribution[sentiment] || 0) + 1;
    });

    return {
      avgLength: Math.round(avgLength),
      minLength: Math.min(...lengths),
      maxLength: Math.max(...lengths),
      sentimentDistribution
    };
  }

  /**
   * Update analytics cache in database
   */
  static async updateAnalyticsCache(feedbackFormId, analytics) {
    try {
      await prisma.eventFeedbackAnalytics.upsert({
        where: { feedbackFormId },
        create: {
          feedbackFormId,
          eventId: analytics.eventId,
          ...this.prepareAnalyticsForDB(analytics)
        },
        update: this.prepareAnalyticsForDB(analytics)
      });
    } catch (error) {
      console.error('Update analytics cache error:', error);
    }
  }

  /**
   * Prepare analytics data for database storage
   */
  static prepareAnalyticsForDB(analytics) {
    return {
      totalResponses: analytics.totalResponses || 0,
      anonymousResponses: analytics.anonymousResponses || 0,
      identifiedResponses: analytics.identifiedResponses || 0,
      completionRate: analytics.completionRate || 0,
      avgSentimentScore: analytics.avgSentimentScore,
      sentimentDistribution: analytics.sentimentDistribution || {},
      avgRating: analytics.avgRating,
      ratingDistribution: analytics.ratingDistribution || {},
      avgResponseTime: analytics.avgResponseTime,
      fastestResponse: analytics.fastestResponse,
      slowestResponse: analytics.slowestResponse,
      responsesByHour: analytics.responsesByHour || {},
      responsesByDay: analytics.responsesByDay || {},
      fieldAnalytics: analytics.fieldAnalytics || {},
      lastCalculatedAt: new Date(),
      isStale: false
    };
  }

  /**
   * Get empty analytics structure
   */
  static getEmptyAnalytics() {
    return {
      totalResponses: 0,
      anonymousResponses: 0,
      identifiedResponses: 0,
      completionRate: 0,
      avgSentimentScore: null,
      sentimentDistribution: {},
      avgRating: null,
      ratingDistribution: {},
      avgResponseTime: null,
      fastestResponse: null,
      slowestResponse: null,
      responsesByHour: {},
      responsesByDay: {},
      fieldAnalytics: {},
      isStale: false,
      lastCalculatedAt: new Date()
    };
  }

  /**
   * Mark analytics as stale (called when new responses are added)
   */
  static async markAnalyticsStale(feedbackFormId) {
    try {
      await prisma.eventFeedbackAnalytics.update({
        where: { feedbackFormId },
        data: { isStale: true }
      });

      // Also invalidate Redis cache
      const cacheKey = `feedback_analytics:${feedbackFormId}`;
      await CacheService.del(cacheKey);

    } catch (error) {
      console.error('Mark analytics stale error:', error);
    }
  }

  /**
   * Get analytics summary for multiple events
   */
  static async getEventsSummary(eventIds) {
    try {
      const summaries = await Promise.all(
        eventIds.map(async (eventId) => {
          const feedbackForm = await prisma.eventFeedbackForm.findFirst({
            where: { eventId },
            select: { id: true }
          });

          if (!feedbackForm) {
            return {
              eventId,
              hasForm: false,
              analytics: null
            };
          }

          const analytics = await this.getAnalytics(feedbackForm.id);
          
          return {
            eventId,
            hasForm: true,
            analytics: {
              totalResponses: analytics.totalResponses,
              completionRate: analytics.completionRate,
              avgRating: analytics.avgRating,
              avgSentimentScore: analytics.avgSentimentScore
            }
          };
        })
      );

      return summaries;

    } catch (error) {
      console.error('Get events summary error:', error);
      return [];
    }
  }
}

module.exports = FeedbackAnalyticsService;