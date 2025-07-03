// Main game class - handles game loop, state management, and coordination

class Game {
    constructor(seed = 1) {
        // Initialize game state
        this.gameState = {
            // Core game state
            seed: seed,
            currentTime: 8 * 3600, // start at 08:00
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
                needs: { temperature: 100, water: 100, calories: 100, vitamins: [100, 100, 100, 100, 100] },
                inventory: new Array(6).fill(null),
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
        this.timestep = 1000 / 60; // 60 FPS target

        // System references (will be initialized later)
        this.world = null;
        this.player = null;
        this.ui = null;

        // Input handling
        this.keys = {};
        this.setupInput();

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

        console.log('Systems initialized');
    }

    gameLoop(currentTime) {
        if (!this.gameState.isRunning) return;

        const MAX_DELTA = 200; // ms, cap to 0.2s per frame
        const deltaTime = Math.min(currentTime - this.lastTime, MAX_DELTA);
        this.lastTime = currentTime;
        this.accumulator += deltaTime;

        // Fixed timestep for consistent physics
        while (this.accumulator >= this.timestep) {
            this.update(this.timestep);
            this.accumulator -= this.timestep;
        }

        this.render();
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
        const timeAcceleration = 86400 / GameConfig.time.realSecondsPerGameDay;
        const gameTimeDelta = (deltaTime / 1000) * timeAcceleration;
        this.gameState.currentTime += gameTimeDelta;

        // Update day counter
        const newDay = Math.floor(this.gameState.currentTime / 86400) + 1;
        if (newDay !== this.gameState.currentDay) {
            this.gameState.currentDay = newDay;
            console.log(`Day ${newDay} begins`);
        }
    }

    render() {
        // Clear the game area
        const gameArea = document.getElementById('game-area');
        if (!gameArea) return;

        gameArea.innerHTML = '';

        // Render world
        if (this.world) this.world.render(gameArea);

        // Render player
        if (this.player) this.player.render(gameArea);

        // Render villagers
        this.gameState.villagers.forEach(villager => {
            villager.render(gameArea);
        });

        // Update UI
        if (this.ui) this.ui.render();
    }

    checkGameOver() {
        const needs = this.gameState.player.needs;

        // Check if any need has reached zero
        if (needs.temperature <= 0 || needs.water <= 0 || needs.calories <= 0) {
            this.gameOver('You died from lack of basic needs');
            return;
        }

        // Check vitamin deficiencies
        for (let i = 0; i < needs.vitamins.length; i++) {
            if (needs.vitamins[i] <= 0) {
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
        const day = Math.floor(totalSeconds / 86400) + 1;
        const hour = Math.floor((totalSeconds % 86400) / 3600);
        const minute = Math.floor((totalSeconds % 3600) / 60);
        return { day, hour, minute };
    }

    // Get living villager count
    getLivingVillagerCount() {
        return this.gameState.villagers.filter(v => v.isAlive).length;
    }
} 