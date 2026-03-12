const { Doc, Text } = require('yjs');
const diff = require('fast-diff');

function applyUpdateToYText(yText, newString) {
    const currentString = yText.toString();
    if (currentString === newString) return;

    const changes = diff(currentString, newString);
    let cursor = 0;

    changes.forEach(([operation, text]) => {
        if (operation === diff.EQUAL) {
            cursor += text.length; // Retain
        } else if (operation === diff.DELETE) {
            yText.delete(cursor, text.length);
        } else if (operation === diff.INSERT) {
            yText.insert(cursor, text);
            cursor += text.length;
        }
    });
}

const doc = new Doc();
const t = doc.getText('task');
applyUpdateToYText(t, "hello");
console.log("After insert:", t.toString());
applyUpdateToYText(t, "hero");
console.log("After modify:", t.toString());
