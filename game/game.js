/**
 * DATA SIMULATION
 */
const CATEGORY_WORDS = {
    "Animales": [
        { master: "León", mystery: "Tigre" },
        { master: "Águila", mystery: "Halcón" },
        { master: "Ballena", mystery: "Tiburón" },
        { master: "Perro", mystery: "Lobo" },
        { master: "Gato", mystery: "Leopardo" }
    ],
    "Comida": [
        { master: "Pizza", mystery: "Hamburguesa" },
        { master: "Sushi", mystery: "Tacos" },
        { master: "Helado", mystery: "Yogur" },
        { master: "Manzana", mystery: "Pera" },
        { master: "Café", mystery: "Té" }
    ],
    "Lugares": [
        { master: "Playa", mystery: "Piscina" },
        { master: "Escuela", mystery: "Universidad" },
        { master: "Hospital", mystery: "Farmacia" },
        { master: "Cine", mystery: "Teatro" },
        { master: "Bosque", mystery: "Parque" }
    ],
    "Objetos": [
        { master: "Teléfono", mystery: "Tablet" },
        { master: "Lápiz", mystery: "Bolígrafo" },
        { master: "Silla", mystery: "Sillón" },
        { master: "Reloj", mystery: "Brújula" }
    ],
    "Escuela": [
        { master: "Juan", mystery: "Pablo"}
    ]
};

// ESTADO DEL JUEGO
let state = {
    selectedCategories: [],
    players: [], 
    activePlayerIndex: 0, 
    votes: {}, 
    mode: 'impostor', 
    masterWord: '',
    mysteryWord: '',
    specialRoleCount: 0,
    votingQueue: [],
    selectedVoteTargetId: null // Nuevo: ID del jugador seleccionado para votar
};

// ELEMENTOS DOM
const screens = {
    config: document.getElementById('screen-config'),
    names: document.getElementById('screen-names'),
    pass: document.getElementById('screen-pass'),
    game: document.getElementById('screen-game'),
    vote: document.getElementById('screen-vote'),
    results: document.getElementById('screen-results')
};

// UTILIDADES
function showScreen(screenName) {
    Object.values(screens).forEach(s => s.classList.add('d-none'));
    screens[screenName].classList.remove('d-none');
}

function showModal(message) {
    document.getElementById('modal-body-text').innerText = message;
    const modal = new bootstrap.Modal(document.getElementById('msgModal'));
    modal.show();
}

function getRandomInt(max) {
    return Math.floor(Math.random() * max);
}

// --- PERSISTENCIA ---
function saveConfig() {
    const config = {
        categories: state.selectedCategories,
        numPlayers: document.getElementById('numPlayers').value,
        numImpostors: document.getElementById('numImpostors').value,
        gameMode: document.getElementById('gameMode').value
    };
    localStorage.setItem('impostor_config', JSON.stringify(config));
}

function loadSavedData() {
    const savedConfig = localStorage.getItem('impostor_config');
    if (savedConfig) {
        const config = JSON.parse(savedConfig);
        if (config.numPlayers) document.getElementById('numPlayers').value = config.numPlayers;
        if (config.numImpostors) document.getElementById('numImpostors').value = config.numImpostors;
        if (config.gameMode) document.getElementById('gameMode').value = config.gameMode;

        if (config.categories && Array.isArray(config.categories)) {
            state.selectedCategories = config.categories;
            const buttons = document.querySelectorAll('.category-btn');
            buttons.forEach(btn => {
                if (state.selectedCategories.includes(btn.innerText)) {
                    btn.classList.add('active');
                }
            });
        }
    }
}

// 1. INICIALIZACIÓN
document.addEventListener('DOMContentLoaded', () => {
    renderCategories();
    loadSavedData();
    setupEventListeners();
});

function renderCategories() {
    const container = document.getElementById('categories-container');
    Object.keys(CATEGORY_WORDS).forEach(cat => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'category-btn';
        btn.innerText = cat;
        btn.onclick = () => toggleCategory(cat, btn);
        container.appendChild(btn);
    });
}

