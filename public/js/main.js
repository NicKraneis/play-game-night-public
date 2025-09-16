// ========================================
// Socket.IO Connection Setup
// ========================================
const socket = io();
let isGamemaster = false;
let currentRoomCode = null;
let playerName = "";
let timerInterval = null;
let currentAvatarId = 1;
let soundEnabled = true;
let deviceId;

// ========================================
// Device ID Management
// ========================================
function getOrCreateDeviceId() {
  let id = localStorage.getItem("deviceId");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("deviceId", id);
  }
  return id;
}

deviceId = getOrCreateDeviceId();

// ========================================
// Game Interface Management
// ========================================
function showGameInterface(roomCode, asGamemaster) {
  currentRoomCode = roomCode;
  const roomCodeElement = document.getElementById("current-room");
  const toggleButton = document.getElementById("room-code-toggle");
  
  // Store the actual room code but display it as hidden initially
  roomCodeElement.dataset.actualCode = roomCode;
  roomCodeElement.textContent = "Click to copy";
  
  // Set initial state for toggle button
  toggleButton.innerHTML = "👁️";
  toggleButton.dataset.visible = "false";

  // Room code click-to-copy functionality (still copies the real code)
  roomCodeElement.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      const originalText = roomCodeElement.textContent;
      roomCodeElement.textContent = "Copied!";
      setTimeout(() => {
        // Restore either the hidden or visible state
        const isVisible = toggleButton.dataset.visible === "true";
        roomCodeElement.textContent = isVisible ? roomCode : "Click to copy";
      }, 1000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  });

  // Toggle visibility functionality
  toggleButton.addEventListener("click", () => {
    const isCurrentlyVisible = toggleButton.dataset.visible === "true";
    
    if (isCurrentlyVisible) {
      // Hide the code
      roomCodeElement.textContent = "Click to copy";
      toggleButton.innerHTML = "👁️";
      toggleButton.dataset.visible = "false";
    } else {
      // Show the code
      roomCodeElement.textContent = roomCode;
      toggleButton.innerHTML = "🙈";
      toggleButton.dataset.visible = "true";
    }
  });

  // Show/hide appropriate sections
  document.getElementById("start-section").style.display = "none";
  document.getElementById("game-section").style.display = "grid";

  isGamemaster = asGamemaster;

  // Toggle visibility based on role
  document.getElementById("gamemaster-section").style.display = isGamemaster
    ? "grid"
    : "none";
  document.getElementById("player-section").style.display = isGamemaster
    ? "none"
    : "block";
  document.getElementById("player-note-section").style.display = isGamemaster
    ? "none"
    : "flex";
  document.getElementById("showmaster-notes").style.display = isGamemaster
    ? "block"
    : "none";

  const generatorControls = document.getElementById(
    "random-generator-controls"
  );
  if (generatorControls) {
    generatorControls.style.display = isGamemaster ? "grid" : "none";
  }
}

function showRejoinButton(rejoinInfo) {
    const createRoomActions = document.querySelector('.create-room-actions');
    if (!createRoomActions) return;

    const rejoinButton = document.createElement('button');
    rejoinButton.id = 'rejoin-room';
    rejoinButton.className = 'log-button'; // Reuse existing styles
    rejoinButton.textContent = 'Rejoin last';

    rejoinButton.addEventListener('click', () => {
        // Pre-fill name and trigger the rejoin logic on the server
        document.getElementById('player-name').value = rejoinInfo.playerName || 'Showmaster';
        playerName = rejoinInfo.playerName || 'Showmaster';
        socket.emit("create-room", {
            playerName: playerName,
            avatarId: currentAvatarId, // This will be the currently selected avatar
            deviceId: deviceId,
            forceCreate: false // Explicitly state we are not forcing a new room
        });
        isGamemaster = true;
    });

    // Add the button below the create button
    createRoomActions.appendChild(rejoinButton);
}
// ========================================
// Player Settings Modal Functions
// ========================================
let currentSelectedPlayer = null;
let activeSubmenu = null;

