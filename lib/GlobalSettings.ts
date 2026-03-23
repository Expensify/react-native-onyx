/**
 * Stores settings from Onyx.init globally so they can be made accessible by other parts of the library.
 */
type GlobalSettings = {
    enablePerformanceMetrics: boolean;
};

const globalSettings: GlobalSettings = {
    enablePerformanceMetrics: false,
};

const listeners = new Set<(settings: GlobalSettings) => void>();
function addGlobalSettingsChangeListener(listener: (settings: GlobalSettings) => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

function notifyListeners() {
    for (const listener of listeners) listener(globalSettings);
}

function setPerformanceMetricsEnabled(enabled: boolean) {
    globalSettings.enablePerformanceMetrics = enabled;
    notifyListeners();
}

function isPerformanceMetricsEnabled() {
    return globalSettings.enablePerformanceMetrics;
}

export {setPerformanceMetricsEnabled, isPerformanceMetricsEnabled, addGlobalSettingsChangeListener};
