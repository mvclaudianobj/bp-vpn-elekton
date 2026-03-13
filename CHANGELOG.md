# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.8] - PLANNED — Phase 3: Low Priority / Code Quality

### 🔀 RF012: Split Tunneling
- Allow configuring specific routes per `.ovpn` profile from the UI

### 🍎 RNF011-012: macOS + ARM Support
- Test and validate build for macOS 10.15+
- ARM architecture support (Apple Silicon / Linux ARM)

### 🧱 RNF021: `main.js` Modularization
- Split ~3,000-line file into independent modules: `vpn-manager`, `auth-manager`, `profile-manager`, `updater`
- Apply CommonJS module pattern with clear inter-process interfaces

### ⚙️ CI/CD: GitHub Actions
- Create workflow for automatic builds on push to `beta-*` branches
- Automated release publishing to GitHub Releases

### 🧹 Repository Cleanup
- Remove committed debug files: `debug.js`, `debug.js.backup`, `index_backup.html`, `index_debug.html`
- Update version badge in `README.md`

---

## [0.1.7] - PLANNED — Phase 2: Medium Priority / Features

### 🔔 RF021/RNF016: System Notifications
- Implement Electron `Notification` API for events: connection established, disconnection, error, update available

### 📊 RF022-RF024: Real-Time Monitoring
- Display real-time upload/download speed in the dashboard
- Session traffic counter (total bytes)
- Active connection timer

### 📋 RF025: Connection History
- Persist and display log of previous sessions (profile, duration, date, status)

### 🔒 RF011: Kill Switch
- Block all network traffic outside the VPN interface when connection drops
- Implementation via `iptables` (Linux) and `netsh` (Windows)

### 🛡️ RNF008: DNS Leak Protection
- Force DNS resolution exclusively through the VPN interface
- Automatic leak validation in the diagnostics screen

---

## [0.1.6] - PLANNED — Phase 1: High Priority / Critical Fixes

### 🐛 IS007: Missing icons in `.deb` package
- Fix icon loading in packaged application
- Replace simple relative paths in `index.html` with the `local-resource://` protocol already implemented in `main.js`

### 🐛 IS006: Password not cleared when switching profiles
- Clear username and password fields before loading credentials for the new profile
- Ensure profiles without saved passwords display empty fields

### 🐛 IS002: False "connected" state after reboot
- Strengthen PID validation in `restoreApplicationState` to verify real OS process before showing connected status
- Clear `app_state.json` when PID does not match an active process

### 🐛 IS001: Tray icon — app disappears when minimized
- Fix race condition in tray creation on Linux
- Ensure clicking the tray icon correctly restores the window on all platforms

### 🐛 IS003: Windows — OpenVPN not installed automatically
- Validate OpenVPN executable existence before attempting to connect
- Display clear message and download link if executable is not found
- Silently verify MSI was installed by NSIS post-install

### 🔐 IS004 / RF003 / RNF006: Credential Security
- Remove hardcoded `MASTER_PASSWORD` and `SALT` from `main.js`
- Implement key derivation from system `machine-id` or native keychain (`keytar`)

### 🔐 RF004 / RNF006: Logout and Credential Cleanup
- Validate that logout erases all Azure tokens, profile credentials, and session cache

### 🔄 RF010: Automatic Reconnection on Drop
- Implement retry logic with exponential backoff on `vpnProcess` `close` event
- Configurable retry count and interval in preferences screen

---

## [0.1.6] - 2026-03-12 _(current — pending recompilation and publishing)_

### 🔄 IS005: Auto-Update

- **`repository` field added to `package.json`**: `electron-builder 26.x` requires the `repository` field to generate the `package-type` file inside the `.deb`; without it, `electron-updater` does not activate `DebUpdater` and auto-update does not work.
- **`checkForUpdates` awaits real event**: Fixed false immediate return that reported "latest version" without checking GitHub.
- **`openExternal` exposed in `preload.js`**: Allows the renderer to safely open external URLs via `shell.openExternal`.
- **Version corrected**: `version` field in `package.json` corrected for semantic auto-update compatibility across branches.

### 🔧 Entra ID (Azure AD) Connection Fixes

- **Robust OpenVPN Azure connection**: `connect-openvpn` refactored to use an explicit Promise, resolving only after real tunnel detection (`Initialization Sequence Completed` / `CONNECTED,SUCCESS`), eliminating false positives from PID alone.
- **Connection timeout**: Added explicit 60-second timeout; if tunnel is not established in time, the process is killed with `SIGTERM` and the Promise is rejected with a descriptive message.
- **Expanded failure diagnostics**: Captures and classifies `stdout`/`stderr` errors with specific messages for sudo failure, TUN/TAP permission, and `AUTH_FAILED`.
- **Guaranteed auth file cleanup**: Temporary auth file (`authPath`) is removed on all exit paths (success, failure, timeout).
- **Spawn error handling**: Added `try/catch` around `spawn()` with clean Promise rejection if process fails to start.
- **Disconnection event fix**: `vpn-disconnected` event is no longer emitted when the process exits before the tunnel is established, preventing inconsistent UI state.
- **Config validation before connect**: Added check for `config.openvpn_config` file existence before attempting to start OpenVPN.

### 🛡️ Session and Close Fixes

- **Reinforced exit blocking with active VPN**: Improved active session detection via `isVpnSessionActive()` to prevent application close while a VPN tunnel is running.

### 🔐 Azure Token Fix

- **Token expiration corrected**: Adjusted `expires_at` calculation to handle all possible formats of the `expiresOn` field returned by MSAL: `Date` object, Unix timestamp (seconds), or missing field (fallback +1 hour).

---

## [0.1.5] - 2026-03-02

### 🔧 Bug Fixes

- **Credential Save Fix**: Fixed bug where passwords were not saved when checking "Remember credentials". Profile is now automatically selected after creation and profile ID is correctly used to save/load credentials.
- **Packaged App Icon Fix**: Fixed issue where menu icons did not load in the packaged application. Implemented custom `local-resource://` protocol to serve icons correctly in both development and production.
- **Duplicate HTML Fix**: Removed duplicate HTML sections from `index.html` causing strange UI behavior.
- **Duplicate Event Listeners Fix**: Removed duplicate `setupEventListeners()` call in `renderer.js` that could cause multiple event executions.
- **Desktop Config Fix**: Removed `desktop` configuration incompatible with `electron-builder 26.x`.

### ✅ Persistence and State Fixes

- **Password persistence fixed**: Adjusted use of state keys (`selectedProfileId`/`selectedProfileType`) and removed inconsistent partial writes with `lastProfileId`.
- **Credential encryption fixed**: Replaced invalid GCM APIs with `createCipheriv`/`createDecipheriv` with AES-256-GCM, restoring password save/load.
- **VPN tunnel state validated on startup**: Validates PID + real OpenVPN process to avoid connected UI with a dropped tunnel.
- **Exit blocked while VPN active**: App close is now blocked while a VPN tunnel is active, requiring explicit disconnection.

### 🐛 Technical Improvements

- Added more robust error handling for credential saving
- Added logging for credential debugging
- Configured `asarUnpack` to allow access to static assets (icons)
- Updated npm dependencies (axios, msal-node, electron, electron-builder, electron-updater)

---

## [0.1.4] - 2026-01-15

### 🔒 Security Improvements
- **Enhanced Credential Encryption**: Upgraded from Base64 encoding to AES-256-GCM encryption for stored passwords
- **Automatic Migration**: Seamless migration of existing credentials to secure encryption
- **Cryptographic Functions**: Implemented proper encryption/decryption utilities using Node.js crypto module

### 🔧 Technical
- **Security Architecture**: Added secure credential storage with industry-standard encryption
- **Backward Compatibility**: Automatic detection and migration of legacy Base64 credentials

---

## [0.1.3] - 2026-01-15

