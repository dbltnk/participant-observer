# Hierarchical State Machine Design

## Overview

This document outlines the design for refactoring the current monolithic villager state machine into a hierarchical system that separates **goals** (what to do) from **actions** (how to do it).

## Goals

### Primary Goals
1. **Separate concerns** - Distinguish between when to do something (triggered by low stats) and what to do (find food/burnables/water/fire) and the multi-step process of how to do so
2. **Improve maintainability** - Make the codebase easier to understand, debug, and extend
3. **Enable efficient collection** - Allow villagers to collect multiple items when appropriate and convenient
4. **Handle dynamic changes** - Gracefully handle cases where planned targets become unavailable
5. **Preserve existing functionality** - Maintain all current villager behaviors while improving the architecture

### Secondary Goals
1. **Reduce code duplication** - Reuse common actions across different goals
2. **Improve debugging** - Make it easier to identify whether problems are in goal selection or action execution
3. **Enable future extensions** - Make it easier to add new villager behaviors

## System Architecture

### Goal States (High Level - WHEN/WHAT)
```javascript
const GOAL_STATES = {
    SURVIVE: 'survive',        // Emergency needs (water <20%, calories <20%, temp <20%, fire <3 logs)
    REST: 'rest',              // Sleep schedule (22:00-07:00) - above maintenance but below survival
    MAINTAIN: 'maintain',       // Regular needs (water <50%, temp <70%, calories <60%, fire <10 logs)  
    CONTRIBUTE: 'contribute'    // Village tasks (forage food/burnable)
};

// Explicit priority order (lower number = higher priority)
const GOAL_PRIORITY = {
    SURVIVE: 1,    // Highest - emergency needs
    REST: 2,        // Sleep schedule  
    MAINTAIN: 3,    // Regular needs
    CONTRIBUTE: 4   // Lowest - village tasks
};
```

**Priority Order**: Goals are evaluated in strict priority order. The highest priority active goal is always selected, and lower priority goals are completely ignored until the higher priority goal is satisfied.

### Action States (Low Level - HOW)
```javascript
const ACTION_STATES = {
    FIND_RESOURCES: 'find_resources',      // Scan for available resources
    MOVE_TO_RESOURCE: 'move_to_resource',  // Move to specific resource
    COLLECT_RESOURCE: 'collect_resource',   // Collect single resource
    USE_FACILITY: 'use_facility',          // Use well/fire/etc
    STORE_ITEMS: 'store_items',            // Manage inventory
    SLEEP: 'sleep',                        // Sleep behavior
    WAIT: 'wait'
};
```

## Goal-to-Action Mapping

Goals call actions to execute their behavior:

```javascript
// SurviveGoalExecutor calls actions
executeEmergencyEat() → ActionExecutor.executeFindResources() → ActionExecutor.executeMoveToResource() → ActionExecutor.executeCollectResource()

// RestGoalExecutor calls actions  
executeSleep() → ActionExecutor.executeSleep()

// MaintainGoalExecutor calls actions
executeRegularEat() → ActionExecutor.executeFindResources() → ActionExecutor.executeMoveToResource() → ActionExecutor.executeCollectResource()

// ContributeGoalExecutor calls actions
executeForageFood() → ActionExecutor.executeFindResources() → ActionExecutor.executeMoveToResource() → ActionExecutor.executeCollectResource()
```

## Emergency vs Normal Execution Differences

| Aspect | Emergency | Normal |
|--------|-----------|---------|
| **Resource Source Priority** | Can steal from others | Respect ownership |
| **Goal Interruption** | Interrupts everything | Only lower priority |
| **Collection Strategy** | Direct, single items | Efficient, batches |
| **Batch Size** | 1 item | up to `GameConfig.villager.collection.maxBatchSize` items (if needed) |

## Data Structures

### Goal Data
```javascript
goalData = {
    currentGoal: GOAL_STATES.MAINTAIN,
    goalStartTime: timestamp,
    goalTargets: [],           // Resources/facilities needed for this goal
    goalSatisfied: false       // Whether goal conditions are met
}
```

