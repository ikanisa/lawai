# Deep Research Models Integration Guide

This guide summarizes best practices for using OpenAI's deep research models (`o3-deep-research` and `o4-mini-deep-research`) within the Law.ai stack. The focus is on enabling comprehensive research workflows while maintaining security and operational reliability.

## Model Overview

- **Optimized Capabilities**: The deep research models specialize in multi-step research tasks. They can browse the web, query private data sources through MCP servers or vector stores, and execute analytical code via the code interpreter tool.
- **Typical Use Cases**: Legal or scientific research, market and competitor analysis, and reporting on large internal datasets.

## Kickstarting a Deep Research Task

Use the Responses API with `background=True` for long-running jobs. Attach at least one data source (web search, file search, or MCP). Optionally, include the code interpreter container for data analysis.

```python
from openai import OpenAI
client = OpenAI(timeout=3600)

input_text = """
Research the economic impact of semaglutide on global healthcare systems.
Do:
- Include specific figures, trends, statistics, and measurable outcomes.
- Prioritize reliable, up-to-date sources: peer-reviewed research, health
  organizations (e.g., WHO, CDC), regulatory agencies, or pharmaceutical
  earnings reports.
- Include inline citations and return all source metadata.

Be analytical, avoid generalities, and ensure that each section supports
data-backed reasoning that could inform healthcare policy or financial modeling.
"""

response = client.responses.create(
    model="o3-deep-research",
    input=input_text,
    background=True,
    tools=[
        {"type": "web_search_preview"},
        {
            "type": "file_search",
            "vector_store_ids": [
                "vs_68870b8868b88191894165101435eef6",
                "vs_12345abcde6789fghijk101112131415"
            ]
        },
        {
            "type": "code_interpreter",
            "container": {"type": "auto"}
        },
    ],
)

print(response.output_text)
```

> **Tip:** Configure webhooks for background tasks to receive completion notifications.

## Understanding Response Structure

Responses contain a series of tool call entries (web search, file search, MCP, or code interpreter) followed by the final answer message. Tool call records show queries and fetched documents, enabling traceability for audits.

### Example Tool Call Entry

```json
{
  "id": "ws_685d81b4946081929441f5ccc100304e084ca2860bb0bbae",
  "type": "web_search_call",
  "status": "completed",
  "action": {
    "type": "search",
    "query": "positive news story today"
  }
}
```

### Example Final Message Entry

The final answer includes inline citations annotated with URLs.

```json
{
  "type": "message",
  "content": [
    {
      "type": "output_text",
      "text": "...answer with inline citations...",
      "annotations": [
        {
          "url": "https://www.realwatersports.com",
          "title": "Real Water Sports",
          "start_index": 123,
          "end_index": 145
        }
      ]
    }
  ]
}
```

## Prompting Strategy

Deep research calls do not perform automatic clarification. Provide fully specified prompts up front. To improve prompt quality:

1. **Clarify With a Lightweight Model**: Use a faster model such as `gpt-4.1` to collect missing requirements.
2. **Rewrite Prompts for Specificity**: Transform user requests into detailed instructions before handing them to deep research.

### Clarification Prompt Example

```python
instructions = """
You are talking to a user who is asking for a research task to be conducted. Your job is to gather more information from the user to successfully complete the task.

GUIDELINES:
- Be concise while gathering all necessary information**
- Make sure to gather all the information needed to carry out the research task in a concise, well-structured manner.
- Use bullet points or numbered lists if appropriate for clarity.
- Don't ask for unnecessary information, or information that the user has already provided.

IMPORTANT: Do NOT conduct any research yourself, just gather information that will be given to a researcher to conduct the research task.
"""

input_text = "Research surfboards for me. I'm interested in ...";

response = client.responses.create(
  model="gpt-4.1",
  input=input_text,
  instructions=instructions,
)
```

### Prompt Enrichment Example