// Submenu Management
function togglePlayerSubmenu(player, buttonElement) {
  // Close any existing submenu
  closeAllSubmenus();
  
  // If clicking the same button, just close
  if (activeSubmenu === buttonElement) {
    activeSubmenu = null;
    return;
  }
  
  // Create and show submenu
  const submenu = createPlayerSubmenu(player);
  buttonElement.appendChild(submenu);
  submenu.classList.add('active');
  activeSubmenu = buttonElement;
  
  // Close submenu when clicking outside
  setTimeout(() => {
    document.addEventListener('click', closeSubmenuOnOutsideClick);
  }, 0);
}

function createPlayerSubmenu(player) {
  const submenu = document.createElement('div');
  submenu.className = 'settings-submenu';
  submenu.innerHTML = `
    <div class="submenu-item" data-action="points">
      <span class="submenu-item-icon">🎯</span>
      <span>Points</span>
    </div>
    <div class="submenu-item" data-action="settings">
      <span class="submenu-item-icon">⚙️</span>
      <span>Settings</span>
    </div>
  `;
  
  // Add event listeners to submenu items
  submenu.querySelectorAll('.submenu-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = e.currentTarget.dataset.action;
      handleSubmenuAction(action, player);
      closeAllSubmenus();
    });
  });
  
  return submenu;
}

function handleSubmenuAction(action, player) {
  switch(action) {
    case 'points':
      openPlayerPointsModal(player);
      break;
    case 'settings':
      // More settings can be added later
      alert('More settings to come');
      break;
  }
}

function closeSubmenuOnOutsideClick(e) {
  if (activeSubmenu && !activeSubmenu.contains(e.target)) {
    closeAllSubmenus();
  }
}

function closeAllSubmenus() {
  const openSubmenus = document.querySelectorAll('.settings-submenu');
  openSubmenus.forEach(submenu => {
    submenu.remove();
  });
  activeSubmenu = null;
  document.removeEventListener('click', closeSubmenuOnOutsideClick);
}

