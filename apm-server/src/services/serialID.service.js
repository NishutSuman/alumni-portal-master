// ==========================================
// STEP 2: SERIAL ID GENERATION SERVICE  
// File: apm-server/src/services/serialId.service.js
// ==========================================

const { prisma } = require('../config/database');
const { CacheService } = require('../config/redis');

class SerialIdService {
  
  /**
   * Generate unique serial ID for user
   * Format: ORG_SHORT + COUNTER + NAME_CHARS + ADMISSION_YEAR + PASSOUT_YEAR
   * Example: JNV1234JMD0916
   *
   * @param {string} fullName - User's full name
   * @param {number} admissionYear - Admission year (e.g., 2009)
   * @param {number} passoutYear - Passout year (e.g., 2016)
   * @param {string} organizationId - Organization ID for multi-tenant support (optional for backward compatibility)
   * @returns {Promise<{serialId: string, counter: number}>}
   */
  static async generateSerialId(fullName, admissionYear, passoutYear, organizationId = null) {
    try {
      // Get organization details (use specific org if provided)
      const organization = await this.getOrganizationDetails(organizationId);

      if (!organization) {
        throw new Error('Organization details not found. Please configure organization settings first.');
      }

      // Get next serial counter (per-organization)
      const counter = await this.getNextSerialCounter(organization.id);

      // Extract meaningful characters from name
      const nameChars = this.extractNameCharacters(fullName);

      // Format year digits
      const admissionYearDigits = admissionYear.toString().slice(-2); // Last 2 digits
      const passoutYearDigits = passoutYear.toString().slice(-2);     // Last 2 digits

      // Construct serial ID
      const serialId = `${organization.shortName}${counter.toString().padStart(4, '0')}${nameChars}${admissionYearDigits}${passoutYearDigits}`;

      return {
        serialId,
        counter
      };

    } catch (error) {
      console.error('Serial ID generation error:', error);
      throw new Error(`Failed to generate serial ID: ${error.message}`);
    }
  }
  
  /**
   * Extract meaningful characters from user's full name
   * Format: First char of first name + First char of middle name (if exists) + First char of last name
   * 
   * @param {string} fullName - User's full name
   * @returns {string} - Extracted characters (e.g., "JMD" for "John Michael Doe")
   */
  static extractNameCharacters(fullName) {
    try {
      // Clean and split name
      const nameParts = fullName.trim().replace(/\s+/g, ' ').split(' ');
      
      if (nameParts.length === 0) {
        return 'XXX'; // Fallback
      }
      
      let nameChars = '';
      
      // First name - always take first character
      if (nameParts[0]) {
        nameChars += nameParts[0].charAt(0).toUpperCase();
      }
      
      if (nameParts.length === 2) {
        // Only first and last name
        nameChars += nameParts[1].charAt(0).toUpperCase();
      } else if (nameParts.length >= 3) {
        // Has middle name(s)
        // Take first char of first middle name
        nameChars += nameParts[1].charAt(0).toUpperCase();
        
        // Take first char of last name  
        nameChars += nameParts[nameParts.length - 1].charAt(0).toUpperCase();
      }
      
      // Ensure we have at least 2 characters, max 3
      if (nameChars.length === 1) {
        nameChars += 'X'; // Pad if only one name
      }
      
      // Remove any non-alphabetic characters
      nameChars = nameChars.replace(/[^A-Z]/g, '');
      
      // Ensure exactly 3 characters
      if (nameChars.length < 3) {
        nameChars = nameChars.padEnd(3, 'X');
      } else if (nameChars.length > 3) {
        nameChars = nameChars.substring(0, 3);
      }
      
      return nameChars;
      
    } catch (error) {
      console.error('Name character extraction error:', error);
      return 'XXX'; // Fallback
    }
  }
  
  /**
   * Get next serial counter (atomic increment) - per organization for multi-tenant
   * Counter is based on actual user count for the organization to ensure accuracy
   * @param {string} organizationId - Organization ID to increment counter for
   * @returns {Promise<number>} Next counter value
   */
  static async getNextSerialCounter(organizationId) {
    try {
      const orgId = organizationId || await this.getOrganizationId();
      const cacheKey = `system:serial_counter:${orgId}`;

      // Get actual user count for this organization (excluding developer accounts)
      const userCount = await prisma.user.count({
        where: {
          organizationId: orgId,
          role: { not: 'DEVELOPER' }
        }
      });

      // Next counter = current user count + 1 (for the new user being created)
      const nextCounter = userCount + 1;

      // Update organization's serialCounter to stay in sync
      await prisma.organization.update({
        where: { id: orgId },
        data: { serialCounter: nextCounter }
      });

      // Update cache
      await CacheService.set(cacheKey, nextCounter, 3600); // 1 hour

      return nextCounter;

    } catch (error) {
      console.error('Serial counter increment error:', error);
      throw new Error('Failed to generate serial counter');
    }
  }
  
