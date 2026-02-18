# Model Configuration Management - GUI Design Document

## Overview

This document describes the user interface design for the model configuration management feature in unify-ai GUI. The design follows existing patterns from Project.tsx, Settings.tsx, and UnifiedConfigDialog.tsx while providing an intuitive experience for managing AI providers, API keys, and usage tracking.

---

## 1. Page Layout & Navigation

### 1.1 Navigation Placement

The "Models" page will be accessible via:
1. **Sidebar Navigation**: A new "Models" menu item with Cpu icon (from lucide-react)
2. **Top-level Route**: `/models` path in React Router

```
Sidebar Navigation Order:
- Tools (existing, collapsible section)
  - Cursor
  - Claude Code
  - ...
- Models (NEW)          <- Between Tools and Settings
- Settings (existing)
```

**Rationale**: Models is a cross-cutting concern that applies to all tools, making it a top-level navigation item like Settings.

### 1.2 Page Layout Structure

```
+------------------------------------------------------------------+
|  Header: "Model Providers"                    [+ Add Provider]   |
+------------------------------------------------------------------+
|          |                              |                          |
|  Sidebar |     Main Content Area        |     Usage Panel         |
|          |                              |      (Collapsible)      |
|  (250px) |        (flex-1)              |        (300px)          |
|          |                              |                          |
| Provider |  [Provider Detail or         |  [Usage Dashboard       |
|  List    |   Welcome State]             |   or Mini Stats]        |
|          |                              |                          |
|  - OpenAI|                              |                          |
|  - Anthro|                              |                          |
|  - ...   |                              |                          |
|          |                              |                          |
+------------------------------------------------------------------+
```

**Responsive Behavior**:
- Minimum window width: 1000px
- Below 1200px: Usage panel collapses to icon-only mode
- Below 1000px: Show warning, prevent further shrinking
- Usage panel can be manually toggled (open/closed)

### 1.3 Component Hierarchy

```
pages/Models.tsx
├── ProviderSidebar/
│   ├── ProviderList.tsx
│   ├── ProviderListItem.tsx
│   └── AddProviderButton.tsx
├── ProviderDetail/
│   ├── ProviderHeader.tsx
│   ├── APIKeySection.tsx
│   ├── ModelsSection.tsx
│   └── ProviderSettings.tsx
├── UsagePanel/
│   ├── UsageSummary.tsx
│   ├── UsageChart.tsx
│   └── UsageFilters.tsx
└── Dialogs/
    ├── AddProviderDialog.tsx
    ├── EditProviderDialog.tsx
    ├── APIKeyDialog.tsx
    └── ModelConfigDialog.tsx
```

---

## 2. Provider Management UI

### 2.1 Provider List (Sidebar)

**Wireframe**:

```
+---------------------------+
| PROVIDERS                 |
|                           |
| +-[Active] OpenAI    ✓---+  <- Active provider indicator
| |  GPT-4o                  |     (green dot, bold text)
| |  Key: ••••••••••••       |
| +-------------------------+
|                           |
| + Anthropic           ✓---+  <- Has valid API key
| |  Claude Sonnet 4.5       |
| |  Key: ••••••••••••       |
| +-------------------------+
|                           |
| + DeepSeek            ⚠---+  <- API key not validated
| |  deepseek-chat           |
| |  Key: Not set            |
| +-------------------------+
|                           |
| + Azure OpenAI        ✗---+  <- Disabled
|   Disabled                 |
|                           |
+---------------------------+
|                           |
|  [+ Add Provider]         |
|                           |
+---------------------------+
```

**ProviderListItem Component Design**:

```tsx
interface ProviderListItemProps {
  provider: AIProvider;
  isActive: boolean;
  hasValidKey: boolean;
  isSelected: boolean;
  onClick: () => void;
}

// Visual States:
// - Active: Green dot, bold text, subtle glow
// - Enabled + Valid Key: Check icon
// - Enabled + Invalid Key: Warning icon
// - Disabled: Grayed out, X icon
```

