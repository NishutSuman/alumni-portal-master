// src/services/export/ExportService.js
const XLSX = require('xlsx');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const json2csv = require('json2csv').parse;
const fs = require('fs');
const path = require('path');
const { prisma } = require('../../config/database');
const { CacheService } = require('../../config/redis');

class ExportService {
  constructor() {
    this.cacheKeys = {
      export: (eventId, type, format) => `export:${eventId}:${type}:${format}`,
      batchReport: (batchYear, format) => `export:batch:${batchYear}:${format}`,
    };

    // Ensure export directory exists
    this.exportDir = path.join(process.cwd(), 'public', 'exports');
    if (!fs.existsSync(this.exportDir)) {
      fs.mkdirSync(this.exportDir, { recursive: true });
    }
  }

  // ==========================================
  // COMPLETE EVENT REPORT
  // ==========================================

  async exportCompleteEventReport(eventId, format = 'csv') {
    try {
      const cacheKey = this.cacheKeys.export(eventId, 'complete', format);
      
      // Check cache (shorter TTL for large reports)
      const cached = await CacheService.get(cacheKey);
      if (cached) return cached;

      // Get comprehensive event data
      const eventData = await this.getCompleteEventData(eventId);
      
      if (!eventData.event) {
        throw new Error('Event not found');
      }

      // Generate report based on format
      let result;
      if (format.toLowerCase() === 'xlsx' || format.toLowerCase() === 'excel') {
        result = await this.generateCompleteReportExcel(eventData);
      } else {
        result = await this.generateCompleteReportCSV(eventData);
      }

      // Cache for 10 minutes (large reports shouldn't be cached too long)
      await CacheService.set(cacheKey, result, 10 * 60);
      
      return result;

    } catch (error) {
      console.error('Complete event report export error:', error);
      throw error;
    }
  }

  // ==========================================
  // REGISTRATION LIST EXPORT
  // ==========================================

  async exportRegistrationList(eventId, format = 'csv', options = {}) {
    try {
      const cacheKey = this.cacheKeys.export(eventId, `registrations_${JSON.stringify(options)}`, format);
      
      const cached = await CacheService.get(cacheKey);
      if (cached) return cached;

      // Get registration data with custom fields
      const registrationData = await this.getRegistrationData(eventId, options);

      let result;
      if (format.toLowerCase() === 'xlsx' || format.toLowerCase() === 'excel') {
        result = await this.generateRegistrationExcel(registrationData);
      } else {
        result = await this.generateRegistrationCSV(registrationData);
      }

      // Cache for 15 minutes
      await CacheService.set(cacheKey, result, 15 * 60);
      
      return result;

    } catch (error) {
      console.error('Registration list export error:', error);
      throw error;
    }
  }

  // ==========================================
  // FINANCIAL REPORT EXPORT
  // ==========================================

  async exportFinancialReport(eventId, format = 'csv') {
    try {
      const cacheKey = this.cacheKeys.export(eventId, 'financial', format);
      
      const cached = await CacheService.get(cacheKey);
      if (cached) return cached;

      // Get financial data
      const financialData = await this.getFinancialData(eventId);

      let result;
      if (format.toLowerCase() === 'xlsx' || format.toLowerCase() === 'excel') {
        result = await this.generateFinancialReportExcel(financialData);
      } else {
        result = await this.generateFinancialReportCSV(financialData);
      }

      // Cache for 20 minutes (financial data changes less frequently)
      await CacheService.set(cacheKey, result, 20 * 60);
      
      return result;

    } catch (error) {
      console.error('Financial report export error:', error);
      throw error;
    }
  }

  // ==========================================
  // ATTENDANCE REPORT EXPORT
  // ==========================================

  async exportAttendanceReport(eventId, format = 'csv') {
    try {
      const cacheKey = this.cacheKeys.export(eventId, 'attendance', format);
      
      const cached = await CacheService.get(cacheKey);
      if (cached) return cached;

      // Get attendance data
      const attendanceData = await this.getAttendanceData(eventId);

      let result;
      if (format.toLowerCase() === 'xlsx' || format.toLowerCase() === 'excel') {
        result = await this.generateAttendanceReportExcel(attendanceData);
      } else {
        result = await this.generateAttendanceReportCSV(attendanceData);
      }

      // Cache for 5 minutes (attendance data is live)
      await CacheService.set(cacheKey, result, 5 * 60);
      
      return result;

    } catch (error) {
      console.error('Attendance report export error:', error);
      throw error;
    }
  }

