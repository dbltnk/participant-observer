// Player class - handles player character logic, movement, and needs

class Player {
    constructor(playerState) {
        this.state = playerState;
        this.position = playerState.position;
        this.needs = playerState.needs;
        this.inventory = playerState.inventory;
        this.selectedSlot = playerState.selectedSlot;

        // Movement state
        this.velocity = { x: 0, y: 0 };
        this.moveSpeed = GameConfig.player.moveSpeed;

        // Needs decay rates (per in-game minute, with variance)
        this.baseDecay = this.computeBaseDecayRates();
        this.dailyDecay = { ...this.baseDecay };
        this.lastDay = 1;

        // Rendering
        this.element = null;
        this.emoji = '👤'; // Player emoji

        console.log('Player initialized at:', this.position);
    }

    computeBaseDecayRates() {
        // Convert hours-to-empty to per in-game minute decay
        // decayRate = 100 / (hoursToEmpty * 60)
        const d = GameConfig.needsDrain;
        return {
            temperature: GameConfig.needs.decayCalculationFactor / (d.temperature * GameConfig.needs.minutesPerHour),
            water: GameConfig.needs.decayCalculationFactor / (d.water * GameConfig.needs.minutesPerHour),
            calories: GameConfig.needs.decayCalculationFactor / (d.calories * GameConfig.needs.minutesPerHour),
            vitamins: GameConfig.needs.decayCalculationFactor / (d.vitamins * GameConfig.needs.minutesPerHour)
        };
    }

    applyDailyVariance() {
        // ±variance (e.g. 0.2 = ±20%)
        const v = GameConfig.needsVariance;
        function vary(base) {
            const factor = 1 + (Math.random() * 2 * v - v);
            return base * factor;
        }
        this.dailyDecay = {
            temperature: vary(this.baseDecay.temperature),
            water: vary(this.baseDecay.water),
            calories: vary(this.baseDecay.calories),
            vitamins: vary(this.baseDecay.vitamins)
        };
        console.log('New daily decay rates:', this.dailyDecay);
    }

    update(deltaTime, keys) {
        this.handleMovement(deltaTime, keys);
        this.updateNeeds(deltaTime);
        this.updatePosition();
    }

    handleMovement(deltaTime, keys) {
        // Reset velocity
        this.velocity.x = 0;
        this.velocity.y = 0;

        // Handle WASD movement
        if (keys['KeyW'] || keys['ArrowUp']) {
            this.velocity.y = -this.moveSpeed;
        }
        if (keys['KeyS'] || keys['ArrowDown']) {
            this.velocity.y = this.moveSpeed;
        }
        if (keys['KeyA'] || keys['ArrowLeft']) {
            this.velocity.x = -this.moveSpeed;
        }
        if (keys['KeyD'] || keys['ArrowRight']) {
            this.velocity.x = this.moveSpeed;
        }

        // Normalize diagonal movement
        if (this.velocity.x !== 0 && this.velocity.y !== 0) {
            this.velocity.x *= GameConfig.player.diagonalMovementFactor;
            this.velocity.y *= GameConfig.player.diagonalMovementFactor;
        }

        // Apply movement
        const moveDistance = (this.velocity.x * deltaTime) / GameConfig.player.millisecondsPerSecond;
        const newX = this.position.x + moveDistance;

        const moveDistanceY = (this.velocity.y * deltaTime) / GameConfig.player.millisecondsPerSecond;
        const newY = this.position.y + moveDistanceY;

        // Basic collision detection with world bounds
        if (newX >= 0 && newX < GameConfig.world.width) {
            this.position.x = newX;
        }
        if (newY >= 0 && newY < GameConfig.world.height) {
            this.position.y = newY;
        }
    }

