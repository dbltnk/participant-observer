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
            temperature: 100 / (d.temperature * 60),
            water: 100 / (d.water * 60),
            calories: 100 / (d.calories * 60),
            vitamins: 100 / (d.vitamins * 60)
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
            this.velocity.x *= 0.707; // 1/√2
            this.velocity.y *= 0.707;
        }

        // Apply movement
        const moveDistance = (this.velocity.x * deltaTime) / 1000;
        const newX = this.position.x + moveDistance;

        const moveDistanceY = (this.velocity.y * deltaTime) / 1000;
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
        const inGameMinutesPerMs = (24 * 60) / (realSecondsPerGameDay * 1000); // in-game min per ms
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
        this.needs.temperature = clamp(this.needs.temperature, 0, 100);
        this.needs.water = clamp(this.needs.water, 0, 100);
        this.needs.calories = clamp(this.needs.calories, 0, 100);
        for (let i = 0; i < this.needs.vitamins.length; i++) {
            this.needs.vitamins[i] = clamp(this.needs.vitamins[i], 0, 100);
        }

        // Assert valid state
        assert(this.needs.temperature >= 0 && this.needs.temperature <= 100, "Temperature out of bounds");
        assert(this.needs.water >= 0 && this.needs.water <= 100, "Water out of bounds");
        assert(this.needs.calories >= 0 && this.needs.calories <= 100, "Calories out of bounds");
    }

    updatePosition() {
        // Update the state reference
        this.state.position = this.position;
    }

    render(container) {
        // Create or update player element
        if (!this.element) {
            this.element = document.createElement('div');
            this.element.className = 'player';
            this.element.style.position = 'absolute';
            this.element.style.fontSize = '32px';
            this.element.style.zIndex = '100';
            this.element.style.pointerEvents = 'none';
            container.appendChild(this.element);
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

    // Get needs as a formatted string for debugging
    getNeedsString() {
        return `T:${Math.round(this.needs.temperature)} W:${Math.round(this.needs.water)} C:${Math.round(this.needs.calories)} V:[${this.needs.vitamins.map(v => Math.round(v)).join(',')}]`;
    }

    // Check if player is near a position
    isNear(position, threshold = 32) {
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