  /**
   * Get organization details with caching - supports multi-tenant
   * @param {string} organizationId - Specific organization ID (optional, for multi-tenant)
   * @returns {Promise<Object>} Organization details
   */
  static async getOrganizationDetails(organizationId = null) {
    try {
      const cacheKey = organizationId
        ? `system:organization_details:${organizationId}`
        : 'system:organization_details';

      // Check cache first
      let organization = await CacheService.get(cacheKey);

      if (!organization) {
        // Get from database
        if (organizationId) {
          // Multi-tenant: fetch specific organization by ID
          organization = await prisma.organization.findUnique({
            where: { id: organizationId },
            select: {
              id: true,
              name: true,
              shortName: true,
              foundationYear: true,
              serialCounter: true
            }
          });
        } else {
          // Single-tenant fallback: fetch first active organization
          organization = await prisma.organization.findFirst({
            where: { isActive: true },
            select: {
              id: true,
              name: true,
              shortName: true,
              foundationYear: true,
              serialCounter: true
            }
          });
        }

        if (organization) {
          // Cache for 1 hour
          await CacheService.set(cacheKey, organization, 3600);
        }
      }

      return organization;

    } catch (error) {
      console.error('Get organization details error:', error);
      return null;
    }
  }
  
  /**
   * Get organization ID (helper method)
   * @returns {Promise<string>} Organization ID
   */
  static async getOrganizationId() {
    try {
      const cacheKey = 'system:organization_id';
      
      let orgId = await CacheService.get(cacheKey);
      
      if (!orgId) {
        const organization = await prisma.organization.findFirst({
          where: { isActive: true },
          select: { id: true }
        });
        
        if (organization) {
          orgId = organization.id;
          await CacheService.set(cacheKey, orgId, 86400); // 24 hours
        }
      }
      
      return orgId;
      
    } catch (error) {
      console.error('Get organization ID error:', error);
      throw new Error('Organization not configured');
    }
  }
  
  /**
   * Validate and ensure serial ID uniqueness
   * @param {string} proposedSerialId - Proposed serial ID
   * @param {number} maxAttempts - Maximum attempts to find unique ID
   * @returns {Promise<string>} Unique serial ID
   */
  static async ensureUniqueSerialId(proposedSerialId, maxAttempts = 999) {
    try {
      let serialId = proposedSerialId;
      let attempt = 0;
      
      while (attempt < maxAttempts) {
        // Check if serial ID already exists
        const existing = await prisma.user.findUnique({
          where: { serialId },
          select: { id: true }
        });
        
        if (!existing) {
          return serialId; // Unique ID found
        }
        
        // Generate variant for next attempt
        attempt++;
        const suffix = attempt.toString().padStart(2, '0');
        
        // Insert suffix before year digits (last 4 characters)
        const baseId = proposedSerialId.slice(0, -4);
        const yearDigits = proposedSerialId.slice(-4);
        serialId = `${baseId}${suffix}${yearDigits}`;
      }
      
      throw new Error(`Could not generate unique serial ID after ${maxAttempts} attempts`);
      
    } catch (error) {
      console.error('Serial ID uniqueness validation error:', error);
      throw error;
    }
  }
  
  /**
   * Complete serial ID generation with uniqueness check
   * @param {string} fullName - User's full name
   * @param {number} admissionYear - Admission year
   * @param {number} passoutYear - Passout year
   * @param {string} organizationId - Organization ID for multi-tenant support (optional)
   * @returns {Promise<{serialId: string, counter: number}>}
   */
  static async generateUniqueSerialId(fullName, admissionYear, passoutYear, organizationId = null) {
    try {
      // Generate base serial ID (pass organizationId for multi-tenant)
      const { serialId: baseSerialId, counter } = await this.generateSerialId(
        fullName,
        admissionYear,
        passoutYear,
        organizationId
      );

      // Ensure uniqueness
      const uniqueSerialId = await this.ensureUniqueSerialId(baseSerialId);

      return {
        serialId: uniqueSerialId,
        counter
      };

    } catch (error) {
      console.error('Generate unique serial ID error:', error);
      throw error;
    }
  }
  
