import seedrandom from 'seedrandom';

export interface HealthcareRecord {
  patient_id: string;
  medical_record_number: string;
  diagnosis_code: string;
  department: string;
  visit_type: 'routine' | 'emergency' | 'follow_up' | 'consultation';
  patient_feedback: string;
  provider_notes: string;
  patient_sentiment_score: number;
  provider_sentiment_score: number;
  phi_level: 'low' | 'medium' | 'high';
  visit_date: string;
  age_group: string;
  insurance_type: string;
}

export interface HealthcareDataset {
  metadata: {
    recordCount: number;
    uniquePatients: number;
    filename: string;
    seed: number;
    generatedAt: string;
    description: string;
  };
  headers: string[];
  records: HealthcareRecord[];
}

interface Patient {
  id: string;
  mrn: string;
  ageGroup: string;
  insurance: string;
}

export class HealthcareDataGenerator {
  private rng: seedrandom.PRNG;
  private seed: number;
  private baseDate = new Date('2024-06-23T00:00:00.000Z');

  private departments = [
    'Cardiology', 'Emergency', 'Oncology', 'Pediatrics', 'Orthopedics',
    'Neurology', 'Psychiatry', 'Internal Medicine', 'Surgery', 'ICU'
  ];

  private diagnosisCodes = [
    'I10.9', 'E11.9', 'M25.9', 'F32.9', 'Z51.1', 'N18.6',
    'C78.0', 'G93.1', 'J44.1', 'K59.0', 'R06.2', 'M79.3'
  ];

  private medicalTerms = [
    'doctor', 'nurse', 'treatment', 'medication', 'pain', 'recovery',
    'diagnosis', 'symptoms', 'therapy', 'procedure', 'appointment',
    'prescription', 'examination', 'surgery', 'healing', 'care'
  ];

  private positiveHealthcarePhrases = [
    'excellent care from the medical team',
    'felt comfortable during the procedure',
    'staff was very professional and caring',
    'quick recovery thanks to great treatment',
    'doctor explained everything clearly',
    'nurses were attentive and helpful',
    'pain management was effective',
    'satisfied with the quality of care'
  ];

  private negativeHealthcarePhrases = [
    'long wait times in the emergency room',
    'difficult to reach the doctor',
    'side effects from the medication',
    'communication could be better',
    'concerned about the diagnosis',
    'treatment is not working as expected',
    'insurance coverage issues',
    'frustrated with the appointment system'
  ];

  private neutralHealthcarePhrases = [
    'routine check-up went as expected',
    'following up on previous treatment',
    'taking medication as prescribed',
    'monitoring the condition regularly',
    'discussing treatment options',
    'scheduled for additional tests',
    'reviewing medical history',
    'coordinating with specialists'
  ];

  constructor(seed: number = Date.now()) {
    this.seed = seed;
    this.rng = seedrandom(seed.toString());
  }

  generateHealthcareDataset(): HealthcareDataset {
    const records: HealthcareRecord[] = [];
    const uniquePatients = 1000;
    const recordCount = 5000;

    // Generate patient pool
    const patients = this.generatePatientPool(uniquePatients);

    // Generate records (each patient can have multiple visits)
    for (let recordId = 1; recordId <= recordCount; recordId++) {
      const patient = patients[Math.floor(this.rng() * patients.length)];
      const record = this.generateHealthcareRecord(patient, recordId);
      records.push(record);
    }

    return {
      metadata: {
        recordCount: records.length,
        uniquePatients,
        filename: 'test_healthcare_data_5k.csv',
        seed: this.seed,
        generatedAt: this.baseDate.toISOString(),
        description: 'HIPAA-compliant healthcare dataset for sentiment analysis testing'
      },
      headers: [
        'patient_id',
        'medical_record_number',
        'diagnosis_code',
        'department',
        'visit_type',
        'patient_feedback',
        'provider_notes',
        'patient_sentiment_score',
        'provider_sentiment_score',
        'phi_level',
        'visit_date',
        'age_group',
        'insurance_type'
      ],
      records
    };
  }

  private generatePatientPool(count: number): Patient[] {
    const patients: Patient[] = [];
    const ageGroups = ['0-17', '18-34', '35-54', '55-74', '75+'];
    const insuranceTypes = ['Medicare', 'Medicaid', 'Private', 'Uninsured', 'Military'];

    for (let i = 1; i <= count; i++) {
      patients.push({
        id: `PAT-${String(i).padStart(6, '0')}`,
        mrn: `MRN${String(Math.floor(this.rng() * 100000000)).padStart(8, '0')}`,
        ageGroup: ageGroups[Math.floor(this.rng() * ageGroups.length)],
        insurance: insuranceTypes[Math.floor(this.rng() * insuranceTypes.length)]
      });
    }

    return patients;
  }

  private generateHealthcareRecord(patient: Patient, recordId: number): HealthcareRecord {
    const department = this.departments[Math.floor(this.rng() * this.departments.length)];
    const visitType = this.selectVisitType(department);
    const diagnosisCode = this.diagnosisCodes[Math.floor(this.rng() * this.diagnosisCodes.length)];

    // Generate sentiment based on department and visit type
    const sentimentContext = this.calculateSentimentContext(department, visitType, patient.ageGroup);
    
    const patientFeedback = this.generatePatientFeedback(sentimentContext);
    const providerNotes = this.generateProviderNotes(department, diagnosisCode);

    // Calculate visit date (last 6 months)
    const visitDate = new Date(this.baseDate);
    visitDate.setDate(visitDate.getDate() - Math.floor(this.rng() * 180));

    return {
      patient_id: patient.id,
      medical_record_number: patient.mrn,
      diagnosis_code: diagnosisCode,
      department,
      visit_type: visitType,
      patient_feedback: patientFeedback,
      provider_notes: providerNotes,
      patient_sentiment_score: sentimentContext.patientSentiment,
      provider_sentiment_score: sentimentContext.providerSentiment,
      phi_level: this.determinePHILevel(patientFeedback, providerNotes),
      visit_date: visitDate.toISOString().split('T')[0],
      age_group: patient.ageGroup,
      insurance_type: patient.insurance
    };
  }

