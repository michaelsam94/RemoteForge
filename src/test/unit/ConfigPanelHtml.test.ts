import { renderConfigPanelHtml } from '../../ui/webview/ConfigPanelHtml';

describe('renderConfigPanelHtml', () => {
  it('renders a configuration form for VPS profiles and scripts', () => {
    const html = renderConfigPanelHtml('nonce-123');

    expect(html).toContain('RemoteForge VPS Delegator');
    expect(html).toContain('Add VPS Profile');
    expect(html).toContain('Saved Profiles');
    expect(html).toContain('Run Script on VPS');
    expect(html).toContain('name="host"');
    expect(html).toContain('name="username"');
    expect(html).toContain('name="authMethod"');
    expect(html).toContain('Quick-Run Scripts');
    expect(html).toContain('nonce="nonce-123"');
  });

  it('posts save and test connection actions to the extension host', () => {
    const html = renderConfigPanelHtml('nonce-123');

    expect(html).toContain("type: 'saveProfile'");
    expect(html).toContain("type: 'testConnection'");
    expect(html).toContain("type: 'requestProfiles'");
    expect(html).toContain("type: 'testSavedProfile'");
    expect(html).toContain("type: 'runSavedScript'");
    expect(html).toContain("type: 'deleteProfile'");
    expect(html).toContain('data-action="delete-profile"');
    expect(html).toContain('data-action="save"');
    expect(html).toContain('data-action="test"');
    expect(html).toContain('id="status"');
  });

  it('renders credential fields for password and private key authentication', () => {
    const html = renderConfigPanelHtml('nonce-123');

    expect(html).toContain('name="password"');
    expect(html).toContain('type="password"');
    expect(html).toContain('name="keyPath"');
    expect(html).toContain('name="privateKeyContent"');
    expect(html).toContain('name="privateKeyPassphrase"');
    expect(html).toContain('data-auth-section="password"');
    expect(html).toContain('data-auth-section="privateKey"');
  });

  it('includes credential values in the save and test profile payload', () => {
    const html = renderConfigPanelHtml('nonce-123');

    expect(html).toContain("password: String(data.get('password') || '') || undefined");
    expect(html).toContain("keyPath: String(data.get('keyPath') || '').trim() || undefined");
    expect(html).toContain("privateKeyContent: String(data.get('privateKeyContent') || '') || undefined");
    expect(html).toContain("privateKeyPassphrase: String(data.get('privateKeyPassphrase') || '') || undefined");
  });
});
