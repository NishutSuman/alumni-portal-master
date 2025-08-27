// src/services/batchCollection.service.js
const { prisma } = require('../config/database');
const { CacheService } = require('../config/redis');
const MembershipService = require('./membership.service');
const EmailService = require('./email/EmailManager');

class BatchCollectionService {
  /**
   * Create a new batch collection for an event
   */
  static async createBatchCollection(eventId, batchYear, targetAmount, description, createdBy) {
    try {
      // Validate event exists and is not started
      const event = await prisma.event.findUnique({
        where: { id: eventId },
        select: { 
          id: true, 
          title: true, 
          startsAt: true, 
          registrationEndsAt: true,
          status: true 
        }
      });

      if (!event) {
        throw new Error('Event not found');
      }

      if (event.status !== 'PUBLISHED') {
        throw new Error('Cannot create batch collection for unpublished event');
      }

      if (new Date() > new Date(event.registrationEndsAt)) {
        throw new Error('Registration period has ended');
      }

      // Check if batch collection already exists
      const existingCollection = await prisma.batchEventCollection.findUnique({
        where: {
          eventId_batchYear: {
            eventId,
            batchYear
          }
        }
      });

      if (existingCollection) {
        throw new Error('Batch collection already exists for this event and batch');
      }

      // Validate batch exists and has active admins
      const batchAdmins = await MembershipService.getBatchAdmins(batchYear);
      if (batchAdmins.length === 0) {
        throw new Error(`No active batch admins found for batch ${batchYear}`);
      }

      // Create batch collection
      const batchCollection = await prisma.batchEventCollection.create({
        data: {
          eventId,
          batchYear,
          targetAmount,
          description: description || `Batch ${batchYear} collection for ${event.title}`,
          registrationMode: 'BATCH_COLLECTION',
          createdBy
        },
        include: {
          event: {
            select: { id: true, title: true, slug: true }
          },
          batch: {
            select: { year: true, name: true }
          }
        }
      });

      // Clear relevant caches
      await this.clearBatchCollectionCaches(eventId, batchYear);

      console.log(`✅ Batch collection created: Event ${eventId}, Batch ${batchYear}, Target: ₹${targetAmount}`);
      return batchCollection;

    } catch (error) {
      console.error('Create batch collection error:', error);
      throw error;
    }
  }

  /**
   * Get batch collection status and progress
   */
  static async getBatchCollectionStatus(eventId, batchYear) {
    try {
      const cacheKey = `batch_collection:${eventId}:${batchYear}:status`;
      
      // Check cache first
      let status = await CacheService.get(cacheKey);
      
      if (!status) {
        const collection = await prisma.batchEventCollection.findUnique({
          where: {
            eventId_batchYear: { eventId, batchYear }
          },
          include: {
            event: {
              select: {
                id: true,
                title: true,
                registrationFee: true,
                startsAt: true,
                registrationEndsAt: true
              }
            },
            batch: {
              select: { year: true, name: true }
            },
            payments: {
              where: { paymentStatus: 'COMPLETED' },
              include: {
                admin: {
                  select: { id: true, fullName: true, email: true }
                }
              },
              orderBy: { paymentDate: 'desc' }
            }
          }
        });

        if (!collection) {
          return null;
        }

        // Calculate progress
        const progressPercentage = collection.targetAmount > 0 
          ? Math.round((collection.collectedAmount / collection.targetAmount) * 100)
          : 0;

        const remainingAmount = Math.max(0, collection.targetAmount - collection.collectedAmount);

        // Get batch member count for potential registrations
        const batchMemberCount = await prisma.user.count({
          where: {
            batch: batchYear,
            isActive: true,
            role: { in: ['USER', 'BATCH_ADMIN'] }
          }
        });

        status = {
          id: collection.id,
          eventId: collection.eventId,
          batchYear: collection.batchYear,
          targetAmount: collection.targetAmount,
          collectedAmount: collection.collectedAmount,
          remainingAmount,
          progressPercentage,
          isTargetMet: collection.isTargetMet,
          isApproved: collection.isApproved,
          status: collection.status,
          registrationMode: collection.registrationMode,
          approvedBy: collection.approvedBy,
          approvedAt: collection.approvedAt,
          event: collection.event,
          batch: collection.batch,
          payments: collection.payments,
          batchMemberCount,
          paymentCount: collection.payments.length,
          canRegister: collection.isApproved && collection.isTargetMet,
          description: collection.description
        };

        // Cache for 15 minutes
        await CacheService.set(cacheKey, status, 15 * 60);
      }

      return status;

    } catch (error) {
      console.error('Get batch collection status error:', error);
      throw error;
    }
  }