  private selectVisitType(department: string): HealthcareRecord['visit_type'] {
    if (department === 'Emergency') {
      return this.rng() < 0.8 ? 'emergency' : 'consultation';
    } else if (department === 'ICU') {
      return this.rng() < 0.6 ? 'emergency' : 'follow_up';
    } else {
      const rand = this.rng();
      if (rand < 0.4) return 'routine';
      if (rand < 0.6) return 'follow_up';
      if (rand < 0.8) return 'consultation';
      return 'emergency';
    }
  }

  private calculateSentimentContext(department: string, visitType: string, ageGroup: string): {
    patientSentiment: number;
    providerSentiment: number;
    sentimentCategory: 'positive' | 'negative' | 'neutral';
  } {
    let baseSentiment = 65; // Neutral baseline

    // Department adjustments
    const departmentAdjustments: Record<string, number> = {
      'Emergency': -20,
      'ICU': -15,
      'Oncology': -10,
      'Psychiatry': -5,
      'Pediatrics': 10,
      'Orthopedics': 5,
      'Cardiology': 0
    };

    baseSentiment += departmentAdjustments[department] || 0;

    // Visit type adjustments
    if (visitType === 'emergency') baseSentiment -= 15;
    if (visitType === 'routine') baseSentiment += 10;
    if (visitType === 'follow_up') baseSentiment += 5;

    // Age group adjustments
    if (ageGroup === '0-17') baseSentiment += 5; // Pediatric care generally positive
    if (ageGroup === '75+') baseSentiment -= 5; // More health concerns

    // Add some randomness
    baseSentiment += (this.rng() - 0.5) * 20;

    // Ensure within bounds
    const patientSentiment = Math.max(0, Math.min(100, Math.round(baseSentiment)));
    
    // Provider sentiment is usually more neutral/professional
    const providerSentiment = Math.max(40, Math.min(85, patientSentiment + (this.rng() - 0.5) * 10));

    let sentimentCategory: 'positive' | 'negative' | 'neutral' = 'neutral';
    if (patientSentiment >= 70) sentimentCategory = 'positive';
    else if (patientSentiment <= 40) sentimentCategory = 'negative';

    return {
      patientSentiment: Math.round(patientSentiment),
      providerSentiment: Math.round(providerSentiment),
      sentimentCategory
    };
  }

  private generatePatientFeedback(context: ReturnType<typeof this.calculateSentimentContext>): string {
    let phrases: string[];
    
    switch (context.sentimentCategory) {
      case 'positive':
        phrases = this.positiveHealthcarePhrases;
        break;
      case 'negative':
        phrases = this.negativeHealthcarePhrases;
        break;
      default:
        phrases = this.neutralHealthcarePhrases;
    }

    const basePhrase = phrases[Math.floor(this.rng() * phrases.length)];
    const medicalTerm = this.medicalTerms[Math.floor(this.rng() * this.medicalTerms.length)];
    
    // Add some variation
    const variations = [
      `${basePhrase}. The ${medicalTerm} was professional.`,
      `Overall, ${basePhrase} during my visit.`,
      `${basePhrase}. Would recommend this ${medicalTerm}.`,
      `My experience: ${basePhrase}.`,
      `${basePhrase}. The medical staff handled my ${medicalTerm} well.`
    ];

    return variations[Math.floor(this.rng() * variations.length)];
  }

  private generateProviderNotes(department: string, diagnosisCode: string): string {
    const clinicalPhrases = [
      'Patient presented with symptoms consistent with',
      'Clinical examination revealed',
      'Treatment plan includes',
      'Patient responded well to',
      'Recommended follow-up in',
      'No adverse reactions observed',
      'Vital signs stable',
      'Patient education provided regarding'
    ];

    const departmentSpecific: Record<string, string[]> = {
      'Cardiology': ['cardiac monitoring', 'ECG normal', 'blood pressure managed'],
      'Emergency': ['acute care provided', 'stabilized condition', 'pain management'],
      'Oncology': ['treatment protocol', 'imaging scheduled', 'supportive care'],
      'Pediatrics': ['growth parameters normal', 'immunizations current', 'developmental milestones'],
      'Psychiatry': ['mental status exam', 'medication adjustment', 'therapy referral']
    };

    const basePhrase = clinicalPhrases[Math.floor(this.rng() * clinicalPhrases.length)];
    const specific = departmentSpecific[department] || ['routine care'];
    const specificPhrase = specific[Math.floor(this.rng() * specific.length)];

    return `${basePhrase} ${diagnosisCode}. ${specificPhrase}. Continue monitoring patient progress.`;
  }

  private determinePHILevel(patientFeedback: string, providerNotes: string): 'low' | 'medium' | 'high' {
    const text = `${patientFeedback} ${providerNotes}`.toLowerCase();
    
    // High PHI indicators
    const highPHIIndicators = ['medical record', 'ssn', 'address', 'phone', 'email'];
    if (highPHIIndicators.some(indicator => text.includes(indicator))) {
      return 'high';
    }

    // Medium PHI indicators  
    const mediumPHIIndicators = ['diagnosis', 'medication', 'treatment', 'procedure'];
    if (mediumPHIIndicators.some(indicator => text.includes(indicator))) {
      return 'medium';
    }

    return 'low';
  }
}