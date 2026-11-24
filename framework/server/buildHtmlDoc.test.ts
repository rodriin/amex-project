import { describe, expect, it } from 'vitest';
import buildHtmlDoc from './buildHtmlDoc';

describe('buildHtmlDoc', () => {
  it('wraps the rendered HTML in the #app container', () => {
    const html = buildHtmlDoc(['<p>hello</p>']);
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<div id="app"><p>hello</p></div>');
  });

  it('includes the client script by default', () => {
    expect(buildHtmlDoc(['x'])).toContain('<script src="/client.js"></script>');
  });

  it('omits the client script when withScript is false', () => {
    expect(buildHtmlDoc(['x'], false)).not.toContain('/client.js');
  });

  it('injects initial data when provided', () => {
    expect(buildHtmlDoc(['x', 'serialized'])).toContain(
      "<script>window.__INITIAL_DATA__ = 'serialized'</script>",
    );
  });

  it('does not inject initial data when absent', () => {
    expect(buildHtmlDoc(['x'])).not.toContain('__INITIAL_DATA__');
  });
});
