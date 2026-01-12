/**
 * Stores settings from Onyx.init globally so they can be made accessible by other parts of the library.
 */

const globalSettings = {
    enablePerformanceMetrics: false,
};

type GlobalSettings = typeof globalSettings;

const listeners = new Set<(settings: GlobalSettings) => unknown>();
function addGlobalSettingsChangeListener(listener: (settings: GlobalSettings) => unknown) {
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
