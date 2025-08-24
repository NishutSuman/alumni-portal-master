// src/services/feedback/SentimentAnalysisService.js
class SentimentAnalysisService {
  /**
   * Positive keywords and phrases
   */
  static positiveKeywords = [
    // Basic positive words
    'excellent', 'amazing', 'fantastic', 'wonderful', 'great', 'awesome', 'outstanding',
    'perfect', 'brilliant', 'superb', 'magnificent', 'marvelous', 'terrific', 'fabulous',
    'good', 'nice', 'pleasant', 'enjoyable', 'satisfactory', 'impressive', 'remarkable',
    
    // Satisfaction words
    'happy', 'satisfied', 'pleased', 'delighted', 'thrilled', 'excited', 'glad',
    'content', 'fulfilled', 'grateful', 'thankful', 'appreciate', 'love', 'loved',
    
    // Quality words
    'helpful', 'useful', 'valuable', 'beneficial', 'effective', 'efficient', 'productive',
    'successful', 'smooth', 'seamless', 'professional', 'organized', 'well-planned',
    
    // Recommendation words
    'recommend', 'definitely', 'absolutely', 'certainly', 'highly', 'strongly',
    'would attend again', 'look forward', 'best', 'top', 'favorite',
    
    // Event-specific positive
    'informative', 'educational', 'inspiring', 'motivating', 'engaging', 'interactive',
    'well-presented', 'clear', 'comprehensive', 'thorough', 'relevant', 'timely',
    
    // Indian context
    'bahut accha', 'badiya', 'mast', 'zabardast', 'kamaal', 'shandar'
  ];

  /**
   * Negative keywords and phrases
   */
  static negativeKeywords = [
    // Basic negative words
    'terrible', 'awful', 'horrible', 'bad', 'poor', 'worst', 'disappointing',
    'disappointing', 'unacceptable', 'unsatisfactory', 'inadequate', 'insufficient',
    'useless', 'waste', 'boring', 'dull', 'monotonous', 'tedious', 'lengthy',
    
    // Dissatisfaction words
    'unhappy', 'dissatisfied', 'displeased', 'disappointed', 'frustrated', 'annoyed',
    'upset', 'angry', 'irritated', 'confused', 'lost', 'uncomfortable',
    
    // Quality issues
    'disorganized', 'chaotic', 'unprofessional', 'unclear', 'confusing', 'rushed',
    'incomplete', 'superficial', 'irrelevant', 'outdated', 'repetitive', 'redundant',
    
    // Problems
    'problem', 'issue', 'trouble', 'difficulty', 'challenge', 'concern', 'complaint',
    'failed', 'broken', 'error', 'mistake', 'wrong', 'missing', 'lacking',
    
    // Time/logistics issues
    'late', 'delayed', 'slow', 'too long', 'short', 'brief', 'rushed', 'hurried',
    'overcrowded', 'noisy', 'uncomfortable', 'difficult to hear', 'poor audio',
    
    // Event-specific negative
    'unprepared', 'disorganized', 'hard to follow', 'not clear', 'too technical',
    'too basic', 'irrelevant', 'outdated', 'not practical', 'theory only',
    
    // Strong negative phrases
    'not recommend', 'would not', 'will not', 'never again', 'avoid', 'skip'
  ];

  /**
   * Neutral keywords and phrases
   */
  static neutralKeywords = [
    'okay', 'ok', 'fine', 'average', 'normal', 'standard', 'typical', 'usual',
    'adequate', 'sufficient', 'acceptable', 'reasonable', 'fair', 'decent',
    'could be better', 'room for improvement', 'mixed', 'so-so', 'moderate'
  ];

  /**
   * Intensity modifiers
   */
  static intensifiers = {
    // Strong positive intensifiers
    'extremely': 2, 'incredibly': 2, 'absolutely': 2, 'totally': 2, 'completely': 2,
    'perfectly': 2, 'amazingly': 2, 'exceptionally': 2, 'remarkably': 2,
    
    // Moderate positive intensifiers  
    'very': 1.5, 'really': 1.5, 'quite': 1.3, 'pretty': 1.3, 'fairly': 1.2,
    'rather': 1.2, 'somewhat': 1.1, 'pretty much': 1.4,
    
    // Diminishers
    'slightly': 0.7, 'little': 0.7, 'bit': 0.7, 'somewhat': 0.8, 'kind of': 0.8,
    'sort of': 0.8, 'barely': 0.5, 'hardly': 0.4, 'not very': 0.3, 'not really': 0.2
  };

