import { test, expect } from '@playwright/test';

test('Verify channel and performance fixes', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForTimeout(2000);

    const results = await page.evaluate(() => {
        const checks = {};
        checks.simulationStateGlobal = typeof window.simulationState === 'object';
        checks.debounceRenderGlobal = typeof window.debounceRender === 'function';

        // Check if renderAll was replaced by debounceRender in common places
        // We can't easily check the source code from here, but we can check behavior.

        // Check log formatting if we can find any log entry
        const logs = document.querySelectorAll('.whitespace-pre-wrap');
        checks.hasLogs = logs.length > 0;
        if (checks.hasLogs) {
            checks.logHasNewline = logs[0].innerText.includes('\n');
        }

        return checks;
    });

    console.log('Verification Results:', JSON.stringify(results, null, 2));
    expect(results.simulationStateGlobal).toBe(true);
    expect(results.debounceRenderGlobal).toBe(true);
});
