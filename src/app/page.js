'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { connectSocket, sendPayload, onPayload, disconnectSocket, getSocket } from '@/lib/socket';
import { deriveKey, encryptMessage, decryptMessage } from '@/lib/crypto';
import { generateUsername, getUserColor, getInitials } from '@/lib/names';

// ═══ Emoji data (local — no external API calls) ═══
const EMOJI_CATEGORIES = {
  'Smileys': ['😀','😂','🤣','😊','😇','🥰','😍','🤩','😘','😗','😋','😛','🤪','😝','🤑','🤗','🤭','🫢','🤫','🤔','🫡','🤐','🤨','😐','😑','😶','🫥','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🥴','😵','🤯','🥳','🥸','😎','🤓','🧐'],
  'Gestures': ['👋','🤚','🖐️','✋','🖖','🫱','🫲','👌','🤌','🤏','✌️','🤞','🫰','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','🫵','👍','👎','✊','👊','🤛','🤜','👏','🙌','🫶','👐','🤲','🤝','🙏'],
  'Hearts': ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','❤️‍🩹','💕','💞','💓','💗','💖','💘','💝','💟'],
  'Animals': ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐻‍❄️','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🐔','🐧','🐦','🦅','🦆','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🪱','🐛','🦋','🐌','🐞','🐜'],
  'Objects': ['💰','📱','💻','⌨️','📷','📹','📺','📻','⏰','🔋','🔌','💡','🔦','📚','📖','✏️','📝','📎','✂️','🗑️','🔒','🔓','🔑','🗝️','🔨','🪓','⛏️','🔧','🔩','⚙️'],
  'Symbols': ['✅','❌','❓','❗','💯','🔥','⭐','💫','🌟','✨','⚡','💥','💢','💤','💨','🕊️','🎵','🎶','🔔','📢','💬','💭','🗯️','♠️','♥️','♦️','♣️','🏳️','🏴','🚩'],
};

const SUGGESTED_SERVERS = [
  { name: 'Local (Dev)', url: 'http://localhost:3001' },
  { name: 'Deployment (Beta)', url: 'https://golgappa-server.onrender.com' },
];

// ═══ Fake Doc Content ═══
const FAKE_DOC_HTML = `
<h1>Chapter 5: Cellular Respiration Notes</h1>
<h2>5.1 Overview of Cellular Respiration</h2>
<p>Cellular respiration is the process by which organisms break down glucose to release energy in the form of ATP (adenosine triphosphate). This process occurs in the mitochondria of eukaryotic cells.</p>
<p>The overall equation for cellular respiration is:</p>
<p><strong>C₆H₁₂O₆ + 6O₂ → 6CO₂ + 6H₂O + Energy (ATP)</strong></p>
<h2>5.2 Stages of Cellular Respiration</h2>
<ul>
  <li><strong>Glycolysis</strong> — occurs in the cytoplasm, breaks glucose into two pyruvate molecules</li>
  <li><strong>Krebs Cycle</strong> — occurs in the mitochondrial matrix</li>
  <li><strong>Electron Transport Chain (ETC)</strong> — occurs in the inner mitochondrial membrane</li>
</ul>
<h2>5.3 Key Terms</h2>
<p>ATP synthase, NADH, FADH₂, oxidative phosphorylation, substrate-level phosphorylation, fermentation (anaerobic respiration).</p>
<p>Remember: The total ATP yield from one glucose molecule is approximately 36-38 ATP molecules (theoretical maximum).</p>
<p>&nbsp;</p>
<p>&nbsp;</p>
`;

