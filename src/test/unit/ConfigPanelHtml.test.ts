import { renderConfigPanelHtml } from '../../ui/webview/ConfigPanelHtml';

describe('renderConfigPanelHtml', () => {
  it('renders a configuration form for VPS profiles and scripts', () => {
    const html = renderConfigPanelHtml('nonce-123');

    expect(html).toContain('RemoteForge VPS Delegator');
    expect(html).toContain('Add VPS Profile');
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
    expect(html).toContain('data-action="save"');
    expect(html).toContain('data-action="test"');
    expect(html).toContain('id="status"');
  });
});