// Points Modal Functions
function openPlayerPointsModal(player) {
  currentSelectedPlayer = player;
  const overlay = document.getElementById('modal-overlay');
  
  // Update modal content
  document.getElementById('modal-player-name').textContent = player.name;
  document.getElementById('modal-player-points').textContent = `${player.points} Points`;
  document.getElementById('modal-player-avatar').src = `/assets/img/avatar_${player.avatarId}.png`;
  
  // Show modal
  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closePlayerPointsModal() {
  const overlay = document.getElementById('modal-overlay');
  overlay.classList.remove('active');
  document.body.style.overflow = '';
  currentSelectedPlayer = null;
}

function applyPointChange(points) {
  if (currentSelectedPlayer && isGamemaster) {
    updatePoints(currentSelectedPlayer.id, points);
    
    // Optimistically update the UI
    const newPoints = currentSelectedPlayer.points + points;
    currentSelectedPlayer.points = newPoints;
    document.getElementById('modal-player-points').textContent = `${newPoints} Points`;
    
  }
}

function applyCustomPointChange(action) {
    const input = document.getElementById('custom-points-input');
    const points = parseInt(input.value);

    if (isNaN(points) || points === 0) {
        input.style.borderColor = 'red';
        setTimeout(() => { 
            input.style.borderColor = '';
        }, 1000);
        return;
    }

    const pointsToApply = action === 'subtract' ? -points : points;
    applyPointChange(pointsToApply);
    input.value = '';
    input.focus();
}

function resetPlayerPoints() {
  if (currentSelectedPlayer && isGamemaster) {
    const currentPoints = currentSelectedPlayer.points;
    // To reset, we subtract the current points
    updatePoints(currentSelectedPlayer.id, -currentPoints);
    closePlayerPointsModal();
  }
}

function createPlayerPointsModal() {
  const modalHTML = `
    <div id="modal-overlay" class="modal-overlay">
      <div class="player-settings-modal">
        <div class="modal-header">
          <h3 class="modal-title">Manage points</h3>
          <button class="close-button" type="button">&times;</button>
        </div>
        
        <div class="player-info">
          <img id="modal-player-avatar" class="modal-player-avatar" src="" alt="Player Avatar">
          <div class="player-info-text">
            <h4 id="modal-player-name">Player Name</h4>
            <p id="modal-player-points">0 Points</p>
          </div>
        </div>
        
        <div class="points-section">
          <div class="section-title">Add and remove</div>
          
          <div class="points-grid">
            <button class="point-btn negative" type="button" data-points="-1">-1</button>
            <button class="point-btn positive" type="button" data-points="1">+1</button>
            <button class="point-btn negative" type="button" data-points="-10">-10</button>
            <button class="point-btn positive" type="button" data-points="10">+10</button>
            <button class="point-btn negative" type="button" data-points="-50">-50</button>
            <button class="point-btn positive" type="button" data-points="50">+50</button>
            <button class="point-btn negative" type="button" data-points="-100">-100</button>
            <button class="point-btn positive" type="button" data-points="100">+100</button>
          </div>
          
          <div class="custom-points">
            <button class="custom-point-btn subtract" type="button" data-action="subtract">-</button>
            <input type="number" id="custom-points-input" class="custom-input" placeholder="Custom">
            <button class="custom-point-btn add" type="button" data-action="add">+</button>
          </div>
        </div>
        
        <div class="actions-section">
          <button class="action-btn danger" type="button" id="reset-points-btn">
            🔄 Reset points to 0
          </button>
        </div>
      </div>
    </div>
  `;
  
  // Add modal to body if it doesn't exist
  if (!document.getElementById('modal-overlay')) {
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Add event listeners after creating modal
    setupModalEventListeners();
  }
}

function setupModalEventListeners() {
  const overlay = document.getElementById('modal-overlay');
  const closeBtn = overlay.querySelector('.close-button');
  const pointBtns = overlay.querySelectorAll('.point-btn');
  const customPointBtns = overlay.querySelectorAll('.custom-point-btn');
  const resetBtn = overlay.querySelector('#reset-points-btn');
  const customInput = overlay.querySelector('#custom-points-input');
  
  // Close button
  closeBtn.addEventListener('click', closePlayerPointsModal);
  
  // Point buttons
  pointBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const points = parseInt(btn.dataset.points);
      applyPointChange(points);
    });
  });
  
  // Custom points +/- buttons
  customPointBtns.forEach(btn => {
      btn.addEventListener('click', () => {
          const action = btn.dataset.action;
          applyCustomPointChange(action);
      });
  });

  // Reset button
  resetBtn.addEventListener('click', resetPlayerPoints);
  
  // Custom input enter key
  customInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      applyCustomPointChange('add'); // Default to adding on Enter
    }
  });
  
  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closePlayerPointsModal();
    }
  });
  
  // Close on escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('active')) {
      closePlayerPointsModal();
    }
  });
}


// ========================================
// Note Update Functions
// ========================================
// Player Note Update
function updatePlayerNote(text) {
  if (!isGamemaster) {
    socket.emit("update-note", {
      roomCode: currentRoomCode,
      text: text,
      playerName: playerName,
    });
  }
}

// Gamemaster Note Update
function updateGamemasterNote(text) {
  if (isGamemaster) {
    console.log("Sending gamemaster note:", text);
    socket.emit("update-gamemaster-note", {
      roomCode: currentRoomCode,
      text: text,
    });
  }
}

// Points Update
function updatePoints(playerId, points) {
  if (isGamemaster) {
    socket.emit("update-points", {
      roomCode: currentRoomCode,
      playerId,
      points,
    });
  }
}



// ========================================
// Sound Functions
// ========================================
function playBuzzerSound() {
  if (!soundEnabled) return;
  const buzzerSound = document.getElementById("buzzer-sound");
  if (buzzerSound) {
    buzzerSound.currentTime = 0;
    buzzerSound.play();
  }
}

function playCountdownSound() {
  if (!soundEnabled) return;
  const countdownSound = document.getElementById("countdown-sound");
  if (countdownSound) {
    countdownSound.currentTime = 0;
    countdownSound.play();
  }
}

