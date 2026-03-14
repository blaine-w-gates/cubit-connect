import { toast } from 'sonner';

/**
 * Safely copies text to clipboard with fallback for iOS Safari and other
 * environments where navigator.clipboard may be unavailable or blocked.
 *
 * Returns true if the copy succeeded, false otherwise.
 */
export async function copyToClipboardSafe(text: string): Promise<boolean> {
  // Primary path: Async Clipboard API
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to legacy fallback
    }
  }

  // Fallback: execCommand('copy') via a temporary textarea.
  // Required for older iOS Safari and contexts where Clipboard API
  // is not available (non-HTTPS, user gesture not in scope, etc.).
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;

    // Prevent iOS Safari from zooming/scrolling to the element
    textarea.setAttribute('readonly', '');
    Object.assign(textarea.style, {
      position: 'fixed',
      left: '-9999px',
      top: '-9999px',
      opacity: '0',
    });

    document.body.appendChild(textarea);

    // iOS Safari requires explicit selection range
    const range = document.createRange();
    range.selectNodeContents(textarea);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    textarea.setSelectionRange(0, text.length);

    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  } catch {
    toast.error('Copy Failed', {
      description: 'Could not access clipboard. Try selecting and copying the text manually.',
    });
    return false;
  }
}
