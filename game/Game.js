// Main game class - handles game loop, state management, and coordination

class Game {
    constructor(seed = 1) {
        // Initialize game state
        this.gameState = {
            // Core game state
            seed: seed,
            currentTime: GameConfig.time.gameStartTime, // start at 08:00
            currentDay: 1,
            gameSpeed: 1, // multiplier for time acceleration
            isRunning: false,

            // World state
            world: {
                width: GameConfig.world.width,
                height: GameConfig.world.height,
                entities: [], // All game objects (resources, buildings, etc.)
                grid: []      // 2D grid for spatial queries
            },

            // Player state
            player: {
                position: { x: 0, y: 0 },
                needs: {
                    temperature: GameConfig.needs.fullValue,
                    water: GameConfig.needs.fullValue,
                    calories: GameConfig.needs.fullValue,
                    vitamins: new Array(GameConfig.needs.vitaminCount).fill(GameConfig.needs.fullValue)
                },
                inventory: new Array(GameConfig.player.inventorySize).fill(null),
                selectedSlot: 0
            },

            // Villagers state
            villagers: [], // Array of villager objects

            // UI state
            ui: {
                showInventory: false,
                showStorage: false,
                activeStorage: null
            }
        };

        // Game loop variables
        this.lastTime = 0;
        this.accumulator = 0;
        this.timestep = GameConfig.gameLoop.timestep;

        // System references (will be initialized later)
        this.world = null;
        this.player = null;
        this.ui = null;

        // Input handling
        this.keys = {};
        this.setupInput();

        this.lastSummaryLog = 0;
        this.fibIntervals = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584, 4181, 6765, 10946]; // seconds
        this.nextFibIndex = 0;

        this.summaryLoggingEnabled = false; // Toggle for summary logs

        // Attach spammyLog to this instance and window for global use
        this.spammyLog = (...args) => {
            if (this.summaryLoggingEnabled) {
                console.log('[SPAMMY]', ...args);
            }
        };
        window.game = this;