// ========================================
// Timer Functions
// ========================================
function updateTimerDisplay(seconds) {
  const masterDisplay = document.getElementById("timer-display-master");
  const playerDisplay = document.getElementById("timer-display-player");
  const playerNote = document.getElementById("player-note");

  // Play countdown sound at 3 seconds
  if (seconds === 3) {
    playCountdownSound();
  }

  // Update timer display with appropriate styling
  const timerClass =
    seconds <= 5 && seconds > 0 ? "timer-time ending" : "timer-time";
  const timerHTML = `<div class="${timerClass}">${seconds}s</div>`;

  if (isGamemaster && masterDisplay) {
    masterDisplay.innerHTML = timerHTML;
  }
  if (!isGamemaster && playerDisplay) {
    playerDisplay.innerHTML = timerHTML;
  }

  // Handle timer completion
  if (seconds === 0) {
    const endMessage = '<div class="timer-time">Time\'s up!</div>';
    if (masterDisplay) masterDisplay.innerHTML = endMessage;
    if (playerDisplay) playerDisplay.innerHTML = endMessage;

    // Lock player note
    if (playerNote) {
      playerNote.disabled = true;
      playerNote.classList.add("locked");
    }

    // Lock all player notes for gamemaster view
    if (isGamemaster) {
      const playerNotes = document.querySelectorAll(
        ".player-note-container textarea"
      );
      playerNotes.forEach((textarea) => {
        textarea.classList.add("locked");
      });
    }
  }
}



