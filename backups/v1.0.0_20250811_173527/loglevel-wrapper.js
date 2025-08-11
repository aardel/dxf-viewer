// Simple loglevel wrapper for Electron environment
// Create a minimal logger interface to avoid import issues
const loglevel = {
    trace: console.trace.bind(console),
    debug: console.debug.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    setLevel: (level) => {
        // Simple level implementation - could be enhanced if needed
        console.log('Log level set to:', level);
    }
};

export default loglevel;