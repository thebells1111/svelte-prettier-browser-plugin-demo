"use strict";

Object.defineProperty(exports, "__esModule", { value: true });

const prettier = require("prettier");
const jsPlugin = require("prettier/parser-babel");
const htmlPlugin = require("prettier/parser-html");

// @see http://xahlee.info/js/html5_non-closing_tag.html
const selfClosingTags = [
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
];
// https://developer.mozilla.org/en-US/docs/Web/HTML/Inline_elements#Elements
const inlineElements = [
  "a",
  "abbr",
  "audio",
  "b",
  "bdi",
  "bdo",
  "br",
  "button",
  "canvas",
  "cite",
  "code",
  "data",
  "datalist",
  "del",
  "dfn",
  "em",
  "embed",
  "i",
  "iframe",
  "img",
  "input",
  "ins",
  "kbd",
  "label",
  "map",
  "mark",
  "meter",
  "noscript",
  "object",
  "output",
  "picture",
  "progress",
  "q",
  "ruby",
  "s",
  "samp",
  "select",
  "slot",
  "small",
  "span",
  "strong",
  "sub",
  "sup",
  "svg",
  "template",
  "textarea",
  "time",
  "u",
  "var",
  "video",
  "wbr",
];
/**
 * HTML attributes that we may safely reformat (trim whitespace, add or remove newlines)
 */
const formattableAttributes = ["class"];

/**
 * Determines whether or not given node
 * is the root of the Svelte AST.
 */
function isASTNode(n) {
  return n && n.__isRoot;
}
function isPreTagContent(path) {
  const stack = path.stack;
  return stack.some(
    (node) =>
      (node.type === "Element" && node.name.toLowerCase() === "pre") ||
      (node.type === "Attribute" && !formattableAttributes.includes(node.name))
  );
}
function flatten(arrays) {
  return [].concat.apply([], arrays);
}