  /**
   * Parse existing batch year to admission/passout years for migration
   * @param {number} batchYear - Current batch year (passout year)
   * @returns {Object} - Admission and passout years
   */
  static parseBatchYears(batchYear) {
    // JNV system: 7-year education (Class VI to XII)
    const passoutYear = batchYear;
    const admissionYear = batchYear - 7; // 7 years: 2016 - 7 = 2009 (2009-2016)
    
    return {
      admissionYear,
      passoutYear
    };
  }
  
  /**
   * Validate batch year format and extract admission/passout years
   * @param {number} batchYear - Batch year from registration
   * @returns {Object} - Validated years
   */
  static validateAndParseBatchYear(batchYear) {
    try {
      const currentYear = new Date().getFullYear();
      
      // Validate batch year range
      if (batchYear < 1950 || batchYear > currentYear + 10) {
        throw new Error('Invalid batch year. Please enter your passout year.');
      }
      
      const { admissionYear, passoutYear } = this.parseBatchYears(batchYear);
      
      // Additional validation
      if (admissionYear < 1944) { // JNV founded in 1944
        throw new Error('Invalid batch year. JNV was founded in 1944.');
      }
      
      return {
        admissionYear,
        passoutYear,
        isValid: true
      };
      
    } catch (error) {
      return {
        admissionYear: null,
        passoutYear: null,
        isValid: false,
        error: error.message
      };
    }
  }
  
  /**
   * Initialize organization data (for first-time setup)
   * @param {Object} orgData - Organization data
   * @returns {Promise<Object>} Created organization
   */
  static async initializeOrganization(orgData) {
    try {
      const {
        name = 'Jawahar Navodaya Vidyalaya Alumni',
        shortName = 'JNV',
        foundationYear = 1944,
        officialEmail,
        officialContactNumber,
        officeAddress
      } = orgData;
      
      // Check if organization already exists
      const existing = await prisma.organization.findFirst({
        where: { isActive: true }
      });
      
      if (existing) {
        throw new Error('Organization already configured');
      }
      
      const organization = await prisma.organization.create({
        data: {
          name,
          shortName,
          foundationYear,
          officialEmail,
          officialContactNumber,
          officeAddress,
          serialCounter: 0
        }
      });
      
      // Clear cache
      await CacheService.del('system:organization_details');
      await CacheService.del('system:organization_id');
      
      return organization;
      
    } catch (error) {
      console.error('Initialize organization error:', error);
      throw error;
    }
  }
  
  /**
   * Bulk generate serial IDs for existing users (migration utility)
   * @param {number} limit - Number of users to process in batch
   * @returns {Promise<Object>} Migration results
   */
  static async migrateExistingUsers(limit = 100) {
    try {
      const results = {
        processed: 0,
        success: 0,
        errors: 0,
        skipped: 0
      };
      
      // Get users without serial IDs
      const users = await prisma.user.findMany({
        where: {
          serialId: null,
          isActive: true,
          role: 'USER' // Only migrate regular users, not admins
        },
        select: {
          id: true,
          fullName: true,
          batch: true
        },
        take: limit,
        orderBy: { createdAt: 'asc' }
      });
      
      console.log(`Starting migration for ${users.length} users...`);
      
      for (const user of users) {
        try {
          results.processed++;
          
          // Skip if missing required data
          if (!user.fullName || !user.batch) {
            console.log(`Skipping user ${user.id}: Missing name or batch`);
            results.skipped++;
            continue;
          }
          
          // Parse batch years
          const { admissionYear, passoutYear } = this.parseBatchYears(user.batch);
          
          // Generate serial ID
          const { serialId, counter } = await this.generateUniqueSerialId(
            user.fullName,
            admissionYear,
            passoutYear
          );
          
          // Update user with serial ID and batch years
          await prisma.user.update({
            where: { id: user.id },
            data: {
              serialId,
              serialCounter: counter,
              admissionYear,
              passoutYear: passoutYear // Should match existing batch field
            }
          });
          
          console.log(`✅ Generated serial ID ${serialId} for ${user.fullName}`);
          results.success++;
          
        } catch (userError) {
          console.error(`❌ Error processing user ${user.id}:`, userError.message);
          results.errors++;
        }
      }
      
      console.log(`Migration completed: ${results.success} success, ${results.errors} errors, ${results.skipped} skipped`);
      return results;
      
    } catch (error) {
      console.error('Bulk migration error:', error);
      throw error;
    }
  }
  
