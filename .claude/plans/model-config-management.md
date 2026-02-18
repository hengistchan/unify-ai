# Model Configuration Management - Implementation Plan

## Overview

This document provides a detailed implementation plan for adding model configuration management to unify-ai, based on the architecture defined in `model-config-architecture.md`.

## Phases

- **Phase 1**: Core Infrastructure (Database, Encryption, Types)
- **Phase 2**: ModelManager Implementation
- **Phase 3**: CLI Integration
- **Phase 4**: GUI Integration
- **Phase 5**: Proxy Server (Optional/Future)

---

## Phase 1: Core Infrastructure

### 1.1 Type Definitions

**File**: `packages/core/src/model/types.ts`

```typescript
// Types to define:
- ProviderType
- AIProvider
- ProviderConfig
- ModelInfo
- ModelConfig
- APIKey
- UsageLog
- UsageSummary
- ModelManagerOptions
- CreateProviderInput
- UpdateProviderInput
- SetAPIKeyInput
- LogUsageInput
```

**Dependencies**: None
**Complexity**: Low
**Verification**: TypeScript compiles without errors

### 1.2 Index File

**File**: `packages/core/src/model/index.ts`

Export all types and classes from the model module.

**Dependencies**: None
**Complexity**: Low
**Verification**: Exports are accessible from `@unify-ai/core/model`

### 1.3 Database Layer

**File**: `packages/core/src/model/Database.ts`

```typescript
// Class: ModelDatabase
- Constructor: accepts dbPath option
- Methods:
  - initialize(): Promise<void>
  - run(sql, params): Promise<void>
  - get(sql, params): Promise<Row>
  - all(sql, params): Promise<Row[]>
  - close(): Promise<void>
- Schema migrations on initialize
```

**Dependencies**:
- better-sqlite3 (add to package.json)

**Complexity**: Medium
**Verification**: Unit tests pass for all CRUD operations

**Test File**: `packages/core/src/model/__tests__/Database.test.ts`

### 1.4 Encryption Manager

**File**: `packages/core/src/model/EncryptionManager.ts`

```typescript
// Class: EncryptionManager
- Methods:
  - encrypt(plaintext: string): Promise<EncryptedData>
  - decrypt(data: EncryptedData): Promise<string>
  - isEncryptionAvailable(): boolean
```

**Dependencies**: None (uses Node.js crypto)
**Complexity**: Medium
**Verification**: Round-trip encrypt/decrypt test passes

**Test File**: `packages/core/src/model/__tests__/EncryptionManager.test.ts`

### 1.5 Provider Registry

**File**: `packages/core/src/model/ProviderRegistry.ts`

```typescript
// Built-in provider definitions
export const BUILTIN_PROVIDERS: AIProvider[] = [
  { id: 'openai', ... },
  { id: 'anthropic', ... },
  { id: 'google', ... },
  { id: 'azure-openai', ... },
];
```

**Dependencies**: types.ts
**Complexity**: Low
**Verification**: Registry contains all expected providers

---

## Phase 2: ModelManager Implementation

### 2.1 ModelManager Core

**File**: `packages/core/src/model/ModelManager.ts`

```typescript
// Class: ModelManager
- Constructor(options?: ModelManagerOptions)
- Provider Management:
  - listProviders(): Promise<AIProvider[]>
  - getProvider(id: string): Promise<AIProvider | null>
  - createProvider(input: CreateProviderInput): Promise<AIProvider>
  - updateProvider(id: string, input: UpdateProviderInput): Promise<AIProvider>
  - deleteProvider(id: string): Promise<void>
  - setProviderEnabled(id: string, enabled: boolean): Promise<void>
  - setProviderPriority(id: string, priority: number): Promise<void>
```

**Dependencies**:
- Database.ts
- EncryptionManager.ts
- ProviderRegistry.ts
- types.ts

**Complexity**: High
**Verification**: Unit tests for all provider CRUD operations

**Test File**: `packages/core/src/model/__tests__/ModelManager.test.ts`

### 2.2 API Key Management

**File**: `packages/core/src/model/ModelManager.ts` (continued)

```typescript
// API Key Management (add to ModelManager class)
- setAPIKey(input: SetAPIKeyInput): Promise<APIKey>
- getAPIKey(providerId: string, keyName?: string): Promise<string | null>
- hasValidAPIKey(providerId: string): Promise<boolean>
- validateAPIKey(providerId: string): Promise<boolean>
- deleteAPIKey(providerId: string, keyName?: string): Promise<void>
```