function toggleCategory(cat, btn) {
    if (state.selectedCategories.includes(cat)) {
        state.selectedCategories = state.selectedCategories.filter(c => c !== cat);
        btn.classList.remove('active');
    } else {
        state.selectedCategories.push(cat);
        btn.classList.add('active');
    }
    saveConfig();
}

function setupEventListeners() {
    document.getElementById('numPlayers').addEventListener('change', saveConfig);
    document.getElementById('numImpostors').addEventListener('change', saveConfig);
    document.getElementById('gameMode').addEventListener('change', saveConfig);

    document.getElementById('btn-to-names').addEventListener('click', () => {
        const numP = parseInt(document.getElementById('numPlayers').value);
        const numI = parseInt(document.getElementById('numImpostors').value);
        
        if (state.selectedCategories.length === 0) {
            document.getElementById('category-error').style.display = 'block';
            return;
        }
        if (numI >= numP) {
            showModal("Los impostores deben ser menos que el total de jugadores.");
            return;
        }

        state.mode = document.getElementById('gameMode').value;
        state.specialRoleCount = numI;
        generateNameInputs(numP);
        showScreen('names');
    });

    document.getElementById('btn-start-game').addEventListener('click', startGameSetup);
    document.getElementById('btn-show-role').addEventListener('click', revealRoleCard);
    document.getElementById('btn-hide-role').addEventListener('click', hideRoleAndNext);
    document.getElementById('btn-call-vote').addEventListener('click', startVotingPhase);
    document.getElementById('btn-skip-vote').addEventListener('click', () => submitVote(null));
    
    // Nuevo listener para Confirmar Voto
    document.getElementById('btn-confirm-vote').addEventListener('click', () => {
        if (state.selectedVoteTargetId !== null) {
            submitVote(state.selectedVoteTargetId);
        }
    });

    // Resultados -> Continuar: Actualiza la lista de jugadores vivos
    document.getElementById('btn-continue-game').addEventListener('click', () => {
        showScreen('game');
        renderActivePlayers(); // IMPORTANTE: Actualizar lista visualmente
    });
}

function generateNameInputs(count) {
    const container = document.getElementById('names-inputs-container');
    container.innerHTML = '';
    const savedNames = JSON.parse(localStorage.getItem('impostor_player_names') || '[]');

    for (let i = 0; i < count; i++) {
        const col = document.createElement('div');
        col.className = 'col-6';
        const savedName = savedNames[i] || ''; 
        col.innerHTML = `
            <input type="text" class="form-control player-name-input" 
                   placeholder="Jugador ${i+1}" value="${savedName}" required>
        `;
        container.appendChild(col);
    }

    const inputs = container.querySelectorAll('.player-name-input');
    inputs.forEach(input => {
        input.addEventListener('input', () => {
            const currentNames = Array.from(document.querySelectorAll('.player-name-input')).map(i => i.value);
            localStorage.setItem('impostor_player_names', JSON.stringify(currentNames));
        });
    });
}

function startGameSetup() {
    const inputs = document.querySelectorAll('.player-name-input');
    const names = Array.from(inputs).map(input => input.value.trim() || input.placeholder);
    
    const randomCat = state.selectedCategories[getRandomInt(state.selectedCategories.length)];
    const wordObj = CATEGORY_WORDS[randomCat][getRandomInt(CATEGORY_WORDS[randomCat].length)];
    
    state.masterWord = wordObj.master;
    state.mysteryWord = wordObj.mystery;

    state.players = names.map((name, index) => ({
        id: index,
        name: name,
        role: 'Ciudadano',
        word: state.masterWord,
        isAlive: true
    }));

    let assigned = 0;
    while (assigned < state.specialRoleCount) {
        const idx = getRandomInt(state.players.length);
        if (state.players[idx].role === 'Ciudadano') {
            state.players[idx].role = 'Impostor';
            if (state.mode === 'impostor') {
                state.players[idx].word = '???';
            } else {
                state.players[idx].word = state.mysteryWord;
            }
            assigned++;
        }
    }

    state.activePlayerIndex = 0;
    preparePassScreen();
    showScreen('pass');
}

