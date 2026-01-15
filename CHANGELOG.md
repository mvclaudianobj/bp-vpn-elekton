# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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