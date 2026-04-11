# omni openwork

[![npm][npm-badge]][npm-url] [![License: MIT][license-badge]][license-url]

[npm-badge]: https://img.shields.io/npm/v/openwork.svg
[npm-url]: https://www.npmjs.com/package/openwork
[license-badge]: https://img.shields.io/badge/License-MIT-yellow.svg
[license-url]: https://opensource.org/licenses/MIT

A desktop interface for [deepagentsjs](https://github.com/langchain-ai/deepagentsjs) and [LangChain Agents](https://github.com/langchain-ai/agent-protocol) — an opinionated harness for building deep agents with filesystem capabilities, browser use, computer use, planning, and subagent delegation. **This fork allows multi agent collaboration among LangGraph Agents as well as the main Deep Agent loop.**

![openwork screenshot](docs/screenshot.png)

## Get Started

```bash
# Run directly with npx
npx openwork

# Or install globally
npm install -g openwork
openwork
```

Requires Node.js 18+.

### From Source

```bash
git clone git@github.com:web-harness/omni-openwork.git
cd omni-openwork
npm install
npm run dev
```

Or configure them in-app via the settings panel.

## Supported Providers

- For the Deep Agent main loop, any OpenAI compatible endpoint works.
- For the collaborative agents, LangGraph agent-protocol is supported.

You do not need extra LangGraph agents to work with this harness, but you do need an OpenAI compatible endpoint for the main agent loop.

## License

MIT — see [LICENSE](LICENSE) for details.
