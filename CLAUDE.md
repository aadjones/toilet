# Project Rules

## Development Server
- **Never start dev servers** (`npm run dev`, etc.). The user will run these manually or ask you to use the MCP browser tools to view the app.

## Build Hygiene
- **ALWAYS run `npm run build` before committing code changes.** This is basic hygiene - never commit broken code.
- If the build fails, fix the errors before committing.
- Only commit once the build succeeds without errors or warnings.