    updateNeeds(deltaTime) {
        // Check if new in-game day started
        const currentDay = window.game ? window.game.gameState.currentDay : 1;
        if (currentDay !== this.lastDay) {
            this.applyDailyVariance();
            this.lastDay = currentDay;
        }

        // Convert deltaTime (ms) to in-game minutes
        const realSecondsPerGameDay = GameConfig.time.realSecondsPerGameDay;
        const inGameMinutesPerMs = (GameConfig.needs.hoursPerDay * GameConfig.needs.minutesPerHour) / (realSecondsPerGameDay * GameConfig.player.millisecondsPerSecond);
        const inGameMinutes = deltaTime * inGameMinutesPerMs;

        // Get current in-game hour
        const gameTime = window.game ? window.game.getCurrentTime() : { hour: 12, minute: 0 };
        const isNight = (gameTime.hour < GameConfig.time.dayStartHour || gameTime.hour >= GameConfig.time.nightStartHour);
        // TODO: Add fire proximity check
        const nearFire = false;

        // Drain needs
        if (isNight && !nearFire) {
            this.needs.temperature -= this.dailyDecay.temperature * inGameMinutes;
        }
        this.needs.water -= this.dailyDecay.water * inGameMinutes;
        this.needs.calories -= this.dailyDecay.calories * inGameMinutes;
        for (let i = 0; i < this.needs.vitamins.length; i++) {
            this.needs.vitamins[i] -= this.dailyDecay.vitamins * inGameMinutes;
        }

        // Clamp values to valid ranges
        this.needs.temperature = clamp(this.needs.temperature, GameConfig.needs.minValue, GameConfig.needs.maxValue);
        this.needs.water = clamp(this.needs.water, GameConfig.needs.minValue, GameConfig.needs.maxValue);
        this.needs.calories = clamp(this.needs.calories, GameConfig.needs.minValue, GameConfig.needs.maxValue);
        for (let i = 0; i < this.needs.vitamins.length; i++) {
            this.needs.vitamins[i] = clamp(this.needs.vitamins[i], GameConfig.needs.minValue, GameConfig.needs.maxValue);
        }

        // Assert valid state
        assert(this.needs.temperature >= GameConfig.needs.minValue && this.needs.temperature <= GameConfig.needs.maxValue, "Temperature out of bounds");
        assert(this.needs.water >= GameConfig.needs.minValue && this.needs.water <= GameConfig.needs.maxValue, "Water out of bounds");
        assert(this.needs.calories >= GameConfig.needs.minValue && this.needs.calories <= GameConfig.needs.maxValue, "Calories out of bounds");
    }

    updatePosition() {
        // Update the state reference
        this.state.position = this.position;
    }

    render(container) {
        assert(container, 'No container passed to Player.render');
        // Create or update player element
        if (!this.element) {
            this.element = document.createElement('div');
            this.element.className = 'player';
            this.element.style.position = 'absolute';
            this.element.style.fontSize = `${GameConfig.player.fontSize}px`;
            this.element.style.zIndex = GameConfig.player.zIndex;
            this.element.style.pointerEvents = 'none';
            container.appendChild(this.element);
            if (window.game && window.game.spammyLog) {
                window.game.spammyLog('Created DOM element for player at', this.position);
            }
        }

        // Update position
        this.element.style.left = `${this.position.x}px`;
        this.element.style.top = `${this.position.y}px`;
        this.element.textContent = this.emoji;

        // Add debug info in development
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            this.element.title = `Player (${Math.round(this.position.x)}, ${Math.round(this.position.y)})`;
        }
    }

    // Check if player is near a position
    isNear(position, threshold = GameConfig.player.interactionThreshold) {
        return distance(this.position, position) <= threshold;
    }

    // Add item to inventory
    addToInventory(item) {
        for (let i = 0; i < this.inventory.length; i++) {
            if (this.inventory[i] === null) {
                this.inventory[i] = item;
                console.log(`Added ${item.type} to inventory slot ${i}`);
                return true;
            }
        }
        console.warn('Inventory is full');
        return false;
    }

    // Remove item from inventory
    removeFromInventory(slot) {
        assert(slot >= 0 && slot < this.inventory.length, "Invalid inventory slot");

        const item = this.inventory[slot];
        this.inventory[slot] = null;
        console.log(`Removed ${item?.type} from inventory slot ${slot}`);
        return item;
    }

    // Get selected item
    getSelectedItem() {
        return this.inventory[this.selectedSlot];
    }

    // Select inventory slot
    selectSlot(slot) {
        assert(slot >= 0 && slot < this.inventory.length, "Invalid inventory slot");
        this.selectedSlot = slot;
        console.log(`Selected inventory slot ${slot}`);
    }
} 