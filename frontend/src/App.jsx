


import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import Login from './components/Login';
import { socket as localSocket } from './socket'; 
import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';
import MessageInput from './components/MessageInput';
import CampaignModal from './components/CampaignModal';
import Callback from './components/Callback';
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
import AdminModal from './components/AdminModal';
import TemplateModal from './components/TemplateModal';
import SuperAdminDashboard from './components/SuperAdminDashboard';
import { MessageSquare, Clock, Send, ShieldCheck, User, LogOut, ShieldAlert } from 'lucide-react';

const App = () => {
  const [isDetailsOpen, setIsDetailsOpen] = useState(true);
  const [contactsPage, setContactsPage] = useState(1);
  const [hasMoreContacts, setHasMoreContacts] = useState(true);
  const [isLoadingMoreContacts, setIsLoadingMoreContacts] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [messages, setMessages] = useState([]);
  
  const socketRef = useRef(null);
  const selectedContactRef = useRef(selectedContact);

  useEffect(() => {
    selectedContactRef.current = selectedContact;
  }, [selectedContact]);
  const [replyingMessage, setReplyingMessage] = useState(null);
  const [tags, setTags] = useState(['General', 'VIP Clients', 'Leads']);
  const [isCampaignOpen, setIsCampaignOpen] = useState(false);
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [chatPage, setChatPage] = useState(1);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isLoadingContacts, setIsLoadingContacts] = useState(true);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isTemplateOpen, setIsTemplateOpen] = useState(false);
  const [isAdminPortalOpen, setIsAdminPortalOpen] = useState(() => window.location.pathname === '/admin');

  const [kpiStats, setKpiStats] = useState({
    totalConversations: 0,
    unreadCount: 0,
    sentToday: 0,
    planLimit: 250,
    deliveryRate: '99.2%',
  });

  const handleBlockContact = async (contactId) => {
    try {
      const res = await axios.patch(`${BACKEND_URL}/api/chat/contacts/${contactId}/block`);
      if (res.data.success) {
        setSelectedContact((prev) => (prev ? { ...prev, isBlocked: res.data.isBlocked } : prev));
        setContacts((prev) => prev.map((c) => (c._id === contactId ? { ...c, isBlocked: res.data.isBlocked } : c)));
      }
    } catch (err) {
      console.error('Failed to block contact:', err);
      alert('The action failed. Please try again.');
    }
  };

  const handleDeleteContact = async (contactId) => {
    try {
      const res = await axios.delete(`${BACKEND_URL}/api/chat/contacts/${contactId}`);
      if (res.data.success) {
        setSelectedContact(null);
        setMessages([]);
        setContacts((prev) => prev.filter((c) => c._id !== contactId));
      }
    } catch (err) {
      console.error('Failed to delete contact:', err);
      alert('Deletion failed. Please try again.');
    }
  };
  const lastSoundTimeRef = useRef(0);

  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('user_info');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_info');
    setCurrentUser(null);
    setSelectedContact(null);
    setMessages([]);
  };

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const playNotificationSound = () => {
    const now = Date.now();
    if (now - lastSoundTimeRef.current > 3000) {
      lastSoundTimeRef.current = now;
      try {
        const audio = new Audio('https://mixkit.co');
        audio.volume = 0.5;
        audio.play().catch(() => { });
      } catch (e) { }
    }
  };

  const showDesktopNotification = useCallback((newMessage) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    if (document.visibilityState === 'visible' && selectedContactRef.current && newMessage.senderNumber === selectedContactRef.current.phoneNumber) return;

    playNotificationSound();
    let bodyText = newMessage.text || '';
    if (newMessage.messageType === 'image') bodyText = '📷 Photo';
    else if (newMessage.messageType === 'audio') bodyText = '🎤 Voice Note';
    else if (newMessage.messageType === 'document') bodyText = '📄 Document';
    else if (newMessage.messageType === 'video') bodyText = '🎥 Video';

    const notification = new Notification(`New message from +${newMessage.senderNumber}`, {
      body: bodyText || 'You received a new message',
      icon: 'https://wikimedia.org',
      tag: `whatsapp-msg-${newMessage.senderNumber}`,
      renotify: true,
    });
    notification.onclick = () => { window.focus(); notification.close(); };
  }, []);
  const fetchKpiStats = useCallback(async () => {
    if (!currentUser) return;
    try {
      const res = await axios.get(`${BACKEND_URL}/api/chat/kpi-stats?userId=${currentUser._id}&role=${currentUser.role}`);
      if (res.data.success) {
        setKpiStats(res.data.stats);
        if (res.data.stats.isWhatsAppConnected !== undefined) {
          setCurrentUser((prev) => prev && prev.isWhatsAppConnected !== res.data.stats.isWhatsAppConnected ? { ...prev, isWhatsAppConnected: res.data.stats.isWhatsAppConnected } : prev);
        }
      }
    } catch (err) { console.error('Failed to fetch KPI stats:', err); }
  }, [currentUser?._id]);

