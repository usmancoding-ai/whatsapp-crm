import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

const Callback = () => {
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('Connecting your WhatsApp Business... Please wait.');

  useEffect(() => {
    const handleExchangeCode = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');

      if (!code) {
        setStatus('error');
        setMessage('Authorization code not found. Please try again.');
        return;
      }

      try {
        const token = localStorage.getItem('auth_token');

        const res = await axios.post(
          `${BACKEND_URL}/api/whatsapp/embedded-callback`,
          { code },
          {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          }
        );

        if (res.data.success) {
          setStatus('success');
          setMessage('Your WhatsApp Business account has been connected successfully.');

          setTimeout(() => {
            window.location.href = '/';
          }, 2000);
        } else {
          setStatus('error');
          setMessage(res.data.message || 'Could not connect WhatsApp. Please try again.');
        }
      } catch (err) {
        console.error('Callback exchange error:', err);
        setStatus('error');
        setMessage(err.response?.data?.message || 'A server error occurred while connecting WhatsApp.');
      }
    };

    handleExchangeCode();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-lg max-w-md w-full text-center space-y-4 border border-gray-100">
        {status === 'loading' && (
          <div className="flex flex-col items-center space-y-3">
            <Loader2 className="w-12 h-12 text-emerald-600 animate-spin" />
            <h2 className="text-lg font-semibold text-gray-800">Connecting WhatsApp</h2>
            <p className="text-sm text-gray-500">{message}</p>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-600 animate-bounce" />
            <h2 className="text-lg font-semibold text-gray-800">Connection Successful!</h2>
            <p className="text-sm text-gray-600">{message}</p>
            <span className="text-xs text-gray-400">Redirecting to the dashboard...</span>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center space-y-3">
            <AlertCircle className="w-12 h-12 text-red-500" />
            <h2 className="text-lg font-semibold text-gray-800">Connection Failed</h2>
            <p className="text-sm text-red-600">{message}</p>
            <button
              onClick={() => (window.location.href = '/')}
              className="mt-3 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Callback;