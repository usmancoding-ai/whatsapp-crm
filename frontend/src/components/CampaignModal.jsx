import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Send, Megaphone, CheckCircle2, AlertCircle, Users, Loader2 } from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

const CampaignModal = ({ isOpen, onClose, onStartCampaign }) => {
  const [limit, setLimit] = useState(50);
  const [templateName, setTemplateName] = useState('dispatch_templete');
  const [languageCode, setLanguageCode] = useState('en');
  const [availableCount, setAvailableCount] = useState(null);
  const [isCounting, setIsCounting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  useEffect(() => {
    if (!isOpen) return;

    const fetchAvailableCount = async () => {
      try {
        setIsCounting(true);
        const savedUser = JSON.parse(localStorage.getItem('user_info') || '{}');
        const res = await axios.get(`${BACKEND_URL}/api/chat/campaign/preview`, {
          params: { targetTag: 'General', excludeTag: 'Excluded', userId: savedUser._id, role: savedUser.role },
        });
        if (res.data.success) {
          setAvailableCount(res.data.count);
          if (res.data.count > 0 && limit > res.data.count) {
            setLimit(res.data.count);
          }
        }
      } catch (err) {
        console.error('Preview count error:', err);
      } finally {
        setIsCounting(false);
      }
    };

    fetchAvailableCount();
  }, [isOpen]);

  if (!isOpen) return null;

 const handleSubmit = async (e) => {
    e.preventDefault();
    if (!templateName.trim()) return;

    const savedUser = JSON.parse(localStorage.getItem('user_info') || '{}');

    if (availableCount === 0) {
      setStatusMessage({
        type: 'error',
        text: 'No eligible contacts available.',
      });
      return;
    }

    try {
      setIsLoading(true);
      setStatusMessage(null);

      const res = await onStartCampaign({
        targetTag: 'General',
        excludeTag: 'Excluded',
        limit: Number(limit),
        templateName: templateName.trim(),
        languageCode,
        userId: savedUser._id,
        role: savedUser.role,
      });

      setStatusMessage({ type: 'success', text: res.message });
      setTimeout(() => {
        onClose();
        setStatusMessage(null);
      }, 2500);
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err.response?.data?.message || 'The campaign could not be started. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="px-5 py-4 bg-emerald-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Megaphone className="w-5 h-5" />
            <h2 className="text-base font-semibold">Start Broadcast Campaign</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-emerald-700 rounded-full transition-colors cursor-pointer text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-sm text-gray-700">
          {statusMessage && (
            <div
              className={`p-3 rounded-lg flex items-start gap-2 text-xs ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              )}
              <span className="leading-relaxed">{statusMessage.text}</span>
            </div>
          )}

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-800">Target Contacts</p>
              <p className="text-[11px] text-gray-500">Excluded/VIP contacts will be skipped.</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">
              <Users className="w-3.5 h-3.5" />
              {isCounting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span>{availableCount ?? 0} Eligible</span>}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Quantity Limit (How many contacts should we send it to?):
            </label>
            <input
              type="number"
              min="1"
              max={availableCount && availableCount > 0 ? availableCount : 1000}
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Meta Approved Template Name:
            </label>
            <input
              type="text"
              placeholder="e.g. dispatch_templete"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 font-mono text-xs"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || availableCount === 0}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? (
                'Verifying & Queueing...'
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" /> Start Campaign
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CampaignModal;