  /**
   * Negation words that flip sentiment
   */
  static negationWords = [
    'not', 'no', 'never', 'none', 'nothing', 'neither', 'nowhere', 'nobody',
    'cannot', 'can\'t', 'won\'t', 'shouldn\'t', 'wouldn\'t', 'couldn\'t',
    'don\'t', 'doesn\'t', 'didn\'t', 'isn\'t', 'aren\'t', 'wasn\'t', 'weren\'t',
    'haven\'t', 'hasn\'t', 'hadn\'t', 'lack', 'without', 'lacking', 'missing'
  ];

  /**
   * Analyze sentiment of text
   * @param {String} text - Text to analyze
   * @returns {String} - Sentiment score (VERY_NEGATIVE, NEGATIVE, NEUTRAL, POSITIVE, VERY_POSITIVE)
   */
  static async analyzeSentiment(text) {
    try {
      if (!text || typeof text !== 'string') {
        return 'NEUTRAL';
      }

      // Clean and prepare text
      const cleanText = this.preprocessText(text);
      
      // Calculate sentiment score
      const score = this.calculateSentimentScore(cleanText);
      
      // Convert score to category
      return this.scoreTocategory(score);

    } catch (error) {
      console.error('Sentiment analysis error:', error);
      return 'NEUTRAL';
    }
  }

  /**
   * Preprocess text for analysis
   * @param {String} text - Raw text
   * @returns {String} - Preprocessed text
   */
  static preprocessText(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s']/g, ' ') // Remove punctuation except apostrophes
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Calculate sentiment score (-2 to +2 scale)
   * @param {String} text - Preprocessed text
   * @returns {Number} - Sentiment score
   */
  static calculateSentimentScore(text) {
    const words = text.split(' ');
    let score = 0;
    let sentimentWords = 0;

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      let wordScore = 0;
      let hasNegation = false;
      let intensifier = 1;

      // Check for negation in previous 3 words
      for (let j = Math.max(0, i - 3); j < i; j++) {
        if (this.negationWords.includes(words[j])) {
          hasNegation = true;
          break;
        }
      }

      // Check for intensifiers in previous 2 words
      for (let j = Math.max(0, i - 2); j < i; j++) {
        if (this.intensifiers[words[j]]) {
          intensifier = this.intensifiers[words[j]];
          break;
        }
      }

      // Calculate word sentiment
      if (this.positiveKeywords.includes(word)) {
        wordScore = 1;
        sentimentWords++;
      } else if (this.negativeKeywords.includes(word)) {
        wordScore = -1;
        sentimentWords++;
      } else if (this.neutralKeywords.includes(word)) {
        wordScore = 0;
        sentimentWords++;
      }

      // Apply negation
      if (hasNegation && wordScore !== 0) {
        wordScore *= -1;
      }

      // Apply intensifier
      wordScore *= intensifier;

      score += wordScore;
    }

    // Normalize score based on text length and sentiment word density
    if (sentimentWords === 0) {
      return 0; // Neutral if no sentiment words found
    }

    // Calculate density-adjusted score
    const density = sentimentWords / words.length;
    const normalizedScore = score / sentimentWords;

    // Apply density boost for texts with high sentiment word density
    const finalScore = normalizedScore * (1 + density * 0.5);

    // Cap the score between -2 and +2
    return Math.max(-2, Math.min(2, finalScore));
  }

  /**
   * Convert numerical score to sentiment category
   * @param {Number} score - Numerical sentiment score
   * @returns {String} - Sentiment category
   */
  static scoreTocategory(score) {
    if (score >= 1.5) return 'VERY_POSITIVE';
    if (score >= 0.5) return 'POSITIVE';
    if (score <= -1.5) return 'VERY_NEGATIVE';
    if (score <= -0.5) return 'NEGATIVE';
    return 'NEUTRAL';
  }

