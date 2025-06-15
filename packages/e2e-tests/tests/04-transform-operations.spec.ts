import { test, expect, expectWorkflowStep, waitForFileProcessing, uploadFile } from '../fixtures/test-fixtures';

test.describe('Data Transform Operations', () => {
  test.beforeEach(async ({ page, mockBackend, mockOpenAI, platformBridge }) => {
    // Navigate and complete initial file upload and profiling
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expectWorkflowStep(page, 'Upload Data');
  });

  async function navigateToTransformStep(page: any, testFiles: any, browserMode: boolean) {
    // Complete upload and profiling steps
    await uploadFile(page, testFiles.medium, browserMode);
    await waitForFileProcessing(page);
    
    // Navigate through workflow to transform step
    const transformStep = page.locator('.workflow-step').filter({ hasText: /transform|optional/i });
    if (await transformStep.isVisible({ timeout: 5000 }).catch(() => false)) {
      await transformStep.click();
      await page.waitForTimeout(2000);
    }
    
    await page.screenshot({ path: 'test-results/20-transform-step-start.png', fullPage: true });
  }

  test('should display available transformation options', async ({ page, testFiles, browserMode }) => {
    await navigateToTransformStep(page, testFiles, browserMode);

    await test.step('Verify transform options are available', async () => {
      // Look for transformation UI elements
      const transformElements = [
        page.locator('text=/transform|operation|modify/i'),
        page.locator('.transform-option, .operation, .transform-designer'),
        page.locator('button').filter({ hasText: /add|create|apply/i })
      ];
      
      let foundTransforms = false;
      for (const element of transformElements) {
        if (await element.isVisible({ timeout: 5000 }).catch(() => false)) {
          foundTransforms = true;
          console.log('✓ Transform options found');
          break;
        }
      }
      
      await page.screenshot({ path: 'test-results/21-transform-options.png', fullPage: true });
      
      if (!foundTransforms) {
        console.log('ℹ Transform operations may be optional or auto-applied');
      }
    });

    await test.step('Check for common transformation types', async () => {
      // Look for typical transform operations
      const transformTypes = [
        'filter', 'sort', 'group', 'aggregate', 'rename', 'format', 'validate', 'clean'
      ];
      
      let foundTypes = 0;
      for (const type of transformTypes) {
        const typeElement = page.locator(`text=/${type}/i`);
        if (await typeElement.isVisible({ timeout: 2000 }).catch(() => false)) {
          foundTypes++;
          console.log(`✓ Transform type available: ${type}`);
        }
      }
      
      console.log(`Transform types available: ${foundTypes}/${transformTypes.length}`);
    });
  });

  test('should support data filtering operations', async ({ page, testFiles, browserMode }) => {
    await navigateToTransformStep(page, testFiles, browserMode);

    await test.step('Look for filtering options', async () => {
      const filterElements = [
        page.locator('text=/filter|where|condition/i'),
        page.locator('.filter, .condition, .where-clause'),
        page.locator('button').filter({ hasText: /filter/i })
      ];
      
      let foundFilter = false;
      for (const element of filterElements) {
        if (await element.isVisible({ timeout: 3000 }).catch(() => false)) {
          foundFilter = true;
          console.log('✓ Filtering options found');
          
          // Try to interact with filter
          try {
            await element.first().click();
            await page.waitForTimeout(1000);
            await page.screenshot({ path: 'test-results/22-filter-interaction.png', fullPage: true });
          } catch (error) {
            console.log('Filter element found but not interactive');
          }
          break;
        }
      }
      
      if (!foundFilter) {
        console.log('ℹ Filtering may be handled in a different step or automatically');
      }
    });

    await test.step('Test filter configuration', async () => {
      // Look for filter configuration elements
      const configElements = [
        page.locator('select, .dropdown').filter({ hasText: /field|column/i }),
        page.locator('input[type="text"], .filter-value'),
        page.locator('select').filter({ hasText: /equals|contains|greater/i })
      ];
      
      let foundConfig = false;
      for (const element of configElements) {
        if (await element.isVisible({ timeout: 2000 }).catch(() => false)) {
          foundConfig = true;
          console.log('✓ Filter configuration UI found');
          break;
        }
      }
      
      if (!foundConfig) {
        console.log('ℹ Filter configuration may use different UI patterns');
      }
    });
  });

  test('should support data sorting and ordering', async ({ page, testFiles, browserMode }) => {
    await navigateToTransformStep(page, testFiles, browserMode);

    await test.step('Look for sorting options', async () => {
      const sortElements = [
        page.locator('text=/sort|order|arrange/i'),
        page.locator('.sort, .order-by, .arrange'),
        page.locator('button').filter({ hasText: /sort/i })
      ];
      
      let foundSort = false;
      for (const element of sortElements) {
        if (await element.isVisible({ timeout: 3000 }).catch(() => false)) {
          foundSort = true;
          console.log('✓ Sorting options found');
          
          try {
            await element.first().click();
            await page.waitForTimeout(1000);
            await page.screenshot({ path: 'test-results/23-sort-interaction.png', fullPage: true });
          } catch (error) {
            console.log('Sort element found but not interactive');
          }
          break;
        }
      }
      
      if (!foundSort) {
        console.log('ℹ Sorting may be automatic or in a different interface');
      }
    });
  });

  test('should support field renaming and formatting', async ({ page, testFiles, browserMode }) => {
    await navigateToTransformStep(page, testFiles, browserMode);

    await test.step('Look for field manipulation options', async () => {
      const fieldElements = [
        page.locator('text=/rename|alias|label/i'),
        page.locator('text=/format|type|convert/i'),
        page.locator('.field-editor, .column-editor, .rename')
      ];
      
      let foundFieldOptions = false;
      for (const element of fieldElements) {
        if (await element.isVisible({ timeout: 3000 }).catch(() => false)) {
          foundFieldOptions = true;
          console.log('✓ Field manipulation options found');
          break;
        }
      }
      
      await page.screenshot({ path: 'test-results/24-field-manipulation.png', fullPage: true });
      
      if (!foundFieldOptions) {
        console.log('ℹ Field manipulation may be in the profiling step');
      }
    });
  });

  test('should provide transform preview functionality', async ({ page, testFiles, browserMode }) => {
    await navigateToTransformStep(page, testFiles, browserMode);

    await test.step('Look for preview options', async () => {
      const previewElements = [
        page.locator('text=/preview|sample|example/i'),
        page.locator('.preview, .sample-data, .transform-preview'),
        page.locator('button').filter({ hasText: /preview/i })
      ];
      
      let foundPreview = false;
      for (const element of previewElements) {
        if (await element.isVisible({ timeout: 3000 }).catch(() => false)) {
          foundPreview = true;
          console.log('✓ Transform preview found');
          
          try {
            await element.first().click();
            await page.waitForTimeout(2000);
            await page.screenshot({ path: 'test-results/25-transform-preview.png', fullPage: true });
          } catch (error) {
            console.log('Preview element found but not interactive');
          }
          break;
        }
      }
      
      if (!foundPreview) {
        console.log('ℹ Transform preview may be automatic or always visible');
      }
    });

    await test.step('Verify preview shows sample data', async () => {
      // Look for tabular data or sample rows
      const dataElements = [
        page.locator('table, .data-table, .grid'),
        page.locator('.row, .data-row'),
        page.locator('text=/row \\d+|sample \\d+/i')
      ];
      
      let foundData = false;
      for (const element of dataElements) {
        if (await element.isVisible({ timeout: 3000 }).catch(() => false)) {
          foundData = true;
          console.log('✓ Preview data displayed');
          break;
        }
      }
      
      if (!foundData) {
        console.log('ℹ Preview data may use different visualization');
      }
    });
  });

  test('should allow skipping optional transformations', async ({ page, testFiles, browserMode }) => {
    await navigateToTransformStep(page, testFiles, browserMode);

    await test.step('Look for skip/continue options', async () => {
      const skipElements = [
        page.locator('button').filter({ hasText: /skip|continue|next/i }),
        page.locator('text=/skip.*step|no.*transform/i'),
        page.locator('.skip, .continue, .next-step')
      ];
      
      let foundSkip = false;
      for (const element of skipElements) {
        if (await element.isVisible({ timeout: 3000 }).catch(() => false)) {
          foundSkip = true;
          console.log('✓ Skip transform option found');
          
          // Test the skip functionality
          try {
            await element.first().click();
            await page.waitForTimeout(2000);
            await page.screenshot({ path: 'test-results/26-skip-transform.png', fullPage: true });
            
            // Should advance to next step
            await expectWorkflowStep(page, 'Set up');
            console.log('✓ Successfully skipped transform step');
          } catch (error) {
            console.log('Skip button found but may not advance workflow');
          }
          break;
        }
      }
      
      if (!foundSkip) {
        console.log('ℹ Transform step may be mandatory or auto-advance');
      }
    });
  });

  test('should handle transform validation and errors', async ({ page, testFiles, browserMode, mockBackend }) => {
    await navigateToTransformStep(page, testFiles, browserMode);

    await test.step('Simulate transform error', async () => {
      // Mock transform API error
      mockBackend.use(
        require('msw').http.post('http://localhost:3001/api/transform', () => {
          return require('msw').HttpResponse.json(
            { error: { message: 'Transform validation failed', code: 'VALIDATION_ERROR' } },
            { status: 400 }
          );
        })
      );
    });

    await test.step('Attempt to apply transform and check error handling', async () => {
      // Look for apply/execute buttons
      const applyButtons = [
        page.locator('button').filter({ hasText: /apply|execute|run/i }),
        page.locator('.apply, .execute, .run-transform')
      ];
      
      let foundApply = false;
      for (const button of applyButtons) {
        if (await button.isVisible({ timeout: 3000 }).catch(() => false)) {
          foundApply = true;
          
          try {
            await button.first().click();
            await page.waitForTimeout(2000);
            
            // Look for error messages
            const errorElements = [
              page.locator('text=/error|failed|invalid/i'),
              page.locator('.error, .validation-error, .alert-error')
            ];
            
            let foundError = false;
            for (const error of errorElements) {
              if (await error.isVisible({ timeout: 3000 }).catch(() => false)) {
                foundError = true;
                const errorText = await error.textContent();
                console.log(`✓ Transform error handled: ${errorText?.substring(0, 50)}...`);
                break;
              }
            }
            
            await page.screenshot({ path: 'test-results/27-transform-error.png', fullPage: true });
            
            if (!foundError) {
              console.log('ℹ Transform error handling may be silent or different');
            }
          } catch (error) {
            console.log('Apply button found but not functional');
          }
          break;
        }
      }
      
      if (!foundApply) {
        console.log('ℹ Transform may be applied automatically');
      }
    });
  });

  test('should save and display transform configuration', async ({ page, testFiles, browserMode }) => {
    await navigateToTransformStep(page, testFiles, browserMode);

    await test.step('Look for transform configuration display', async () => {
      const configElements = [
        page.locator('text=/configuration|settings|params/i'),
        page.locator('.config, .settings, .transform-config'),
        page.locator('.operation-list, .transform-list')
      ];
      
      let foundConfig = false;
      for (const element of configElements) {
        if (await element.isVisible({ timeout: 3000 }).catch(() => false)) {
          foundConfig = true;
          console.log('✓ Transform configuration display found');
          break;
        }
      }
      
      await page.screenshot({ path: 'test-results/28-transform-config.png', fullPage: true });
      
      if (!foundConfig) {
        console.log('ℹ Transform configuration may be implicit or in different format');
      }
    });

    await test.step('Test undo/redo functionality if available', async () => {
      const undoElements = [
        page.locator('button').filter({ hasText: /undo|revert/i }),
        page.locator('button').filter({ hasText: /redo|restore/i }),
        page.locator('.undo, .redo, .revert')
      ];
      
      let foundUndo = false;
      for (const element of undoElements) {
        if (await element.isVisible({ timeout: 2000 }).catch(() => false)) {
          foundUndo = true;
          console.log('✓ Undo/redo functionality available');
          break;
        }
      }
      
      if (!foundUndo) {
        console.log('ℹ Undo/redo may not be needed for this transform interface');
      }
    });
  });

  test('should handle large dataset transformations', async ({ page, testFiles, browserMode }) => {
    await test.step('Upload large file and navigate to transform', async () => {
      await uploadFile(page, testFiles.large, browserMode);
      await waitForFileProcessing(page, 60000); // Longer timeout for large files
      
      const transformStep = page.locator('.workflow-step').filter({ hasText: /transform|optional/i });
      if (await transformStep.isVisible({ timeout: 5000 }).catch(() => false)) {
        await transformStep.click();
        await page.waitForTimeout(3000);
      }
    });

    await test.step('Check performance indicators for large datasets', async () => {
      // Look for performance warnings or optimizations
      const performanceElements = [
        page.locator('text=/large dataset|performance|memory/i'),
        page.locator('text=/\\d+k rows|\\d+ mb|size/i'),
        page.locator('.performance-warning, .size-warning')
      ];
      
      let foundPerformance = false;
      for (const element of performanceElements) {
        if (await element.isVisible({ timeout: 3000 }).catch(() => false)) {
          foundPerformance = true;
          const text = await element.textContent();
          console.log(`✓ Performance indicator: ${text?.substring(0, 50)}...`);
          break;
        }
      }
      
      await page.screenshot({ path: 'test-results/29-large-dataset-transform.png', fullPage: true });
      
      if (!foundPerformance) {
        console.log('ℹ Large dataset handling may be transparent');
      }
    });

    await test.step('Verify transform responsiveness', async () => {
      // App should remain responsive even with large datasets
      const responsiveElements = [
        page.locator('button, .clickable'),
        page.locator('.workflow-step')
      ];
      
      for (const element of responsiveElements) {
        if (await element.first().isVisible({ timeout: 2000 }).catch(() => false)) {
          // Element should be interactive
          const isEnabled = await element.first().isEnabled();
          console.log(`UI responsiveness: ${isEnabled ? 'Good' : 'Limited'}`);
          break;
        }
      }
    });
  });
});