# Security Policy

## Supported Versions

We take security seriously at AltVision. The following versions are currently supported with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Security Considerations

### User Data and Privacy

AltVision is designed with privacy in mind:

- **Local Storage**: API keys and settings are stored locally in Chrome's storage (sync/local storage)
- **No Telemetry**: We do not collect browsing data, analytics, or usage statistics
- **External Services**: The extension communicates with:
  - Your own OpenAI API keys (user-provided)
  - Cloudflare Worker backend for API key validation

### API Keys

When you provide API keys:
- Keys are stored in Chrome's sync storage (encrypted by Chrome)
- Keys are sent to our Cloudflare Worker for validation and proxying AI requests
- We recommend using API keys with appropriate rate limits and spending caps
- You can remove your API keys at any time from the extension settings

### Permissions

AltVision requests the following Chrome permissions:
- `storage` - To save settings and API keys locally
- `sidePanel` - To display the extension UI
- `contextMenus` - To add right-click menu options
- `<all_urls>` content scripts - To inject accessibility tooltips on web pages
- Host permission for your Cloudflare Worker domain - For backend API communication (must be configured)

## Reporting a Vulnerability

We appreciate responsible disclosure of security vulnerabilities. If you discover a security issue, please follow these steps:

### How to Report

**DO NOT** open a public issue for security vulnerabilities.

Instead, please report security vulnerabilities by:

1. **Email**: Send details to [hello@cstate.se]
   - Use subject line: "[SECURITY] AltVision - Brief Description"

2. **Include the following information**:
   - Description of the vulnerability
   - Steps to reproduce the issue
   - Potential impact
   - Suggested fix (if you have one)
   - Your contact information for follow-up

### What to Expect

1. **Acknowledgment**: We will acknowledge receipt of your report within 48 hours
2. **Initial Assessment**: We will provide an initial assessment within 5 business days
3. **Updates**: We will keep you informed of our progress
4. **Resolution**: We aim to resolve critical issues within 30 days
5. **Credit**: With your permission, we will credit you in the security advisory

### Disclosure Policy

- Please give us reasonable time to fix the issue before public disclosure
- We will coordinate with you on the disclosure timeline
- We will publicly acknowledge your responsible disclosure (unless you prefer to remain anonymous)

## Security Best Practices for Users

### Protecting Your API Keys

1. **Use Limited Keys**: Set spending limits on your OpenAI API keys
2. **Monitor Usage**: Regularly check your API usage in the provider dashboards
3. **Rotate Keys**: Periodically generate new API keys and update the extension
4. **Remove When Not Needed**: If you stop using the extension, remove your API keys

### Safe Usage

1. **Keep Updated**: Always use the latest version of AltVision
2. **Verify Source**: Only install AltVision from trusted sources (Chrome Web Store or official GitHub releases)
3. **Review Permissions**: Understand what permissions the extension requests
4. **Report Suspicious Behavior**: If the extension behaves unexpectedly, report it

### For Developers and Contributors

1. **Never Commit Secrets**: Don't commit API keys, tokens, or credentials
2. **Use Environment Variables**: Keep sensitive data out of source code
3. **Review Dependencies**: Be aware of third-party dependencies and their security
4. **Validate Input**: Always validate and sanitize user input
5. **Secure Communication**: Use HTTPS for all external communications

## Known Security Considerations

### Backend Dependency

⚠️ **Configuration Required**: AltVision requires a Cloudflare Worker backend:
- **URL**: Must be configured in `src/services/urls.js` (currently set to placeholder `_YOUR_CLOUDFLARE_WORKER_URL_`)
- **Purpose**: API key validation, AI request proxying, and image processing
- **Data transmitted**: User-provided API keys, AI request content, and image data

**Security Considerations**:
- You must deploy your own Cloudflare Worker backend (see README for instructions)
- The backend handles sensitive data (API keys) and should implement proper security measures
- Use HTTPS only (required by Chrome extensions)
- Implement rate limiting and authentication in your backend
- Never commit your actual backend URL to public repositories if it contains sensitive configuration

### Third-Party Services

The extension integrates with:
- **ExtPay**: Payment processing (GDPR compliant)
- **OpenAI API**: AI-powered features (subject to OpenAI's security policies)

### Content Script Injection

AltVision injects content scripts into all web pages. While necessary for functionality:
- Scripts run with the same privileges as the page
- We minimize the attack surface by keeping content scripts focused
- Review the code in `public/content.js` for transparency

## Security Updates

Security updates will be:
1. Released as soon as possible after discovery
2. Announced in GitHub releases with the `security` tag
3. Detailed in this SECURITY.md file
4. Pushed to the Chrome Web Store immediately

## Vulnerability Disclosure History

No vulnerabilities have been publicly disclosed at this time.

## Contact

For security concerns, please contact:
- Email: [hello@cstate.se]
- GitHub: Open a security advisory in the repository

For general questions, please use the public issue tracker.

---

**Last Updated**: 2025-01-13

Thank you for helping keep AltVision and its users secure!
