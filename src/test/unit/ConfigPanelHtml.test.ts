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
});