function preparePassScreen() {
    const player = state.players[state.activePlayerIndex];
    document.getElementById('pass-player-name').innerText = player.name;
    document.getElementById('role-card').classList.add('d-none');
    document.getElementById('btn-show-role').classList.remove('d-none');
    document.getElementById('btn-hide-role').classList.add('d-none');
}

// MODIFICADO: Lógica de revelación según el modo de juego
function revealRoleCard() {
    const player = state.players[state.activePlayerIndex];
    const roleEl = document.getElementById('role-title');
    const wordEl = document.getElementById('word-display');
    const card = document.getElementById('role-card');

    if (state.mode === 'mystery') {
        // En modo misterio, NO se revela el rol explícitamente
        roleEl.innerText = 'TU PALABRA ES:';
        roleEl.style.color = '#f1c40f'; // Color amarillo neutral
    } else {
        // En modo clásico, se dice explícitamente
        roleEl.innerText = player.role === 'Impostor' ? 'ERES EL IMPOSTOR' : 'ERES CIUDADANO';
        roleEl.style.color = player.role === 'Impostor' ? '#e74c3c' : '#2ecc71';
    }
    
    wordEl.innerText = player.word;

    card.classList.remove('d-none');
    document.getElementById('btn-show-role').classList.add('d-none');
    document.getElementById('btn-hide-role').classList.remove('d-none');
}

function hideRoleAndNext() {
    state.activePlayerIndex++;
    if (state.activePlayerIndex < state.players.length) {
        preparePassScreen();
    } else {
        startGameRound();
    }
}

function startGameRound() {
    showScreen('game');
    document.getElementById('countdown-overlay').classList.remove('d-none');
    document.getElementById('game-content').classList.add('d-none');
    
    let count = 3;
    const countEl = document.getElementById('countdown-val');
    countEl.innerText = count;
    
    const timer = setInterval(() => {
        count--;
        if (count > 0) {
            countEl.innerText = count;
        } else {
            clearInterval(timer);
            document.getElementById('countdown-overlay').classList.add('d-none');
            document.getElementById('game-content').classList.remove('d-none');
            
            const alivePlayers = state.players.filter(p => p.isAlive);
            const starter = alivePlayers[getRandomInt(alivePlayers.length)];
            document.getElementById('first-player-name').innerText = starter.name;
            
            renderActivePlayers();
        }
    }, 1000);
}

// MODIFICADO: Renderizado de lista para mostrar claramente a los eliminados
function renderActivePlayers() {
    const list = document.getElementById('active-players-list');
    list.innerHTML = '';
    state.players.forEach(p => {
        if (p.isAlive) {
            list.innerHTML += `
                <div class="player-list-item">
                    <span><i class="fas fa-user"></i> ${p.name}</span>
                </div>`;
        } else {
            list.innerHTML += `
                <div class="player-list-item dead">
                    <span>${p.name}</span>
                    <span class="badge bg-danger">ELIMINADO</span>
                </div>`;
        }
    });
}

function startVotingPhase() {
    const alive = state.players.filter(p => p.isAlive);
    state.votingQueue = alive.map(p => p.id); 
    state.votes = {}; 
    processNextVoter();
    showScreen('vote');
}

function processNextVoter() {
    if (state.votingQueue.length === 0) {
        calcResults();
        return;
    }

    const currentVoterId = state.votingQueue[0];
    const voter = state.players.find(p => p.id === currentVoterId);
    
    // Resetear selección
    state.selectedVoteTargetId = null;
    document.getElementById('vote-confirm-area').classList.add('d-none');
    
    document.getElementById('voter-name').innerText = voter.name;
    renderVoteButtons(currentVoterId);
}

// MODIFICADO: Renderizar botones con lógica de selección
function renderVoteButtons(voterId) {
    const container = document.getElementById('vote-buttons-container');
    container.innerHTML = '';
    
    state.players.forEach(p => {
        if (p.isAlive && p.id !== voterId) {
            const btn = document.createElement('button');
            btn.className = 'vote-btn';
            // Aplicar clase si está seleccionado
            if (state.selectedVoteTargetId === p.id) {
                btn.classList.add('selected');
            }
            
            btn.innerHTML = `<i class="fas fa-user"></i><br>${p.name}`;
            
            // Al hacer click, seleccionamos, NO enviamos todavía
            btn.onclick = () => selectVoteTarget(p.id, p.name, voterId);
            container.appendChild(btn);
        }
    });
}

