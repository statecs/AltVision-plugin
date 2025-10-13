# Contributing to AltVision

Thank you for your interest in contributing to AltVision! We're excited to have you join our mission to make the web more accessible. This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [How to Contribute](#how-to-contribute)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Pull Request Process](#pull-request-process)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Features](#suggesting-features)
- [Community](#community)

## Code of Conduct

This project adheres to a Code of Conduct that all contributors are expected to follow. Please read [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) before contributing.

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Chrome browser
- Git
- Basic knowledge of React, JavaScript, and Chrome Extension APIs

### Setting Up Your Development Environment

1. **Fork the repository** on GitHub

2. **Clone your fork**:
```bash
git clone https://github.com/YOUR_USERNAME/AltVision-plugin.git
cd AltVision-plugin
```

3. **Add the upstream remote**:
```bash
git remote add upstream https://github.com/ORIGINAL_OWNER/AltVision-plugin.git
```

4. **Install dependencies**:
```bash
npm install
```

5. **Build the plugin**:
```bash
npm build
```

6. **Load the extension in Chrome**:
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode"
   - Cclick "Load unpacked" and select the `build` folder

## How to Contribute

There are many ways to contribute to AltVision:

- 🐛 **Report bugs** - Found a bug? Report it in our [issue tracker](../../issues)
- ✨ **Suggest features** - Have an idea? Open a feature request
- 📝 **Improve documentation** - Help us make our docs better
- 🧪 **Write tests** - Increase our test coverage
- 💻 **Submit code** - Fix bugs or implement new features
- 🌍 **Add translations** - Help make AltVision available in more languages
- ♿ **Improve accessibility** - Help us practice what we preach

## Development Workflow

### Branch Naming Convention

Use descriptive branch names that include the type of change:

- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation changes
- `refactor/description` - Code refactoring
- `test/description` - Adding or updating tests
- `chore/description` - Maintenance tasks

Example: `feature/add-dyslexia-font-support`

### Making Changes

1. **Create a new branch** from `main`:
```bash
git checkout main
git pull upstream main
git checkout -b feature/your-feature-name
```

2. **Make your changes** following our [coding standards](#coding-standards)

3. **Test your changes**:
   - Load the extension in Chrome
   - Test all affected features
   - Ensure no console errors
   - Test on different websites
   - Run automated tests: `npm test`

4. **Commit your changes**:
```bash
git add .
git commit -m "Add: brief description of changes"
```

Use clear commit messages following this format:
- `Add: new feature or functionality`
- `Fix: bug fix description`
- `Update: improvements to existing features`
- `Refactor: code refactoring`
- `Docs: documentation changes`
- `Test: adding or updating tests`
- `Chore: maintenance tasks`

5. **Keep your branch up to date**:
```bash
git fetch upstream
git rebase upstream/main
```

6. **Push to your fork**:
```bash
git push origin feature/your-feature-name
```

7. **Open a Pull Request** (see [Pull Request Process](#pull-request-process))

## Coding Standards

### JavaScript/React

- Use **ES6+ syntax** (arrow functions, destructuring, template literals, etc.)
- Use **functional components** with hooks (avoid class components)
- Follow **React best practices**:
  - Keep components small and focused
  - Use proper prop validation
  - Avoid prop drilling (use context when needed)
  - Use `useCallback` and `useMemo` appropriately for performance

### Code Style

- **Indentation**: 2 spaces (no tabs)
- **Quotes**: Single quotes for strings, except in JSX (use double quotes)
- **Semicolons**: Use them
- **Line length**: Try to keep lines under 100 characters
- **Naming conventions**:
  - Components: PascalCase (`MyComponent.js`)
  - Functions/variables: camelCase (`myFunction`, `myVariable`)
  - Constants: UPPER_SNAKE_CASE (`MAX_ITEMS`)
  - Files: PascalCase for components, camelCase for utilities

### File Organization

- Place React components in `src/components/`
- Place utility functions in `src/utils/`
- Place Chrome extension scripts in `public/`
- Keep related files together

### Chrome Extension Best Practices

- Use **Manifest V3** APIs
- Minimize content script injection
- Use message passing between background and content scripts
- Handle permissions properly
- Optimize performance (avoid excessive DOM queries)

### Accessibility

Since this is an accessibility tool, our code must be accessible:
- Use semantic HTML
- Include ARIA labels where appropriate
- Ensure keyboard navigation works
- Test with screen readers when possible
- Follow WCAG 2.1 guidelines

### Comments

- Write self-documenting code when possible
- Add comments for complex logic
- Use JSDoc for function documentation:

```javascript
/**
 * Calculates the contrast ratio between two colors
 * @param {string} color1 - First color in hex format
 * @param {string} color2 - Second color in hex format
 * @returns {number} Contrast ratio
 */
function calculateContrastRatio(color1, color2) {
  // Implementation
}
```

## Testing Guidelines

### Manual Testing

Before submitting a PR, test your changes:

1. **Load the extension** in Chrome
2. **Test affected features** on multiple websites
3. **Check browser console** for errors
4. **Test edge cases**:
   - Pages with no images
   - Pages with many images
   - Dynamic content (SPAs)
   - Different screen sizes
5. **Test with different states**:
   - Extension enabled/disabled
   - Premium features (if applicable)
   - Different settings configurations

### Automated Testing

We use Jest and React Testing Library:

```bash
npm test
```

When adding new features:
- Write unit tests for utility functions
- Write integration tests for components
- Aim for meaningful test coverage, not 100% coverage

### Writing Tests

Example test structure:

```javascript
import { render, screen } from '@testing-library/react';
import MyComponent from './MyComponent';

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('should handle click events', () => {
    const handleClick = jest.fn();
    render(<MyComponent onClick={handleClick} />);
    // Test implementation
  });
});
```

## Pull Request Process

### Before Submitting

- ✅ Code follows our style guidelines
- ✅ All tests pass (`npm test`)
- ✅ Extension builds successfully (`npm run build`)
- ✅ Manual testing completed
- ✅ No console errors or warnings
- ✅ Documentation updated (if needed)
- ✅ Branch is up to date with `main`

### Submitting Your PR

1. **Push your branch** to your fork on GitHub

2. **Create a Pull Request** from your branch to the `main` branch of the original repository

3. **Fill out the PR template** with:
   - Clear description of changes
   - Related issue numbers (if applicable)
   - Screenshots/GIFs for UI changes
   - Testing steps
   - Any breaking changes

### PR Title Format

Use descriptive titles:
- `Add vision simulation for monochromacy`
- `Fix contrast checker color picker bug`
- `Update README installation instructions`

### Review Process

1. A maintainer will review your PR
2. Address any requested changes
3. Push updates to your branch (PR will update automatically)
4. Once approved, a maintainer will merge your PR

### After Your PR is Merged

1. **Delete your branch**:
```bash
git branch -d feature/your-feature-name
git push origin --delete feature/your-feature-name
```

2. **Update your fork**:
```bash
git checkout main
git pull upstream main
git push origin main
```

## Reporting Bugs

Found a bug? Help us fix it!

### Before Reporting

1. **Check existing issues** to avoid duplicates
2. **Try the latest version** to see if it's already fixed
3. **Gather information**:
   - Chrome version
   - Extension version
   - Operating system
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots/console errors

### Creating a Bug Report

Use our bug report template and include:

- **Clear title**: "Contrast checker fails on gradient backgrounds"
- **Description**: What happened?
- **Steps to reproduce**: How can we see this bug?
- **Expected behavior**: What should happen?
- **Actual behavior**: What actually happens?
- **Environment**: Browser version, OS, etc.
- **Screenshots**: If applicable
- **Console errors**: Copy any error messages

## Suggesting Features

Have an idea? We'd love to hear it!

### Before Suggesting

1. **Check existing issues** to see if it's already suggested
2. **Consider the scope**: Does it fit AltVision's mission?
3. **Think about implementation**: Is it technically feasible?

### Creating a Feature Request

Include:

- **Clear title**: "Add support for screen reader simulation"
- **Problem statement**: What problem does this solve?
- **Proposed solution**: How would it work?
- **Alternatives considered**: Other approaches?
- **Additional context**: Mockups, examples, research?

## Community

### Getting Help

- **Questions?** Open a [Discussion](../../discussions)
- **Stuck?** Ask in issues with the "question" label
- **Need clarification?** Comment on related PRs or issues

### Stay Connected

- Watch the repository for updates
- Star the project if you find it useful
- Share AltVision with others interested in accessibility

## Recognition

Contributors will be recognized in:
- GitHub contributors list
- Release notes (for significant contributions)
- Our gratitude and appreciation!

## License

By contributing to AltVision, you agree that your contributions will be licensed under the Apache License 2.0.

---

Thank you for contributing to a more accessible web! 🌍♿
