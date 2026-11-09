import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import {
  Search,
  User,
  Pin,
  Megaphone,
  ShieldCheck,
  FileSpreadsheet,
  Loader2,
  UserPlus,
  X,
  Send,
  FileCode,
  Filter
} from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

const Sidebar = ({
  contacts = [],
  selectedContact,
  onSelectContact,
  onTogglePinContact,
  onUpdateContactTag,
  onOpenCampaign,
  isLoadingContacts,
  onLoadMoreContacts,
  hasMoreContacts,
  isLoadingMoreContacts,
  currentUser,
  onOpenAdmin,
  onOpenTemplates,
  onSearch,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('All');
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef(null);

  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [newName, setNewName] = useState('');
  
const [newTemplate, setNewTemplate] = useState('visit_website');
  const [isStartingChat, setIsStartingChat] = useState(false);
  const [newChatError, setNewChatError] = useState('');
const [showContactSuggestions, setShowContactSuggestions] = useState(false);
const [templateList, setTemplateList] = useState([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);

  useEffect(() => {
    if (isNewChatOpen && currentUser) {
      setIsLoadingTemplates(true);
     axios
        .get(`${BACKEND_URL}/api/chat/templates?userId=${currentUser?._id}&role=${currentUser?.role}`)
        .then((res) => {
          if (res.data.success && res.data.data?.length > 0) {
            const approved = res.data.data.filter((t) => t.status === 'APPROVED');
            if (approved.length > 0) {
              setTemplateList(approved);
              setNewTemplate(approved[0].name);
            }
          }
        })
        .catch((err) => {
          console.error('Failed to fetch templates:', err);
        })
        .finally(() => {
          setIsLoadingTemplates(false);
        });
    }
  }, [isNewChatOpen, currentUser]);
  const handleStartNewChat = async (e) => {
    e.preventDefault();
    if (!newPhone.trim()) return;

    try {
      setIsStartingChat(true);
      setNewChatError('');

      const res = await axios.post(`${BACKEND_URL}/api/chat/start-new-chat`, {
        phoneNumber: newPhone.trim(),
        clientName: newName.trim(),
        templateName: newTemplate.trim(),
        languageCode: 'en',
        userId: currentUser?._id,
        role: currentUser?.role,
      });

      if (res.data.success) {
        setIsNewChatOpen(false);
        setNewPhone('');
        setNewName('');
        onSelectContact(res.data.contact);
      }
    } catch (err) {
      console.error('Start new chat error:', err);
      setNewChatError(err.response?.data?.message || 'Could not start the chat. Please try again.');
    } finally {
      setIsStartingChat(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    if (currentUser?._id) formData.append('userId', currentUser._id);
    if (currentUser?.role) formData.append('role', currentUser.role);

    try {
      setIsImporting(true);
      const res = await axios.post(`${BACKEND_URL}/api/chat/import-contacts`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data.success) {
        alert(res.data.message);
      }
    } catch (err) {
      console.error('Import failed:', err);
      alert(err.response?.data?.message || 'The file could not be imported. Please try again.');
    } finally {
      setIsImporting(false);
      e.target.value = '';
    }
  };

  const filteredContacts = contacts.filter((contact) => {
    const cleanSearch = searchTerm.toLowerCase();
    const nameMatch = contact.clientName?.toLowerCase().includes(cleanSearch);
    const phoneMatch = contact.phoneNumber?.includes(cleanSearch);
    const matchesSearch = !searchTerm || nameMatch || phoneMatch;

    if (!matchesSearch) return false;

    if (activeTab === 'All') return true;
    if (activeTab === 'Unread') return (contact.unreadCount || 0) > 0;
    if (activeTab === 'Excluded') return contact.tag === 'Excluded';
    return true;
  });
  return (
    <aside className="w-full h-full border-r border-slate-200 bg-white flex flex-col shrink-0 relative select-text font-sans">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        className="hidden"
        accept=".txt"
      />

      <div className="px-4 py-3 bg-white border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-slate-800 tracking-tight">Chats</h2>
          <span className="text-[11px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">
            {contacts.length}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              if (currentUser?.role !== 'admin' && !currentUser?.isWhatsAppConnected) {
                alert('Connect your WhatsApp number to start a new chat.');
                return;
              }
              setIsNewChatOpen(true);
              setNewChatError('');
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-xs"
            title="Start new chat"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>New</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (currentUser?.role !== 'admin' && !currentUser?.isWhatsAppConnected) {
                alert('Connect your WhatsApp account before starting a campaign.');
                return;
              }
              onOpenCampaign();
            }}
            className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer border border-slate-200 hover:border-emerald-200"
            title="Broadcast Campaign"
          >
            <Megaphone className="w-4 h-4" />
          </button>

          <button
            type="button"
            disabled={isImporting}
            onClick={() => {
              if (currentUser?.role !== 'admin' && !currentUser?.isWhatsAppConnected) {
                alert('Connect your WhatsApp account before importing leads.');
                return;
              }
              fileInputRef.current?.click();
            }}
            className="p-1.5 text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer border border-slate-200 hover:border-blue-200 disabled:opacity-50"
            title="Import Leads (.txt)"
          >
            {isImporting ? <Loader2 className="w-4 h-4 animate-spin text-emerald-600" /> : <FileSpreadsheet className="w-4 h-4" />}
          </button>

          {onOpenTemplates && (
            <button
              type="button"
              onClick={() => {
                if (currentUser?.role !== 'admin' && !currentUser?.isWhatsAppConnected) {
                  alert('Connect your WhatsApp account to view templates.');
                  return;
                }
                onOpenTemplates();
              }}
              className="p-1.5 text-slate-600 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-colors cursor-pointer border border-slate-200 hover:border-purple-200"
              title="WhatsApp Templates"
            >
              <FileCode className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="p-2.5 border-b border-slate-100">
        <div className="flex items-center bg-slate-50 border border-slate-200/90 rounded-xl px-3 py-1.5 focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition-all">
          <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchTerm}
            onChange={(e) => {
              const val = e.target.value;
              setSearchTerm(val);
              if (onSearch) onSearch(val);
            }}
            className="w-full bg-transparent text-xs text-slate-800 placeholder-slate-400 focus:outline-none"
          />
          {searchTerm && (
            <button
              onClick={() => {
                setSearchTerm('');
                if (onSearch) onSearch('');
              }}
              className="text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
      {currentUser?.role !== 'admin' && !currentUser?.isWhatsAppConnected && (
        <div className="m-3 p-3 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl text-white shadow-md space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold flex items-center gap-1.5">
              <span>⚡</span> Connect Your WhatsApp
            </span>
            <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-semibold">
              Step 1 of 1
            </span>
          </div>
          <p className="text-[11px] text-white/90 leading-relaxed">
            Verify and connect your business WhatsApp number with Meta to start messaging.
          </p>
          <button
            type="button"
            onClick={() => {
              window.location.href =
                'https://business.facebook.com/messaging/whatsapp/onboard/?app_id=2849467472091250&config_id=936742855945662';
            }}
            className="w-full py-2 bg-white hover:bg-emerald-50 text-emerald-700 font-bold text-xs rounded-lg shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>Connect WhatsApp with Meta</span>
          </button>
        </div>
      )}
      <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-2">
        {[
          { label: 'All', value: 'All' },
          { label: 'Unread', value: 'Unread' },
          { label: 'Excluded', value: 'Excluded' },
        ].map((tab) => (
         <button
            key={tab.value}
            type="button"
            onClick={() => setActiveTab(tab.value)}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              activeTab === tab.value
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

<div
  onScroll={(e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight + 40) {
      if (hasMoreContacts && !isLoadingMoreContacts && onLoadMoreContacts) {
        onLoadMoreContacts();
      }
    }
  }}
  className="flex-1 overflow-y-auto divide-y divide-slate-100"
>
  {isLoadingContacts ? (
    <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-400">
      <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
      <span className="text-xs font-medium text-slate-500">Loading conversations...</span>
    </div>
  ) : filteredContacts.length === 0 ? (
    <div className="text-center py-12 px-4">
      <Filter className="w-7 h-7 text-slate-300 mx-auto mb-2" />
      <p className="text-xs font-semibold text-slate-600">No contacts found</p>
      <p className="text-[11px] text-slate-400 mt-0.5">Try selecting another filter above</p>
    </div>
  ) : (
    filteredContacts.map((contact) => {
      const isSelected = selectedContact?.phoneNumber === contact.phoneNumber;
      const isExcluded = contact.tag === 'Excluded';
      const isTemplateMsg = contact.lastMessage && contact.lastMessage.startsWith('[Template:');

      const statusStyles = {
        'New Lead': 'bg-emerald-50 text-emerald-700 border-emerald-200',
        'Contacted': 'bg-blue-50 text-blue-700 border-blue-200',
        'In Discussion': 'bg-amber-50 text-amber-700 border-amber-200',
        'Won / Customer': 'bg-purple-50 text-purple-700 border-purple-200',
        'Lost / Inactive': 'bg-red-50 text-red-700 border-red-200',
      };

      return (
        <div
          key={contact._id || contact.phoneNumber}
          onClick={() => onSelectContact(contact)}
          className={`flex items-start gap-3 p-3.5 cursor-pointer transition-all group relative border-l-3 ${
            isSelected
              ? 'bg-emerald-50/80 border-emerald-600 shadow-2xs'
              : 'border-transparent hover:bg-slate-50'
          }`}
        >
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs mt-0.5">
            {contact.clientName ? contact.clientName.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
          </div>

          <div className="flex-1 min-w-0 pr-5">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-xs font-bold text-slate-800 truncate leading-tight">
                {contact.clientName || `+${contact.phoneNumber}`}
              </h3>
              {contact.updatedAt && (
                <span className="text-[10px] text-slate-400 font-medium shrink-0 ml-1">
                  {new Date(contact.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-[11px] mb-1.5">
              {isTemplateMsg ? (
                <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 border border-purple-200/80 px-2 py-0.5 rounded-md text-[10px] font-semibold">
                  <Megaphone className="w-3 h-3 text-purple-600" />
                  <span>Campaign Sent</span>
                </span>
              ) : (
                <p className="text-slate-500 truncate leading-relaxed">
                  {contact.lastMessage || `+${contact.phoneNumber}`}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between gap-1.5">
              <span
                className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                  statusStyles[contact.leadStatus] || 'bg-slate-100 text-slate-600 border-slate-200'
                }`}
              >
                {contact.leadStatus || 'New Lead'}
              </span>

              <div className="flex items-center gap-1.5 ml-auto">
                <label
                  onClick={(e) => e.stopPropagation()}
                  className={`inline-flex items-center gap-1 text-[10px] cursor-pointer select-none transition-opacity ${
                    isExcluded ? 'opacity-100 text-amber-700 font-bold' : 'opacity-0 group-hover:opacity-100 text-slate-400 hover:text-amber-600'
                  }`}
                  title="Exclude from campaigns"
                >
                  <input
                    type="checkbox"
                    checked={isExcluded}
                    onChange={(e) => {
                      onUpdateContactTag(contact._id, e.target.checked ? 'Excluded' : 'General');
                    }}
                    className="w-3 h-3 accent-amber-600 rounded cursor-pointer"
                  />
                  <span>{isExcluded ? 'VIP' : 'Exclude'}</span>
                </label>

                {contact.unreadCount > 0 && !isSelected && (
                  <span className="w-4 h-4 bg-emerald-600 text-white rounded-full text-[9px] font-bold flex items-center justify-center shrink-0 shadow-xs">
                    {contact.unreadCount > 99 ? '99+' : contact.unreadCount}
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onTogglePinContact(contact._id);
            }}
            className={`absolute right-2 top-2.5 p-1 rounded-md transition-all cursor-pointer ${
              contact.isPinned
                ? 'opacity-100 text-emerald-600'
                : 'opacity-0 group-hover:opacity-100 text-slate-400 hover:text-emerald-700 hover:bg-slate-200/60'
            }`}
            title={contact.isPinned ? 'Unpin chat' : 'Pin chat'}
          >
            <Pin className={`w-3.5 h-3.5 ${contact.isPinned ? 'fill-emerald-600 text-emerald-600' : ''}`} />
          </button>
        </div>
      );
    })
  )}

  {isLoadingMoreContacts && (
    <div className="py-2.5 text-center text-xs text-slate-500 flex items-center justify-center gap-1.5 bg-slate-50">
      <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
      <span>Loading older contacts...</span>
    </div>
  )}
</div>

      {isNewChatOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in">
            <div className="px-4 py-3 bg-emerald-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4" />
                <h3 className="text-sm font-semibold">Start New Chat</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsNewChatOpen(false)}
                className="text-white hover:bg-emerald-700 p-1 rounded-full cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleStartNewChat} className="p-4 space-y-3.5 text-xs text-slate-700">
              {newChatError && (
                <div className="p-2 bg-red-50 text-red-700 border border-red-200 rounded text-[11px]">
                  {newChatError}
                </div>
              )}

              <div className="relative">
                <label className="block font-semibold mb-1 text-slate-700">
                  Search for a contact or enter a new phone number:
                </label>
                <input
                  type="text"
                  placeholder="Enter a name or phone number..."
                  value={newPhone}
                  onChange={(e) => {
                    setNewPhone(e.target.value);
                    setShowContactSuggestions(true);
                  }}
                  onFocus={() => setShowContactSuggestions(true)}
                  required
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 font-mono shadow-xs"
                />

                {showContactSuggestions && newPhone.trim().length > 1 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto z-50 divide-y divide-slate-100">
                    {contacts
                      .filter((c) => {
                        const cleanP = (c.phoneNumber || '').replace(/\D/g, '');
                        const cleanInput = newPhone.replace(/\D/g, '').toLowerCase();
                        const nameMatch = (c.clientName || '').toLowerCase().includes(newPhone.toLowerCase());
                        const phoneMatch = cleanP.includes(cleanInput);
                        return nameMatch || phoneMatch;
                      })
                      .slice(0, 5)
                      .map((c) => (
                        <div
                          key={c._id || c.phoneNumber}
                          onClick={() => {
                            setNewPhone(c.phoneNumber);
                            setNewName(c.clientName || '');
                            setShowContactSuggestions(false);
                          }}
                          className="p-2 hover:bg-emerald-50 cursor-pointer flex items-center justify-between transition-colors"
                        >
                          <div>
                            <p className="font-bold text-slate-800 text-[11px]">{c.clientName || 'No Name'}</p>
                            <p className="text-[10px] text-slate-500 font-mono">+{c.phoneNumber}</p>
                          </div>
                          <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-semibold">
                            Saved
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700">Customer Name (Optional):</label>
                <input
                  type="text"
                  placeholder="e.g. Alex Dispatcher"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 shadow-xs"
                />
              </div>

              <div>
              
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-semibold text-slate-700">Select Template:</label>
                  {isLoadingTemplates && (
                    <span className="text-[10px] text-emerald-600 flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> Loading Meta templates...
                    </span>
                  )}
                </div>

                <select
                  value={newTemplate}
                  onChange={(e) => setNewTemplate(e.target.value)}
                  disabled={isLoadingTemplates}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 bg-white font-medium shadow-xs cursor-pointer disabled:bg-slate-50"
                >
                  {templateList.map((tpl) => (
                    <option key={tpl.name} value={tpl.name}>
                      📋 {tpl.name} {tpl.language ? `(${tpl.language})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewChatOpen(false)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isStartingChat || !newPhone.trim()}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
                >
                  {isStartingChat ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>{isStartingChat ? 'Sending...' : 'Start Chat'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;