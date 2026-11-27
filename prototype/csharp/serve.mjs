import { serveLocalEditor } from '../local-editor-server.mjs';

serveLocalEditor({ runnerDirectory: 'csharp', language: 'C#', filename: 'Snippet.cs', defaultPort: 8001 });
