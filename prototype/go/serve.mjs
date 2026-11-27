import { serveLocalEditor } from '../local-editor-server.mjs';

serveLocalEditor({ runnerDirectory: 'go', language: 'Go', filename: 'main.go', defaultPort: 8002 });