const fetchContacts = useCallback(async (page = 1, searchQuery = '', isSilent = false) => {
    if (!currentUser) return;

    try {
      if (page === 1) {
        if (!isSilent && contacts.length === 0) {
          setIsLoadingContacts(true);
        }
      } else {
        setIsLoadingMoreContacts(true);
      }

      const res = await axios.get(
        `${BACKEND_URL}/api/chat/contacts?page=${page}&limit=30&userId=${currentUser._id}&role=${currentUser.role}&search=${encodeURIComponent(searchQuery)}`
      );

      if (res.data.success) {
        if (page === 1) {
          setContacts(res.data.data || []);
        } else {
          setContacts((prev) => {
            const existingIds = new Set(prev.map((c) => c._id));
            const newContacts = (res.data.data || []).filter((c) => !existingIds.has(c._id));
            return [...prev, ...newContacts];
          });
        }
        setContactsPage(page);
        setHasMoreContacts(res.data.hasMore ?? false);
      }
    } catch (err) {
      if (err.response?.status === 403) handleLogout();
      console.error('Failed to fetch contacts:', err);
    } finally {
      setIsLoadingContacts(false);
      setIsLoadingMoreContacts(false);
    }
}, [currentUser?._id, handleLogout]);

  useEffect(() => {
    if (!currentUser?._id) return;

    const token = localStorage.getItem('auth_token');
    const socketInstance = io(BACKEND_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socketRef.current = socketInstance;

    socketInstance.on('connect', () => console.log('✅ LIVE SOCKET CONNECTED! ID:', socketInstance.id));

   socketInstance.on('new_message', (newMessage) => {
      // Enforce tenant isolation to prevent cross-tenant data access.
      const currentUserId = currentUser?._id ? String(currentUser._id) : null;
      const msgUserId = newMessage.userId ? String(newMessage.userId) : null;

      if (currentUser?.role === 'admin') {
        if (msgUserId !== null) return;
      } else {
        if (msgUserId !== currentUserId) return;
      }

      if (newMessage.direction === 'inbound') {
        showDesktopNotification(newMessage);
      }

      const clean = (p) => String(p || '').replace(/\D/g, '');
      const active = selectedContactRef.current;
      const isCurrentChat = active && (clean(newMessage.senderNumber) === clean(active.phoneNumber) || clean(newMessage.receiverNumber) === clean(active.phoneNumber));

      if (isCurrentChat) {
        setMessages((prev) => {
          const already = prev.some((m) => m._id === newMessage._id || (m.whatsappMessageId && m.whatsappMessageId === newMessage.whatsappMessageId));
          if (already) return prev;
          return [...prev, newMessage];
        });

        const cleanActivePhone = clean(active.phoneNumber);
        axios.patch(`${BACKEND_URL}/api/chat/contacts/${cleanActivePhone}/read`).catch(() => {});
      }

      setContacts((prev) => {
        const sender = clean(newMessage.senderNumber);
        const exists = prev.some((c) => clean(c.phoneNumber) === sender);

        if (!exists) {
          const newContact = {
            _id: newMessage._id || `temp-${Date.now()}`,
            phoneNumber: newMessage.senderNumber,
            clientName: `+${newMessage.senderNumber}`,
            lastMessage: newMessage.text || '[Media]',
            unreadCount: isCurrentChat ? 0 : 1,
            leadStatus: 'New Lead',
            tag: 'General',
            updatedAt: new Date().toISOString(),
          };
          return [newContact, ...prev];
        }

        const updated = prev.map((c) => {
          if (clean(c.phoneNumber) === sender) {
            return {
              ...c,
              lastMessage: newMessage.text || '[Media]',
              unreadCount: isCurrentChat ? 0 : (c.unreadCount || 0) + 1,
              updatedAt: new Date().toISOString(),
            };
          }
          return c;
        });
        return [...updated].sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
      });

      fetchContacts(1, '', true);
      fetchKpiStats();
    });

    socketInstance.on('message_status_updated', ({ messageId, status }) => {
      setMessages((prev) => prev.map((msg) => (msg.whatsappMessageId === messageId ? { ...msg, status } : msg)));
    });

    socketInstance.on('contact_updated', (updatedContact) => {
      if (updatedContact && updatedContact._id) {
        setContacts((prev) => prev.map((c) => (c._id === updatedContact._id ? { ...c, ...updatedContact } : c)));
      }
    });

    socketInstance.on('user_blocked', ({ userId }) => {
      if (currentUser?._id === userId) {
        alert('Your account has been blocked by an administrator.');
        handleLogout();
      }
    });

    return () => {
      socketInstance.disconnect();
      socketRef.current = null;
    };
  }, [currentUser?._id, fetchContacts, fetchKpiStats, showDesktopNotification]);

useEffect(() => {
    if (currentUser?._id) {
      fetchKpiStats();
      fetchContacts(1, '', false);
    }
  }, [currentUser?._id]);
  const handleUpdateContactName = async (contactId, clientName) => {
    try {
      const res = await axios.patch(`${BACKEND_URL}/api/chat/contacts/${contactId}/name`, { clientName });
      if (res.data.success) {
        setSelectedContact((prev) => (prev ? { ...prev, clientName } : prev));
        setContacts((prev) => prev.map((c) => (c._id === contactId ? { ...c, clientName } : c)));
      }
    } catch (err) { console.error('Failed to update name:', err); }
  };

  const handleLoadMoreMessages = async () => {
    if (!hasMoreMessages || isLoadingMore || !selectedContact) return;
    try {
      setIsLoadingMore(true);
      const nextPage = chatPage + 1;
      const res = await axios.get(`${BACKEND_URL}/api/chat/messages/${selectedContact.phoneNumber}?page=${nextPage}&limit=25&userId=${currentUser._id}&role=${currentUser.role}`);
      if (res.data.success) {
        setMessages((prev) => [...res.data.data, ...prev]);
        setChatPage(nextPage);
        setHasMoreMessages(res.data.hasMore);
      }
    } catch (err) { console.error('Failed to load older messages:', err); }
    finally { setIsLoadingMore(false); }
  };

  const handleLoadMoreContacts = async () => {
    if (!hasMoreContacts || isLoadingMoreContacts) return;
    await fetchContacts(contactsPage + 1);
  };

  const handleSelectContact = async (contact) => {
    setSelectedContact(contact);
    setReplyingMessage(null);
    setChatPage(1);

  if (contact.unreadCount > 0) {
      axios.patch(`${BACKEND_URL}/api/chat/contacts/${contact.phoneNumber}/read`, {
        userId: currentUser?._id,
        role: currentUser?.role,
      });
      setContacts((prev) =>
        prev.map((c) => (c._id === contact._id ? { ...c, unreadCount: 0 } : c))
      );

      setKpiStats((prev) => ({
        ...prev,
        unreadCount: Math.max(0, (prev.unreadCount || 0) - (contact.unreadCount || 1)),
      }));
    }

    try {
      setIsLoadingChat(true);
      const res = await axios.get(`${BACKEND_URL}/api/chat/messages/${contact.phoneNumber}?page=1&limit=25&userId=${currentUser._id}&role=${currentUser.role}`);
      if (res.data.success) {
        setMessages(res.data.data);
        setHasMoreMessages(res.data.hasMore);
      }
    } catch (err) { console.error('Failed to load chat:', err); } 
    finally { setIsLoadingChat(false); }
  };

  const handleTogglePin = async (messageId) => {
    try { await axios.patch(`${BACKEND_URL}/api/chat/messages/${messageId}/pin`); } 
    catch (err) { console.error('Failed to toggle pin:', err.message); }
  };

  const handleTogglePinContact = async (contactId) => {
    setContacts((prev) => {
      const updated = prev.map((c) => c._id === contactId ? { ...c, isPinned: !c.isPinned } : c);
      return [...updated].sort((a, b) => a.isPinned === b.isPinned ? 0 : a.isPinned ? -1 : 1);
    });
    try { await axios.patch(`${BACKEND_URL}/api/chat/contacts/${contactId}/pin`); } 
    catch (err) { console.error('Failed to pin contact:', err); fetchContacts(); }
  };

  const handleUpdateContactTag = async (contactId, newTag) => {
    try { await axios.patch(`${BACKEND_URL}/api/chat/contacts/${contactId}/tag`, { tag: newTag }); fetchContacts(); } 
    catch (err) { console.error('Failed to update tag:', err); }
  };

  const handleRenameTag = async (oldTag, newTag) => {
    try {
      await axios.patch(`${BACKEND_URL}/api/chat/tags/rename`, { oldTag, newTag });
      setTags((prev) => prev.map((t) => (t === oldTag ? newTag : t)));
      fetchContacts();
    } catch (err) { console.error('Failed to rename tag:', err); }
  };

  const handleSendMessage = async ({ text, file, replyToMessageId, replyToWamid }) => {
    if (!selectedContact) return;
    try {
      if (file) {
        const formData = new FormData();
        formData.append('recipientPhone', selectedContact.phoneNumber);
        formData.append('file', file);
        formData.append('userId', currentUser._id);
        formData.append('role', currentUser.role);
        if (text) formData.append('caption', text);
        if (replyToMessageId) formData.append('replyToMessageId', replyToMessageId);
        if (replyToWamid) formData.append('replyToWamid', replyToWamid);

        await axios.post(`${BACKEND_URL}/api/chat/send-media`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      } else {
        await axios.post(`${BACKEND_URL}/api/chat/send`, { recipientPhone: selectedContact.phoneNumber, text, replyToMessageId, replyToWamid, userId: currentUser._id, role: currentUser.role });
      }
    } catch (err) { alert('Message could not be sent. Please try again.'); }
  };

  const handleStartCampaign = async (campaignData) => {
    const res = await axios.post(`${BACKEND_URL}/api/chat/campaign`, { ...campaignData, userId: currentUser?._id, role: currentUser?.role });
    fetchContacts();
    return res.data;
  };

  if (window.location.pathname === '/callback') return <Callback />;
  if (!currentUser) return <Login onLoginSuccess={(user) => setCurrentUser(user)} />;

  if (currentUser?.role === 'admin' && isAdminPortalOpen) {
    return <SuperAdminDashboard currentUser={currentUser} onBackToCRM={() => { window.history.pushState({}, '', '/'); setIsAdminPortalOpen(false); }} onLogout={handleLogout} />;
  }
  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-100 select-text font-sans">
      <header className="h-16 bg-white border-b border-slate-200 px-5 flex items-center justify-between shrink-0 shadow-xs z-20">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-black text-lg shadow-sm shadow-emerald-600/30">IT</div>
          <div>
            <h1 className="text-sm font-bold text-slate-800 leading-tight">ITGeniusX Logistics</h1>
            <p className="text-[10px] text-slate-400 font-medium">WhatsApp Dispatch Suite</p>
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-3">
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl px-3.5 py-1.5 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-slate-200/70 text-slate-700 flex items-center justify-center"><MessageSquare className="w-3.5 h-3.5" /></div>
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total Chats</p>
              <p className="text-xs font-bold text-slate-800">{kpiStats.totalConversations}</p>
            </div>
          </div>
          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl px-3.5 py-1.5 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center"><Clock className="w-3.5 h-3.5" /></div>
            <div>
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <p className="text-[10px] font-semibold text-emerald-800 uppercase tracking-wider">Unread</p>
              </div>
              <p className="text-xs font-bold text-emerald-900">{kpiStats.unreadCount}</p>
            </div>
          </div>
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl px-3.5 py-1.5 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center"><Send className="w-3.5 h-3.5" /></div>
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Today's Sent</p>
              <p className="text-xs font-bold text-slate-800">{kpiStats.sentToday} <span className="text-[10px] text-slate-400 font-normal">/ {kpiStats.planLimit}</span></p>
            </div>
          </div>
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl px-3.5 py-1.5 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center"><ShieldCheck className="w-3.5 h-3.5" /></div>
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Delivery Rate</p>
              <p className="text-xs font-bold text-teal-800">{kpiStats.deliveryRate}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {currentUser?.role === 'admin' && (
            <button onClick={() => { window.history.pushState({}, '', '/admin'); setIsAdminPortalOpen(true); }} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs">
              <ShieldAlert className="w-3.5 h-3.5 text-emerald-400" />
              <span>Admin Portal</span>
            </button>
          )}
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
            <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs">{currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : <User className="w-4 h-4" />}</div>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-semibold text-slate-800 leading-tight truncate max-w-[120px]">{currentUser?.name || 'Dispatcher'}</p>
              <p className="text-[10px] text-emerald-600 font-medium">{currentUser?.role === 'admin' ? 'Super Admin' : `${currentUser?.planLimit || 250}/day Tier`}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer ml-1" title="Log out"><LogOut className="w-4 h-4" /></button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        <div className={`h-full w-full md:w-80 shrink-0 ${selectedContact ? 'hidden md:block' : 'block'}`}>
          <Sidebar contacts={contacts} selectedContact={selectedContact} onSelectContact={handleSelectContact} onTogglePinContact={handleTogglePinContact} onUpdateContactTag={handleUpdateContactTag} onRenameTag={handleRenameTag} onOpenCampaign={() => setIsCampaignOpen(true)} onLogout={handleLogout} tags={tags} isLoadingContacts={isLoadingContacts} onLoadMoreContacts={handleLoadMoreContacts} hasMoreContacts={hasMoreContacts} isLoadingMoreContacts={isLoadingMoreContacts} currentUser={currentUser} onOpenAdmin={() => { window.history.pushState({}, '', '/admin'); setIsAdminPortalOpen(true); }} onOpenTemplates={() => setIsTemplateOpen(true)} onSearch={(term) => fetchContacts(1, term)} />
        </div>

        <main className={`flex-1 flex flex-col h-full min-w-0 ${!selectedContact ? 'hidden md:flex' : 'flex'}`}>
          <ChatWindow selectedContact={selectedContact} messages={messages} isLoadingChat={isLoadingChat} hasMoreMessages={hasMoreMessages} isLoadingMore={isLoadingMore} onLoadMore={handleLoadMoreMessages} onReply={(msg) => setReplyingMessage(msg)} onTogglePin={handleTogglePin} onUpdateContactName={handleUpdateContactName} onBack={() => setSelectedContact(null)} onBlockContact={handleBlockContact} onDeleteContact={handleDeleteContact} onToggleDetails={() => setIsDetailsOpen((prev) => !prev)} isDetailsOpen={isDetailsOpen} />
          <MessageInput onSendMessage={handleSendMessage} disabled={!selectedContact} replyingMessage={replyingMessage} onCancelReply={() => setReplyingMessage(null)} />
        </main>

      </div>

      <CampaignModal isOpen={isCampaignOpen} onClose={() => setIsCampaignOpen(false)} tags={tags} onStartCampaign={handleStartCampaign} />
      <AdminModal isOpen={isAdminOpen} onClose={() => setIsAdminOpen(false)} />
      <TemplateModal isOpen={isTemplateOpen} onClose={() => setIsTemplateOpen(false)} currentUser={currentUser} />
    </div>
  );
};

export default App;