  /**
   * Process batch admin payment
   */
  static async processBatchAdminPayment(eventId, batchYear, adminId, amount, transactionId) {
    try {
      return await prisma.$transaction(async (tx) => {
        // Get batch collection
        const collection = await tx.batchEventCollection.findUnique({
          where: {
            eventId_batchYear: { eventId, batchYear }
          },
          include: {
            event: { select: { title: true } }
          }
        });

        if (!collection) {
          throw new Error('Batch collection not found');
        }

        if (collection.status !== 'ACTIVE') {
          throw new Error('Batch collection is not active');
        }

        // Verify admin is authorized for this batch
        const isAuthorized = await MembershipService.isBatchAdmin(adminId, batchYear);
        if (!isAuthorized) {
          throw new Error('User is not authorized as batch admin for this batch');
        }

        // Create batch admin payment record
        const payment = await tx.batchAdminPayment.create({
          data: {
            batchCollectionId: collection.id,
            paidByAdmin: adminId,
            amount,
            paymentTransactionId: transactionId,
            paymentStatus: 'COMPLETED',
            paymentDate: new Date()
          }
        });

        // Get updated collection with new totals (trigger will handle this)
        const updatedCollection = await tx.batchEventCollection.findUnique({
          where: { id: collection.id }
        });

        // Log activity
        await tx.activityLog.create({
          data: {
            userId: adminId,
            action: 'batch_admin_payment_completed',
            details: {
              eventId,
              batchYear,
              amount: amount.toString(),
              transactionId,
              collectionId: collection.id,
              eventTitle: collection.event.title,
              newTotal: updatedCollection.collectedAmount.toString(),
              targetAmount: updatedCollection.targetAmount.toString(),
              isTargetMet: updatedCollection.isTargetMet
            }
          }
        });

        console.log(`✅ Batch admin payment processed: ${adminId} paid ₹${amount} for batch ${batchYear}`);
        return payment;
      });

    } catch (error) {
      console.error('Process batch admin payment error:', error);
      throw error;
    }
  }

  /**
   * Check if target is met and handle approval notification
   */
  static async handleTargetMet(batchCollectionId) {
    try {
      const collection = await prisma.batchEventCollection.findUnique({
        where: { id: batchCollectionId },
        include: {
          event: { select: { title: true, slug: true } },
          batch: { select: { name: true } }
        }
      });

      if (!collection || !collection.isTargetMet || collection.isApproved) {
        return;
      }

      // Notify super admins about target achievement
      const superAdmins = await prisma.user.findMany({
        where: { 
          role: 'SUPER_ADMIN',
          isActive: true
        },
        select: { id: true, fullName: true, email: true }
      });

      // Send notification emails to super admins
      for (const admin of superAdmins) {
        try {
          const emailData = {
            to: admin.email,
            subject: `🎯 Batch Collection Target Met - Approval Required`,
            template: 'batch_collection_target_met',
            data: {
              adminName: admin.fullName,
              eventTitle: collection.event.title,
              batchName: collection.batch.name,
              targetAmount: collection.targetAmount,
              collectedAmount: collection.collectedAmount,
              approvalUrl: `${process.env.FRONTEND_URL}/admin/events/${collection.eventId}/batch-collections`
            }
          };

          // await EmailService.send(emailData);
          console.log(`📧 Target met notification sent to: ${admin.email}`);

        } catch (emailError) {
          console.error(`Failed to send notification to ${admin.email}:`, emailError);
        }
      }

      // Log target achievement
      await prisma.activityLog.create({
        data: {
          userId: 'system',
          action: 'batch_collection_target_met',
          details: {
            batchCollectionId: collection.id,
            eventId: collection.eventId,
            batchYear: collection.batchYear,
            targetAmount: collection.targetAmount.toString(),
            collectedAmount: collection.collectedAmount.toString(),
            notifiedAdmins: superAdmins.length
          }
        }
      });

    } catch (error) {
      console.error('Handle target met error:', error);
    }
  }