### Action Data  
```javascript
actionData = {
    currentAction: ACTION_STATES.FIND_RESOURCES,
    actionStartTime: timestamp,
    actionTargets: [],         // Specific entities to interact with
    actionProgress: 0,         // Progress toward completing action
    actionFailed: false        // Whether action failed and needs replanning
}
```

## Implementation Plan

### Phase 1: Core Infrastructure

#### 1.1 Create Base Classes
- **`HierarchicalVillagerAI`** - Main AI controller
- **`GoalEvaluator`** - Determines which goal to pursue
- **`ActionExecutor`** - Executes specific actions
- **`CollectionManager`** - Handles resource collection logic

#### 1.2 Define State Constants
- Remove existing `VILLAGER_STATES` and add new goal/action structure
- Update all references throughout codebase

#### 1.3 Add Configuration Values
- Add `GameConfig.villager.collection.maxBatchSize` for configurable batch collection
- Add any other new config values needed for hierarchical system

### Phase 2: Goal System Implementation

#### 2.1 Goal Evaluation Logic
- **Reuse**: `evaluateState()` logic from current `VillagerStateMachine`
- **Modify**: Simplify to return goal categories instead of specific states
- **Add**: Priority-based goal selection within categories

#### 2.2 Goal-Specific Executors
- **`SurviveGoalExecutor`** - Handle emergency needs
- **`MaintainGoalExecutor`** - Handle regular needs  
- **`ContributeGoalExecutor`** - Handle village tasks
- **`RestGoalExecutor`** - Handle sleep behavior

### Phase 3: Action System Implementation

#### 3.1 Collection Management
- **`SimpleCollectionManager`** - Handle resource finding and collection
- **`BatchCollectionStrategy`** - Collect multiple items when convenient (normal mode)
- **`SingleCollectionStrategy`** - Collect single items for emergencies

#### 3.2 Action Execution
- **Reuse**: Existing movement, collection, and facility usage methods
- **Modify**: Adapt to work with new action states
- **Add**: Dynamic target invalidation and replanning

### Phase 4: Integration and Testing

#### 4.1 Replace Existing State Machine
- **Delete**: `VillagerStateMachine` class entirely (full replacement)
- **Modify**: `Villager.update()` to use new AI system
- **Preserve**: All existing villager properties and methods
- **Test**: Ensure all current behaviors work identically

#### 4.2 Add New Features
- **Batch collection** - Collect multiple items when appropriate
- **Dynamic replanning** - Handle target invalidation gracefully
- **Emergency vs normal** - Different collection strategies

#### 4.3 Update Debug UI
- **Show both goals and actions** in debug interface
- **Update transition logging** for goals and actions
- **Preserve force override functionality** for testing

## Existing Code Analysis

### Functions to Reuse (No Changes Needed)
```javascript
// Movement and positioning
GameUtils.distance()
GameUtils.isWithinInteractionDistance()
villager.moveTowards()

// Resource interaction
villager.collectResource()
villager.drinkFromWell()
villager.eatFood()
villager.addWoodToFire()
villager.retrieveFromStorage()
villager.storeItemsInStorage()

// Utility functions
GameUtils.isFood()
GameUtils.isBurnable()
GameUtils.getNutrition()
GameUtils.getFireValue()
GameUtils.ALL_FOOD_TYPES
GameUtils.ALL_BURNABLE_TYPES

// Finding functions
findNearestWell()
findOwnFireplace()
findNearestBurningFire()
findOwnStorageBox()
findCommunalStorageBox()
findNearestWood()
findNearestFood()
```