// ========================================
// Event Listeners Setup
// ========================================
document.addEventListener("DOMContentLoaded", () => {
  createPlayerPointsModal();

  // Check for gamemaster rejoin info on page load
  const rejoinInfoJSON = localStorage.getItem('gamemasterRejoinInfo');
  if (rejoinInfoJSON) {
      const rejoinInfo = JSON.parse(rejoinInfoJSON);
      // We only need to check if the item exists. The server will validate the rest.
      if (rejoinInfo.deviceId === deviceId) {
          showRejoinButton(rejoinInfo);
      } else {
          // Clean up if deviceId doesn't match (e.g., user cleared cache but not this item)
          localStorage.removeItem('gamemasterRejoinInfo');
      }
  }

  // Sound Toggle Setup
  const soundToggle = document.getElementById("toggle-sound");
  if (soundToggle) {
    soundToggle.addEventListener("click", () => {
      soundEnabled = !soundEnabled;
      const icon = soundToggle.querySelector(".sound-icon");
      const srText = soundToggle.querySelector(".visually-hidden");
      icon.textContent = soundEnabled ? "🔊" : "🔈";
      srText.textContent = soundEnabled ? "Sound is on" : "Sound is off";
      soundToggle.setAttribute("aria-checked", soundEnabled);
    });
  }

  // Gamemaster Note Setup
  const gamemasterNote = document.getElementById("gamemaster-note");
  if (gamemasterNote) {
    gamemasterNote.addEventListener("input", (e) => {
      updateGamemasterNote(e.target.value);
    });
  }

  // Room Creation Setup
  document.getElementById("create-room").addEventListener("click", () => {
    playerName = document.getElementById("player-name").value || "Showmaster";
    const rejoinInfoJSON = localStorage.getItem('gamemasterRejoinInfo');

    socket.emit("create-room", {
      playerName: playerName,
      avatarId: currentAvatarId,
      deviceId: deviceId,
       // If rejoin info exists, this is a "force create" action
      forceCreate: !!rejoinInfoJSON
    });
    isGamemaster = true;
  });

  // Room Join Setup
  document.getElementById("join-room").addEventListener("click", () => {
    const inputName = document.getElementById("player-name").value;
    currentRoomCode = document
      .getElementById("room-code")
      .value.toUpperCase()
      .replace(/\s/g, "");
    playerName = inputName;
    socket.emit("join-room", {
      roomCode: currentRoomCode,
      playerName: inputName,
      avatarId: currentAvatarId,
      deviceId: deviceId,
    });
    isGamemaster = false;
  });

  // Buzzer Setup
  document.getElementById("buzzer").addEventListener("click", () => {
    console.log("Buzzer clicked, sending to room:", currentRoomCode);
    socket.emit("press-buzzer", {
      roomCode: currentRoomCode,
      playerName: playerName,
    });
  });

  // Buzzer Control Setup
  document.getElementById("release-buzzers").addEventListener("click", () => {
    socket.emit("release-buzzers", { roomCode: currentRoomCode });
  });

  document.getElementById("lock-buzzers").addEventListener("click", () => {
    socket.emit("lock-buzzers", { roomCode: currentRoomCode });
  });

  // Player Note Setup
  const playerNote = document.getElementById("player-note");
  if (playerNote) {
    playerNote.addEventListener("input", (e) => {
      console.log("Note changed, sending to room:", currentRoomCode);
      if (!isGamemaster) {
        socket.emit("update-note", {
          roomCode: currentRoomCode,
          text: e.target.value,
          playerName: playerName,
        });
      }
    });
  }
  
  // Player Note Clear Button
  const clearNoteBtn = document.getElementById("clear-note");
  if (clearNoteBtn) {
      clearNoteBtn.addEventListener("click", () => {
          const noteField = document.getElementById("player-note");
          if (noteField && !noteField.disabled) {
              noteField.value = "";
              // Trigger the input event to send the update to the server
              noteField.dispatchEvent(new Event('input', { bubbles: true }));
          }
      });
  }


  // Timer Interface Setup
  const originalShowGameInterface = showGameInterface;
  showGameInterface = function (roomCode, asGamemaster) {
    originalShowGameInterface(roomCode, asGamemaster);
    setupTimerControls();
  };

  // Timer Controls Setup
  function setupTimerControls() {
    const timerControls = document.getElementById("timer-controls");
    if (isGamemaster && timerControls) {
      timerControls.innerHTML = `
        <button class="timer-btn" data-duration="10">10s</button>
        <button class="timer-btn" data-duration="30">30s</button>
        <button class="timer-btn" data-duration="60">60s</button>
        <button class="timer-reset">Reset</button>
      `;

      timerControls.querySelectorAll(".timer-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          const duration = parseInt(btn.dataset.duration);
          socket.emit("start-timer", {
            roomCode: currentRoomCode,
            duration: duration,
          });
        });
      });

      const resetBtn = timerControls.querySelector(".timer-reset");
      resetBtn.addEventListener("click", () => {
        socket.emit("reset-timer", { roomCode: currentRoomCode });
      });
    }
  }

  // Spacebar Buzzer Setup
  document.addEventListener("keydown", (event) => {
    if (
      event.code === "Space" &&
      !isGamemaster &&
      !event.target.matches("input, textarea")
    ) {
      const buzzer = document.getElementById("buzzer");
      if (!buzzer.disabled) {
        socket.emit("press-buzzer", {
          roomCode: currentRoomCode,
          playerName: playerName,
        });
      }
      event.preventDefault();
    }
  });

  // Avatar Carousel Setup
  const prevBtn = document.querySelector(".prev");
  const nextBtn = document.querySelector(".next");
  const avatarImg = document.getElementById("selected-avatar");

  function updateAvatar(id) {
    currentAvatarId = id;
    avatarImg.src = `/assets/img/avatar_${id}.png`;
    avatarImg.dataset.avatarId = id;
  }

  prevBtn.addEventListener("click", () => {
    let newId = currentAvatarId - 1;
    if (newId < 1) newId = 20;
    updateAvatar(newId);
  });

  nextBtn.addEventListener("click", () => {
    let newId = currentAvatarId + 1;
    if (newId > 20) newId = 1;
    updateAvatar(newId);
  });

  // Random Number Generator Setup
  const rollButton = document.getElementById("roll-button");
  if (rollButton) {
    rollButton.addEventListener("click", () => {
      if (isGamemaster) {
        // FIX START: Correctly parse numbers, allowing 0 as a valid input.
        let min = parseInt(document.getElementById("min-number").value);
        let max = parseInt(document.getElementById("max-number").value);

        if (isNaN(min)) {
            min = 0;
        }
        if (isNaN(max)) {
            max = 100;
        }
        // FIX END

        console.log("Sending generate request:", { min, max });
        if (min > max) {
          alert("Minimum must be less than maximum");
          return;
        }

        socket.emit("generate-number", {
          roomCode: currentRoomCode,
          min: min,
          max: max,
        });
      }
    });
  }

  // Answer Lock Controls Setup
  const lockAnswerBtn = document.getElementById("lock-answer");
  if (lockAnswerBtn) {
    lockAnswerBtn.addEventListener("click", () => {
      console.log("Locking answer for room:", currentRoomCode);
      socket.emit("lock-player-answer", {
        roomCode: currentRoomCode,
      });
    });
  }

  const lockAllBtn = document.getElementById("lock-all-answers");
  const unlockAllBtn = document.getElementById("unlock-all-answers");
  const clearAllNotesBtn = document.getElementById("clear-all-notes");

  if (lockAllBtn) {
    lockAllBtn.addEventListener("click", () => {
      socket.emit("lock-all-answers", { roomCode: currentRoomCode });
    });
  }

  if (unlockAllBtn) {
    unlockAllBtn.addEventListener("click", () => {
      socket.emit("unlock-all-answers", { roomCode: currentRoomCode });
    });
  }
  
  if (clearAllNotesBtn) {
    clearAllNotesBtn.addEventListener("click", () => {
      socket.emit("clear-all-notes", { roomCode: currentRoomCode });
    });
  }

  // Page Leave Warning
  window.addEventListener("beforeunload", (event) => {
    if (isGamemaster && currentRoomCode) {
        const gamemasterInfo = {
            playerName: playerName,
            deviceId: deviceId,
        };
        localStorage.setItem('gamemasterRejoinInfo', JSON.stringify(gamemasterInfo));
    }

    if (currentRoomCode) {
        event.preventDefault();
        event.returnValue = "Do you really want to leave the room?";
        return event.returnValue;
    }
  });
});