// NUEVO: Función para manejar la selección visual
function selectVoteTarget(targetId, targetName, voterId) {
    state.selectedVoteTargetId = targetId;
    document.getElementById('selected-candidate-name').innerText = targetName;
    document.getElementById('vote-confirm-area').classList.remove('d-none');
    
    // Re-renderizar para mostrar el borde/color de selección
    renderVoteButtons(voterId);
}

function submitVote(targetId) {
    if (targetId !== null) {
        state.votes[targetId] = (state.votes[targetId] || 0) + 1;
    }
    state.votingQueue.shift();
    processNextVoter();
}

function calcResults() {
    let maxVotes = 0;
    let candidates = [];

    Object.keys(state.votes).forEach(id => {
        const count = state.votes[id];
        if (count > maxVotes) {
            maxVotes = count;
            candidates = [id];
        } else if (count === maxVotes) {
            candidates.push(id);
        }
    });

    showScreen('results');
    const resContainer = document.getElementById('result-message-container');
    const contBtn = document.getElementById('btn-continue-game');
    const gameOverDiv = document.getElementById('game-over-container');
    
    contBtn.classList.add('d-none');
    gameOverDiv.classList.add('d-none');

    if (candidates.length !== 1) {
        resContainer.innerHTML = `
            <div class="alert alert-warning">
                <h4>Empate o sin votos</h4>
                <p>Nadie es expulsado en esta ronda.</p>
            </div>
        `;
        contBtn.classList.remove('d-none');
        return;
    }

    const victimId = parseInt(candidates[0]);
    const victim = state.players.find(p => p.id === victimId);
    victim.isAlive = false;

    let msgClass = victim.role === 'Impostor' ? 'alert-success' : 'alert-danger';
    let title = victim.role === 'Impostor' ? '¡Impostor Expulsado!' : '¡Inocente Expulsado!';
    
    resContainer.innerHTML = `
        <div class="alert ${msgClass}">
            <h2>${title}</h2>
            <p><strong>${victim.name}</strong> era <strong>${victim.role}</strong></p>
        </div>
    `;

    checkWinCondition();
}

function checkWinCondition() {
    const impostorsAlive = state.players.filter(p => p.isAlive && p.role === 'Impostor').length;
    const citizensAlive = state.players.filter(p => p.isAlive && p.role === 'Ciudadano').length;
    const contBtn = document.getElementById('btn-continue-game');
    const gameOverDiv = document.getElementById('game-over-container');

    if (impostorsAlive === 0) {
        gameOverDiv.classList.remove('d-none');
        document.getElementById('winner-team').innerText = "¡Ganan los Ciudadanos!";
        document.getElementById('winner-team').className = "text-success fw-bold";
        revealAllRoles();
    } else if (impostorsAlive >= citizensAlive) {
        gameOverDiv.classList.remove('d-none');
        document.getElementById('winner-team').innerText = "¡Ganan los Impostores!";
        document.getElementById('winner-team').className = "text-danger fw-bold";
        revealAllRoles();
    } else {
        contBtn.classList.remove('d-none');
    }
}

function revealAllRoles() {
    const list = document.getElementById('reveal-roles-list');
    list.innerHTML = '<h5>Roles Reales:</h5>';
    state.players.forEach(p => {
        const color = p.role === 'Impostor' ? 'text-danger' : 'text-success';
        list.innerHTML += `<div class="${color}"><strong>${p.name}:</strong> ${p.role}</div>`;
    });
    list.innerHTML += `<div class="mt-3 text-warning">Palabra Secreta: <strong>${state.masterWord}</strong></div>`;
    if(state.mode === 'mystery') {
        list.innerHTML += `<div class="text-secondary">Palabra Impostor: <strong>${state.mysteryWord}</strong></div>`;
    }
}