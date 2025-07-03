// World class - handles world generation, rendering, and spatial queries

class World {
    constructor(seed) {
        this.seed = seed;
        this.noise = new PerlinNoise(seed);
        this.config = GameConfig.world;

        // World entities
        this.entities = [];
        this.village = null;
        this.camps = [];
        this.wells = [];

        // Player starting position
        this.playerStartPosition = { x: 0, y: 0 };

        console.log('World initialized with seed:', seed);
    }

    generate() {
        console.log('Generating world...');

        // Generate village at center
        this.generateVillage();

        // Generate camps around village
        this.generateCamps();

        // Generate wells
        this.generateWells();

        // Generate initial resources
        this.generateResources();

        console.log(`World generated with ${this.entities.length} entities`);
    }

    generateVillage() {
        const centerX = this.config.width / 2;
        const centerY = this.config.height / 2;

        this.village = {
            position: { x: centerX, y: centerY },
            type: 'village',
            emoji: '🏘️'
        };

        // Add village well
        const well = {
            position: {
                x: centerX + GameConfig.world.villageCenterOffset.x,
                y: centerY + GameConfig.world.villageCenterOffset.y
            },
            type: 'well',
            emoji: '💧',
            waterLevel: GameConfig.wells.initialWaterLevel
        };

        // Add communal storage
        const storage = {
            position: {
                x: centerX - GameConfig.world.villageCenterOffset.x,
                y: centerY + GameConfig.world.villageCenterOffset.y
            },
            type: 'storage_box',
            emoji: '📦',
            capacity: GameConfig.storage.communalCapacity,
            items: []
        };

        this.entities.push(well, storage);
        this.wells.push(well);

        console.log('Village generated at center');
    }

    generateCamps() {
        const centerX = this.config.width / 2;
        const centerY = this.config.height / 2;

        for (let i = 0; i < this.config.villagerCount; i++) {
            const angle = (i / this.config.villagerCount) * 2 * Math.PI;
            const x = centerX + Math.cos(angle) * GameConfig.world.campRadius;
            const y = centerY + Math.sin(angle) * GameConfig.world.campRadius;

            const camp = {
                position: { x, y },
                type: 'camp',
                emoji: '🏕️',
                villagerId: i
            };

            // Add camp facilities
            const fireplace = {
                position: {
                    x: x + GameConfig.world.campSpacing.x,
                    y: y
                },
                type: 'fireplace',
                emoji: '🔥',
                isBurning: false,
                wood: 0,
                maxWood: GameConfig.fires.maxWood
            };

            const sleepingBag = {
                position: {
                    x: x - GameConfig.world.campSpacing.x,
                    y: y
                },
                type: 'sleeping_bag',
                emoji: '🛏️',
                isOccupied: false
            };

            const personalStorage = {
                position: {
                    x: x,
                    y: y + GameConfig.world.campSpacing.y
                },
                type: 'storage_box',
                emoji: '📦',
                capacity: GameConfig.storage.personalCapacity,
                items: [],
                isPersonal: true,
                villagerId: i
            };

            this.camps.push(camp);
            this.entities.push(camp, fireplace, sleepingBag, personalStorage);
        }

        // Set player starting position near their camp (camp 0)
        const playerCamp = this.camps[0];
        this.playerStartPosition = {
            x: playerCamp.position.x + GameConfig.world.playerStartOffset.x,
            y: playerCamp.position.y + GameConfig.world.playerStartOffset.y
        };

        console.log(`${this.config.villagerCount} camps generated around village`);
    }

    generateWells() {
        // Generate additional wells using Perlin noise
        const wellCount = GameConfig.world.wellCount;

        for (let i = 0; i < wellCount; i++) {
            let attempts = 0;
            let position;

            do {
                position = {
                    x: Math.random() * this.config.width,
                    y: Math.random() * this.config.height
                };
                attempts++;
            } while (this.isTooCloseToExistingWell(position) && attempts < GameConfig.world.wellMaxAttempts);

            if (attempts < GameConfig.world.wellMaxAttempts) {
                const well = {
                    position,
                    type: 'well',
                    emoji: '💧',
                    waterLevel: GameConfig.wells.initialWaterLevel
                };

                this.entities.push(well);
                this.wells.push(well);
            }
        }

        console.log(`${this.wells.length} wells generated`);
    }

