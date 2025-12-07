import React from 'react';
import ComingSoon from '@/components/common/UI/ComingSoon';
import { BanknotesIcon } from '@heroicons/react/24/outline';

const Treasury: React.FC = () => {
  const features = [
    {
      title: 'Financial Dashboard',
      description: 'View comprehensive financial overview with current balance, monthly trends, and expense breakdowns.',
    },
    {
      title: 'Expense Reports',
      description: 'Access detailed expense reports categorized by type, date range, and purpose with receipt attachments.',
    },
    {
      title: 'Collections Overview',
      description: 'View collection history including membership fees, event payments, and other contributions.',
    },
    {
      title: 'Balance History',
      description: 'Track year-wise opening and closing balances with detailed transaction history and statements.',
    },
    {
      title: 'Category-wise Breakdown',
      description: 'Visualize expense and collection distribution across different categories with interactive charts.',
    },
    {
      title: 'Monthly Trends',
      description: 'Analyze financial trends over time with month-over-month and year-over-year comparisons.',
    },
    {
      title: 'Receipt Viewer',
      description: 'View receipts and supporting documents for all expenses and collections for full transparency.',
    },
    {
      title: 'Financial Reports',
      description: 'Download comprehensive financial reports in PDF and Excel formats for your records.',
    },
    {
      title: 'Transaction Search',
      description: 'Search and filter transactions by date, category, amount, or description to find specific entries.',
    },
    {
      title: 'Transparent Operations',
      description: 'Complete visibility into all financial operations with timestamps and responsible persons.',
    },
  ];

  return (
    <ComingSoon
      title="Treasury & Financials"
      description="View organization financial information with complete transparency. Track expenses, collections, balances, and download detailed reports."
      features={features}
      estimatedLaunch="Delivering Soon"
      icon={BanknotesIcon}
    />
  );
};

export default Treasury;
