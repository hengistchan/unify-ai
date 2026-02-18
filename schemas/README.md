# Unify-AI JSON Schema Documentation

This directory contains the JSON Schema definitions for the unify-ai project, an AI Agent configuration unification tool.

## Schema Architecture

```
schemas/
├── unified.schema.json      # Main schema (aggregates all modules)
├── rules.schema.json        # Rules/instructions (minimal subset)
├── mcp.schema.json          # MCP server configuration
├── permission.schema.json   # Permission controls
├── model.schema.json        # Model configuration
├── target.schema.json       # Target tool mapping
└── example-unified.json     # Example configuration
```

## Design Principles

### 1. Modular Design

- Each schema module is self-contained and can be used independently
- The `rules` module is the minimal subset supported by ALL tools
- Other modules are extensions with varying tool support

### 2. Hierarchical Structure

```
unified.schema.json (root)
├── metadata (project info)
├── rules (required - minimal subset)
├── mcp (optional - extension)
├── permissions (optional - extension)
├── model (optional - extension)
└── targets (optional - tool-specific overrides)
```

### 3. Bidirectional Conversion Support

- All schemas support both import (from tool) and export (to tool)
- The `target.schema.json` defines mapping rules for conversion
- Metadata tracks source/target relationships

## Schema Modules

### rules.schema.json (Required)

The core rules/instructions schema - the minimal subset supported by all AI tools.

**Key Features:**

- Rule definitions with content, priority, and scope
- Project context information
- Code style preferences
- Response style configuration

**Supported by:** All tools (Cursor, Claude Code, Codex, Copilot, Windsurf, Cline, Aider, Continue)

### mcp.schema.json (Extension)

MCP (Model Context Protocol) server configuration.

**Key Features:**

- Server definitions with transport configuration
- Tool, resource, and prompt declarations
- Server groups and profiles
- Retry and timeout configuration

**Supported by:** Claude Code, Cursor (partial)

### permission.schema.json (Extension)

Permission and security controls.

**Key Features:**

- Allow/deny/ask lists for operations
- File system permissions
- Network permissions
- Command execution permissions
- Tool-specific permissions
- Rate limiting

**Supported by:** Claude Code, Cline (partial)

### model.schema.json (Extension)

Model selection and configuration.

**Key Features:**

- Multi-provider support
- Model parameters (temperature, max_tokens, etc.)
- Fallback configuration
- Intelligent routing
- Cost optimization

**Supported by:** Most tools with varying capabilities

### target.schema.json (Mapping)

Target tool configuration and mapping rules.

**Key Features:**

- Output file configuration
- Field mapping rules
- Transformations
- Feature support matrix
- Tool-specific presets

## Tool Feature Matrix

| Feature         | Cursor  | Claude Code | Codex   | Copilot | Windsurf | Cline   | Aider   | Continue |
| --------------- | ------- | ----------- | ------- | ------- | -------- | ------- | ------- | -------- |
| Rules           | Full    | Full        | Full    | Partial | Full     | Full    | Partial | Full     |
| MCP             | Partial | Full        | None    | None    | None     | None    | None    | Partial  |
| Permissions     | None    | Full        | None    | None    | None     | Partial | None    | None     |
| Model Selection | Partial | Full        | Partial | None    | Partial  | Full    | Full    | Full     |
| Format          | MD+YAML | MD+JSON     | TOML+MD | MD      | Text     | MD+JSON | YAML    | YAML     |

## Usage Examples

### Minimal Configuration (All Tools)

```json
{
  "$schema": "https://unify-ai.dev/schemas/unified.schema.json",
  "rules": {
    "rules": [
      {
        "content": "Use TypeScript for all new files."
      },
      {
        "content": "Follow the existing code style."
      }
    ]
  }
}
```

### Full Configuration

```json
{
  "$schema": "https://unify-ai.dev/schemas/unified.schema.json",
  "version": "1.0.0",
  "metadata": {
    "name": "My Project"
  },
  "rules": { ... },
  "mcp": { ... },
  "permissions": { ... },
  "model": { ... },
  "targets": { ... }
}
```

### Profile-Based Configuration

```json
{
  "$schema": "https://unify-ai.dev/schemas/unified.schema.json",
  "extends": ["@unify-ai/presets/typescript"],
  "profiles": {
    "development": {
      "permissions": { "mode": "permissive" }
    }
  }
}
```

## Validation

All schemas follow JSON Schema Draft 2020-12 and can be validated using:

```bash
# Using ajv-cli
ajv validate -s unified.schema.json -d config.json

# Using jsonschema (Python)
jsonschema -i config.json unified.schema.json
```

## Versioning

Schemas follow semantic versioning:

- MAJOR: Breaking changes to structure
- MINOR: New features, backward compatible
- PATCH: Bug fixes, documentation updates

## Contributing

When adding new features:

1. Consider which tools support the feature
2. Add to appropriate module (or create new module)
3. Update feature matrix
4. Add examples
5. Increment version numbers
