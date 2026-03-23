type JsonToken = {
  value: string
  tone: string
}

function parseJsonLikeString(value: unknown) {
  if (typeof value !== 'string') {
    return value
  }

  const trimmed = value.trim()

  if (!trimmed) {
    return value
  }

  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    try {
      return JSON.parse(trimmed)
    } catch {
      return value
    }
  }

  return value
}

function formatJsonValue(value: unknown) {
  try {
    return JSON.stringify(parseJsonLikeString(value), null, 2) ?? 'null'
  } catch {
    return '"[unserializable]"'
  }
}

function tokenizeJsonLine(line: string): JsonToken[] {
  const tokens: JsonToken[] = []
  const pattern =
    /("(?:\\.|[^"\\])*")(?=\s*:)|"(?:\\.|[^"\\])*"|true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|[[\]{},:]/g

  let lastIndex = 0

  for (const match of line.matchAll(pattern)) {
    const value = match[0]
    const index = match.index ?? 0

    if (index > lastIndex) {
      tokens.push({
        value: line.slice(lastIndex, index),
        tone: 'text-slate-600 dark:text-slate-400',
      })
    }

    let tone = 'text-slate-700 dark:text-slate-200'

    if (/^"/.test(value) && /^\s*:/.test(line.slice(index + value.length))) {
      tone = 'text-sky-700 dark:text-sky-300'
    } else if (/^"/.test(value)) {
      tone = 'text-emerald-700 dark:text-emerald-300'
    } else if (/^(true|false)$/.test(value)) {
      tone = 'text-amber-700 dark:text-amber-300'
    } else if (value === 'null') {
      tone = 'text-fuchsia-700 dark:text-fuchsia-300'
    } else if (/^-?\d/.test(value)) {
      tone = 'text-cyan-700 dark:text-cyan-300'
    } else {
      tone = 'text-slate-500 dark:text-slate-400'
    }

    tokens.push({ value, tone })
    lastIndex = index + value.length
  }

  if (lastIndex < line.length) {
    tokens.push({
      value: line.slice(lastIndex),
      tone: 'text-slate-700 dark:text-slate-200',
    })
  }

  return tokens
}

export function JsonCodeBlock({
  value,
  className = '',
}: {
  value: unknown
  className?: string
}) {
  const formatted = formatJsonValue(value)
  const lines = formatted.split('\n')

  return (
    <pre
      className={`overflow-auto bg-slate-50 text-xs leading-6 text-slate-800 dark:bg-slate-950 dark:text-slate-100 ${className}`.trim()}
    >
      <code className="block whitespace-pre">
        {lines.map((line, lineIndex) => (
          <div key={`json-line-${lineIndex}`} className="min-h-6 whitespace-pre">
            {tokenizeJsonLine(line).map((token, tokenIndex) => (
              <span
                key={`json-line-${lineIndex}-token-${tokenIndex}`}
                className={token.tone}
              >
                {token.value}
              </span>
            ))}
          </div>
        ))}
      </code>
    </pre>
  )
}
