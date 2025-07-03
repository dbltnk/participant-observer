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

### Phase 1: Core Infrastructure ✅ COMPLETED - READY FOR TESTING
1. ✅ Set up project structure
2. ✅ Implement basic game loop
3. ✅ Create configuration system
4. ✅ Set up basic rendering system (HTML elements with emojis)
5. ✅ Implement simple player movement

**Testing Ready Features:**
- ✅ Game initialization with seed system
- ✅ Basic game loop running at 60fps
- ✅ Player movement with WASD keys
- ✅ World generation with village, camps, wells, and resources
- ✅ UI system with need bars, time display, and inventory
- ✅ Player needs system (temperature, water, calories, vitamins)
- ✅ Game over conditions
- ✅ Browser logging system preserved and working
- ✅ Assert system for error handling

### Phase 2: World Generation ✅ COMPLETED
1. ✅ Implement Perlin noise utility
2. ✅ Create world generation system
3. ✅ Generate village, camps, and wells
4. ✅ Generate initial resources
5. ✅ Implement basic collision detection (world bounds)

### Phase 3: Player Systems ✅ COMPLETED
1. ✅ Implement player needs system
2. ✅ Create inventory system
3. 🔄 Add resource collection (partially implemented)
4. ✅ Implement basic UI (need bars, inventory)
5. ✅ Add time system

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

### Phase 6: Polish & UI 🔄 PARTIALLY COMPLETED
1. ✅ Complete UI implementation
2. ✅ Add seed system
3. ✅ Implement game over conditions
4. ✅ Add basic error handling
5. 🔄 Test and balance

## Current Status: READY FOR PHASE 1 TESTING

**What you can test right now:**
1. **Game loads** - Open index.html, game should initialize
2. **Player movement** - Use WASD to move the player character (👤)
3. **World rendering** - See village (🏘️), camps (🏕️), wells (💧), resources (🫐🍄🌿🐰🦌🌲)
4. **UI elements** - Need bars, time display, inventory slots
5. **Time system** - Game time should advance (10 minutes real time = 1 game day)
6. **Needs decay** - Player needs should slowly decrease over time
7. **Game over** - If any need reaches 0, game should end
8. **Logging** - Browser console and server logs should capture everything

**Known limitations for this test:**
- No villager AI yet (villagers don't exist)
- No resource collection/interaction yet
- No cooking, fires, or storage system yet
- Inventory is visual only (no actual items)

## Core Architecture

### 1. Game State Management ✅ IMPLEMENTED
**Approach:** Single global game state object with clear separation of concerns.

```javascript
// Game.js - Main state structure
const gameState = {
    // Core game state
    seed: 1,
    currentTime: 0, // seconds since game start
    currentDay: 1,
    gameSpeed: 1, // multiplier for time acceleration
    
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
**Approach:** Single `requestAnimationFrame` loop with fixed time step.

```javascript
// Game.js - Main loop
class Game {
    constructor() {
        this.lastTime = 0;
        this.accumulator = 0;
        this.timestep = 1000 / 60; // 60 FPS target
    }
    
    gameLoop(currentTime) {
        const deltaTime = currentTime - this.lastTime;
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
        this.world.update(deltaTime);
        this.player.update(deltaTime);
        this.villagers.forEach(v => v.update(deltaTime));
        this.ui.update(deltaTime);
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
        this.generateVillagers();
    }
    
    generateResources() {
        const villagers = this.config.villagerCount + 1; // +1 for player
        const resourcesPerVillager = this.config.resourcesPerVillager;
        
        for (let i = 0; i < villagers * resourcesPerVillager; i++) {
            const position = this.findResourcePosition();
            const resource = this.createResource(position);
            this.entities.push(resource);
        }
    }
}
```

### 4. Villager AI System 🔄 NOT IMPLEMENTED
**Approach:** State machine with memory-based decision making.

```javascript
// Villager.js - AI system
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
// Resources.js - Resource management
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

### 6. UI System ✅ IMPLEMENTED
**Approach:** HTML-based UI with simple click handlers.

```javascript
// UI.js - Interface management
class UI {
    constructor() {
        this.elements = {};
        this.initializeUI();
    }
    
    initializeUI() {
        // Create UI elements
        this.createNeedBars();
        this.createInventory();
        this.createTimeDisplay();
        this.createSeedUI();
    }
    
    createNeedBars() {
        const needTypes = ['temperature', 'water', 'calories', 'vitaminA', 'vitaminB', 'vitaminC', 'vitaminD', 'vitaminE'];
        needTypes.forEach(type => {
            const bar = this.createProgressBar(type);
            this.elements[type] = bar;
        });
    }
    
    updateNeedBars() {
        const needs = gameState.player.needs;
        Object.keys(needs).forEach(needType => {
            if (this.elements[needType]) {
                this.elements[needType].style.width = `${needs[needType]}%`;
            }
        });
    }
    
    createInventory() {
        const inventory = document.createElement('div');
        inventory.className = 'inventory';
        inventory.id = 'inventory';
        
        for (let i = 0; i < 6; i++) {
            const slot = document.createElement('div');
            slot.className = 'inventory-slot';
            slot.dataset.slot = i;
            slot.addEventListener('click', () => this.handleInventoryClick(i));
            inventory.appendChild(slot);
        }
        
        document.body.appendChild(inventory);
    }
}
```

### 7. Configuration System ✅ IMPLEMENTED
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
        moveSpeed: 100, // Same as player speed (updated per user request)
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

### Performance Considerations
- ✅ Use `requestAnimationFrame` for smooth 60fps
- ✅ Limit DOM queries by caching element references
- 🔄 Use efficient spatial queries (grid-based)
- ✅ Batch DOM updates where possible

### Memory Management
- 🔄 Clear villager memory when they die
- 🔄 Remove collected resources from world
- ✅ Clean up event listeners on game restart

### Testing Strategy
- ✅ Use browser console for debugging
- ✅ Leverage existing logging system
- 🔄 Test edge cases (villager death, resource depletion)
- ✅ Verify seed consistency

## Success Criteria

### Minimum Viable Product
- ✅ Player can move and collect resources (movement implemented, collection pending)
- ✅ Basic needs system works
- 🔄 Villagers exist and move around (not implemented yet)
- ✅ Game ends when player dies
- ✅ Seed system works

### Stretch Goals
- 🔄 Villager memory system
- 🔄 Resource propagation
- ✅ Complete UI
- 🔄 Basic balancing
- ✅ Error handling

This plan prioritizes the core gameplay loop while maintaining flexibility for the 1-day timeline. The modular structure allows for easy iteration and debugging. 