**Dependencies**: EncryptionManager
**Complexity**: Medium-High
**Verification**: API key encrypt/decrypt/validate tests pass

### 2.3 Model Management

**File**: `packages/core/src/model/ModelManager.ts` (continued)

```typescript
// Model Management (add to ModelManager class)
- listModels(providerId: string): Promise<ModelInfo[]>
- getModel(providerId: string, modelId: string): Promise<ModelInfo | null>
- updateModel(providerId: string, modelId: string, config: Partial<ModelConfig>): Promise<ModelInfo>
- getDefaultModel(providerId: string): Promise<ModelInfo | null>
- setDefaultModel(providerId: string, modelId: string): Promise<void>
```

**Dependencies**: None additional
**Complexity**: Medium
**Verification**: Model CRUD tests pass

### 2.4 Usage Tracking

**File**: `packages/core/src/model/UsageTracker.ts`

```typescript
// Class: UsageTracker
- logUsage(input: LogUsageInput): Promise<UsageLog>
- getLogs(filters?: UsageLogFilters): Promise<UsageLog[]>
- getSummary(filters?: UsageLogFilters): Promise<UsageSummary>
```

**Dependencies**: Database.ts
**Complexity**: Medium
**Verification**: Usage logging and aggregation tests pass

**Test File**: `packages/core/src/model/__tests__/UsageTracker.test.ts`

### 2.5 Provider Selection

**File**: `packages/core/src/model/ModelManager.ts` (continued)

```typescript
// Provider Selection (add to ModelManager class)
- getActiveProvider(): Promise<AIProvider | null>
- getActiveProviders(): Promise<AIProvider[]>
```

**Dependencies**: None additional
**Complexity**: Low
**Verification**: Priority-based selection tests pass

### 2.6 Core Package Integration

**File**: `packages/core/src/index.ts`

Add exports:
```typescript
export * from './model';
```

**File**: `packages/core/package.json`

Add export:
```json
{
  "exports": {
    "./model": {
      "import": "./dist/model/index.js",
      "types": "./dist/model/index.d.ts"
    }
  }
}
```

**Dependencies**: None
**Complexity**: Low
**Verification**: Can import from `@unify-ai/core/model`

---

## Phase 3: CLI Integration

### 3.1 Models Command

**File**: `packages/cli/src/commands/models.ts`

```typescript
// Main command: 'models'
// Subcommands:
- list: List all providers
- add: Add new provider
- remove: Remove provider
- enable: Enable provider
- disable: Disable provider
- set-key: Set API key
- validate-key: Validate API key
- default: Set default provider/model
- usage: Show usage statistics
- models: List models for provider
```

**Dependencies**:
- @unify-ai/core/model
- commander

**Complexity**: Medium
**Verification**: Manual CLI testing, unit tests

**Test File**: `packages/cli/src/__tests__/commands/models.test.ts`

### 3.2 Output Formatting

**File**: `packages/cli/src/output/formatter.ts`

Add formatters for provider/model data:
```typescript
- formatProviderList(providers): string
- formatProviderDetail(provider): string
- formatUsageSummary(summary): string
- formatModelList(models): string
```

**Dependencies**: None additional
**Complexity**: Low
**Verification**: Output formatting tests pass

### 3.3 CLI Index Integration

**File**: `packages/cli/src/index.ts`

```typescript
import { modelsCommand } from './commands/models.js';
program.addCommand(modelsCommand);
```

**Dependencies**: models.ts
**Complexity**: Low
**Verification**: `unify-ai models --help` shows help

### 3.4 Package Dependencies

**File**: `packages/cli/package.json`

Add dependency:
```json
{
  "dependencies": {
    "@unify-ai/core": "workspace:*"
  }
}
```

---

## Phase 4: GUI Integration

### 4.1 IPC Channels

**File**: `packages/gui/electron/ipc/channels.ts`

