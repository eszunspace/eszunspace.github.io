// Firebase initialization (must be included before this script)
      // Assumes Firebase SDK is already loaded

      (function () {
        const firebaseConfig = {
          apiKey: "AIzaSyDKvGLsd1jKfsSlzgTjBas-8WvbFqV1xU",
          authDomain: "eszunspace-bc900.firebaseapp.com",
          databaseURL: "https://eszunspace-bc900-default-rtdb.europe-west1.firebasedatabase.app",
          projectId: "eszunspace-bc900",
          storageBucket: "eszunspace-bc900.firebasestorage.app",
          messagingSenderId: "105651684829",
          appId: "1:105651684829:web:5c8fd5051c8c2daf24f744",
          measurementId: "G-ZDM5GF0MBW"
        };

        // Initialize Firebase if not already initialized
        if (!firebase.apps.length) {
          firebase.initializeApp(firebaseConfig);
        }
        const database = firebase.database();

        window.upcomingLaunches = [];
        let countdownInterval = null;
        const LAUNCHES_CACHE_KEY = 'esz_launches_cache';

        // Load launches from cache first (instant), then sync from Firebase
        function loadLaunchesFromCache() {
          try {
            const cached = localStorage.getItem(LAUNCHES_CACHE_KEY);
            if (cached) {
              const data = JSON.parse(cached);
              const now = new Date();
              upcomingLaunches = data
                .filter(event => new Date(event.datetimeISO) > now)
                .sort((a, b) => new Date(a.datetimeISO) - new Date(b.datetimeISO))
                .slice(0, 6);
              renderLaunches();
              startCountdowns();
              console.log("Lanzamientos cargados desde cache:", upcomingLaunches.length);
              return true;
            }
          } catch (e) {
            console.warn('Error loading launches cache:', e);
          }
          return false;
        }

        // Load launches from Firebase
        async function loadLaunches() {
          try {
            const snapshot = await database.ref('events').once('value');
            const data = snapshot.val() || {};
            const events = Object.keys(data).map(key => ({ id: key, ...data[key] }));

            // Filter upcoming launches (future dates only)
            const now = new Date();
            upcomingLaunches = events
              .filter(event => new Date(event.datetimeISO) > now)
              .sort((a, b) => new Date(a.datetimeISO) - new Date(b.datetimeISO))
              .slice(0, 6); // Show max 6 launches

            renderLaunches();
            startCountdowns();
            console.log("Lanzamientos sincronizados desde Firebase:", upcomingLaunches.length);

            // Try to save to cache (non-blocking, ignore if quota exceeded)
            try {
              // Only cache lightweight data (no base64 images)
              const lightEvents = events.map(e => ({
                id: e.id,
                vehicle: e.vehicle,
                mission: e.mission,
                site: e.site,
                datetimeISO: e.datetimeISO,
                description: e.description,
                streamUrl: e.streamUrl
              }));
              localStorage.setItem(LAUNCHES_CACHE_KEY, JSON.stringify(lightEvents));
            } catch (cacheError) {
              console.warn('Could not cache launches (quota exceeded):', cacheError);
            }
          } catch (error) {
            console.error('Error loading launches:', error);
            if (upcomingLaunches.length === 0) {
              document.getElementById('launches-list').innerHTML =
                '<div class="no-launches"><div class="no-launches-icon">🚀</div><div>Error al cargar lanzamientos</div></div>';
            }
          }
        }

        // Render launch cards
        function renderLaunches() {
          const container = document.getElementById('launches-list');

          if (upcomingLaunches.length === 0) {
            container.innerHTML = `
              <div class="no-launches">
                <div class="no-launches-icon">🚀</div>
                <div class="no-launches-text">No hay lanzamientos programados</div>
              </div>`;
            return;
          }

          container.innerHTML = upcomingLaunches.map((launch) => {
            const launchDate = new Date(launch.datetimeISO);
            const dateStr = launchDate.toLocaleString('es-ES', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit'
            });

            return `
            <div class="launch-card" data-launch-id="${launch.id}" onclick="showEventModal('${launch.id}')">
              <div class="launch-card-inner">
                <div class="launch-info-section">
                  <div class="launch-vehicle">${launch.vehicle || 'Vehículo'}</div>
                  ${launch.mission ? `<div class="launch-mission">${launch.mission}</div>` : ''}
                  <div class="launch-site">${launch.site || ''}</div>
                </div>
                <div class="launch-countdown-section">
                  <div class="launch-countdown">
                    <div class="launch-t">T-</div>
                    <div class="launch-time" data-target="${launch.datetimeISO}">--:--:--</div>
                  </div>
                  <div class="launch-date">${dateStr}</div>
                </div>
              </div>
            </div>
          `;
          }).join('');
        }

        // Start countdown timers
        function startCountdowns() {
          if (countdownInterval) {
            clearInterval(countdownInterval);
          }

          function update() {
            const now = new Date();
            document.querySelectorAll('.launch-time').forEach(timeEl => {
              const targetStr = timeEl.getAttribute('data-target');
              if (!targetStr) return;

              const target = new Date(targetStr);
              const diff = target - now;

              if (diff <= 0) {
                timeEl.textContent = '¡LANZADO!';
                timeEl.style.color = '#51cf66';
                return;
              }

              // Calculate time remaining
              const totalSeconds = Math.floor(diff / 1000);
              const days = Math.floor(totalSeconds / 86400);
              const hours = Math.floor((totalSeconds % 86400) / 3600);
              const minutes = Math.floor((totalSeconds % 3600) / 60);
              const seconds = totalSeconds % 60;

              // Format: "Xd HH:MM:SS" or "HH:MM:SS" if < 1 day
              if (days > 0) {
                timeEl.textContent = `${days}d ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
              } else {
                timeEl.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
              }
            });
          }

          update();
          countdownInterval = setInterval(update, 1000);
        }

        // Initialize on page load - cache first, then sync
        function initLaunches() {
          // Try to load from cache first (instant)
          loadLaunchesFromCache();
          // Then sync from Firebase in background
          loadLaunches();
        }

        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', initLaunches);
        } else {
          initLaunches();
        }
      })();
// Event Modal Functions (global scope for onclick)
      let modalCountdownInterval = null;
      let currentLaunchData = null;

      function showEventModal(launchId) {
        // Find the launch data
        const launch = upcomingLaunches.find(l => l.id === launchId);
        if (!launch) {
          console.error('Launch not found:', launchId);
          return;
        }

        currentLaunchData = launch;

        // Update modal title
        document.getElementById('modal-title').textContent = launch.vehicle || 'Lanzamiento';

        // Update goal pill
        const launchDate = new Date(launch.datetimeISO);
        const dateStr = launchDate.toLocaleString('es-ES', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          timeZoneName: 'short'
        });
        document.getElementById('modal-goal').innerHTML = `
          <span class="goal-dot"></span>
          Ventana objetivo: ${dateStr}
        `;

        // Populate modal info
        let infoHTML = '';
        if (launch.vehicle) {
          infoHTML += `<div class="modal-info-row"><div class="modal-info-label">Vehículo</div><div class="modal-info-value">${launch.vehicle}</div></div>`;
        }
        if (launch.mission) {
          infoHTML += `<div class="modal-info-row"><div class="modal-info-label">Misión</div><div class="modal-info-value">${launch.mission}</div></div>`;
        }
        if (launch.site) {
          infoHTML += `<div class="modal-info-row"><div class="modal-info-label">Lugar</div><div class="modal-info-value">${launch.site}</div></div>`;
        }
        if (launch.vehicleFull) {
          infoHTML += `<div class="modal-info-row"><div class="modal-info-label">Vehículo Completo</div><div class="modal-info-value">${launch.vehicleFull}</div></div>`;
        }
        if (launch.payload) {
          infoHTML += `<div class="modal-info-row"><div class="modal-info-label">Carga útil</div><div class="modal-info-value">${launch.payload}</div></div>`;
        }
        if (launch.orbit) {
          infoHTML += `<div class="modal-info-row"><div class="modal-info-label">Órbita objetivo</div><div class="modal-info-value">${launch.orbit}</div></div>`;
        }
        document.getElementById('modal-info').innerHTML = infoHTML;

        // Description
        document.getElementById('modal-desc').textContent = launch.description || 'No hay descripción disponible.';

        // Stream link
        const watchBtn = document.getElementById('modal-watch');
        if (launch.streamUrl) {
          watchBtn.href = launch.streamUrl;
          watchBtn.style.display = 'inline-flex';
        } else {
          watchBtn.style.display = 'none';
        }

        // Start modal countdown
        const countdownEl = document.getElementById('modal-countdown');
        countdownEl.setAttribute('data-countdown-dt', launch.datetimeISO);

        function updateModalCountdown() {
          const target = new Date(launch.datetimeISO);
          const now = new Date();
          const diff = target - now;

          if (diff <= 0) {
            countdownEl.textContent = '¡LANZADO!';
            countdownEl.style.color = '#51cf66';
            if (modalCountdownInterval) {
              clearInterval(modalCountdownInterval);
            }
            return;
          }

          const totalSeconds = Math.floor(diff / 1000);
          const days = Math.floor(totalSeconds / 86400);
          const hours = Math.floor((totalSeconds % 86400) / 3600);
          const minutes = Math.floor((totalSeconds % 3600) / 60);
          const seconds = totalSeconds % 60;

          let timeStr = '';
          if (days > 0) {
            timeStr = `T- ${days}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
          } else if (hours > 0) {
            timeStr = `T- ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
          } else {
            timeStr = `T- ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
          }
          countdownEl.textContent = timeStr;
        }

        updateModalCountdown();
        if (modalCountdownInterval) {
          clearInterval(modalCountdownInterval);
        }
        modalCountdownInterval = setInterval(updateModalCountdown, 1000);

        // Show modal
        document.getElementById('event-modal-overlay').classList.add('show');
      }

      function closeEventModal() {
        document.getElementById('event-modal-overlay').classList.remove('show');
        if (modalCountdownInterval) {
          clearInterval(modalCountdownInterval);
          modalCountdownInterval = null;
        }
        currentLaunchData = null;
      }

      // Close modal on escape key
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && document.getElementById('event-modal-overlay').classList.contains('show')) {
          closeEventModal();
        }
      });

      // Close modal when clicking outside
      document.getElementById('event-modal-overlay')?.addEventListener('click', (e) => {
        if (e.target.id === 'event-modal-overlay') {
          closeEventModal();
        }
      });