```python
instructions = """
You will be given a research task by a user. Your job is to produce a set of
instructions for a researcher that will complete the task. Do NOT complete the
task yourself, just provide instructions on how to complete it.

GUIDELINES:
1. **Maximize Specificity and Detail**
- Include all known user preferences and explicitly list key attributes or
  dimensions to consider.
- It is of utmost importance that all details from the user are included in
  the instructions.

2. **Fill in Unstated But Necessary Dimensions as Open-Ended**
- If certain attributes are essential for a meaningful output but the user
  has not provided them, explicitly state that they are open-ended or default
  to no specific constraint.

3. **Avoid Unwarranted Assumptions**
- If the user has not provided a particular detail, do not invent one.
- Instead, state the lack of specification and guide the researcher to treat
  it as flexible or accept all possible options.

4. **Use the First Person**
- Phrase the request from the perspective of the user.

5. **Tables**
- If you determine that including a table will help illustrate, organize, or
  enhance the information in the research output, you must explicitly request
  that the researcher provide them.

6. **Headers and Formatting**
- You should include the expected output format in the prompt.
- If the user is asking for content that would be best returned in a
  structured format (e.g. a report, plan, etc.), ask the researcher to format
  as a report with the appropriate headers and formatting that ensures clarity
  and structure.

7. **Language**
- If the user input is in a language other than English, tell the researcher
  to respond in this language, unless the user query explicitly asks for the
  response in a different language.

8. **Sources**
- If specific sources should be prioritized, specify them in the prompt.
- For product and travel research, prefer linking directly to official or
  primary websites (e.g., official brand sites, manufacturer pages, or
  reputable e-commerce platforms like Amazon for user reviews) rather than
  aggregator sites or SEO-heavy blogs.
- For academic or scientific queries, prefer linking directly to the original
  paper or official journal publication rather than survey papers or secondary
  summaries.
"""

input_text = "Research surfboards for me. I'm interested in ..."

response = client.responses.create(
    model="gpt-4.1",
    input=input_text,
    instructions=instructions,
)
```

## Working With Private Data

Deep research models can access private data through prompts, vector stores, connectors, or remote MCP servers.

### Vector Stores

Attach up to two vector stores per request. Ensure your vector store contents are trusted and relevant to the research task.

### Connectors

Use connectors to integrate data from external platforms like Dropbox or Gmail. They appear as built-in tools in the Responses API.

### Remote MCP Servers

- Implement MCP servers that expose compatible **search** and **fetch** interfaces.
- Configure `require_approval` to `never` because deep research assumes read-only access for these tools.
- Ensure MCP servers are trusted and audited before connecting them to sensitive data sources.

```python
resp = client.responses.create(
    model="o3-deep-research",
    background=True,
    reasoning={
        "summary": "auto",
    },
    tools=[
        {
            "type": "mcp",
            "server_label": "mycompany_mcp_server",
            "server_url": "https://mycompany.com/mcp",
            "require_approval": "never",
        },
    ],
    instructions="<deep research instructions...>",
    input="What similarities are in the notes for our closed/lost Salesforce opportunities?",
)
```

## Security Best Practices

1. **Connect Only Trusted Sources**: Limit MCP servers and vector store files to trusted content to mitigate prompt-injection risk.
2. **Log Tool Calls**: Record requests, tool calls, and responses for at least 30 days (or per organizational policy) to monitor misuse.
3. **Stage Sensitive Workflows**: Run public web research separately from private-data queries to reduce exposure.
4. **Validate Tool Arguments**: Apply schema validation to prevent unexpected payloads in tool calls.
5. **Monitor for Exfiltration**: Use guardrail prompts or LLM-based monitors to detect and block attempts to leak sensitive data.

### Example Exfiltration Scenario

An attacker-controlled web page could embed hidden instructions that convince the model to leak CRM data in a subsequent web search query. Prevent this by restricting untrusted sources, auditing logs, and validating outgoing requests.

## Additional Resources

- [OpenAI Cookbook: Introduction to deep research](https://cookbook.openai.com/examples/deep_research)
- [Deep research with the Agents SDK](https://cookbook.openai.com/examples/deep_research_agents_sdk)
- [Building a deep research MCP server](https://cookbook.openai.com/examples/deep_research_mcp)