    generateResources() {
        const villagers = this.config.villagerCount + 1; // +1 for player
        const resourcesPerVillager = this.config.resourcesPerVillager;

        // Resource types
        const resourceTypes = ['blackberry', 'mushroom', 'herb', 'rabbit', 'deer', 'tree'];

        for (let i = 0; i < villagers * resourcesPerVillager; i++) {
            const position = this.findResourcePosition();
            const resourceType = resourceTypes[i % resourceTypes.length];

            const resource = {
                position,
                type: resourceType,
                emoji: this.getResourceEmoji(resourceType),
                collected: false,
                propagationChance: GameConfig.resources.propagationChance
            };

            this.entities.push(resource);
        }

        console.log(`${villagers * resourcesPerVillager} resources generated`);
    }

    findResourcePosition() {
        let attempts = 0;
        let position;

        do {
            // Use Perlin noise to create more natural distribution
            const noiseX = Math.random() * GameConfig.world.noiseScale;
            const noiseY = Math.random() * GameConfig.world.noiseScale;
            const noiseValue = this.noise.noise2D(noiseX, noiseY);

            // Bias towards areas with higher noise values
            const biasX = (noiseValue + 1) * GameConfig.world.noiseBias;
            const biasY = (this.noise.noise2D(noiseX + GameConfig.world.noiseScale / 2, noiseY + GameConfig.world.noiseScale / 2) + 1) * GameConfig.world.noiseBias;

            position = {
                x: biasX * this.config.width,
                y: biasY * this.config.height
            };

            attempts++;
        } while (this.isTooCloseToVillage(position) && attempts < GameConfig.world.wellMaxAttempts);

        return position;
    }

    isTooCloseToVillage(position) {
        const villageDistance = distance(position, this.village.position);
        return villageDistance < GameConfig.world.resourceVillageMinDistance;
    }

    isTooCloseToExistingWell(position) {
        for (const well of this.wells) {
            if (distance(position, well.position) < GameConfig.world.wellMinDistance) {
                return true;
            }
        }
        return false;
    }

    getResourceEmoji(type) {
        const emojis = {
            'blackberry': '🫐',
            'mushroom': '🍄',
            'herb': '🌿',
            'rabbit': '🐰',
            'deer': '🦌',
            'tree': '🌲'
        };
        return emojis[type] || '❓';
    }

    update(deltaTime) {
        // Update world entities
        this.entities.forEach(entity => {
            if (entity.update) {
                entity.update(deltaTime);
            }
        });
    }

    render(container) {
        // Render all entities
        this.entities.forEach(entity => {
            this.renderEntity(entity, container);
        });
    }

    renderEntity(entity, container) {
        // Create or update entity element
        if (!entity.element) {
            entity.element = document.createElement('div');
            entity.element.className = `entity ${entity.type}`;
            entity.element.style.position = 'absolute';
            entity.element.style.fontSize = '24px';
            entity.element.style.zIndex = '10';
            entity.element.style.pointerEvents = 'none';
            container.appendChild(entity.element);
        }

        // Update position and appearance
        entity.element.style.left = `${entity.position.x}px`;
        entity.element.style.top = `${entity.position.y}px`;
        entity.element.textContent = entity.emoji;

        // Add debug info in development
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            entity.element.title = `${entity.type} (${Math.round(entity.position.x)}, ${Math.round(entity.position.y)})`;
        }
    }

    getPlayerStartPosition() {
        return this.playerStartPosition;
    }

    // Get entities near a position
    getEntitiesNear(position, radius = GameConfig.world.tileSize * 1.5) {
        return this.entities.filter(entity => {
            return distance(entity.position, position) <= radius;
        });
    }

    // Get entities of a specific type
    getEntitiesByType(type) {
        return this.entities.filter(entity => entity.type === type);
    }

    // Remove entity from world
    removeEntity(entity) {
        const index = this.entities.indexOf(entity);
        if (index > -1) {
            this.entities.splice(index, 1);
            if (entity.element) {
                entity.element.remove();
            }
        }
    }
} 