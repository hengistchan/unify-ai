# Project Plans Directory

This directory contains implementation plans for the unify-ai project.

## 📚 Active Plans

### 1. Model Module Refactoring

**Primary Document**: [`model-refactor-master-plan.md`](./model-refactor-master-plan.md)

**Overview**: Comprehensive refactoring plan for the model module based on CC-Switch research.

**Key Decisions**:
- **Hybrid Tool Isolation**: Global providers + tool-specific overrides
- **Priority**: Tool override > Global config > Default
- **Timeline**: 18 weeks (4.5 months)

**Phases**:
- **Phase 1** (Week 1-2): Quick fixes - API Key cache, shortcuts, tray optimization
- **Phase 2** (Week 3-8): Hybrid tool isolation architecture
- **Phase 3** (Week 9-18): Smart features, budget management, team collaboration

### 2. Tool Isolation Redesign

**Document**: [`tool-isolation-redesign-analysis.md`](./tool-isolation-redesign-analysis.md)

**Purpose**: Deep analysis of tool isolation UX patterns and architecture decisions.

**Key Findings**:
- Pure tool isolation (CC-Switch) causes duplicate configuration
- Hybrid mode (global + overrides) provides better UX
- User mental model: "Default global, override when needed"

### 3. CC-Switch Research

**Document**: [`cc-switch-research.md`](./cc-switch-research.md)

**Purpose**: In-depth research of CC-Switch v3.10.2 architecture and design patterns.

**Key Insights**:
- Tool isolation with composite primary key `(id, app_type)`
- Backfill mechanism for protecting user modifications
- Dual-layer configuration (DB + JSON)
- Proxy server with health monitoring

## 📋 Supporting Plans

### CI/CD & Release

- [`github-actions-setup.md`](./github-actions-setup.md): GitHub Actions workflow setup
- [`release-guide.md`](./release-guide.md): Release process guide
- [`master-plan.md`](./master-plan.md): Original project master plan

## 🔄 Plan Lifecycle

Plans go through the following stages:

1. **Research**: Initial investigation and analysis
2. **Draft**: Detailed implementation proposal
3. **Review**: Team review and feedback
4. **Approved**: Ready for implementation
5. **Active**: Currently being implemented
6. **Completed**: Implementation finished
7. **Archived**: No longer relevant, kept for reference

## 📝 Creating New Plans

When creating new plans:

1. Use descriptive filenames: `[feature-name].md` or `[phase-number]-[description].md`
2. Include the following sections:
   - Context and motivation
   - Goals and non-goals
   - Implementation phases
   - File lists and code changes
   - Verification steps
   - Rollback plan

3. Reference existing plans when relevant
4. Update this README when adding new plans

## 🗂️ Archive

Plans that are no longer active but kept for reference are stored in the `archive/` subdirectory.

## 📅 Last Updated

- **Date**: 2026-02-21
- **Updated by**: Architecture Team
- **Major Change**: Adopted hybrid tool isolation mode (global + tool overrides)