Add model channels:
```typescript
// Model management
GET_PROVIDERS: 'get-providers',
CREATE_PROVIDER: 'create-provider',
UPDATE_PROVIDER: 'update-provider',
DELETE_PROVIDER: 'delete-provider',
SET_PROVIDER_ENABLED: 'set-provider-enabled',

// API keys
SET_API_KEY: 'set-api-key',
VALIDATE_API_KEY: 'validate-api-key',
DELETE_API_KEY: 'delete-api-key',
HAS_VALID_API_KEY: 'has-valid-api-key',

// Models
GET_MODELS: 'get-models',
UPDATE_MODEL: 'update-model',
SET_DEFAULT_MODEL: 'set-default-model',

// Usage
GET_USAGE_LOGS: 'get-usage-logs',
GET_USAGE_SUMMARY: 'get-usage-summary',

// Selection
GET_ACTIVE_PROVIDER: 'get-active-provider',
```

**Dependencies**: None
**Complexity**: Low
**Verification**: Channels defined correctly

### 4.2 IPC Handlers

**File**: `packages/gui/electron/ipc/model.ts`

```typescript
// Handler functions:
- handleGetProviders
- handleCreateProvider
- handleUpdateProvider
- handleDeleteProvider
- handleSetAPIKey
- handleValidateAPIKey
- handleGetUsageLogs
- handleGetUsageSummary
```

**Dependencies**:
- @unify-ai/core/model
- ModelManager instance

**Complexity**: Medium
**Verification**: IPC handlers respond correctly

### 4.3 IPC Registration

**File**: `packages/gui/electron/ipc/index.ts`

```typescript
export function registerModelIpcHandlers(modelManager: ModelManager): void {
  ipcMain.handle(IPC_CHANNELS.GET_PROVIDERS, handleGetProviders);
  // ... more handlers
}
```

**Dependencies**: model.ts
**Complexity**: Low
**Verification**: Handlers registered on app start

### 4.4 Electron Preload

**File**: `packages/gui/electron/preload.ts`

Add model API methods:
```typescript
model: {
  getProviders: () => ipcRenderer.invoke(IPC_CHANNELS.GET_PROVIDERS),
  createProvider: (input) => ipcRenderer.invoke(IPC_CHANNELS.CREATE_PROVIDER, input),
  // ... more methods
}
```

**Dependencies**: channels.ts
**Complexity**: Low
**Verification**: window.electronAPI.model is available

### 4.5 Type Definitions

**File**: `packages/gui/src/types/electron.d.ts`

Add model types to ElectronAPI interface:
```typescript
interface ElectronAPI {
  // Existing methods...

  model: {
    getProviders(): Promise<AIProvider[]>;
    createProvider(input: CreateProviderInput): Promise<AIProvider>;
    // ... more method signatures
  };
}
```

**Dependencies**: None
**Complexity**: Low
**Verification**: TypeScript compiles

### 4.6 Zustand Store

**File**: `packages/gui/src/stores/modelStore.ts`

```typescript
interface ModelState {
  providers: AIProvider[];
  activeProvider: AIProvider | null;
  models: Map<string, ModelInfo[]>;
  usageSummary: UsageSummary | null;
  loading: boolean;
  error: string | null;

  // Actions
  loadProviders: () => Promise<void>;
  createProvider: (input: CreateProviderInput) => Promise<void>;
  updateProvider: (id: string, input: UpdateProviderInput) => Promise<void>;
  deleteProvider: (id: string) => Promise<void>;
  setAPIKey: (providerId: string, key: string) => Promise<void>;
  validateAPIKey: (providerId: string) => Promise<boolean>;
  loadUsageSummary: (providerId?: string) => Promise<void>;
}

export const useModelStore = create<ModelState>()(/* ... */);
```

**Dependencies**: None
**Complexity**: Medium
**Verification**: State updates correctly

**Test File**: `packages/gui/src/__tests__/stores/modelStore.test.ts`

### 4.7 Models Page

**File**: `packages/gui/src/pages/Models.tsx`

```typescript
export function ModelsPage(): JSX.Element {
  // Provider list sidebar
  // Provider detail panel
  // Usage dashboard
  // Add/Edit provider dialogs
}
```

**Dependencies**:
- modelStore.ts
- UI components (Button, Card, Modal, etc.)

**Complexity**: High
**Verification**: Page renders correctly, interactions work

**Test File**: `packages/gui/src/__tests__/pages/Models.test.tsx`

### 4.8 Provider Components

**File**: `packages/gui/src/components/model/ProviderList.tsx`

**File**: `packages/gui/src/components/model/ProviderDetail.tsx`

**File**: `packages/gui/src/components/model/ProviderDialog.tsx`

**File**: `packages/gui/src/components/model/APIKeyDialog.tsx`

**File**: `packages/gui/src/components/model/UsageDashboard.tsx`

**Dependencies**: modelStore.ts
**Complexity**: Medium each
**Verification**: Components render and interact correctly

### 4.9 App Router Update

**File**: `packages/gui/src/App.tsx`

Add route:
```typescript
<Route path="/models" element={<ModelsPage />} />
```

**Dependencies**: Models.tsx
**Complexity**: Low
**Verification**: `/models` route works

### 4.10 Sidebar Navigation

**File**: `packages/gui/src/components/layout/Sidebar.tsx`

Add Models menu item:
```typescript
{ path: '/models', icon: CpuIcon, label: 'Models' }
```

**Dependencies**: None
**Complexity**: Low
**Verification**: Models menu item appears

### 4.11 GUI Package Dependencies

**File**: `packages/gui/package.json`

Add dependency:
```json
{
  "dependencies": {
    "@unify-ai/core": "workspace:*"
  }
}
```

---

## Phase 5: Proxy Server (Future)

### 5.1 Proxy Server

**File**: `packages/core/src/model/ProxyServer.ts`

```typescript
export class ProxyServer {
  constructor(modelManager: ModelManager, config?: ProxyConfig);
  start(): Promise<void>;
  stop(): Promise<void>;
  getProxyUrl(): string;
}
```

**Dependencies**:
- ModelManager
- Node.js http module

**Complexity**: High
**Verification**: Proxy intercepts and forwards requests

**Test File**: `packages/core/src/model/__tests__/ProxyServer.test.ts`

### 5.2 Proxy IPC

**File**: `packages/gui/electron/ipc/channels.ts`

Add proxy channels:
```typescript
START_PROXY: 'start-proxy',
STOP_PROXY: 'stop-proxy',
GET_PROXY_STATUS: 'get-proxy-status',
```

### 5.3 Proxy UI

**File**: `packages/gui/src/components/model/ProxySettings.tsx`

Proxy configuration panel in Settings page.

---

## File List Summary

### Phase 1: Core Infrastructure

| File | Type | Complexity |
|------|------|------------|
| `packages/core/src/model/types.ts` | New | Low |
| `packages/core/src/model/index.ts` | New | Low |
| `packages/core/src/model/Database.ts` | New | Medium |
| `packages/core/src/model/EncryptionManager.ts` | New | Medium |
| `packages/core/src/model/ProviderRegistry.ts` | New | Low |
| `packages/core/src/model/__tests__/Database.test.ts` | Test | Low |
| `packages/core/src/model/__tests__/EncryptionManager.test.ts` | Test | Low |
| `packages/core/package.json` | Modified | Low |

### Phase 2: ModelManager

| File | Type | Complexity |
|------|------|------------|
| `packages/core/src/model/ModelManager.ts` | New | High |
| `packages/core/src/model/UsageTracker.ts` | New | Medium |
| `packages/core/src/model/__tests__/ModelManager.test.ts` | Test | Medium |
| `packages/core/src/model/__tests__/UsageTracker.test.ts` | Test | Low |
| `packages/core/src/index.ts` | Modified | Low |

### Phase 3: CLI

| File | Type | Complexity |
|------|------|------------|
| `packages/cli/src/commands/models.ts` | New | Medium |
| `packages/cli/src/__tests__/commands/models.test.ts` | Test | Low |
| `packages/cli/src/output/formatter.ts` | Modified | Low |
| `packages/cli/src/index.ts` | Modified | Low |
| `packages/cli/package.json` | Modified | Low |

### Phase 4: GUI

| File | Type | Complexity |
|------|------|------------|
| `packages/gui/electron/ipc/channels.ts` | Modified | Low |
| `packages/gui/electron/ipc/model.ts` | New | Medium |
| `packages/gui/electron/ipc/index.ts` | Modified | Low |
| `packages/gui/electron/preload.ts` | Modified | Low |
| `packages/gui/src/types/electron.d.ts` | Modified | Low |
| `packages/gui/src/stores/modelStore.ts` | New | Medium |
| `packages/gui/src/pages/Models.tsx` | New | High |
| `packages/gui/src/components/model/ProviderList.tsx` | New | Medium |
| `packages/gui/src/components/model/ProviderDetail.tsx` | New | Medium |
| `packages/gui/src/components/model/ProviderDialog.tsx` | New | Medium |
| `packages/gui/src/components/model/APIKeyDialog.tsx` | New | Medium |
| `packages/gui/src/components/model/UsageDashboard.tsx` | New | Medium |
| `packages/gui/src/App.tsx` | Modified | Low |
| `packages/gui/src/components/layout/Sidebar.tsx` | Modified | Low |
| `packages/gui/src/__tests__/stores/modelStore.test.ts` | Test | Low |
| `packages/gui/src/__tests__/pages/Models.test.tsx` | Test | Medium |
| `packages/gui/package.json` | Modified | Low |

### Phase 5: Proxy (Future)

| File | Type | Complexity |
|------|------|------------|
| `packages/core/src/model/ProxyServer.ts` | New | High |
| `packages/core/src/model/__tests__/ProxyServer.test.ts` | Test | Medium |
| `packages/gui/src/components/model/ProxySettings.tsx` | New | Medium |

---

## Dependencies

### External Dependencies

Add to `packages/core/package.json`:
```json
{
  "dependencies": {
    "better-sqlite3": "^11.0.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.0"
  }
}
```

### Internal Dependencies

```
Phase 1 (types, Database, Encryption) → Phase 2 (ModelManager) → Phase 3 (CLI)
                                           ↓
                                       Phase 4 (GUI)
                                           ↓
                                       Phase 5 (Proxy)
```

---

## Verification Steps

### After Phase 1

```bash
# Build core package
cd packages/core && pnpm build

# Run tests
pnpm test

# Verify types
pnpm typecheck
```

### After Phase 2

```bash
# Run ModelManager tests
pnpm test packages/core/src/model/__tests__/ModelManager.test.ts

# Test importing
node -e "import('@unify-ai/core/model').then(m => console.log(Object.keys(m)))"
```

### After Phase 3

```bash
# Build CLI
cd packages/cli && pnpm build

# Test CLI commands
./bin/unify-ai.js models list
./bin/unify-ai.js models add openai --name "OpenAI" --api-key "sk-test"
./bin/unify-ai.js models usage --format json
```

### After Phase 4

```bash
# Build GUI
cd packages/gui && pnpm build

# Run GUI
pnpm gui

# Verify in app:
# - Sidebar shows "Models" menu item
# - /models route loads Models page
# - Provider list shows built-in providers
# - Can add new provider
# - Can set API key
# - Usage dashboard shows data
```

### After Phase 5

```bash
# Test proxy
curl http://localhost:8787/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "gpt-4o", "messages": [{"role": "user", "content": "Hello"}]}'
```

---

## Complexity Estimates

| Phase | Total Complexity | Notes |
|-------|-----------------|-------|
| Phase 1 | Medium | Foundation layer, mostly boilerplate |
| Phase 2 | High | Core business logic, most important to get right |
| Phase 3 | Medium | CLI is straightforward, mostly plumbing |
| Phase 4 | High | GUI has most surface area, many components |
| Phase 5 | High | Proxy is complex but optional |

---

## Risks and Mitigations

### Risk 1: SQLite in Electron

**Risk**: SQLite native module compatibility across platforms
**Mitigation**: Use `better-sqlite3` which has good Electron support, test on all platforms

### Risk 2: Encryption Portability

**Risk**: `safeStorage` only works in Electron main process
**Mitigation**: Provide fallback encryption for CLI/non-Electron environments

### Risk 3: API Key Validation

**Risk**: Different providers have different validation endpoints
**Mitigation**: Implement provider-specific validation, start with common patterns

### Risk 4: GUI State Complexity

**Risk**: Many moving parts in GUI state management
**Mitigation**: Use Zustand with clear slices, comprehensive tests

---

## Success Criteria

### MVP (Phases 1-4)

- [ ] Can add/configure multiple AI providers
- [ ] API keys are encrypted at rest
- [ ] Can switch active provider
- [ ] Usage tracking works and shows costs
- [ ] CLI commands work for all operations
- [ ] GUI shows providers, models, usage
- [ ] All tests pass
- [ ] Documentation updated

### Full Release (Phase 5)

- [ ] Proxy server starts and stops reliably
- [ ] AI tools can connect through proxy
- [ ] Usage is logged automatically
- [ ] Real-time monitoring works
