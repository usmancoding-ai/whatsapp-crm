import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Users,
  ShieldAlert,
  Send,
  Calendar,
  CheckCircle2,
  XCircle,
  Search,
  Plus,
  RefreshCw,
  Trash2,
  Lock,
  Unlock,
  MessageSquare,
  ArrowLeft,
  Copy,
  Check,
  Smartphone,
  Loader2,
  BarChart3,
  X,
  Clock
} from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

const SuperAdminDashboard = ({ onBackToCRM, onLogout, currentUser }) => {
  const [stats, setStats] = useState(null);
  const [clients, setClients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isRenewOpen, setIsRenewOpen] = useState(false);
  const [isWhatsAppOpen, setIsWhatsAppOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    planLimit: 250,
    planDurationDays: 30,
    businessPhoneNumber: '',
  });

  const [renewData, setRenewData] = useState({ additionalDays: 30, planLimit: 250 });
  const [whatsAppData, setWhatsAppData] = useState({
    phoneNumberId: '',
    wabaId: '',
    whatsappAccessToken: '',
    businessPhoneNumber: '',
  });

  const [copiedId, setCopiedId] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const getHeaders = useCallback(() => {
    const token = localStorage.getItem('auth_token');
    return { headers: { Authorization: `Bearer ${token}` } };
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [statsRes, clientsRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/api/admin/stats`, getHeaders()),
        axios.get(`${BACKEND_URL}/api/admin/clients?search=${encodeURIComponent(search)}&status=${statusFilter}`, getHeaders()),
      ]);

      if (statsRes.data.success) setStats(statsRes.data.stats);
      if (clientsRes.data.success) setClients(clientsRes.data.clients);
    } catch (err) {
      console.error('Failed to load admin data:', err);
      if (err.response?.status === 401 || err.response?.status === 403) {
        onLogout();
      }
    } finally {
      setIsLoading(false);
    }
  }, [getHeaders, onLogout, search, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateClient = async (e) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      const res = await axios.post(`${BACKEND_URL}/api/admin/create-client`, formData, getHeaders());
      if (res.data.success) {
        setIsCreateOpen(false);
        setFormData({ name: '', email: '', password: '', planLimit: 250, planDurationDays: 30, businessPhoneNumber: '' });
        fetchData();
        alert('Client account created successfully!');
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create client');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleBlock = async (clientId) => {
    if (!window.confirm('Are you sure you want to change this client\'s block status?')) return;
    try {
      await axios.patch(`${BACKEND_URL}/api/admin/clients/${clientId}/toggle-block`, {}, getHeaders());
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to toggle block');
    }
  };

  const handleRenewPlan = async (e) => {
    e.preventDefault();
    if (!selectedClient) return;
    try {
      setActionLoading(true);
      await axios.patch(`${BACKEND_URL}/api/admin/clients/${selectedClient._id}/renew`, renewData, getHeaders());
      setIsRenewOpen(false);
      fetchData();
      alert('Plan renewed successfully!');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to renew plan');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateWhatsApp = async (e) => {
    e.preventDefault();
    if (!selectedClient) return;
    try {
      setActionLoading(true);
      await axios.patch(`${BACKEND_URL}/api/admin/clients/${selectedClient._id}/whatsapp`, whatsAppData, getHeaders());
      setIsWhatsAppOpen(false);
      fetchData();
      alert('WhatsApp credentials updated successfully!');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update WhatsApp');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteClient = async (clientId) => {
    if (!window.confirm('WARNING: Are you sure you want to permanently delete this client? This cannot be undone.')) return;
    try {
      await axios.delete(`${BACKEND_URL}/api/admin/clients/${clientId}`, getHeaders());
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete client');
    }
  };

  const copyCredentials = (email, password) => {
    navigator.clipboard.writeText(`CRM Login URL: ${window.location.origin}\nEmail: ${email}\nPassword: ${password}`);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans select-text">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-6 py-3.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold shadow-md shadow-emerald-500/20">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-800">Super Admin Command Center</h1>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                Multi-Tenant Engine
              </span>
            </div>
            <p className="text-xs text-slate-500">Monitor tenants, usage, limits, and infrastructure</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onBackToCRM}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Go to WhatsApp CRM</span>
          </button>

          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Client</span>
          </button>
        </div>
      </header>

      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Total Clients</p>
              <h3 className="text-2xl font-bold text-slate-800 mt-1">{stats?.totalClients ?? 0}</h3>
              <p className="text-[11px] text-emerald-600 font-medium mt-1">
                {stats?.activeClients ?? 0} Active • {stats?.blockedClients ?? 0} Blocked
              </p>
            </div>
            <div className="w-11 h-11 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Today's Messages Sent</p>
              <h3 className="text-2xl font-bold text-slate-800 mt-1">{stats?.platformSentToday ?? 0}</h3>
              <p className="text-[11px] text-slate-500 font-medium mt-1">Across all active plans</p>
            </div>
            <div className="w-11 h-11 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Send className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Total Contacts Managed</p>
              <h3 className="text-2xl font-bold text-slate-800 mt-1">{stats?.totalContacts ?? 0}</h3>
              <p className="text-[11px] text-slate-500 font-medium mt-1">{stats?.totalMessages ?? 0} Total Messages</p>
            </div>
            <div className="w-11 h-11 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <MessageSquare className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">WhatsApp Numbers</p>
              <h3 className="text-2xl font-bold text-slate-800 mt-1">{stats?.connectedWhatsAppCount ?? 0}</h3>
              <p className="text-[11px] text-emerald-600 font-medium mt-1">Connected & Ready</p>
            </div>
            <div className="w-11 h-11 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
              <Smartphone className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {['all', 'active', 'blocked', 'expired'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors cursor-pointer ${
                    statusFilter === st
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search by client name, email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Client Details</th>
                  <th className="py-3 px-4">Daily Usage</th>
                  <th className="py-3 px-4">Plan & Expiry</th>
                  <th className="py-3 px-4">WhatsApp Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan="5" className="py-12 text-center text-slate-400">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
                      Loading clients...
                    </td>
                  </tr>
                ) : clients.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-12 text-center text-slate-400">
                      No clients found matching the filter.
                    </td>
                  </tr>
                ) : (
                  clients.map((c) => {
                    const isExpired = c.daysRemaining !== null && c.daysRemaining <= 0;
                    const usagePercent = Math.min(100, Math.round(((c.sentToday || 0) / (c.planLimit || 250)) * 100));

                    return (
                      <tr key={c._id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                              {c.name ? c.name.charAt(0).toUpperCase() : 'C'}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-900 truncate">{c.name}</p>
                              <p className="text-[11px] text-slate-500 truncate">{c.email}</p>
                              {c.businessPhoneNumber && (
                                <p className="text-[10px] text-emerald-600 font-mono mt-0.5">{c.businessPhoneNumber}</p>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <div>
                            <div className="flex justify-between items-center text-[11px] mb-1">
                              <span className="font-semibold text-slate-800">{c.sentToday || 0} / {c.planLimit || 250}</span>
                              <span className="text-slate-400">{usagePercent}%</span>
                            </div>
                            <div className="w-36 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  usagePercent >= 90 ? 'bg-red-500' : usagePercent >= 60 ? 'bg-amber-500' : 'bg-emerald-500'
                                }`}
                                style={{ width: `${usagePercent}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <div>
                            <span className="inline-block px-2 py-0.5 rounded font-semibold text-[10px] bg-slate-100 text-slate-700 border border-slate-200 mb-1">
                              {c.planLimit}/day tier
                            </span>
                            <p className={`text-[11px] font-medium ${isExpired ? 'text-red-600' : 'text-slate-500'}`}>
                              {isExpired ? 'Expired' : c.daysRemaining !== null ? `${c.daysRemaining} days left` : 'No expiry'}
                            </p>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          {c.isWhatsAppConnected ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-medium bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Connected
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 font-medium bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                              <XCircle className="w-3 h-3 text-slate-400" />
                              Pending
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                setSelectedClient(c);
                                setWhatsAppData({
                                  phoneNumberId: c.phoneNumberId || '',
                                  wabaId: c.wabaId || '',
                                  whatsappAccessToken: c.whatsappAccessToken || '',
                                  businessPhoneNumber: c.businessPhoneNumber || '',
                                });
                                setIsWhatsAppOpen(true);
                              }}
                              className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                              title="Configure WhatsApp API"
                            >
                              <Smartphone className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => {
                                setSelectedClient(c);
                                setRenewData({ additionalDays: 30, planLimit: c.planLimit || 250 });
                                setIsRenewOpen(true);
                              }}
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                              title="Renew / Change Plan"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => handleToggleBlock(c._id)}
                              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                c.isBlocked
                                  ? 'text-red-600 hover:bg-red-50'
                                  : 'text-slate-500 hover:text-red-600 hover:bg-slate-100'
                              }`}
                              title={c.isBlocked ? 'Unblock Client' : 'Block Client'}
                            >
                              {c.isBlocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                            </button>

                            <button
                              onClick={() => handleDeleteClient(c._id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                              title="Delete Client"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {isCreateOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in">
            <div className="px-5 py-4 bg-emerald-600 text-white flex items-center justify-between">
              <h3 className="font-semibold text-sm">Create New Client Account</h3>
              <button onClick={() => setIsCreateOpen(false)} className="text-white hover:opacity-75 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateClient} className="p-5 space-y-3.5 text-xs text-slate-700">
              <div>
                <label className="block font-semibold mb-1">Company / Client Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Swift Dispatch Logistics"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:border-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Login Email</label>
                <input
                  type="email"
                  required
                  placeholder="client@gmail.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:border-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Login Password</label>
                <input
                  type="password"
                  required
                  placeholder="Create a strong password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:border-emerald-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Daily Plan Limit</label>
                  <select
                    value={formData.planLimit}
                    onChange={(e) => setFormData({ ...formData, planLimit: Number(e.target.value) })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:border-emerald-500 outline-none bg-white"
                  >
                    <option value="250">250 msgs/day</option>
                    <option value="500">500 msgs/day</option>
                    <option value="1000">1000 msgs/day</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1">Plan Validity</label>
                  <select
                    value={formData.planDurationDays}
                    onChange={(e) => setFormData({ ...formData, planDurationDays: Number(e.target.value) })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:border-emerald-500 outline-none bg-white"
                  >
                    <option value="30">30 Days (1 Month)</option>
                    <option value="60">60 Days (2 Months)</option>
                    <option value="90">90 Days (3 Months)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">WhatsApp Business Number (Optional)</label>
                <input
                  type="text"
                  placeholder="+1 (307) 228-0543"
                  value={formData.businessPhoneNumber}
                  onChange={(e) => setFormData({ ...formData, businessPhoneNumber: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:border-emerald-500 outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 cursor-pointer"
                >
                  {actionLoading ? 'Creating...' : 'Create Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isRenewOpen && selectedClient && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in">
            <div className="px-5 py-4 bg-slate-800 text-white flex items-center justify-between">
              <h3 className="font-semibold text-sm">Renew Plan: {selectedClient.name}</h3>
              <button onClick={() => setIsRenewOpen(false)} className="text-white hover:opacity-75 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRenewPlan} className="p-5 space-y-3.5 text-xs text-slate-700">
              <div>
                <label className="block font-semibold mb-1">Add Duration (Days)</label>
                <select
                  value={renewData.additionalDays}
                  onChange={(e) => setRenewData({ ...renewData, additionalDays: Number(e.target.value) })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs outline-none bg-white"
                >
                  <option value="30">+30 Days</option>
                  <option value="60">+60 Days</option>
                  <option value="90">+90 Days</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Upgrade / Set Limit</label>
                <select
                  value={renewData.planLimit}
                  onChange={(e) => setRenewData({ ...renewData, planLimit: Number(e.target.value) })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs outline-none bg-white"
                >
                  <option value="250">250 msgs/day</option>
                  <option value="500">500 msgs/day</option>
                  <option value="1000">1000 msgs/day</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsRenewOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-1.5 rounded-lg bg-slate-800 text-white font-semibold hover:bg-slate-900 cursor-pointer"
                >
                  {actionLoading ? 'Updating...' : 'Confirm Renewal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isWhatsAppOpen && selectedClient && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in">
            <div className="px-5 py-4 bg-emerald-600 text-white flex items-center justify-between">
              <h3 className="font-semibold text-sm">WhatsApp API Setup: {selectedClient.name}</h3>
              <button onClick={() => setIsWhatsAppOpen(false)} className="text-white hover:opacity-75 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateWhatsApp} className="p-5 space-y-3 text-xs text-slate-700">
              <div>
                <label className="block font-semibold mb-1">Phone Number ID</label>
                <input
                  type="text"
                  placeholder="e.g. 1086421201032758"
                  value={whatsAppData.phoneNumberId}
                  onChange={(e) => setWhatsAppData({ ...whatsAppData, phoneNumberId: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 font-mono text-xs outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">WABA ID</label>
                <input
                  type="text"
                  placeholder="e.g. 936742855945662"
                  value={whatsAppData.wabaId}
                  onChange={(e) => setWhatsAppData({ ...whatsAppData, wabaId: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 font-mono text-xs outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">WhatsApp Access Token</label>
                <textarea
                  rows="3"
                  placeholder="Permanent Meta System User Token (EAAG...)"
                  value={whatsAppData.whatsappAccessToken}
                  onChange={(e) => setWhatsAppData({ ...whatsAppData, whatsappAccessToken: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 font-mono text-xs outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Business Phone Number</label>
                <input
                  type="text"
                  placeholder="+1 (307) 228-0543"
                  value={whatsAppData.businessPhoneNumber}
                  onChange={(e) => setWhatsAppData({ ...whatsAppData, businessPhoneNumber: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsWhatsAppOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 cursor-pointer"
                >
                  {actionLoading ? 'Saving...' : 'Save Credentials'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminDashboard;