import React, { useState } from 'react';
import axios from 'axios';
import { Lock, Mail, Loader2, MessageSquare, ShieldCheck } from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

const Login = ({ onLoginSuccess }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setIsLoading(true);

    try {
      const endpoint = isRegistering ? '/api/auth/register' : '/api/auth/login';
      const payload = isRegistering ? { name, email, password } : { email, password };

      const res = await axios.post(`${BACKEND_URL}${endpoint}`, payload);

      if (res.data.success) {
        localStorage.setItem('auth_token', res.data.data.token);
        localStorage.setItem('user_info', JSON.stringify(res.data.data));
        onLoginSuccess(res.data.data);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Authentication failed! Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden border border-gray-200">
        <div className="bg-emerald-600 p-6 text-white text-center">
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <MessageSquare className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">ITGENIUSX Dispatch</h1>
          <p className="text-xs text-emerald-100 mt-1 flex items-center justify-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" /> Secure WhatsApp CRM
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-800 text-center">
            {isRegistering ? 'Create Admin Account' : 'Sign in to your Dashboard'}
          </h2>

          {errorMsg && (
            <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg text-center">
              {errorMsg}
            </div>
          )}

          {isRegistering && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Full Name</label>
              <input
                type="text"
                placeholder="e.g. Usman Admin"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="email"
                placeholder="admin@itgeniusx.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 rounded-lg text-sm transition-colors flex items-center justify-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : isRegistering ? 'Register' : 'Login'}
          </button>

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => {
                setIsRegistering(!isRegistering);
                setErrorMsg('');
              }}
              className="text-xs text-emerald-600 hover:underline cursor-pointer font-medium"
            >
           
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;