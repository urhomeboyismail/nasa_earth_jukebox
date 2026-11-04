// Accessibility check for tests, built on axe (vitest-axe). Call it on anything you render:
//
//   const { container } = render(<MyThing />)
//   await expectNoA11yViolations(container)
//
// jsdom has no layout, so axe cannot check color contrast here; that is covered by the design tokens (T41) and the
// manual audit (T44). The "region" rule is off because a component under test is not a whole page with landmarks.

import { axe } from 'vitest-axe'

export async function expectNoA11yViolations(container: Element) {
  const { violations } = await axe(container, {
    rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
  })
  // One readable line per problem, so a failure says which rule broke and where.
  const found = violations.map(v => `${v.id}: ${v.help} [${v.nodes.map(n => n.target.join(' ')).join(', ')}]`)
  if (found.length) throw new Error(`Accessibility violations:\n${found.join('\n')}`)
}
