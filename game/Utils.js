// Utility functions for Alpine Sustainability

// Assert system for error handling
function assert(condition, message) {
    if (!condition) {
        console.error(`ASSERTION FAILED: ${message}`);
        console.trace();
        // In development, could throw error
        // throw new Error(`ASSERTION FAILED: ${message}`);
    }
}

// Simple Perlin noise implementation for world generation
class PerlinNoise {
    constructor(seed) {
        this.seed = seed;
        this.permutation = this.generatePermutation();
    }

    generatePermutation() {
        const p = new Array(256);
        for (let i = 0; i < 256; i++) {
            p[i] = i;
        }

        // Fisher-Yates shuffle with seed
        for (let i = 255; i > 0; i--) {
            const j = this.hash(this.seed + i) % (i + 1);
            [p[i], p[j]] = [p[j], p[i]];
        }

        // Duplicate array for seamless noise
        return [...p, ...p];
    }

    hash(x) {
        x = ((x >> 16) ^ x) * 0x45d9f3b;
        x = ((x >> 16) ^ x) * 0x45d9f3b;
        x = (x >> 16) ^ x;
        return x;
    }

    fade(t) {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }

    lerp(t, a, b) {
        return a + t * (b - a);
    }

    grad(hash, x) {
        return (hash & 1) === 0 ? x : -x;
    }

    noise(x) {
        const X = Math.floor(x) & 255;
        x -= Math.floor(x);
        const u = this.fade(x);

        return this.lerp(u, this.grad(this.permutation[X], x), this.grad(this.permutation[X + 1], x - 1)) * 2;
    }

    // 2D noise for terrain generation
    noise2D(x, y) {
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        x -= Math.floor(x);
        y -= Math.floor(y);

        const u = this.fade(x);
        const v = this.fade(y);

        const A = this.permutation[X] + Y;
        const AA = this.permutation[A];
        const AB = this.permutation[A + 1];
        const B = this.permutation[X + 1] + Y;
        const BA = this.permutation[B];
        const BB = this.permutation[B + 1];

        return this.lerp(v, this.lerp(u, this.grad(AA, x, y), this.grad(BA, x - 1, y)),
            this.lerp(u, this.grad(AB, x, y - 1), this.grad(BB, x - 1, y - 1)));
    }

    grad(hash, x, y) {
        const h = hash & 15;
        const grad1 = 1 + (h & 7);
        return ((h & 8) === 0 ? grad1 : -grad1) * x + ((h & 4) === 0 ? grad1 : -grad1) * y;
    }
}

// Utility functions for position and distance calculations
function distance(pos1, pos2) {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    return Math.sqrt(dx * dx + dy * dy);
}

function isNear(pos1, pos2, threshold = 32) {
    return distance(pos1, pos2) <= threshold;
}

// Time utility functions
function secondsToGameTime(seconds) {
    const gameDaySeconds = GameConfig.time.realSecondsPerGameDay;
    const totalGameSeconds = seconds * GameConfig.time.realSecondsPerGameDay;
    const day = Math.floor(totalGameSeconds / 86400) + 1;
    const hour = Math.floor((totalGameSeconds % 86400) / 3600);
    const minute = Math.floor((totalGameSeconds % 3600) / 60);
    return { day, hour, minute };
}

function formatTime(hour, minute) {
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}

// Random number generation with seed
function seededRandom(seed) {
    let x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}

// Generate random position within world bounds
function randomPosition() {
    return {
        x: Math.random() * GameConfig.world.width,
        y: Math.random() * GameConfig.world.height
    };
}

// Clamp value between min and max
function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
} 