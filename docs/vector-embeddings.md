# Vector Embeddings Overview

OpenAI's text embedding models transform natural language into high-dimensional vectors that capture semantic meaning. Once text is represented as vectors, you can efficiently compare, cluster, and retrieve related passages across large corpora.

## New embedding models

OpenAI now offers two third-generation models that improve price, multilingual coverage, and configurability:

| Model | Vector length | Approx. pages per US$ | MTEB performance | Max input tokens |
| --- | --- | --- | --- | --- |
| `text-embedding-3-small` | 1536 (configurable) | ~62,500 | 62.3% | 8,192 |
| `text-embedding-3-large` | 3072 (configurable) | ~9,615 | 64.6% | 8,192 |

Both models allow you to reduce the dimensionality of returned vectors with the `dimensions` parameter, letting you balance storage costs and recall quality.

## Typical use cases

* **Semantic search** – rank knowledge base articles, chat history, or documents by similarity to a user query.
* **Clustering** – group related passages or customer feedback to surface themes automatically.
* **Recommendations** – match similar products, posts, or tickets to deliver contextual suggestions.
* **Anomaly detection** – identify outliers whose embeddings are distant from a population.
* **Diversity measurement** – analyze similarity distributions to maintain coverage across topics.
* **Classification** – assign labels by comparing to reference embeddings.

Because embeddings are L2-normalized, cosine similarity and Euclidean distance deliver identical rankings while dot-product similarity can be computed quickly.

## Getting embeddings with the OpenAI API

```ts
import OpenAI from "openai";
const openai = new OpenAI();

const embedding = await openai.embeddings.create({
  model: "text-embedding-3-small",
  input: "Your text string goes here",
  encoding_format: "float",
});

console.log(embedding);
```

The response includes metadata and the embedding vector. You can persist the vector in a database for search and analytics workflows:

```json
{
  "object": "list",
  "data": [
    {
      "object": "embedding",
      "index": 0,
      "embedding": [
        -0.006929283495992422,
        -0.005336422007530928,
        -0.00004547132266452536,
        -0.024047505110502243
      ]
    }
  ],
  "model": "text-embedding-3-small",
  "usage": {
    "prompt_tokens": 5,
    "total_tokens": 5
  }
}
```

## Working with datasets

To embed a dataset—such as Amazon fine-food reviews—you can combine title and body text before requesting embeddings:

```python
from openai import OpenAI
client = OpenAI()

def get_embedding(text, model="text-embedding-3-small"):
    text = text.replace("\n", " ")
    return client.embeddings.create(input=[text], model=model).data[0].embedding

df["embedding"] = df.combined.apply(lambda x: get_embedding(x))
df.to_csv("output/embedded_reviews.csv", index=False)
```

Persisted embeddings can later be reloaded and converted to `numpy` arrays for downstream machine-learning or visualization tasks.

## Token accounting

Third-generation embedding models use the `cl100k_base` tokenizer. You can estimate usage costs by counting tokens before sending content to the API:

```python
import tiktoken

def num_tokens_from_string(text: str, encoding_name: str = "cl100k_base") -> int:
    encoding = tiktoken.get_encoding(encoding_name)
    return len(encoding.encode(text))
```

## Scaling retrieval

For fast nearest-neighbor queries across many vectors, use a vector database with cosine similarity or dot-product search. OpenAI embeddings are length-normalized, ensuring cosine similarity and Euclidean distance produce identical rankings.

## FAQ highlights

* **Ownership** – You own the embeddings generated from your data. Ensure inputs comply with OpenAI's Terms of Use and applicable laws.
* **Knowledge cut-off** – Third-generation models were last trained on data up to September 2021.
* **Performance tuning** – Adjust `dimensions` to trade-off accuracy versus storage, and select the larger model when multilingual coverage or precision is critical.

Use this overview to integrate embeddings into ingestion pipelines, retrieval services, or analytics dashboards throughout the LAW.AI platform.