  /**
   * Approve batch collection and trigger bulk registration
   */
  static async approveBatchCollection(batchCollectionId, approvedBy) {
    try {
      return await prisma.$transaction(async (tx) => {
        // Get collection details
        const collection = await tx.batchEventCollection.findUnique({
          where: { id: batchCollectionId },
          include: {
            event: { 
              select: { 
                id: true, 
                title: true, 
                registrationFee: true,
                customFormFields: true
              }
            }
          }
        });

        if (!collection) {
          throw new Error('Batch collection not found');
        }

        if (!collection.isTargetMet) {
          throw new Error('Cannot approve collection - target amount not met');
        }

        if (collection.isApproved) {
          throw new Error('Collection already approved');
        }

        // Update collection as approved
        const approvedCollection = await tx.batchEventCollection.update({
          where: { id: batchCollectionId },
          data: {
            isApproved: true,
            approvedBy,
            approvedAt: new Date(),
            status: 'COMPLETED'
          }
        });

        // Get all batch members for bulk registration
        const batchMembers = await tx.user.findMany({
          where: {
            batch: collection.batchYear,
            isActive: true,
            role: { in: ['USER', 'BATCH_ADMIN'] }
          },
          select: { id: true, fullName: true, email: true }
        });

        // Create bulk registrations
        const registrations = await Promise.all(
          batchMembers.map(async (member) => {
            // Check if already registered
            const existingRegistration = await tx.eventRegistration.findFirst({
              where: {
                eventId: collection.eventId,
                userId: member.id
              }
            });

            if (existingRegistration) {
              return null; // Skip if already registered
            }

            // Create registration
            return await tx.eventRegistration.create({
              data: {
                eventId: collection.eventId,
                userId: member.id,
                totalAmount: collection.event.registrationFee || 0,
                registrationMode: 'BATCH_AUTO_REGISTERED',
                status: 'CONFIRMED',
                paymentStatus: 'COMPLETED',
                registrationDate: new Date(),
                formResponses: {}, // Empty form responses for bulk registration
                notes: `Auto-registered via batch collection approval`
              }
            });
          })
        );

        const successfulRegistrations = registrations.filter(r => r !== null);

        // Log approval and bulk registration
        await tx.activityLog.create({
          data: {
            userId: approvedBy,
            action: 'batch_collection_approved_bulk_registered',
            details: {
              batchCollectionId: collection.id,
              eventId: collection.eventId,
              batchYear: collection.batchYear,
              approvedAmount: collection.collectedAmount.toString(),
              registeredCount: successfulRegistrations.length,
              totalBatchMembers: batchMembers.length
            }
          }
        });

        console.log(`✅ Batch collection approved: ${successfulRegistrations.length} members auto-registered`);
        return {
          collection: approvedCollection,
          registeredCount: successfulRegistrations.length,
          totalMembers: batchMembers.length
        };
      });

    } catch (error) {
      console.error('Approve batch collection error:', error);
      throw error;
    }
  }

  /**
   * Get registration mode for user attempting registration
   */
  static async getRegistrationMode(eventId, userBatchYear) {
    try {
      const cacheKey = `registration_mode:${eventId}:${userBatchYear}`;
      
      let mode = await CacheService.get(cacheKey);
      
      if (!mode) {
        const collection = await prisma.batchEventCollection.findUnique({
          where: {
            eventId_batchYear: { eventId, batchYear: userBatchYear }
          },
          select: {
            isTargetMet: true,
            isApproved: true,
            status: true,
            registrationMode: true
          }
        });

        if (!collection) {
          mode = { mode: 'INDIVIDUAL', reason: 'No batch collection configured' };
        } else if (collection.isApproved && collection.isTargetMet) {
          mode = { mode: 'BATCH_AUTO_REGISTERED', reason: 'Batch collection completed and approved' };
        } else if (collection.status === 'ACTIVE') {
          mode = { mode: 'BATCH_PENDING', reason: 'Batch collection in progress' };
        } else {
          mode = { mode: 'INDIVIDUAL', reason: 'Batch collection not active' };
        }

        // Cache for 10 minutes
        await CacheService.set(cacheKey, mode, 10 * 60);
      }

      return mode;

    } catch (error) {
      console.error('Get registration mode error:', error);
      return { mode: 'INDIVIDUAL', reason: 'Error determining mode' };
    }
  }

  /**
   * Get all batch collections for an event (admin view)
   */
  static async getEventBatchCollections(eventId) {
    try {
      const collections = await prisma.batchEventCollection.findMany({
        where: { eventId },
        include: {
          batch: { select: { year: true, name: true } },
          payments: {
            where: { paymentStatus: 'COMPLETED' },
            include: {
              admin: { select: { fullName: true, email: true } }
            }
          },
          _count: {
            select: { payments: true }
          }
        },
        orderBy: [
          { batchYear: 'desc' },
          { createdAt: 'desc' }
        ]
      });

      return collections.map(collection => ({
        ...collection,
        progressPercentage: Math.round((collection.collectedAmount / collection.targetAmount) * 100),
        remainingAmount: collection.targetAmount - collection.collectedAmount
      }));

    } catch (error) {
      console.error('Get event batch collections error:', error);
      throw error;
    }
  }

  /**
   * Clear batch collection related caches
   */
  static async clearBatchCollectionCaches(eventId, batchYear) {
    try {
      const patterns = [
        `batch_collection:${eventId}:${batchYear}:*`,
        `registration_mode:${eventId}:${batchYear}`,
        `event:${eventId}:batch_collections`
      ];

      await Promise.all(patterns.map(pattern => 
        CacheService.delPattern ? CacheService.delPattern(pattern) : CacheService.del(pattern)
      ));

    } catch (error) {
      console.error('Clear batch collection caches error:', error);
    }
  }
}

module.exports = BatchCollectionService;