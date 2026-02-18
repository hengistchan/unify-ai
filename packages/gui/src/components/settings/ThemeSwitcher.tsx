import { Sun, Moon, Monitor } from 'lucide-react';
import { useThemeStore, ThemeMode } from '@/stores/themeStore';
import clsx from 'clsx';

interface ThemeOption {
  value: ThemeMode;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const themeOptions: ThemeOption[] = [
  {
    value: 'light',
    label: 'Light',
    icon: <Sun className="w-5 h-5" />,
    description: 'Light theme',
  },
  {
    value: 'dark',
    label: 'Dark',
    icon: <Moon className="w-5 h-5" />,
    description: 'Dark theme',
  },
  {
    value: 'system',
    label: 'System',
    icon: <Monitor className="w-5 h-5" />,
    description: 'Follow system preference',
  },
];

export function ThemeSwitcher() {
  const { mode, setMode } = useThemeStore();

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-text-secondary">Theme</label>
      <div className="grid grid-cols-3 gap-2">
        {themeOptions.map(option => (
          <button
            key={option.value}
            onClick={() => setMode(option.value)}
            className={clsx(
              'flex flex-col items-center gap-2 p-4 rounded-lg border transition-all',
              'hover:border-border-hover hover:bg-bg-hover',
              'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-bg-primary',
              mode === option.value ? 'border-primary bg-primary-muted' : 'border-border'
            )}
          >
            <div
              className={clsx(
                'transition-colors',
                mode === option.value ? 'text-primary' : 'text-text-secondary'
              )}
            >
              {option.icon}
            </div>
            <span
              className={clsx(
                'text-sm font-medium',
                mode === option.value ? 'text-primary' : 'text-text-primary'
              )}
            >
              {option.label}
            </span>
          </button>
        ))}
      </div>
      <p className="text-xs text-text-tertiary">
        {themeOptions.find(o => o.value === mode)?.description}
      </p>
    </div>
  );
}
