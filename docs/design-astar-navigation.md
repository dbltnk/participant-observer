# A* Navigation System Design

## Overview

Simple grid-based A* pathfinding system for villagers and animals. Minimalist design focused on maintainability over performance.

## Core Design

### Grid System
- **Grid size**: 64x64 pixels per cell
- **World to grid conversion**: `Math.floor(worldPos / 64)`
- **Grid to world conversion**: `gridPos * 64 + 32` (center of cell)

### Obstacles
- **Only walls** count as obstacles
- Use existing `checkWallCollision()` method to determine if grid cells are blocked
- No caching - recalculate every pathfinding request

### Integration Points

#### Villagers
- Replace `moveTowards()` method in `Villager` class
- Keep existing movement logic as fallback
- Pathfinding only when target is more than 1 grid cell away

#### Animals  
- Replace `fleeFromTarget()` method in `updateAnimalFleeing()`
- Use direct movement for normal wandering behavior
- Pathfinding only during fleeing

## Architecture

### Shared Utility Class: `Pathfinder`
```javascript
class Pathfinder {
    constructor(worldWidth, worldHeight, gridSize = 64) {
        // Grid dimensions
        // Wall collision reference
    }
    
    findPath(startPos, targetPos, maxAttempts = 1000) {
        // Convert world coords to grid
        // Run A* algorithm
        // Convert path back to world coords
        // Return path array or null if failed
    }
    
    worldToGrid(worldPos) { /* convert */ }
    gridToWorld(gridPos) { /* convert */ }
    isGridCellBlocked(gridX, gridY) { /* check walls */ }
}
```

### A* Algorithm (Simple Implementation)
```javascript
function aStar(startGrid, targetGrid, isBlockedFn) {
    // Standard A* with Manhattan distance heuristic
    // 8-directional movement (including diagonals)
    // Return path as array of grid coordinates
}
```

## Integration Changes

### Villager Class
```javascript
// In moveTowards() method:
if (distance > 64) { // More than 1 grid cell
    const path = this.scene.pathfinder.findPath(this.position, target);
    if (path && path.length > 1) {
        // Follow path
        const nextWaypoint = path[1];
        // Move toward waypoint using existing movement logic
    } else {
        // Fallback to direct movement
        console.warn('Pathfinding failed, using direct movement');
    }
} else {
    // Direct movement for close targets
}
```

### Animal Fleeing
```javascript
// In fleeFromTarget() method:
const fleeDirection = calculateFleeDirection();
const fleeTarget = currentPos + fleeDirection * 200; // 200 pixels away

const path = this.scene.pathfinder.findPath(currentPos, fleeTarget);
if (path && path.length > 1) {
    // Follow path to flee
} else {
    // Fallback to direct fleeing
    console.warn('Flee pathfinding failed, using direct movement');
}
```

## Error Handling

### Timeout
- Max 1000 iterations per pathfinding attempt
- Throw warning and fallback to direct movement

### No Path Found
- Return null from `findPath()`
- Log warning with start/target positions
- Use existing movement logic

### Invalid Positions
- Validate input coordinates
- Assert grid bounds
- Graceful fallback

## Configuration

Add to `GameConfig.js`:
```javascript
navigation: {
    gridSize: 64,
    maxPathfindingAttempts: 1000,
    pathfindingTimeout: 16, // ms
    enableForVillagers: true,
    enableForAnimals: true,
    debugVisualization: false
}
```

## Debug Features

### Optional Path Visualization
- Draw path lines when `debugVisualization: true`
- Show grid cells being checked
- Display pathfinding metrics

### Logging
- Log pathfinding failures with context
- Track performance metrics
- Debug grid conversion issues

## Implementation Steps

1. **Create Pathfinder class** with basic grid conversion
2. **Implement simple A* algorithm** with Manhattan distance
3. **Add wall collision detection** using existing methods
4. **Add configuration** to GameConfig
5. **Integrate with Villager.moveTowards()** with fallback
6. **Integrate with animal fleeing** with fallback
7. **Add debug visualization**

## Performance Considerations

- **No caching** - recalculate every request
- **Coarse grid** - 64px cells for speed
- **Timeout protection** - prevent infinite loops
- **Early exit** - direct movement for close targets

## Success Criteria

- Villagers can navigate around walls
- Animals flee intelligently around obstacles
- Fallback behavior works reliably
- Debug information available when needed 