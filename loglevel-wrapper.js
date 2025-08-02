// Simple loglevel replacement with actual level filtering
let currentLevel = 3; // Default to 'warn' level

const levels = {
    TRACE: 0,
    DEBUG: 1,
    INFO: 2,
    WARN: 3,
    ERROR: 4,
    SILENT: 5
};

const levelNames = {
    'trace': levels.TRACE,
    'debug': levels.DEBUG,
    'info': levels.INFO,
    'warn': levels.WARN,
    'error': levels.ERROR,
    'silent': levels.SILENT
};

const log = {
    trace: (...args) => {
        if (currentLevel <= levels.TRACE) {
            (console.debug || console.log)(...args);
        }
    },
    debug: (...args) => {
        if (currentLevel <= levels.DEBUG) {
            (console.debug || console.log)(...args);
        }
    },
    info: (...args) => {
        if (currentLevel <= levels.INFO) {
            (console.info || console.log)(...args);
        }
    },
    warn: (...args) => {
        if (currentLevel <= levels.WARN) {
            (console.warn || console.log)(...args);
        }
    },
    error: (...args) => {
        if (currentLevel <= levels.ERROR) {
            (console.error || console.log)(...args);
        }
    },
    setLevel: (level) => {
        if (typeof level === 'string') {
            level = levelNames[level.toLowerCase()];
        }
        if (typeof level === 'number' && level >= 0 && level <= 5) {
            currentLevel = level;
        }
    },
    getLevel: () => currentLevel,
    setDefaultLevel: (level) => log.setLevel(level),
    resetLevel: () => { currentLevel = levels.WARN; },
    enableAll: () => { currentLevel = levels.TRACE; },
    disableAll: () => { currentLevel = levels.SILENT; }
};

export default log;