### Functions to Modify
```javascript
// Current state machine methods - adapt to new goal/action system
evaluateState() → evaluateGoal()
executeState() → executeGoal()
enterState() → enterGoal()
exitState() → exitGoal()

// Shared helper functions - adapt to work with both emergency and normal modes
executeFireRefill(isEmergency, deltaTime, entities, storageBoxes) → CollectionManager.executeFireRefill(isEmergency, ...)
executeEat(isEmergency, deltaTime, entities, storageBoxes) → CollectionManager.executeEat(isEmergency, ...)
executeDrink(deltaTime, entities) → CollectionManager.executeDrink(...)
executeWarmUp(deltaTime, entities) → CollectionManager.executeWarmUp(...)
shouldRefillFire(isEmergency, entities) → CollectionManager.shouldRefillFire(isEmergency, ...)

// Complex resource finding - adapt to new collection system
findNearestResourceSource(entities, storageBoxes, resourceType, isEmergency = false) → CollectionManager.findResourceSource(...)
findNearestWood(entities, storageBoxes, isEmergency = false) → CollectionManager.findWoodSource(...)
findNearestFood(entities, storageBoxes, isEmergency = false) → CollectionManager.findFoodSource(...)

// Storage management - adapt to new action system
storeForagedItems(deltaTime) → CollectionManager.storeItems(...)
storeItemsInIdle(deltaTime) → CollectionManager.storeItems(...)
storeAllItemsInStorage(storageBox) → CollectionManager.storeAllItems(...)

// State transition logic - adapt to hierarchical system
update() → HierarchicalVillagerAI.update()
```

### Functions to Delete
```javascript
// Individual state execution methods - replace with action system
executeEmergencyDrink()
executeEmergencyEat()
executeEmergencyWarmUp()
executeEmergencyFireRefill()
executeRegularDrink()
executeRegularWarmUp()
executeRegularEat()
executeRegularFireRefill()
executeForageFood()
executeForageBurnable()
executeIdle()

// Individual state entry methods - replace with goal system
enterEmergencyDrink()
enterEmergencyEat()
enterEmergencyWarmUp()
enterEmergencyFireRefill()
enterRegularDrink()
enterRegularWarmUp()
enterRegularEat()
enterRegularFireRefill()
enterForageFood()
enterForageBurnable()
enterIdle()

// Individual state exit methods - replace with goal system
exitSleep()

// State machine class - replace with hierarchical system
VillagerStateMachine class (entire class)
VILLAGER_STATES constants

// Debug logging system - replace with new hierarchical logging
logNearbyObjects() // Move to HierarchicalVillagerAI for goal/action context
getStateName(state) // Replace with getGoalName() and getActionName()
```

