// Puts text on the clipboard. Returns whether it worked.
export async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // The clipboard API needs https. This older way works without it.
    const focused = document.activeElement;
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.append(area);
    area.select();
    const done = document.execCommand('copy');
    area.remove();
    if (focused instanceof HTMLElement) focused.focus();
    return done;
  }
}
