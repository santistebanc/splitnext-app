/**
 * Driving a recorded browser the way a person drives a phone.
 *
 * Playwright's own actions are built for speed: `click()` teleports the mouse
 * and fires in one frame, `fill()` replaces a field's text wholesale. Both are
 * invisible on video — the recording shows state changing with nothing
 * touching it. These helpers trade a few seconds for legibility: travel to a
 * target, hold the press, type key by key.
 *
 * Pair with `installPointerOverlay`, which draws the pointer these helpers move.
 */

/** Phone-shaped: the app renders its mobile layout on web. */
export const VIEWPORT = { width: 420, height: 900 };

export function makeDriver(page) {
  /** Give the eye time to land on what just changed before moving on. */
  const beat = (ms = 900) => page.waitForTimeout(ms);

  const press = async (locator) => {
    await locator.scrollIntoViewIfNeeded();
    await beat(200);
    // After scrolling, not before: the box is only true once it has settled.
    const box = await locator.boundingBox();
    if (!box) throw new Error('nothing to press — target has no box');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, {
      steps: 26,
    });
    await beat(260);
    await page.mouse.down();
    await beat(140);
    await page.mouse.up();
    await beat();
  };

  const tap = (label) => press(page.getByText(label, { exact: true }).first());

  const type = async (placeholder, text) => {
    const field = page.getByPlaceholder(placeholder);
    await press(field);
    // Key by key, so the clip shows text being entered rather than appearing.
    await field.pressSequentially(text, { delay: 45 });
    await beat(400);
  };

  /** Park the pointer on screen so its first move is a travel, not an entrance. */
  const enter = () =>
    page.mouse.move(VIEWPORT.width / 2, VIEWPORT.height - 120);

  return { beat, press, tap, type, enter };
}

/** The balances block as text — the thing a reload must not change. */
export const balancesOf = (body) =>
  body.split('BALANCES')[1]?.split('EXPENSES')[0]?.trim() ?? '';
