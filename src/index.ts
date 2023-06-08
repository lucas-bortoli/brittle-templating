// The Brittle Templating Library

interface TextToken {
  type: "text";
  content: string;
}

interface CodeToken {
  type: "script";
  writesOutput: boolean;
  expression: string;
}

type Token = TextToken | CodeToken;

/**
 * Converts the source document into a list of tokens.
 * A token is either text-only or a script fragment.
 * Script fragments can return a value or not.
 * @param source Source document
 * @returns A list of tokens
 */
const tokenize = (source: string) => {
  /**
   * Match the following expressions:
   *
   * [`js code`]
   * [=`js code inline`]
   */
  const EXPR_MATCH = /(?<!\\)\[(?<mode>=)?`(?<expression>.*?)`\]/gms;

  const matches = source.matchAll(EXPR_MATCH);

  let text_node_start = 0;

  const nodes: Token[] = [];

  const push_text_node = (start: number, end: number) => {
    const content = source.substring(start, end);

    // Collapse linebreaks
    // This behavior may be undesired. Maybe add a switch parameter?
    if (content.trim().length < 1) return;

    nodes.push({
      type: "text",
      content: content,
    });
  };

  for (const match of matches) {
    const expressionLength = match[0].length;
    const text_node_end = match.index!;

    push_text_node(text_node_start, text_node_end);

    if (match.groups!.mode === "=") {
      nodes.push({
        type: "script",
        writesOutput: true,
        expression: match.groups!.expression,
      });
    } else {
      nodes.push({
        type: "script",
        writesOutput: false,
        expression: match.groups!.expression,
      });
    }

    text_node_start = text_node_end + expressionLength;
  }

  // Push remaining text node (text until EOF)
  push_text_node(text_node_start, source.length);

  return nodes;
};

/**
 * Compiles the given token list into a stringified function.
 */
const compile = (nodes: Token[]): string => {
  const functionBody = [
    "(async function(context) {",

    // This variable holds the resulting document after evaluation.
    "  let documentText = '';",
    "  ",
    "  try {",
  ];

  for (const node of nodes) {
    if (node.type === "text") {
      // Escape backticks in the generated string
      const escapedBackticks = node.content.replace(/`/g, "\\`");

      functionBody.push("    documentText += `" + escapedBackticks + "`;");
    } else if (node.type === "script") {
      if (node.writesOutput) {
        functionBody.push(
          "    documentText += '' + await ((function(){ return " + node.expression + "; })() ?? '');"
        );
      } else {
        functionBody.push("    " + node.expression);
      }
    }
  }

  // Error handling could be improved...
  functionBody.push(
    "  } catch (embeddedError) {",
    "    console.error(embeddedError);",
    "    throw embeddedError;",
    "  }",
    "  ",
    "  return documentText;",
    "});"
  );

  return functionBody.join("\n");
};

/**
 * Runs the compiled function text. Uses eval. Unsafe. No attempt of filtering
 * the given code is made. Only run templates you trust.
 *
 * Throws if the given template has a JS syntax error.
 */
const run = async (function_text: string, context: object): Promise<string> => {
  let results = await eval(function_text)(context);

  return results;
};

/**
 * A shorthand function that tokenizes the given template, compiles and runs it.
 *
 * When running the template, eval is used. No attempt of sanitizing the input
 * is made. Do not use it with untrusted documents.
 *
 * Throws if the given template has a JS syntax error.
 *
 * @param source The document text.
 * @param context An object that is available to the document as the global
 * `context` variable.
 */
const runTemplate = async (source: string, context: object = {}): Promise<string> => {
  return await run(compile(tokenize(source)), context);
};

export { tokenize, compile, run, runTemplate };
export default runTemplate;