### New Functions to Add
```javascript
// Core AI system
class HierarchicalVillagerAI {
    constructor(villager)
    update(deltaTime, gameTime, entities, storageBoxes)
    evaluateGoal(gameTime, entities, storageBoxes)
    executeGoal(deltaTime, entities, storageBoxes)
    transitionGoal(newGoal)
}

// Goal system
class GoalEvaluator {
    evaluateSurviveGoal(gameTime, entities, storageBoxes)
    evaluateMaintainGoal(gameTime, entities, storageBoxes)
    evaluateContributeGoal(gameTime, entities, storageBoxes)
    evaluateRestGoal(gameTime, entities, storageBoxes)
}

class SurviveGoalExecutor {
    executeEmergencyEat(deltaTime, entities, storageBoxes)
    executeEmergencyDrink(deltaTime, entities, storageBoxes)
    executeEmergencyWarmUp(deltaTime, entities, storageBoxes)
    executeEmergencyFireRefill(deltaTime, entities, storageBoxes)
}

class MaintainGoalExecutor {
    executeRegularEat(deltaTime, entities, storageBoxes)
    executeRegularDrink(deltaTime, entities, storageBoxes)
    executeRegularWarmUp(deltaTime, entities, storageBoxes)
    executeRegularFireRefill(deltaTime, entities, storageBoxes)
}

class ContributeGoalExecutor {
    executeForageFood(deltaTime, entities, storageBoxes)
    executeForageBurnable(deltaTime, entities, storageBoxes)
}

class RestGoalExecutor {
    executeSleep(deltaTime, entities, storageBoxes)
}

// Action system
class ActionExecutor {
    executeFindResources(deltaTime, entities, storageBoxes)
    executeMoveToResource(deltaTime, entities, storageBoxes)
    executeCollectResource(deltaTime, entities, storageBoxes)
    executeUseFacility(deltaTime, entities, storageBoxes)
    executeStoreItems(deltaTime, entities, storageBoxes)
    executeSleep(deltaTime, entities, storageBoxes)
    executeWait(deltaTime, entities, storageBoxes)
}

// Collection management
class CollectionManager {
    constructor(villager)
    update(deltaTime, entities, storageBoxes)
    executeEmergencyCollection(deltaTime, entities)      // Single item collection
    executeNormalCollection(deltaTime, entities)         // Batch collection
    handleTargetInvalidation(entities)
    replanCollection(entities)
    findAvailableResources(entities)
    setCollectionTargets(targets)
    isTargetValid(target, entities)
    getNeededResourceType()
    getMaxBatchSize()
    detectEmergency()
    
    // Shared helper methods (adapted from current system)
    executeFireRefill(isEmergency, deltaTime, entities, storageBoxes)
    executeEat(isEmergency, deltaTime, entities, storageBoxes)
    executeDrink(deltaTime, entities)
    executeWarmUp(deltaTime, entities)
    shouldRefillFire(isEmergency, entities)
    
    // Resource finding methods (adapted from current system)
    findResourceSource(entities, storageBoxes, resourceType, isEmergency)
    findWoodSource(entities, storageBoxes, isEmergency)
    findFoodSource(entities, storageBoxes, isEmergency)
    
    // Storage methods (adapted from current system)
    storeItems(deltaTime)
    storeAllItems(storageBox)
    handleStorageTask(deltaTime)
}

class ResourceSourceSelector {
    getResourceSourcePriority(isEmergency)
    selectBestResource(resources, isEmergency)
    getResourceQuality(resource)
}

class GoalInterruption {
    shouldInterruptCurrentGoal(isEmergency, currentGoal, newGoal)
}

// Spatial analysis (adapted from current system)
class SpatialAnalyzer {
    getGridCellForPosition(position)
    countResourcesInGridCell(entities, resourceType, gridCell)
    isResourceSafeToCollect(entity)
    canCollectResourceWithGoldenRule(entity, entities)
    analyzeResourceDensity(entities, resourceType, position)
}
```

### Complex Logic to Preserve

#### Storage Management System
The current system has sophisticated storage logic that must be preserved:

```javascript
// Current storage task persistence
stateData.currentTask = 'store' // Tracks ongoing storage tasks
storeItemsInIdle(deltaTime) // Handles storage movement and interaction
storeAllItemsInStorage(storageBox) // Bulk storage operations

// Must be adapted to:
CollectionManager.handleStorageTask(deltaTime)
CollectionManager.storeItems(deltaTime)
CollectionManager.storeAllItems(storageBox)
```

#### Resource Finding Complexity
The current system has advanced resource finding that must be preserved:

```javascript
// Grid-based spatial analysis
getGridCellForPosition(position)
countResourcesInGridCell(entities, resourceType, gridCell)

// Golden rule foraging
isResourceSafeToCollect(entity)
canCollectResourceWithGoldenRule(entity, entities)

// Storage vs world source prioritization
findNearestResourceSource(entities, storageBoxes, resourceType, isEmergency)
```

#### Configuration Dependencies
The new system must use the same configuration values:

```javascript
// Emergency thresholds
GameConfig.villager.emergencyThresholds.water // <20%
GameConfig.villager.emergencyThresholds.calories // <20%
GameConfig.villager.emergencyThresholds.temperature // <20%

// Regular thresholds  
GameConfig.villager.regularThresholds.water // <50%
GameConfig.villager.regularThresholds.calories // <60%
GameConfig.villager.regularThresholds.temperature // <70%

// Fire thresholds
GameConfig.villager.fireThresholds.emergency // <3 logs
GameConfig.villager.fireThresholds.regular // <10 logs

// Sleep schedule
GameConfig.villager.sleepSchedule.startHour // 22:00
GameConfig.villager.sleepSchedule.endHour // 07:00
GameConfig.villager.sleepSchedule.variance // ±1 hour

// Foraging rules
GameConfig.villager.foraging.minResourcesPerGridCell // 3 resources
GameConfig.villager.foraging.skipPoisonousFood // true
GameConfig.villager.foraging.skipFasterAnimals // true
```

