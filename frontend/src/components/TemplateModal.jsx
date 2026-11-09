import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { 
  X, Plus, FileCode, CheckCircle2, Clock, AlertCircle, RefreshCw, Loader2, Sparkles, Image as ImageIcon, Trash2 
} from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

const TemplateModal = ({ isOpen, onClose, currentUser }) => {
  const [templates, setTemplates] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);

  const [name, setName] = useState('');
  const [category, setCategory] = useState('UTILITY');
  const [bodyText, setBodyText] = useState('');
  
  const [hasHeaderImage, setHasHeaderImage] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const fileInputRef = useRef(null);

  const [buttonType, setButtonType] = useState('NONE');
  const [buttonText, setButtonText] = useState('');
  const [buttonValue, setButtonValue] = useState('');

  const fetchTemplates = async () => {
    try {
      setIsLoading(true);
      const res = await axios.get(`${BACKEND_URL}/api/chat/templates`, {
        params: {
          userId: currentUser?._id,
          role: currentUser?.role,
        },
      });
      if (res.data.success) {
        setTemplates(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load templates:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
      setStatusMsg(null);
    }
  }, [isOpen]);

  useEffect(() => {
    const socket = io(BACKEND_URL);

    socket.on('template_created', (newTpl) => {
      setTemplates((prev) => {
        const filtered = prev.filter((t) => t.name !== newTpl.name);
        return [newTpl, ...filtered];
      });
    });

    return () => socket.disconnect();
  }, []);

  if (!isOpen) return null;

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !bodyText.trim()) return;

    try {
      setIsSubmitting(true);
      setStatusMsg(null);

      const formData = new FormData();
      formData.append('name', name);
      formData.append('category', category);
      formData.append('bodyText', bodyText);
      formData.append('hasHeaderImage', hasHeaderImage);
      if (imageFile) formData.append('image', imageFile);
      formData.append('buttonType', buttonType);
      formData.append('buttonText', buttonText.trim());
      formData.append('buttonValue', buttonValue.trim());
      if (currentUser?._id) formData.append('userId', currentUser._id);
      if (currentUser?.role) formData.append('role', currentUser.role);

      const res = await axios.post(`${BACKEND_URL}/api/chat/templates`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data.success) {
        setStatusMsg({ type: 'success', text: res.data.message });
        setName('');
        setBodyText('');
        setHasHeaderImage(false);
        handleRemoveImage();
        setButtonType('NONE');
        setButtonText('');
        setButtonValue('');

        if (res.data.data) {
          setTemplates((prev) => [res.data.data, ...prev.filter((t) => t.name !== res.data.data.name)]);
        }
      }
    } catch (err) {
      setStatusMsg({
        type: 'error',
        text: err.response?.data?.message || 'The template could not be submitted. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };
const handleDeleteTemplate = async (templateName) => {
    if (!window.confirm(`Are you sure you want to delete the template "${templateName}" from Meta?`)) return;

    try {
      const res = await axios.delete(`${BACKEND_URL}/api/chat/templates/${templateName}`, {
        params: {
          userId: currentUser?._id,
          role: currentUser?.role,
        },
      });

      if (res.data.success) {
        setTemplates((prev) => prev.filter((t) => t.name !== templateName));
      }
    } catch (err) {
      alert(err.response?.data?.message || 'The template could not be deleted. Please try again.');
    }
  };
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 bg-emerald-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <FileCode className="w-5 h-5 text-emerald-200" />
            <h2 className="text-base font-bold">WhatsApp Template Manager</h2>
          </div>
          <button onClick={onClose} className="p-1 text-emerald-200 hover:text-white rounded-lg cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs text-gray-700">
          {statusMsg && (
            <div
              className={`p-3 rounded-lg flex items-center gap-2 ${
                statusMsg.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}
            >
              <span>{statusMsg.text}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3.5">
            <h3 className="font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-emerald-600" />
              Create & Submit New Meta Template
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold mb-1">Template Name (Lowercase & Underscore):</label>
                <input
                  type="text"
                  placeholder="e.g. daily_freight_inquiry"
                  value={name}
                  onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                  required
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Category:</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="UTILITY">UTILITY (Recommended - Safe & Fast Delivery)</option>
                  <option value="MARKETING">MARKETING (Sales & Promotions)</option>
                </select>
              </div>
            </div>

            <div className="p-3 bg-white rounded-lg border border-gray-200 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={hasHeaderImage}
                  onChange={(e) => {
                    setHasHeaderImage(e.target.checked);
                    if (!e.target.checked) handleRemoveImage();
                  }}
                  className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                />
                <span className="font-semibold text-gray-800">Attach Custom Header Photo</span>
              </label>

              {hasHeaderImage && (
                <div className="pt-1.5 flex items-center gap-3">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 flex items-center gap-1.5 cursor-pointer"
                  >
                    <ImageIcon className="w-4 h-4 text-emerald-600" />
                    <span>{imageFile ? 'Change Photo' : 'Choose Photo from Computer'}</span>
                  </button>

                  {imagePreview && (
                    <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg">
                      <img src={imagePreview} alt="Preview" className="w-8 h-8 object-cover rounded" />
                      <span className="text-[11px] text-gray-700 font-medium truncate max-w-[150px]">{imageFile?.name}</span>
                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        className="text-gray-400 hover:text-red-500 p-0.5 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block font-semibold mb-1">
                Body Text: <span className="font-normal text-gray-500">(Use {`{{1}}, {{2}}`} for variables)</span>
              </label>
              <textarea
                rows={3}
                placeholder="Hello {{1}}, we have available loads from {{2}} to {{3}}. Reply to this message to coordinate with dispatch."
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                required
                className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 resize-none leading-relaxed"
              />
            </div>

            <div className="p-3 bg-white rounded-lg border border-gray-200 space-y-2.5">
              <label className="block font-semibold text-gray-800">Action Button (Optional):</label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <select
                  value={buttonType}
                  onChange={(e) => {
                    setButtonType(e.target.value);
                    if (e.target.value === 'QUICK_REPLY' && !buttonText) setButtonText('Stop Promotions');
                  }}
                  className="bg-gray-50 border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="NONE">No Button</option>
                  <option value="URL">Visit Website Link</option>
                  <option value="QUICK_REPLY">Quick Reply (Stop / Not Interested)</option>
                  <option value="PHONE_NUMBER">Call Phone Number</option>
                </select>

                {buttonType !== 'NONE' && (
                  <input
                    type="text"
                    placeholder="Button Label (e.g. Visit Website)"
                    value={buttonText}
                    onChange={(e) => setButtonText(e.target.value)}
                    required
                    className="bg-gray-50 border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-500"
                  />
                )}

                {buttonType === 'URL' && (
                  <input
                    type="url"
                    placeholder="Website URL (https://...)"
                    value={buttonValue}
                    onChange={(e) => setButtonValue(e.target.value)}
                    required
                    className="bg-gray-50 border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-500"
                  />
                )}

                {buttonType === 'PHONE_NUMBER' && (
                  <input
                    type="text"
                    placeholder="Phone with Country Code"
                    value={buttonValue}
                    onChange={(e) => setButtonValue(e.target.value)}
                    required
                    className="bg-gray-50 border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-500"
                  />
                )}
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                <span>Submit to Meta</span>
              </button>
            </div>
          </form>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                <FileCode className="w-4 h-4 text-emerald-600" />
                Your Meta Templates ({templates.length})
              </h3>
              <button
                onClick={fetchTemplates}
                className="text-gray-500 hover:text-emerald-600 flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refresh Status
              </button>
            </div>

            {isLoading ? (
              <div className="py-8 flex justify-center">
                <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-6 border border-gray-200 rounded-xl text-gray-400">
                No templates found. Create a template using the form above.
              </div>
            ) : (
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-100 text-gray-600 border-b border-gray-200">
                      <th className="p-3">Template Name</th>
                      <th className="p-3">Category</th>
                      <th className="p-3">Language</th>
                      <th className="p-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {templates.map((tpl) => (
                      <tr key={tpl.id || tpl.name} className="hover:bg-gray-50">
                        <td className="p-3 font-mono font-medium text-gray-800">{tpl.name}</td>
                        <td className="p-3 text-gray-600">{tpl.category}</td>
                        <td className="p-3 text-gray-600 uppercase">{tpl.language}</td>
                      <td className="p-3 text-right flex items-center justify-end gap-2">
                          {tpl.status === 'APPROVED' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full font-bold">
                              <CheckCircle2 className="w-3 h-3" /> APPROVED
                            </span>
                          ) : tpl.status === 'REJECTED' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-700 rounded-full font-bold">
                              <AlertCircle className="w-3 h-3" /> REJECTED
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full font-bold">
                              <Clock className="w-3 h-3" /> {tpl.status}
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDeleteTemplate(tpl.name)}
                            className="p-1 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded transition-colors cursor-pointer"
                            title="Delete template from Meta"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
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

export default TemplateModal;