// Alpine Sustainability - Game Entry Point
// Browser Logging System for LLM Debugging
// Captures console output and DOM state with minimal performance impact

// Global game instance
window.game = null;

// Browser Logging System
class BrowserLogger {
    constructor() {
        this.logBuffer = [];
        this.lastDomSnapshot = null;
        this.logCount = 0;
        this.domUpdateCount = 0;
        this.serverUrl = 'http://localhost:3000';

        this.init();
    }

    init() {
        // Clear previous session logs on page load
        this.clearSession();

        // Process early logs that happened before initialization
        this.processEarlyLogs();

        // Override console methods (replace the early capture)
        this.overrideConsole();

        // Set up error handling to capture uncaught errors
        this.setupErrorHandling();

        // Set up periodic logging
        this.startPeriodicLogging();

        // Set up event listeners
        this.setupEventListeners();

        // Initial log
        console.log('Browser logging system initialized');
    }

    processEarlyLogs() {
        // Use the global earlyLogs captured from the very beginning
        const earlyLogs = window.earlyLogs || [];
        earlyLogs.forEach(log => {
            // Convert early log format to our buffer format
            const message = log.args.map(arg => {
                if (typeof arg === 'object') {
                    try {
                        return JSON.stringify(arg);
                    } catch {
                        return String(arg);
                    }
                }
                return String(arg);
            }).join(' ');

            this.logBuffer.push({
                timestamp: log.timestamp,
                type: log.type,
                message,
                callStack: log.callStack || []
            });
        });
        console.log(`Processed ${earlyLogs.length} early logs`);
    }

    clearSession() {
        // Send clear command to server
        fetch(`${this.serverUrl}/clear`, { method: 'POST' })
            .catch(err => console.warn('Could not clear previous session:', err));
    }

    setupErrorHandling() {
        // Capture uncaught errors
        window.addEventListener('error', (event) => {
            this.addToBuffer('ERROR', [`Uncaught error: ${event.message} at ${event.filename}:${event.lineno}`]);
        });

        // Capture unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.addToBuffer('ERROR', [`Unhandled promise rejection: ${event.reason}`]);
        });
    }

    overrideConsole() {
        // Get the original console methods from the early capture
        const originalLog = console.log;
        const originalWarn = console.warn;
        const originalError = console.error;
        const originalInfo = console.info;

        // Replace the early capture with our full logging system
        console.log = (...args) => {
            originalLog.apply(console, args);
            this.addToBuffer('LOG', args);
        };

        console.warn = (...args) => {
            originalWarn.apply(console, args);
            this.addToBuffer('WARN', args);
        };

        console.error = (...args) => {
            originalError.apply(console, args);
            this.addToBuffer('ERROR', args);
        };

        console.info = (...args) => {
            originalInfo.apply(console, args);
            this.addToBuffer('INFO', args);
        };
    }

    addToBuffer(type, args) {
        const message = args.map(arg => {
            if (typeof arg === 'object') {
                try {
                    return JSON.stringify(arg);
                } catch {
                    return String(arg);
                }
            }
            return String(arg);
        }).join(' ');

        // Get call stack information
        const stack = new Error().stack;
        const stackLines = stack ? stack.split('\n').slice(2) : []; // Skip Error constructor and this function

        // Parse stack to get file and line info
        const callInfo = stackLines.map(line => {
            const match = line.match(/at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/);
            if (match) {
                return {
                    function: match[1],
                    file: match[2],
                    line: parseInt(match[3]),
                    column: parseInt(match[4])
                };
            }
            // Handle anonymous functions
            const anonMatch = line.match(/at\s+(.+?):(\d+):(\d+)/);
            if (anonMatch) {
                return {
                    function: '(anonymous)',
                    file: anonMatch[1],
                    line: parseInt(anonMatch[2]),
                    column: parseInt(anonMatch[3])
                };
            }
            return null;
        }).filter(Boolean);

        this.logBuffer.push({
            timestamp: new Date().toISOString(),
            type,
            message,
            callStack: callInfo
        });

        this.logCount++;
        this.updateDebugPanel();
    }

    startPeriodicLogging() {
        setInterval(() => {
            this.sendLogs();
            this.sendDomSnapshot();
        }, 2000); // Every 2 seconds
    }

    async sendLogs() {
        if (this.logBuffer.length === 0) return;

        const logs = [...this.logBuffer];
        this.logBuffer = [];

        try {
            await fetch(`${this.serverUrl}/log`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ logs })
            });
        } catch (err) {
            console.warn('Failed to send logs to server:', err);
        }
    }

    async sendDomSnapshot() {
        try {
            const snapshot = this.createDomSnapshot();
            const snapshotStr = JSON.stringify(snapshot);

            // Only send if DOM has changed
            if (this.lastDomSnapshot === snapshotStr) return;

            this.lastDomSnapshot = snapshotStr;
            this.domUpdateCount++;
            this.updateDebugPanel();

            await fetch(`${this.serverUrl}/dom-snapshot`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(snapshot)
            });
        } catch (err) {
            console.warn('Failed to send DOM snapshot to server:', err);
        }
    }

    createDomSnapshot() {
        const snapshot = {
            timestamp: new Date().toISOString(),
            url: window.location.href,
            elements: []
        };

        try {
            // Get ALL elements in the document for complete coverage
            const allElements = document.querySelectorAll('*');

            allElements.forEach(element => {
                try {
                    const computedStyle = window.getComputedStyle(element);
                    const rect = element.getBoundingClientRect();

                    const elementData = {
                        tag: element.tagName.toLowerCase(),
                        id: element.id || null,
                        classes: Array.from(element.classList),
                        dataAttributes: this.getDataAttributes(element),
                        computedStyles: this.getRelevantStyles(computedStyle),
                        position: {
                            x: Math.round(rect.left),
                            y: Math.round(rect.top)
                        },
                        dimensions: {
                            width: Math.round(rect.width),
                            height: Math.round(rect.height)
                        },
                        textContent: element.textContent?.trim().substring(0, 100) || null,
                        innerHTML: element.innerHTML?.substring(0, 200) || null
                    };

                    // Add CSS conflict detection
                    const conflicts = this.detectCssConflicts(element, computedStyle);
                    if (conflicts.length > 0) {
                        elementData.cssConflicts = conflicts;
                    }

                    snapshot.elements.push(elementData);
                } catch (elementErr) {
                    console.warn('Failed to process element:', element, elementErr);
                }
            });
        } catch (err) {
            console.error('Failed to create DOM snapshot:', err);
            this.addToBuffer('ERROR', [`DOM snapshot failed: ${err.message}`]);
        }

        return snapshot;
    }

    getDataAttributes(element) {
        const dataAttrs = {};
        for (let attr of element.attributes) {
            if (attr.name.startsWith('data-')) {
                dataAttrs[attr.name] = attr.value;
            }
        }
        return Object.keys(dataAttrs).length > 0 ? dataAttrs : null;
    }

    getRelevantStyles(computedStyle) {
        // Only capture styles relevant for layout debugging
        const relevantProps = [
            'display', 'position', 'top', 'left', 'right', 'bottom',
            'width', 'height', 'margin', 'padding', 'border',
            'background-color', 'color', 'font-size', 'font-weight',
            'flex-direction', 'justify-content', 'align-items',
            'grid-template-columns', 'grid-template-rows',
            'z-index', 'opacity', 'visibility'
        ];

        const styles = {};
        relevantProps.forEach(prop => {
            const value = computedStyle.getPropertyValue(prop);
            if (value && value !== 'initial' && value !== 'normal') {
                styles[prop] = value;
            }
        });

        return styles;
    }

    detectCssConflicts(element, computedStyle) {
        const conflicts = [];

        // Check for common layout issues
        if (computedStyle.display === 'none' && computedStyle.visibility === 'visible') {
            conflicts.push('Element hidden by display:none but visibility:visible');
        }

        if (computedStyle.position === 'absolute' && !computedStyle.top && !computedStyle.left) {
            conflicts.push('Absolute positioned element without top/left coordinates');
        }

        if (computedStyle.width === '0px' && computedStyle.minWidth !== '0px') {
            conflicts.push('Element has zero width but non-zero min-width');
        }

        return conflicts;
    }

    updateDebugPanel() {
        // Debug panel removed - no longer needed for game
    }

    setupEventListeners() {
        // No test buttons needed for game - logging runs automatically
    }
}