#### Debug Logging System
The current system has sophisticated logging that must be preserved and adapted:

```javascript
// Spam-gated logging with configurable frequency
const shouldLogEvaluation = Math.random() < GameConfig.logging.loggingChance && window.summaryLoggingEnabled;

// State transition logging with detailed context
console.log(`[VillagerStateMachine] ${this.villager.name} STATE TRANSITION: ${oldStateName} → ${newStateName}`);
console.log(`[VillagerStateMachine] ${this.villager.name} needs at transition: T${this.villager.needs.temperature.toFixed(1)} W${this.villager.needs.water.toFixed(1)} C${this.villager.needs.calories.toFixed(1)} V[${this.villager.needs.vitamins.map(v => v.toFixed(1)).join(',')}]`);

// Nearby object logging for debugging context
logNearbyObjects() // Logs nearby entities, villager stats, and position

// Force state override for testing
if (window.forceVillagerState) {
    return window.forceVillagerState; // Testing override
}
```

**Must be adapted to:**
```javascript
// Goal transition logging
console.log(`[HierarchicalVillagerAI] ${villager.name} GOAL TRANSITION: ${oldGoal} → ${newGoal}`);

// Action transition logging  
console.log(`[HierarchicalVillagerAI] ${villager.name} ACTION TRANSITION: ${oldAction} → ${newAction}`);

// Context logging for goals and actions
logNearbyObjects() // Adapted for goal/action context
```

### Target Invalidation
- When targets become unavailable, immediately replan
- Emergency mode: Can steal from others if original target gone
- Normal mode: Find alternative sources, respect ownership

## Migration Strategy

### Step 1: Implement New Hierarchical System
- Create `HierarchicalVillagerAI` class
- Implement goal evaluation and execution
- Implement action system
- Implement collection management

### Step 2: Replace Old State Machine
- Delete `VillagerStateMachine` class entirely (full replacement)
- Remove all individual state execution methods
- Remove all individual state entry/exit methods
- Remove `VILLAGER_STATES` constants
- Update `Villager.update()` to use new AI system

### Step 3: Add New Features
- Implement batch collection
- Add dynamic replanning
- Enhance emergency vs normal differences

**Note**: This is a complete refactor with no legacy compatibility. All old code is removed and replaced with the new hierarchical system.

## Implementation Checklist

### Phase 1: Core Infrastructure ✅
- [ ] **Create Base Classes**
  - [ ] `HierarchicalVillagerAI` - Main AI controller
  - [ ] `GoalEvaluator` - Determines which goal to pursue
  - [ ] `ActionExecutor` - Executes specific actions
  - [ ] `CollectionManager` - Handles resource collection logic

- [ ] **Define State Constants**
  - [ ] Remove `VILLAGER_STATES` constants
  - [ ] Add `GOAL_STATES` constants
  - [ ] Add `ACTION_STATES` constants
  - [ ] Add `GOAL_PRIORITY` constants
  - [ ] Update all references throughout codebase

- [ ] **Add Configuration Values**
  - [ ] Add `GameConfig.villager.collection.maxBatchSize` for configurable batch collection
  - [ ] Add any other new config values needed for hierarchical system

### Phase 2: Goal System Implementation ✅
- [ ] **Goal Evaluation Logic**
  - [ ] Adapt `evaluateState()` logic to `evaluateGoal()`
  - [ ] Simplify to return goal categories instead of specific states
  - [ ] Add priority-based goal selection within categories