// ========================================
// Socket Event Handlers
// ========================================
socket.on("room-created", (data) => {
  localStorage.removeItem('gamemasterRejoinInfo');
  const rejoinButton = document.getElementById('rejoin-room');
  if (rejoinButton) {
      rejoinButton.remove();
  }

  showGameInterface(data.roomCode, true);

  const leaderboard = document.getElementById("leaderboard");
  leaderboard.innerHTML = "<h3>Leaderboard</h3>";
  
  // Set initial buzzer status for gamemaster
  const buzzerStatus = document.getElementById("current-buzzer");
  if (buzzerStatus) {
    buzzerStatus.innerHTML = "<div>Buzzers unlocked</div>";
    buzzerStatus.classList.add("buzzer-free");
  }

  const noPlayersDiv = document.createElement("div");
  noPlayersDiv.className = "waiting-message";
  noPlayersDiv.textContent =
    "Waiting for players. Share the room code to invite friends!";
  leaderboard.appendChild(noPlayersDiv);
});

socket.on("join-success", (data) => {
  localStorage.removeItem('gamemasterRejoinInfo');
  showGameInterface(data.roomCode, false);
  
  // Set initial buzzer state for player
  const buzzer = document.getElementById("buzzer");
  if (buzzer) {
    buzzer.disabled = false;
    buzzer.classList.remove("buzzer-winner", "buzzer-disabled");
    buzzer.classList.add("buzzer-active");
  }
});

