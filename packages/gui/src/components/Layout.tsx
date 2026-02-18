import { ReactNode, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { Home, FolderOpen, Settings, RefreshCw, Sparkles } from 'lucide-react';
import { useAppStore } from '../stores/appStore';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { currentProject, detectedTools, syncStatus, unifiedConfig } = useAppStore();

  // Log current state to console
  useEffect(() => {
    console.log('\n========================================');
    console.log('  Unify AI - State');
    console.log('========================================');
    console.log('📁 Project:', currentProject || 'No project selected');
    console.log(
      '🔧 Detected Tools:',
      detectedTools.length > 0
        ? detectedTools
            .filter(t => t.detected)
            .map(t => `${t.name} (${t.id})`)
            .join(', ') || 'none'
        : 'Not scanned yet'
    );
    console.log('📊 Sync Status:', syncStatus);
    console.log('📝 Config Loaded:', unifiedConfig ? 'Yes' : 'No');
    if (unifiedConfig) {
      console.log('   - Rules:', unifiedConfig.rules?.length || 0);
      console.log('   - MCP Servers:', unifiedConfig.mcp?.servers?.length || 0);
      console.log('   - Commands:', unifiedConfig.commands?.length || 0);
    }
    console.log('========================================');

    // Log full UnifiedConfig
    if (unifiedConfig) {
      console.log('\n📋 UnifiedConfig (Full):');
      console.log('────────────────────────────────');
      console.log(JSON.stringify(unifiedConfig, null, 2));
      console.log('────────────────────────────────\n');
    }
  }, [currentProject, detectedTools, syncStatus, unifiedConfig]);

  const navItems = [
    { to: '/', icon: Home, label: 'Home' },
    { to: '/project', icon: FolderOpen, label: 'Project' },
    { to: '/settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <div className="flex h-screen bg-bg-primary">
      {/* Sidebar */}
      <aside className="w-64 bg-bg-secondary border-r border-border flex flex-col">
        {/* Logo */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            <h1 className="text-xl font-bold text-text-primary">Unify AI</h1>
          </div>
          <p className="text-sm text-text-tertiary">Config Manager</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2">
          <ul className="space-y-1">
            {navItems.map(item => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-md transition-colors duration-fast ${
                      isActive
                        ? 'bg-primary-muted text-primary'
                        : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
                    }`
                  }
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Folder info */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-2 text-sm text-text-secondary mb-2">
            <FolderOpen className="w-4 h-4" />
            <span className="truncate">{currentProject || 'No project selected'}</span>
          </div>
          {detectedTools.length > 0 && (
            <div className="text-xs text-text-tertiary">
              {detectedTools.length} tool{detectedTools.length !== 1 ? 's' : ''} detected
            </div>
          )}
          {syncStatus === 'syncing' && (
            <div className="flex items-center gap-2 text-sm text-primary mt-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Syncing...</span>
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-bg-primary">{children}</main>
    </div>
  );
}
