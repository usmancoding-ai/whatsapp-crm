import React, { useEffect, useRef, useState } from 'react';
import { 
  ArrowLeft, User, Check, CheckCheck, FileText, Download, Reply, Pin, 
  ChevronLeft, ChevronRight, Loader2, Edit2, X, Ban, Trash2, AlertCircle 
} from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

const ChatWindow = ({
  selectedContact,
  messages,
  isLoadingChat,
  hasMoreMessages,
  isLoadingMore,
  onLoadMore,
  onReply,
  onTogglePin,
  onUpdateContactName,
  onBack,
  onBlockContact,
  onDeleteContact,
}) => {
  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const messageRefs = useRef({});
  const [currentPinIndex, setCurrentPinIndex] = useState(0);
  const prevScrollHeightRef = useRef(0);

  const [isEditingName, setIsEditingName] = useState(false);
  const [customName, setCustomName] = useState('');


  useEffect(() => {
    setIsEditingName(false);
    setCustomName(selectedContact?.clientName || '');
  }, [selectedContact]);

  const handleSaveName = (e) => {
    e.preventDefault();
    if (customName.trim() && customName !== selectedContact?.clientName) {
      if (onUpdateContactName) {
        onUpdateContactName(selectedContact._id, customName.trim());
      }
    }
    setIsEditingName(false);
  };

  const isInitialLoadRef = useRef(true);

 
  useEffect(() => {
    isInitialLoadRef.current = true;
  }, [selectedContact]);


  useEffect(() => {
    if (messages.length > 0 && isInitialLoadRef.current && !isLoadingChat) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      isInitialLoadRef.current = false;
    }
  }, [messages, isLoadingChat]);


  useEffect(() => {
    if (scrollContainerRef.current && isLoadingMore) {
      const newScrollHeight = scrollContainerRef.current.scrollHeight;
      const heightDiff = newScrollHeight - prevScrollHeightRef.current;
      scrollContainerRef.current.scrollTop = heightDiff;
    }
  }, [messages, isLoadingMore]);

  const pinnedMessages = messages.filter((m) => m.isPinned);

  useEffect(() => {
    if (currentPinIndex >= pinnedMessages.length) {
      setCurrentPinIndex(Math.max(0, pinnedMessages.length - 1));
    }
  }, [pinnedMessages.length, currentPinIndex]);

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight } = e.currentTarget;
    if (scrollTop === 0 && hasMoreMessages && !isLoadingMore && !isLoadingChat) {
      prevScrollHeightRef.current = scrollHeight;
      if (onLoadMore) onLoadMore();
    }
  };

  if (!selectedContact) {
    return (
      <div className="flex-1 h-full flex flex-col items-center justify-center bg-gray-50 text-gray-400 select-none">
        <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center mb-3">
          <User className="w-8 h-8 text-gray-400" />
        </div>
        <p className="text-base font-medium">Select a chat to start messaging</p>
      </div>
    );
  }

  const scrollToMessage = (msgId) => {
    if (messageRefs.current[msgId]) {
      messageRefs.current[msgId].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handlePrevPin = (e) => {
    e.stopPropagation();
    const newIndex = currentPinIndex === 0 ? pinnedMessages.length - 1 : currentPinIndex - 1;
    setCurrentPinIndex(newIndex);
    scrollToMessage(pinnedMessages[newIndex]._id);
  };

  const handleNextPin = (e) => {
    e.stopPropagation();
    const newIndex = (currentPinIndex + 1) % pinnedMessages.length;
    setCurrentPinIndex(newIndex);
    scrollToMessage(pinnedMessages[newIndex]._id);
  };

  const renderStatus = (status, errorMessage) => {
    switch (status) {
      case 'failed':
        return (
          <span 
            title={errorMessage || 'Message delivery failed by Meta'} 
            className="inline-flex items-center gap-0.5 text-red-500 font-semibold cursor-pointer ml-1 select-none"
          >
            <AlertCircle className="w-3.5 h-3.5 text-red-500 inline" />
            <span className="text-[10px] text-red-500 font-normal">Failed</span>
          </span>
        );
      case 'sent':
        return <Check className="w-3.5 h-3.5 text-gray-400 inline ml-1" />;
      case 'delivered':
        return <CheckCheck className="w-3.5 h-3.5 text-gray-400 inline ml-1" />;
      case 'read':
        return <CheckCheck className="w-3.5 h-3.5 text-blue-500 inline ml-1" />;
      default:
        return null;
    }
  };

 const renderMessageContent = (msg) => {
    const fullMediaUrl = msg.mediaUrl
      ? msg.mediaUrl.startsWith('http')
        ? msg.mediaUrl
        : `${BACKEND_URL}${msg.mediaUrl}`
      : '';

    if (msg.messageType === 'template' || (msg.text && msg.text.startsWith('[Template:'))) {
      const displayText =
        msg.text && !msg.text.startsWith('[Template:')
          ? msg.text
          : msg.caption || msg.text;

      return (
        <div className="space-y-2 max-w-sm select-text">
          {fullMediaUrl && (
            <img
              src={fullMediaUrl}
              alt="Template Header"
              className="rounded-md w-full max-h-52 object-cover cursor-pointer hover:opacity-95 shadow-xs"
              onClick={() => window.open(fullMediaUrl, '_blank')}
            />
          )}

          <p className="break-words leading-relaxed whitespace-pre-wrap text-sm text-gray-800">
            {displayText}
          </p>

          {msg.buttonUrl ? (
            <div className="pt-1.5 border-t border-black/10">
              <a
                href={msg.buttonUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full py-1.5 px-3 bg-white hover:bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-md flex items-center justify-center gap-1.5 border border-emerald-200 transition-colors shadow-xs"
              >
                <span>🌐 {msg.buttonText || 'Visit Website'}</span>
              </a>
            </div>
          ) : null}
        </div>
      );
    }

    switch (msg.messageType) {
      case 'image':
        return (
          <div className="space-y-1">
            <img
              src={fullMediaUrl}
              alt="WhatsApp Media"
              className="rounded-md max-h-60 w-auto object-cover cursor-pointer hover:opacity-95"
              onClick={() => window.open(fullMediaUrl, '_blank')}
            />
            {msg.caption && <p className="text-sm pt-1">{msg.caption}</p>}
          </div>
        );

      case 'audio':
        return (
          <div className="py-1">
            <audio controls className="w-64 max-w-full h-10">
              <source src={fullMediaUrl} />
            </audio>
          </div>
        );

      case 'video':
        return (
          <div className="space-y-1">
            <video controls className="rounded-md max-h-60 w-auto">
              <source src={fullMediaUrl} />
            </video>
            {msg.caption && <p className="text-sm pt-1">{msg.caption}</p>}
          </div>
        );

      case 'document':
        return (
          <div className="space-y-1">
            <div className="flex items-center gap-3 bg-black/5 p-2 rounded-md">
              <FileText className="w-8 h-8 text-emerald-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{msg.fileName || 'Document'}</p>
                <a
                  href={fullMediaUrl}
                  target="_blank"
                  rel="noreferrer"
                  download
                  className="text-[11px] text-emerald-600 hover:underline inline-flex items-center gap-1 mt-0.5"
                >
                  <Download className="w-3 h-3" /> Download
                </a>
              </div>
            </div>
            {msg.caption && <p className="text-sm pt-1">{msg.caption}</p>}
          </div>
        );

      default:
        return <p className="break-words leading-relaxed whitespace-pre-wrap">{msg.text}</p>;
    }
  };

  const activePinnedMsg = pinnedMessages[currentPinIndex];

  return (
    <div className="flex-1 h-full flex flex-col bg-[#efeae2] relative overflow-hidden">
      <div className="h-16 px-4 bg-gray-100 border-b border-gray-200 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="md:hidden p-1.5 -ml-1 text-gray-600 hover:bg-gray-200 rounded-full cursor-pointer"
            title="Back to chats"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
            {selectedContact.clientName ? selectedContact.clientName.charAt(0).toUpperCase() : <User className="w-5 h-5" />}
          </div>
          <div>
            {isEditingName ? (
              <form onSubmit={handleSaveName} className="flex items-center gap-1">
                <input
                  type="text"
                  autoFocus
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="px-2 py-0.5 text-sm bg-white border border-emerald-500 rounded focus:outline-none text-gray-800"
                />
                <button
                  type="submit"
                  className="p-1 text-emerald-600 hover:bg-emerald-100 rounded cursor-pointer"
                  title="Save name"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingName(false)}
                  className="p-1 text-gray-400 hover:bg-gray-200 rounded cursor-pointer"
                  title="Cancel"
                >
                  <X className="w-4 h-4" />
                </button>
              </form>
            ) : (
              <div className="flex items-center gap-1.5 group">
                <h2 className="text-sm font-semibold text-gray-800">
                  {selectedContact.clientName || 'Unknown Client'}
                </h2>
                <button
                  type="button"
                  onClick={() => setIsEditingName(true)}
                  className="opacity-100 group-hover:opacity-100 p-1 text-gray-400 hover:text-emerald-600 rounded cursor-pointer transition-opacity"
                  title="Edit contact name"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
              </div>
            )}
            <p className="text-xs text-gray-500">+{selectedContact.phoneNumber}</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onBlockContact(selectedContact._id)}
            className={`p-2 rounded-full transition-colors cursor-pointer ${
              selectedContact.isBlocked
                ? 'text-red-600 bg-red-100 hover:bg-red-200'
                : 'text-gray-500 hover:text-red-600 hover:bg-gray-200'
            }`}
            title={selectedContact.isBlocked ? 'Unblock customer' : 'Block customer'}
          >
            <Ban className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              if (window.confirm('Are you sure you want to delete this chat and all of its messages?')) {
                onDeleteContact(selectedContact._id);
              }
            }}
            className="p-2 text-gray-500 hover:text-red-600 hover:bg-gray-200 rounded-full transition-colors cursor-pointer"
            title="Delete chat"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {selectedContact.isBlocked && (
        <div className="bg-red-500 text-white text-xs py-1.5 px-4 text-center font-medium shadow-xs select-none">
      This customer is blocked. Their new messages will be ignored.
        </div>
      )}

      {pinnedMessages.length > 0 && activePinnedMsg && (
        <div
          onClick={() => scrollToMessage(activePinnedMsg._id)}
          className="bg-white/95 px-4 py-2 border-b border-gray-200 flex items-center justify-between text-xs text-gray-700 shadow-sm shrink-0 cursor-pointer hover:bg-gray-50 transition-colors select-none z-10"
        >
          <div className="flex items-center gap-2 overflow-hidden truncate flex-1 min-w-0 mr-3">
            <Pin className="w-3.5 h-3.5 text-emerald-600 shrink-0 fill-emerald-600" />
            <span className="font-semibold text-gray-900 shrink-0">Pinned:</span>
            <span className="truncate text-gray-600 hover:underline">
              {activePinnedMsg.text || activePinnedMsg.caption || (activePinnedMsg.messageType === 'image' ? '📷 Photo' : 'Media')}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[11px] text-gray-400 font-medium px-1">
              {currentPinIndex + 1} of {pinnedMessages.length}
            </span>

            {pinnedMessages.length > 1 && (
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={handlePrevPin}
                  className="p-1 hover:bg-gray-200 rounded text-gray-500 cursor-pointer"
                  title="Previous pinned message"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleNextPin}
                  className="p-1 hover:bg-gray-200 rounded text-gray-500 cursor-pointer"
                  title="Next pinned message"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {isLoadingChat ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 bg-[#efeae2]">
          <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
          <p className="text-xs text-gray-500 font-medium">Loading messages...</p>
        </div>
      ) : (
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-4 space-y-2 relative"
        >
          {isLoadingMore && (
            <div className="flex justify-center py-2">
              <Loader2 className="w-5 h-5 text-emerald-600 animate-spin" />
            </div>
          )}

          {messages.map((msg) => {
            const isMe = msg.direction === 'outbound';
            const isFailed = msg.status === 'failed';
            const time = new Date(msg.createdAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={msg._id || msg.whatsappMessageId}
                ref={(el) => (messageRefs.current[msg._id] = el)}
                className={`flex items-center gap-1 group ${isMe ? 'justify-end' : 'justify-start'}`}
              >
                {!isMe && (
                  <div className="opacity-100 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                    <button
                      onClick={() => onReply(msg)}
                      className="p-1 hover:bg-black/10 rounded text-gray-600 cursor-pointer"
                      title="Reply"
                    >
                      <Reply className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onTogglePin(msg._id)}
                      className={`p-1 hover:bg-black/10 rounded cursor-pointer ${
                        msg.isPinned ? 'text-emerald-600' : 'text-gray-600'
                      }`}
                      title={msg.isPinned ? 'Unpin' : 'Pin'}
                    >
                      <Pin className={`w-3.5 h-3.5 ${msg.isPinned ? 'fill-emerald-600' : ''}`} />
                    </button>
                  </div>
                )}

                <div
                  className={`max-w-[70%] rounded-lg px-3 py-1.5 text-sm shadow-sm relative ${
                    isMe
                      ? isFailed
                        ? 'bg-red-50 border border-red-200 text-gray-800 rounded-tr-none'
                        : 'bg-[#d9fdd3] text-gray-800 rounded-tr-none'
                      : 'bg-white text-gray-800 rounded-tl-none'
                  }`}
                >
                  {msg.isPinned && (
                    <Pin className="w-3 h-3 text-emerald-600 fill-emerald-600 absolute -top-1.5 -right-1.5 bg-white rounded-full p-0.5 shadow-sm" />
                  )}

                  {msg.replyToMessage && (
                    <div
                      onClick={() => scrollToMessage(msg.replyToMessage._id)}
                      className="mb-1.5 p-1.5 rounded bg-black/5 border-l-4 border-emerald-600 text-xs cursor-pointer hover:bg-black/10 transition-colors"
                    >
                      <p className="font-semibold text-emerald-700 text-[11px]">
                        {msg.replyToMessage.senderNumber === selectedContact.phoneNumber
                          ? selectedContact.clientName || 'Client'
                          : 'You'}
                      </p>
                      <p className="truncate text-gray-600">
                        {msg.replyToMessage.text || msg.replyToMessage.caption || 'Media'}
                      </p>
                    </div>
                  )}

                  {renderMessageContent(msg)}

                  {isFailed && msg.errorMessage && (
                    <div className="mt-1 pt-1 border-t border-red-200 text-[11px] text-red-600 flex items-center gap-1 select-none font-medium">
                      <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                      <span>{msg.errorMessage}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-gray-500 select-none">
                    <span>{time}</span>
                    {isMe && renderStatus(msg.status, msg.errorMessage)}
                  </div>
                </div>

                {isMe && (
                  <div className="opacity-100 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                    <button
                      onClick={() => onReply(msg)}
                      className="p-1 hover:bg-black/10 rounded text-gray-600 cursor-pointer"
                      title="Reply"
                    >
                      <Reply className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onTogglePin(msg._id)}
                      className={`p-1 hover:bg-black/10 rounded cursor-pointer ${
                        msg.isPinned ? 'text-emerald-600' : 'text-gray-600'
                      }`}
                      title={msg.isPinned ? 'Unpin' : 'Pin'}
                    >
                      <Pin className={`w-3.5 h-3.5 ${msg.isPinned ? 'fill-emerald-600' : ''}`} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      )}
    </div>
  );
};

export default ChatWindow;