export default function Home() {
  // ─── State ───
  const [chatActive, setChatActive] = useState(false);
  const [showEntry, setShowEntry] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [username, setUsername] = useState('');
  const [cryptoKey, setCryptoKey] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [users, setUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [gifSearchQuery, setGifSearchQuery] = useState('');
  const [gifs, setGifs] = useState([]);
  const [gifLoading, setGifLoading] = useState(false);
  const [showUserSidebar, setShowUserSidebar] = useState(false);
  const [openMenu, setOpenMenu] = useState(null);
  const [helpClicks, setHelpClicks] = useState(0);
  const [helpHintVisible, setHelpHintVisible] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [docHtml, setDocHtml] = useState(FAKE_DOC_HTML);
  const [remoteUpdating, setRemoteUpdating] = useState(false);
  const [entryError, setEntryError] = useState('');

  // Settings
  const [burnTimer, setBurnTimer] = useState(60);
  const [burnEnabled, setBurnEnabled] = useState(true);
  const [inputMasked, setInputMasked] = useState(false);
  const [serverUrl, setServerUrl] = useState('http://localhost:3001');

  // Refs
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const helpClickTimerRef = useRef(null);
  const lastEnterRef = useRef(0);
  const docRef = useRef(null);
  const syncTimeoutRef = useRef(null);

  // ─── Initialize from URL hash ───
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash) {
      setRoomId(decodeURIComponent(hash));
    }
    setUsername(generateUsername());

    // Use SessionStorage only
    const savedServer = sessionStorage.getItem('_ds_server');
    if (savedServer) setServerUrl(savedServer);

    const savedDoc = sessionStorage.getItem('_ds_doc_content');
    if (savedDoc) setDocHtml(savedDoc);

    // Cleanup on tab close
    const cleanup = () => {
      sessionStorage.clear();
      disconnectSocket();
    };
    window.addEventListener('beforeunload', cleanup);
    return () => window.removeEventListener('beforeunload', cleanup);
  }, []);

  // ─── Panic Key (Shift+Esc or double-tap Enter) ───
  useEffect(() => {
    const handlePanic = (e) => {
      // Shift + Escape
      if (e.key === 'Escape' && e.shiftKey) {
        e.preventDefault();
        triggerPanic();
        return;
      }
      // Double-tap Enter (within 300ms)
      if (e.key === 'Enter' && !e.target.closest('.chat-input') && !e.target.closest('.entry-dialog')) {
        const now = Date.now();
        if (now - lastEnterRef.current < 300) {
          e.preventDefault();
          triggerPanic();
        }
        lastEnterRef.current = now;
      }
    };

    window.addEventListener('keydown', handlePanic);
    return () => window.removeEventListener('keydown', handlePanic);
  }, []);

  const triggerPanic = () => {
    document.body.classList.add('panic-fadeout');
    setTimeout(() => {
      sessionStorage.clear();
      disconnectSocket();
      window.location.href = 'https://classroom.google.com';
    }, 150);
  };

  // ─── Hidden Trigger: Click Help icon 3 times ───
  const handleHelpClick = useCallback(() => {
    setHelpClicks(prev => {
      const newCount = prev + 1;

      if (helpClickTimerRef.current) clearTimeout(helpClickTimerRef.current);
      helpClickTimerRef.current = setTimeout(() => setHelpClicks(0), 2000);

      if (newCount >= 3) {
        setShowEntry(true);
        setHelpClicks(0);
        return 0;
      }

      // Show subtle hint
      setHelpHintVisible(true);
      setTimeout(() => setHelpHintVisible(false), 500);

      return newCount;
    });
  }, []);

  // Also allow Ctrl+Shift+K as secret keyboard shortcut
  useEffect(() => {
    const handleSecretCombo = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'K') {
        e.preventDefault();
        setShowEntry(true);
      }
    };
    window.addEventListener('keydown', handleSecretCombo);
    return () => window.removeEventListener('keydown', handleSecretCombo);
  }, []);

  const handleJoinRoom = async () => {
    if (!roomId.trim() || !secretKey.trim()) {
      setEntryError('Room ID and Access Key are required.');
      return;
    }

    // URL validation
    if (!serverUrl.startsWith('http://') && !serverUrl.startsWith('https://')) {
      setEntryError('Server URL must start with http:// or https://');
      setConnecting(false);
      return;
    }

    setConnecting(true);
    setConnectionStatus('connecting');
    setEntryError(''); // Clear previous error

    try {
      // Derive encryption key from shared secret (NEVER sent to server)
      const key = await deriveKey(secretKey);
      setCryptoKey(key);

      // Save server URL to session
      sessionStorage.setItem('_ds_server', serverUrl);

      // Connect socket
      const socket = connectSocket(serverUrl);

      // Timeout if connection takes too long
      const connectionTimeout = setTimeout(() => {
        if (!getSocket()?.connected) {
          setConnecting(false);
          setConnectionStatus('disconnected');
          setEntryError('Connection timeout. Is the server running?');
          disconnectSocket();
        }
      }, 5000);

      socket.on('connect', () => {
        clearTimeout(connectionTimeout);
        setConnected(true);
        setConnecting(false);
        setConnectionStatus('connected');
        setEntryError('');
        setShowEntry(false);
        setChatActive(true);

        // Update URL hash
        window.location.hash = encodeURIComponent(roomId);

        // Send join event (disguised)
        sendPayload({
          type: 'join',
          roomId: roomId,
          username: username,
        });
      });

      socket.on('disconnect', () => {
        setConnected(false);
        setConnectionStatus('disconnected');
      });

      socket.on('connect_error', (err) => {
        clearTimeout(connectionTimeout);
        setConnecting(false);
        setConnectionStatus('disconnected');
        setEntryError('Could not reach server. Verify the URL.');
        disconnectSocket();
      });

      // Handle incoming disguised payloads
      onPayload(async (data) => {
        if (data.type === 'message') {
          // Decrypt the message
          const plaintext = await decryptMessage(data.encrypted, data.iv, key);
          const newMsg = {
            id: data.id,
            from: data.from,
            text: plaintext,
            timestamp: data.timestamp,
            type: 'message',
            isGif: plaintext.startsWith('[GIF]'),
          };
          setMessages(prev => [...prev, newMsg]);
        }

        if (data.type === 'system') {
          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            text: data.text,
            timestamp: data.timestamp,
            type: 'system',
          }]);
        }

        if (data.type === 'user_list') {
          setUsers(data.users);
        }

        if (data.type === 'typing') {
          if (data.isTyping) {
            setTypingUsers(prev => [...new Set([...prev, data.from])]);
          } else {
            setTypingUsers(prev => prev.filter(u => u !== data.from));
          }
        }

        if (data.type === 'doc_update' && data.from !== username) {
          setRemoteUpdating(true);
          setDocHtml(data.html);
          sessionStorage.setItem('_ds_doc_content', data.html);
          // Briefly reset cursor state if needed, but usually just update HTML
          setTimeout(() => setRemoteUpdating(false), 50);
        }
      });
    } catch (err) {
      setConnecting(false);
      setConnectionStatus('disconnected');
    }
  };

  // ─── Auto-scroll to bottom ───
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ─── Self-Destruct Timer (Burn-on-Read) ───
  useEffect(() => {
    if (!burnEnabled || messages.length === 0) return;

    const timers = messages
      .filter(m => m.type === 'message' && !m.burning)
      .map(m => {
        return setTimeout(() => {
          setMessages(prev =>
            prev.map(msg =>
              msg.id === m.id ? { ...msg, burning: true } : msg
            )
          );
          // Remove after animation
          setTimeout(() => {
            setMessages(prev => prev.filter(msg => msg.id !== m.id));
          }, 500);
        }, burnTimer * 1000);
      });

    return () => timers.forEach(clearTimeout);
  }, [messages, burnEnabled, burnTimer]);

  // ─── Send Message ───
  const handleSendMessage = async () => {
    const text = inputText.trim();
    if (!text || !cryptoKey || !connected) return;

    const msgId = Date.now().toString() + Math.random().toString(36).substr(2, 9);

    // Encrypt message client-side
    const { encrypted, iv } = await encryptMessage(text, cryptoKey);

    // Send encrypted payload (server never sees plaintext)
    sendPayload({
      type: 'message',
      encrypted,
      iv,
      id: msgId,
    });

    // Add to local messages
    setMessages(prev => [...prev, {
      id: msgId,
      from: username,
      text: text,
      timestamp: Date.now(),
      type: 'message',
      self: true,
      isGif: text.startsWith('[GIF]'),
    }]);

    setInputText('');
    setShowEmojiPicker(false);
    setShowGifPicker(false);

    // Stop typing indicator
    sendPayload({ type: 'typing', isTyping: false });
  };

  // ─── Send GIF ───
  const handleSendGif = async (gifUrl) => {
    if (!cryptoKey || !connected) return;

    const text = `[GIF]${gifUrl}`;
    const msgId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const { encrypted, iv } = await encryptMessage(text, cryptoKey);

    sendPayload({ type: 'message', encrypted, iv, id: msgId });

    setMessages(prev => [...prev, {
      id: msgId,
      from: username,
      text: text,
      timestamp: Date.now(),
      type: 'message',
      self: true,
      isGif: true,
    }]);

    setShowGifPicker(false);
  };

  // ─── Typing Indicator ───
  const handleTyping = () => {
    sendPayload({ type: 'typing', isTyping: true });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      sendPayload({ type: 'typing', isTyping: false });
    }, 2000);
  };

  // ─── Search GIFs ───
  const searchGifs = async (query) => {
    setGifLoading(true);
    try {
      const endpoint = query
        ? `/api/gif/search?q=${encodeURIComponent(query)}&limit=20`
        : `/api/gif/trending?limit=20`;
      const res = await fetch(`${serverUrl}${endpoint}`);
      const data = await res.json();
      setGifs(data.data || []);
    } catch (e) {
      setGifs([]);
    }
    setGifLoading(false);
  };

  useEffect(() => {
    if (showGifPicker) searchGifs(gifSearchQuery);
  }, [showGifPicker]);

  // ─── Close menus on outside click ───
  useEffect(() => {
    const handleClick = (e) => {
      if (openMenu && !e.target.closest('.gdocs-toolbar__menu-item')) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [openMenu]);

  // ─── Format timestamp ───
  const formatTime = (ts) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // ─── Render message text (handle GIFs) ───
  const renderMessageContent = (msg) => {
    if (msg.isGif) {
      const gifUrl = msg.text.replace('[GIF]', '');
      return (
        <div className="chat-msg__gif">
          <img src={gifUrl} alt="GIF" loading="lazy" />
        </div>
      );
    }
    return <div className={`chat-msg__text ${inputMasked ? 'masked' : ''}`}>{msg.text}</div>;
  };

  // ─── Document Editing & Sync ───
  const handleDocInput = (e) => {
    const html = e.currentTarget.innerHTML;
    setDocHtml(html);
    sessionStorage.setItem('_ds_doc_content', html);

    // Debounced sync (disguised as autosave)
    if (connected && !remoteUpdating) {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = setTimeout(() => {
        sendPayload({
          type: 'doc_update',
          html: html,
        });
      }, 1000);
    }
  };

  return (
    <>
      {/* ═══ Google Docs Header ═══ */}
      <header className="gdocs-header">
        {/* Docs Icon */}
        <div className="gdocs-header__icon">
          <svg viewBox="0 0 48 48" width="40" height="40">
            <path fill="#2196F3" d="M37,45H11c-1.657,0-3-1.343-3-3V6c0-1.657,1.343-3,3-3h17l12,12v27C40,43.657,38.657,45,37,45z"/>
            <path fill="#BBDEFB" d="M40,15H28V3L40,15z"/>
            <rect fill="#E3F2FD" x="14" y="19" width="20" height="1.5" rx="0.75"/>
            <rect fill="#E3F2FD" x="14" y="24" width="20" height="1.5" rx="0.75"/>
            <rect fill="#E3F2FD" x="14" y="29" width="16" height="1.5" rx="0.75"/>
            <rect fill="#E3F2FD" x="14" y="34" width="18" height="1.5" rx="0.75"/>
          </svg>
        </div>

        {/* Title Area */}
        <div className="gdocs-header__title-area">
          <div className="gdocs-header__title">Class Notes - Untitled Document</div>
          <div className="gdocs-header__subtitle">
            <span className="gdocs-header__star" title="Star">☆</span>
            <span className="gdocs-header__status">
              {connected ? 'All changes saved in Drive' : 'View only'}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="gdocs-header__actions">
          <button
            className="gdocs-header__action-btn"
            title="Comments"
            onClick={() => setShowUserSidebar(prev => !prev)}
          >
            💬
          </button>
          <button
            className="gdocs-header__action-btn"
            title="Help"
            id="help-trigger"
            onClick={handleHelpClick}
          >
            ❓
          </button>
          <button
            className="gdocs-header__share-btn"
            onClick={() => chatActive && setShowSettings(true)}
          >
            🔒 <span>{chatActive ? 'Settings' : 'Share'}</span>
          </button>
          {chatActive && (
            <div
              className="gdocs-header__avatar"
              style={{ background: getUserColor(username) }}
              title={username}
            >
              {getInitials(username)}
            </div>
          )}
        </div>
      </header>

      {/* ═══ Toolbar (Fake menus that map to chat functions) ═══ */}
      <div className="gdocs-toolbar">
        <div className="gdocs-toolbar__menus">
          {/* File Menu → Key Change Dialog */}
          <div
            className="gdocs-toolbar__menu-item"
            onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === 'file' ? null : 'file'); }}
          >
            File
            <div className={`gdocs-toolbar__dropdown ${openMenu === 'file' ? 'open' : ''}`}>
              <div className="gdocs-toolbar__dropdown-item" onClick={() => { setOpenMenu(null); if(chatActive) { disconnectSocket(); setChatActive(false); setConnected(false); setMessages([]); setShowEntry(true); } }}>
                🔄 New document <span className="shortcut">Change room</span>
              </div>
              <div className="gdocs-toolbar__dropdown-item" onClick={() => { setOpenMenu(null); if(chatActive) setShowSettings(true); }}>
                🔑 Page setup <span className="shortcut">Change key</span>
              </div>
              <div className="gdocs-toolbar__dropdown-divider" />
              <div className="gdocs-toolbar__dropdown-item" onClick={() => { setOpenMenu(null); triggerPanic(); }}>
                🚪 Exit <span className="shortcut">Shift+Esc</span>
              </div>
            </div>
          </div>

          {/* Edit Menu → Clear Local Screen */}
          <div
            className="gdocs-toolbar__menu-item"
            onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === 'edit' ? null : 'edit'); }}
          >
            Edit
            <div className={`gdocs-toolbar__dropdown ${openMenu === 'edit' ? 'open' : ''}`}>
              <div className="gdocs-toolbar__dropdown-item" onClick={() => { setOpenMenu(null); setMessages([]); }}>
                🗑️ Clear all <span className="shortcut">Clear chat</span>
              </div>
              <div className="gdocs-toolbar__dropdown-item" onClick={() => { setOpenMenu(null); setInputMasked(prev => !prev); }}>
                {inputMasked ? '👁️' : '🔒'} {inputMasked ? 'Show text' : 'Mask text'} <span className="shortcut">Anti-peek</span>
              </div>
            </div>
          </div>

          {/* View Menu */}
          <div
            className="gdocs-toolbar__menu-item"
            onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === 'view' ? null : 'view'); }}
          >
            View
            <div className={`gdocs-toolbar__dropdown ${openMenu === 'view' ? 'open' : ''}`}>
              <div className="gdocs-toolbar__dropdown-item" onClick={() => { setOpenMenu(null); setShowUserSidebar(prev => !prev); }}>
                👥 Outline <span className="shortcut">User list</span>
              </div>
              <div className="gdocs-toolbar__dropdown-item" onClick={() => { setOpenMenu(null); if (!chatActive) { setChatActive(false); } else { setChatActive(false); setMessages([]); disconnectSocket(); setConnected(false); } }}>
                📄 Document view <span className="shortcut">Hide chat</span>
              </div>
            </div>
          </div>

          {/* Tools Menu */}
          <div
            className="gdocs-toolbar__menu-item"
            onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === 'tools' ? null : 'tools'); }}
          >
            Tools
            <div className={`gdocs-toolbar__dropdown ${openMenu === 'tools' ? 'open' : ''}`}>
              <div className="gdocs-toolbar__dropdown-item" onClick={() => { setOpenMenu(null); setBurnEnabled(prev => !prev); }}>
                🔥 AutoSave {burnEnabled ? '(On)' : '(Off)'} <span className="shortcut">Burn timer</span>
              </div>
              <div className="gdocs-toolbar__dropdown-item" onClick={() => { setOpenMenu(null); setShowSettings(true); }}>
                ⚙️ Preferences <span className="shortcut">Settings</span>
              </div>
            </div>
          </div>

          <div className="gdocs-toolbar__menu-item" style={{ opacity: 0.5 }}>Extensions</div>
          <div className="gdocs-toolbar__menu-item" style={{ opacity: 0.5 }}>Format</div>
        </div>

        {/* Formatting Toolbar (decorative) */}
        <div className="gdocs-toolbar__formats">
          <select className="gdocs-toolbar__format-select" defaultValue="normal" disabled>
            <option value="normal">Normal text</option>
            <option value="h1">Heading 1</option>
            <option value="h2">Heading 2</option>
          </select>
          <div className="gdocs-toolbar__separator" />
          <select className="gdocs-toolbar__format-select" defaultValue="roboto" disabled>
            <option value="roboto">Roboto</option>
            <option value="arial">Arial</option>
          </select>
          <div className="gdocs-toolbar__separator" />
          <select className="gdocs-toolbar__format-select" defaultValue="11" disabled style={{ width: '50px' }}>
            <option value="11">11</option>
            <option value="12">12</option>
          </select>
          <div className="gdocs-toolbar__separator" />
          <button className="gdocs-toolbar__format-btn" disabled><b>B</b></button>
          <button className="gdocs-toolbar__format-btn" disabled><i>I</i></button>
          <button className="gdocs-toolbar__format-btn" disabled><u>U</u></button>
          <button className="gdocs-toolbar__format-btn" disabled style={{ textDecoration: 'line-through' }}>S</button>
          <div className="gdocs-toolbar__separator" />
          <button className="gdocs-toolbar__format-btn" disabled>🎨</button>
          <button className="gdocs-toolbar__format-btn" disabled>🔗</button>
          <button className="gdocs-toolbar__format-btn" disabled>💬</button>
          <div className="gdocs-toolbar__separator" />
          <button className="gdocs-toolbar__format-btn" disabled>≡</button>
          <button className="gdocs-toolbar__format-btn" disabled>≡</button>
          <button className="gdocs-toolbar__format-btn" disabled>≡</button>
        </div>
      </div>

      {/* ═══ Document Body ═══ */}
      <div className="gdocs-body">
        <div className="gdocs-page">
            {/* Real Interactive Collaborative Doc */}
            <div
              ref={docRef}
              className={`fake-doc__content ${chatActive ? 'hidden' : ''}`}
              contentEditable={true}
              suppressContentEditableWarning={true}
              onInput={handleDocInput}
              spellCheck={false}
              dangerouslySetInnerHTML={{ __html: docHtml }}
            />

            {/* Chat Container */}
            <div className={`chat-container ${chatActive ? 'active' : ''}`}>
            {/* Encryption Badge */}
            <div className="encryption-badge">
              🔒 End-to-end encrypted • Room: {roomId}
            </div>

            {/* Messages */}
            <div className="chat-messages">
              {messages.map((msg) => {
                if (msg.type === 'system') {
                  return (
                    <div key={msg.id} className="chat-msg--system">
                      <span>{msg.text}</span>
                    </div>
                  );
                }

                const isSelf = msg.self || msg.from === username;
                return (
                  <div key={msg.id} className={`chat-msg ${isSelf ? 'self' : ''} ${msg.burning ? 'burning' : ''}`}>
                    <div
                      className="chat-msg__avatar"
                      style={{ background: getUserColor(msg.from) }}
                    >
                      {getInitials(msg.from)}
                    </div>
                    <div className="chat-msg__bubble">
                      {!isSelf && <div className="chat-msg__sender">{msg.from}</div>}
                      {renderMessageContent(msg)}
                      <div className="chat-msg__time">{formatTime(msg.timestamp)}</div>
                      {burnEnabled && (
                        <div className="chat-msg__burn-indicator">
                          🔥 {burnTimer}s
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Typing Indicator */}
              {typingUsers.length > 0 && (
                <div className="chat-typing">
                  <div className="chat-typing__dots">
                    <span /><span /><span />
                  </div>
                  {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Chat Input */}
            <div className="chat-input-area" style={{ position: 'relative' }}>
              {/* Emoji Picker */}
              {showEmojiPicker && (
                <div className="picker-popup">
                  <div className="picker-popup__tabs">
                    <div className="picker-popup__tab active" onClick={() => { setShowEmojiPicker(true); setShowGifPicker(false); }}>😊 Emoji</div>
                    <div className="picker-popup__tab" onClick={() => { setShowEmojiPicker(false); setShowGifPicker(true); }}>GIF</div>
                  </div>
                  <div className="picker-popup__grid">
                    {Object.entries(EMOJI_CATEGORIES).map(([cat, emojis]) =>
                      emojis.map((emoji, i) => (
                        <button
                          key={`${cat}-${i}`}
                          className="picker-popup__emoji"
                          onClick={() => setInputText(prev => prev + emoji)}
                        >
                          {emoji}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* GIF Picker */}
              {showGifPicker && (
                <div className="picker-popup">
                  <div className="picker-popup__tabs">
                    <div className="picker-popup__tab" onClick={() => { setShowEmojiPicker(true); setShowGifPicker(false); }}>😊 Emoji</div>
                    <div className="picker-popup__tab active" onClick={() => { setShowEmojiPicker(false); setShowGifPicker(true); }}>GIF</div>
                  </div>
                  <div className="picker-popup__search">
                    <input
                      type="text"
                      placeholder="Search GIFs..."
                      value={gifSearchQuery}
                      onChange={(e) => setGifSearchQuery(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') searchGifs(gifSearchQuery); }}
                    />
                  </div>
                  <div className="picker-popup__gif-grid">
                    {gifLoading && <div className="loading-spinner" />}
                    {gifs.map((gif) => (
                      <button
                        key={gif.id}
                        className="picker-popup__gif"
                        onClick={() => handleSendGif(gif.images?.fixed_height?.url || gif.images?.original?.url)}
                      >
                        <img src={gif.images?.fixed_height_small?.url} alt={gif.title} loading="lazy" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="chat-input-wrapper">
                <button
                  className="chat-input-btn"
                  onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowGifPicker(false); }}
                  title="Emoji"
                >
                  😊
                </button>
                <button
                  className="chat-input-btn"
                  onClick={() => { setShowGifPicker(!showGifPicker); setShowEmojiPicker(false); }}
                  title="GIF"
                >
                  GIF
                </button>
                <input
                  ref={inputRef}
                  type={inputMasked ? 'password' : 'text'}
                  className="chat-input"
                  placeholder="Type a message..."
                  value={inputText}
                  onChange={(e) => { setInputText(e.target.value); handleTyping(); }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                  autoComplete="off"
                />
                <button
                  className={`chat-input-btn send`}
                  onClick={handleSendMessage}
                  disabled={!inputText.trim() || !connected}
                  title="Send"
                >
                  ➤
                </button>
              </div>
            </div>
          </div>

          {/* User Sidebar */}
          {chatActive && (
            <div className={`user-sidebar ${showUserSidebar ? 'open' : ''}`}>
              <div className="user-sidebar__title">
                👥 Viewers ({users.length})
                <button
                  className="gdocs-header__action-btn"
                  style={{ marginLeft: 'auto', fontSize: '16px' }}
                  onClick={() => setShowUserSidebar(false)}
                  title="Close"
                >
                  ✕
                </button>
              </div>
              {users.map((user) => (
                <div key={user} className="user-sidebar__user">
                  <div
                    className="user-sidebar__user-avatar"
                    style={{ background: getUserColor(user) }}
                  >
                    {getInitials(user)}
                  </div>
                  <div>
                    <div className="user-sidebar__user-name">{user}</div>
                    {user === username && <div className="user-sidebar__user-badge">(You)</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ═══ Entry Dialog ═══ */}
      {showEntry && (
        <div className="entry-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowEntry(false); }}>
          <div className="entry-dialog">
            <div className="entry-dialog__title">Join Document</div>
            <div className="entry-dialog__subtitle">
              Enter the document ID and access key to join the collaboration session.
            </div>

            {entryError && (
              <div className="entry-dialog__error-badge">
                ⚠️ {entryError}
              </div>
            )}

            <div className="entry-dialog__field">
              <label className="entry-dialog__label">Document ID (Room)</label>
              <input
                className="entry-dialog__input"
                type="text"
                placeholder="Enter room ID..."
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                autoComplete="off"
              />
              <div className="entry-dialog__hint">Share this ID with collaborators</div>
            </div>

            <div className="entry-dialog__field">
              <label className="entry-dialog__label">Access Key (Shared Secret)</label>
              <input
                className="entry-dialog__input"
                type="password"
                placeholder="Enter shared secret key..."
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                autoComplete="off"
                onKeyDown={(e) => { if (e.key === 'Enter') handleJoinRoom(); }}
              />
              <div className="entry-dialog__hint">🔒 This key never leaves your browser — used for encryption only</div>
            </div>

            <div className="entry-dialog__field">
              <label className="entry-dialog__label">Server URL</label>
              <input
                className="entry-dialog__input"
                type="text"
                placeholder="http://localhost:3001"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                autoComplete="off"
              />
              <div className="entry-dialog__suggestions">
                {SUGGESTED_SERVERS.map((s) => (
                  <button
                    key={s.url}
                    className="entry-dialog__suggestion-btn"
                    onClick={() => setServerUrl(s.url)}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
              <div className="entry-dialog__hint">Backend server address</div>
            </div>

            <div className="entry-dialog__field">
              <label className="entry-dialog__label">Your Identity</label>
              <input
                className="entry-dialog__input"
                type="text"
                value={username}
                disabled
                style={{ background: '#f1f3f4', color: '#5f6368' }}
              />
              <div className="entry-dialog__hint">Auto-generated anonymous identity</div>
            </div>

            <div className="entry-dialog__actions">
              <button
                className="entry-dialog__btn entry-dialog__btn--secondary"
                onClick={() => setShowEntry(false)}
              >
                Cancel
              </button>
              <button
                className="entry-dialog__btn entry-dialog__btn--primary"
                onClick={handleJoinRoom}
                disabled={!roomId.trim() || !secretKey.trim() || connecting}
              >
                {connecting ? 'Connecting...' : 'Join'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Settings Dialog ═══ */}
      {showSettings && (
        <div className="settings-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowSettings(false); }}>
          <div className="settings-dialog">
            <div className="settings-dialog__title">Document Preferences</div>

            <div className="settings-dialog__section">
              <div className="settings-dialog__section-title">Security</div>
              <div className="settings-dialog__row">
                <div>
                  <div className="settings-dialog__row-label">Input Masking (Anti-Peek)</div>
                  <div className="settings-dialog__row-desc">Hide typed text with dots</div>
                </div>
                <button
                  className={`toggle ${inputMasked ? 'active' : ''}`}
                  onClick={() => setInputMasked(!inputMasked)}
                />
              </div>
            </div>

            <div className="settings-dialog__section">
              <div className="settings-dialog__section-title">Message Handling</div>
              <div className="settings-dialog__row">
                <div>
                  <div className="settings-dialog__row-label">Auto-Delete (Burn-on-Read)</div>
                  <div className="settings-dialog__row-desc">Messages self-destruct after timer</div>
                </div>
                <button
                  className={`toggle ${burnEnabled ? 'active' : ''}`}
                  onClick={() => setBurnEnabled(!burnEnabled)}
                />
              </div>
              {burnEnabled && (
                <div className="settings-dialog__row">
                  <div>
                    <div className="settings-dialog__row-label">Burn Timer</div>
                    <div className="settings-dialog__row-desc">Seconds before message is destroyed</div>
                  </div>
                  <select
                    className="settings-select"
                    value={burnTimer}
                    onChange={(e) => setBurnTimer(Number(e.target.value))}
                  >
                    <option value={15}>15 seconds</option>
                    <option value={30}>30 seconds</option>
                    <option value={60}>60 seconds</option>
                    <option value={120}>2 minutes</option>
                    <option value={300}>5 minutes</option>
                  </select>
                </div>
              )}
            </div>

            <div className="settings-dialog__section">
              <div className="settings-dialog__section-title">Identity</div>
              <div className="settings-dialog__row">
                <div>
                  <div className="settings-dialog__row-label">Username</div>
                  <div className="settings-dialog__row-desc">{username}</div>
                </div>
                <button
                  className="entry-dialog__btn entry-dialog__btn--secondary"
                  style={{ height: '32px', padding: '0 12px', fontSize: '12px' }}
                  onClick={() => {
                    const newName = generateUsername();
                    setUsername(newName);
                  }}
                >
                  Regenerate
                </button>
              </div>
              <div className="settings-dialog__row">
                <div>
                  <div className="settings-dialog__row-label">Room</div>
                  <div className="settings-dialog__row-desc">{roomId || 'Not connected'}</div>
                </div>
              </div>
              <div className="settings-dialog__row">
                <div>
                  <div className="settings-dialog__row-label">Encryption</div>
                  <div className="settings-dialog__row-desc">AES-GCM 256-bit • Key derived via PBKDF2</div>
                </div>
                <span style={{ color: '#34A853', fontSize: '14px' }}>✅ Active</span>
              </div>
            </div>

            <div className="settings-dialog__section">
              <div className="settings-dialog__section-title">Shortcuts</div>
              <div className="settings-dialog__row">
                <div className="settings-dialog__row-label">Panic Key</div>
                <div className="settings-dialog__row-desc">Shift+Esc → Redirect to classroom.google.com</div>
              </div>
              <div className="settings-dialog__row">
                <div className="settings-dialog__row-label">Open Chat</div>
                <div className="settings-dialog__row-desc">Ctrl+Shift+K or click Help (❓) 3 times</div>
              </div>
            </div>

            <div className="entry-dialog__actions" style={{ marginTop: '24px' }}>
              <button
                className="entry-dialog__btn entry-dialog__btn--primary"
                onClick={() => setShowSettings(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Connection Status ═══ */}
      {chatActive && (
        <div className={`connection-status ${connectionStatus}`}>
          <span className="connection-status__dot" />
          {connectionStatus === 'connected' && 'Synced'}
          {connectionStatus === 'disconnected' && 'Offline'}
          {connectionStatus === 'connecting' && 'Syncing...'}
        </div>
      )}

      {/* ═══ Help Trigger Hint ═══ */}
      <div className={`help-trigger-hint ${helpHintVisible ? 'visible' : ''}`}>
        {helpClicks === 1 ? '2 more...' : '1 more...'}
      </div>
    </>
  );
}