        console.log('Game initialized with seed:', seed);
    }

    setupInput() {
        // Keyboard input
        document.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
        });

        document.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });

        // Mouse input
        document.addEventListener('click', (e) => {
            this.handleClick(e);
        });

        document.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.handleRightClick(e);
        });
    }

    handleClick(e) {
        // Will be implemented when we have UI and interaction systems
        console.log('Left click at:', e.clientX, e.clientY);
    }

    handleRightClick(e) {
        // Will be implemented when we have secondary actions
        console.log('Right click at:', e.clientX, e.clientY);
    }

    start() {
        assert(!this.isRunning, "Game is already running");

        this.gameState.isRunning = true;
        this.lastTime = performance.now();

        // Initialize systems
        this.initializeSystems();

        // Start game loop
        this.gameLoop(this.lastTime);

        console.log('Game started');
    }

    stop() {
        this.gameState.isRunning = false;
        console.log('Game stopped');
    }

    initializeSystems() {
        // Initialize world system
        this.world = new World(this.gameState.seed);
        this.world.generate();

        // Initialize player system
        this.player = new Player(this.gameState.player);

        // Initialize UI system
        this.ui = new UI();

        // Set player starting position (will be near their camp)
        this.gameState.player.position = this.world.getPlayerStartPosition();
        if (this.player) {
            this.player.position = this.gameState.player.position;
        }

        console.log('Systems initialized');
    }

    gameLoop(currentTime) {
        if (!this.gameState.isRunning) return;

        const deltaTime = Math.min(currentTime - this.lastTime, GameConfig.gameLoop.maxDeltaTime);
        this.lastTime = currentTime;
        this.accumulator += deltaTime;

        // Fixed timestep for consistent physics
        while (this.accumulator >= this.timestep) {
            this.update(this.timestep);
            this.accumulator -= this.timestep;
        }

        this.render();
        this.logSummaryIfNeeded();
        requestAnimationFrame(this.gameLoop.bind(this));
    }

    update(deltaTime) {
        // Update game time (accelerated)
        this.updateGameTime(deltaTime);

        // Update all systems
        if (this.world) this.world.update(deltaTime);
        if (this.player) this.player.update(deltaTime, this.keys);
        if (this.gameState.villagers.length > 0) {
            this.gameState.villagers.forEach(v => v.update(deltaTime));
        }
        if (this.ui) this.ui.update(deltaTime);

        // Check game over conditions
        this.checkGameOver();
    }

    updateGameTime(deltaTime) {
        // Convert real time to game time using config
        // 1 real second = 144 game seconds (86400/600)
        const timeAcceleration = GameConfig.time.secondsPerDay / GameConfig.time.realSecondsPerGameDay;
        const gameTimeDelta = (deltaTime / GameConfig.player.millisecondsPerSecond) * timeAcceleration;
        this.gameState.currentTime += gameTimeDelta;

        // Update day counter
        const newDay = Math.floor(this.gameState.currentTime / GameConfig.time.secondsPerDay) + 1;
        if (newDay !== this.gameState.currentDay) {
            this.gameState.currentDay = newDay;
            console.log(`Day ${newDay} begins`);
        }
    }

    render() {
        // Clear the game area
        const gameArea = document.getElementById('game-area');
        assert(gameArea, 'game-area div not found in DOM');
        if (!gameArea) {
            console.error('No #game-area found, cannot render');
            return;
        }
        gameArea.innerHTML = '';

        // Reset all entity and player DOM element refs after clearing
        if (this.world && this.world.entities) {
            this.world.entities.forEach(entity => { entity.element = null; });
        }
        if (this.player) {
            this.player.element = null;
        }

        // Render world
        if (this.world) {
            this.world.render(gameArea);
        }

        // Render player
        if (this.player) {
            this.player.render(gameArea);
        }

        // Render villagers
        if (this.gameState.villagers && this.gameState.villagers.length > 0) {
            this.gameState.villagers.forEach(villager => {
                villager.render(gameArea);
            });
        }

        // Update UI
        if (this.ui) {
            this.ui.render();
        }
        // Render summary log toggle button
        this.renderSummaryLogToggle();
    }

    renderSummaryLogToggle() {
        let btn = document.getElementById('summary-log-toggle');
        if (!btn) {
            btn = document.createElement('button');
            btn.id = 'summary-log-toggle';
            btn.style.position = 'fixed';
            btn.style.left = '10px';
            btn.style.zIndex = '1001';
            btn.style.border = '1px solid #666';
            btn.style.borderRadius = '5px';
            btn.style.padding = '8px 14px';
            btn.style.fontFamily = 'monospace';
            btn.style.fontSize = '13px';
            btn.style.cursor = 'pointer';
            btn.addEventListener('click', () => {
                this.summaryLoggingEnabled = !this.summaryLoggingEnabled;
                this.updateSummaryLogButton(btn);
            });
            document.body.appendChild(btn);
        }
        this.updateSummaryLogButton(btn);
    }

    updateSummaryLogButton(btn) {
        // Move the button up so it doesn't overlap the info/status box
        btn.style.bottom = '110px'; // 40px above the info box
        // Visual distinction for ON vs OFF
        if (this.summaryLoggingEnabled) {
            btn.textContent = '🟢 Log Spam: ON';
            btn.style.background = '#228B22'; // green
            btn.style.color = 'white';
            btn.style.borderColor = '#228B22';
        } else {
            btn.textContent = '⚪ Log Spam: OFF';
            btn.style.background = '#444';
            btn.style.color = '#ccc';
            btn.style.borderColor = '#666';
        }
    }

    checkGameOver() {
        const needs = this.gameState.player.needs;

        // Check if any need has reached zero
        if (needs.temperature <= GameConfig.needs.minValue ||
            needs.water <= GameConfig.needs.minValue ||
            needs.calories <= GameConfig.needs.minValue) {
            this.gameOver('You died from lack of basic needs');
            return;
        }

        // Check vitamin deficiencies
        for (let i = 0; i < needs.vitamins.length; i++) {
            if (needs.vitamins[i] <= GameConfig.needs.minValue) {
                this.gameOver(`You died from vitamin ${String.fromCharCode(65 + i)} deficiency`);
                return;
            }
        }
    }

    gameOver(reason) {
        this.stop();
        console.log('GAME OVER:', reason);

        // Show game over screen
        const gameArea = document.getElementById('game-area');
        if (gameArea) {
            gameArea.innerHTML = `
                <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                           background: rgba(0,0,0,0.8); color: white; padding: 20px; border-radius: 10px; text-align: center;">
                    <h2>Game Over</h2>
                    <p>${reason}</p>
                    <p>You survived ${this.gameState.currentDay} day(s)</p>
                    <button onclick="location.reload()">New Game</button>
                </div>
            `;
        }
    }

    // Get current game time in readable format
    getCurrentTime() {
        const totalSeconds = this.gameState.currentTime;
        const day = Math.floor(totalSeconds / GameConfig.time.secondsPerDay) + 1;
        const hour = Math.floor((totalSeconds % GameConfig.time.secondsPerDay) / GameConfig.time.secondsPerHour);
        const minute = Math.floor((totalSeconds % GameConfig.time.secondsPerHour) / GameConfig.time.secondsPerMinute);
        return { day, hour, minute };
    }

    // Get living villager count
    getLivingVillagerCount() {
        return this.gameState.villagers.filter(v => v.isAlive).length;
    }

    logSummaryIfNeeded() {
        if (!this.summaryLoggingEnabled) return;
        const now = performance.now() / 1000; // seconds
        if (this.nextFibIndex >= this.fibIntervals.length) return;
        const nextLogTime = this.lastSummaryLog + this.fibIntervals[this.nextFibIndex];
        if (now >= nextLogTime) {
            this.lastSummaryLog = now;
            this.nextFibIndex++;
            // Log summary
            const entityTypes = {};
            if (this.world && this.world.entities) {
                this.world.entities.forEach(e => {
                    entityTypes[e.type] = (entityTypes[e.type] || 0) + 1;
                });
            }
            const playerPos = this.player ? { x: Math.round(this.player.position.x), y: Math.round(this.player.position.y) } : null;
            console.log('[SUMMARY]', {
                time: now.toFixed(1),
                entities: entityTypes,
                player: playerPos
            });
        }
    }
} 