  /**
   * Analyze sentiment with detailed breakdown
   * @param {String} text - Text to analyze
   * @returns {Object} - Detailed sentiment analysis
   */
  static async analyzeSentimentDetailed(text) {
    try {
      if (!text || typeof text !== 'string') {
        return {
          category: 'NEUTRAL',
          score: 0,
          confidence: 0,
          details: {}
        };
      }

      const cleanText = this.preprocessText(text);
      const words = cleanText.split(' ');
      
      let positiveWords = [];
      let negativeWords = [];
      let neutralWords = [];
      let intensifiers = [];
      let negations = [];
      
      // Analyze each word
      words.forEach((word, index) => {
        if (this.positiveKeywords.includes(word)) {
          positiveWords.push({ word, position: index });
        } else if (this.negativeKeywords.includes(word)) {
          negativeWords.push({ word, position: index });
        } else if (this.neutralKeywords.includes(word)) {
          neutralWords.push({ word, position: index });
        } else if (this.intensifiers[word]) {
          intensifiers.push({ word, multiplier: this.intensifiers[word], position: index });
        } else if (this.negationWords.includes(word)) {
          negations.push({ word, position: index });
        }
      });

      const score = this.calculateSentimentScore(cleanText);
      const category = this.scoreTocategory(score);
      
      // Calculate confidence based on number of sentiment indicators
      const totalSentimentWords = positiveWords.length + negativeWords.length + neutralWords.length;
      const confidence = Math.min(100, (totalSentimentWords / words.length) * 100 + Math.abs(score) * 20);

      return {
        category,
        score: Math.round(score * 100) / 100,
        confidence: Math.round(confidence),
        details: {
          wordCount: words.length,
          sentimentWords: totalSentimentWords,
          positiveWords: positiveWords.map(w => w.word),
          negativeWords: negativeWords.map(w => w.word),
          neutralWords: neutralWords.map(w => w.word),
          intensifiers: intensifiers.map(i => i.word),
          negations: negations.map(n => n.word),
          sentimentDensity: Math.round((totalSentimentWords / words.length) * 100)
        }
      };

    } catch (error) {
      console.error('Detailed sentiment analysis error:', error);
      return {
        category: 'NEUTRAL',
        score: 0,
        confidence: 0,
        details: {}
      };
    }
  }

  /**
   * Batch analyze multiple texts
   * @param {Array} texts - Array of texts to analyze
   * @returns {Array} - Array of sentiment results
   */
  static async batchAnalyzeSentiment(texts) {
    try {
      return await Promise.all(
        texts.map(text => this.analyzeSentiment(text))
      );
    } catch (error) {
      console.error('Batch sentiment analysis error:', error);
      return texts.map(() => 'NEUTRAL');
    }
  }

  /**
   * Get sentiment statistics for an array of texts
   * @param {Array} texts - Array of texts
   * @returns {Object} - Sentiment statistics
   */
  static async getSentimentStatistics(texts) {
    try {
      const sentiments = await this.batchAnalyzeSentiment(texts);
      
      const stats = {
        total: sentiments.length,
        veryPositive: 0,
        positive: 0,
        neutral: 0,
        negative: 0,
        veryNegative: 0
      };

      sentiments.forEach(sentiment => {
        switch (sentiment) {
          case 'VERY_POSITIVE': stats.veryPositive++; break;
          case 'POSITIVE': stats.positive++; break;
          case 'NEUTRAL': stats.neutral++; break;
          case 'NEGATIVE': stats.negative++; break;
          case 'VERY_NEGATIVE': stats.veryNegative++; break;
        }
      });

      // Calculate percentages
      const percentages = {};
      Object.keys(stats).forEach(key => {
        if (key !== 'total') {
          percentages[key] = Math.round((stats[key] / stats.total) * 100);
        }
      });

      // Calculate overall sentiment score
      const scoreMap = {
        'VERY_POSITIVE': 2,
        'POSITIVE': 1,
        'NEUTRAL': 0,
        'NEGATIVE': -1,
        'VERY_NEGATIVE': -2
      };

      const totalScore = sentiments.reduce((sum, sentiment) => {
        return sum + (scoreMap[sentiment] || 0);
      }, 0);

      const averageScore = totalScore / sentiments.length;
      const overallSentiment = this.scoreTocategory(averageScore);

      return {
        counts: stats,
        percentages,
        overallSentiment,
        averageScore: Math.round(averageScore * 100) / 100
      };

    } catch (error) {
      console.error('Sentiment statistics error:', error);
      return {
        counts: { total: 0, veryPositive: 0, positive: 0, neutral: 0, negative: 0, veryNegative: 0 },
        percentages: {},
        overallSentiment: 'NEUTRAL',
        averageScore: 0
      };
    }
  }