- [ ] **Goal-Specific Executors**
  - [ ] `SurviveGoalExecutor` - Handle emergency needs
  - [ ] `MaintainGoalExecutor` - Handle regular needs  
  - [ ] `ContributeGoalExecutor` - Handle village tasks
  - [ ] `RestGoalExecutor` - Handle sleep behavior

### Phase 3: Action System Implementation ✅
- [ ] **Collection Management**
  - [ ] `SimpleCollectionManager` - Handle resource finding and collection
  - [ ] `BatchCollectionStrategy` - Collect multiple items when convenient (normal mode)
  - [ ] `SingleCollectionStrategy` - Collect single items for emergencies

- [ ] **Action Execution**
  - [ ] Adapt existing movement, collection, and facility usage methods
  - [ ] Adapt to work with new action states
  - [ ] Add dynamic target invalidation and replanning

### Phase 4: Integration and Testing ✅
- [ ] **Replace Existing State Machine**
  - [ ] Delete `VillagerStateMachine` class entirely (full replacement)
  - [ ] Modify `Villager.update()` to use new AI system
  - [ ] Preserve all existing villager properties and methods
  - [ ] Test to ensure all current behaviors work identically

- [ ] **Add New Features**
  - [ ] Batch collection - Collect multiple items when appropriate
  - [ ] Dynamic replanning - Handle target invalidation gracefully
  - [ ] Emergency vs normal - Different collection strategies

- [ ] **Update Debug UI**
  - [ ] Show both goals and actions in debug interface
  - [ ] Update transition logging for goals and actions
  - [ ] Preserve force override functionality for testing

### Phase 5: Debug System Migration ✅
- [ ] **Logging System Adaptation**
  - [ ] Adapt spam-gated logging for new system
  - [ ] Update transition logging for goals and actions
  - [ ] Preserve nearby object logging functionality
  - [ ] Maintain force override testing capability

- [ ] **State Data Migration**
  - [ ] Convert `stateData` to `goalData` and `actionData`
  - [ ] Preserve state-specific data storage
  - [ ] Update all state data references

### Phase 6: Code Cleanup ✅
- [ ] **Remove Old Code**
  - [ ] Delete `VillagerStateMachine` class entirely
  - [ ] Remove all individual state execution methods
  - [ ] Remove all individual state entry/exit methods
  - [ ] Remove `VILLAGER_STATES` constants

- [ ] **Update References**
  - [ ] Update all `VILLAGER_STATES` references to new constants
  - [ ] Update `getStateName()` calls to `getGoalName()` and `getActionName()`
  - [ ] Update debug UI to show goals and actions instead of states

### Phase 7: Configuration Updates ✅
- [ ] **GameConfig Integration**
  - [ ] Ensure all existing config dependencies are preserved
  - [ ] Add any new config values needed for hierarchical system
  - [ ] Update config documentation

### Phase 8: Testing and Validation ✅
- [ ] **Behavioral Testing**
  - [ ] Test emergency vs normal behavior differences
  - [ ] Test batch collection functionality
  - [ ] Test dynamic replanning when targets become unavailable
  - [ ] Test sleep schedule behavior

- [ ] **Performance Testing**
  - [ ] Verify no performance regression
  - [ ] Test with multiple villagers
  - [ ] Monitor memory usage

- [ ] **Debug Testing**
  - [ ] Verify logging system works correctly
  - [ ] Test force override functionality
  - [ ] Verify transition logging accuracy

### Phase 9: Documentation ✅
- [ ] **Update Documentation**
  - [ ] Update code comments for new system
  - [ ] Document new class responsibilities
  - [ ] Update any external documentation

### Migration Status Tracking

**Current Status**: 🟡 **Planning Complete** - Ready to begin implementation

**Progress Summary**:
- ✅ Design and analysis complete
- ✅ Migration strategy defined
- ✅ Function mapping documented
- ✅ Configuration dependencies identified
- 🟡 Implementation not started
- 🔴 Testing not started
- 🔴 Documentation not updated