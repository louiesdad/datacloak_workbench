import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility Tests', () => {
  test('should not have critical accessibility violations on main pages', async ({ page }) => {
    // Test upload page
    await page.goto('http://localhost:5173/');
    await page.waitForLoadState('networkidle');
    
    const uploadResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    
    console.log('Upload page violations:', uploadResults.violations.length);
    
    // Log critical violations
    const criticalViolations = uploadResults.violations.filter(v => 
      v.impact === 'critical' || v.impact === 'serious'
    );
    
    if (criticalViolations.length > 0) {
      console.log('\nCritical accessibility issues:');
      criticalViolations.forEach(violation => {
        console.log(`- ${violation.id}: ${violation.description}`);
        console.log(`  Impact: ${violation.impact}`);
        console.log(`  Elements affected: ${violation.nodes.length}`);
      });
    }
    
    // Check for color contrast issues
    const contrastViolations = uploadResults.violations.filter(v => 
      v.id.includes('contrast')
    );
    
    if (contrastViolations.length > 0) {
      console.log('\nColor contrast issues:');
      contrastViolations.forEach(violation => {
        console.log(`- Found ${violation.nodes.length} elements with insufficient contrast`);
      });
    }
    
    // Check for missing labels
    const labelViolations = uploadResults.violations.filter(v => 
      v.id.includes('label') || v.id.includes('name')
    );
    
    if (labelViolations.length > 0) {
      console.log('\nLabel/name issues:');
      labelViolations.forEach(violation => {
        console.log(`- ${violation.id}: ${violation.nodes.length} elements`);
      });
    }
    
    await page.screenshot({ path: 'test-results/accessibility-upload.png', fullPage: true });
    
    // Expect no critical violations
    expect(criticalViolations.length).toBe(0);
  });
});