**Status Indicators**:

| Status | Icon | Color | Description |
|--------|------|-------|-------------|
| Active Provider | Green filled circle | `text-success` | Currently selected as active |
| Has Valid Key | Check | `text-success` | API key validated successfully |
| Key Not Validated | Warning triangle | `text-warning` | Key set but not validated |
| No Key | Minus | `text-text-tertiary` | No API key configured |
| Disabled | X | `text-error` | Provider is disabled |

### 2.2 Add Provider Flow

**Wireframe**:

```
Step 1: Select Provider Type
+------------------------------------------+
| Add Provider                         [X]  |
+------------------------------------------+
|                                          |
| Select a provider type:                  |
|                                          |
| +----------------+  +----------------+   |
| |   [OpenAI]     |  |  [Anthropic]   |   |
| |   OpenAI       |  |  Anthropic     |   |
| +----------------+  +----------------+   |
|                                          |
| +----------------+  +----------------+   |
| | [Azure]        |  | [DeepSeek]     |   |
| | Azure OpenAI   |  |  DeepSeek      |   |
| +----------------+  +----------------+   |
|                                          |
| +----------------+  +----------------+   |
| | [Custom]       |  | [Google]       |   |
| | Custom Provider|  | Google AI      |   |
| +----------------+  +----------------+   |
|                                          |
|              [Cancel]  [Continue]        |
+------------------------------------------+

Step 2: Configure Provider
+------------------------------------------+
| Configure OpenAI                    [X]  |
+------------------------------------------+
|                                          |
| Name                                     |
| +--------------------------------------+ |
| | My OpenAI                            | |
| +--------------------------------------+ |
|                                          |
| Base URL (optional)                      |
| +--------------------------------------+ |
| | https://api.openai.com/v1            | |
| +--------------------------------------+ |
| [?] Use custom endpoint for proxies      |
|                                          |
| API Key                                  |
| +--------------------------------------+ |
| | ••••••••••••••••••••••••••••• [👁]   | |
| +--------------------------------------+ |
| [Validate Key]                           |
|                                          |
| Default Model                            |
| +--------------------------------------+ |
| | GPT-4o                         [▼]   | |
| +--------------------------------------+ |
|                                          |
|              [Cancel]  [Add Provider]    |
+------------------------------------------+

Step 3: Success State
+------------------------------------------+
| Provider Added                      [X]  |
+------------------------------------------+
|                                          |
|           [Check Circle Icon]            |
|                                          |
|        OpenAI has been added!            |
|                                          |
| Your API key has been encrypted and      |
| stored securely.                         |
|                                          |
| [Set as Active Provider]  [Done]         |
+------------------------------------------+
```

**Validation Flow**:

1. User enters API key
2. Clicks "Validate Key" button
3. Button shows loading spinner
4. On success:
   - Green checkmark appears
   - "API key validated" message
   - Models list is fetched
5. On failure:
   - Red error message appears
   - Suggests checking the key
   - User can still save (marked as unvalidated)

### 2.3 Edit Provider

**Approach**: Inline editing in the detail panel with modal for advanced settings.

**Wireframe**:

```
+------------------------------------------+
| OpenAI                     [Edit] [···]  |
+------------------------------------------+
|                                          |
| Status                                   |
| [●] Enabled                              |
|                                          |
| API Key                                  |
| +--------------------------------------+ |
| | ••••••••••••••••••• [Validate] [👁]  | |
| +--------------------------------------+ |
| Status: Validated 2 hours ago            |
|                                          |
| Base URL                                 |
| +--------------------------------------+ |
| | https://api.openai.com/v1            | |
| +--------------------------------------+ |
|                                          |
| Default Model                            |
| +--------------------------------------+ |
| | GPT-4o                         [▼]   | |
| +--------------------------------------+ |
|                                          |
| Priority: 100                            |
|                                          |
+------------------------------------------+
```

**Editable Fields**:

| Field | Editable | Method |
|-------|----------|--------|
| Name | Yes | Inline edit |
| API Key | Yes | Dialog (re-entry required) |
| Base URL | Yes | Inline edit |
| Default Model | Yes | Dropdown |
| Priority | Yes | Number input |
| Enabled | Yes | Toggle switch |

**Non-editable Fields**:
- Provider ID (immutable)
- Provider Type (immutable, recreate to change)
- Created/Updated timestamps (automatic)

### 2.4 Provider Actions Menu

```
[···] More Actions Menu:
├── Set as Active Provider
├── Duplicate Provider
├── Export Configuration
├── View Usage Logs
├── ──────────────────
└── Delete Provider (red, confirmation required)
```

---

## 3. API Key Management UX

### 3.1 API Key Input Field

**Component Design**:

```tsx
interface APIKeyInputProps {
  value: string;
  onChange: (value: string) => void;
  onValidate: () => Promise<boolean>;
  isValidating: boolean;
  validationStatus: 'idle' | 'valid' | 'invalid' | 'error';
  lastValidated?: Date;
  encrypted: boolean;
}
```

**Wireframe**:

```
API Key
+--------------------------------------------------+
| ••••••••••••••••••••••••••••• [👁] [Validate]    |
+--------------------------------------------------+
  [Encrypted Badge] Validated 2 hours ago

States:
1. Empty:
   +--------------------------------------------------+
   | sk-...                                     [👁]   |
   +--------------------------------------------------+
     Enter your API key

2. Filled (masked):
   +--------------------------------------------------+
   | ••••••••••••••••••••••••••••• [👁] [Validate]    |
   +--------------------------------------------------+

3. Visible:
   +--------------------------------------------------+
   | sk-proj-abc123...xyz                    [🙈] [Validate] |
   +--------------------------------------------------+

4. Validating:
   +--------------------------------------------------+
   | ••••••••••••••••••••••••••••• [👁] [Spinner]     |
   +--------------------------------------------------+

5. Valid:
   +--------------------------------------------------+
   | ••••••••••••••••••••••••••••• [👁] [✓ Valid]    |
   +--------------------------------------------------+
     [Lock Icon] Encrypted • Validated just now

6. Invalid:
   +--------------------------------------------------+
   | ••••••••••••••••••••••••••••• [👁] [⚠ Invalid]  |
   +--------------------------------------------------+
     [Alert] Invalid API key. Please check and try again.
```

### 3.2 API Key Dialog

For updating API key on existing provider:

```
+------------------------------------------+
| Update API Key                      [X]  |
+------------------------------------------+
|                                          |
| Provider: OpenAI                         |
|                                          |
| Current Key Status: Valid                |
| Last Validated: 2 hours ago              |
|                                          |
| New API Key                              |
| +--------------------------------------+ |
| | ••••••••••••••••••••••••••••• [👁]   | |
| +--------------------------------------+ |
|                                          |
| [ ] Validate new key before saving       |
|                                          |
|         [Cancel]  [Update Key]           |
+------------------------------------------+
```

### 3.3 Security Indicators

| Indicator | Icon | Color | Meaning |
|-----------|------|-------|---------|
| Encrypted | Lock | `text-success` | Key is encrypted at rest |
| Validated | CheckCircle | `text-success` | Key tested and working |
| Not Validated | AlertTriangle | `text-warning` | Key not tested yet |
| Validation Failed | XCircle | `text-error` | Key test failed |

### 3.4 Key Rotation Workflow

```
1. User clicks "Rotate Key" from actions menu
2. Dialog appears:
   +------------------------------------------+
   | Rotate API Key                      [X]  |
   +------------------------------------------+
   |                                          |
   | This will replace the current API key.   |
   |                                          |
   | New API Key                              |
   | +--------------------------------------+ |
   | |                                      | |
   | +--------------------------------------+ |
   |                                          |
   | [ ] Keep current key until new one       |
   |     is validated                         |
   |                                          |
   |         [Cancel]  [Rotate Key]           |
   +------------------------------------------+
3. On success, old key is deleted, new key is stored
```

---

## 4. Usage Dashboard

### 4.1 Summary Cards

**Wireframe**:

```
+------------------------------------------------------------------+
| Usage Overview                                                    |
+------------------------------------------------------------------+
|                                                                    |
| +----------------+  +----------------+  +----------------+         |
| | Total Cost     |  | Total Tokens   |  | Total Requests |         |
| |                |  |                |  |                |         |
| |    $12.45      |  |    1.2M        |  |     847        |         |
| |                |  |                |  |                |         |
| | +15% from      |  | Input: 800K    |  | Last 7 days    |         |
| | last week      |  | Output: 400K   |  |                |         |
| +----------------+  +----------------+  +----------------+         |
|                                                                    |
+------------------------------------------------------------------+
```

### 4.2 Usage Charts

**By Provider (Pie/Donut Chart)**:

```
+----------------------------------+
| Usage by Provider                |
+----------------------------------+
|                                  |
|        +-------------+           |
|       /    OpenAI    \          |
|      |    (65%)       |          |
|      |   +-------+    |          |
|       \  | Other |   /          |
|        \ +-------+ /            |
|         \ Anthropic/            |
|          \ (25%)  /             |
|           +------+              |
|                                  |
| [OpenAI 65%] [Anthropic 25%]     |
| [DeepSeek 10%]                   |
+----------------------------------+
```

**Usage Over Time (Line Chart)**:

```
+--------------------------------------------------+
| Usage Over Time                                  |
+--------------------------------------------------+
|                                                  |
| Cost ($)  |                                      |
|    5.0    |              *---*--*               |
|    2.5    |        *--*--*       \              |
|    0.0    |  *--*                  \            |
|           +----------------------------------   |
|            Mon  Tue  Wed  Thu  Fri  Sat  Sun    |
|                                                  |
+--------------------------------------------------+
```

### 4.3 Usage Filters

**Wireframe**:

```
+--------------------------------------------------+
| Filters                                          |
+--------------------------------------------------+
|                                                  |
| Date Range: [Last 7 days        ▼]               |
| Provider:   [All Providers      ▼]               |
| Model:      [All Models         ▼]               |
|                                                  |
| [Export CSV]  [Export JSON]                      |
+--------------------------------------------------+
```

### 4.4 Detailed Usage Table

```
+--------------------------------------------------------------+
| Usage Logs                                                   |
+--------------------------------------------------------------+
| Timestamp       | Provider | Model    | Tokens | Cost       |
+--------------------------------------------------------------+
| 2026-02-19      | OpenAI   | GPT-4o   | 2,450  | $0.012     |
| 14:32:15        |          |          |        |            |
+--------------------------------------------------------------+
| 2026-02-19      | Anthropic| Claude   | 1,890  | $0.008     |
| 14:30:22        |          | Sonnet   |        |            |
+--------------------------------------------------------------+
| ...                                                           |
+--------------------------------------------------------------+
| Showing 1-20 of 847 entries                     [<] [>]      |
+--------------------------------------------------------------+
```

---

## 5. Quick Switcher

### 5.1 Placement Options

**Option A: Top Toolbar Dropdown (Recommended)**

```
+------------------------------------------------------------------+
| [U] unify-ai    | [Active: OpenAI (GPT-4o) ▼]  | [Settings] [?]| |
+------------------------------------------------------------------+
```

**Option B: Keyboard Shortcut**

- Global shortcut: `Cmd/Ctrl + Shift + M`
- Opens modal overlay for quick switching

### 5.2 Quick Switcher Design

**Wireframe**:

```
+------------------------------------------+
| Switch Provider                     [X]  |
+------------------------------------------+
|                                          |
| Search providers...                      |
| +--------------------------------------+ |
| |                                      | |
| +--------------------------------------+ |
|                                          |
| ● OpenAI                                 |
|   GPT-4o                                 |
|                                          |
| ○ Anthropic                              |
|   Claude Sonnet 4.5                      |
|                                          |
| ○ DeepSeek                               |
|   deepseek-chat                          |
|                                          |
+------------------------------------------+
```

**Interactions**:
1. Click toolbar dropdown → Shows switcher
2. Type to filter providers
3. Arrow keys to navigate
4. Enter to select
5. Escape to close

### 5.3 Visual Feedback on Switch

```
Toast Notification:
+------------------------------------------+
| [✓] Switched to Anthropic                |
|     Claude Sonnet 4.5 is now active      |
+------------------------------------------+

Toolbar Update:
Before: [Active: OpenAI (GPT-4o) ▼]
After:  [Active: Anthropic (Claude Sonnet 4.5) ▼]
```

---

## 6. Error Handling & Feedback

### 6.1 API Key Validation Errors

**Error Types and Messages**:

| Error | Message | Suggestion |
|-------|---------|------------|
| Invalid Key | "Invalid API key format" | "Check that your key starts with 'sk-...'" |
| Unauthorized | "API key was rejected by provider" | "Verify your key is active and has not expired" |
| Network | "Unable to connect to provider" | "Check your internet connection" |
| Rate Limited | "Rate limit exceeded during validation" | "Wait a moment and try again" |

**Error Display**:

```
+--------------------------------------------------+
| [Alert Triangle] API Key Validation Failed       |
+--------------------------------------------------+
|                                                  |
| The API key was rejected by OpenAI.              |
|                                                  |
| Error: Unauthorized - Invalid API key            |
|                                                  |
| Suggestions:                                     |
| • Check that your key is correct                 |
| • Verify the key is active in your dashboard     |
| • Ensure the key has the required permissions    |
|                                                  |
| [Try Again]  [Contact Support]                   |
+--------------------------------------------------+
```

### 6.2 Network Errors

```
+------------------------------------------+
| [Wifi Off] Connection Error              |
+------------------------------------------+
|                                          |
| Unable to reach the provider API.        |
|                                          |
| Please check:                            |
| • Your internet connection               |
| • The provider's status page             |
| • Any firewall or proxy settings         |
|                                          |
| [Retry]  [Use Offline Mode]              |
+------------------------------------------+
```

### 6.3 Empty States

**No Providers**:

```
+------------------------------------------+
|                                          |
|        [Cpu Icon - Large]                |
|                                          |
|     No Providers Configured              |
|                                          |
|     Add your first AI provider to        |
|     get started with model management    |
|                                          |
|        [+ Add Provider]                  |
|                                          |
+------------------------------------------+
```

**No Usage Data**:

```
+------------------------------------------+
|                                          |
|        [Bar Chart Icon - Large]          |
|                                          |
|        No Usage Data Yet                 |
|                                          |
|     Usage statistics will appear here    |
|     once you start making API calls      |
|                                          |
+------------------------------------------+
```

---

## 7. Responsive Design

### 7.1 Window Size Breakpoints

| Breakpoint | Width | Layout |
|------------|-------|--------|
| Large | 1440px+ | Full 3-panel layout |
| Medium | 1200-1439px | Usage panel collapsed (toggle) |
| Small | 1000-1199px | Usage panel hidden, overlay mode |
| Minimum | 1000px | Prevent resize below this |

### 7.2 Panel Behaviors

**At 1200px and below**:

```
+--------------------------------------------+
| [Toggle Stats]  | Main Content   | [Side]  |
+--------------------------------------------+
                   ^ Usage panel as overlay/drawer
```

**Usage Panel Toggle**:

```tsx
// Icon-only collapsed state (1200-1439px)
+-----+
| [$] |
| 12  |
+-----+

// Hover to expand
+------------------+
| Total Cost       |
| $12.45           |
| +15% vs last     |
+------------------+
```

### 7.3 Scrollable Areas

| Area | Scroll Direction | Virtualized |
|------|-----------------|-------------|
| Provider List | Vertical | Yes (if > 20 providers) |
| Provider Detail | Vertical | No |
| Usage Panel | Vertical | No |
| Usage Table | Vertical | Yes (pagination) |

---

## 8. Interaction Flows

### 8.1 Add New Provider Flow

```
User clicks "Add Provider" button
       │
       ▼
Dialog opens with provider type selection
       │
       ▼
User selects provider type (e.g., OpenAI)
       │
       ▼
Configuration form appears
       │
       ├── User enters name
       │
       ├── User enters base URL (optional)
       │
       ├── User enters API key
       │        │
       │        ▼
       │   User clicks "Validate Key"
       │        │
       │        ├── Success: Green checkmark, models loaded
       │        │
       │        └── Failure: Error shown, can still save
       │
       ├── User selects default model
       │
       ▼
User clicks "Add Provider"
       │
       ▼
Provider is saved to database
       │
       ├── Success:
       │   - Toast: "Provider added successfully"
       │   - Provider appears in sidebar
       │   - Dialog closes
       │
       └── Failure:
           - Error toast shown
           - Dialog stays open
```

### 8.2 Switch Active Provider Flow

```
User clicks active provider dropdown
       │
       ▼
Quick switcher appears
       │
       ├── User types to filter (optional)
       │
       ├── User navigates with arrow keys (optional)
       │
       ▼
User selects new provider
       │
       ▼
System updates active provider
       │
       ▼
Toast notification appears
       │
       ▼
UI updates (toolbar, sidebar indicators)
```

### 8.3 API Key Validation Flow

```
User enters/changes API key
       │
       ▼
"Validate" button becomes enabled
       │
       ▼
User clicks "Validate"
       │
       ▼
Button shows loading spinner
       │
       ▼
System makes test API call
       │
       ├── Success:
       │   - Store validation status
       │   - Fetch available models
       │   - Update UI with green checkmark
       │   - Show "Validated" timestamp
       │
       └── Failure:
           - Show error message
           - Suggest troubleshooting steps
           - Allow saving anyway (marked unvalidated)
```

---

## 9. State Diagrams

### 9.1 Provider State Machine

```
                    +-------------+
                    |   Empty     |
                    +-------------+
                          │
                    addProvider()
                          │
                          ▼
+-------------+    +-------------+
|  Disabled   |←---|   Created   |
+-------------+    +-------------+
      │                  │
setEnable(true)    setAPIKey()
      │                  │
      ▼                  ▼
+-------------+    +-------------+
|   Enabled   |---→|  Has Key    |
+-------------+    +-------------+
      │                  │
setActive()        validateKey()
      │                  │
      ▼                  ▼
+-------------+    +-------------+
|   Active    |    |  Validated  |
+-------------+    +-------------+
```

### 9.2 API Key Validation States

```
+---------+     enterKey      +----------+
|  Empty  |------------------→|  Entered |
+---------+                   +----------+
                                  │
                            validateKey()
                                  │
                    +-------------+-------------+
                    │                           │
                    ▼                           ▼
              +-----------+              +-----------+
              |  Valid    |              |  Invalid  |
              +-----------+              +-----------+
                    │                           │
              canMakeCalls              showTroubleshoot
```

---

## 10. Design Decisions & Rationale

### 10.1 Three-Panel Layout

**Decision**: Use sidebar + main content + collapsible usage panel

**Rationale**:
- Provider list needs persistent visibility (sidebar)
- Provider detail needs maximum space (main content)
- Usage data is supplementary, can be toggled (panel)
- Follows patterns from VS Code, Slack desktop

### 10.2 Modal vs Inline Editing

**Decision**: Inline editing for most fields, modal for API key

**Rationale**:
- Name, URL, model are frequently edited → inline is faster
- API key is sensitive → modal provides context and security
- Matches existing Settings page pattern
- Reduces modal fatigue

### 10.3 Always Show Usage Panel (Collapsible)

**Decision**: Keep usage visible but allow collapse

**Rationale**:
- Usage awareness is important for cost control
- Collapsible respects screen real estate
- Provides quick access without navigating away
- Encourages monitoring habit

### 10.4 Validation Optional, Not Required

**Decision**: Allow saving API keys without validation

**Rationale**:
- Network issues shouldn't block configuration
- Users may be offline during initial setup
- Clear status indicators prevent confusion
- Matches IDE settings behavior

### 10.5 Quick Switcher in Toolbar

**Decision**: Put provider switcher in toolbar, not system tray

**Rationale**:
- System tray is discoverable but hidden
- Toolbar is always visible and accessible
- Follows desktop app conventions
- Keyboard shortcut available for power users

### 10.6 Encryption Indicators Everywhere

**Decision**: Always show encryption status with API keys

**Rationale**:
- Security is a primary concern for API keys
- Visual indicators build trust
- Explains why keys can't be shown in plain text
- Aligns with security best practices

---

## 11. Component Specifications

### 11.1 Color Palette (Using Existing Tokens)

| Element | Token | Usage |
|---------|-------|-------|
| Active indicator | `text-success` | Green dot for active provider |
| Valid key | `bg-success-muted` | Green background for valid |
| Warning | `bg-warning-muted` | Yellow for unvalidated |
| Error | `bg-error-muted` | Red for errors/disabled |
| Primary action | `bg-primary` | Blue for buttons |
| Encrypted badge | `bg-primary-muted` | Light blue for encryption |

### 11.2 Typography

| Element | Size | Weight | Class |
|---------|------|--------|-------|
| Page title | 24px | Bold | `text-2xl font-bold` |
| Section header | 18px | Semibold | `text-lg font-semibold` |
| Provider name | 14px | Medium | `text-sm font-medium` |
| Body text | 14px | Regular | `text-sm` |
| Caption | 12px | Regular | `text-xs` |
| Stats | 24px | Bold | `text-2xl font-bold` |

### 11.3 Spacing

| Element | Spacing |
|---------|---------|
| Page padding | 24px (`p-6`) |
| Section gap | 24px (`gap-6`) |
| Card padding | 16px (`p-4`) |
| Item padding | 8-12px (`py-2 px-3`) |
| Button gap | 8px (`gap-2`) |

### 11.4 Animation

| Transition | Duration | Easing |
|------------|----------|--------|
| Panel collapse | 200ms | ease-out |
| Dialog open | 150ms | ease-out |
| Toast appear | 300ms | ease-out |
| Button hover | 100ms | ease-out |
| Toggle switch | 200ms | ease-in-out |

---

## 12. Accessibility

### 12.1 Keyboard Navigation

| Action | Shortcut |
|--------|----------|
| Open quick switcher | `Cmd/Ctrl + Shift + M` |
| Navigate providers | `↑` / `↓` arrows |
| Select provider | `Enter` |
| Close dialog | `Escape` |
| Toggle sidebar | `Cmd/Ctrl + B` |
| Toggle usage panel | `Cmd/Ctrl + U` |

### 12.2 ARIA Labels

```tsx
// Provider list
<nav aria-label="AI providers">
  <button aria-pressed={isActive} aria-label={`${provider.name} - ${status}`}>
    ...
  </button>
</nav>

// API key field
<input
  type="password"
  aria-label="API Key"
  aria-describedby="api-key-status"
/>
<span id="api-key-status">Validated 2 hours ago</span>
```

### 12.3 Color Contrast

- All text meets WCAG 2.1 AA standards
- Status indicators use icons + color (not just color)
- Focus states are clearly visible

---

## 13. File Structure

```
packages/gui/src/
├── pages/
│   └── Models.tsx                    # Main models page
├── components/
│   └── model/
│       ├── ProviderSidebar/
│       │   ├── ProviderList.tsx
│       │   ├── ProviderListItem.tsx
│       │   └── AddProviderButton.tsx
│       ├── ProviderDetail/
│       │   ├── ProviderHeader.tsx
│       │   ├── APIKeySection.tsx
│       │   ├── ModelsSection.tsx
│       │   └── ProviderSettings.tsx
│       ├── UsagePanel/
│       │   ├── UsageSummary.tsx
│       │   ├── UsageChart.tsx
│       │   ├── UsageFilters.tsx
│       │   └── UsageTable.tsx
│       ├── Dialogs/
│       │   ├── AddProviderDialog.tsx
│       │   ├── EditProviderDialog.tsx
│       │   ├── APIKeyDialog.tsx
│       │   └── ModelConfigDialog.tsx
│       └── common/
│           ├── APIKeyInput.tsx
│           ├── ProviderStatusBadge.tsx
│           ├── QuickSwitcher.tsx
│           └── UsageCard.tsx
├── stores/
│   └── modelStore.ts                 # Zustand store for models
└── types/
    └── model.d.ts                    # Type definitions
```

---

## 14. Implementation Priority

### Phase 1: Core UI (Week 1)

1. Models page shell with routing
2. Provider sidebar (list + add button)
3. Provider detail (basic info display)
4. Add provider dialog (step 1 & 2)

### Phase 2: API Key Management (Week 2)

1. API key input component
2. Validation integration
3. Encryption indicators
4. Key rotation dialog

### Phase 3: Usage Dashboard (Week 3)

1. Usage summary cards
2. Basic charts (provider distribution, time series)
3. Usage table with pagination
4. Export functionality

### Phase 4: Polish & Edge Cases (Week 4)

1. Quick switcher
2. Error handling UI
3. Empty states
4. Responsive behavior
5. Keyboard navigation
6. Accessibility audit

---

## 15. Testing Checklist

### UI Testing

- [ ] Provider list renders correctly
- [ ] Add provider flow completes successfully
- [ ] API key validation shows correct states
- [ ] Usage charts render with data
- [ ] Quick switcher opens and switches provider
- [ ] All dialogs open and close properly

### Integration Testing

- [ ] Provider CRUD operations work end-to-end
- [ ] API key encryption/decryption works
- [ ] Usage tracking updates after API calls
- [ ] Active provider switch updates all UI

### Responsive Testing

- [ ] Layout adapts at 1440px
- [ ] Usage panel collapses at 1200px
- [ ] Minimum window size enforced at 1000px
- [ ] All panels scroll correctly

### Accessibility Testing

- [ ] Keyboard navigation works
- [ ] Screen reader announces correctly
- [ ] Color contrast passes WCAG AA
- [ ] Focus management is correct

---

## 16. Future Enhancements

### Proxy Server UI (Phase 2)

- Proxy settings panel in Models page
- Start/stop proxy controls
- Real-time request logging
- Request interception preview

### Advanced Features

- Cost budgets and alerts
- Model performance comparison
- Provider health monitoring
- Team configuration sync (without keys)

---

## Appendix: Mock Data

```typescript
// Example provider data for prototyping
const mockProviders: AIProvider[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    type: 'openai-compatible',
    enabled: true,
    priority: 100,
    baseUrl: 'https://api.openai.com/v1',
    models: [
      { id: 'gpt-4o', displayName: 'GPT-4o', contextWindow: 128000, ... },
      { id: 'gpt-4-turbo', displayName: 'GPT-4 Turbo', ... },
    ],
    defaultModel: 'gpt-4o',
    createdAt: '2026-02-01T00:00:00Z',
    updatedAt: '2026-02-19T10:30:00Z',
  },
  // ... more providers
];

const mockUsageSummary: UsageSummary = {
  providerId: 'all',
  totalRequests: 847,
  totalInputTokens: 800000,
  totalOutputTokens: 400000,
  totalCost: 12.45,
  byModel: new Map([
    ['gpt-4o', { requests: 500, inputTokens: 500000, outputTokens: 250000, cost: 8.50 }],
    ['claude-sonnet-4-5', { requests: 347, inputTokens: 300000, outputTokens: 150000, cost: 3.95 }],
  ]),
  period: { start: '2026-02-12', end: '2026-02-19' },
};
```
