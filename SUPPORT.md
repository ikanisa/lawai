# Support

Thank you for using Avocat-AI! This document provides information on how to get help and support.

## Table of Contents

- [Getting Help](#getting-help)
- [Reporting Issues](#reporting-issues)
- [Feature Requests](#feature-requests)
- [Documentation](#documentation)
- [Community](#community)
- [Commercial Support](#commercial-support)

## Getting Help

### For Users

If you're a user of the Avocat-AI system and need help:

1. **Check the Documentation**: Start with the [README](./README.md) and [documentation](./docs/) for guidance
2. **Review Known Issues**: Check [known issues](./docs/architecture.md#known-issues--technical-debt) for documented problems
3. **Contact Your Administrator**: Reach out to your organization's Avocat-AI administrator
4. **Submit a Support Request**: [TBD - Add support channel information]

### For Developers

If you're contributing to or deploying Avocat-AI:

1. **Read the Documentation**:
   - [Architecture Documentation](./docs/architecture.md)
   - [Contributing Guidelines](./CONTRIBUTING.md)
   - [Copilot Instructions](./.github/copilot-instructions.md)
   - [Release Runbook](./docs/release-runbook.md)

2. **Check Existing Issues**: Search [GitHub Issues](../../issues) for similar problems

3. **Review Troubleshooting Guides**:
   - [Network Troubleshooting](./docs/troubleshooting_network.md)
   - [Operations Readiness](./docs/operations/operations_readiness_overview.md)

4. **Ask the Community**: [TBD - Add community channel information]

## Reporting Issues

### Bug Reports

Before reporting a bug:

1. **Search existing issues** to avoid duplicates
2. **Check known issues** in documentation
3. **Verify it's reproducible** in the latest version
4. **Test in a clean environment** if possible

When reporting a bug, please include:

- **Description**: Clear description of the issue
- **Steps to Reproduce**: Detailed steps to reproduce the behavior
- **Expected Behavior**: What you expected to happen
- **Actual Behavior**: What actually happened
- **Environment**:
  - Node.js version (`node --version`)
  - PNPM version (`pnpm --version`)
  - Operating System (macOS, Linux, Windows)
  - Browser (if applicable)
- **Logs**: Relevant error messages and logs
- **Screenshots**: If applicable
- **Additional Context**: Any other relevant information

**Use the Bug Report Template** when creating a new issue.

### Security Vulnerabilities

**Do not report security vulnerabilities through public GitHub issues.**

Please follow the [Security Policy](./SECURITY.md) to report security vulnerabilities responsibly.

## Feature Requests

We welcome feature requests! Before submitting:

1. **Search existing issues** to see if it's already requested
2. **Check the roadmap** (if available) to see if it's planned
3. **Consider contributing** the feature yourself

When requesting a feature, please include:

- **Use Case**: Describe the problem you're trying to solve
- **Proposed Solution**: Your idea for how to solve it
- **Alternatives Considered**: Other approaches you've considered
- **Additional Context**: Any other relevant information
- **Mockups/Examples**: Visual aids if applicable

**Use the Feature Request Template** when creating a new issue.

## Documentation

### Available Documentation

- **[README](./README.md)**: Getting started, setup, deployment
- **[Architecture](./docs/architecture.md)**: System architecture and design
- **[Release Runbook](./docs/release-runbook.md)**: Deployment and operations
- **[Contributing](./CONTRIBUTING.md)**: How to contribute
- **[Security Policy](./SECURITY.md)**: Security guidelines
- **[Operations Runbooks](./docs/operations/)**: Operational procedures
- **[Deployment Guides](./docs/deployment/)**: Deployment instructions

### Improving Documentation

Found an error or gap in the documentation? We appreciate contributions!

1. **File an issue** describing the problem
2. **Submit a PR** with the fix (even better!)
3. Follow the [Contributing Guidelines](./CONTRIBUTING.md)

## Community

### Communication Channels

[TBD - Add information about community channels when available]

Examples:
- **Slack/Discord**: Community chat
- **GitHub Discussions**: Q&A and discussions
- **Mailing List**: Announcements and updates
- **Stack Overflow**: Tag questions with `avocat-ai`

### Code of Conduct

We are committed to providing a welcoming and inclusive experience for everyone. Please read and follow our Code of Conduct [TBD - Link when available].

Expected behavior:
- Be respectful and inclusive
- Be collaborative and constructive
- Be patient and helpful
- Focus on what is best for the community

Unacceptable behavior:
- Harassment, discrimination, or offensive comments
- Trolling, insulting/derogatory comments
- Publishing others' private information
- Other conduct deemed inappropriate in a professional setting

## Commercial Support

### Enterprise Support

For organizations requiring dedicated support, we offer commercial support options [TBD - Add information when available]:

- **Dedicated Support Team**: Priority access to support engineers
- **SLA Guarantees**: Guaranteed response times
- **Custom Development**: Feature development for specific needs
- **Training**: Team training and onboarding
- **Consulting**: Architecture and deployment consulting

Contact: [TBD - Add contact information]

### Professional Services

We offer professional services including:

- **Deployment Assistance**: Help with setup and deployment
- **Integration Services**: Integration with existing systems
- **Custom Development**: Tailored features and modifications
- **Performance Tuning**: Optimization and scaling assistance
- **Security Audits**: Comprehensive security reviews

Contact: [TBD - Add contact information]

## Response Times

### Community Support (Free)

- **Response Time**: Best effort, no guarantees
- **Availability**: During community members' availability
- **Channels**: GitHub Issues, community forums

### Commercial Support (Paid)

[TBD - Define SLAs when commercial support is available]

Example tiers:
- **Critical (P0)**: 1 hour response, 24/7
- **High (P1)**: 4 hours response, business hours
- **Medium (P2)**: 1 business day response
- **Low (P3)**: 3 business days response

## Frequently Asked Questions

### Installation & Setup

**Q: What are the system requirements?**

A: See the [README](./README.md) for detailed requirements. Key requirements:
- Node.js 20.x
- PNPM 8.15.4
- Supabase account (for database and edge functions)
- OpenAI API key (for AI features)

**Q: Installation fails with Cypress errors**

A: Cypress download can fail in restricted networks. Use `pnpm install --ignore-scripts` as documented in [copilot-instructions.md](./.github/copilot-instructions.md).

**Q: Lockfile out of sync errors**

A: Use `pnpm install --no-frozen-lockfile` for local development. See [copilot-instructions.md](./.github/copilot-instructions.md).

### Development

**Q: Typecheck fails in observability package**

A: This is a known issue due to OpenTelemetry version conflicts. Workspace-specific typechecking works. See [known issues](./docs/architecture.md#known-issues--technical-debt).

**Q: How do I run only specific tests?**

A: Use `pnpm --filter <workspace> test` to run tests for a specific workspace.

**Q: How do I add a new migration?**

A: Create migration in `db/migrations/` with format `YYYYMMDDHHMMSS_slug.sql`, then run `node scripts/generate-migration-manifest.mjs`. See [copilot-instructions.md](./.github/copilot-instructions.md).

### Deployment

**Q: Where can I deploy Avocat-AI?**

A: 
- Frontend (PWA/Web): Vercel (documented in [deployment guide](./docs/deployment/vercel.md))
- Edge Functions: Supabase Edge Runtime
- API: Any Node.js hosting (Docker container recommended)
- Database: Supabase (managed Postgres)

**Q: How do I handle secrets in production?**

A: Use environment variables. Never commit secrets. Production rejects placeholder values. See [Security Policy](./SECURITY.md) and [Environment Variables](./docs/env-matrix.md).

**Q: How do I rollback a deployment?**

A: See [Release Runbook - Rollback Procedures](./docs/release-runbook.md#rollback-procedures).

### Operations

**Q: How do I monitor the system?**

A: See [Architecture - Observability](./docs/architecture.md#observability) and [Release Runbook - Monitoring](./docs/release-runbook.md#monitoring--alerts).

**Q: What are the operational runbooks?**

A: See [docs/operations/](./docs/operations/) for operational procedures and [Release Runbook](./docs/release-runbook.md) for deployment procedures.

**Q: How do I run database migrations?**

A: Use `pnpm db:migrate`. See [Release Runbook - Database Migrations](./docs/release-runbook.md#database-migrations).

## Getting Involved

### Contributing

We welcome contributions! See [CONTRIBUTING.md](./CONTRIBUTING.md) for:

- Code contribution guidelines
- Development workflow
- Testing requirements
- Code review process
- Commit message conventions

### Areas Where We Need Help

- **Documentation**: Improving and expanding docs
- **Testing**: Adding test coverage
- **Bug Fixes**: Addressing known issues
- **Features**: Implementing new features
- **Translations**: French/English translations
- **Performance**: Optimization and profiling

## Support Lifecycle

### Release Support

- **Current Release**: Full support
- **Previous Release**: Security and critical bug fixes for 30 days
- **Older Releases**: No longer supported

### Long-Term Support (LTS)

LTS versions [TBD - Define LTS policy if applicable]:
- Extended security updates
- Critical bug fixes
- Longer support window

## Additional Resources

### External Resources

- **Supabase Documentation**: https://supabase.com/docs
- **Next.js Documentation**: https://nextjs.org/docs
- **Fastify Documentation**: https://www.fastify.io/docs
- **OpenAI API Documentation**: https://platform.openai.com/docs
- **Deno Documentation**: https://deno.land/manual

### Learning Resources

[TBD - Add tutorials, videos, blog posts when available]

## Contact Information

### General Inquiries

- **Website**: [TBD]
- **Email**: [TBD]
- **GitHub**: https://github.com/ikanisa/lawai

### Security

- **Security Email**: [TBD]
- **Security Policy**: [SECURITY.md](./SECURITY.md)

### Team

- **Platform Squad**: Responsible for API, edge functions, shared packages
- **Frontend Squad**: Responsible for web and PWA interfaces
- **Ops Team**: Responsible for operations and infrastructure

See [CODEOWNERS](./.github/CODEOWNERS) for detailed ownership.

---

**Last Updated**: 2025-10-29  
**Version**: 1.0  
**Maintained by**: Platform Squad

## Feedback

We're always looking to improve our support. Please let us know:

- What's working well
- What could be better
- What's missing
- Suggestions for improvement

[TBD - Add feedback channel]

Thank you for using Avocat-AI! 🙏
