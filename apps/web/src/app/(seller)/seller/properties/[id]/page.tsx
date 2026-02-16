'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FiArrowLeft,
  FiEdit2,
  FiTrash2,
  FiMapPin,
  FiDollarSign,
  FiTrendingUp,
  FiUsers,
  FiGrid,
  FiX,
} from 'react-icons/fi';
import { api } from '@/lib/api-client';

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  rejected: 'bg-red-100 text-red-700',
  funded: 'bg-blue-100 text-blue-700',
  closed: 'bg-gray-100 text-gray-600',
};

export default function SellerPropertyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const propertyId = Number(params.id);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const { data: property, isLoading } = useQuery({
    queryKey: ['property', propertyId],
    queryFn: () => api.getProperty(propertyId),
    enabled: !!propertyId,
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteProperty(propertyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seller', 'properties'] });
      router.push('/seller/properties');
    },
  });

  const canEdit = property && ['pending', 'rejected'].includes(property.status || '');
  const canDelete = property && (property as any)._count?.investments === 0;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-100 rounded w-48 animate-pulse" />
        <div className="card animate-pulse space-y-4">
          <div className="h-6 bg-gray-100 rounded w-2/3" />
          <div className="h-4 bg-gray-100 rounded w-1/3" />
          <div className="h-4 bg-gray-100 rounded w-full" />
          <div className="h-4 bg-gray-100 rounded w-3/4" />
        </div>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="card text-center py-16">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <FiGrid className="text-2xl text-gray-400" />
        </div>
        <h3 className="font-medium text-gray-900 mb-1">Property not found</h3>
        <p className="text-sm text-gray-500 mb-6">
          This property may have been removed or you don&apos;t have access.
        </p>
        <Link href="/seller/properties" className="btn-blue inline-flex items-center gap-2 !py-2.5 !px-4 text-sm">
          <FiArrowLeft /> Back to Properties
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            <FiArrowLeft />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{property.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                  STATUS_COLORS[property.status || ''] || 'bg-gray-100 text-gray-600'
                }`}
              >
                {property.status?.replace('_', ' ') || 'Unknown'}
              </span>
              {property.propertyType && (
                <span className="inline-block bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs capitalize">
                  {property.propertyType}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <Link
              href={`/seller/properties/${propertyId}/edit`}
              className="btn-blue flex items-center gap-2 !py-2.5 !px-4 text-sm"
            >
              <FiEdit2 /> Edit Property
            </Link>
          )}
          {canDelete && (
            <button
              onClick={() => setShowDeleteModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-red-600 border border-red-200 hover:bg-red-50 transition-colors"
            >
              <FiTrash2 /> Delete
            </button>
          )}
        </div>
      </div>

      {/* Property Details */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Basic Info */}
        <div className="card space-y-4">
          <h2 className="text-base font-semibold text-gray-900 border-b border-gray-100 pb-3">
            Property Details
          </h2>
          {property.description && (
            <p className="text-sm text-gray-600">{property.description}</p>
          )}
          {property.location && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <FiMapPin className="text-gray-400 shrink-0" />
              <span>{property.location}{property.city ? `, ${property.city}` : ''}</span>
            </div>
          )}
          {property.address && (
            <div className="text-sm text-gray-500">{property.address}</div>
          )}
          {property.areaSqft && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <FiGrid className="text-gray-400 shrink-0" />
              <span>{Number(property.areaSqft).toLocaleString()} sq ft</span>
            </div>
          )}
        </div>

        {/* Financial Info */}
        <div className="card space-y-4">
          <h2 className="text-base font-semibold text-gray-900 border-b border-gray-100 pb-3">
            Financial Details
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <InfoItem icon={<FiDollarSign />} label="Total Value" value={`PKR ${Number(property.totalValue || 0).toLocaleString()}`} />
            <InfoItem icon={<FiDollarSign />} label="Funding Target" value={`PKR ${Number(property.fundingTarget || 0).toLocaleString()}`} />
            <InfoItem icon={<FiDollarSign />} label="Min Investment" value={`PKR ${Number(property.minInvestment || 0).toLocaleString()}`} />
            <InfoItem icon={<FiDollarSign />} label="Max Investment" value={`PKR ${Number(property.maxInvestment || 0).toLocaleString()}`} />
            <InfoItem icon={<FiTrendingUp />} label="Expected Returns" value={`${Number(property.expectedReturnsAnnual || 0)}% / year`} />
            <InfoItem icon={<FiTrendingUp />} label="Rental Yield" value={`${Number(property.rentalYield || 0)}%`} />
          </div>
        </div>
      </div>

      {/* Funding Progress */}
      {property.fundingTarget && (
        <div className="card space-y-3">
          <h2 className="text-base font-semibold text-gray-900 border-b border-gray-100 pb-3">
            Funding Progress
          </h2>
          <div className="flex justify-between text-sm text-gray-600">
            <span>Raised: PKR {Number(property.fundingRaised || 0).toLocaleString()}</span>
            <span>Target: PKR {Number(property.fundingTarget).toLocaleString()}</span>
          </div>
          <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-dao-blue rounded-full transition-all"
              style={{
                width: `${Math.min(100, ((Number(property.fundingRaised) || 0) / Number(property.fundingTarget)) * 100)}%`,
              }}
            />
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <FiUsers className="text-gray-400" />
            <span>{(property as any).investorCount || (property as any)._count?.investments || 0} investor(s)</span>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Delete Property</h2>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <FiX className="text-xl" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                Are you sure you want to delete <strong>{property.title}</strong>? This action cannot be undone.
              </p>
              {deleteMutation.isError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  Failed to delete property. It may have active investments.
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="btn-secondary flex-1 !py-2.5 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                  className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 transition-colors"
                >
                  {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-xs text-gray-500">
        <span className="text-gray-400">{icon}</span>
        {label}
      </div>
      <p className="text-sm font-medium text-gray-900">{value}</p>
    </div>
  );
}
