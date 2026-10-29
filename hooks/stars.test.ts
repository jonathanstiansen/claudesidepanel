import { expect, test } from 'claude-code/testing'

import { STARFIELD } from './layers/starfield'

// the desktop frame is pane-wide but 1400px tall; the default "meet" shrinks the svg and centres it, leaving the top starless
test('pins the starfield to the top-left at full size', () => {
  expect(STARFIELD).toContain('preserveAspectRatio="xMinYMin slice"')
})
