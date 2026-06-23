import { InMemoryConfigStore, InMemorySecretStore, ProfileManager } from '../../core/profile/ProfileManager';

describe('ProfileManager', () => {
  it('stores metadata separately from password secrets', async () => {
    const config = new InMemoryConfigStore();
    const secrets = new InMemorySecretStore();
    const manager = new ProfileManager(config, secrets, () => 'profile-1', () => '2026-06-23T00:00:00.000Z');

    const profile = await manager.createProfile({
      name: 'Build VPS',
      host: '203.0.113.10',
      port: 22,
      username: 'deploy',
      authMethod: 'password',
      password: 'super-secret',
      scripts: []
    });

    expect(profile).not.toHaveProperty('password');
    expect(await secrets.get('remoteforge.password.profile-1')).toBe('super-secret');
    expect(config.snapshot()).toEqual([
      expect.objectContaining({
        id: 'profile-1',
        name: 'Build VPS',
        authMethod: 'password'
      })
    ]);
  });

  it('rejects duplicate profile names case-insensitively', async () => {
    const config = new InMemoryConfigStore();
    const secrets = new InMemorySecretStore();
    let nextId = 1;
    const manager = new ProfileManager(config, secrets, () => `profile-${nextId++}`, () => '2026-06-23T00:00:00.000Z');

    await manager.createProfile({
      name: 'Build VPS',
      host: '203.0.113.10',
      port: 22,
      username: 'deploy',
      authMethod: 'password',
      password: 'super-secret',
      scripts: []
    });

    await expect(manager.createProfile({
      name: 'build vps',
      host: '203.0.113.11',
      port: 22,
      username: 'deploy',
      authMethod: 'password',
      password: 'another-secret',
      scripts: []
    })).rejects.toThrow('Profile name must be unique');
  });

  it('rejects invalid SSH ports', async () => {
    const manager = new ProfileManager(new InMemoryConfigStore(), new InMemorySecretStore(), () => 'profile-1', () => '2026-06-23T00:00:00.000Z');

    await expect(manager.createProfile({
      name: 'Build VPS',
      host: '203.0.113.10',
      port: 70000,
      username: 'deploy',
      authMethod: 'password',
      password: 'super-secret',
      scripts: []
    })).rejects.toThrow('Port must be between 1 and 65535');
  });
});