  // ==========================================
  // MERCHANDISE REPORT EXPORT
  // ==========================================

  async exportMerchandiseReport(eventId, format = 'csv') {
    try {
      const cacheKey = this.cacheKeys.export(eventId, 'merchandise', format);
      
      const cached = await CacheService.get(cacheKey);
      if (cached) return cached;

      // Get merchandise data
      const merchandiseData = await this.getMerchandiseData(eventId);

      let result;
      if (format.toLowerCase() === 'xlsx' || format.toLowerCase() === 'excel') {
        result = await this.generateMerchandiseReportExcel(merchandiseData);
      } else {
        result = await this.generateMerchandiseReportCSV(merchandiseData);
      }

      // Cache for 15 minutes
      await CacheService.set(cacheKey, result, 15 * 60);
      
      return result;

    } catch (error) {
      console.error('Merchandise report export error:', error);
      throw error;
    }
  }

  // ==========================================
  // BATCH-WISE REPORT EXPORT
  // ==========================================

  async exportBatchReport(batchYear, format = 'csv') {
    try {
      const cacheKey = this.cacheKeys.batchReport(batchYear, format);
      
      const cached = await CacheService.get(cacheKey);
      if (cached) return cached;

      // Get batch participation data
      const batchData = await this.getBatchData(batchYear);

      let result;
      if (format.toLowerCase() === 'xlsx' || format.toLowerCase() === 'excel') {
        result = await this.generateBatchReportExcel(batchData);
      } else {
        result = await this.generateBatchReportCSV(batchData);
      }

      // Cache for 1 hour (batch data changes slowly)
      await CacheService.set(cacheKey, result, 60 * 60);
      
      return result;

    } catch (error) {
      console.error('Batch report export error:', error);
      throw error;
    }
  }

  // ==========================================
  // DATA FETCHING METHODS
  // ==========================================

