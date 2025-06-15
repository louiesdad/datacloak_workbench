import { Page, Locator } from '@playwright/test';
import * as path from 'path';

export interface AnalysisConfig {
  model?: 'basic' | 'advanced' | 'premium';
  extractKeywords?: boolean;
  analyzeEmotions?: boolean;
  maskPII?: boolean;
  costLimit?: number;
}

export class AppActions {
  constructor(private page: Page) {}

  /**
   * Upload a file using either drag-drop or file picker
   */
  async uploadFile(filePath: string, method: 'picker' | 'dragdrop' = 'picker') {
    if (method === 'picker') {
      // Click upload area - LargeFileUploader uses a clickable div, not a button
      const uploadArea = this.page.locator('.upload-area, .large-file-uploader, [data-testid="upload-area"]').first();
      
      // If no upload area found, try button fallback
      if (!await uploadArea.isVisible({ timeout: 1000 }).catch(() => false)) {
        const uploadButton = this.page.locator('button').filter({ 
          hasText: /upload|select.*file|browse/i 
        }).first();
        
        if (await uploadButton.isVisible()) {
          await uploadButton.click();
        }
      } else {
        // Click the upload area to trigger file input
        await uploadArea.click();
      }
      
      // Set file input
      const fileInput = this.page.locator('input[type="file"]');
      await fileInput.setInputFiles(filePath);
    } else {
      // Drag and drop simulation
      const dropZone = this.page.locator('.drop-zone, [data-testid="drop-zone"]').first();
      
      // Create data transfer
      await this.page.evaluate(async ({ filePath }) => {
        const response = await fetch(filePath);
        const blob = await response.blob();
        const file = new File([blob], path.basename(filePath), { type: 'text/csv' });
        
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        
        const dropEvent = new DragEvent('drop', {
          bubbles: true,
          cancelable: true,
          dataTransfer
        });
        
        const dropZone = document.querySelector('.drop-zone');
        if (dropZone) {
          dropZone.dispatchEvent(dropEvent);
        }
      }, { filePath });
    }
    
    // Wait for upload to start
    await this.page.waitForTimeout(1000);
  }

  /**
   * Wait for file processing to complete
   */
  async waitForProcessing(timeout: number = 30000) {
    // Wait for progress indicators to disappear
    const progressSelectors = [
      '.progress-bar',
      '[role="progressbar"]',
      '.loading',
      '.processing',
      '.spinner'
    ];
    
    for (const selector of progressSelectors) {
      const element = this.page.locator(selector);
      if (await element.isVisible({ timeout: 1000 }).catch(() => false)) {
        await element.waitFor({ state: 'hidden', timeout });
      }
    }
    
    // Wait for completion indicators
    const completionSelectors = [
      'text=/complete|finished|ready|processed/i',
      '.success',
      '[data-status="complete"]'
    ];
    
    let completed = false;
    for (const selector of completionSelectors) {
      const element = this.page.locator(selector).first();
      if (await element.isVisible({ timeout: 5000 }).catch(() => false)) {
        completed = true;
        break;
      }
    }
    
    return completed;
  }

  /**
   * Navigate through workflow steps
   */
  async navigateToStep(stepName: 'upload' | 'profile' | 'transform' | 'configure' | 'execute' | 'results') {
    const stepButton = this.page.locator('.workflow-step, [data-step]').filter({ 
      hasText: new RegExp(stepName, 'i') 
    });
    
    if (await stepButton.isEnabled()) {
      await stepButton.click();
      await this.page.waitForTimeout(1000);
    } else {
      // Try to progress through workflow
      await this.continueWorkflow();
    }
  }

  /**
   * Continue to next workflow step
   */
  async continueWorkflow() {
    const continueButton = this.page.locator('button').filter({ 
      hasText: /continue|next|proceed/i 
    }).first();
    
    if (await continueButton.isVisible() && await continueButton.isEnabled()) {
      await continueButton.click();
      await this.page.waitForTimeout(2000);
    }
  }

  /**
   * Skip optional steps
   */
  async skipStep(stepName: string) {
    const skipButton = this.page.locator('button').filter({ 
      hasText: new RegExp(`skip.*${stepName}`, 'i') 
    }).first();
    
    if (await skipButton.isVisible()) {
      await skipButton.click();
      await this.page.waitForTimeout(2000);
    }
  }

