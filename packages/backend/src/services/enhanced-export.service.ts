import { Readable } from 'stream';
import * as fs from 'fs';
import * as path from 'path';
import * as PDFDocument from 'pdfkit';
import * as ExcelJS from 'exceljs';
import archiver from 'archiver';
import { v4 as uuidv4 } from 'uuid';
import { eventEmitter } from './event.service';
import { AppError } from '../middleware/error.middleware';
import { getSQLiteConnection } from '../database/sqlite-refactored';
import logger from '../config/logger';
import { ExportService, ExportOptions, ExportProgress } from './export.service';

export interface EnhancedExportOptions extends ExportOptions {
  format: 'pdf' | 'csv' | 'excel' | 'json' | 'html' | 'zip';
  reportType?: 'audit' | 'sentiment' | 'compliance' | 'decisions' | 'methodology';
  includeMetadata?: boolean;
  includeCharts?: boolean;
  includeAttachments?: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
  customSections?: string[];
}

export interface AuditReportData {
  title: string;
  generatedDate: Date;
  author: string;
  organization?: string;
  summary: {
    totalRecords: number;
    processedRecords: number;
    sensitiveDataFound: number;
    complianceScore: number;
    riskLevel: 'low' | 'medium' | 'high';
  };
  timeline: Array<{
    date: Date;
    event: string;
    severity: string;
    details: string;
  }>;
  findings: Array<{
    category: string;
    severity: 'info' | 'warning' | 'critical';
    description: string;
    recommendations: string[];
    evidence?: any[];
  }>;
  compliance: {
    frameworks: string[];
    status: { [framework: string]: 'compliant' | 'non-compliant' | 'partial' };
    details: { [framework: string]: string[] };
  };
  dataFlows: Array<{
    source: string;
    destination: string;
    dataType: string;
    volume: number;
    protectionMethods: string[];
  }>;
}

export class EnhancedExportService extends ExportService {
  private static readonly ENHANCED_EXPORT_DIR = 'exports/enhanced';
  private activeEnhancedExports: Map<string, ExportProgress> = new Map();

  constructor() {
    super();
    // Ensure enhanced export directory exists
    const exportPath = path.join(process.cwd(), EnhancedExportService.ENHANCED_EXPORT_DIR);
    if (!fs.existsSync(exportPath)) {
      fs.mkdirSync(exportPath, { recursive: true });
    }
  }