  async getCompleteEventData(eventId) {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        category: true,
        creator: {
          select: { fullName: true, email: true }
        },
        registrations: {
          include: {
            user: {
              select: {
                fullName: true,
                email: true,
                whatsappNumber: true,
                batch: true,
                profileImage: true
              }
            },
            guests: {
              where: { status: 'ACTIVE' }
            },
            merchandiseOrders: {
              include: {
                merchandise: {
                  select: { name: true }
                }
              }
            },
            formResponses: {
              include: {
                field: {
                  select: { fieldName: true, fieldLabel: true, fieldType: true }
                }
              }
            },
            checkIns: true,
            qr: true
          }
        },
        merchandise: true,
        form: {
          include: {
            fields: {
              orderBy: { orderIndex: 'asc' }
            }
          }
        },
        analytics: true
      }
    });

    return { event };
  }

  async getRegistrationData(eventId, options = {}) {
    const { includeGuests = true, includeCustomFields = true, status = 'CONFIRMED' } = options;

    const registrations = await prisma.eventRegistration.findMany({
      where: {
        eventId,
        ...(status && { status })
      },
      include: {
        user: {
          select: {
            fullName: true,
            email: true,
            whatsappNumber: true,
            batch: true,
            alternateNumber: true
          }
        },
        event: {
          select: {
            title: true,
            eventDate: true,
            venue: true
          }
        },
        ...(includeGuests && {
          guests: {
            where: { status: 'ACTIVE' }
          }
        }),
        ...(includeCustomFields && {
          formResponses: {
            include: {
              field: {
                select: { fieldName: true, fieldLabel: true, fieldType: true }
              }
            }
          }
        }),
        merchandiseOrders: {
          include: {
            merchandise: {
              select: { name: true }
            }
          }
        },
        checkIns: true
      },
      orderBy: { registrationDate: 'asc' }
    });

    return { registrations, eventId };
  }

  async getFinancialData(eventId) {
    const [event, registrations, merchandiseOrders, analytics] = await Promise.all([
      prisma.event.findUnique({
        where: { id: eventId },
        select: {
          title: true,
          eventDate: true,
          registrationFee: true,
          guestFee: true
        }
      }),

      prisma.eventRegistration.findMany({
        where: { eventId },
        select: {
          id: true,
          user: {
            select: { fullName: true, email: true, batch: true }
          },
          totalAmount: true,
          registrationFeePaid: true,
          guestFeesPaid: true,
          merchandiseTotal: true,
          donationAmount: true,
          paymentStatus: true,
          registrationDate: true,
          totalGuests: true
        }
      }),

      prisma.eventMerchandiseOrder.findMany({
        where: {
          registration: { eventId }
        },
        include: {
          merchandise: {
            select: { name: true, price: true }
          },
          registration: {
            select: {
              user: {
                select: { fullName: true }
              }
            }
          }
        }
      }),

      prisma.eventAnalytics.findUnique({
        where: { eventId }
      })
    ]);

    return { event, registrations, merchandiseOrders, analytics };
  }

  async getAttendanceData(eventId) {
    const [event, checkIns, registrations] = await Promise.all([
      prisma.event.findUnique({
        where: { id: eventId },
        select: {
          title: true,
          eventDate: true,
          venue: true,
          maxCapacity: true
        }
      }),

      prisma.eventCheckIn.findMany({
        where: {
          registration: { eventId }
        },
        include: {
          registration: {
            include: {
              user: {
                select: {
                  fullName: true,
                  email: true,
                  batch: true,
                  whatsappNumber: true
                }
              }
            }
          },
          checkedInStaff: {
            select: { fullName: true }
          }
        },
        orderBy: { checkedInAt: 'asc' }
      }),

      prisma.eventRegistration.count({
        where: { eventId, status: 'CONFIRMED' }
      })
    ]);

    return { event, checkIns, totalRegistrations: registrations };
  }

  async getMerchandiseData(eventId) {
    const [event, orders, merchandise] = await Promise.all([
      prisma.event.findUnique({
        where: { id: eventId },
        select: { title: true, eventDate: true }
      }),

      prisma.eventMerchandiseOrder.findMany({
        where: {
          registration: { eventId }
        },
        include: {
          merchandise: true,
          registration: {
            include: {
              user: {
                select: {
                  fullName: true,
                  email: true,
                  batch: true,
                  whatsappNumber: true
                }
              }
            }
          },
          delivery: true
        },
        orderBy: { createdAt: 'asc' }
      }),

      prisma.eventMerchandise.findMany({
        where: { eventId },
        include: {
          _count: {
            select: {
              orders: {
                where: {
                  paymentStatus: 'COMPLETED'
                }
              }
            }
          }
        }
      })
    ]);

    return { event, orders, merchandise };
  }

  async getBatchData(batchYear) {
    const batchMembers = await prisma.user.findMany({
      where: {
        batch: parseInt(batchYear),
        isActive: true
      },
      include: {
        eventRegistrations: {
          where: { status: 'CONFIRMED' },
          include: {
            event: {
              select: {
                title: true,
                eventDate: true,
                category: {
                  select: { name: true }
                }
              }
            }
          }
        }
      },
      orderBy: { fullName: 'asc' }
    });

    return { batchYear: parseInt(batchYear), members: batchMembers };
  }

  // ==========================================
  // CSV GENERATION METHODS
  // ==========================================

  async generateCompleteReportCSV(data) {
    const { event } = data;
    
    // Create comprehensive CSV with multiple sections
    const csvData = [];
    
    // Event Overview Section
    csvData.push(['=== EVENT OVERVIEW ===']);
    csvData.push(['Event Title', event.title]);
    csvData.push(['Event Date', new Date(event.eventDate).toLocaleDateString()]);
    csvData.push(['Event Category', event.category.name]);
    csvData.push(['Event Mode', event.eventMode]);
    csvData.push(['Venue', event.venue || 'N/A']);
    csvData.push(['Max Capacity', event.maxCapacity || 'Unlimited']);
    csvData.push(['Total Registrations', event.registrations.length]);
    csvData.push(['Created By', event.creator.fullName]);
    csvData.push([]);

    // Registration Details
    csvData.push(['=== REGISTRATION DETAILS ===']);
    const regHeaders = [
      'S.No', 'Full Name', 'Email', 'WhatsApp', 'Batch', 'Registration Date',
      'Payment Status', 'Total Amount', 'Guest Count', 'Meal Preference', 'Check-in Status'
    ];

    // Add custom form field headers
    if (event.form && event.form.fields.length > 0) {
      event.form.fields.forEach(field => {
        regHeaders.push(field.fieldLabel);
      });
    }

    csvData.push(regHeaders);

    event.registrations.forEach((reg, index) => {
      const row = [
        index + 1,
        reg.user.fullName,
        reg.user.email,
        reg.user.whatsappNumber || 'N/A',
        reg.user.batch,
        new Date(reg.registrationDate).toLocaleDateString(),
        reg.paymentStatus,
        `₹${reg.totalAmount}`,
        reg.totalGuests,
        reg.mealPreference || 'N/A',
        reg.checkIns.length > 0 ? 'Checked In' : 'Not Checked In'
      ];

      // Add custom form responses
      if (event.form && event.form.fields.length > 0) {
        event.form.fields.forEach(field => {
          const response = reg.formResponses.find(fr => fr.field.fieldName === field.fieldName);
          row.push(response ? response.response : 'N/A');
        });
      }

      csvData.push(row);
    });

    // Convert to CSV string
    return this.arrayToCSV(csvData);
  }

  async generateRegistrationCSV(data) {
    const { registrations } = data;

    if (registrations.length === 0) {
      return 'No registrations found for this event.';
    }

    const headers = [
      'S.No', 'Full Name', 'Email', 'WhatsApp Number', 'Alternate Number', 'Batch',
      'Registration Date', 'Payment Status', 'Registration Fee', 'Guest Fees',
      'Merchandise Total', 'Donation Amount', 'Total Amount', 'Guest Count',
      'Meal Preference', 'Check-in Status', 'Check-in Time'
    ];

    // Add custom form field headers
    const customFields = [];
    if (registrations[0]?.formResponses.length > 0) {
      const uniqueFields = new Set();
      registrations.forEach(reg => {
        reg.formResponses.forEach(fr => {
          if (!uniqueFields.has(fr.field.fieldName)) {
            uniqueFields.add(fr.field.fieldName);
            customFields.push({
              name: fr.field.fieldName,
              label: fr.field.fieldLabel
            });
          }
        });
      });
    }

    customFields.forEach(field => {
      headers.push(field.label);
    });

    // Guest information headers
    headers.push('Guest Names', 'Guest Details Count');

    const csvData = [headers];

    registrations.forEach((reg, index) => {
      const checkIn = reg.checkIns[0];
      const guestNames = reg.guests.map(g => g.name).join('; ');
      
      const row = [
        index + 1,
        reg.user.fullName,
        reg.user.email,
        reg.user.whatsappNumber || 'N/A',
        reg.user.alternateNumber || 'N/A',
        reg.user.batch,
        new Date(reg.registrationDate).toLocaleDateString(),
        reg.paymentStatus,
        `₹${reg.registrationFeePaid}`,
        `₹${reg.guestFeesPaid}`,
        `₹${reg.merchandiseTotal}`,
        `₹${reg.donationAmount}`,
        `₹${reg.totalAmount}`,
        reg.totalGuests,
        reg.mealPreference || 'N/A',
        checkIn ? 'Checked In' : 'Not Checked In',
        checkIn ? new Date(checkIn.checkedInAt).toLocaleString() : 'N/A'
      ];

      // Add custom field responses
      customFields.forEach(field => {
        const response = reg.formResponses.find(fr => fr.field.fieldName === field.name);
        row.push(response ? response.response : 'N/A');
      });

      // Add guest information
      row.push(guestNames || 'No Guests');
      row.push(reg.guests.length);

      csvData.push(row);
    });

    return this.arrayToCSV(csvData);
  }

  async generateFinancialReportCSV(data) {
    const { event, registrations, merchandiseOrders, analytics } = data;

    const csvData = [];
    
    // Financial Summary Section
    csvData.push(['=== FINANCIAL SUMMARY ===']);
    csvData.push(['Event', event.title]);
    csvData.push(['Event Date', new Date(event.eventDate).toLocaleDateString()]);
    csvData.push([]);

    if (analytics) {
      csvData.push(['Total Revenue', `₹${analytics.totalRevenue}`]);
      csvData.push(['Registration Revenue', `₹${analytics.registrationRevenue}`]);
      csvData.push(['Merchandise Revenue', `₹${analytics.merchandiseRevenue}`]);
      csvData.push(['Donation Revenue', `₹${analytics.donationRevenue}`]);
      csvData.push(['Total Registrations', analytics.totalRegistrations]);
      csvData.push(['Average Order Value', `₹${analytics.averageOrderValue}`]);
    }
    csvData.push([]);

    // Individual Registration Payments
    csvData.push(['=== REGISTRATION PAYMENTS ===']);
    csvData.push([
      'S.No', 'Name', 'Email', 'Batch', 'Registration Fee', 'Guest Fees',
      'Merchandise Total', 'Donation Amount', 'Total Amount', 'Payment Status',
      'Registration Date', 'Guest Count'
    ]);

    registrations.forEach((reg, index) => {
      csvData.push([
        index + 1,
        reg.user.fullName,
        reg.user.email,
        reg.user.batch,
        `₹${reg.registrationFeePaid}`,
        `₹${reg.guestFeesPaid}`,
        `₹${reg.merchandiseTotal}`,
        `₹${reg.donationAmount}`,
        `₹${reg.totalAmount}`,
        reg.paymentStatus,
        new Date(reg.registrationDate).toLocaleDateString(),
        reg.totalGuests
      ]);
    });

    csvData.push([]);

    // Merchandise Orders Section
    if (merchandiseOrders.length > 0) {
      csvData.push(['=== MERCHANDISE ORDERS ===']);
      csvData.push([
        'S.No', 'Customer Name', 'Merchandise Item', 'Quantity', 'Selected Size',
        'Unit Price', 'Total Price', 'Order Date', 'Payment Status'
      ]);

      merchandiseOrders.forEach((order, index) => {
        csvData.push([
          index + 1,
          order.registration.user.fullName,
          order.merchandise.name,
          order.quantity,
          order.selectedSize || 'N/A',
          `₹${order.unitPrice}`,
          `₹${order.totalPrice}`,
          new Date(order.createdAt).toLocaleDateString(),
          order.paymentStatus
        ]);
      });
    }

    return this.arrayToCSV(csvData);
  }

  async generateAttendanceReportCSV(data) {
    const { event, checkIns, totalRegistrations } = data;

    const csvData = [];

    // Attendance Summary
    csvData.push(['=== ATTENDANCE SUMMARY ===']);
    csvData.push(['Event', event.title]);
    csvData.push(['Event Date', new Date(event.eventDate).toLocaleDateString()]);
    csvData.push(['Venue', event.venue || 'N/A']);
    csvData.push(['Total Registrations', totalRegistrations]);
    csvData.push(['Total Check-ins', checkIns.length]);
    csvData.push(['Attendance Rate', `${totalRegistrations > 0 ? Math.round((checkIns.length / totalRegistrations) * 100) : 0}%`]);
    csvData.push([]);

    // Individual Check-ins
    csvData.push(['=== CHECK-IN DETAILS ===']);
    csvData.push([
      'S.No', 'Name', 'Email', 'Batch', 'WhatsApp', 'Check-in Time',
      'Guests Checked In', 'Total Guests', 'Check-in Location',
      'Checked In By', 'Notes'
    ]);

    checkIns.forEach((checkIn, index) => {
      csvData.push([
        index + 1,
        checkIn.registration.user.fullName,
        checkIn.registration.user.email,
        checkIn.registration.user.batch,
        checkIn.registration.user.whatsappNumber || 'N/A',
        new Date(checkIn.checkedInAt).toLocaleString(),
        checkIn.guestsCheckedIn,
        checkIn.totalGuests,
        checkIn.checkInLocation || 'N/A',
        checkIn.checkedInStaff?.fullName || 'System',
        checkIn.notes || 'N/A'
      ]);
    });

    return this.arrayToCSV(csvData);
  }

  async generateMerchandiseReportCSV(data) {
    const { event, orders, merchandise } = data;

    const csvData = [];

    // Merchandise Summary
    csvData.push(['=== MERCHANDISE SUMMARY ===']);
    csvData.push(['Event', event.title]);
    csvData.push(['Total Orders', orders.length]);
    csvData.push(['Total Revenue', `₹${orders.reduce((sum, o) => sum + Number(o.totalPrice), 0)}`]);
    csvData.push([]);

    // Merchandise Items Overview
    csvData.push(['=== MERCHANDISE ITEMS ===']);
    csvData.push(['Item Name', 'Price', 'Orders Count', 'Total Quantity Sold', 'Revenue']);

    merchandise.forEach(item => {
      const itemOrders = orders.filter(o => o.merchandiseId === item.id);
      const totalQuantity = itemOrders.reduce((sum, o) => sum + o.quantity, 0);
      const revenue = itemOrders.reduce((sum, o) => sum + Number(o.totalPrice), 0);

      csvData.push([
        item.name,
        `₹${item.price}`,
        item._count.orders,
        totalQuantity,
        `₹${revenue}`
      ]);
    });

    csvData.push([]);

    // Individual Orders
    csvData.push(['=== ORDER DETAILS ===']);
    csvData.push([
      'S.No', 'Customer Name', 'Email', 'Batch', 'WhatsApp', 'Item Name',
      'Quantity', 'Selected Size', 'Unit Price', 'Total Price', 'Order Date',
      'Payment Status', 'Delivery Status', 'Delivered At', 'Delivered By'
    ]);

    orders.forEach((order, index) => {
      csvData.push([
        index + 1,
        order.registration.user.fullName,
        order.registration.user.email,
        order.registration.user.batch,
        order.registration.user.whatsappNumber || 'N/A',
        order.merchandise.name,
        order.quantity,
        order.selectedSize || 'N/A',
        `₹${order.unitPrice}`,
        `₹${order.totalPrice}`,
        new Date(order.createdAt).toLocaleDateString(),
        order.paymentStatus,
        order.delivery ? order.delivery.status : 'PENDING',
        order.delivery ? new Date(order.delivery.deliveredAt).toLocaleDateString() : 'N/A',
        order.delivery ? order.delivery.deliveryStaff?.fullName || 'N/A' : 'N/A'
      ]);
    });

    return this.arrayToCSV(csvData);
  }

  async generateBatchReportCSV(data) {
    const { batchYear, members } = data;

    const csvData = [];

    // Batch Overview
    csvData.push(['=== BATCH REPORT ===']);
    csvData.push(['Batch Year', batchYear]);
    csvData.push(['Total Members', members.length]);
    csvData.push(['Active Participants', members.filter(m => m.eventRegistrations.length > 0).length]);
    csvData.push(['Participation Rate', `${Math.round((members.filter(m => m.eventRegistrations.length > 0).length / members.length) * 100)}%`]);
    csvData.push([]);

    // Individual Member Participation
    csvData.push(['=== MEMBER PARTICIPATION ===']);
    csvData.push([
      'S.No', 'Name', 'Email', 'Events Participated', 'Latest Event',
      'Total Amount Spent', 'Event Categories'
    ]);

    members.forEach((member, index) => {
      const totalSpent = member.eventRegistrations.reduce((sum, reg) => sum + Number(reg.totalAmount || 0), 0);
      const latestEvent = member.eventRegistrations.length > 0 ? 
        member.eventRegistrations.sort((a, b) => new Date(b.registrationDate) - new Date(a.registrationDate))[0] : null;
      
      const categories = [...new Set(member.eventRegistrations.map(reg => reg.event.category.name))];

      csvData.push([
        index + 1,
        member.fullName,
        member.email,
        member.eventRegistrations.length,
        latestEvent ? latestEvent.event.title : 'N/A',
        `₹${totalSpent}`,
        categories.join(', ') || 'N/A'
      ]);
    });

    return this.arrayToCSV(csvData);
  }

  // ==========================================
  // EXCEL GENERATION METHODS  
  // ==========================================

  async generateCompleteReportExcel(data) {
    const { event } = data;
    
    // Create workbook
    const wb = XLSX.utils.book_new();

    // Event Overview Sheet
    const overviewData = [
      ['Event Title', event.title],
      ['Event Date', new Date(event.eventDate).toLocaleDateString()],
      ['Event Category', event.category.name],
      ['Event Mode', event.eventMode],
      ['Venue', event.venue || 'N/A'],
      ['Max Capacity', event.maxCapacity || 'Unlimited'],
      ['Total Registrations', event.registrations.length],
      ['Created By', event.creator.fullName]
    ];
    
    const overviewWs = XLSX.utils.aoa_to_sheet(overviewData);
    XLSX.utils.book_append_sheet(wb, overviewWs, 'Event Overview');

    // Registrations Sheet
    const regHeaders = [
      'S.No', 'Full Name', 'Email', 'WhatsApp', 'Batch', 'Registration Date',
      'Payment Status', 'Total Amount', 'Guest Count', 'Meal Preference', 'Check-in Status'
    ];

    const regData = [regHeaders];
    event.registrations.forEach((reg, index) => {
      regData.push([
        index + 1,
        reg.user.fullName,
        reg.user.email,
        reg.user.whatsappNumber || 'N/A',
        reg.user.batch,
        new Date(reg.registrationDate).toLocaleDateString(),
        reg.paymentStatus,
        Number(reg.totalAmount),
        reg.totalGuests,
        reg.mealPreference || 'N/A',
        reg.checkIns.length > 0 ? 'Checked In' : 'Not Checked In'
      ]);
    });

    const regWs = XLSX.utils.aoa_to_sheet(regData);
    XLSX.utils.book_append_sheet(wb, regWs, 'Registrations');

    // Generate Excel buffer
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  async generateRegistrationExcel(data) {
    const { registrations } = data;
    
    const wb = XLSX.utils.book_new();
    
    // Convert registrations to worksheet data
    const wsData = [
      ['S.No', 'Full Name', 'Email', 'WhatsApp Number', 'Batch',
       'Registration Date', 'Payment Status', 'Total Amount', 'Guest Count',
       'Meal Preference', 'Check-in Status']
    ];

    registrations.forEach((reg, index) => {
      const checkIn = reg.checkIns[0];
      wsData.push([
        index + 1,
        reg.user.fullName,
        reg.user.email,
        reg.user.whatsappNumber || 'N/A',
        reg.user.batch,
        new Date(reg.registrationDate).toLocaleDateString(),
        reg.paymentStatus,
        Number(reg.totalAmount),
        reg.totalGuests,
        reg.mealPreference || 'N/A',
        checkIn ? 'Checked In' : 'Not Checked In'
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, 'Registrations');

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  async generateFinancialReportExcel(data) {
    const { event, registrations, analytics } = data;
    
    const wb = XLSX.utils.book_new();

    // Summary Sheet
    const summaryData = [
      ['Event', event.title],
      ['Total Revenue', Number(analytics?.totalRevenue || 0)],
      ['Registration Revenue', Number(analytics?.registrationRevenue || 0)],
      ['Merchandise Revenue', Number(analytics?.merchandiseRevenue || 0)],
      ['Donation Revenue', Number(analytics?.donationRevenue || 0)]
    ];

    const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

    // Detailed Payments Sheet
    const paymentsData = [
      ['Name', 'Email', 'Registration Fee', 'Guest Fees', 'Merchandise Total',
       'Donation Amount', 'Total Amount', 'Payment Status']
    ];

    registrations.forEach(reg => {
      paymentsData.push([
        reg.user.fullName,
        reg.user.email,
        Number(reg.registrationFeePaid),
        Number(reg.guestFeesPaid),
        Number(reg.merchandiseTotal),
        Number(reg.donationAmount),
        Number(reg.totalAmount),
        reg.paymentStatus
      ]);
    });

    const paymentsWs = XLSX.utils.aoa_to_sheet(paymentsData);
    XLSX.utils.book_append_sheet(wb, paymentsWs, 'Payments');

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  async generateAttendanceReportExcel(data) {
    const { event, checkIns, totalRegistrations } = data;
    
    const wb = XLSX.utils.book_new();

    // Summary Sheet
    const summaryData = [
      ['Event', event.title],
      ['Total Registrations', totalRegistrations],
      ['Total Check-ins', checkIns.length],
      ['Attendance Rate', `${totalRegistrations > 0 ? Math.round((checkIns.length / totalRegistrations) * 100) : 0}%`]
    ];

    const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

    // Check-ins Sheet
    const checkInsData = [
      ['Name', 'Email', 'Batch', 'Check-in Time', 'Guests Checked In', 'Check-in Location']
    ];

    checkIns.forEach(checkIn => {
      checkInsData.push([
        checkIn.registration.user.fullName,
        checkIn.registration.user.email,
        checkIn.registration.user.batch,
        new Date(checkIn.checkedInAt).toLocaleString(),
        checkIn.guestsCheckedIn,
        checkIn.checkInLocation || 'N/A'
      ]);
    });

    const checkInsWs = XLSX.utils.aoa_to_sheet(checkInsData);
    XLSX.utils.book_append_sheet(wb, checkInsWs, 'Check-ins');

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  async generateMerchandiseReportExcel(data) {
    const { event, orders } = data;
    
    const wb = XLSX.utils.book_new();

    // Orders Sheet
    const ordersData = [
      ['Customer Name', 'Email', 'Item Name', 'Quantity', 'Selected Size',
       'Unit Price', 'Total Price', 'Order Date', 'Payment Status', 'Delivery Status']
    ];

    orders.forEach(order => {
      ordersData.push([
        order.registration.user.fullName,
        order.registration.user.email,
        order.merchandise.name,
        order.quantity,
        order.selectedSize || 'N/A',
        Number(order.unitPrice),
        Number(order.totalPrice),
        new Date(order.createdAt).toLocaleDateString(),
        order.paymentStatus,
        order.delivery ? order.delivery.status : 'PENDING'
      ]);
    });

    const ordersWs = XLSX.utils.aoa_to_sheet(ordersData);
    XLSX.utils.book_append_sheet(wb, ordersWs, 'Orders');

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  async generateBatchReportExcel(data) {
    const { batchYear, members } = data;
    
    const wb = XLSX.utils.book_new();

    // Member participation data
    const memberData = [
      ['Name', 'Email', 'Events Participated', 'Total Amount Spent', 'Latest Event']
    ];

    members.forEach(member => {
      const totalSpent = member.eventRegistrations.reduce((sum, reg) => sum + Number(reg.totalAmount || 0), 0);
      const latestEvent = member.eventRegistrations.length > 0 ? 
        member.eventRegistrations.sort((a, b) => new Date(b.registrationDate) - new Date(a.registrationDate))[0] : null;

      memberData.push([
        member.fullName,
        member.email,
        member.eventRegistrations.length,
        totalSpent,
        latestEvent ? latestEvent.event.title : 'N/A'
      ]);
    });

    const memberWs = XLSX.utils.aoa_to_sheet(memberData);
    XLSX.utils.book_append_sheet(wb, memberWs, `Batch ${batchYear}`);

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  // ==========================================
  // UTILITY METHODS
  // ==========================================

  arrayToCSV(data) {
    return data.map(row => {
      return row.map(cell => {
        // Convert to string and handle special characters
        const cellStr = String(cell || '');
        // Escape quotes and wrap in quotes if contains comma, quote, or newline
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
          return `"${cellStr.replace(/"/g, '""')}"`;
        }
        return cellStr;
      }).join(',');
    }).join('\n');
  }

  // Cache invalidation
  async invalidateExportCache(eventId) {
    const patterns = [
      `export:${eventId}:*`,
    ];
    
    // In a real Redis setup, you'd use SCAN with pattern matching
    // For now, we'll just clear specific known keys
    const types = ['complete', 'registrations', 'financial', 'attendance', 'merchandise'];
    const formats = ['csv', 'xlsx'];
    
    const keys = [];
    types.forEach(type => {
      formats.forEach(format => {
        keys.push(this.cacheKeys.export(eventId, type, format));
      });
    });
    
    await Promise.all(keys.map(key => CacheService.del(key)));
  }
}

module.exports = new ExportService();