  /**
   * Configure and execute sentiment analysis
   */
  async runSentimentAnalysis(config: AnalysisConfig = {}) {
    // Navigate to configuration
    await this.navigateToStep('configure');
    
    // Wait for configuration UI
    await this.page.waitForSelector('text=/sentiment.*analysis.*wizard/i', { timeout: 10000 });
    
    // Configure options
    if (config.model) {
      const modelSelect = this.page.locator('select[name="model"], [data-testid="model-select"]');
      if (await modelSelect.isVisible()) {
        await modelSelect.selectOption(config.model);
      }
    }
    
    if (config.extractKeywords !== undefined) {
      const keywordsCheckbox = this.page.locator('input[type="checkbox"]').filter({ 
        hasText: /keywords/i 
      });
      await this.setCheckbox(keywordsCheckbox, config.extractKeywords);
    }
    
    if (config.analyzeEmotions !== undefined) {
      const emotionsCheckbox = this.page.locator('input[type="checkbox"]').filter({ 
        hasText: /emotions/i 
      });
      await this.setCheckbox(emotionsCheckbox, config.analyzeEmotions);
    }
    
    if (config.maskPII !== undefined) {
      const piiCheckbox = this.page.locator('input[type="checkbox"]').filter({ 
        hasText: /mask.*pii/i 
      });
      await this.setCheckbox(piiCheckbox, config.maskPII);
    }
    
    // Complete configuration wizard
    await this.completeWizard();
    
    // Start analysis
    const startButton = this.page.locator('button').filter({ 
      hasText: /start.*analysis|run.*analysis|execute/i 
    }).first();
    
    if (await startButton.isEnabled()) {
      await startButton.click();
      return true;
    }
    
    return false;
  }

  /**
   * Complete a wizard by clicking through steps
   */
  async completeWizard() {
    const maxSteps = 5;
    
    for (let i = 0; i < maxSteps; i++) {
      const nextButton = this.page.locator('button').filter({ hasText: /next/i }).first();
      const finishButton = this.page.locator('button').filter({ 
        hasText: /finish|complete|done|start.*analysis/i 
      }).first();
      
      if (await finishButton.isVisible()) {
        await finishButton.click();
        break;
      } else if (await nextButton.isVisible()) {
        await nextButton.click();
        await this.page.waitForTimeout(1000);
      } else {
        break;
      }
    }
  }

  /**
   * Export results in specified format
   */
  async exportResults(format: 'csv' | 'xlsx' | 'json' | 'parquet') {
    // Navigate to results
    await this.navigateToStep('results');
    
    // Select format
    const formatSelector = this.page.locator(`input[value="${format}"], button:has-text("${format.toUpperCase()}")`);
    if (await formatSelector.isVisible()) {
      await formatSelector.click();
    }
    
    // Click export
    const exportButton = this.page.locator('button').filter({ 
      hasText: /export|download/i 
    }).first();
    
    if (await exportButton.isEnabled()) {
      const downloadPromise = this.page.waitForEvent('download');
      await exportButton.click();
      const download = await downloadPromise;
      return download;
    }
    
    return null;
  }

  /**
   * Get current workflow step
   */
  async getCurrentStep(): Promise<string | null> {
    const activeStep = this.page.locator('.workflow-step.active, [data-step].active').first();
    if (await activeStep.isVisible()) {
      return await activeStep.textContent();
    }
    return null;
  }

  /**
   * Check for errors
   */
  async checkForErrors(): Promise<string[]> {
    const errorSelectors = [
      '.error-message',
      '[role="alert"]',
      '.alert-error',
      'text=/error|failed/i'
    ];
    
    const errors: string[] = [];
    
    for (const selector of errorSelectors) {
      const elements = await this.page.locator(selector).all();
      for (const element of elements) {
        const text = await element.textContent();
        if (text) errors.push(text.trim());
      }
    }
    
    return [...new Set(errors)]; // Remove duplicates
  }

  /**
   * Wait for specific text to appear
   */
  async waitForText(text: string | RegExp, timeout: number = 30000) {
    await this.page.waitForSelector(`text=${text}`, { timeout });
  }

  /**
   * Take screenshot with timestamp
   */
  async takeScreenshot(name: string) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await this.page.screenshot({ 
      path: `test-results/${name}-${timestamp}.png`,
      fullPage: true 
    });
  }

  /**
   * Set checkbox state
   */
  private async setCheckbox(checkbox: Locator, checked: boolean) {
    const isChecked = await checkbox.isChecked();
    if (isChecked !== checked) {
      await checkbox.click();
    }
  }

  /**
   * Get job progress
   */
  async getJobProgress(): Promise<number> {
    const progressBar = this.page.locator('[role="progressbar"], .progress-bar').first();
    if (await progressBar.isVisible()) {
      const value = await progressBar.getAttribute('aria-valuenow') || 
                    await progressBar.getAttribute('data-progress');
      return parseInt(value || '0');
    }
    return 0;
  }

  /**
   * Wait for job completion
   */
  async waitForJobCompletion(timeout: number = 300000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const progress = await this.getJobProgress();
      if (progress >= 100) {
        return true;
      }
      
      // Check for completion indicators
      const completed = await this.page.locator('text=/complete|finished|done/i').isVisible()
        .catch(() => false);
      
      if (completed) {
        return true;
      }
      
      // Check for errors
      const errors = await this.checkForErrors();
      if (errors.some(e => e.toLowerCase().includes('failed'))) {
        throw new Error(`Job failed: ${errors.join(', ')}`);
      }
      
      await this.page.waitForTimeout(5000);
    }
    
    return false;
  }
}