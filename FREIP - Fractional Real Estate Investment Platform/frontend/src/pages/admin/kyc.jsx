import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import {
    FaCheckCircle, FaTimes, FaClock, FaSearch,
    FaUserCheck, FaExclamationTriangle, FaEye, FaFilter
} from 'react-icons/fa';
import { MdDashboard, MdPeople, MdBusinessCenter, MdVerifiedUser } from 'react-icons/md';

// Sidebar items
const sidebarItems = [
    { icon: MdDashboard, label: 'Dashboard', href: '/admin' },
    { icon: MdPeople, label: 'Users', href: '/admin/users' },
    { icon: MdBusinessCenter, label: 'Properties', href: '/admin/properties' },
    { icon: MdVerifiedUser, label: 'KYC Queue', href: '/admin/kyc' },
];

export default function AdminKYCQueue() {
    const router = useRouter();
    const [kycQueue, setKycQueue] = useState([]);
    const [kycStats, setKycStats] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('pending');
    const [selectedKYC, setSelectedKYC] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    const [showRejectModal, setShowRejectModal] = useState(false);

    useEffect(() => {
        checkAuth();
        fetchData();
    }, [statusFilter]);

    const checkAuth = () => {
        const token = localStorage.getItem('token');
        const user = localStorage.getItem('user');
        if (!token || !user) {
            router.push('/admin/login');
            return;
        }
        const parsedUser = JSON.parse(user);
        if (!['admin', 'operations_manager'].includes(parsedUser.role)) {
            router.push('/admin/login');
        }
    };

    const fetchData = async () => {
        try {
            const token = localStorage.getItem('token');
            const headers = { 'Authorization': `Bearer ${token}` };
            const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

            const [queueRes, statsRes] = await Promise.all([
                fetch(`${baseUrl}/api/kyc/queue?status=${statusFilter}`, { headers }),
                fetch(`${baseUrl}/api/kyc/stats`, { headers })
            ]);

            if (queueRes.ok) {
                const data = await queueRes.json();
                setKycQueue(data.verifications || []);
            }

            if (statsRes.ok) {
                const data = await statsRes.json();
                setKycStats(data);
            }
        } catch (error) {
            console.error('Failed to fetch KYC data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleApprove = async (id) => {
        setActionLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/kyc/${id}/approve`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
            });

            if (res.ok) {
                setSelectedKYC(null);
                fetchData();
            }
        } catch (error) {
            console.error('Approve failed:', error);
        } finally {
            setActionLoading(false);
        }
    };

    const handleReject = async (id) => {
        if (!rejectionReason) return;
        setActionLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/kyc/${id}/reject`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ rejection_reason: rejectionReason })
            });

            if (res.ok) {
                setSelectedKYC(null);
                setShowRejectModal(false);
                setRejectionReason('');
                fetchData();
            }
        } catch (error) {
            console.error('Reject failed:', error);
        } finally {
            setActionLoading(false);
        }
    };

    const statusColors = {
        pending: 'bg-amber-100 text-amber-700',
        under_review: 'bg-blue-100 text-blue-700',
        approved: 'bg-green-100 text-green-700',
        rejected: 'bg-red-100 text-red-700'
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full"></div>
            </div>
        );
    }

    return (
        <>
            <Head>
                <title>KYC Queue | FREIP Admin</title>
            </Head>

            <div className="min-h-screen bg-gray-50 ml-64">
                {/* Assuming sidebar is in parent layout */}
                <div className="p-6">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">KYC Verification Queue</h1>
                            <p className="text-gray-500">Verify user identity documents</p>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                        <div className="bg-white rounded-xl p-4 border border-gray-100">
                            <p className="text-sm text-gray-500">Pending</p>
                            <p className="text-2xl font-bold text-amber-600">{kycStats?.byStatus?.pending || 0}</p>
                        </div>
                        <div className="bg-white rounded-xl p-4 border border-gray-100">
                            <p className="text-sm text-gray-500">Under Review</p>
                            <p className="text-2xl font-bold text-blue-600">{kycStats?.byStatus?.under_review || 0}</p>
                        </div>
                        <div className="bg-white rounded-xl p-4 border border-gray-100">
                            <p className="text-sm text-gray-500">Today's Submissions</p>
                            <p className="text-2xl font-bold text-gray-900">{kycStats?.todaySubmissions || 0}</p>
                        </div>
                        <div className="bg-white rounded-xl p-4 border border-gray-100">
                            <p className="text-sm text-gray-500">Avg. Processing Time</p>
                            <p className="text-2xl font-bold text-green-600">{kycStats?.avgProcessingTime || 0}h</p>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="flex items-center gap-4 mb-6">
                        <div className="flex gap-2">
                            {['pending', 'under_review', 'approved', 'rejected'].map((status) => (
                                <button
                                    key={status}
                                    onClick={() => setStatusFilter(status)}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${statusFilter === status
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                                        }`}
                                >
                                    {status.replace('_', ' ').charAt(0).toUpperCase() + status.replace('_', ' ').slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Table */}
                    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Document</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Level</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Submitted</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {kycQueue.length > 0 ? kycQueue.map((kyc) => (
                                    <tr key={kyc.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4">
                                            <div>
                                                <p className="font-medium text-gray-900">{kyc.first_name} {kyc.last_name}</p>
                                                <p className="text-sm text-gray-500">{kyc.email}</p>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-gray-900 capitalize">{kyc.document_type || 'N/A'}</p>
                                            <p className="text-sm text-gray-500">{kyc.document_number || '-'}</p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded">
                                                Level {kyc.kyc_level}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500">
                                            {new Date(kyc.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[kyc.status]}`}>
                                                {kyc.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setSelectedKYC(kyc)}
                                                    className="p-2 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100"
                                                >
                                                    <FaEye />
                                                </button>
                                                {kyc.status === 'pending' && (
                                                    <>
                                                        <button
                                                            onClick={() => handleApprove(kyc.id)}
                                                            className="p-2 text-green-600 bg-green-50 rounded-lg hover:bg-green-100"
                                                        >
                                                            <FaCheckCircle />
                                                        </button>
                                                        <button
                                                            onClick={() => { setSelectedKYC(kyc); setShowRejectModal(true); }}
                                                            className="p-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100"
                                                        >
                                                            <FaTimes />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                            No verifications found with status "{statusFilter}"
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Reject Modal */}
                {showRejectModal && selectedKYC && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
                            <h3 className="text-lg font-bold text-gray-900 mb-4">Reject KYC Verification</h3>
                            <p className="text-gray-500 text-sm mb-4">
                                Rejecting verification for {selectedKYC.first_name} {selectedKYC.last_name}
                            </p>
                            <textarea
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                placeholder="Provide reason for rejection..."
                                className="w-full p-3 border border-gray-200 rounded-lg text-sm mb-4"
                                rows={4}
                            />
                            <div className="flex gap-3">
                                <button
                                    onClick={() => { setShowRejectModal(false); setRejectionReason(''); }}
                                    className="flex-1 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleReject(selectedKYC.id)}
                                    disabled={!rejectionReason || actionLoading}
                                    className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                                >
                                    {actionLoading ? 'Rejecting...' : 'Reject'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
