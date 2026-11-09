import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  User,
  Phone,
  Building2,
  MapPin,
  Tag,
  Plus,
  X,
  Save,
  Loader2,
  Copy,
  Check,
  Briefcase,
  Globe,
  FileText
} from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

const ContactDetailsPanel = ({ contact, onClose, onUpdateContact }) => {
  const [details, setDetails] = useState({
    companyName: '',
    location: '',
    leadStatus: 'New Lead',
    websiteOrEmail: '',
    customTags: [],
    internalNotes: '',
  });

  const [newTagInput, setNewTagInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [copiedField, setCopiedField] = useState(null);

  useEffect(() => {
    if (contact) {
      setDetails({
        companyName: contact.companyName || contact.mcNumber || '',
        location: contact.location || contact.route || '',
        leadStatus: contact.leadStatus || 'New Lead',
        websiteOrEmail: contact.websiteOrEmail || contact.dotNumber || '',
        customTags: Array.isArray(contact.customTags) ? contact.customTags : [],
        internalNotes: contact.internalNotes || '',
      });
    }
  }, [contact]);

  if (!contact) return null;

  const handleCopy = (text, fieldName) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleAddTag = (e) => {
    e.preventDefault();
    const tag = newTagInput.trim();
    if (tag && !details.customTags.includes(tag)) {
      setDetails((prev) => ({
        ...prev,
        customTags: [...prev.customTags, tag],
      }));
      setNewTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setDetails((prev) => ({
      ...prev,
      customTags: prev.customTags.filter((t) => t !== tagToRemove),
    }));
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const res = await axios.patch(
        `${BACKEND_URL}/api/chat/contacts/${contact._id}/details`,
        {
          companyName: details.companyName,
          location: details.location,
          leadStatus: details.leadStatus,
          websiteOrEmail: details.websiteOrEmail,
          customTags: details.customTags,
          internalNotes: details.internalNotes,
          // Clear empty fields to remove their previous values from the database.
          equipmentType: '',
          mcNumber: details.companyName,
          dotNumber: details.websiteOrEmail,
          route: details.location,
        }
      );
      if (res.data.success) {
        onUpdateContact(res.data.contact);
        alert('Contact details saved successfully!');
      }
    } catch (err) {
      console.error('Failed to save details:', err);
      alert('Failed to save details');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <aside className="w-80 h-full border-l border-slate-200 bg-white flex flex-col shrink-0 text-slate-700 select-text">
      <div className="p-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
          <FileText className="w-4 h-4 text-emerald-600" />
          Contact Intelligence
        </h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-md transition-colors cursor-pointer"
          title="Close panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center text-sm shrink-0">
              {contact.clientName ? contact.clientName.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-slate-900 truncate">{contact.clientName || 'Unknown Client'}</p>
              <div className="flex items-center gap-1 text-[11px] text-slate-500 font-mono">
                <Phone className="w-3 h-3 text-slate-400" />
                <span>+{contact.phoneNumber}</span>
                <button
                  onClick={() => handleCopy(`+${contact.phoneNumber}`, 'phone')}
                  className="hover:text-emerald-600 cursor-pointer ml-1"
                  title="Copy Phone"
                >
                  {copiedField === 'phone' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
            <Briefcase className="w-3.5 h-3.5 text-slate-400" /> Lead / Deal Status
          </label>
          <select
            value={details.leadStatus}
            onChange={(e) => setDetails({ ...details, leadStatus: e.target.value })}
            className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:border-emerald-500 outline-none bg-white font-medium"
          >
            <option value="New Lead">🟢 New Lead</option>
            <option value="Contacted">🔵 Contacted / Follow-Up</option>
            <option value="In Discussion">🟡 In Discussion</option>
            <option value="Qualified">🟣 Qualified Prospect</option>
            <option value="Won / Customer">⭐ Won / Active Customer</option>
            <option value="Lost / Inactive">🔴 Lost / Not Interested</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5 text-slate-400" /> Company / Business Name
          </label>
          <input
            type="text"
            placeholder="e.g. Apex Global, Prime Logistics..."
            value={details.companyName}
            onChange={(e) => setDetails({ ...details, companyName: e.target.value })}
            className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:border-emerald-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-slate-400" /> Location / City, State
          </label>
          <input
            type="text"
            placeholder="e.g. Dallas, TX or London, UK..."
            value={details.location}
            onChange={(e) => setDetails({ ...details, location: e.target.value })}
            className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:border-emerald-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
            <Globe className="w-3.5 h-3.5 text-slate-400" /> Website or Email
          </label>
          <input
            type="text"
            placeholder="e.g. info@company.com or website.com"
            value={details.websiteOrEmail}
            onChange={(e) => setDetails({ ...details, websiteOrEmail: e.target.value })}
            className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:border-emerald-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
            <Tag className="w-3.5 h-3.5 text-slate-400" /> Custom Tags
          </label>
          
          <div className="flex flex-wrap gap-1.5 mb-2">
            {details.customTags.length === 0 ? (
              <span className="text-[11px] text-slate-400 italic">No custom tags added</span>
            ) : (
              details.customTags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-medium"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:text-red-500 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))
            )}
          </div>

          <form onSubmit={handleAddTag} className="flex gap-1.5">
            <input
              type="text"
              placeholder="Add tag (VIP, Hot Lead, Client)..."
              value={newTagInput}
              onChange={(e) => setNewTagInput(e.target.value)}
              className="flex-1 border border-slate-200 rounded-lg px-2 py-1 text-[11px] outline-none focus:border-emerald-500"
            />
            <button
              type="submit"
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3 h-3" /> Add
            </button>
          </form>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
            Internal Private Notes
          </label>
          <textarea
            rows="3"
            placeholder="Add internal notes about this client/lead..."
            value={details.internalNotes}
            onChange={(e) => setDetails({ ...details, internalNotes: e.target.value })}
            className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:border-emerald-500 outline-none resize-none"
          />
        </div>
      </div>

      <div className="p-3 border-t border-slate-200 bg-slate-50">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
        >
          {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          <span>Save Contact Details</span>
        </button>
      </div>
    </aside>
  );
};

export default ContactDetailsPanel;