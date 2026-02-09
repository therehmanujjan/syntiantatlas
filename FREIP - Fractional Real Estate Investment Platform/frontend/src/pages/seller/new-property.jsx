import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import { useAuthStore } from '../../store';
import { propertyApi } from '../../utils/api';

export default function NewProperty() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isClient, setIsClient] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    address: '',
    city: '',
    property_type: 'residential',
    area_sqft: '',
    total_value: '',
    funding_target: '',
    min_investment: '',
    max_investment: '',
    expected_returns_annual: '',
    rental_yield: '',
  });

  useEffect(() => {
    setIsClient(true);
    if (!token || user?.role !== 'seller') {
      router.push('/login');
    }
  }, [token, user, router]);

  if (!isClient) return null; // Prevent hydration mismatch

  if (!token || user?.role !== 'seller') {
    return null;
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const propertyData = {
        ...formData,
        area_sqft: parseFloat(formData.area_sqft),
        total_value: parseFloat(formData.total_value),
        funding_target: parseFloat(formData.funding_target),
        min_investment: parseFloat(formData.min_investment),
        max_investment: parseFloat(formData.max_investment),
        expected_returns_annual: parseFloat(formData.expected_returns_annual),
        rental_yield: parseFloat(formData.rental_yield),
        location: { latitude: 31.5497, longitude: 74.3436 }, // Default location
      };

      const response = await propertyApi.create(propertyData);
      router.push(`/seller/property/${response.data.property.id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create property');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Layout user={user} onLogout={() => {
      localStorage.removeItem('token');
      useAuthStore.setState({ user: null, token: null });
      router.push('/login');
    }}>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">List New Property</h1>

        {error && (
          <div className="card bg-red-50 border border-red-200 text-red-700 mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="card">
            <h2 className="text-xl font-bold mb-4">Basic Information</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Property Title</label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="e.g., Modern Apartment in Gulberg"
                  className="input-field"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Detailed property description"
                  className="input-field min-h-[100px]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Address</label>
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    placeholder="Street address"
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">City</label>
                  <select
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    className="input-field"
                    required
                  >
                    <option value="">Select City</option>
                    <option value="Lahore">Lahore</option>
                    <option value="Karachi">Karachi</option>
                    <option value="Islamabad">Islamabad</option>
                    <option value="Multan">Multan</option>
                    <option value="Faisalabad">Faisalabad</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Property Type</label>
                <select
                  name="property_type"
                  value={formData.property_type}
                  onChange={handleChange}
                  className="input-field"
                >
                  <option value="residential">Residential</option>
                  <option value="commercial">Commercial</option>
                  <option value="industrial">Industrial</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Area (sq ft)</label>
                <input
                  type="number"
                  name="area_sqft"
                  value={formData.area_sqft}
                  onChange={handleChange}
                  placeholder="e.g., 2500"
                  className="input-field"
                  required
                />
              </div>
            </div>
          </div>

          {/* Financial Information */}
          <div className="card">
            <h2 className="text-xl font-bold mb-4">Financial Information</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Total Property Value (PKR)</label>
                  <input
                    type="number"
                    name="total_value"
                    value={formData.total_value}
                    onChange={handleChange}
                    placeholder="e.g., 5000000"
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Funding Target (PKR)</label>
                  <input
                    type="number"
                    name="funding_target"
                    value={formData.funding_target}
                    onChange={handleChange}
                    placeholder="e.g., 2500000"
                    className="input-field"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Min Investment (PKR)</label>
                  <input
                    type="number"
                    name="min_investment"
                    value={formData.min_investment}
                    onChange={handleChange}
                    placeholder="e.g., 100000"
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Max Investment (PKR)</label>
                  <input
                    type="number"
                    name="max_investment"
                    value={formData.max_investment}
                    onChange={handleChange}
                    placeholder="e.g., 500000"
                    className="input-field"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Expected Annual Returns (%)</label>
                  <input
                    type="number"
                    name="expected_returns_annual"
                    value={formData.expected_returns_annual}
                    onChange={handleChange}
                    placeholder="e.g., 12.5"
                    step="0.1"
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Rental Yield (%)</label>
                  <input
                    type="number"
                    name="rental_yield"
                    value={formData.rental_yield}
                    onChange={handleChange}
                    placeholder="e.g., 8.5"
                    step="0.1"
                    className="input-field"
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="btn-secondary flex-1"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary flex-1"
              disabled={isLoading}
            >
              {isLoading ? 'Creating...' : 'List Property'}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
