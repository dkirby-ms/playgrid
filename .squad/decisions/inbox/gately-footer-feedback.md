# Version Footer: Center + Feedback Link

**Date:** 2026-03-15  
**Author:** Gately  
**Issue:** #97  
**PR:** #118  

## Decision

Moved version footer from bottom-right to bottom-center and added "Submit Feedback" link to GitHub issues.

## Implementation Details

- **Layout:** Flexbox with centered positioning using `left:50%; transform:translateX(-50%)`
- **Structure:** Version text + separator bullet + feedback link
- **Link behavior:** Opens in new tab (`target="_blank"`) with security (`rel="noopener noreferrer"`)
- **Styling:** Subtle hover effect (opacity transition from 0.4 to 0.7) for feedback link
- **Pointer events:** Version text and separator are non-interactive; only link is clickable

## Why This Approach

1. **Center positioning** — Uses transform instead of margin for precise centering across all viewport widths
2. **Flexbox** — Easier to maintain gap spacing and alignment vs. manual positioning
3. **Inline hover handlers** — Kept it simple since this is a one-off UI element, no need for CSS classes
4. **Security attributes** — `rel="noopener noreferrer"` prevents tab-nabbing attacks on external links

## Future Considerations

If we add more footer links, consider extracting styles into a shared footer component.
