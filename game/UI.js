// UI class - handles user interface elements and interactions

class UI {
    constructor() {
        this.elements = {};
        this.needBars = {};
        this.inventorySlots = [];
        this.timeDisplay = null;
        this.seedDisplay = null;

        this.initializeUI();
        console.log('UI initialized');
    }

    initializeUI() {
        this.createNeedBars();
        this.createTimeDisplay();
        this.createInventory();
        this.createSeedUI();
    }

    createNeedBars() {
        const needTypes = ['temperature', 'water', 'calories', 'vitaminA', 'vitaminB', 'vitaminC', 'vitaminD', 'vitaminE'];
        const needLabels = ['🌡️', '💧', '🍽️', 'A', 'B', 'C', 'D', 'E'];

        const needBarContainer = document.createElement('div');
        needBarContainer.className = 'need-bars';
        needBarContainer.style.cssText = `
            position: fixed;
            top: 10px;
            left: 10px;
            background: rgba(0,0,0,0.7);
            padding: 10px;
            border-radius: 5px;
            color: white;
            font-family: monospace;
            z-index: 1000;
        `;

        needTypes.forEach((type, index) => {
            const barContainer = document.createElement('div');
            barContainer.style.cssText = `
                margin-bottom: 5px;
                display: flex;
                align-items: center;
                gap: 5px;
            `;

            const label = document.createElement('span');
            label.textContent = needLabels[index];
            label.style.width = '20px';

            const bar = document.createElement('div');
            bar.className = `need-bar ${type}`;
            bar.style.cssText = `
                width: ${GameConfig.ui.barWidth}px;
                height: ${GameConfig.ui.barHeight}px;
                background: #333;
                border: 1px solid #666;
                position: relative;
                overflow: hidden;
            `;

            const fill = document.createElement('div');
            fill.className = `${type}-fill`;
            fill.style.cssText = `
                height: 100%;
                background: ${this.getNeedBarColor(type)};
                width: 100%;
                transition: width 0.1s ease;
            `;

            const value = document.createElement('span');
            value.className = `${type}-value`;
            value.style.cssText = `
                position: absolute;
                right: 5px;
                top: 50%;
                transform: translateY(-50%);
                font-size: 10px;
                color: white;
                text-shadow: 1px 1px 1px black;
            `;

            bar.appendChild(fill);
            bar.appendChild(value);
            barContainer.appendChild(label);
            barContainer.appendChild(bar);
            needBarContainer.appendChild(barContainer);

            this.needBars[type] = { bar, fill, value };
        });

        document.body.appendChild(needBarContainer);
    }

