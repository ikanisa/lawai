      input: question,
      ...(env3.EMBEDDING_DIMENSION ? { dimensions: env3.EMBEDDING_DIMENSION } : {})
