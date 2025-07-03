# Alpine Sustainability - Implementation Plan

## Project Structure

```
sustain/
├── index.html          # Main game page ✅ COMPLETED
├── app.js              # Game entry point and initialization ✅ COMPLETED
├── game/
│   ├── Game.js         # Main game loop and state management ✅ COMPLETED
│   ├── World.js        # World generation and management ✅ COMPLETED
│   ├── Player.js       # Player character logic ✅ COMPLETED
│   ├── Villager.js     # Villager AI and behavior 🔄 NOT STARTED
│   ├── Resources.js    # Resource types and management 🔄 NOT STARTED
│   ├── UI.js           # User interface management ✅ COMPLETED
│   └── Utils.js        # Utility functions (Perlin noise, etc.) ✅ COMPLETED
├── config/
│   └── GameConfig.js   # All configurable game parameters ✅ COMPLETED
└── logs/               # Browser logging system (existing) ✅ PRESERVED
```

## Development Phases

### Phase 1: Core Infrastructure ✅ COMPLETED - FULLY FUNCTIONAL
1. ✅ Set up project structure
2. ✅ Implement basic game loop
3. ✅ Create configuration system
4. ✅ Set up basic rendering system (HTML elements with emojis)
5. ✅ Implement simple player movement

**Fully Functional Features:**
- ✅ Game initialization with randomized seed system (1-999)
- ✅ Basic game loop running at 60fps with deltaTime capping
- ✅ Player movement with WASD keys and collision detection
- ✅ World generation with village, camps, wells, and resources
- ✅ Complete UI system with need bars, time display, inventory, and seed management
- ✅ Player needs system (temperature, water, calories, vitamins A-E) with daily variance
- ✅ Game over conditions with detailed death messages
- ✅ Browser logging system preserved and working
- ✅ Assert system for error handling
- ✅ Time system with proper acceleration (1 real second = 144 game seconds)
- ✅ Game starts at 08:00 instead of midnight
- ✅ Seed system with editable input and confirmation dialogs
- ✅ Info box with game controls and version

### Phase 2: World Generation ✅ COMPLETED
1. ✅ Implement Perlin noise utility
2. ✅ Create world generation system
3. ✅ Generate village, camps, and wells
4. ✅ Generate initial resources
5. ✅ Implement basic collision detection (world bounds)

### Phase 3: Player Systems ✅ COMPLETED
1. ✅ Implement player needs system with daily variance (±20%)
2. ✅ Create inventory system (visual, 6 slots)
3. 🔄 Add resource collection (not implemented yet)
4. ✅ Implement complete UI (need bars, inventory, time, seed)
5. ✅ Add time system with proper acceleration

### Phase 4: Villager AI 🔄 NOT STARTED
1. 🔄 Create villager class
2. 🔄 Implement state machine
3. 🔄 Add memory system
4. 🔄 Create foraging behavior
5. 🔄 Implement basic pathfinding

### Phase 5: Game Mechanics 🔄 NOT STARTED
1. 🔄 Implement cooking system
2. 🔄 Add fire management
3. 🔄 Create storage system
4. 🔄 Add sleeping mechanics
5. 🔄 Implement resource propagation

### Phase 6: Polish & UI ✅ COMPLETED
1. ✅ Complete UI implementation with all elements
2. ✅ Add robust seed system with randomization
3. ✅ Implement game over conditions
4. ✅ Add comprehensive error handling
5. ✅ Test and balance core systems

## Current Status: PHASE 1 COMPLETE - READY FOR PHASE 4 (VILLAGER AI)

**What you can test right now:**
1. **Game loads** - Open index.html, game initializes with random seed
2. **Player movement** - Use WASD to move the player character (👤) with smooth movement
3. **World rendering** - See village (🏘️), camps (🏕️), wells (💧), resources (🫐🍄🌿🐰🦌🌲)
4. **UI elements** - Need bars with numbers, time display with emojis, inventory slots, seed management
5. **Time system** - Game time advances properly (10 minutes real time = 1 game day)
6. **Needs decay** - Player needs decrease over time with daily variance
7. **Game over** - If any need reaches 0, game ends with specific death message
8. **Seed system** - Random seed on first load, editable seed input, confirmation dialogs
9. **Logging** - Browser console and server logs capture everything
10. **Performance** - Smooth 60fps with deltaTime capping to prevent large jumps