  /**
   * Generate PDF audit report
   */
  async generatePDFAuditReport(
    data: AuditReportData,
    options: EnhancedExportOptions = { format: 'pdf', reportType: 'audit' }
  ): Promise<string> {
    const exportId = uuidv4();
    const fileName = `audit-report-${exportId}.pdf`;
    const filePath = path.join(
      process.cwd(),
      EnhancedExportService.ENHANCED_EXPORT_DIR,
      fileName
    );

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margins: { top: 50, left: 50, bottom: 50, right: 50 },
          info: {
            Title: data.title,
            Author: data.author,
            Subject: 'Security Audit Report',
            CreationDate: new Date()
          }
        });

        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);

        // Cover Page
        this.addCoverPage(doc, data);
        doc.addPage();

        // Table of Contents
        this.addTableOfContents(doc);
        doc.addPage();

        // Executive Summary
        this.addExecutiveSummary(doc, data);
        doc.addPage();

        // Timeline
        this.addTimeline(doc, data.timeline);
        doc.addPage();

        // Findings
        this.addFindings(doc, data.findings);
        doc.addPage();

        // Compliance Section
        this.addComplianceSection(doc, data.compliance);
        doc.addPage();

        // Data Flow Diagrams
        this.addDataFlowSection(doc, data.dataFlows);

        // Appendices
        if (options.includeAttachments) {
          doc.addPage();
          this.addAppendices(doc, data);
        }

        doc.end();

        stream.on('finish', () => {
          logger.info(`PDF audit report generated: ${fileName}`);
          resolve(filePath);
        });

        stream.on('error', (error) => {
          logger.error('Error generating PDF:', error);
          reject(error);
        });

      } catch (error) {
        logger.error('Error creating PDF document:', error);
        reject(error);
      }
    });
  }

  private addCoverPage(doc: PDFKit.PDFDocument, data: AuditReportData): void {
    // Title
    doc.fontSize(28)
      .font('Helvetica-Bold')
      .text(data.title, { align: 'center' });

    doc.moveDown(2);

    // Organization
    if (data.organization) {
      doc.fontSize(18)
        .font('Helvetica')
        .text(data.organization, { align: 'center' });
    }

    doc.moveDown(4);

    // Risk Level Badge
    const riskColor = {
      low: '#4CAF50',
      medium: '#FF9800',
      high: '#F44336'
    }[data.summary.riskLevel];

    doc.rect(200, doc.y, 200, 60)
      .fillAndStroke(riskColor, riskColor);

    doc.fillColor('white')
      .fontSize(24)
      .text(`Risk Level: ${data.summary.riskLevel.toUpperCase()}`, 
        200, doc.y - 40, { width: 200, align: 'center' });

    doc.fillColor('black');
    doc.moveDown(6);

    // Summary Stats
    doc.fontSize(14)
      .font('Helvetica')
      .text(`Total Records: ${data.summary.totalRecords}`, { align: 'center' })
      .text(`Processed: ${data.summary.processedRecords}`, { align: 'center' })
      .text(`Sensitive Data Found: ${data.summary.sensitiveDataFound}`, { align: 'center' })
      .text(`Compliance Score: ${data.summary.complianceScore}%`, { align: 'center' });

    doc.moveDown(4);

    // Generated info
    doc.fontSize(10)
      .fillColor('#666666')
      .text(`Generated: ${data.generatedDate.toLocaleString()}`, { align: 'center' })
      .text(`Author: ${data.author}`, { align: 'center' });
  }

  private addTableOfContents(doc: PDFKit.PDFDocument): void {
    doc.fontSize(20)
      .font('Helvetica-Bold')
      .text('Table of Contents');

    doc.moveDown();

    const sections = [
      { title: 'Executive Summary', page: 3 },
      { title: 'Timeline', page: 4 },
      { title: 'Findings', page: 5 },
      { title: 'Compliance Status', page: 6 },
      { title: 'Data Flow Analysis', page: 7 },
      { title: 'Appendices', page: 8 }
    ];

    doc.fontSize(12).font('Helvetica');
    sections.forEach(section => {
      doc.text(`${section.title}`, 50, doc.y, { continued: true })
        .text(`.`.repeat(50), { continued: true })
        .text(`${section.page}`, { align: 'right' });
      doc.moveDown(0.5);
    });
  }

  private addExecutiveSummary(doc: PDFKit.PDFDocument, data: AuditReportData): void {
    doc.fontSize(20)
      .font('Helvetica-Bold')
      .text('Executive Summary');

    doc.moveDown();
    doc.fontSize(11).font('Helvetica');

    const summaryText = `This audit report presents a comprehensive analysis of data security and compliance status. 
    A total of ${data.summary.totalRecords} records were analyzed, with ${data.summary.processedRecords} successfully processed. 
    The analysis identified ${data.summary.sensitiveDataFound} instances of sensitive data requiring protection. 
    The overall compliance score is ${data.summary.complianceScore}%, indicating a ${data.summary.riskLevel} risk level.`;

    doc.text(summaryText, { align: 'justify' });

    doc.moveDown();

    // Key Findings Summary
    doc.fontSize(14).font('Helvetica-Bold').text('Key Findings:');
    doc.fontSize(11).font('Helvetica');

    const criticalFindings = data.findings.filter(f => f.severity === 'critical');
    if (criticalFindings.length > 0) {
      doc.text(`• ${criticalFindings.length} critical issues requiring immediate attention`);
    }

    const warningFindings = data.findings.filter(f => f.severity === 'warning');
    if (warningFindings.length > 0) {
      doc.text(`• ${warningFindings.length} warnings that should be addressed`);
    }

    doc.text(`• ${data.compliance.frameworks.length} compliance frameworks evaluated`);
  }

  private addTimeline(doc: PDFKit.PDFDocument, timeline: AuditReportData['timeline']): void {
    doc.fontSize(20)
      .font('Helvetica-Bold')
      .text('Audit Timeline');

    doc.moveDown();

    timeline.forEach(event => {
      const severityColor = {
        'info': '#2196F3',
        'warning': '#FF9800',
        'critical': '#F44336'
      }[event.severity] || '#000000';

      doc.fontSize(10)
        .fillColor(severityColor)
        .text(`${event.date.toLocaleDateString()} - ${event.event}`, { underline: true });

      doc.fontSize(9)
        .fillColor('black')
        .text(event.details, { indent: 20 });

      doc.moveDown(0.5);
    });
  }

  private addFindings(doc: PDFKit.PDFDocument, findings: AuditReportData['findings']): void {
    doc.fontSize(20)
      .font('Helvetica-Bold')
      .text('Detailed Findings');

    doc.moveDown();

    findings.forEach((finding, index) => {
      const severityColor = {
        'info': '#2196F3',
        'warning': '#FF9800',
        'critical': '#F44336'
      }[finding.severity];

      // Finding header
      doc.fontSize(14)
        .font('Helvetica-Bold')
        .fillColor(severityColor)
        .text(`${index + 1}. ${finding.category} (${finding.severity.toUpperCase()})`);

      doc.fontSize(11)
        .font('Helvetica')
        .fillColor('black')
        .text(finding.description, { indent: 20 });

      // Recommendations
      if (finding.recommendations.length > 0) {
        doc.fontSize(12)
          .font('Helvetica-Bold')
          .text('Recommendations:', { indent: 20 });

        doc.fontSize(10).font('Helvetica');
        finding.recommendations.forEach(rec => {
          doc.text(`• ${rec}`, { indent: 40 });
        });
      }

      doc.moveDown();
    });
  }

  private addComplianceSection(doc: PDFKit.PDFDocument, compliance: AuditReportData['compliance']): void {
    doc.fontSize(20)
      .font('Helvetica-Bold')
      .text('Compliance Status');

    doc.moveDown();

    compliance.frameworks.forEach(framework => {
      const status = compliance.status[framework];
      const statusColor = {
        'compliant': '#4CAF50',
        'non-compliant': '#F44336',
        'partial': '#FF9800'
      }[status];

      doc.fontSize(14)
        .font('Helvetica-Bold')
        .fillColor(statusColor)
        .text(`${framework}: ${status.toUpperCase()}`);

      doc.fontSize(10)
        .font('Helvetica')
        .fillColor('black');

      const details = compliance.details[framework] || [];
      details.forEach(detail => {
        doc.text(`• ${detail}`, { indent: 20 });
      });

      doc.moveDown();
    });
  }

  private addDataFlowSection(doc: PDFKit.PDFDocument, dataFlows: AuditReportData['dataFlows']): void {
    doc.fontSize(20)
      .font('Helvetica-Bold')
      .text('Data Flow Analysis');

    doc.moveDown();

    // Create a simple table
    const tableTop = doc.y;
    const col1 = 50;
    const col2 = 150;
    const col3 = 250;
    const col4 = 350;
    const col5 = 450;

    // Table headers
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Source', col1, tableTop);
    doc.text('Destination', col2, tableTop);
    doc.text('Data Type', col3, tableTop);
    doc.text('Volume', col4, tableTop);
    doc.text('Protection', col5, tableTop);

    // Draw header line
    doc.moveTo(col1, doc.y)
      .lineTo(550, doc.y)
      .stroke();

    doc.moveDown(0.5);

    // Table rows
    doc.fontSize(9).font('Helvetica');
    dataFlows.forEach(flow => {
      const rowY = doc.y;
      doc.text(flow.source, col1, rowY, { width: 90 });
      doc.text(flow.destination, col2, rowY, { width: 90 });
      doc.text(flow.dataType, col3, rowY, { width: 90 });
      doc.text(flow.volume.toString(), col4, rowY, { width: 90 });
      doc.text(flow.protectionMethods.join(', '), col5, rowY, { width: 90 });
      doc.moveDown();
    });
  }

  private addAppendices(doc: PDFKit.PDFDocument, data: AuditReportData): void {
    doc.fontSize(20)
      .font('Helvetica-Bold')
      .text('Appendices');

    doc.moveDown();
    doc.fontSize(11).font('Helvetica');

    doc.text('A. Methodology', { underline: true });
    doc.text('This audit was conducted using industry-standard security assessment methodologies...');

    doc.moveDown();

    doc.text('B. Glossary', { underline: true });
    doc.text('PII - Personally Identifiable Information');
    doc.text('GDPR - General Data Protection Regulation');
    doc.text('CCPA - California Consumer Privacy Act');
  }

  /**
   * Generate CSV decision export
   */
  async generateDecisionExport(
    decisions: Array<{
      id: string;
      timestamp: Date;
      decision: string;
      confidence: number;
      factors: { [key: string]: any };
      outcome?: string;
    }>,
    options: EnhancedExportOptions = { format: 'csv' }
  ): Promise<string> {
    const exportId = uuidv4();
    const fileName = `decisions-export-${exportId}.csv`;
    const filePath = path.join(
      process.cwd(),
      EnhancedExportService.ENHANCED_EXPORT_DIR,
      fileName
    );

    const headers = ['ID', 'Timestamp', 'Decision', 'Confidence', 'Key Factors', 'Outcome'];
    const rows = [headers];

    decisions.forEach(decision => {
      const keyFactors = Object.entries(decision.factors)
        .map(([key, value]) => `${key}: ${value}`)
        .join('; ');

      rows.push([
        decision.id,
        decision.timestamp.toISOString(),
        decision.decision,
        decision.confidence.toString(),
        keyFactors,
        decision.outcome || 'N/A'
      ]);
    });

    const csvContent = rows.map(row => 
      row.map(cell => `"${cell.toString().replace(/"/g, '""')}"`).join(',')
    ).join('\n');

    fs.writeFileSync(filePath, csvContent, 'utf-8');
    logger.info(`Decision export CSV generated: ${fileName}`);

    return filePath;
  }

  /**
   * Generate methodology documentation
   */
  async generateMethodologyDoc(
    methodology: {
      title: string;
      version: string;
      sections: Array<{
        heading: string;
        content: string;
        subsections?: Array<{
          heading: string;
          content: string;
        }>;
      }>;
    },
    format: 'pdf' | 'html' = 'pdf'
  ): Promise<string> {
    const exportId = uuidv4();
    const fileName = `methodology-${exportId}.${format}`;
    const filePath = path.join(
      process.cwd(),
      EnhancedExportService.ENHANCED_EXPORT_DIR,
      fileName
    );

    if (format === 'html') {
      const html = this.generateMethodologyHTML(methodology);
      fs.writeFileSync(filePath, html, 'utf-8');
    } else {
      await this.generateMethodologyPDF(methodology, filePath);
    }

    logger.info(`Methodology documentation generated: ${fileName}`);
    return filePath;
  }

  private generateMethodologyHTML(methodology: any): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <title>${methodology.title}</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; margin: 40px; }
    h1 { color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; }
    h2 { color: #666; margin-top: 30px; }
    h3 { color: #999; margin-top: 20px; }
    .version { color: #666; font-style: italic; }
    .section { margin-bottom: 30px; }
    .content { text-align: justify; }
  </style>
</head>
<body>
  <h1>${methodology.title}</h1>
  <p class="version">Version: ${methodology.version}</p>
  
  ${methodology.sections.map(section => `
    <div class="section">
      <h2>${section.heading}</h2>
      <div class="content">${section.content}</div>
      ${section.subsections ? section.subsections.map(sub => `
        <h3>${sub.heading}</h3>
        <div class="content">${sub.content}</div>
      `).join('') : ''}
    </div>
  `).join('')}
</body>
</html>`;
  }

  private async generateMethodologyPDF(methodology: any, filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, left: 50, bottom: 50, right: 50 }
      });

      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // Title page
      doc.fontSize(24)
        .font('Helvetica-Bold')
        .text(methodology.title, { align: 'center' });

      doc.fontSize(12)
        .font('Helvetica')
        .fillColor('#666666')
        .text(`Version: ${methodology.version}`, { align: 'center' });

      doc.moveDown(2);

      // Sections
      methodology.sections.forEach((section: any) => {
        doc.addPage();
        
        doc.fontSize(18)
          .font('Helvetica-Bold')
          .fillColor('black')
          .text(section.heading);

        doc.moveDown();
        
        doc.fontSize(11)
          .font('Helvetica')
          .text(section.content, { align: 'justify' });

        if (section.subsections) {
          section.subsections.forEach((sub: any) => {
            doc.moveDown();
            doc.fontSize(14)
              .font('Helvetica-Bold')
              .text(sub.heading);
            
            doc.fontSize(11)
              .font('Helvetica')
              .text(sub.content, { align: 'justify' });
          });
        }
      });

      doc.end();

      stream.on('finish', resolve);
      stream.on('error', reject);
    });
  }

  /**
   * Generate comprehensive export package
   */
  async generateExportPackage(
    packageName: string,
    exports: Array<{
      type: 'audit' | 'sentiment' | 'decisions' | 'raw';
      data: any;
      format: 'pdf' | 'csv' | 'json' | 'excel';
    }>,
    options: EnhancedExportOptions = { format: 'zip' }
  ): Promise<string> {
    const exportId = uuidv4();
    const packageDir = path.join(
      process.cwd(),
      EnhancedExportService.ENHANCED_EXPORT_DIR,
      `package-${exportId}`
    );

    // Create package directory
    fs.mkdirSync(packageDir, { recursive: true });

    const exportedFiles: string[] = [];

    // Generate individual exports
    for (const exportItem of exports) {
      let filePath: string;

      switch (exportItem.type) {
        case 'audit':
          filePath = await this.generatePDFAuditReport(exportItem.data, {
            format: 'pdf',
            reportType: 'audit'
          });
          break;

        case 'decisions':
          filePath = await this.generateDecisionExport(exportItem.data, {
            format: exportItem.format
          });
          break;

        case 'sentiment':
          filePath = await this.exportSentimentResults(exportItem.data, {
            format: exportItem.format
          });
          break;

        case 'raw':
          filePath = await this.exportRawData(exportItem.data, {
            format: exportItem.format
          });
          break;

        default:
          continue;
      }

      // Move file to package directory
      const destPath = path.join(packageDir, path.basename(filePath));
      fs.renameSync(filePath, destPath);
      exportedFiles.push(destPath);
    }

    // Create README
    const readmePath = path.join(packageDir, 'README.txt');
    const readmeContent = `Export Package: ${packageName}
Generated: ${new Date().toISOString()}
Files included: ${exportedFiles.length}

Contents:
${exportedFiles.map(f => `- ${path.basename(f)}`).join('\n')}
`;
    fs.writeFileSync(readmePath, readmeContent);

    // Create ZIP archive
    const zipPath = `${packageDir}.zip`;
    await this.createZipArchive(packageDir, zipPath);

    // Clean up directory
    this.cleanupDirectory(packageDir);

    logger.info(`Export package created: ${path.basename(zipPath)}`);
    return zipPath;
  }

  private async exportSentimentResults(data: any, options: ExportOptions): Promise<string> {
    const exportId = uuidv4();
    const fileName = `sentiment-results-${exportId}.${options.format}`;
    const filePath = path.join(
      process.cwd(),
      EnhancedExportService.ENHANCED_EXPORT_DIR,
      fileName
    );

    if (options.format === 'excel') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Sentiment Results');

      // Add headers
      worksheet.columns = [
        { header: 'ID', key: 'id', width: 15 },
        { header: 'Text', key: 'text', width: 50 },
        { header: 'Sentiment', key: 'sentiment', width: 15 },
        { header: 'Confidence', key: 'confidence', width: 15 },
        { header: 'Timestamp', key: 'timestamp', width: 20 }
      ];

      // Add data
      worksheet.addRows(data);

      // Style headers
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };

      await workbook.xlsx.writeFile(filePath);
    } else {
      // Use parent class methods for other formats
      const size = await this.exportToJson(data, filePath);
    }

    return filePath;
  }

  private async exportRawData(data: any, options: ExportOptions): Promise<string> {
    const exportId = uuidv4();
    const fileName = `raw-data-${exportId}.${options.format}`;
    const filePath = path.join(
      process.cwd(),
      EnhancedExportService.ENHANCED_EXPORT_DIR,
      fileName
    );

    if (options.format === 'json') {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } else if (options.format === 'csv') {
      // Convert to CSV (simple implementation)
      const rows = data.map((item: any) => Object.values(item).join(','));
      const headers = Object.keys(data[0]).join(',');
      fs.writeFileSync(filePath, [headers, ...rows].join('\n'));
    }

    return filePath;
  }

  private async createZipArchive(sourceDir: string, destPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(destPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => resolve());
      archive.on('error', (err) => reject(err));

      archive.pipe(output);
      archive.directory(sourceDir, false);
      archive.finalize();
    });
  }

  private cleanupDirectory(dirPath: string): void {
    if (fs.existsSync(dirPath)) {
      fs.readdirSync(dirPath).forEach(file => {
        const filePath = path.join(dirPath, file);
        if (fs.lstatSync(filePath).isDirectory()) {
          this.cleanupDirectory(filePath);
        } else {
          fs.unlinkSync(filePath);
        }
      });
      fs.rmdirSync(dirPath);
    }
  }

  /**
   * Stream export progress
   */
  streamExportProgress(
    exportId: string,
    onProgress: (progress: ExportProgress) => void
  ): void {
    const checkProgress = setInterval(() => {
      const progress = this.getExportProgress(exportId) || 
                      this.activeEnhancedExports.get(exportId);
      
      if (progress) {
        onProgress(progress);
        
        if (progress.status === 'completed' || progress.status === 'failed') {
          clearInterval(checkProgress);
        }
      }
    }, 500);
  }
}

export const enhancedExportService = new EnhancedExportService();