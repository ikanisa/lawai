# Function Calling Integration Guide

Function calling (also called *tool calling*) lets Law.ai agents safely reach out to
external systems. This guide distills OpenAI's best practices so you can connect
models to first-party data and actions with predictable behavior.

## Conceptual Overview

- **Tools** – Capabilities you expose to the model, such as fetching weather or
  running custom code.
- **Tool calls** – Requests from the model to invoke a tool.
- **Tool call outputs** – Results your code returns to the model after executing
  the requested tool.

A typical flow contains five steps:

1. Prompt the model with the tools that are available.
2. Receive one or more tool calls from the model.
3. Execute each requested tool within your application.
4. Append the tool outputs to the conversation history.
5. Ask the model for a final response (it may decide to call more tools).

> **Reasoning models** (for example, `gpt-5` or `o4-mini`) emit reasoning traces
> alongside tool calls. Preserve and resend those traces together with the tool
> output.

## Defining Function Tools

Declare function tools in the `tools` argument when calling the Responses API.
Each tool must specify:

- `type`: Always `"function"` for schema-driven tools.
- `name`: A unique identifier (`get_weather`).
- `description`: When and how to use the function.
- `parameters`: A JSON Schema describing the accepted inputs. Leverage nested
  objects, enums, and descriptions to guide the model.
- `strict` *(optional but recommended)*: Enforces exact schema adherence when
  set to `true`. Combine with `"additionalProperties": false` and list every
  required field.

```python
get_weather_tool = {
    "type": "function",
    "name": "get_weather",
    "description": "Retrieves current weather for the given location.",
    "strict": True,
    "parameters": {
        "type": "object",
        "properties": {
            "location": {
                "type": "string",
                "description": "City and country, e.g. Bogotá, Colombia"
            },
            "units": {
                "type": ["string", "null"],
                "enum": ["celsius", "fahrenheit"],
                "description": "Units for the reported temperature"
            }
        },
        "required": ["location", "units"],
        "additionalProperties": False
    }
}
```

### Authoring Tips

- Provide precise, descriptive names and parameter docs.
- Clarify exactly when to use (or avoid) each tool in the system prompt.
- Favor enums and structured objects to prevent invalid inputs.
- Combine sequential calls into a single function when possible to reduce tool
  count.
- Keep the tool list small (ideally under 20 tools) for the best accuracy.

## Handling Tool Calls

When the model calls a function, you receive entries with `type: "function_call"`.
Each includes a `call_id`, the `name`, and JSON-encoded `arguments`. Execute the
request and respond with a `function_call_output` item containing:

- `call_id`: Mirrors the original call.
- `output`: A string payload (JSON, plain text, status message, etc.).

```python
for item in response.output:
    if item.type != "function_call":
        continue

    args = json.loads(item.arguments)
    result = call_function(item.name, args)

    input_messages.append({
        "type": "function_call_output",
        "call_id": item.call_id,
        "output": json.dumps(result),
    })
```

Repeat the request/response cycle until the model produces a final answer.

## Tool Choice and Parallelism

Control invocation behavior via `tool_choice`:

- `"auto"` *(default)* – Model decides which tools to call (zero or more).
- `"required"` – Forces at least one tool call.
- `{ "type": "function", "name": "get_weather" }` – Forces a specific call.
- `{ "type": "allowed_tools", ... }` – Restricts usage to a subset without
  altering the cached schema list.

Set `parallel_tool_calls` to `false` if you must ensure at most one function call
per turn (recommended for certain nano model snapshots).

## Streaming Tool Calls

Enable `stream=True` to receive incremental updates while the model constructs
arguments. Watch for:

- `response.output_item.added` – announces a function call.
- `response.function_call_arguments.delta` – delivers argument string deltas.
- `response.function_call_arguments.done` – signals completion with the final
  argument payload.

Aggregate deltas to reconstruct the arguments string, then execute the tool and
return results as usual.

## Custom Tools

Custom tools accept arbitrary string inputs instead of structured JSON. Define
one by setting `"type": "custom"` and optionally constraining its format with a
context-free grammar (CFG).

```python
response = client.responses.create(
    model="gpt-5",
    input="Use the code_exec tool to print hello world.",
    tools=[{
        "type": "custom",
        "name": "code_exec",
        "description": "Executes arbitrary Python code.",
    }]
)
```

The response includes a `custom_tool_call` entry with the free-form input. Use
CFGs (Lark or Regex) to strictly bound accepted strings, remembering that
grammars must remain simple and single-line (for regex) to avoid API errors.

## Token and Latency Considerations

- Tool definitions are prepended to the system message and count toward context
  tokens. Reduce description length or limit active tools to avoid hitting
  limits.
- Fine-tuned models may incur extra latency on the first request because the
  schema is cached.
- Cached schemas are not eligible for zero data retention.

## Troubleshooting Checklist

- **Unexpected arguments** – Ensure `strict` mode is enabled and schemas forbid
  additional properties.
- **Multiple simultaneous calls** – Disable parallel calls with
  `parallel_tool_calls=False`.
- **Grammar errors** – Simplify terminals, avoid lookarounds, and keep regex
  patterns on a single line.
- **Model drift** – Tighten the grammar, add prompt examples, or increase
  reasoning effort.

By following these guidelines, your Law.ai agents can safely extend their reach
beyond training data while maintaining deterministic, debuggable behavior.
