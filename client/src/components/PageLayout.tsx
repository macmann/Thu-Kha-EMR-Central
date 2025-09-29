import React from 'react';

interface PageLayoutProps {
  children: React.ReactNode;
  maxWidth?: string;
}

export default function PageLayout({ children, maxWidth = 'max-w-2xl' }: PageLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-gray-100">
      <div className="flex flex-1 items-start justify-center px-4 py-6 sm:px-6 sm:py-10 lg:items-center lg:px-8">
        <div className={`w-full ${maxWidth} rounded-2xl bg-white p-6 shadow-sm sm:p-8 lg:p-10`}>{children}</div>
      </div>
    </div>
  );
}