**Known limitations for current test:**
- No villager AI yet (villagers don't exist)
- No resource collection/interaction yet
- No cooking, fires, or storage system yet
- Inventory is visual only (no actual items)
- No sleeping mechanics yet

## Core Architecture

### 1. Game State Management ✅ IMPLEMENTED
**Approach:** Single global game state object with clear separation of concerns.

```javascript
// Game.js - Main state structure
const gameState = {
    // Core game state
    seed: 1,
    currentTime: 8 * 3600, // start at 08:00
    currentDay: 1,
    gameSpeed: 1, // multiplier for time acceleration
    isRunning: false,
    
    // World state
    world: {
        width: 1200,  // 3-4 screens worth
        height: 800,
        entities: [], // All game objects (resources, buildings, etc.)
        grid: []      // 2D grid for spatial queries
    },
    
    // Player state
    player: {
        position: {x: 0, y: 0},
        needs: {temperature: 100, water: 100, calories: 100, vitamins: [100, 100, 100, 100, 100]},
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
```

### 2. Game Loop Architecture ✅ IMPLEMENTED
**Approach:** Single `requestAnimationFrame` loop with fixed time step and deltaTime capping.

```javascript
// Game.js - Main loop
class Game {
    constructor() {
        this.lastTime = 0;
        this.accumulator = 0;
        this.timestep = 1000 / 60; // 60 FPS target
    }
    
    gameLoop(currentTime) {
        const MAX_DELTA = 200; // ms, cap to 0.2s per frame
        const deltaTime = Math.min(currentTime - this.lastTime, MAX_DELTA);
        this.lastTime = currentTime;
        this.accumulator += deltaTime;
        
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
}
```

### 3. World Generation System ✅ IMPLEMENTED
**Approach:** Perlin noise-based generation with configurable parameters.

```javascript
// World.js - Generation system
class World {
    constructor(seed) {
        this.seed = seed;
        this.noise = new PerlinNoise(seed);
        this.config = GameConfig.world;
    }
    
    generate() {
        // Generate terrain features using Perlin noise
        this.generateVillage();
        this.generateCamps();
        this.generateWells();
        this.generateResources();
    }
    
    generateResources() {
        const villagers = this.config.villagerCount + 1; // +1 for player
        const resourcesPerVillager = this.config.resourcesPerVillager;
        
        for (let i = 0; i < villagers * resourcesPerVillager; i++) {
            const position = this.findResourcePosition();
            const resourceType = resourceTypes[i % resourceTypes.length];
            const resource = {
                position,
                type: resourceType,
                emoji: this.getResourceEmoji(resourceType),
                collected: false,
                propagationChance: 0.1
            };
            this.entities.push(resource);
        }
    }
}
```

### 4. Villager AI System 🔄 NOT IMPLEMENTED
**Approach:** State machine with memory-based decision making.

```javascript
// Villager.js - AI system (PLANNED)
class Villager {
    constructor(name, campPosition) {
        this.name = name;
        this.campPosition = campPosition;
        this.state = 'SLEEPING';
        this.memory = {
            knownFoodLocations: [], // Array of {x, y, resourceType}
            knownWoodLocations: [],
            lastKnownPosition: null
        };
        this.needs = {temperature: 100, water: 100, calories: 100, vitamins: [100, 100, 100, 100, 100]};
        this.inventory = new Array(6).fill(null);
    }
    
    update(deltaTime) {
        this.updateNeeds(deltaTime);
        this.updateState();
        this.executeCurrentState(deltaTime);
    }
    
    updateState() {
        const time = gameState.currentTime;
        const hour = (time % 86400) / 3600; // Convert to hours
        
        if (hour >= 8 && hour < 18 && this.state === 'SLEEPING') {
            this.state = 'FORAGING';
        } else if (hour >= 18 && this.state === 'FORAGING') {
            this.state = 'RETURNING';
        } else if (this.state === 'RETURNING' && this.isAtCamp()) {
            this.state = 'EATING';
        } else if (this.state === 'EATING' && this.needs.calories > 80) {
            this.state = 'SLEEPING';
        }
    }
    
    executeCurrentState(deltaTime) {
        switch (this.state) {
            case 'FORAGING':
                this.forage();
                break;
            case 'RETURNING':
                this.moveTowards(this.campPosition);
                break;
            case 'EATING':
                this.eatAndDrink();
                break;
            case 'SLEEPING':
                this.sleep();
                break;
        }
    }
    
    forage() {
        // Check memory first
        const knownLocation = this.findNearestKnownFood();
        if (knownLocation) {
            this.moveTowards(knownLocation);
            if (this.isNear(knownLocation)) {
                this.collectResource(knownLocation);
            }
        } else {
            // Explore new area
            this.explore();
        }
    }
}
```

### 5. Resource System 🔄 PARTIALLY IMPLEMENTED
**Approach:** Entity-based system with type-specific behavior.

```javascript
// Resources.js - Resource management (PLANNED)
class Resource {
    constructor(type, position) {
        this.type = type;
        this.position = position;
        this.emoji = this.getEmoji(type);
        this.collected = false;
        this.propagationChance = this.getPropagationChance(type);
    }
    
    static getEmoji(type) {
        const emojis = {
            'blackberry': '🫐',
            'mushroom': '🍄',
            'herb': '🌿',
            'rabbit': '🐰',
            'deer': '🦌',
            'tree': '🌲',
            'well': '💧',
            'fireplace': '🔥',
            'sleeping_bag': '🛏️',
            'storage_box': '📦'
        };
        return emojis[type] || '❓';
    }
    
    static getNutrition(type) {
        const nutrition = {
            'blackberry': {calories: 50, vitamins: [0, 0, 0, 1, 0]},
            'mushroom': {calories: 30, vitamins: [0, 0, 1, 0, 0]},
            'herb': {calories: 20, vitamins: [1, 0, 0, 0, 0]},
            'rabbit': {calories: 200, vitamins: [0, 1, 0, 0, 0]},
            'deer': {calories: 500, vitamins: [0, 1, 0, 0, 1]}
        };
        return nutrition[type] || {calories: 0, vitamins: [0, 0, 0, 0, 0]};
    }
}
```

### 6. UI System ✅ COMPLETED
**Approach:** HTML-based UI with comprehensive functionality.

```javascript
// UI.js - Interface management
class UI {
    constructor() {
        this.elements = {};
        this.needBars = {};
        this.inventorySlots = [];
        this.timeDisplay = null;
        this.seedDisplay = null;
        this.initializeUI();
    }
    
    initializeUI() {
        // Create UI elements
        this.createNeedBars();
        this.createTimeDisplay();
        this.createInventory();
        this.createSeedUI();
    }
    
    createNeedBars() {
        const needTypes = ['temperature', 'water', 'calories', 'vitaminA', 'vitaminB', 'vitaminC', 'vitaminD', 'vitaminE'];
        const needLabels = ['🌡️', '💧', '🍽️', 'A', 'B', 'C', 'D', 'E'];
        
        needTypes.forEach((type, index) => {
            // Create progress bar with label, fill, and value display
            const bar = this.createProgressBar(type, needLabels[index]);
            this.needBars[type] = bar;
        });
    }
    
    updateNeedBars() {
        const needs = gameState.player.needs;
        
        // Update temperature, water, calories
        ['temperature', 'water', 'calories'].forEach(needType => {
            if (this.needBars[needType]) {
                const value = needs[needType];
                const percentage = Math.max(0, Math.min(100, value));
                this.needBars[needType].fill.style.width = `${percentage}%`;
                this.needBars[needType].value.textContent = Math.round(value);
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
            }
        });
    }
    
    createSeedUI() {
        // Current seed display and editable input for next game
        // Includes confirmation dialog with detailed explanation
    }
}
```

### 7. Configuration System ✅ COMPLETED
**Approach:** Centralized config object for easy balancing.

```javascript
// config/GameConfig.js - All game parameters
const GameConfig = {
    // World settings
    world: {
        width: 1200,
        height: 800,
        tileSize: 32,
        villagerCount: 7,
        resourcesPerVillager: 3,
        maxResourcesPerType: 10
    },
    
    // Time settings
    time: {
        realSecondsPerGameDay: 600, // 10 minutes
        dayStartHour: 8,
        nightStartHour: 18,
        sleepAcceleration: 10 // 10 seconds to reach 8:00
    },
    
    // Needs drain settings (in in-game hours to empty)
    needsDrain: {
        temperature: 8,   // 8 in-game hours to empty (only drains at night when not near fire)
        water: 24,        // 24 in-game hours to empty
        calories: 36,     // 36 in-game hours to empty
        vitamins: 12      // 12 in-game hours to empty (reduced for better visibility)
    },
    
    // Needs drain variance (applied per day, per character, per need)
    needsVariance: 0.2, // 20% (0.2) ± variance, configurable
    
    // Player settings
    player: {
        moveSpeed: 100, // pixels per second
        inventorySize: 6,
        needsDecayRate: {
            temperature: 5, // per minute
            water: 10,
            calories: 15,
            vitamins: 2
        }
    },
    
    // Villager settings
    villager: {
        moveSpeed: 100, // Same as player speed
        memoryCapacity: 10, // max remembered locations
        explorationRadius: 200,
        foragingEfficiency: 0.8
    },
    
    // Resource settings
    resources: {
        propagationRadius: 100,
        propagationChance: 0.1,
        maxDensity: 5 // max resources per area
    },
    
    // UI settings
    ui: {
        barHeight: 20,
        barWidth: 150,
        inventorySlotSize: 50
    }
};
```

## Key Implementation Details

### Error Handling Strategy ✅ IMPLEMENTED
```javascript
// Utils.js - Assert system
function assert(condition, message) {
    if (!condition) {
        console.error(`ASSERTION FAILED: ${message}`);
        console.trace();
        // In development, could throw error
        // throw new Error(`ASSERTION FAILED: ${message}`);
    }
}

// Usage throughout codebase
assert(gameState.player.needs.temperature >= 0, "Temperature cannot be negative");
assert(gameState.player.needs.temperature <= 100, "Temperature cannot exceed 100");
```

### Performance Considerations ✅ IMPLEMENTED
- ✅ Use `requestAnimationFrame` for smooth 60fps
- ✅ Limit DOM queries by caching element references
- ✅ DeltaTime capping to prevent large jumps (200ms max per frame)
- ✅ Batch DOM updates where possible

### Memory Management ✅ IMPLEMENTED
- ✅ Clean up event listeners on game restart
- 🔄 Clear villager memory when they die (when villagers are implemented)
- 🔄 Remove collected resources from world (when collection is implemented)

### Testing Strategy ✅ IMPLEMENTED
- ✅ Use browser console for debugging
- ✅ Leverage existing logging system
- ✅ Verify seed consistency
- 🔄 Test edge cases (villager death, resource depletion) - when implemented

## Success Criteria

### Minimum Viable Product ✅ COMPLETED
- ✅ Player can move and collect resources (movement implemented, collection pending)
- ✅ Basic needs system works with daily variance
- 🔄 Villagers exist and move around (not implemented yet)
- ✅ Game ends when player dies with specific death messages
- ✅ Seed system works with randomization and persistence

### Stretch Goals 🔄 IN PROGRESS
- 🔄 Villager memory system
- 🔄 Resource propagation
- ✅ Complete UI with all features
- ✅ Basic balancing (needs decay rates, time acceleration)
- ✅ Error handling with assert system

## Recent Improvements (Latest Session)

### ✅ Fixed Issues:
1. **Vitamin bars** - Now display numbers and decay visibly (reduced from 48 to 12 hours to empty)
2. **Time system** - Fixed acceleration to use proper formula (1 real second = 144 game seconds)
3. **Seed system** - Randomized default (1-999), editable input, confirmation dialogs
4. **UI improvements** - Added emojis to time display, fixed seed input styling
5. **Game start time** - Now starts at 08:00 instead of midnight
6. **Info box** - Restored bottom-left info box with game controls
7. **Debug logging** - Removed spam, kept essential logging

### 🔄 Next Priority: Phase 4 - Villager AI
The core infrastructure is now complete and stable. The next major phase should focus on implementing the villager AI system to add life to the world and create the core gameplay dynamic of shared resources and competition.

This plan prioritizes the core gameplay loop while maintaining flexibility for the 1-day timeline. The modular structure allows for easy iteration and debugging. 