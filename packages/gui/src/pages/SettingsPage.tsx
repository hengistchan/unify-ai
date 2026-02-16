import { useAppStore } from '../stores/appStore';

export function SettingsPage() {
  const { settings, updateSettings } = useAppStore();

  const handleToggle = (key: keyof typeof settings) => {
    updateSettings({ [key]: !settings[key] });
  };

  return (
    <div className="h-full p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-text-primary mb-2">
            Settings
          </h1>
          <p className="text-text-secondary">
            Configure Unify AI behavior and preferences.
          </p>
        </div>

        {/* Settings Sections */}
        <div className="space-y-6">
          {/* General Settings */}
          <div className="card">
            <h2 className="font-semibold text-text-primary mb-4">General</h2>

            <div className="space-y-4">
              {/* Auto Sync */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-text-primary">Auto Sync</h3>
                  <p className="text-sm text-text-tertiary">
                    Automatically sync configurations when changes are detected.
                  </p>
                </div>
                <button
                  onClick={() => handleToggle('autoSync')}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    settings.autoSync ? 'bg-primary' : 'bg-bg-tertiary'
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      settings.autoSync ? 'translate-x-5' : ''
                    }`}
                  />
                </button>
              </div>

              {/* Backup */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-text-primary">Backup Before Sync</h3>
                  <p className="text-sm text-text-tertiary">
                    Create backups of existing configurations before overwriting.
                  </p>
                </div>
                <button
                  onClick={() => handleToggle('backupEnabled')}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    settings.backupEnabled ? 'bg-primary' : 'bg-bg-tertiary'
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      settings.backupEnabled ? 'translate-x-5' : ''
                    }`}
                  />
                </button>
              </div>

              {/* Animations */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-text-primary">Animations</h3>
                  <p className="text-sm text-text-tertiary">
                    Enable UI animations and transitions.
                  </p>
                </div>
                <button
                  onClick={() => handleToggle('animationsEnabled')}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    settings.animationsEnabled ? 'bg-primary' : 'bg-bg-tertiary'
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      settings.animationsEnabled ? 'translate-x-5' : ''
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* About Section */}
          <div className="card">
            <h2 className="font-semibold text-text-primary mb-4">About</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-text-tertiary">Version</span>
                <span className="text-text-secondary">0.1.0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-tertiary">Electron</span>
                <span className="text-text-secondary">28.0.0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-tertiary">React</span>
                <span className="text-text-secondary">18.3.1</span>
              </div>
            </div>
          </div>

          {/* Storage Info */}
          <div className="card">
            <h2 className="font-semibold text-text-primary mb-4">Storage</h2>
            <p className="text-sm text-text-tertiary mb-3">
              Your settings and recent projects are stored locally in your browser.
            </p>
            <button
              onClick={() => localStorage.clear()}
              className="text-sm text-error hover:text-error/80 transition-colors"
            >
              Clear local storage
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