socket.on("player-list-update", (players) => {
  const leaderboard = document.getElementById("leaderboard");
  leaderboard.innerHTML = "<h3>Leaderboard</h3>";

  const sortedPlayers = Object.values(players)
    .filter((player) => !player.isHost)
    .sort((a, b) => b.points - a.points);

  sortedPlayers.forEach((player, index) => {
    const playerDiv = document.createElement("div");
    playerDiv.className = `leaderboard-item ${
      index < 3 ? "rank-" + (index + 1) : ""
    }`;
    playerDiv.dataset.playerId = player.id; // Add player ID for easy selection

    playerDiv.innerHTML = `
      <div class="rank">#${index + 1}</div>
      <img class="player-avatar" src="/assets/img/avatar_${
        player.avatarId
      }.png" alt="Avatar">
      <div class="player-name">${player.name}</div>
      <div class="player-points">${player.points} Points</div>
      ${
        isGamemaster
          ? `<button class="settings-button" type="button">⚙️</button>`
          : ""
      }
    `;

    // Add event listener for settings button
    if (isGamemaster) {
      const settingsBtn = playerDiv.querySelector('.settings-button');
      settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        togglePlayerSubmenu(player, settingsBtn);
      });
    }

    leaderboard.appendChild(playerDiv);
  });

  if (sortedPlayers.length === 0) {
    const noPlayersDiv = document.createElement("div");
    noPlayersDiv.className = "waiting-message";
    noPlayersDiv.textContent =
      "Waiting for players. Share the room code to invite friends!";
    leaderboard.appendChild(noPlayersDiv);
  }
});

socket.on("buzzer-pressed", (data) => {
  // Play buzzer sound
  playBuzzerSound();

  // --- Highlight winner on leaderboard ---
  // First, remove any existing highlight
  const previouslyHighlighted = document.querySelector('.leaderboard-item.buzzer-winner-highlight');
  if (previouslyHighlighted) {
      previouslyHighlighted.classList.remove('buzzer-winner-highlight');
  }

  // Then, add highlight to the new winner
  const winnerItem = document.querySelector(`.leaderboard-item[data-player-id="${data.playerId}"]`);
  if (winnerItem) {
      winnerItem.classList.add('buzzer-winner-highlight');
  }
  // --- End of highlight logic ---

  if (isGamemaster) {
    const buzzerStatus = document.getElementById("current-buzzer");
    buzzerStatus.innerHTML = `
      <div class="buzzer-pressed">
        ${data.playerName} has pressed the buzzer!
        <div class="buzzer-timestamp">${new Date().toLocaleTimeString()}</div>
      </div>
    `;
    buzzerStatus.classList.remove("buzzer-free");
  } else {
    const buzzer = document.getElementById("buzzer");
    buzzer.disabled = true;

    if (data.playerId === socket.id) {
      buzzer.classList.remove("buzzer-active");
      buzzer.classList.add("buzzer-winner");
      buzzer.textContent = "BUZZED";
    } else {
      buzzer.classList.remove("buzzer-active");
      buzzer.classList.add("buzzer-disabled");
    }
  }
});

socket.on("buzzers-released", () => {
    // --- Remove highlight from leaderboard ---
    const highlightedItem = document.querySelector('.leaderboard-item.buzzer-winner-highlight');
    if (highlightedItem) {
        highlightedItem.classList.remove('buzzer-winner-highlight');
    }
    // --- End of remove highlight ---

  if (isGamemaster) {
    const buzzerStatus = document.getElementById("current-buzzer");
    buzzerStatus.innerHTML = "<div>Buzzers unlocked</div>";
    buzzerStatus.classList.add("buzzer-free");
  } else {
    const buzzer = document.getElementById("buzzer");
    buzzer.disabled = false;
    buzzer.textContent = "BUZZ";
    buzzer.classList.remove("buzzer-winner", "buzzer-disabled");
    buzzer.classList.add("buzzer-active");
  }
});

socket.on("buzzers-locked", () => {
    // --- Remove highlight from leaderboard ---
    const highlightedItem = document.querySelector('.leaderboard-item.buzzer-winner-highlight');
    if (highlightedItem) {
        highlightedItem.classList.remove('buzzer-winner-highlight');
    }
    // --- End of remove highlight ---

  if (isGamemaster) {
    const buzzerStatus = document.getElementById("current-buzzer");
    buzzerStatus.innerHTML = "<div>Buzzers locked</div>";
    buzzerStatus.classList.add("buzzer-free");
  } else {
    const buzzer = document.getElementById("buzzer");
    buzzer.disabled = true;
    buzzer.classList.remove("buzzer-active", "buzzer-winner");
    buzzer.classList.add("buzzer-disabled");
  }
});