### 🎯 Features
- **Frameless Window Design**: Removed system menu bar and implemented custom title bar with BluePex VPN branding
- **Unified Minimize Control**: Single "Minimizar" option in menu that keeps both taskbar and tray icons visible
- **Cleaner Interface**: Removed duplicate minimize-to-tray option for better UX

### 🐛 Bug Fixes
- **Windows Connection Fix**: Fixed OpenVPN execution by removing PowerShell elevation complexity
- **Auth File Location**: Changed auth file from temp directory to profile directory for better Windows compatibility
- **Update Modal UI**: Removed undefined progress text that appeared during update checks
- **Minimize Behavior**: Ensured proper minimize to taskbar instead of immediate hiding

### 📱 Platform Improvements
- **Windows**: Direct OpenVPN execution without PowerShell RunAs verb for better compatibility
- **Cross-platform**: Improved path handling and file permissions for Windows environments
- **Debugging**: Enhanced logging for better troubleshooting on Windows

### 🔧 Technical
- **Electron Settings**: Optimized BrowserWindow configuration for frameless design
- **IPC Communications**: Streamlined minimize operations between main and renderer processes
- **File System**: Better handling of Windows file paths and permissions
- **Build Configuration**: Fixed artifactName in NSIS to match binary filename format

---

## [0.1.2] - 2026-01-15

### Added
- **Windows Domain Support**: Improved compatibility with domain-joined Windows machines
- **Automatic Elevation**: OpenVPN runs with admin privileges when needed on Windows
- **Execution Level Control**: Explicitly set app to not require admin privileges

### Fixed
- **Admin Privilege Issues**: App no longer prompts for password on domain machines
- **OpenVPN Execution**: Restored proper elevation for VPN connections on Windows
- **Process Management**: Better handling of background processes and window visibility

### Changed
- **Installer Configuration**: Added requestedExecutionLevel setting
- **Connection Strategy**: Enhanced Windows OpenVPN execution with PowerShell elevation
- **Process Visibility**: Hidden PowerShell windows for cleaner user experience

### Technical Improvements
- **Security**: Proper privilege separation between app and VPN processes
- **Compatibility**: Better support for enterprise/domain environments
- **Process Control**: Improved argument passing and execution control

---

## [0.1.1] - 2026-01-14

### Added
- **Windows Installer Enhancement**: Bundle OpenVPN MSI directly in the Windows installer for seamless installation
- **Update Modal Improvements**: Added phase indicators showing download/install status with visual feedback
- **Debug Mode Features**: Update progress simulation for testing in `index_debug.html`
- **Connection Logs**: Proper loading via IPC with cross-platform support
- **App Logs**: Implemented `getRecentLogs` method for application logging
- **User-Friendly Messages**: Improved empty state messages for logs with helpful tips

### Fixed
- **OpenVPN Installation**: Fixed MSI bundling and installation in Windows NSIS installer
- **Log Loading Errors**: Resolved "logger.getRecentLogs is not a function" error
- **Connection Logs Display**: Fixed IPC communication for secure log retrieval
- **Update Progress**: Corrected progress bar display and phase transitions
- **Error Messages**: Replaced technical errors with user-friendly guidance
- **NSIS Variables**: Fixed temp directory variable in installer script

### Changed
- **Version**: Updated to 0.1.1
- **Log Messages**: More informative and helpful messages when no logs are available
- **Update Flow**: Better visual feedback during update download and installation

### Technical Improvements
- **Security**: Moved log file access from renderer to main process via IPC
- **Cross-Platform**: Improved log directory handling for Windows and Linux
- **Build Process**: Enhanced NSIS installer with bundled dependencies
- **Error Handling**: Better fallback messages for various failure scenarios

---

## [0.1.0] - 2025-12-18

### Added
- Initial release of BluePex VPN Client
- Azure AD authentication support
- OpenVPN connection management
- User profile management
- Basic logging system
- Electron-based desktop application
- Windows and Linux support</content>
<parameter name="filePath">/home/marcos/projetos/BluePexVPN/CHANGELOG.md