// Initialize logging system when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new BrowserLogger();
        initGame();
    });
} else {
    new BrowserLogger();
    initGame();
}

// Game initialization function
function initGame() {
    console.log('Initializing Alpine Sustainability...');
    let seed = parseInt(localStorage.getItem('alpine-seed'), 10);
    if (!seed || isNaN(seed)) {
        seed = getRandomSeed();
        localStorage.setItem('alpine-seed', seed);
    }
    window.game = new Game(seed);
    window.game.start();
    addInfoBox();
    console.log('Game initialization complete');
}

function getRandomSeed() {
    return Math.floor(Math.random() * 999) + 1; // 1 to 999
}

// Handle window resize
window.addEventListener('resize', () => {
    if (window.game && window.game.ui) {
        // UI will handle resize automatically with CSS
        console.log('Window resized');
    }
});

// Handle page visibility changes (pause/resume)
document.addEventListener('visibilitychange', () => {
    if (window.game) {
        if (document.hidden) {
            console.log('Game paused (page hidden)');
            // Could implement pause functionality here
        } else {
            console.log('Game resumed (page visible)');
        }
    }
});

// Global error handler
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    if (window.game) {
        window.game.showMessage('An error occurred. Check console for details.');
    }
});

// Unhandled promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    if (window.game) {
        window.game.showMessage('An error occurred. Check console for details.');
    }
});

// Listen for seed changes from UI
document.addEventListener('alpine-set-seed', (e) => {
    localStorage.setItem('alpine-seed', e.detail.seed);
});

function addInfoBox() {
    const infoBox = document.createElement('div');
    infoBox.className = 'info-box';
    infoBox.style.cssText = `
        position: fixed;
        bottom: 10px;
        left: 10px;
        background: rgba(0,0,0,0.7);
        color: white;
        padding: 10px;
        border-radius: 5px;
        font-family: monospace;
        font-size: 13px;
        z-index: 1000;
    `;
    infoBox.innerHTML = `
        <div>Alpine Sustainability v1.0</div>
        <div>Controls: WASD to move</div>
        <div>Click inventory slots to select</div>
    `;
    document.body.appendChild(infoBox);
} 