socket.on("notes-update", (notes) => {
  if (isGamemaster) {
    const notesContainer = document.getElementById("all-player-notes");
    if (!notesContainer) return;

    notesContainer.innerHTML = "";

    Object.entries(notes).forEach(([playerId, data]) => {
      const noteDiv = document.createElement("div");
      noteDiv.className = "player-note-container";

      // Add locked class if note is locked
      const textareaClass = data.locked ? "note-field locked" : "note-field";

      const header = document.createElement('div');
      header.className = 'player-note-header';
      header.textContent = data.playerName || "Unknown Player";

      const textarea = document.createElement('textarea');
      textarea.className = textareaClass;
      textarea.readOnly = true;
      textarea.value = data.text || "";

      noteDiv.appendChild(header);
      noteDiv.appendChild(textarea);
      notesContainer.appendChild(noteDiv);
    });
  }
});

socket.on("gamemaster-note-update", (note) => {
  if (!isGamemaster) {
    const messageDisplay = document.getElementById("gamemaster-message");
    messageDisplay.value = note.text;
  }
});

socket.on("timer-started", (data) => {
  let seconds = data.duration;
  updateTimerDisplay(seconds);

  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    seconds--;
    updateTimerDisplay(Math.max(0, seconds));

    if (seconds <= 0) {
      clearInterval(timerInterval);
    }
  }, 1000);
});

socket.on("timer-reset", () => {
  clearInterval(timerInterval);
  const masterDisplay = document.getElementById("timer-display-master");
  const playerDisplay = document.getElementById("timer-display-player");
  if (masterDisplay) masterDisplay.innerHTML = "";
  if (playerDisplay) playerDisplay.innerHTML = "";

  const playerNote = document.getElementById("player-note");
  if (playerNote) {
    playerNote.disabled = false;
    playerNote.classList.remove("locked");
  }

  if (isGamemaster) {
    const playerNotes = document.querySelectorAll(
      ".player-note-container textarea"
    );
    playerNotes.forEach((textarea) => {
      textarea.classList.remove("locked");
    });
  }
});

socket.on("number-generated", (data) => {
  console.log("Event received:", data);
  const finalNumber = data.number;

  // Find all display elements that need to be updated
  const displays = [
    document.getElementById("random-number-display"), // Player's display
    document.getElementById("random-number-display-gm") // Gamemaster's display
  ].filter(el => el); // Filter out any null elements just in case

  // Check if there are any displays to update
  if (!displays.length) {
      console.error("Random number display elements not found.");
      return;
  }

  // Update each display with the final number and apply styling
  displays.forEach(display => {
    display.textContent = finalNumber;
    // Apply final styling immediately, without animation
    display.classList.add('final'); 
  });
});


socket.on("player-answer-locked", (data) => {
  if (!isGamemaster && socket.id === data.playerId) {
    const noteField = document.getElementById("player-note");
    if (noteField) {
      noteField.disabled = true;
      noteField.classList.add("locked");
    }
  }
});

socket.on("all-answers-locked", () => {
  if (!isGamemaster) {
    const noteField = document.getElementById("player-note");
    if (noteField) {
      noteField.disabled = true;
      noteField.classList.add("locked");
    }
  }
});

socket.on("all-answers-unlocked", () => {
  if (!isGamemaster) {
    const noteField = document.getElementById("player-note");
    if (noteField) {
      noteField.disabled = false;
      noteField.classList.remove("locked");
    }
  }
});

socket.on("room-error", (error) => {
  alert(error);
});

// New handlers for gamemaster disconnect/rejoin
socket.on('gamemaster-disconnected', () => {
    if (!isGamemaster) {
        const banner = document.getElementById('gm-disconnect-banner');
        if (banner) {
            banner.classList.remove('hidden');
        }
    }
});

socket.on('gamemaster-rejoined', () => {
    if (!isGamemaster) {
        const banner = document.getElementById('gm-disconnect-banner');
        if (banner) {
            banner.classList.add('hidden');
        }
    }
});

socket.on('room-closed', () => {
    alert('The room has been closed.');
    window.location.reload();
});
