import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import {
    FaUsers, FaTicketAlt, FaBuilding, FaCheckCircle,
    FaClock, FaExclamationTriangle, FaSignOutAlt,
    FaSearch, FaEye, FaReply, FaCheck, FaTimes
} from 'react-icons/fa';
import { MdDashboard, MdVerifiedUser, MdSupportAgent, MdBusinessCenter } from 'react-icons/md';

// Sidebar items
const sidebarItems = [
    { icon: MdDashboard, label: 'Dashboard', href: '/staff' },
    { icon: MdVerifiedUser, label: 'KYC Queue', href: '/staff/kyc' },
    { icon: MdSupportAgent, label: 'Support Tickets', href: '/staff/tickets' },
    { icon: MdBusinessCenter, label: 'Properties', href: '/staff/properties' },
];

// Stats Card
const StatsCard = ({ icon: Icon, title, value, subtitle, color }) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between">
            <div>
                <p className="text-gray-500 text-sm font-medium">{title}</p>
                <h3 className="text-2xl font-bold text-gray-900 mt-1">{value}</h3>
                {subtitle && <p className="text-gray-400 text-xs mt-1">{subtitle}</p>}
            </div>
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
                <Icon className="text-white text-lg" />
            </div>
        </div>
    </div>
);

// KYC Verification Modal
const KYCModal = ({ verification, onClose, onApprove, onReject }) => {
    const [rejectionReason, setRejectionReason] = useState('');
    const [showRejectForm, setShowRejectForm] = useState(false);

    if (!verification) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xl font-bold text-gray-900">KYC Verification</h3>
                        <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                            <FaTimes />
                        </button>
                    </div>
                </div>

                <div className="p-6 space-y-6">
                    {/* User Info */}
                    <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="font-medium text-gray-700 mb-3">User Information</h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="text-gray-500">Name:</span>
                                <span className="ml-2 font-medium">{verification.first_name} {verification.last_name}</span>
                            </div>
                            <div>
                                <span className="text-gray-500">Email:</span>
                                <span className="ml-2 font-medium">{verification.email}</span>
                            </div>
                            <div>
                                <span className="text-gray-500">Phone:</span>
                                <span className="ml-2 font-medium">{verification.phone || 'N/A'}</span>
                            </div>
                            <div>
                                <span className="text-gray-500">Joined:</span>
                                <span className="ml-2 font-medium">{new Date(verification.user_created_at).toLocaleDateString()}</span>
                            </div>
                        </div>
                    </div>

                    {/* Document Info */}
                    <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="font-medium text-gray-700 mb-3">Document Details</h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="text-gray-500">Type:</span>
                                <span className="ml-2 font-medium capitalize">{verification.document_type || 'N/A'}</span>
                            </div>
                            <div>
                                <span className="text-gray-500">Number:</span>
                                <span className="ml-2 font-medium">{verification.document_number || 'N/A'}</span>
                            </div>
                            <div>
                                <span className="text-gray-500">KYC Level:</span>
                                <span className="ml-2 font-medium">Level {verification.kyc_level}</span>
                            </div>
                            <div>
                                <span className="text-gray-500">Submitted:</span>
                                <span className="ml-2 font-medium">{new Date(verification.created_at).toLocaleDateString()}</span>
                            </div>
                        </div>
                    </div>

                    {/* Document Images */}
                    {(verification.document_front_url || verification.document_back_url) && (
                        <div>
                            <h4 className="font-medium text-gray-700 mb-3">Uploaded Documents</h4>
                            <div className="grid grid-cols-2 gap-4">
                                {verification.document_front_url && (
                                    <div className="border rounded-lg p-2">
                                        <p className="text-xs text-gray-500 mb-2">Front</p>
                                        <img src={verification.document_front_url} alt="Document Front" className="w-full rounded" />
                                    </div>
                                )}
                                {verification.document_back_url && (
                                    <div className="border rounded-lg p-2">
                                        <p className="text-xs text-gray-500 mb-2">Back</p>
                                        <img src={verification.document_back_url} alt="Document Back" className="w-full rounded" />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Rejection Form */}
                    {showRejectForm && (
                        <div className="bg-red-50 rounded-lg p-4">
                            <h4 className="font-medium text-red-700 mb-2">Rejection Reason</h4>
                            <textarea
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                placeholder="Provide a reason for rejection..."
                                className="w-full p-3 border border-red-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent"
                                rows={3}
                            />
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
                    {!showRejectForm ? (
                        <>
                            <button
                                onClick={() => setShowRejectForm(true)}
                                className="px-4 py-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition font-medium"
                            >
                                Reject
                            </button>
                            <button
                                onClick={() => onApprove(verification.id)}
                                className="px-4 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 transition font-medium flex items-center gap-2"
                            >
                                <FaCheckCircle /> Approve
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={() => setShowRejectForm(false)}
                                className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => onReject(verification.id, rejectionReason)}
                                disabled={!rejectionReason}
                                className="px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 transition font-medium disabled:opacity-50"
                            >
                                Confirm Rejection
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default function StaffDashboard() {
    const router = useRouter();
    const [user, setUser] = useState(null);
    const [dashboardData, setDashboardData] = useState(null);
    const [kycQueue, setKycQueue] = useState([]);
    const [tickets, setTickets] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedKYC, setSelectedKYC] = useState(null);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    useEffect(() => {
        checkAuth();
        fetchData();
    }, []);

    const checkAuth = () => {
        const token = localStorage.getItem('token');
        const userData = localStorage.getItem('user');

        if (!token || !userData) {
            router.push('/admin/login');
            return;
        }

        const parsedUser = JSON.parse(userData);
        if (!['admin', 'operations_manager', 'staff'].includes(parsedUser.role)) {
            router.push('/admin/login');
            return;
        }

        setUser(parsedUser);
    };

    const fetchData = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;

            const headers = { 'Authorization': `Bearer ${token}` };
            const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

            // Fetch dashboard
            const dashRes = await fetch(`${baseUrl}/api/staff/dashboard`, { headers });
            if (dashRes.ok) {
                const data = await dashRes.json();
                setDashboardData(data);
            }

            // Fetch KYC queue
            const kycRes = await fetch(`${baseUrl}/api/kyc/queue?status=pending&limit=5`, { headers });
            if (kycRes.ok) {
                const data = await kycRes.json();
                setKycQueue(data.verifications || []);
            }

            // Fetch tickets
            const ticketRes = await fetch(`${baseUrl}/api/staff/tickets?limit=5`, { headers });
            if (ticketRes.ok) {
                const data = await ticketRes.json();
                setTickets(data.tickets || []);
            }
        } catch (error) {
            console.error('Failed to fetch data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleApproveKYC = async (id) => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/kyc/${id}/approve`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (res.ok) {
                setSelectedKYC(null);
                fetchData();
            }
        } catch (error) {
            console.error('Approve failed:', error);
        }
    };

    const handleRejectKYC = async (id, reason) => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/kyc/${id}/reject`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ rejection_reason: reason })
            });

            if (res.ok) {
                setSelectedKYC(null);
                fetchData();
            }
        } catch (error) {
            console.error('Reject failed:', error);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        router.push('/admin/login');
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                    <p className="text-gray-500">Loading dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <>
            <Head>
                <title>Operations Dashboard | FREIP</title>
                <meta name="description" content="FREIP Operations Manager Dashboard" />
            </Head>

            <div className="min-h-screen bg-gray-50 flex">
                {/* Sidebar */}
                <aside className={`fixed inset-y-0 left-0 bg-emerald-900 text-white transition-all duration-300 z-40 ${sidebarCollapsed ? 'w-20' : 'w-64'}`}>
                    <div className="h-16 flex items-center justify-center border-b border-emerald-700">
                        <span className="text-xl font-bold">
                            {sidebarCollapsed ? 'F' : 'FREIP Operations'}
                        </span>
                    </div>

                    <nav className="mt-6 px-3">
                        {sidebarItems.map((item) => {
                            const isActive = router.pathname === item.href;
                            return (
                                <Link key={item.href} href={item.href}>
                                    <div className={`flex items-center px-4 py-3 mb-1 rounded-lg cursor-pointer transition-colors
                    ${isActive ? 'bg-emerald-700' : 'hover:bg-emerald-800'}
                    ${sidebarCollapsed ? 'justify-center' : ''}`}
                                    >
                                        <item.icon className="text-xl" />
                                        {!sidebarCollapsed && <span className="ml-3 font-medium">{item.label}</span>}
                                    </div>
                                </Link>
                            );
                        })}
                    </nav>

                    <div className="absolute bottom-4 left-0 right-0 px-3">
                        <button
                            onClick={handleLogout}
                            className={`flex items-center w-full px-4 py-3 text-emerald-200 hover:bg-red-500/20 hover:text-red-300 rounded-lg transition-colors
                ${sidebarCollapsed ? 'justify-center' : ''}`}
                        >
                            <FaSignOutAlt className="text-xl" />
                            {!sidebarCollapsed && <span className="ml-3">Logout</span>}
                        </button>
                    </div>
                </aside>

                {/* Main Content */}
                <main className={`flex-1 transition-all duration-300 ${sidebarCollapsed ? 'ml-20' : 'ml-64'}`}>
                    {/* Header */}
                    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 sticky top-0 z-30">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                                className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                </svg>
                            </button>
                            <h1 className="text-xl font-semibold text-gray-800">Operations Dashboard</h1>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-emerald-600 rounded-full flex items-center justify-center text-white font-medium">
                                {user?.first_name?.[0]}{user?.last_name?.[0]}
                            </div>
                            <div className="hidden md:block">
                                <p className="text-sm font-medium text-gray-800">{user?.first_name} {user?.last_name}</p>
                                <p className="text-xs text-gray-500 capitalize">{user?.role?.replace('_', ' ')}</p>
                            </div>
                        </div>
                    </header>

                    {/* Content */}
                    <div className="p-6">
                        {/* Stats Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
                            <StatsCard
                                icon={MdVerifiedUser}
                                title="Pending KYC"
                                value={dashboardData?.kyc?.pending || 0}
                                subtitle="Awaiting verification"
                                color="bg-amber-500"
                            />
                            <StatsCard
                                icon={FaCheckCircle}
                                title="Verified Today"
                                value={dashboardData?.kyc?.approved_today || 0}
                                subtitle="Completed verifications"
                                color="bg-green-500"
                            />
                            <StatsCard
                                icon={FaTicketAlt}
                                title="Open Tickets"
                                value={dashboardData?.tickets?.open || 0}
                                subtitle={`${dashboardData?.tickets?.critical || 0} critical`}
                                color="bg-blue-500"
                            />
                            <StatsCard
                                icon={FaBuilding}
                                title="Pending Properties"
                                value={dashboardData?.properties?.pending_approval || 0}
                                subtitle="Need review"
                                color="bg-purple-500"
                            />
                        </div>

                        {/* Two Column Layout */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* KYC Queue */}
                            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-semibold text-gray-800">KYC Verification Queue</h3>
                                    <Link href="/staff/kyc">
                                        <span className="text-emerald-600 text-sm hover:underline cursor-pointer">View All</span>
                                    </Link>
                                </div>

                                <div className="space-y-3">
                                    {kycQueue.length > 0 ? kycQueue.map((kyc) => (
                                        <div key={kyc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center text-amber-600">
                                                    <MdVerifiedUser />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-gray-800">{kyc.first_name} {kyc.last_name}</p>
                                                    <p className="text-sm text-gray-500">Level {kyc.kyc_level} • {kyc.document_type || 'Document'}</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => setSelectedKYC(kyc)}
                                                className="p-2 text-emerald-600 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition"
                                            >
                                                <FaEye />
                                            </button>
                                        </div>
                                    )) : (
                                        <p className="text-gray-500 text-center py-6">No pending verifications</p>
                                    )}
                                </div>
                            </div>

                            {/* Recent Tickets */}
                            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-semibold text-gray-800">Support Tickets</h3>
                                    <Link href="/staff/tickets">
                                        <span className="text-emerald-600 text-sm hover:underline cursor-pointer">View All</span>
                                    </Link>
                                </div>

                                <div className="space-y-3">
                                    {tickets.length > 0 ? tickets.map((ticket) => (
                                        <div key={ticket.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center
                          ${ticket.priority === 'critical' ? 'bg-red-100 text-red-600' :
                                                        ticket.priority === 'high' ? 'bg-orange-100 text-orange-600' :
                                                            'bg-blue-100 text-blue-600'}`}
                                                >
                                                    <FaTicketAlt />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-gray-800 truncate max-w-[200px]">{ticket.subject}</p>
                                                    <p className="text-sm text-gray-500">{ticket.user_first_name} • {ticket.category || 'General'}</p>
                                                </div>
                                            </div>
                                            <span className={`px-2 py-1 text-xs font-medium rounded-full
                        ${ticket.priority === 'critical' ? 'bg-red-100 text-red-700' :
                                                    ticket.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                                                        'bg-gray-100 text-gray-700'}`}
                                            >
                                                {ticket.priority}
                                            </span>
                                        </div>
                                    )) : (
                                        <p className="text-gray-500 text-center py-6">No open tickets</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* My Performance */}
                        <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">My Performance Today</h3>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="text-center p-4 bg-emerald-50 rounded-lg">
                                    <p className="text-3xl font-bold text-emerald-600">{dashboardData?.kyc?.my_verifications_today || 0}</p>
                                    <p className="text-sm text-gray-600 mt-1">KYC Verified</p>
                                </div>
                                <div className="text-center p-4 bg-blue-50 rounded-lg">
                                    <p className="text-3xl font-bold text-blue-600">{dashboardData?.tickets?.my_tickets || 0}</p>
                                    <p className="text-sm text-gray-600 mt-1">Active Tickets</p>
                                </div>
                                <div className="text-center p-4 bg-purple-50 rounded-lg">
                                    <p className="text-3xl font-bold text-purple-600">{dashboardData?.tickets?.in_progress || 0}</p>
                                    <p className="text-sm text-gray-600 mt-1">In Progress</p>
                                </div>
                                <div className="text-center p-4 bg-gray-50 rounded-lg">
                                    <p className="text-3xl font-bold text-gray-600">{dashboardData?.recentActivity?.length || 0}</p>
                                    <p className="text-sm text-gray-600 mt-1">Actions Today</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>

            {/* KYC Modal */}
            <KYCModal
                verification={selectedKYC}
                onClose={() => setSelectedKYC(null)}
                onApprove={handleApproveKYC}
                onReject={handleRejectKYC}
            />
        </>
    );
}
