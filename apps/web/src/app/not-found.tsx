'use client';

import Link from 'next/link';
import { FiHome, FiSearch, FiArrowLeft } from 'react-icons/fi';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-gray-50">
      <div className="text-center max-w-lg">
        {/* 404 Illustration */}
        <div className="relative mb-8">
          <span className="text-[120px] sm:text-[160px] font-extrabold text-gray-100 select-none leading-none">
            404
          </span>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-20 h-20 rounded-full bg-dao-blue/10 flex items-center justify-center">
              <FiSearch className="text-dao-blue text-3xl" />
            </div>
          </div>
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
          Page Not Found
        </h1>
        <p className="text-gray-500 text-sm sm:text-base mb-8 max-w-sm mx-auto">
          The page you are looking for doesn&apos;t exist or has been moved.
          Check the URL or navigate back to your dashboard.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="btn-blue flex items-center gap-2 px-6 py-2.5 text-sm w-full sm:w-auto justify-center"
          >
            <FiHome className="text-base" />
            Go to Dashboard
          </Link>
          <Link
            href="/"
            className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors w-full sm:w-auto justify-center"
          >
            <FiArrowLeft className="text-base" />
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
