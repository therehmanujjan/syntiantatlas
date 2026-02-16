'use client';

import { FiGift, FiMessageCircle } from 'react-icons/fi';

export default function RewardsShopPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex flex-col items-center justify-center text-center py-20">
        {/* Illustration */}
        <div className="w-28 h-28 rounded-full bg-dao-blue/10 flex items-center justify-center mb-8">
          <FiGift className="text-dao-blue text-5xl" />
        </div>

        {/* Heading */}
        <h1 className="text-3xl font-bold text-gray-900 mb-3">Rewards Shop</h1>
        <p className="text-lg text-gray-500 mb-2">Coming Soon</p>

        {/* Description */}
        <p className="text-sm text-gray-500 max-w-md mb-8">
          Earn rewards through investments, referrals, and platform engagement.
          Redeem them for exclusive benefits, discounts, and more.
          We&apos;re building something exciting — stay tuned!
        </p>

        {/* Contact Support */}
        <a
          href="https://wa.me/923000000000?text=Hi%2C%20I%20have%20a%20question%20about%20the%20Rewards%20Shop"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600 transition"
        >
          <FiMessageCircle />
          Contact Support
        </a>
      </div>
    </div>
  );
}
