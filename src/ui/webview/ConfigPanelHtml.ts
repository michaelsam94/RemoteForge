export function renderConfigPanelHtml(nonce: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${escapeAttribute(nonce)}';">
  <title>RemoteForge VPS Delegator</title>
  <style>
    :root {
      color-scheme: light dark;
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
    }
    body {
      margin: 0;
      padding: 24px;
    }
    main {
      max-width: 980px;
      margin: 0 auto;
    }
    h1, h2 {
      margin: 0 0 12px;
    }
    p {
      color: var(--vscode-descriptionForeground);
      line-height: 1.5;
      margin: 0 0 20px;
    }
    form {
      display: grid;
      gap: 18px;
    }
    fieldset {
      border: 1px solid var(--vscode-panel-border);
      border-radius: 8px;
      padding: 16px;
    }
    legend {
      padding: 0 8px;
      font-weight: 700;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 12px;
    }
    label {
      display: grid;
      gap: 6px;
      font-weight: 600;
    }
    input, select, textarea {
      box-sizing: border-box;
      width: 100%;
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
      padding: 8px;
      color: var(--vscode-input-foreground);
      background: var(--vscode-input-background);
      font: inherit;
    }
    textarea {
      min-height: 88px;
      resize: vertical;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    button {
      border: 0;
      border-radius: 4px;
      padding: 8px 12px;
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
      cursor: pointer;
    }
    button.secondary {
      color: var(--vscode-button-secondaryForeground);
      background: var(--vscode-button-secondaryBackground);
    }
    .notice {
      border-left: 3px solid var(--vscode-progressBar-background);
      padding: 10px 12px;
      background: var(--vscode-textBlockQuote-background);
    }
  </style>
</head>
<body>
  <main>
    <h1>RemoteForge VPS Delegator</h1>
    <p>Configure VPS profiles, authentication details, default work directories, and quick-run scripts.</p>

    <div class="notice">
      This first configuration panel is local-only. Saving profiles and testing SSH connections are planned for the next milestone.
    </div>

    <form>
      <fieldset>
        <legend>Add VPS Profile</legend>
        <div class="grid">
          <label>
            Profile name
            <input name="name" type="text" placeholder="Production VPS">
          </label>
          <label>
            Host
            <input name="host" type="text" placeholder="203.0.113.10">
          </label>
          <label>
            Port
            <input name="port" type="number" min="1" max="65535" value="22">
          </label>
          <label>
            Username
            <input name="username" type="text" placeholder="deploy">
          </label>
          <label>
            Auth method
            <select name="authMethod">
              <option value="password">Password</option>
              <option value="privateKey">Private key</option>
              <option value="sshCommand">SSH command</option>
            </select>
          </label>
          <label>
            Default workdir
            <input name="defaultWorkdir" type="text" placeholder="/home/deploy/project">
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>SSH Command</legend>
        <label>
          Raw SSH command
          <textarea name="sshCommand" placeholder="ssh -i ~/.ssh/id_ed25519 deploy@203.0.113.10 -p 22"></textarea>
        </label>
      </fieldset>

      <fieldset>
        <legend>Quick-Run Scripts</legend>
        <div class="grid">
          <label>
            Script name
            <input name="scriptName" type="text" placeholder="Build">
          </label>
          <label>
            Command
            <input name="scriptCommand" type="text" placeholder="npm test">
          </label>
          <label>
            Working directory
            <input name="scriptWorkdir" type="text" placeholder="/home/deploy/project">
          </label>
        </div>
      </fieldset>

      <div class="actions">
        <button type="button">Save Profile</button>
        <button class="secondary" type="button">Test Connection</button>
      </div>
    </form>
  </main>
  <script nonce="${escapeAttribute(nonce)}">
    const vscode = acquireVsCodeApi();
    document.querySelectorAll('button').forEach((button) => {
      button.addEventListener('click', () => {
        vscode.postMessage({ type: 'notice', text: 'Profile persistence is planned for the next milestone.' });
      });
    });
  </script>
</body>
</html>`;
}

function escapeAttribute(value: string): string {
  return value.replace(/[&<>"']/g, character => {
    switch (character) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}
