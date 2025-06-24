import { HealthcareDataGenerator } from '../../utils/healthcare-data-generator';

describe('HealthcareDataGenerator', () => {
  describe('TDD: RED Phase - Failing Tests', () => {
    it('should generate healthcare dataset with HIPAA compliance fields', () => {
      const generator = new HealthcareDataGenerator(42);
      const dataset = generator.generateHealthcareDataset();
      
      expect(dataset).toBeDefined();
      expect(dataset.metadata.recordCount).toBe(5000);
      expect(dataset.metadata.uniquePatients).toBe(1000);
      expect(dataset.headers).toContain('patient_id');
      expect(dataset.headers).toContain('medical_record_number');
      expect(dataset.headers).toContain('diagnosis_code');
      expect(dataset.headers).toContain('patient_feedback');
      expect(dataset.headers).toContain('provider_notes');
      expect(dataset.headers).toContain('phi_level');
    });

    it('should generate realistic medical scenarios', () => {
      const generator = new HealthcareDataGenerator(42);
      const dataset = generator.generateHealthcareDataset();
      
      const record = dataset.records[0];
      expect(record.patient_id).toMatch(/^PAT-\d{6}$/);
      expect(record.medical_record_number).toMatch(/^MRN\d{8}$/);
      expect(record.diagnosis_code).toMatch(/^[A-Z]\d{2}\.\d$/); // ICD-10 format
      expect(record.patient_feedback).toBeDefined();
      expect(record.provider_notes).toBeDefined();
      expect(['low', 'medium', 'high']).toContain(record.phi_level);
    });

    it('should include various medical departments', () => {
      const generator = new HealthcareDataGenerator(42);
      const dataset = generator.generateHealthcareDataset();
      
      const departments = [...new Set(dataset.records.map(r => r.department))];
      expect(departments).toContain('Cardiology');
      expect(departments).toContain('Emergency');
      expect(departments).toContain('Oncology');
      expect(departments.length).toBeGreaterThanOrEqual(5);
    });

    it('should generate appropriate sentiment patterns for medical contexts', () => {
      const generator = new HealthcareDataGenerator(42);
      const dataset = generator.generateHealthcareDataset();
      
      // Emergency should have more negative sentiment
      const emergencyRecords = dataset.records.filter(r => r.department === 'Emergency');
      const emergencyAvgSentiment = emergencyRecords.reduce((sum, r) => sum + r.patient_sentiment_score, 0) / emergencyRecords.length;
      expect(emergencyAvgSentiment).toBeLessThan(60);

      // Pediatrics should have more positive feedback
      const pediatricRecords = dataset.records.filter(r => r.department === 'Pediatrics');
      if (pediatricRecords.length > 0) {
        const pediatricAvgSentiment = pediatricRecords.reduce((sum, r) => sum + r.patient_sentiment_score, 0) / pediatricRecords.length;
        expect(pediatricAvgSentiment).toBeGreaterThan(55);
      }
    });

    it('should generate reproducible data with same seed', () => {
      const generator1 = new HealthcareDataGenerator(123);
      const generator2 = new HealthcareDataGenerator(123);
      
      const dataset1 = generator1.generateHealthcareDataset();
      const dataset2 = generator2.generateHealthcareDataset();
      
      expect(dataset1.records[0].patient_id).toBe(dataset2.records[0].patient_id);
      expect(dataset1.records[0].patient_feedback).toBe(dataset2.records[0].patient_feedback);
    });

    it('should include medical terminology and context', () => {
      const generator = new HealthcareDataGenerator(42);
      const dataset = generator.generateHealthcareDataset();
      
      // Check for medical terms in feedback and notes
      const allText = dataset.records.map(r => `${r.patient_feedback} ${r.provider_notes}`).join(' ');
      expect(allText).toMatch(/doctor|nurse|treatment|medication|pain|recovery/i);
    });

    it('should have appropriate visit types distribution', () => {
      const generator = new HealthcareDataGenerator(42);
      const dataset = generator.generateHealthcareDataset();
      
      const visitTypes = [...new Set(dataset.records.map(r => r.visit_type))];
      expect(visitTypes).toContain('routine');
      expect(visitTypes).toContain('emergency');
      expect(visitTypes).toContain('follow_up');
      expect(visitTypes).toContain('consultation');
    });
  });
});