function extractAttributes(html) {
  const extractAttributesRegex = /<[a-z]+\s*(.*?)>/i;
  const attributeRegex = /([^\s=]+)(?:=("|')(.*?)\2)?/gi;
  const [, attributesString] = html.match(extractAttributesRegex);
  const attrs = [];
  let match;
  while ((match = attributeRegex.exec(attributesString))) {
    const [all, name, quotes, value] = match;
    const attrStart = match.index;
    let valueNode;
    if (!value) {
      valueNode = true;
    } else {
      let valueStart = attrStart + name.length;
      if (quotes) {
        valueStart += 2;
      }
      valueNode = [
        {
          type: "Text",
          data: value,
          start: valueStart,
          end: valueStart + value.length,
        },
      ];
    }
    attrs.push({
      type: "Attribute",
      name,
      value: valueNode,
      start: attrStart,
      end: attrStart + all.length,
    });
  }
  return attrs;
}

function getText(node, options) {
  const leadingComments = node.leadingComments;
  return options.originalText.slice(
    options.locStart(
      // if there are comments before the node they are not included
      // in the `start` of the node itself
      (leadingComments && leadingComments[0]) || node
    ),
    options.locEnd(node)
  );
}

const options = {
  svelteSortOrder: {
    type: "choice",
    default: "scripts-styles-markup",
    description: "Sort order for scripts, styles, and markup",
    choices: [
      { value: "scripts-styles-markup" },
      { value: "scripts-markup-styles" },
      { value: "markup-styles-scripts" },
      { value: "markup-scripts-styles" },
      { value: "styles-markup-scripts" },
      { value: "styles-scripts-markup" },
    ],
  },
  svelteStrictMode: {
    type: "boolean",
    default: false,
    description:
      "More strict HTML syntax: self-closed tags, quotes in attributes",
  },
  svelteBracketNewLine: {
    type: "boolean",
    default: false,
    description: "Put the `>` of a multiline element on a new line",
  },
  svelteAllowShorthand: {
    type: "boolean",
    default: true,
    description:
      "Option to enable/disable component attribute shorthand if attribute name and expressions are same",
  },
  svelteIndentScriptAndStyle: {
    type: "boolean",
    default: true,
    description:
      "Whether or not to indent the code inside <script> and <style> tags in Svelte files",
  },
};
const sortOrderSeparator = "-";
function parseSortOrder(sortOrder) {
  return sortOrder.split(sortOrderSeparator);
}

const snippedTagContentAttribute = "✂prettier:content✂";
function snipTagContent(tagName, source, placeholder = "") {
  const regex = new RegExp(
    `[\\s\n]*<${tagName}([^]*?)>([^]*?)<\/${tagName}>[\\s\n]*`,
    "gi"
  );
  let text = source.replace(
    regex,
    (_, attributes, content) =>
      `<${tagName}${attributes} ${snippedTagContentAttribute}="${btoa(
        content
      )}">${placeholder}</${tagName}>`
  );
  return text;
}
function hasSnippedContent(text) {
  return text.includes(snippedTagContentAttribute);
}
function unsnipContent(text) {
  const regex = /(<\w+.*?)\s*✂prettier:content✂="(.*?)">.*?(?=<\/)/gi;
  return text.replace(regex, (_, start, encodedContent) => {
    return `${start}>${atob(encodedContent)}`;
  });
}

function getSnippedContent(node) {
  const encodedContent = getAttributeTextValue(
    snippedTagContentAttribute,
    node
  );
  if (encodedContent) {
    return atob(encodedContent);
  } else {
    return "";
  }
}

const unsupportedLanguages = [
  "coffee",
  "coffeescript",
  "pug",
  "styl",
  "stylus",
  "sass",
];
function isInlineElement(node) {
  return node.type === "Element" && inlineElements.includes(node.name);
}
function isWhitespaceChar(ch) {
  return " \t\n\r".indexOf(ch) >= 0;
}
function canBreakAfter(node) {
  switch (node.type) {
    case "Text":
      return isWhitespaceChar(node.raw[node.raw.length - 1]);
    case "Element":
      return !isInlineElement(node);
    default:
      return true;
  }
}
function canBreakBefore(node) {
  switch (node.type) {
    case "Text":
      return isWhitespaceChar(node.raw[0]);
    case "Element":
      return !isInlineElement(node);
    default:
      return true;
  }
}
function isInlineNode(node) {
  switch (node.type) {
    case "Text":
      const text = node.raw || node.data;
      const isAllWhitespace = text.trim() === "";
      return !isAllWhitespace || text === "";
    case "MustacheTag":
    case "EachBlock":
    case "IfBlock":
      return true;
    case "Element":
      return isInlineElement(node);
    default:
      return false;
  }
}
function isNodeWithChildren(node) {
  return node.children;
}
function getChildren(node) {
  return isNodeWithChildren(node) ? node.children : [];
}
/**
 * Returns the previous sibling node.
 */
function getPreviousNode(path) {
  const node = path.getNode();
  let parent = path.getParentNode();
  if (isASTNode(parent)) {
    parent = parent.html;
  }
  return getChildren(parent).find((child) => child.end === node.start);
}
/**
 * Returns the next sibling node.
 */
function getNextNode(path) {
  const node = path.getNode();
  let parent = path.getParentNode();
  if (isASTNode(parent)) {
    parent = parent.html;
  }
  return getChildren(parent).find((child) => child.start === node.end);
}
function isEmptyNode(node) {
  return node.type === "Text" && (node.raw || node.data).trim() === "";
}
function isIgnoreDirective(node) {
  return (
    !!node && node.type === "Comment" && node.data.trim() === "prettier-ignore"
  );
}
function printRaw(node) {
  const children = node.children;
  if (children) {
    return children.map(printRaw).join("");
  } else {
    return node.raw || "";
  }
}
function isTextNode(node) {
  return node.type === "Text";
}
function getAttributeValue(attributeName, node) {
  const attributes = node["attributes"];
  const langAttribute = attributes.find(
    (attribute) => attribute.name === attributeName
  );
  return langAttribute && langAttribute.value;
}
function getAttributeTextValue(attributeName, node) {
  const value = getAttributeValue(attributeName, node);
  if (value != null && typeof value === "object") {
    const textValue = value.find(isTextNode);
    if (textValue) {
      return textValue.data;
    }
  }
  return null;
}
function getLangAttribute(node) {
  const value = getAttributeTextValue("lang", node);
  if (value != null) {
    return value.replace(/^text\//, "");
  } else {
    return null;
  }
}
/**
 * Checks whether the node contains a `lang` attribute with a value corresponding to
 * a language we cannot format. This might for example be `<template lang="pug">`.
 * If the node does not contain a `lang` attribute, the result is true.
 */
function isNodeSupportedLanguage(node) {
  const lang = getLangAttribute(node);
  return !(lang && unsupportedLanguages.includes(lang));
}
function isLoneMustacheTag(node) {
  return node !== true && node.length === 1 && node[0].type === "MustacheTag";
}
function isAttributeShorthand(node) {
  return (
    node !== true && node.length === 1 && node[0].type === "AttributeShorthand"
  );
}
/**
 * True if node is of type `{a}` or `a={a}`
 */
function isOrCanBeConvertedToShorthand(node) {
  if (isAttributeShorthand(node.value)) {
    return true;
  }
  if (isLoneMustacheTag(node.value)) {
    const expression = node.value[0].expression;
    return expression.type === "Identifier" && expression.name === node.name;
  }
  return false;
}

function isLine(doc) {
  return typeof doc === "object" && doc.type === "line";
}
function isLineDiscardedIfLonely(doc) {
  return isLine(doc) && !doc.keepIfLonely;
}
/**
 * Check if the doc is empty, i.e. consists of nothing more than empty strings (possibly nested).
 */
function isEmptyDoc(doc) {
  if (typeof doc === "string") {
    return doc.length === 0;
  }
  if (doc.type === "line") {
    return !doc.keepIfLonely;
  }
  const { contents } = doc;
  if (contents) {
    return isEmptyDoc(contents);
  }
  const { parts } = doc;
  if (parts) {
    return isEmptyGroup(parts);
  }
  return false;
}
function isEmptyGroup(group) {
  return !group.find((doc) => !isEmptyDoc(doc));
}
/**
 * Trims both leading and trailing nodes matching `isWhitespace` independent of nesting level
 * (though all trimmed adjacent nodes need to be a the same level). Modifies the `docs` array.
 */
function trim(docs, isWhitespace) {
  trimLeft(docs, isWhitespace);
  trimRight(docs, isWhitespace);
  return docs;
}
/**
 * Trims the leading nodes matching `isWhitespace` independent of nesting level (though all nodes need to be a the same level)
 * and returnes the removed nodes.
 */
function trimLeft(group, isWhitespace) {
  let firstNonWhitespace = group.findIndex((doc) => !isWhitespace(doc));
  if (firstNonWhitespace < 0 && group.length) {
    firstNonWhitespace = group.length;
  }
  if (firstNonWhitespace > 0) {
    return group.splice(0, firstNonWhitespace);
  } else {
    const parts = getParts(group[0]);
    if (parts) {
      return trimLeft(parts, isWhitespace);
    }
  }
}
/**
 * Trims the trailing nodes matching `isWhitespace` independent of nesting level (though all nodes need to be a the same level)
 * and returnes the removed nodes.
 */
function trimRight(group, isWhitespace) {
  let lastNonWhitespace = group.length
    ? findLastIndex((doc) => !isWhitespace(doc), group)
    : 0;
  if (lastNonWhitespace < group.length - 1) {
    return group.splice(lastNonWhitespace + 1);
  } else {
    const parts = getParts(group[group.length - 1]);
    if (parts) {
      return trimRight(parts, isWhitespace);
    }
  }
}
function getParts(doc) {
  if (
    typeof doc === "object" &&
    (doc.type === "fill" || doc.type === "concat")
  ) {
    return doc.parts;
  }
}
function findLastIndex(isMatch, items) {
  for (let i = items.length - 1; i >= 0; i--) {
    if (isMatch(items[i])) {
      return i;
    }
  }
  return -1;
}

const {
  concat,
  join,
  line,
  group,
  indent,
  dedent,
  softline,
  hardline,
  fill,
  breakParent,
  literalline,
} = prettier.doc.builders;
let ignoreNext = false;
const keepIfLonelyLine = Object.assign({}, line, {
  keepIfLonely: true,
  hard: true,
});
function print(path, options$$1, print) {
  const n = path.getValue();
  if (!n) {
    return "";
  }
  if (isASTNode(n)) {
    //console.log(JSON.stringify(n))
    const parts = [];
    const addParts = {
      scripts() {
        if (n.module) {
          n.module.type = "Script";
          n.module.attributes = extractAttributes(
            getText(n.module, options$$1)
          );
          parts.push(path.call(print, "module"));
        }
        if (n.instance) {
          n.instance.type = "Script";
          n.instance.attributes = extractAttributes(
            getText(n.instance, options$$1)
          );
          parts.push(path.call(print, "instance"));
        }
      },
      styles() {
        if (n.css) {
          n.css.type = "Style";
          n.css.content.type = "StyleProgram";
          parts.push(path.call(print, "css"));
        }
      },
      markup() {
        const htmlDoc = path.call(print, "html");
        if (htmlDoc) {
          parts.push(htmlDoc);
        }
      },
    };
    parseSortOrder(options$$1.svelteSortOrder).forEach((p) => addParts[p]());
    ignoreNext = false;
    return group(join(hardline, parts));
  }
  const [open, close] = options$$1.svelteStrictMode ? ['"{', '}"'] : ["{", "}"];
  const node = n;
  if (ignoreNext && (node.type !== "Text" || !isEmptyNode(node))) {
    ignoreNext = false;
    return concat(
      flatten(
        options$$1.originalText
          .slice(options$$1.locStart(node), options$$1.locEnd(node))
          .split("\n")
          .map((o, i) => (i == 0 ? [o] : [literalline, o]))
      )
    );
  }
  switch (node.type) {
    case "Fragment":
      const children = node.children;
      if (children.length === 0 || children.every(isEmptyNode)) {
        return "";
      }
      if (!isPreTagContent(path)) {
        return concat([...trim(printChildren(path, print), isLine), hardline]);
      } else {
        return concat(printChildren(path, print));
      }
    case "Text":
      if (!isPreTagContent(path)) {
        if (isEmptyNode(node)) {
          return Object.assign({}, line, {
            /**
             * A text node is considered lonely if it is in a group without other inline
             * elements, such as the line breaks between otherwise consecutive HTML tags.
             * Text nodes that are both empty and lonely are discarded unless they have at
             * least one empty line (i.e. at least two linebreak sequences). This is to
             * allow for flexible grouping of HTML tags in a particular indentation level,
             * and is similar to how vanilla HTML is handled in Prettier core.
             */
            keepIfLonely: /\n\r?\s*\n\r?/.test(node.raw || node.data),
          });
        }
        /**
         * For non-empty text nodes each sequence of non-whitespace characters (effectively,
         * each "word") is joined by a single `line`, which will be rendered as a single space
         * until this node's current line is out of room, at which `fill` will break at the
         * most convenient instance of `line`.
         */
        return fill(splitTextToDocs(node.raw || node.data));
      } else {
        return node.data;
      }
    case "Element":
    case "InlineComponent":
    case "Slot":
    case "Window":
    case "Head":
    case "Title": {
      const isSupportedLanguage = !(
        node.name === "template" && !isNodeSupportedLanguage(node)
      );
      const isEmpty = node.children.every((child) => isEmptyNode(child));
      const isSelfClosingTag =
        isEmpty &&
        (!options$$1.svelteStrictMode ||
          node.type !== "Element" ||
          selfClosingTags.indexOf(node.name) !== -1);
      let body;
      if (isEmpty) {
        body = "";
      } else if (!isSupportedLanguage) {
        body = printRaw(node);
      } else if (isInlineElement(node) || isPreTagContent(path)) {
        body = printIndentedPreservingWhitespace(path, print);
      } else {
        body = printIndentedWithNewlines(path, print);
      }
      return group(
        concat([
          "<",
          node.name,
          indent(
            group(
              concat([
                node.type === "InlineComponent" && node.expression
                  ? concat([
                      line,
                      "this=",
                      open,
                      printJS(path, print, "expression"),
                      close,
                    ])
                  : "",
                ...path.map((childPath) => childPath.call(print), "attributes"),
                options$$1.svelteBracketNewLine
                  ? dedent(isSelfClosingTag ? line : softline)
                  : "",
              ])
            )
          ),
          ...(isSelfClosingTag
            ? [options$$1.svelteBracketNewLine ? "" : " ", `/>`]
            : [">", body, `</${node.name}>`]),
        ])
      );
    }
    case "Options":
    case "Body":
      return group(
        concat([
          "<",
          node.name,
          indent(
            group(
              concat(
                path.map((childPath) => childPath.call(print), "attributes")
              )
            )
          ),
          " />",
        ])
      );
    case "Identifier":
      return node.name;
    case "AttributeShorthand": {
      return node.expression.name;
    }
    case "Attribute": {
      if (isOrCanBeConvertedToShorthand(node)) {
        if (options$$1.svelteStrictMode) {
          return concat([line, node.name, '="{', node.name, '}"']);
        } else if (options$$1.svelteAllowShorthand) {
          return concat([line, "{", node.name, "}"]);
        } else {
          return concat([line, node.name, "={", node.name, "}"]);
        }
      } else {
        if (node.value === true) {
          return concat([line, node.name]);
        }
        const quotes =
          !isLoneMustacheTag(node.value) || options$$1.svelteStrictMode;
        const attrNodeValue = printAttributeNodeValue(
          path,
          print,
          quotes,
          node
        );
        if (quotes) {
          return concat([line, node.name, "=", '"', attrNodeValue, '"']);
        } else {
          return concat([line, node.name, "=", attrNodeValue]);
        }
      }
    }
    case "MustacheTag":
      console.log(node);
      return concat(["{", printJS(path, print, "expression"), "}"]);
    case "IfBlock": {
      const def = [
        "{#if ",
        printJS(path, print, "expression"),
        "}",
        printIndentedWithNewlines(path, print),
      ];
      if (node.else) {
        def.push(path.call(print, "else"));
      }
      def.push("{/if}");
      return concat([group(concat(def)), breakParent]);
    }
    case "ElseBlock": {
      // Else if
      const parent = path.getParentNode();
      if (
        node.children.length === 1 &&
        node.children[0].type === "IfBlock" &&
        parent.type !== "EachBlock"
      ) {
        const ifNode = node.children[0];
        const def = [
          "{:else if ",
          path.map(
            (ifPath) => printJS(path, print, "expression"),
            "children"
          )[0],
          "}",
          path.map(
            (ifPath) => printIndentedWithNewlines(ifPath, print),
            "children"
          )[0],
        ];
        if (ifNode.else) {
          def.push(
            path.map((ifPath) => ifPath.call(print, "else"), "children")[0]
          );
        }
        return group(concat(def));
      }
      return group(concat(["{:else}", printIndentedWithNewlines(path, print)]));
    }
    case "EachBlock": {
      const def = [
        "{#each ",
        printJS(path, print, "expression"),
        " as ",
        printJS(path, print, "context"),
      ];
      if (node.index) {
        def.push(", ", node.index);
      }
      if (node.key) {
        def.push(" (", printJS(path, print, "key"), ")");
      }
      def.push("}", printIndentedWithNewlines(path, print));
      if (node.else) {
        def.push(path.call(print, "else"));
      }
      def.push("{/each}");
      return concat([group(concat(def)), breakParent]);
    }
    case "AwaitBlock": {
      const hasPendingBlock = node.pending.children.some(
        (n) => !isEmptyNode(n)
      );
      const hasThenBlock = node.then.children.some((n) => !isEmptyNode(n));
      const hasCatchBlock = node.catch.children.some((n) => !isEmptyNode(n));
      let block = [];
      if (!hasPendingBlock && hasThenBlock) {
        block.push(
          group(
            concat([
              "{#await ",
              printJS(path, print, "expression"),
              " then",
              expandNode(node.value),
              "}",
            ])
          ),
          indent(path.call(print, "then"))
        );
      } else {
        block.push(
          group(concat(["{#await ", printJS(path, print, "expression"), "}"]))
        );
        if (hasPendingBlock) {
          block.push(indent(path.call(print, "pending")));
        }
        if (hasThenBlock) {
          block.push(
            group(concat(["{:then", expandNode(node.value), "}"])),
            indent(path.call(print, "then"))
          );
        }
      }
      if (hasCatchBlock) {
        block.push(
          group(concat(["{:catch", expandNode(node.error), "}"])),
          indent(path.call(print, "catch"))
        );
      }
      block.push("{/await}");
      return group(concat(block));
    }
    case "ThenBlock":
    case "PendingBlock":
    case "CatchBlock":
      return concat([
        softline,
        ...trim(printChildren(path, print), isLine),
        dedent(softline),
      ]);
    case "EventHandler":
      return concat([
        line,
        "on:",
        node.name,
        node.modifiers && node.modifiers.length
          ? concat(["|", join("|", node.modifiers)])
          : "",
        node.expression
          ? concat(["=", open, printJS(path, print, "expression"), close])
          : "",
      ]);
    case "Binding":
      return concat([
        line,
        "bind:",
        node.name,
        node.expression.type === "Identifier" &&
        node.expression.name === node.name
          ? ""
          : concat(["=", open, printJS(path, print, "expression"), close]),
      ]);
    case "Class":
      return concat([
        line,
        "class:",
        node.name,
        node.expression.type === "Identifier" &&
        node.expression.name === node.name
          ? ""
          : concat(["=", open, printJS(path, print, "expression"), close]),
      ]);
    case "Let":
      return concat([
        line,
        "let:",
        node.name,
        // shorthand let directives have `null` expressions
        !node.expression ||
        (node.expression.type === "Identifier" &&
          node.expression.name === node.name)
          ? ""
          : concat(["=", open, printJS(path, print, "expression"), close]),
      ]);
    case "DebugTag":
      return concat([
        "{@debug",
        node.identifiers.length > 0
          ? concat([" ", join(", ", path.map(print, "identifiers"))])
          : "",
        "}",
      ]);
    case "Ref":
      return concat([line, "ref:", node.name]);
    case "Comment": {
      if (isIgnoreDirective(node)) {
        /**
         * If there no sibling node that starts right after us, that means that node
         * was actually an embedded `<style>` or `<script>` node that was cut out.
         * If so, the ignore directive does not refer to the next line we will see.
         * The `embed` function handles printing the ignore directive in the right place.
         */
        if (!getNextNode(path)) {
          return "";
        } else {
          ignoreNext = true;
        }
      }
      let text = node.data;
      if (hasSnippedContent(text)) {
        text = unsnipContent(text);
      }
      return group(concat(["<!--", text, "-->"]));
    }
    case "Transition":
      const kind =
        node.intro && node.outro ? "transition" : node.intro ? "in" : "out";
      return concat([
        line,
        kind,
        ":",
        node.name,
        node.modifiers && node.modifiers.length
          ? concat(["|", join("|", node.modifiers)])
          : "",
        node.expression
          ? concat(["=", open, printJS(path, print, "expression"), close])
          : "",
      ]);
    case "Action":
      return concat([
        line,
        "use:",
        node.name,
        node.expression
          ? concat(["=", open, printJS(path, print, "expression"), close])
          : "",
      ]);
    case "Animation":
      return concat([
        line,
        "animate:",
        node.name,
        node.expression
          ? concat(["=", open, printJS(path, print, "expression"), close])
          : "",
      ]);
    case "RawMustacheTag":
      return concat(["{@html ", printJS(path, print, "expression"), "}"]);
    case "Spread":
      return concat([line, "{...", printJS(path, print, "expression"), "}"]);
    case "Script":
      let jsCode = prettier.format(getSnippedContent(node), {
        parser: "babel",
        plugins: [jsPlugin],
      });
      let htmlCode = prettier.format(`<script>${jsCode}</script>`, {
        parser: "html",
        plugins: [htmlPlugin],
      });
      return htmlCode;
    case "BinaryExpression":
      console.log(node);
      return concat([
        path.call(print, "left"),
        " ",
        node.operator,
        path.call(print, "right"),
      ]);
    case "Literal":
      return " " + node.raw;
    case "ConditionalExpression":
      console.log(node);
      return concat([
        path.call(print, "test"),
        " ? ",
        path.call(print, "consequent"),
        " : ",
        path.call(print, "alternate"),
      ]);
  }
  console.error(JSON.stringify(node, null, 4));
  throw new Error("unknown node type: " + node.type);
}
function printAttributeNodeValue(path, print, quotes, node) {
  const valueDocs = path.map((childPath) => childPath.call(print), "value");
  if (!quotes || !formattableAttributes.includes(node.name)) {
    return concat(valueDocs);
  } else {
    return indent(group(concat(trim(valueDocs, isLine))));
  }
}
function printChildren(path, print) {
  let childDocs = [];
  let currentGroup = [];
  // the index of the last child doc we could add a linebreak after
  let lastBreakIndex = -1;
  const isPreformat = isPreTagContent(path);
  /**
   * Call when reaching a point where a linebreak is possible. Will
   * put all `childDocs` since the last possible linebreak position
   * into a `concat` to avoid them breaking.
   */
  function linebreakPossible() {
    if (lastBreakIndex >= 0 && lastBreakIndex < childDocs.length - 1) {
      childDocs = childDocs
        .slice(0, lastBreakIndex)
        .concat(concat(childDocs.slice(lastBreakIndex)));
    }
    lastBreakIndex = -1;
  }
  /**
   * Add a document to the output.
   * @param childDoc null means do not add anything but allow for the possibility of a linebreak here.
   */
  function outputChildDoc(childDoc, fromNodes) {
    if (!isPreformat) {
      const firstNode = fromNodes[0];
      const lastNode = fromNodes[fromNodes.length - 1];
      if (!childDoc || canBreakBefore(firstNode)) {
        linebreakPossible();
        const lastChild = childDocs[childDocs.length - 1];
        // separate children by softlines, but not if the children are already lines.
        // one exception: allow for a line break before "keepIfLonely" lines because they represent an empty line
        if (
          childDoc != null &&
          !isLineDiscardedIfLonely(childDoc) &&
          lastChild != null &&
          !isLine(lastChild)
        ) {
          childDocs.push(softline);
        }
      }
      if (lastBreakIndex < 0 && childDoc && !canBreakAfter(lastNode)) {
        lastBreakIndex = childDocs.length;
      }
    }
    if (childDoc) {
      childDocs.push(childDoc);
    }
  }
  function lastChildDocProduced() {
    // line breaks are ok after last child
    outputChildDoc(null, []);
  }
  /**
   * Sequences of inline nodes (currently, `TextNode`s and `MustacheTag`s) are collected into
   * groups and printed as a single `Fill` doc so that linebreaks as a result of sibling block
   * nodes (currently, all HTML elements) don't cause those inline sequences to break
   * prematurely. This is particularly important for whitespace sensitivity, as it is often
   * desired to have text directly wrapping a mustache tag without additional whitespace.
   */
  function flush() {
    let groupDocs = currentGroup.map((item) => item.doc);
    const groupNodes = currentGroup.map((item) => item.node);
    for (let doc of extractOutermostNewlines(groupDocs)) {
      outputChildDoc(doc, groupNodes);
    }
    currentGroup = [];
  }
  path.each((childPath) => {
    const childNode = childPath.getValue();
    const childDoc = childPath.call(print);
    if (isInlineNode(childNode)) {
      currentGroup.push({ doc: childDoc, node: childNode });
    } else {
      flush();
      outputChildDoc(
        isLine(childDoc) ? childDoc : concat([breakParent, childDoc]),
        [childNode]
      );
    }
  }, "children");
  flush();
  lastChildDocProduced();
  return childDocs;
}
/**
 * Print the nodes in `path` indented and with leading and trailing newlines.
 */
function printIndentedWithNewlines(path, print) {
  return indent(
    concat([
      softline,
      ...trim(printChildren(path, print), isLine),
      dedent(softline),
    ])
  );
}
/**
 * Print the nodes in `path` indented but without adding any leading or trailing newlines.
 */
function printIndentedPreservingWhitespace(path, print) {
  return indent(concat(dedentFinalNewline(printChildren(path, print))));
}
/**
 * Split the text into words separated by whitespace. Replace the whitespaces by lines,
 * collapsing multiple whitespaces into a single line.
 *
 * If the text starts or ends with multiple newlines, those newlines should be "keepIfLonely"
 * since we want double newlines in the output.
 */
function splitTextToDocs(text) {
  let docs = text.split(/[\t\n\f\r ]+/);
  docs = join(line, docs).parts.filter((s) => s !== "");
  // if the text starts with two newlines, the first doc is already a newline. make it "keepIfLonely"
  if (text.match(/^([\t\f\r ]*\n){2}/)) {
    docs[0] = keepIfLonelyLine;
  }
  // if the text ends with two newlines, the last doc is already a newline. make it "keepIfLonely"
  if (text.match(/(\n[\t\f\r ]*){2}$/)) {
    docs[docs.length - 1] = keepIfLonelyLine;
  }
  return docs;
}
/**
 * If there is a trailing newline, pull it out and put it inside a `dedent`. This is used
 * when we want to preserve whitespace, but still indent the newline if there is one
 * (e.g. for `<b>1\n</b>` the `</b>` will be on its own line; for `<b>1</b>` it can't
 * because it would introduce new whitespace)
 */
function dedentFinalNewline(docs) {
  const trimmedRight = trimRight(docs, isLine);
  if (trimmedRight) {
    return [...docs, dedent(trimmedRight[trimmedRight.length - 1])];
  } else {
    return docs;
  }
}
/**
 * Pull out any nested leading or trailing lines and put them at the top level.
 */
function extractOutermostNewlines(docs) {
  const leadingLines = trimLeft(docs, isLine) || [];
  const trailingLines = trimRight(docs, isLine) || [];
  return [
    ...leadingLines,
    ...(!isEmptyGroup(docs) ? [fill(docs)] : []),
    ...trailingLines,
  ];
}
function printJS(path, print, name) {
  if (!name) {
    path.getValue().isJS = true;
    return path.call(print);
  }
  path.getValue()[name].isJS = true;
  return path.call(print, name);
}
function expandNode(node) {
  if (node === null) {
    return "";
  }
  if (typeof node === "string") {
    // pre-v3.20 AST
    return " " + node;
  }
  switch (node.type) {
    case "ArrayPattern":
      return " [" + node.elements.map(expandNode).join(",").slice(1) + "]";
    case "AssignmentPattern":
      return expandNode(node.left) + " =" + expandNode(node.right);
    case "Identifier":
      return " " + node.name;
    case "Literal":
      return " " + node.raw;
    case "ObjectPattern":
      return " {" + node.properties.map(expandNode).join(",") + " }";
    case "Property":
      if (node.value.type === "ObjectPattern") {
        return " " + node.key.name + ":" + expandNode(node.value);
      } else if (
        node.value.type === "Identifier" &&
        node.key.name !== node.value.name
      ) {
        return expandNode(node.key) + ":" + expandNode(node.value);
      } else {
        return expandNode(node.value);
      }
    case "RestElement":
      return " ..." + node.argument.name;
  }
  console.error(JSON.stringify(node, null, 4));
  throw new Error("unknown node type: " + node.type);
}

function locStart(node) {
  return node.start;
}
function locEnd(node) {
  return node.end;
}
const languages = [
  {
    name: "svelte",
    parsers: ["svelte"],
    extensions: [".svelte"],
  },
];
const parsers = {
  svelte: {
    parse: (text) => {
      try {
        return Object.assign({}, require(`svelte/compiler`).parse(text), {
          __isRoot: true,
        });
      } catch (err) {
        if (err.start != null && err.end != null) {
          // Prettier expects error objects to have loc.start and loc.end fields.
          // Svelte uses start and end directly on the error.
          err.loc = {
            start: err.start,
            end: err.end,
          };
        }
        throw err;
      }
    },
    preprocess: (text) => {
      text = snipTagContent("style", text);
      text = snipTagContent("script", text, "{}");
      return text.trim();
    },
    locStart,
    locEnd,
    astFormat: "svelte-ast",
  },
};
const printers = {
  "svelte-ast": {
    print,
  },
};

exports.languages = languages;
exports.parsers = parsers;
exports.printers = printers;
exports.options = options;
//# sourceMappingURL=plugin.js.map
