# Workflow Templates

Starter templates for building AIHF.io workflows.

## Available Templates

| Template | Description | Best For |
|----------|-------------|----------|
| `basic-workflow` | Simple single-step workflow | Learning, quick prototypes |
| `api-only` | API-focused workflow without UI | Backend services, integrations |
| `full-stack` | Complete workflow with UI, API, auth | Full applications |

## Usage

```bash
# Initialize with a template
aihf init my-project --template basic-workflow

# Or copy manually
cp -r templates/basic-workflow my-project
cd my-project
npm install
aihf build
```

## Template Structure

Each template includes:

- `bundle.yaml` - Workflow definition
- `config/config.json` - Configuration settings
- `src/api/` - API handlers
- `src/ui/` - UI components (if applicable)
- `package.json` - Dependencies
- `tsconfig.json` - TypeScript config
