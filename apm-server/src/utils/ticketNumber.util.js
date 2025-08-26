// ============================================
// FILE: src/utils/ticketNumber.util.js
// ============================================

const { prisma } = require('../config/database');

async function generateTicketNumber() {
  const currentYear = new Date().getFullYear();
  const prefix = `TKT-${currentYear}-`;
  
  // Get the latest ticket number for current year
  const latestTicket = await prisma.ticket.findFirst({
    where: {
      ticketNumber: {
        startsWith: prefix
      }
    },
    orderBy: {
      ticketNumber: 'desc'
    },
    select: {
      ticketNumber: true
    }
  });
  
  let nextNumber = 1;
  
  if (latestTicket) {
    // Extract the number part and increment
    const lastNumber = parseInt(latestTicket.ticketNumber.substring(prefix.length));
    nextNumber = lastNumber + 1;
  }
  
  // Pad with zeros to make it 6 digits
  const paddedNumber = nextNumber.toString().padStart(6, '0');
  
  return `${prefix}${paddedNumber}`;
}

function isValidTicketNumber(ticketNumber) {
  const ticketNumberRegex = /^TKT-\d{4}-\d{6}$/;
  return ticketNumberRegex.test(ticketNumber);
}

module.exports = {
  generateTicketNumber,
  isValidTicketNumber
};