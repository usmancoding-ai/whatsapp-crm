import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  X, UserPlus, Shield, Ban, CheckCircle2, Trash2, RefreshCw, Loader2, Users 
} from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

const AdminModal = ({ isOpen, onClose }) => {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [planLimit, setPlanLimit] = useState(250);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const res = await axios.get(`${BACKEND_URL}/api/auth/users`);
      if (res.data.success) {
        setUsers(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
      setStatusMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim()) return;

    try {
      setIsCreating(true);
      setStatusMsg(null);
      const res = await axios.post(`${BACKEND_URL}/api/auth/create-user`, {
        name,
        email,
        password,
        planLimit: Number(planLimit),
        validityDays: 30,
      });

      if (res.data.success) {
        setStatusMsg({ type: 'success', text: res.data.message });
        setName('');
        setEmail('');
        setPassword('');
        setPlanLimit(250);
        fetchUsers();
      }
    } catch (err) {
      setStatusMsg({
        type: 'error',
        text: err.response?.data?.message || 'The customer could not be created. Please try again.',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggleBlock = async (userId) => {
    try {
      const res = await axios.patch(`${BACKEND_URL}/api/auth/users/${userId}/toggle-block`);
      if (res.data.success) {
        fetchUsers();
      }
    } catch (err) {
      alert('The action failed. Please try again.');
    }
  };

  const handleUpdatePlan = async (userId, newLimit) => {
    try {
      const res = await axios.patch(`${BACKEND_URL}/api/auth/users/${userId}/plan`, {
        planLimit: Number(newLimit),
        renewDays: 30,
      });
      if (res.data.success) {
        fetchUsers();
      }
    } catch (err) {
      alert('The plan could not be updated. Please try again.');
    }
  };

  const handleDeleteUser = async (userId, userName) => {
    if (!window.confirm(`Are you sure you want to delete customer "${userName}"?`)) return;
    try {
      await axios.delete(`${BACKEND_URL}/api/auth/users/${userId}`);
      fetchUsers();
    } catch (err) {
      alert('The customer could not be deleted. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 bg-gray-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Shield className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold">Super Admin Panel — Client & Plan Management</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {statusMsg && (
            <div
              className={`p-3 rounded-lg text-xs font-medium flex items-center gap-2 ${
                statusMsg.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}
            >
              <span>{statusMsg.text}</span>
            </div>
          )}

          <form
            onSubmit={handleCreateUser}
            className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3"
          >
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
              <UserPlus className="w-4 h-4 text-emerald-600" />
              Create New Customer Account (30 Days Validity)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <input
                type="text"
                placeholder="Company / Client Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-500"
              />

              <input
                type="email"
                placeholder="Client Login Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-500"
              />

              <input
                type="text"
                placeholder="Set Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-500"
              />

              <select
                value={planLimit}
                onChange={(e) => setPlanLimit(e.target.value)}
                className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs font-medium focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value={250}>Starter: 250 Msgs / Day</option>
                <option value={500}>Growth: 500 Msgs / Day</option>
                <option value={1000}>Pro: 1000 Msgs / Day</option>
              </select>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isCreating}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                <span>Create Customer</span>
              </button>
            </div>
          </form>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-emerald-600" />
                Active Customers ({users.length})
              </h3>
              <button
                onClick={fetchUsers}
                className="text-xs text-gray-500 hover:text-emerald-600 flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
            </div>

            {isLoading ? (
              <div className="py-12 flex justify-center">
                <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-8 text-xs text-gray-400 border rounded-xl">
                No customers have been created yet.
              </div>
            ) : (
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-100 text-gray-600 border-b border-gray-200">
                      <th className="p-3">Client</th>
                      <th className="p-3">Daily Plan</th>
                      <th className="p-3">WhatsApp</th>
                      <th className="p-3">Expiry Date</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {users.map((u) => {
                      const isExpired = u.planExpiry && new Date() > new Date(u.planExpiry);
                      return (
                        <tr key={u._id} className="hover:bg-gray-50">
                          <td className="p-3">
                            <p className="font-semibold text-gray-800">{u.name}</p>
                            <p className="text-[11px] text-gray-500">{u.email}</p>
                          </td>

                          <td className="p-3">
                            <select
                              value={u.planLimit || 250}
                              onChange={(e) => handleUpdatePlan(u._id, e.target.value)}
                              className="border border-gray-300 rounded px-2 py-1 text-xs bg-white cursor-pointer"
                            >
                              <option value={250}>250 / day</option>
                              <option value={500}>500 / day</option>
                              <option value={1000}>1000 / day</option>
                            </select>
                            <p className="text-[10px] text-gray-400 mt-0.5">
                              Sent Today: {u.sentToday || 0} / {u.planLimit || 250}
                            </p>
                          </td>

                          <td className="p-3">
                            {u.isWhatsAppConnected ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-[11px] font-medium">
                                <CheckCircle2 className="w-3 h-3" /> Connected
                              </span>
                            ) : (
                              <span className="text-[11px] text-gray-400">Not Connected</span>
                            )}
                          </td>

                          <td className="p-3">
                            <span className={isExpired ? 'text-red-600 font-semibold' : 'text-gray-600'}>
                              {u.planExpiry ? new Date(u.planExpiry).toLocaleDateString() : 'N/A'}
                            </span>
                          </td>

                          <td className="p-3">
                            {u.isBlocked ? (
                              <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-[10px] font-bold">
                                Blocked
                              </span>
                            ) : isExpired ? (
                              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[10px] font-bold">
                                Expired
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-bold">
                                Active
                              </span>
                            )}
                          </td>

                          <td className="p-3 text-right space-x-1">
                            <button
                              onClick={() => handleToggleBlock(u._id)}
                              className={`p-1.5 rounded-lg cursor-pointer ${
                                u.isBlocked
                                  ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                  : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                              }`}
                              title={u.isBlocked ? 'Unblock Client' : 'Block Client'}
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handleDeleteUser(u._id, u.name)}
                              className="p-1.5 bg-red-100 text-red-600 hover:bg-red-200 rounded-lg cursor-pointer"
                              title="Delete Client"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminModal;