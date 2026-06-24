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
    [hidden] {
      display: none !important;
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
    .delegate-mode {
      margin-bottom: 24px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 8px;
      padding: 16px;
      background: var(--vscode-editor-inactiveSelectionBackground);
    }
    .delegate-status {
      margin: 0 0 14px;
      color: var(--vscode-descriptionForeground);
      line-height: 1.5;
    }
    .delegate-status.active {
      color: var(--vscode-testing-iconPassed);
      font-weight: 600;
    }
    .profile-list {
      display: grid;
      gap: 12px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .profile-card {
      border: 1px solid var(--vscode-panel-border);
      border-radius: 8px;
      padding: 14px 16px;
      background: var(--vscode-editor-inactiveSelectionBackground);
    }
    .profile-card header {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 8px 16px;
      margin-bottom: 8px;
    }
    .profile-card h3 {
      margin: 0;
      font-size: 1rem;
    }
    .profile-meta {
      color: var(--vscode-descriptionForeground);
      font-size: 0.92rem;
      line-height: 1.5;
    }
    .profile-meta span + span::before {
      content: ' · ';
    }
    .profile-scripts {
      margin: 10px 0 0;
      padding: 0;
      list-style: none;
      display: grid;
      gap: 8px;
    }
    .profile-script {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 8px 10px;
      border-radius: 6px;
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-panel-border);
    }
    .profile-script code {
      font-family: var(--vscode-editor-font-family);
      font-size: 0.9rem;
      word-break: break-all;
    }
    .empty-state {
      color: var(--vscode-descriptionForeground);
      margin: 0;
      padding: 12px 0 0;
    }
    button.small {
      padding: 4px 10px;
      font-size: 0.9rem;
    }
    .profile-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    button.danger {
      color: var(--vscode-errorForeground);
      background: var(--vscode-inputValidation-errorBackground);
    }
  </style>
</head>
<body>
  <main>
    <h1>RemoteForge VPS Delegator</h1>
    <p>Configure VPS profiles, authentication details, default work directories, and quick-run scripts.</p>

    <div class="notice" id="status">
      Fill in a VPS profile, then save it, test SSH authentication, or run a quick script on the VPS.
    </div>

    <section class="delegate-mode" aria-labelledby="delegate-mode-heading">
      <h2 id="delegate-mode-heading">VPS Delegate Mode</h2>
      <p class="delegate-status" id="delegate-status">
        When enabled, this workspace is migrated to the VPS. Terminals and RemoteForge commands run on the remote copy.
      </p>
      <div class="grid">
        <label>
          VPS profile
          <select id="delegate-profile" disabled>
            <option value="">Loading profiles...</option>
          </select>
        </label>
        <label>
          Remote workspace path
          <input id="delegate-remote-root" type="text" placeholder="/root/RemoteForge" disabled>
        </label>
      </div>
      <div class="actions" style="margin-top: 14px;">
        <button type="button" id="delegate-enable" data-action="enable-delegate" disabled>Enable Delegate Mode</button>
        <button class="secondary" type="button" id="delegate-disable" data-action="disable-delegate" hidden>Disable Delegate Mode</button>
      </div>
    </section>

    <section class="saved-profiles" aria-labelledby="saved-profiles-heading">
      <h2 id="saved-profiles-heading">Saved Profiles</h2>
      <p class="empty-state" id="saved-profiles-empty">Loading saved profiles...</p>
      <ul class="profile-list" id="saved-profiles-list" hidden></ul>
    </section>

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

      <fieldset data-auth-section="password">
        <legend>Password Credentials</legend>
        <label>
          Password
          <input name="password" type="password" autocomplete="new-password" placeholder="Stored in VS Code SecretStorage">
        </label>
      </fieldset>

      <fieldset data-auth-section="privateKey" hidden>
        <legend>Private Key Credentials</legend>
        <div class="grid">
          <label>
            Private key path
            <input name="keyPath" type="text" placeholder="~/.ssh/id_ed25519">
          </label>
          <label>
            Private key passphrase
            <input name="privateKeyPassphrase" type="password" autocomplete="new-password" placeholder="Optional passphrase">
          </label>
        </div>
        <label>
          Paste private key content
          <textarea name="privateKeyContent" placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"></textarea>
        </label>
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
        <button type="button" data-action="save">Save Profile</button>
        <button class="secondary" type="button" data-action="test">Test Connection</button>
        <button class="secondary" type="button" data-action="run">Run Script on VPS</button>
      </div>
    </form>
  </main>
  <script nonce="${escapeAttribute(nonce)}">
    const vscode = acquireVsCodeApi();
    const form = document.querySelector('form');
    const status = document.querySelector('#status');
    const savedProfilesEmpty = document.querySelector('#saved-profiles-empty');
    const savedProfilesList = document.querySelector('#saved-profiles-list');
    const delegateStatus = document.querySelector('#delegate-status');
    const delegateProfile = document.querySelector('#delegate-profile');
    const delegateRemoteRoot = document.querySelector('#delegate-remote-root');
    const delegateEnable = document.querySelector('#delegate-enable');
    const delegateDisable = document.querySelector('#delegate-disable');
    let loadedProfiles = [];

    const authMethodLabels = {
      password: 'Password',
      privateKey: 'Private key',
      sshCommand: 'SSH command'
    };

    function escapeHtml(value) {
      return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function renderSavedProfiles(profiles) {
      loadedProfiles = profiles;
      renderDelegateControls(profiles);
      if (!profiles.length) {
        savedProfilesEmpty.textContent = 'No saved profiles yet. Add one below.';
        savedProfilesEmpty.hidden = false;
        savedProfilesList.hidden = true;
        savedProfilesList.innerHTML = '';
        return;
      }

      savedProfilesEmpty.hidden = true;
      savedProfilesList.hidden = false;
      savedProfilesList.innerHTML = profiles.map((profile) => {
        const endpoint = \`\${escapeHtml(profile.username)}@\${escapeHtml(profile.host)}:\${profile.port}\`;
        const authLabel = authMethodLabels[profile.authMethod] || profile.authMethod;
        const workdir = profile.defaultWorkdir
          ? \`<span>Workdir: \${escapeHtml(profile.defaultWorkdir)}</span>\`
          : '';
        const scripts = Array.isArray(profile.scripts) ? profile.scripts : [];
        const scriptItems = scripts.length
          ? \`<ul class="profile-scripts">\${scripts.map((script) => \`
              <li class="profile-script">
                <div>
                  <strong>\${escapeHtml(script.name)}</strong>
                  <div><code>\${escapeHtml(script.command)}</code></div>
                </div>
                <button class="secondary small" type="button" data-action="run-saved-script" data-profile-id="\${escapeHtml(profile.id)}" data-script-id="\${escapeHtml(script.id)}">Run</button>
              </li>
            \`).join('')}</ul>\`
          : '<p class="profile-meta">No quick-run scripts saved for this profile.</p>';

        return \`
          <li class="profile-card">
            <header>
              <h3>\${escapeHtml(profile.name)}</h3>
              <div class="profile-actions">
                <button class="secondary small" type="button" data-action="test-saved-profile" data-profile-id="\${escapeHtml(profile.id)}">Test Connection</button>
                <button class="danger small" type="button" data-action="delete-profile" data-profile-id="\${escapeHtml(profile.id)}" data-profile-name="\${escapeHtml(profile.name)}">Delete</button>
              </div>
            </header>
            <div class="profile-meta">
              <span>\${endpoint}</span>
              <span>\${escapeHtml(authLabel)}</span>
              \${workdir}
            </div>
            \${scriptItems}
          </li>
        \`;
      }).join('');
    }

    function renderDelegateControls(profiles) {
      delegateProfile.innerHTML = profiles.length
        ? profiles.map((profile) => \`<option value="\${escapeHtml(profile.id)}">\${escapeHtml(profile.name)}</option>\`).join('')
        : '<option value="">No saved profiles</option>';

      const selected = profiles.find((profile) => profile.id === delegateProfile.value) || profiles[0];
      if (selected) {
        delegateProfile.value = selected.id;
        delegateRemoteRoot.value = selected.suggestedRemoteRoot || selected.defaultWorkdir || '';
      }

      delegateProfile.disabled = !profiles.length;
      delegateRemoteRoot.disabled = !profiles.length;
    }

    function renderDelegateState(payload) {
      const delegate = payload.delegate || { enabled: false };
      const hasWorkspace = payload.hasWorkspace !== false;

      if (!hasWorkspace) {
        delegateStatus.textContent = 'Open a workspace folder to enable delegate mode.';
        delegateEnable.disabled = true;
        delegateDisable.hidden = true;
        return;
      }

      if (delegate.enabled) {
        delegateStatus.textContent = \`Delegate mode is ON for "\${delegate.profileName}" at \${delegate.remoteRoot}.\`;
        delegateStatus.classList.add('active');
        delegateEnable.hidden = true;
        delegateDisable.hidden = false;
        delegateProfile.disabled = true;
        delegateRemoteRoot.disabled = true;
        if (delegate.profileId) delegateProfile.value = delegate.profileId;
        if (delegate.remoteRoot) delegateRemoteRoot.value = delegate.remoteRoot;
        return;
      }

      delegateStatus.textContent = 'When enabled, this workspace is migrated to the VPS. Integrated terminals and RemoteForge commands run remotely.';
      delegateStatus.classList.remove('active');
      delegateEnable.hidden = false;
      delegateDisable.hidden = true;
      delegateEnable.disabled = !loadedProfiles.length;
      delegateProfile.disabled = !loadedProfiles.length;
      delegateRemoteRoot.disabled = !loadedProfiles.length;
    }

    delegateProfile.addEventListener('change', () => {
      const selected = loadedProfiles.find((profile) => profile.id === delegateProfile.value);
      if (selected) {
        delegateRemoteRoot.value = selected.suggestedRemoteRoot || selected.defaultWorkdir || '';
      }
    });

    delegateEnable.addEventListener('click', () => {
      if (!delegateProfile.value || !delegateRemoteRoot.value.trim()) {
        setStatus('Select a VPS profile and remote path before enabling delegate mode.', false);
        return;
      }

      vscode.postMessage({
        type: 'enableDelegateMode',
        profileId: delegateProfile.value,
        remoteRoot: delegateRemoteRoot.value.trim()
      });
    });

    delegateDisable.addEventListener('click', () => {
      vscode.postMessage({ type: 'disableDelegateMode' });
    });

    savedProfilesList.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      const testButton = target.closest('[data-action="test-saved-profile"]');
      if (testButton instanceof HTMLElement && testButton.dataset.profileId) {
        vscode.postMessage({ type: 'testSavedProfile', profileId: testButton.dataset.profileId });
        return;
      }

      const runButton = target.closest('[data-action="run-saved-script"]');
      if (runButton instanceof HTMLElement && runButton.dataset.profileId && runButton.dataset.scriptId) {
        vscode.postMessage({
          type: 'runSavedScript',
          profileId: runButton.dataset.profileId,
          scriptId: runButton.dataset.scriptId
        });
        return;
      }

      const deleteButton = target.closest('[data-action="delete-profile"]');
      if (deleteButton instanceof HTMLElement && deleteButton.dataset.profileId) {
        vscode.postMessage({
          type: 'deleteProfile',
          profileId: deleteButton.dataset.profileId
        });
      }
    });

    function profileFromForm() {
      const data = new FormData(form);
      const scriptName = String(data.get('scriptName') || '').trim();
      const scriptCommand = String(data.get('scriptCommand') || '').trim();
      const scriptWorkdir = String(data.get('scriptWorkdir') || '').trim();
      const scripts = scriptName && scriptCommand ? [{
        id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
        name: scriptName,
        command: scriptCommand,
        workdir: scriptWorkdir || undefined,
        showTerminal: true,
        confirmBefore: false
      }] : [];

      return {
        name: String(data.get('name') || '').trim(),
        host: String(data.get('host') || '').trim(),
        port: Number(data.get('port') || 22),
        username: String(data.get('username') || '').trim(),
        authMethod: String(data.get('authMethod') || 'password'),
        password: String(data.get('password') || '') || undefined,
        keyPath: String(data.get('keyPath') || '').trim() || undefined,
        privateKeyContent: String(data.get('privateKeyContent') || '') || undefined,
        privateKeyPassphrase: String(data.get('privateKeyPassphrase') || '') || undefined,
        defaultWorkdir: String(data.get('defaultWorkdir') || '').trim() || undefined,
        sshCommand: String(data.get('sshCommand') || '').trim() || undefined,
        scripts
      };
    }

    function setStatus(message, ok) {
      status.textContent = message;
      status.style.borderLeftColor = ok ? 'var(--vscode-testing-iconPassed)' : 'var(--vscode-testing-iconFailed)';
    }

    document.querySelector('[data-action="save"]').addEventListener('click', () => {
      vscode.postMessage({ type: 'saveProfile', profile: profileFromForm() });
    });

    document.querySelector('[data-action="test"]').addEventListener('click', () => {
      vscode.postMessage({ type: 'testConnection', profile: profileFromForm() });
    });

    document.querySelector('[data-action="run"]').addEventListener('click', () => {
      vscode.postMessage({ type: 'runScript', profile: profileFromForm() });
    });

    function updateAuthSections() {
      const authMethod = String(new FormData(form).get('authMethod') || 'password');
      document.querySelectorAll('[data-auth-section]').forEach((section) => {
        section.hidden = section.getAttribute('data-auth-section') !== authMethod;
      });
    }

    form.elements.authMethod.addEventListener('change', updateAuthSections);
    updateAuthSections();

    window.addEventListener('message', (event) => {
      const message = event.data;
      if (message && message.type === 'profilesLoaded') renderSavedProfiles(message.profiles || []);
      if (message && message.type === 'delegateState') renderDelegateState(message);
      if (message && message.type === 'saveResult') setStatus(message.message, message.ok);
      if (message && message.type === 'testResult') setStatus(message.message, message.ok);
      if (message && message.type === 'runResult') setStatus(message.message, message.ok);
      if (message && message.type === 'deleteResult') setStatus(message.message, message.ok);
      if (message && message.type === 'delegateResult') setStatus(message.message, message.ok);
    });

    vscode.postMessage({ type: 'requestProfiles' });
    vscode.postMessage({ type: 'requestDelegateState' });
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
