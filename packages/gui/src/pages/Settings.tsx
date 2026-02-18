/**
 * Settings Page
 * Application settings and preferences
 */

import {
  Settings as SettingsIcon,
  Moon,
  RotateCcw,
  Zap,
  Database,
  Info,
  Github,
  ExternalLink,
} from 'lucide-react';
import { Button, Card } from '@/components/common';
import { ThemeSwitcher } from '@/components/settings/ThemeSwitcher';
import { useAppStore, selectSettings } from '@/stores/appStore';
import { cn } from '@/lib/utils';

export function Settings() {
  const settings = useAppStore(selectSettings);
  const { updateSettings, addToast } = useAppStore();

  const handleToggle = (key: keyof typeof settings) => {
    updateSettings({ [key]: !settings[key] });
    addToast({
      type: 'success',
      title: 'Setting updated',
      message: `${key} has been ${!settings[key] ? 'enabled' : 'disabled'}`,
    });
  };

  const handleReset = () => {
    updateSettings({
      autoSync: true,
      backupEnabled: true,
      animationsEnabled: true,
    });
    addToast({
      type: 'success',
      title: 'Settings reset',
      message: 'All settings have been reset to defaults',
    });
  };

  return (
    <div className="max-w-2xl mx-auto p-6 animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary mb-1">Settings</h1>
        <p className="text-text-tertiary">Configure your Unify AI preferences</p>
      </div>

      {/* General Settings */}
      <Card className="mb-6">
        <Card.Header
          title="General"
          subtitle="Core application settings"
          icon={<SettingsIcon className="w-5 h-5" />}
        />
        <Card.Body className="p-0">
          {/* Auto Sync */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-3">
              <RotateCcw className="w-5 h-5 text-text-tertiary" />
              <div>
                <p className="text-sm font-medium text-text-secondary">Auto Sync</p>
                <p className="text-xs text-text-tertiary">Automatically sync configurations on file changes</p>
              </div>
            </div>
            <button
              onClick={() => handleToggle('autoSync')}
              className={cn(
                'relative w-11 h-6 rounded-full transition-colors',
                settings.autoSync ? 'bg-primary' : 'bg-bg-tertiary'
              )}
            >
              <span
                className={cn(
                  'absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform',
                  settings.autoSync && 'translate-x-5'
                )}
              />
            </button>
          </div>

          {/* Backup */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-3">
              <Database className="w-5 h-5 text-text-tertiary" />
              <div>
                <p className="text-sm font-medium text-text-secondary">Backup Enabled</p>
                <p className="text-xs text-text-tertiary">Create backups before overwriting config files</p>
              </div>
            </div>
            <button
              onClick={() => handleToggle('backupEnabled')}
              className={cn(
                'relative w-11 h-6 rounded-full transition-colors',
                settings.backupEnabled ? 'bg-primary' : 'bg-bg-tertiary'
              )}
            >
              <span
                className={cn(
                  'absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform',
                  settings.backupEnabled && 'translate-x-5'
                )}
              />
            </button>
          </div>

          {/* Animations */}
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <Zap className="w-5 h-5 text-text-tertiary" />
              <div>
                <p className="text-sm font-medium text-text-secondary">Animations</p>
                <p className="text-xs text-text-tertiary">Enable UI animations and transitions</p>
              </div>
            </div>
            <button
              onClick={() => handleToggle('animationsEnabled')}
              className={cn(
                'relative w-11 h-6 rounded-full transition-colors',
                settings.animationsEnabled ? 'bg-primary' : 'bg-bg-tertiary'
              )}
            >
              <span
                className={cn(
                  'absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform',
                  settings.animationsEnabled && 'translate-x-5'
                )}
              />
            </button>
          </div>
        </Card.Body>
      </Card>

      {/* Appearance */}
      <Card className="mb-6">
        <Card.Header
          title="Appearance"
          subtitle="Customize the look and feel"
          icon={<Moon className="w-5 h-5" />}
        />
        <Card.Body className="p-4">
          <ThemeSwitcher />
        </Card.Body>
      </Card>

      {/* Reset Settings */}
      <div className="flex justify-end mb-8">
        <Button variant="secondary" onClick={handleReset}>
          Reset to Defaults
        </Button>
      </div>

      {/* About Section */}
      <Card>
        <Card.Header
          title="About"
          subtitle="Application information"
          icon={<Info className="w-5 h-5" />}
        />
        <Card.Body>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-tertiary">Version</span>
              <span className="text-sm text-text-secondary font-mono">0.0.1</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-tertiary">License</span>
              <span className="text-sm text-text-secondary">MIT</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-tertiary">Repository</span>
              <a
                href="https://github.com/unify-ai/unify-ai"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm text-primary hover:text-primary-hover transition-colors"
              >
                <Github className="w-4 h-4" />
                unify-ai/unify-ai
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </Card.Body>
      </Card>
    </div>
  );
}