    createTimeDisplay() {
        this.timeDisplay = document.createElement('div');
        this.timeDisplay.className = 'time-display';
        this.timeDisplay.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: rgba(0,0,0,0.7);
            color: white;
            padding: 10px;
            border-radius: 5px;
            font-family: monospace;
            z-index: 1000;
        `;

        document.body.appendChild(this.timeDisplay);
    }

    createInventory() {
        const inventoryContainer = document.createElement('div');
        inventoryContainer.className = 'inventory';
        inventoryContainer.style.cssText = `
            position: fixed;
            bottom: 10px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0,0,0,0.7);
            padding: 10px;
            border-radius: 5px;
            display: flex;
            gap: 5px;
            z-index: 1000;
        `;

        for (let i = 0; i < GameConfig.player.inventorySize; i++) {
            const slot = document.createElement('div');
            slot.className = 'inventory-slot';
            slot.dataset.slot = i;
            slot.style.cssText = `
                width: ${GameConfig.ui.inventorySlotSize}px;
                height: ${GameConfig.ui.inventorySlotSize}px;
                border: 2px solid #666;
                background: rgba(255,255,255,0.1);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 20px;
                cursor: pointer;
                transition: border-color 0.2s ease;
            `;

            slot.addEventListener('click', () => this.handleInventoryClick(i));
            slot.addEventListener('mouseenter', () => {
                slot.style.borderColor = '#fff';
            });
            slot.addEventListener('mouseleave', () => {
                slot.style.borderColor = '#666';
            });

            inventoryContainer.appendChild(slot);
            this.inventorySlots.push(slot);
        }

        document.body.appendChild(inventoryContainer);
    }

    createSeedUI() {
        const seedContainer = document.createElement('div');
        seedContainer.className = 'seed-ui';
        seedContainer.style.cssText = `
            position: fixed;
            bottom: 10px;
            right: 10px;
            background: rgba(0,0,0,0.7);
            color: white;
            padding: 10px;
            border-radius: 5px;
            font-family: monospace;
            z-index: 1000;
        `;

        // Get the current seed from localStorage or default
        let currentSeed = parseInt(localStorage.getItem('alpine-seed'), 10);
        if (!currentSeed || isNaN(currentSeed)) {
            currentSeed = 1;
        }

        // Current seed display (top line)
        this.seedDisplay = document.createElement('div');
        this.seedDisplay.textContent = `Current Seed: ${currentSeed}`;
        this.seedDisplay.style.cssText = 'margin-bottom: 8px; font-size: 12px;';

        // Editable seed input for next game
        const seedInput = document.createElement('input');
        seedInput.type = 'number';
        seedInput.min = 1;
        seedInput.max = 999;
        seedInput.value = currentSeed;
        seedInput.style.cssText = `
            width: 60px; 
            margin-right: 5px; 
            font-size: 12px;
            background: white;
            color: black;
            border: 1px solid #ccc;
            border-radius: 3px;
            padding: 2px 4px;
        `;
        seedInput.placeholder = '1-999';

        const newGameBtn = document.createElement('button');
        newGameBtn.textContent = 'New Game';
        newGameBtn.style.cssText = `
            background: #4CAF50;
            color: white;
            border: none;
            padding: 5px 10px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 12px;
        `;
        newGameBtn.addEventListener('click', () => {
            const val = parseInt(seedInput.value, 10);
            if (isNaN(val) || val < 1 || val > 999) {
                alert('Please enter a valid seed number between 1 and 999.');
                return;
            }
            const confirmMessage = `Start a new game with seed ${val}?\n\nThis will:\n• Delete all current game progress\n• Generate a new world with this seed\n• Reset all player stats and inventory\n\nAre you sure you want to continue?`;
            if (confirm(confirmMessage)) {
                localStorage.setItem('alpine-seed', val);
                document.dispatchEvent(new CustomEvent('alpine-set-seed', { detail: { seed: val } }));
                location.reload();
            }
        });

        seedContainer.appendChild(this.seedDisplay);
        seedContainer.appendChild(seedInput);
        seedContainer.appendChild(newGameBtn);
        document.body.appendChild(seedContainer);
    }

    getNeedBarColor(type) {
        const colors = {
            temperature: '#ff6b6b',
            water: '#4ecdc4',
            calories: '#45b7d1',
            vitaminA: '#96ceb4',
            vitaminB: '#feca57',
            vitaminC: '#ff9ff3',
            vitaminD: '#54a0ff',
            vitaminE: '#5f27cd'
        };
        return colors[type] || '#666';
    }

    handleInventoryClick(slot) {
        console.log(`Inventory slot ${slot} clicked`);
        // Will be implemented when we have inventory interaction
    }

    update(deltaTime) {
        // Update need bars
        this.updateNeedBars();

        // Update time display
        this.updateTimeDisplay();

        // Update inventory
        this.updateInventory();
    }

    updateNeedBars() {
        if (!window.game || !window.game.gameState) return;

        const needs = window.game.gameState.player.needs;

        // Update temperature, water, calories
        ['temperature', 'water', 'calories'].forEach(needType => {
            if (this.needBars[needType]) {
                const value = needs[needType];
                const percentage = Math.max(0, Math.min(100, value));

                this.needBars[needType].fill.style.width = `${percentage}%`;
                this.needBars[needType].value.textContent = Math.round(value);

                // Change color based on value
                if (value < 20) {
                    this.needBars[needType].fill.style.background = '#ff0000';
                } else if (value < 50) {
                    this.needBars[needType].fill.style.background = '#ffaa00';
                } else {
                    this.needBars[needType].fill.style.background = this.getNeedBarColor(needType);
                }
            }
        });

        // Update vitamins (array-based)
        const vitaminTypes = ['vitaminA', 'vitaminB', 'vitaminC', 'vitaminD', 'vitaminE'];
        vitaminTypes.forEach((vitaminType, index) => {
            if (this.needBars[vitaminType] && needs.vitamins && needs.vitamins[index] !== undefined) {
                const value = needs.vitamins[index];
                const percentage = Math.max(0, Math.min(100, value));

                this.needBars[vitaminType].fill.style.width = `${percentage}%`;
                this.needBars[vitaminType].value.textContent = Math.round(value);

                // Change color based on value
                if (value < 20) {
                    this.needBars[vitaminType].fill.style.background = '#ff0000';
                } else if (value < 50) {
                    this.needBars[vitaminType].fill.style.background = '#ffaa00';
                } else {
                    this.needBars[vitaminType].fill.style.background = this.getNeedBarColor(vitaminType);
                }
            }
        });
    }

    updateTimeDisplay() {
        if (!window.game) return;

        const time = window.game.getCurrentTime();
        const livingVillagers = window.game.getLivingVillagers ? window.game.getLivingVillagerCount() : 0;

        // Determine time of day emoji
        let timeEmoji = '🌅'; // default to sunrise
        if (time.hour >= 6 && time.hour < 12) {
            timeEmoji = '🌞'; // morning
        } else if (time.hour >= 12 && time.hour < 18) {
            timeEmoji = '☀️'; // afternoon
        } else if (time.hour >= 18 && time.hour < 22) {
            timeEmoji = '🌆'; // evening
        } else {
            timeEmoji = '🌙'; // night
        }

        this.timeDisplay.innerHTML = `
            <div>📅 Day ${time.day}</div>
            <div>${timeEmoji} ${formatTime(time.hour, time.minute)}</div>
            <div>👥 Neighbours: ${livingVillagers}</div>
        `;
    }

    updateInventory() {
        if (!window.game || !window.game.gameState) return;

        const inventory = window.game.gameState.player.inventory;
        const selectedSlot = window.game.gameState.player.selectedSlot;

        this.inventorySlots.forEach((slot, index) => {
            const item = inventory[index];

            // Update slot appearance
            if (index === selectedSlot) {
                slot.style.borderColor = '#fff';
                slot.style.borderWidth = '3px';
            } else {
                slot.style.borderColor = '#666';
                slot.style.borderWidth = '2px';
            }

            // Update slot content
            if (item) {
                slot.textContent = this.getItemEmoji(item.type);
                slot.title = item.type;
            } else {
                slot.textContent = '';
                slot.title = 'Empty';
            }
        });
    }

    getItemEmoji(type) {
        const emojis = {
            'blackberry': '🫐',
            'mushroom': '🍄',
            'herb': '🌿',
            'rabbit': '🐰',
            'deer': '🦌',
            'tree': '🌲',
            'wood': '🪵'
        };
        return emojis[type] || '❓';
    }

    render() {
        // UI updates are handled in the update method
        // This method is called every frame but doesn't need to do anything
        // since we're using CSS transitions for smooth updates
    }

    // Show a temporary message
    showMessage(message, duration = 3000) {
        const messageElement = document.createElement('div');
        messageElement.textContent = message;
        messageElement.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 15px 20px;
            border-radius: 5px;
            font-family: monospace;
            z-index: 2000;
            pointer-events: none;
        `;

        document.body.appendChild(messageElement);

        setTimeout(() => {
            messageElement.remove();
        }, duration);
    }
} 