import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import {
    FaCog, FaSave, FaUndo, FaExclamationTriangle,
    FaCheckCircle, FaToggleOn, FaToggleOff
} from 'react-icons/fa';

export default function AdminSettings() {
    const router = useRouter();
    const [settings, setSettings] = useState({});
    const [platformStats, setPlatformStats] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [maintenanceMode, setMaintenanceMode] = useState(false);

    const settingLabels = {
        platform_fee_percentage: { label: 'Platform Fee (%)', type: 'number', description: 'Fee charged on each investment' },
        min_investment_amount: { label: 'Minimum Investment (PKR)', type: 'number', description: 'Minimum amount a user can invest' },
        max_investment_amount: { label: 'Maximum Investment (PKR)', type: 'number', description: 'Maximum amount a user can invest' },
        kyc_expiry_days: { label: 'KYC Expiry (days)', type: 'number', description: 'Days until KYC verification expires' },
        referral_reward_amount: { label: 'Referral Reward (PKR)', type: 'number', description: 'Reward for successful referrals' }
    };

    useEffect(() => {
        checkAuth();
        fetchSettings();
    }, []);

    const checkAuth = () => {
        const token = localStorage.getItem('token');
        const user = localStorage.getItem('user');
        if (!token || !user) {
            router.push('/admin/login');
            return;
        }
        const parsedUser = JSON.parse(user);
        if (parsedUser.role !== 'admin') {
            router.push('/admin/login');
        }
    };

    const fetchSettings = async () => {
        try {
            const token = localStorage.getItem('token');
            const headers = { 'Authorization': `Bearer ${token}` };
            const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

            const [settingsRes, maintenanceRes, statsRes] = await Promise.all([
                fetch(`${baseUrl}/api/settings`, { headers }),
                fetch(`${baseUrl}/api/settings/maintenance`, { headers }),
                fetch(`${baseUrl}/api/settings/stats`, { headers })
            ]);

            if (settingsRes.ok) {
                const data = await settingsRes.json();
                const settingsObj = {};
                data.raw.forEach(s => {
                    settingsObj[s.key] = typeof s.value === 'string' ? JSON.parse(s.value) : s.value;
                });
                setSettings(settingsObj);
            }

            if (maintenanceRes.ok) {
                const data = await maintenanceRes.json();
                setMaintenanceMode(data.maintenanceMode);
            }

            if (statsRes.ok) {
                const data = await statsRes.json();
                setPlatformStats(data.stats);
            }
        } catch (error) {
            console.error('Failed to fetch settings:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const token = localStorage.getItem('token');
            const settingsArray = Object.entries(settings).map(([key, value]) => ({ key, value }));

            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/settings/bulk`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ settings: settingsArray })
            });

            if (res.ok) {
                setSuccessMessage('Settings saved successfully!');
                setTimeout(() => setSuccessMessage(''), 3000);
            }
        } catch (error) {
            console.error('Save failed:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleToggleMaintenance = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/settings/maintenance`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ enabled: !maintenanceMode, message: 'System maintenance in progress' })
            });

            if (res.ok) {
                setMaintenanceMode(!maintenanceMode);
                setSuccessMessage(`Maintenance mode ${!maintenanceMode ? 'enabled' : 'disabled'}`);
                setTimeout(() => setSuccessMessage(''), 3000);
            }
        } catch (error) {
            console.error('Toggle maintenance failed:', error);
        }
    };

    const handleReset = async (key) => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/settings/${key}/reset`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                fetchSettings();
                setSuccessMessage(`${key} reset to default`);
                setTimeout(() => setSuccessMessage(''), 3000);
            }
        } catch (error) {
            console.error('Reset failed:', error);
        }
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
                <title>System Settings | FREIP Admin</title>
            </Head>

            <div className="min-h-screen bg-gray-50 ml-64">
                <div className="p-6">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>
                            <p className="text-gray-500">Configure platform parameters</p>
                        </div>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                            <FaSave /> {isSaving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>

                    {/* Success Message */}
                    {successMessage && (
                        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 flex items-center gap-2">
                            <FaCheckCircle /> {successMessage}
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Main Settings */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* Investment Settings */}
                            <div className="bg-white rounded-xl border border-gray-100 p-6">
                                <h3 className="text-lg font-semibold text-gray-900 mb-4">Investment Settings</h3>
                                <div className="space-y-4">
                                    {['platform_fee_percentage', 'min_investment_amount', 'max_investment_amount'].map((key) => (
                                        <div key={key} className="flex items-start justify-between gap-4">
                                            <div className="flex-1">
                                                <label className="block text-sm font-medium text-gray-700">
                                                    {settingLabels[key]?.label}
                                                </label>
                                                <p className="text-xs text-gray-400 mt-1">{settingLabels[key]?.description}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type={settingLabels[key]?.type}
                                                    value={settings[key] || ''}
                                                    onChange={(e) => setSettings(prev => ({ ...prev, [key]: parseFloat(e.target.value) || 0 }))}
                                                    className="w-32 px-3 py-2 border border-gray-200 rounded-lg text-right"
                                                />
                                                <button
                                                    onClick={() => handleReset(key)}
                                                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                                                    title="Reset to default"
                                                >
                                                    <FaUndo />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* KYC & Referral Settings */}
                            <div className="bg-white rounded-xl border border-gray-100 p-6">
                                <h3 className="text-lg font-semibold text-gray-900 mb-4">KYC & Referral Settings</h3>
                                <div className="space-y-4">
                                    {['kyc_expiry_days', 'referral_reward_amount'].map((key) => (
                                        <div key={key} className="flex items-start justify-between gap-4">
                                            <div className="flex-1">
                                                <label className="block text-sm font-medium text-gray-700">
                                                    {settingLabels[key]?.label}
                                                </label>
                                                <p className="text-xs text-gray-400 mt-1">{settingLabels[key]?.description}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type={settingLabels[key]?.type}
                                                    value={settings[key] || ''}
                                                    onChange={(e) => setSettings(prev => ({ ...prev, [key]: parseFloat(e.target.value) || 0 }))}
                                                    className="w-32 px-3 py-2 border border-gray-200 rounded-lg text-right"
                                                />
                                                <button
                                                    onClick={() => handleReset(key)}
                                                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                                                    title="Reset to default"
                                                >
                                                    <FaUndo />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Maintenance Mode */}
                            <div className="bg-white rounded-xl border border-gray-100 p-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-900">Maintenance Mode</h3>
                                        <p className="text-sm text-gray-500">Temporarily disable platform access for users</p>
                                    </div>
                                    <button
                                        onClick={handleToggleMaintenance}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${maintenanceMode
                                                ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                            }`}
                                    >
                                        {maintenanceMode ? <FaToggleOn className="text-xl" /> : <FaToggleOff className="text-xl" />}
                                        {maintenanceMode ? 'Enabled' : 'Disabled'}
                                    </button>
                                </div>
                                {maintenanceMode && (
                                    <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm flex items-center gap-2">
                                        <FaExclamationTriangle /> Platform is currently in maintenance mode. Users cannot access the system.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Platform Stats Sidebar */}
                        <div className="space-y-6">
                            <div className="bg-white rounded-xl border border-gray-100 p-6">
                                <h3 className="text-lg font-semibold text-gray-900 mb-4">Platform Statistics</h3>
                                <div className="space-y-4">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Database Tables</span>
                                        <span className="font-medium">{platformStats?.tables || 0}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Total Rows</span>
                                        <span className="font-medium">{platformStats?.totalRows?.toLocaleString() || 0}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Active Sessions (24h)</span>
                                        <span className="font-medium">{platformStats?.activeSessions || 0}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Recent Actions (24h)</span>
                                        <span className="font-medium">{platformStats?.recentActions || 0}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl p-6 text-white">
                                <h3 className="font-semibold mb-2">Need Help?</h3>
                                <p className="text-sm text-blue-100 mb-4">
                                    Changes to these settings take effect immediately. Use caution when modifying critical parameters.
                                </p>
                                <a href="#" className="text-sm font-medium underline">View Documentation</a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
