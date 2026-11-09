import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, X, Loader2, FileText, Reply, Mic, Trash2 } from 'lucide-react';

const MessageInput = ({ onSendMessage, disabled, replyingMessage, onCancelReply }) => {
  const [text, setText] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [isSending, setIsSending] = useState(false);

  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isRecording) {
      setRecordDuration(0);
      timerRef.current = setInterval(() => {
        setRecordDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      let options = {};
      if (MediaRecorder.isTypeSupported('audio/mp4')) {
        options = { mimeType: 'audio/mp4' };
      } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
        options = { mimeType: 'audio/ogg;codecs=opus' };
      } else if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        options = { mimeType: 'audio/webm;codecs=opus' };
      }

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(250);
      setIsRecording(true);
    } catch (err) {
      console.error('Mic access error:', err);
      alert('Allow microphone access to record a voice note.');
    }
  };

  const handleCancelRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stream?.getTracks().forEach((track) => track.stop());
      if (mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    }
    setIsRecording(false);
    audioChunksRef.current = [];
  };

  const handleSendVoiceNote = () => {
    if (!mediaRecorderRef.current || !isRecording) return;

    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
    setIsSending(true);

    const recorder = mediaRecorderRef.current;

   recorder.onstop = async () => {
      // Use the codec required for WhatsApp voice notes.
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/ogg; codecs=opus' });
      const audioFile = new File([audioBlob], `voice_${Date.now()}.ogg`, {
        type: 'audio/ogg; codecs=opus',
      });

      try {
        await onSendMessage({
          text: '',
          file: audioFile,
          replyToMessageId: replyingMessage?._id,
          replyToWamid: replyingMessage?.whatsappMessageId,
        });
        if (onCancelReply) onCancelReply();
      } catch (err) {
        console.error('Failed to send voice note:', err);
      } finally {
        setIsSending(false);
        audioChunksRef.current = [];
      }
    };

    recorder.stream?.getTracks().forEach((track) => track.stop());
    if (recorder.state !== 'inactive') {
      recorder.stop();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setSelectedFile(file);

    if (file.type.startsWith('image/')) {
      setFilePreview(URL.createObjectURL(file));
    } else {
      setFilePreview(null);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (filePreview) {
      URL.revokeObjectURL(filePreview);
      setFilePreview(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if ((!text.trim() && !selectedFile) || disabled || isSending) return;

    try {
      setIsSending(true);
      await onSendMessage({
        text,
        file: selectedFile,
        replyToMessageId: replyingMessage?._id,
        replyToWamid: replyingMessage?.whatsappMessageId,
      });

      setText('');
      handleRemoveFile();
      if (onCancelReply) onCancelReply();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="bg-gray-100 border-t border-gray-200 shrink-0">
      {replyingMessage && (
        <div className="px-4 py-2 bg-emerald-50 border-b border-emerald-200 flex items-center justify-between">
          <div className="flex items-center gap-2 overflow-hidden border-l-4 border-emerald-600 pl-2">
            <Reply className="w-4 h-4 text-emerald-600 shrink-0" />
            <div className="truncate">
              <p className="text-xs font-semibold text-emerald-800">
                Replying to {replyingMessage.direction === 'inbound' ? 'Client' : 'You'}
              </p>
              <p className="text-xs text-gray-600 truncate">
                {replyingMessage.text || replyingMessage.caption || 'Media file'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className="p-1 text-gray-400 hover:text-red-500 rounded-full hover:bg-gray-200 cursor-pointer"
            title="Cancel reply"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {selectedFile && (
        <div className="px-4 py-2 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between">
          <div className="flex items-center gap-2 overflow-hidden">
            {filePreview ? (
              <img
                src={filePreview}
                alt="Preview"
                className="w-10 h-10 object-cover rounded border border-gray-200"
              />
            ) : (
              <div className="w-10 h-10 bg-emerald-100 text-emerald-700 rounded flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
            )}
            <div className="truncate">
              <p className="text-xs font-medium text-gray-800 truncate">{selectedFile.name}</p>
              <p className="text-[10px] text-gray-500">
                {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRemoveFile}
            className="p-1 text-gray-400 hover:text-red-500 rounded-full hover:bg-gray-100 cursor-pointer"
            title="Remove file"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {isSending && (
        <div className="px-4 py-2 bg-emerald-50 border-b border-emerald-200 flex items-center gap-2 text-xs font-medium text-emerald-800 animate-pulse">
          <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
          <span>Sending media to WhatsApp... Please wait.</span>
        </div>
      )}

      {isRecording ? (
        <div className="p-3 flex items-center justify-between bg-emerald-50">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-red-500 animate-ping" />
            <span className="text-sm font-semibold text-gray-800 font-mono">
              {formatDuration(recordDuration)}
            </span>
            <span className="text-xs text-gray-500">Recording voice note...</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCancelRecording}
              className="p-2 text-gray-500 hover:text-red-600 rounded-full hover:bg-red-100 transition-colors cursor-pointer"
              title="Delete recording"
            >
              <Trash2 className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={handleSendVoiceNote}
              className="w-10 h-10 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-md cursor-pointer transition-colors"
              title="Send voice note"
            >
              <Send className="w-4 h-4 ml-0.5" />
            </button>
          </div>
        </div>
      ) : (
 <form onSubmit={handleSubmit} className="p-3 flex items-end gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept="image/*,application/pdf,video/*,audio/*"
          />

          <button
            type="button"
            disabled={disabled || isSending}
            onClick={() => fileInputRef.current?.click()}
            className="p-2.5 text-gray-500 hover:text-emerald-600 hover:bg-gray-200 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer mb-0.5"
            title="Attach file"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          <textarea
            rows={1}
            placeholder={
              disabled
                ? 'Select a chat first...'
                : selectedFile
                ? 'Add a caption to your file...'
                : replyingMessage
                ? 'Type your reply...'
                : 'Type a message... (Shift + Enter for new line)'
            }
            value={text}
            disabled={disabled || isSending}
            onChange={(e) => {
              setText(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
            }}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-white border border-gray-300 rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 disabled:bg-gray-50 text-gray-800 resize-none max-h-32 overflow-y-auto leading-relaxed"
          />

          {text.trim() || selectedFile ? (
            <button
              type="submit"
              disabled={disabled || isSending}
              className="w-10 h-10 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0 cursor-pointer"
            >
              {isSending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4 ml-0.5" />
              )}
            </button>
          ) : (
            <button
              type="button"
              disabled={disabled || isSending}
              onClick={handleStartRecording}
              className="w-10 h-10 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0 cursor-pointer"
              title="Record voice note"
            >
              <Mic className="w-5 h-5" />
            </button>
          )}
        </form>
      )}
    </div>
  );
};

export default MessageInput;