// ===== CONFIGURACIÓN DE FIREBASE =====
    const firebaseConfig = {
      apiKey: "AIzaSyDKvGLsd1jKfsSlzgTjBas-8WvbFqV1xU",
      authDomain: "eszunspace-bc900.firebaseapp.com",
      databaseURL: "https://eszunspace-bc900-default-rtdb.europe-west1.firebasedatabase.app",
      projectId: "eszunspace-bc900",
      storageBucket: "eszunspace-bc900.firebasestorage.app",
      messagingSenderId: "105651684829",
      appId: "1:105651684829:web:5c8fd5051c8c2daf24f744",
      measurementId: "G-ZDM5GF0MBW"
    };

    firebase.initializeApp(firebaseConfig);
    const database = firebase.database();

    // ===== SHA-256 HASHING HELPER =====
    async function hashPassword(message) {
      const msgBuffer = new TextEncoder().encode(message);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return hashHex;
    }

    // ===== AUTH SYSTEM (RTDB) =====
    let currentUser = null;
    let allUsers = {};
    const SESSION_KEY = 'esz_user';
    const USERS_CACHE_KEY = 'esz_users_cache';

    // Load users from localStorage first (instant), then sync from Firebase
    function loadUsersFromCache() {
      try {
        const cached = localStorage.getItem(USERS_CACHE_KEY);
        if (cached) {
          allUsers = JSON.parse(cached);
          console.log("Usuarios cargados desde cache:", Object.keys(allUsers).length);
          return true;
        }
      } catch (e) {
        console.warn('Error loading users cache:', e);
      }
      return false;
    }

    async function loadUsers() {
      try {
        const snapshot = await database.ref('users').once('value');
        allUsers = snapshot.val() || {};
        // Save to cache for next time
        localStorage.setItem(USERS_CACHE_KEY, JSON.stringify(allUsers));
        console.log("Usuarios sincronizados desde Firebase:", Object.keys(allUsers).length);
      } catch (error) {
        console.error('Error al cargar usuarios:', error);
        // Keep cached users if Firebase fails
      }
    }

    function hydrateSessionFromStorage() {
      const saved = localStorage.getItem(SESSION_KEY);
      currentUser = (saved && saved.trim()) ? saved : null;
      checkAuth();
    }

    function checkAuth() {
      if (currentUser) {
        document.getElementById('login-btn').style.display = 'none';
        document.getElementById('user-display').style.display = 'flex';
        document.getElementById('user-name').textContent = currentUser;
        document.getElementById('user-avatar').textContent = currentUser.charAt(0).toUpperCase();
      } else {
        document.getElementById('login-btn').style.display = 'inline-flex';
        document.getElementById('user-display').style.display = 'none';
      }
    }

    // Keep multiple tabs/pages in sync
    window.addEventListener('storage', (e) => {
      if (e.key === SESSION_KEY) {
        hydrateSessionFromStorage();
      }
    });

    async function saveUser(username, password) {
      try {
        // Double check against DB to be sure
        const snapshot = await database.ref('users/' + username).once('value');
        if (snapshot.exists()) {
          return false; // Already exists
        }

        // Save password as plain text
        await database.ref('users/' + username).set(password);
        allUsers[username] = password;
        return true;
      } catch (error) {
        console.error('Error al guardar usuario:', error);
        return false;
      }
    }

    // ===== UI FUNCTIONS =====
    function showLoginModal() {
      showLoginForm();
      const modal = document.getElementById('auth-modal-overlay');
      modal.style.display = 'flex';
      requestAnimationFrame(() => {
        modal.classList.add('show');
      });
    }

    function closeAuthModal() {
      const modal = document.getElementById('auth-modal-overlay');
      modal.classList.remove('show');
      setTimeout(() => {
        modal.style.display = 'none';
      }, 300);
      document.getElementById('login-error').classList.remove('show');
      document.getElementById('register-error').classList.remove('show');
      document.getElementById('register-success').classList.remove('show');
    }

    function showLoginForm(e) {
      if (e) e.preventDefault();
      document.getElementById('auth-modal-title').textContent = 'Iniciar sesión';
      document.getElementById('login-form').style.display = 'flex';
      document.getElementById('register-form').style.display = 'none';
      document.getElementById('login-username').value = '';
      document.getElementById('login-password').value = '';
      document.getElementById('login-error').classList.remove('show');
    }

    function showRegisterForm(e) {
      if (e) e.preventDefault();
      document.getElementById('auth-modal-title').textContent = 'Crear cuenta';
      document.getElementById('login-form').style.display = 'none';
      document.getElementById('register-form').style.display = 'flex';
      document.getElementById('register-username').value = '';
      document.getElementById('register-password').value = '';
      document.getElementById('register-error').classList.remove('show');
      document.getElementById('register-success').classList.remove('show');
    }

    // ===== HANDLERS =====

    async function handleLogin(e) {
      e.preventDefault();
      const username = document.getElementById('login-username').value.trim();
      const password = document.getElementById('login-password').value;
      const errEl = document.getElementById('login-error');

      if (!allUsers[username]) {
        errEl.textContent = 'Usuario no encontrado';
        errEl.classList.add('show');
        return;
      }

      const storedPassword = allUsers[username];

      // Compare passwords directly
      if (storedPassword === password) {
        currentUser = username;
        localStorage.setItem(SESSION_KEY, currentUser);
        checkAuth();
        updatePresence(true); // Set online
        closeAuthModal();
      } else {
        errEl.textContent = 'Contraseña incorrecta';
        errEl.classList.add('show');
      }
    }

    async function handleRegister(e) {
      e.preventDefault();
      const username = document.getElementById('register-username').value.trim();
      const password = document.getElementById('register-password').value;

      document.getElementById('register-error').classList.remove('show');
      document.getElementById('register-success').classList.remove('show');

      if (allUsers[username]) {
        const err = document.getElementById('register-error');
        err.textContent = 'Este usuario ya existe';
        err.classList.add('show');
        return;
      }

      const success = await saveUser(username, password);

      if (success) {
        document.getElementById('register-success').classList.add('show');
        setTimeout(() => {
          currentUser = username;
          localStorage.setItem(SESSION_KEY, currentUser);
          checkAuth();
          closeAuthModal();
        }, 1500);
      } else {
        const err = document.getElementById('register-error');
        err.textContent = 'Error al crear cuenta. Intenta otro nombre.';
        err.classList.add('show');
      }
    }

    function logout() {
      updatePresence(false); // Set offline before logout
      currentUser = null;
      localStorage.removeItem(SESSION_KEY);
      checkAuth();
    }

    function getFirebaseErrorMessage(code) {
      return code;
    }

    // ===== PROFILE FUNCTIONS (Re-implemented for Custom Auth) =====
    function showProfileModal() {
      if (!currentUser) return;
      document.getElementById('profile-username').textContent = currentUser;
      document.getElementById('profile-avatar').textContent = currentUser.charAt(0).toUpperCase();
      document.getElementById('new-username').value = '';
      document.getElementById('current-password').value = '';
      document.getElementById('new-password').value = '';

      // Clear messages
      document.getElementById('username-change-error').classList.remove('show');
      document.getElementById('username-change-success').classList.remove('show');
      document.getElementById('password-change-error').classList.remove('show');
      document.getElementById('password-change-success').classList.remove('show');

      const modal = document.getElementById('profile-modal-overlay');
      modal.style.display = 'flex';
      requestAnimationFrame(() => {
        modal.classList.add('show');
      });
    }

    function closeProfileModal() {
      const modal = document.getElementById('profile-modal-overlay');
      modal.classList.remove('show');
      setTimeout(() => {
        modal.style.display = 'none';
      }, 300);
    }

    async function handleChangeUsername(e) {
      e.preventDefault();
      const newUsername = document.getElementById('new-username').value.trim();

      const err = document.getElementById('username-change-error');
      err.classList.remove('show');

      if (newUsername === currentUser) {
        err.textContent = 'El nombre es el mismo';
        err.classList.add('show');
        return;
      }

      if (allUsers[newUsername]) {
        err.textContent = 'Este usuario ya está en uso';
        err.classList.add('show');
        return;
      }

      try {
        const passwordHash = allUsers[currentUser];

        // Remove old
        await database.ref('users/' + currentUser).remove();
        delete allUsers[currentUser];

        // Add new
        await database.ref('users/' + newUsername).set(passwordHash);
        allUsers[newUsername] = passwordHash;

        // Update session
        currentUser = newUsername;
        localStorage.setItem(SESSION_KEY, currentUser);

        document.getElementById('username-change-success').classList.add('show');
        document.getElementById('profile-username').textContent = newUsername;
        document.getElementById('user-name').textContent = newUsername;

        setTimeout(() => {
          closeProfileModal();
        }, 1500);
      } catch (error) {
        console.error('Error al cambiar nombre:', error);
        err.textContent = 'Error al procesar la solicitud';
        err.classList.add('show');
      }
    }

    async function handleChangePassword(e) {
      e.preventDefault();
      const newPassword = document.getElementById('new-password').value;
      const hashedNew = await hashPassword(newPassword);

      try {
        await database.ref('users/' + currentUser).set(hashedNew);
        allUsers[currentUser] = hashedNew;

        document.getElementById('password-change-success').classList.add('show');
        document.getElementById('new-password').value = '';
        setTimeout(() => {
          document.getElementById('password-change-success').classList.remove('show');
        }, 3000);
      } catch (error) {
        console.error('Error al cambiar contraseña:', error);
        document.getElementById('password-change-error').textContent = 'Error al cambiar contraseña';
        document.getElementById('password-change-error').classList.add('show');
      }
    }

    async function deleteAccount() {
      if (!confirm('¿Estás seguro?')) return;

      try {
        await database.ref('users/' + currentUser).remove();
        delete allUsers[currentUser];
        logout();
        closeProfileModal();
        alert('Cuenta eliminada');
      } catch (error) {
        alert('Error al eliminar');
      }
    }

    // Modal de Actualizaciones
    const ADMIN_USER = 'Esstor';
    let updatesData = [];

    // ===== CONTACT CHAT SYSTEM =====
    let currentChatPartner = null;
    let chatUnsubscribe = null;
    let pendingAttachment = null; // Stores {base64, fileName, fileType, isImage}
    let typingTimeout = null;
    let presenceUnsubscribe = null;
    let typingUnsubscribe = null;
    let lastMessageCount = 0; // Track message count to detect new messages

    // Chat notification sound system
    const CHAT_MUTE_KEY = 'eszunspace_chat_muted';
    let isChatMuted = localStorage.getItem(CHAT_MUTE_KEY) === 'true';

    function initChatMuteState() {
      const btn = document.getElementById('chat-mute-btn');
      const iconOn = document.getElementById('mute-icon-on');
      const iconOff = document.getElementById('mute-icon-off');

      if (isChatMuted) {
        btn.classList.add('muted');
        btn.title = 'Activar notificaciones';
        iconOn.style.display = 'block';
        iconOff.style.display = 'none';
      } else {
        btn.classList.remove('muted');
        btn.title = 'Silenciar notificaciones';
        iconOn.style.display = 'none';
        iconOff.style.display = 'block';
      }
    }

    function toggleChatMute() {
      isChatMuted = !isChatMuted;
      localStorage.setItem(CHAT_MUTE_KEY, isChatMuted);
      initChatMuteState();
    }

    function playNotificationSound() {
      if (isChatMuted) return;

      // Create a simple beep using Web Audio API
      try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
      } catch (e) {
        console.log('Could not play notification sound:', e);
      }
    }

    // ===== PRESENCE SYSTEM =====
    function updatePresence(online) {
      if (!currentUser) return;
      const presenceRef = database.ref(`presence/${currentUser}`);
      presenceRef.set({
        online: online,
        lastSeen: Date.now()
      });
      // Set offline on disconnect
      if (online) {
        presenceRef.onDisconnect().set({
          online: false,
          lastSeen: Date.now()
        });
      }
    }

    function listenToPartnerPresence(partnerUsername) {
      // Unsubscribe from previous listener
      if (presenceUnsubscribe) {
        presenceUnsubscribe();
      }

      const presenceRef = database.ref(`presence/${partnerUsername}`);
      const listener = presenceRef.on('value', (snapshot) => {
        const data = snapshot.val();
        const statusDot = document.getElementById('chat-partner-status-dot');
        const statusText = document.getElementById('chat-partner-status-text');

        if (data && data.online) {
          statusDot.className = 'status-dot online';
          statusDot.title = 'Conectado';
          if (partnerUsername === ADMIN_USER) {
            statusText.textContent = 'En línea';
          } else {
            statusText.textContent = 'En línea';
          }
        } else {
          statusDot.className = 'status-dot offline';
          statusDot.title = 'Desconectado';
          if (data && data.lastSeen) {
            const lastSeen = new Date(data.lastSeen);
            const now = new Date();
            const diffMins = Math.floor((now - lastSeen) / 60000);
            if (diffMins < 60) {
              statusText.textContent = `Últ. vez hace ${diffMins}min`;
            } else {
              statusText.textContent = 'Desconectado';
            }
          } else {
            statusText.textContent = partnerUsername === ADMIN_USER ? 'Admin de EsZunSpace' : 'Usuario';
          }
        }
      });

      presenceUnsubscribe = () => presenceRef.off('value', listener);
    }

    // ===== TYPING INDICATOR =====
    function setTypingStatus(isTyping) {
      if (!currentUser || !currentChatPartner) return;
      const chatPath = currentUser === ADMIN_USER ? currentChatPartner : currentUser;
      database.ref(`typing/${chatPath}/${currentUser}`).set(isTyping ? true : null);
    }

    function listenToTypingStatus() {
      if (typingUnsubscribe) {
        typingUnsubscribe();
      }

      if (!currentChatPartner) return;

      const chatPath = currentUser === ADMIN_USER ? currentChatPartner : currentUser;
      const partnerUsername = currentUser === ADMIN_USER ? currentChatPartner : ADMIN_USER;
      const typingRef = database.ref(`typing/${chatPath}/${partnerUsername}`);

      const listener = typingRef.on('value', (snapshot) => {
        const isTyping = snapshot.val();
        const indicator = document.getElementById('typing-indicator');
        if (isTyping) {
          indicator.style.display = 'flex';
        } else {
          indicator.style.display = 'none';
        }
      });

      typingUnsubscribe = () => typingRef.off('value', listener);
    }

    function handleTyping() {
      setTypingStatus(true);

      // Clear previous timeout
      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }

      // Set typing to false after 2 seconds of no typing
      typingTimeout = setTimeout(() => {
        setTypingStatus(false);
      }, 2000);
    }

    // Clean up typing status when closing chat
    function cleanupTyping() {
      setTypingStatus(false);
      if (typingTimeout) {
        clearTimeout(typingTimeout);
        typingTimeout = null;
      }
      if (typingUnsubscribe) {
        typingUnsubscribe();
        typingUnsubscribe = null;
      }
      if (presenceUnsubscribe) {
        presenceUnsubscribe();
        presenceUnsubscribe = null;
      }
    }


    // File attachment functions
    function handleFileSelect(e) {
      const file = e.target.files[0];
      if (!file) return;

      // Validate file size (2MB max)
      const maxSize = 2 * 1024 * 1024; // 2MB
      if (file.size > maxSize) {
        alert('El archivo es demasiado grande. El tamaño máximo es 2MB.');
        e.target.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onloadend = function () {
        const base64 = reader.result;
        const isImage = file.type.startsWith('image/');

        pendingAttachment = {
          base64: base64,
          fileName: file.name,
          fileType: file.type,
          isImage: isImage
        };

        // Show preview
        const previewContainer = document.getElementById('chat-attachment-preview');
        const previewImg = document.getElementById('attachment-preview-img');
        const previewFile = document.getElementById('attachment-preview-file');
        const fileName = document.getElementById('attachment-file-name');

        if (isImage) {
          previewImg.src = base64;
          previewImg.style.display = 'block';
          previewFile.style.display = 'none';
        } else {
          previewImg.style.display = 'none';
          previewFile.style.display = 'flex';
          fileName.textContent = file.name;
        }

        previewContainer.style.display = 'flex';
      };
      reader.readAsDataURL(file);
    }

    function clearAttachment() {
      pendingAttachment = null;
      document.getElementById('chat-file-input').value = '';
      document.getElementById('chat-attachment-preview').style.display = 'none';
      document.getElementById('attachment-preview-img').src = '';
      document.getElementById('attachment-preview-img').style.display = 'none';
      document.getElementById('attachment-preview-file').style.display = 'none';
    }

    function renderAttachment(attachment) {
      if (!attachment) return '';

      if (attachment.isImage) {
        return `
          <div class="chat-message-attachment">
            <img src="${attachment.base64}" alt="${attachment.fileName}" onclick="openLightbox('${attachment.base64}', '${attachment.fileName}')">
          </div>
        `;
      } else {
        return `
          <div class="chat-message-attachment">
            <a href="${attachment.base64}" download="${attachment.fileName}" class="chat-message-file">
              <span class="file-icon">📄</span>
              <span>${attachment.fileName}</span>
              <span class="download-icon">⬇️</span>
            </a>
          </div>
        `;
      }
    }

    function openLightbox(imageSrc, fileName) {
      const lightbox = document.getElementById('image-lightbox');
      const img = document.getElementById('lightbox-image');
      const downloadBtn = document.getElementById('lightbox-download');

      img.src = imageSrc;
      downloadBtn.href = imageSrc;
      downloadBtn.download = fileName;

      lightbox.classList.add('show');
      document.body.style.overflow = 'hidden';
    }

    function closeLightbox() {
      document.getElementById('image-lightbox').classList.remove('show');
      document.body.style.overflow = '';
    }

    // Close lightbox on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && document.getElementById('image-lightbox').classList.contains('show')) {
        closeLightbox();
      }
    });

    function showContactModal() {
      const modal = document.getElementById('contact-modal');
      modal.classList.add('show');
      document.body.style.overflow = 'hidden';

      // Initialize mute button state and reset message counter
      initChatMuteState();
      lastMessageCount = 0;

      // Verificar si hay usuario logueado
      if (currentUser) {
        document.getElementById('contact-login-required').style.display = 'none';
        document.getElementById('contact-chat').style.display = 'flex';

        // Si es Esstor, mostrar lista de conversaciones
        if (currentUser === ADMIN_USER) {
          document.getElementById('chat-conversations').style.display = 'block';
          document.getElementById('chat-partner-info').style.display = 'none';
          document.getElementById('chat-messages-area').style.display = 'none'; // Ocultar hasta seleccionar chat
          document.getElementById('contact-chat').classList.add('conversations-only');
          currentChatPartner = null;
          loadConversations();
        } else {
          // Usuario normal: chat directo con Esstor
          document.getElementById('chat-conversations').style.display = 'none';
          document.getElementById('chat-partner-info').style.display = 'flex';
          document.getElementById('chat-messages-area').style.display = 'flex';
          document.getElementById('contact-chat').classList.remove('conversations-only');
          currentChatPartner = ADMIN_USER;
          loadChatMessages(currentUser, ADMIN_USER);

          // Start presence and typing listeners
          listenToPartnerPresence(ADMIN_USER);
          listenToTypingStatus();

          // Add typing detection to input
          const chatInput = document.getElementById('chat-input');
          chatInput.removeEventListener('input', handleTyping);
          chatInput.addEventListener('input', handleTyping);
        }
      } else {
        document.getElementById('contact-login-required').style.display = 'block';
        document.getElementById('contact-chat').style.display = 'none';
      }
    }

    function closeContactModal() {
      document.getElementById('contact-modal').classList.remove('show');
      document.body.style.overflow = '';
      if (chatUnsubscribe) {
        chatUnsubscribe();
        chatUnsubscribe = null;
      }
      cleanupTyping();
    }

    // Cargar lista de conversaciones para Esstor
    async function loadConversations() {
      const list = document.getElementById('conversations-list');
      list.innerHTML = '<div style="padding:20px; text-align:center; color:rgba(255,255,255,0.5);">Cargando conversaciones...</div>';

      try {
        const snapshot = await database.ref('chats').once('value');
        const chats = snapshot.val() || {};
        const conversationUsers = Object.keys(chats);

        if (conversationUsers.length === 0) {
          list.innerHTML = '<div style="padding:20px; text-align:center; color:rgba(255,255,255,0.5);">No hay conversaciones aún.</div>';
          return;
        }

        list.innerHTML = '';
        for (const username of conversationUsers) {
          const messagesSnap = await database.ref(`chats/${username}`).orderByChild('timestamp').once('value');
          let lastMessage = '';
          let lastTime = null;
          let hasUnread = false;
          let messageCount = 0;

          messagesSnap.forEach(msg => {
            const data = msg.val();
            lastMessage = data.text || '';
            lastTime = data.timestamp;
            messageCount++;
            if (data.from !== ADMIN_USER && !data.read) {
              hasUnread = true;
            }
          });

          const timeStr = lastTime ? new Date(lastTime).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

          const item = document.createElement('div');
          item.className = 'conversation-item' + (currentChatPartner === username ? ' active' : '');
          item.innerHTML = `
            <span class="conversation-avatar">${username.charAt(0).toUpperCase()}</span>
            <div class="conversation-info">
              <div class="conversation-name">${username}</div>
              <div class="conversation-preview">${lastMessage.substring(0, 25)}${lastMessage.length > 25 ? '...' : ''}</div>
              <div class="conversation-meta">${messageCount} mensaje${messageCount !== 1 ? 's' : ''} · ${timeStr}</div>
            </div>
            <div class="conversation-actions">
              ${hasUnread ? '<span class="conversation-unread"></span>' : ''}
              <button class="conversation-delete" onclick="event.stopPropagation(); deleteConversation('${username}')" title="Eliminar chat">🗑️</button>
            </div>
          `;
          item.onclick = () => selectConversation(username);
          list.appendChild(item);
        }
      } catch (error) {
        console.error('Error loading conversations:', error);
        list.innerHTML = '<div style="padding:20px; text-align:center; color:#ff6b6b;">Error al cargar conversaciones</div>';
      }
    }

    async function deleteConversation(username) {
      if (!confirm(`¿Eliminar la conversación con ${username}? Esta acción no se puede deshacer.`)) {
        return;
      }

      try {
        await database.ref(`chats/${username}`).remove();

        // Si era la conversación activa, limpiar la vista
        if (currentChatPartner === username) {
          currentChatPartner = null;
          document.getElementById('chat-messages').innerHTML = `
            <div class="chat-welcome">
              <p>Selecciona una conversación para ver los mensajes.</p>
            </div>
          `;
          document.getElementById('chat-partner-info').style.display = 'none';
          document.getElementById('chat-messages-area').style.display = 'none';
          document.getElementById('contact-chat').classList.add('conversations-only');
        }

        loadConversations();
      } catch (error) {
        console.error('Error deleting conversation:', error);
        alert('Error al eliminar la conversación');
      }
    }

    function selectConversation(username) {
      currentChatPartner = username;

      // Ocultar lista de conversaciones y mostrar chat
      document.getElementById('chat-conversations').style.display = 'none';
      document.getElementById('chat-partner-info').style.display = 'flex';
      document.getElementById('chat-messages-area').style.display = 'flex';
      document.getElementById('contact-chat').classList.remove('conversations-only');

      // Mostrar botón de volver solo para Esstor
      if (currentUser === ADMIN_USER) {
        document.getElementById('chat-back-btn').classList.add('show');
      }

      document.querySelector('.chat-partner-avatar').textContent = username.charAt(0).toUpperCase();
      document.querySelector('.chat-partner-name').textContent = username;

      loadChatMessages(username, ADMIN_USER);

      // Start presence and typing listeners
      listenToPartnerPresence(username);
      listenToTypingStatus();

      // Add typing detection to input
      const chatInput = document.getElementById('chat-input');
      chatInput.removeEventListener('input', handleTyping);
      chatInput.addEventListener('input', handleTyping);
    }

    function backToConversations() {
      // Ocultar chat y mostrar lista de conversaciones
      document.getElementById('chat-conversations').style.display = 'block';
      document.getElementById('chat-partner-info').style.display = 'none';
      document.getElementById('chat-messages-area').style.display = 'none';
      document.getElementById('contact-chat').classList.add('conversations-only');
      document.getElementById('chat-back-btn').classList.remove('show');

      // Desuscribir del chat actual
      if (chatUnsubscribe) {
        chatUnsubscribe();
        chatUnsubscribe = null;
      }

      currentChatPartner = null;
      loadConversations();
    }

    function loadChatMessages(username, partner) {
      const container = document.getElementById('chat-messages');
      container.innerHTML = '<div class="chat-welcome"><p>Cargando mensajes...</p></div>';

      // Desuscribir listener anterior
      if (chatUnsubscribe) {
        chatUnsubscribe();
      }

      // La ruta del chat es siempre por el nombre del usuario normal (no Esstor)
      const chatPath = currentUser === ADMIN_USER ? username : currentUser;

      // Use simple ref without orderByChild for faster loading (sort client-side)
      const ref = database.ref(`chats/${chatPath}`);

      const listener = ref.on('value', (snapshot) => {
        const messages = [];
        snapshot.forEach(child => {
          messages.push({ id: child.key, ...child.val() });
        });

        // Sort by timestamp client-side (faster than Firebase orderByChild without index)
        messages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

        // Check for new incoming messages to play notification
        if (messages.length > lastMessageCount && lastMessageCount > 0) {
          const lastMsg = messages[messages.length - 1];
          // Only play notification if message is from the OTHER user
          if (lastMsg && lastMsg.from !== currentUser) {
            playNotificationSound();
          }
        }
        lastMessageCount = messages.length;

        if (messages.length === 0) {
          container.innerHTML = `
            <div class="chat-welcome">
              <p>👋 ¡Hola! Escribe tu mensaje para contactar con ${currentUser === ADMIN_USER ? username : 'Esstor'}.</p>
              <p class="chat-hint">Puedes agendar misiones, hacer preguntas o solicitar información.</p>
            </div>
          `;
          return;
        }

        container.innerHTML = '';
        messages.forEach(msg => {
          const isSent = msg.from === currentUser;
          const msgEl = document.createElement('div');
          msgEl.className = `chat-message ${isSent ? 'sent' : 'received'}`;

          const time = new Date(msg.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

          // Render attachment if present
          let attachmentHtml = '';
          if (msg.attachment) {
            attachmentHtml = renderAttachment(msg.attachment);
          }

          msgEl.innerHTML = `
            ${msg.text ? `<div>${msg.text}</div>` : ''}
            ${attachmentHtml}
            <div class="chat-message-time">${time}</div>
          `;
          container.appendChild(msgEl);

          // Marcar como leído si es para el usuario actual
          if (!isSent && !msg.read) {
            database.ref(`chats/${chatPath}/${msg.id}`).update({ read: true });
          }
        });

        // Scroll to bottom
        container.scrollTop = container.scrollHeight;
      });

      chatUnsubscribe = () => ref.off('value', listener);
    }

    async function sendChatMessage(e) {
      e.preventDefault();
      const input = document.getElementById('chat-input');
      const text = input.value.trim();

      // Require either text or attachment
      if (!text && !pendingAttachment) return;
      if (!currentUser) return;

      // Determinar la ruta del chat
      const chatPath = currentUser === ADMIN_USER ? currentChatPartner : currentUser;

      if (!chatPath) {
        alert('Selecciona una conversación primero');
        return;
      }

      const message = {
        from: currentUser,
        to: currentUser === ADMIN_USER ? currentChatPartner : ADMIN_USER,
        text: text,
        timestamp: Date.now(),
        read: false
      };

      // Add attachment if present
      if (pendingAttachment) {
        message.attachment = {
          base64: pendingAttachment.base64,
          fileName: pendingAttachment.fileName,
          fileType: pendingAttachment.fileType,
          isImage: pendingAttachment.isImage
        };
      }

      try {
        await database.ref(`chats/${chatPath}`).push(message);
        input.value = '';

        // Clear attachment after sending
        clearAttachment();

        // Si Esstor está respondiendo, actualizar la lista de conversaciones
        if (currentUser === ADMIN_USER) {
          loadConversations();
        }
      } catch (error) {
        console.error('Error sending message:', error);
        alert('Error al enviar el mensaje');
      }
    }

    // Cerrar modal al hacer clic fuera
    document.getElementById('contact-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'contact-modal') {
        closeContactModal();
      }
    });

    function showUpdatesModal() {
      document.getElementById('updates-modal').classList.add('show');
      document.body.style.overflow = 'hidden';

      // Mostrar formulario de admin si es Esstor
      const adminForm = document.getElementById('update-admin-form');
      if (currentUser === ADMIN_USER) {
        adminForm.style.display = 'block';
      } else {
        adminForm.style.display = 'none';
      }

      loadUpdates();
    }

    function closeUpdatesModal() {
      document.getElementById('updates-modal').classList.remove('show');
      document.body.style.overflow = '';
    }

    async function loadUpdates() {
      const container = document.getElementById('updates-list');
      container.innerHTML = '<div class="loading">Cargando actualizaciones...</div>';

      try {
        const snapshot = await database.ref('updates').orderByChild('timestamp').once('value');
        updatesData = [];

        snapshot.forEach((child) => {
          updatesData.push({
            id: child.key,
            ...child.val()
          });
        });

        // Ordenar de más reciente a más antiguo
        updatesData.reverse();

        renderUpdates();
      } catch (error) {
        console.error('Error cargando actualizaciones:', error);
        container.innerHTML = '<div class="no-updates">Error al cargar actualizaciones</div>';
      }
    }

    function renderUpdates() {
      const container = document.getElementById('updates-list');
      const isAdmin = currentUser === ADMIN_USER;

      if (updatesData.length === 0) {
        container.innerHTML = '<div class="no-updates">No hay actualizaciones disponibles</div>';
        return;
      }

      const now = Date.now();
      const threeDays = 3 * 24 * 60 * 60 * 1000; // 3 días en ms

      container.innerHTML = updatesData.map((update, index) => {
        const isNew = (now - update.timestamp) < threeDays;
        const date = new Date(update.timestamp);
        const dateStr = date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase();

        // Truncar descripción en la lista
        const shortDesc = update.description.length > 150 ?
          update.description.substring(0, 150) + '...' : update.description;

        const imageHtml = update.imageUrl ?
          `<img src="${escapeHtml(update.imageUrl)}" alt="" class="update-image" loading="lazy">` : '';

        return `
          <div class="update-item ${isNew ? 'new' : ''}" onclick="openUpdateDetail(${index})" data-index="${index}">
            ${isNew ? '<div class="update-badge">NUEVO</div>' : ''}
            ${isAdmin ? `<button class="update-delete-btn" onclick="event.stopPropagation(); deleteUpdate('${update.id}')" title="Eliminar">🗑</button>` : ''}
            <div class="update-date">${dateStr}</div>
            <h3 class="update-name">${escapeHtml(update.title)}</h3>
            <p class="update-desc">${escapeHtml(shortDesc)}</p>
            ${imageHtml}
          </div>
        `;
      }).join('');
    }

    function openUpdateDetail(index) {
      const update = updatesData[index];
      if (!update) return;

      const date = new Date(update.timestamp);
      const dateStr = date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase();

      const imageHtml = update.imageUrl ?
        `<img src="${update.imageUrl}" alt="" class="detail-image">` : '';

      const linkHtml = update.linkUrl ?
        `<a href="${escapeHtml(update.linkUrl)}" class="detail-link-btn" target="_blank" rel="noopener">${escapeHtml(update.linkText || 'Ver más')}</a>` : '';

      const content = `
        ${imageHtml}
        <div class="detail-body">
          <div class="detail-date">${dateStr}</div>
          <h2 class="detail-title">${escapeHtml(update.title)}</h2>
          <p class="detail-description">${escapeHtml(update.description)}</p>
          ${linkHtml}
        </div>
      `;

      document.getElementById('update-detail-content').innerHTML = content;
      document.getElementById('update-detail-modal').classList.add('show');
    }

    function closeUpdateDetail() {
      document.getElementById('update-detail-modal').classList.remove('show');
    }

    // Cerrar modal de detalle con click fuera o Escape
    document.getElementById('update-detail-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'update-detail-modal') {
        closeUpdateDetail();
      }
    });

    function escapeHtml(text) {
      if (!text) return '';
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    async function createUpdate() {
      if (currentUser !== ADMIN_USER) {
        alert('No tienes permisos para crear actualizaciones');
        return;
      }

      const title = document.getElementById('update-title-input').value.trim();
      const description = document.getElementById('update-desc-input').value.trim();
      const imageBase64 = document.getElementById('update-image-base64').value;
      const linkUrl = document.getElementById('update-link-input').value.trim();
      const linkText = document.getElementById('update-link-text-input').value.trim();

      if (!title || !description) {
        alert('Por favor, completa el título y la descripción');
        return;
      }

      try {
        const newUpdate = {
          title: title,
          description: description,
          timestamp: Date.now(),
          author: ADMIN_USER
        };

        // Añadir campos opcionales solo si tienen valor
        if (imageBase64) newUpdate.imageUrl = imageBase64;
        if (linkUrl) {
          newUpdate.linkUrl = linkUrl;
          newUpdate.linkText = linkText || 'Ver más';
        }

        await database.ref('updates').push(newUpdate);

        // Limpiar formulario
        document.getElementById('update-title-input').value = '';
        document.getElementById('update-desc-input').value = '';
        document.getElementById('update-image-file').value = '';
        document.getElementById('update-image-base64').value = '';
        document.getElementById('update-image-preview').style.display = 'none';
        document.getElementById('update-link-input').value = '';
        document.getElementById('update-link-text-input').value = 'Ver más';

        // Recargar lista
        loadUpdates();
      } catch (error) {
        console.error('Error creando actualización:', error);
        alert('Error al crear la actualización');
      }
    }

    async function deleteUpdate(updateId) {
      if (currentUser !== ADMIN_USER) {
        alert('No tienes permisos para eliminar actualizaciones');
        return;
      }

      if (!confirm('¿Estás seguro de que quieres eliminar esta actualización?')) {
        return;
      }

      try {
        await database.ref('updates/' + updateId).remove();
        loadUpdates();
      } catch (error) {
        console.error('Error eliminando actualización:', error);
        alert('Error al eliminar la actualización');
      }
    }

    // Cerrar modal con Escape o click fuera
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeUpdateDetail();
        closeUpdatesModal();
      }
    });

    document.getElementById('updates-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'updates-modal') {
        closeUpdatesModal();
      }
    });

    document.addEventListener("DOMContentLoaded", () => {
      document.body.classList.add("fade-in");
      document.getElementById("year").textContent = new Date().getFullYear();

      // INITIALIZE CUSTOM AUTH - Load from cache first (instant), then sync from Firebase in background
      loadUsersFromCache();
      hydrateSessionFromStorage();

      // Set user as online if logged in
      if (currentUser) {
        updatePresence(true);
      }

      // Sync users from Firebase in background (non-blocking)
      loadUsers();

      // Image upload handler for updates
      const updateImageInput = document.getElementById('update-image-file');
      if (updateImageInput) {
        updateImageInput.addEventListener('change', function (e) {
          const file = e.target.files[0];
          if (!file) return;

          if (file.size > 2 * 1024 * 1024) { // 2MB limit
            alert('La imagen es muy grande. Se recomienda menos de 2MB.');
          }

          const reader = new FileReader();
          reader.onloadend = function () {
            const base64 = reader.result;
            document.getElementById('update-image-base64').value = base64;
            const preview = document.getElementById('update-image-preview');
            preview.style.backgroundImage = `url('${base64}')`;
            preview.style.display = 'block';
          };
          reader.readAsDataURL(file);
        });
      }

      const path = location.pathname.split("/").pop() || "index.html";
      document.querySelectorAll(".menu a").forEach(a => {
        const href = a.getAttribute("href");
        if ((path === "" && href === "index.html") || href === path) {
          a.setAttribute("aria-current", "page");
        }
      });

      // Transición suave entre páginas internas
      document.querySelectorAll('a[href]').forEach(link => {
        const url = new URL(link.href, location.href);
        if (url.origin === location.origin && !link.target) {
          link.addEventListener("click", e => {
            if (url.pathname === location.pathname && url.hash) return;
            const menu = document.querySelector('.menu');
            if (menu && menu.classList.contains('open')) return;
            e.preventDefault();
            document.body.classList.add("fade-out");
            setTimeout(() => location.href = url.href, 600);
          });
        }
      });

      // Toggle del menú en móvil
      const toggle = document.querySelector('.menu-toggle');
      const menu = document.getElementById('primary-menu');
      function setOpen(open) {
        menu.classList.toggle('open', open);
        toggle.setAttribute('aria-expanded', String(open));
        toggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
      }
      toggle.addEventListener('click', () => setOpen(!menu.classList.contains('open')));
      menu.addEventListener('click', (e) => {
        if (e.target.closest('a')) setOpen(false);
      });
      document.addEventListener('click', (e) => {
        if (menu.classList.contains('open')) {
          const within = e.target.closest('.nav-shell');
          if (!within) setOpen(false);
        }
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') setOpen(false);
      });

      // Keyboard support for user-info
      document.querySelector('.user-info')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          showProfileModal();
        }
      });

      // Set offline when leaving page
      window.addEventListener('beforeunload', () => {
        if (currentUser) {
          updatePresence(false);
        }
      });
    });