  /**
   * Extract key phrases from text based on sentiment
   * @param {String} text - Text to analyze
   * @param {String} sentimentFilter - Filter by sentiment (optional)
   * @returns {Array} - Array of key phrases
   */
  static extractKeyPhrases(text, sentimentFilter = null) {
    try {
      const cleanText = this.preprocessText(text);
      const sentences = cleanText.split(/[.!?]+/).filter(s => s.trim());
      const keyPhrases = [];

      sentences.forEach(sentence => {
        const words = sentence.trim().split(' ');
        
        // Look for phrases with sentiment words
        for (let i = 0; i < words.length - 1; i++) {
          const phrase = words.slice(i, Math.min(i + 4, words.length)).join(' ');
          
          const hasPositive = this.positiveKeywords.some(word => phrase.includes(word));
          const hasNegative = this.negativeKeywords.some(word => phrase.includes(word));
          
          if (hasPositive || hasNegative) {
            const sentiment = hasPositive ? 'POSITIVE' : 'NEGATIVE';
            
            if (!sentimentFilter || sentiment === sentimentFilter) {
              keyPhrases.push({
                phrase,
                sentiment,
                length: phrase.length
              });
            }
          }
        }
      });

      // Remove duplicates and sort by relevance
      const uniquePhrases = keyPhrases
        .filter((phrase, index, self) => 
          index === self.findIndex(p => p.phrase === phrase.phrase)
        )
        .sort((a, b) => b.length - a.length)
        .slice(0, 10); // Top 10 phrases

      return uniquePhrases;

    } catch (error) {
      console.error('Extract key phrases error:', error);
      return [];
    }
  }

  /**
   * Get sentiment trend over time
   * @param {Array} responses - Array of responses with timestamps
   * @returns {Object} - Sentiment trend data
   */
  static async getSentimentTrend(responses) {
    try {
      const trendData = {};
      
      for (const response of responses) {
        if (!response.submittedAt || !response.response) continue;
        
        const date = new Date(response.submittedAt).toISOString().split('T')[0];
        const sentiment = await this.analyzeSentiment(response.response);
        
        if (!trendData[date]) {
          trendData[date] = {
            date,
            total: 0,
            veryPositive: 0,
            positive: 0,
            neutral: 0,
            negative: 0,
            veryNegative: 0
          };
        }
        
        trendData[date].total++;
        
        switch (sentiment) {
          case 'VERY_POSITIVE': trendData[date].veryPositive++; break;
          case 'POSITIVE': trendData[date].positive++; break;
          case 'NEUTRAL': trendData[date].neutral++; break;
          case 'NEGATIVE': trendData[date].negative++; break;
          case 'VERY_NEGATIVE': trendData[date].veryNegative++; break;
        }
      }

      // Convert to array and sort by date
      const trendArray = Object.values(trendData).sort((a, b) => 
        new Date(a.date) - new Date(b.date)
      );

      return {
        trend: trendArray,
        summary: {
          totalDays: trendArray.length,
          totalResponses: trendArray.reduce((sum, day) => sum + day.total, 0),
          averagePerDay: trendArray.length > 0 
            ? Math.round(trendArray.reduce((sum, day) => sum + day.total, 0) / trendArray.length)
            : 0
        }
      };

    } catch (error) {
      console.error('Sentiment trend error:', error);
      return { trend: [], summary: {} };
    }
  }
}

module.exports = SentimentAnalysisService;