  /**
   * Validate serial ID format  
   * @param {string} serialId - Serial ID to validate
   * @returns {Object} - Validation result with parsed components
   */
  static validateSerialIdFormat(serialId) {
    try {
      if (!serialId || typeof serialId !== 'string') {
        return { isValid: false, error: 'Serial ID is required' };
      }
      
      // Expected format: JNV1234JMD0916 (3+4+3+4 = 14 characters minimum)
      if (serialId.length < 10 || serialId.length > 20) {
        return { isValid: false, error: 'Invalid serial ID length' };
      }
      
      // Extract components using regex
      // Pattern: ORG(3+) + COUNTER(4) + NAME(2-4) + ADMISSION(2) + PASSOUT(2)
      const pattern = /^([A-Z]{2,5})(\d{4})([A-Z]{2,4})(\d{2})(\d{2})(.*)$/;
      const match = serialId.match(pattern);
      
      if (!match) {
        return { isValid: false, error: 'Invalid serial ID format' };
      }
      
      const [, orgCode, counter, nameChars, admissionDigits, passoutDigits, extra] = match;
      
      return {
        isValid: true,
        components: {
          organizationCode: orgCode,
          counter: parseInt(counter),
          nameCharacters: nameChars,
          admissionYear: 2000 + parseInt(admissionDigits), // Assuming 21st century
          passoutYear: 2000 + parseInt(passoutDigits),
          extraSuffix: extra || null
        }
      };
      
    } catch (error) {
      return { isValid: false, error: `Serial ID validation failed: ${error.message}` };
    }
  }
  
  /**
   * Calculate batch years from admission and passout years
   * @param {number} admissionYear - Admission year
   * @param {number} passoutYear - Passout year  
   * @returns {Object} - Batch information
   */
  static calculateBatchInfo(admissionYear, passoutYear) {
    try {
      const duration = passoutYear - admissionYear;
      
      // Validate duration (JNV is typically 6-7 years)
      if (duration < 4 || duration > 10) {
        console.warn(`Unusual batch duration: ${duration} years (${admissionYear}-${passoutYear})`);
      }
      
      return {
        admissionYear,
        passoutYear,
        batchDuration: duration,
        batchDisplayName: `${admissionYear}-${passoutYear.toString().slice(-2)}`, // 2009-16
        batchId: passoutYear // Use passout year as batch ID for compatibility
      };
      
    } catch (error) {
      console.error('Calculate batch info error:', error);
      return null;
    }
  }
  
  /**
   * Reverse engineer user info from serial ID
   * @param {string} serialId - Serial ID to parse
   * @returns {Object} - Parsed user information
   */
  static parseSerialId(serialId) {
    try {
      const validation = this.validateSerialIdFormat(serialId);
      
      if (!validation.isValid) {
        return { success: false, error: validation.error };
      }
      
      const { components } = validation;
      const batchInfo = this.calculateBatchInfo(
        components.admissionYear,
        components.passoutYear
      );
      
      return {
        success: true,
        userInfo: {
          organizationCode: components.organizationCode,
          registrationNumber: components.counter,
          nameInitials: components.nameCharacters,
          ...batchInfo
        }
      };
      
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Get serial ID statistics
   * @returns {Promise<Object>} - Serial ID statistics
   */
  static async getSerialIdStats() {
    try {
      const [
        totalGenerated,
        orgDetails,
        batchWiseCount
      ] = await Promise.all([
        // Total users with serial IDs
        prisma.user.count({
          where: {
            serialId: { not: null },
            isActive: true
          }
        }),
        
        // Organization details
        this.getOrganizationDetails(),
        
        // Batch-wise serial ID count
        prisma.user.groupBy({
          by: ['batch'],
          where: {
            serialId: { not: null },
            isActive: true
          },
          _count: { serialId: true },
          orderBy: { batch: 'desc' }
        })
      ]);
      
      return {
        totalGenerated,
        currentCounter: orgDetails?.serialCounter || 0,
        organizationCode: orgDetails?.shortName || 'N/A',
        batchDistribution: batchWiseCount.map(item => ({
          batch: item.batch,
          count: item._count.serialId
        }))
      };
      
    } catch (error) {
      console.error('Get serial ID stats error:', error);
      throw error;
    }
  }
}

module.exports = SerialIdService;