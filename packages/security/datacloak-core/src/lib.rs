use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::ffi::{CStr, CString};
use std::os::raw::{c_char, c_void};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PIIDetectionResult {
    pub field_name: String,
    pub pii_type: String,
    pub confidence: f64,
    pub sample: String,
    pub masked: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MaskingResult {
    pub original_text: String,
    pub masked_text: String,
    pub detected_pii: Vec<PIIDetectionResult>,
    pub metadata: MaskingMetadata,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MaskingMetadata {
    pub processing_time: u64,
    pub fields_processed: u32,
    pub pii_items_found: u32,
}

#[derive(Debug)]
pub struct DataCloakEngine {
    patterns: HashMap<String, Regex>,
    config: DataCloakConfig,
}

#[derive(Debug, Clone)]
pub struct DataCloakConfig {
    pub enable_redos_protection: bool,
    pub email_validation: EmailValidation,
    pub credit_card_validation: CreditCardValidation,
    pub max_text_length: usize,
    pub regex_timeout_ms: u64,
}

#[derive(Debug, Clone)]
pub enum EmailValidation {
    Regex,
    Validator,
    Hybrid,
}

#[derive(Debug, Clone)]
pub enum CreditCardValidation {
    Basic,
    Luhn,
    Full,
}

impl Default for DataCloakConfig {
    fn default() -> Self {
        Self {
            enable_redos_protection: true,
            email_validation: EmailValidation::Validator,
            credit_card_validation: CreditCardValidation::Luhn,
            max_text_length: 100_000,
            regex_timeout_ms: 1000,
        }
    }
}

impl DataCloakEngine {
    pub fn new(config: DataCloakConfig) -> Result<Self, String> {
        let mut patterns = HashMap::new();
        
        // Enhanced patterns for PII detection
        patterns.insert(
            "email".to_string(),
            Regex::new(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b")
                .map_err(|e| format!("Failed to compile email regex: {}", e))?,
        );
        
        patterns.insert(
            "phone".to_string(),
            Regex::new(r"(?:\(?\d{3}\)?[-.\\s]?\d{3}[-.\\s]?\d{4}|\b\d{3}[-.\\s]?\d{3}[-.\\s]?\d{4})\b")
                .map_err(|e| format!("Failed to compile phone regex: {}", e))?,
        );
        
        patterns.insert(
            "ssn".to_string(),
            Regex::new(r"\b\d{3}-\d{2}-\d{4}\b")
                .map_err(|e| format!("Failed to compile SSN regex: {}", e))?,
        );
        
        patterns.insert(
            "credit_card".to_string(),
            Regex::new(r"\b(?:\d[ -]*?){13,19}\b")
                .map_err(|e| format!("Failed to compile credit card regex: {}", e))?,
        );

        Ok(Self { patterns, config })
    }

    pub fn detect_pii(&self, text: &str) -> Result<Vec<PIIDetectionResult>, String> {
        if text.len() > self.config.max_text_length {
            return Err(format!(
                "Text length ({}) exceeds maximum ({})",
                text.len(),
                self.config.max_text_length
            ));
        }

        let mut results = Vec::new();

        for (pii_type, pattern) in &self.patterns {
            for mat in pattern.find_iter(text) {
                let sample = mat.as_str().to_string();
                let mut confidence = 0.95;

                // Enhanced validation
                let is_valid = match pii_type.as_str() {
                    "email" => match self.config.email_validation {
                        EmailValidation::Regex => true,
                        EmailValidation::Validator => self.validate_email(&sample),
                        EmailValidation::Hybrid => self.validate_email(&sample),
                    },
                    "credit_card" => match self.config.credit_card_validation {
                        CreditCardValidation::Basic => true,
                        CreditCardValidation::Luhn => self.validate_luhn(&sample),
                        CreditCardValidation::Full => self.validate_luhn(&sample),
                    },
                    _ => true,
                };

                if !is_valid {
                    confidence *= 0.7; // Reduce confidence for invalid items
                }

                if confidence > 0.6 {
                    // Only include items with reasonable confidence
                    results.push(PIIDetectionResult {
                        field_name: "text".to_string(),
                        pii_type: pii_type.clone(),
                        confidence,
                        sample: sample.clone(),
                        masked: self.mask_value(&sample, pii_type),
                    });
                }
            }
        }

        Ok(results)
    }

    pub fn mask_text(&self, text: &str) -> Result<MaskingResult, String> {
        let start_time = std::time::Instant::now();
        let detected_pii = self.detect_pii(text)?;
        
        let mut masked_text = text.to_string();
        
        // Sort by length (longest first) to avoid partial replacements
        let mut sorted_pii = detected_pii.clone();
        sorted_pii.sort_by(|a, b| b.sample.len().cmp(&a.sample.len()));
        
        for pii in &sorted_pii {
            masked_text = masked_text.replace(&pii.sample, &pii.masked);
        }
        
        let processing_time = start_time.elapsed().as_millis() as u64;
        
        Ok(MaskingResult {
            original_text: text.to_string(),
            masked_text,
            detected_pii,
            metadata: MaskingMetadata {
                processing_time,
                fields_processed: 1,
                pii_items_found: sorted_pii.len() as u32,
            },
        })
    }

    fn validate_email(&self, email: &str) -> bool {
        // Enhanced email validation
        let parts: Vec<&str> = email.split('@').collect();
        if parts.len() != 2 {
            return false;
        }
        
        let domain = parts[1];
        domain.contains('.') && !domain.contains("..")
    }

    fn validate_luhn(&self, card_number: &str) -> bool {
        let digits: String = card_number.chars().filter(|c| c.is_ascii_digit()).collect();
        if digits.len() < 13 || digits.len() > 19 {
            return false;
        }

        let mut sum = 0;
        let mut alternate = false;

        for ch in digits.chars().rev() {
            let mut digit = ch.to_digit(10).unwrap() as u32;
            
            if alternate {
                digit *= 2;
                if digit > 9 {
                    digit = digit / 10 + digit % 10;
                }
            }
            
            sum += digit;
            alternate = !alternate;
        }

        sum % 10 == 0
    }

    fn mask_value(&self, value: &str, pii_type: &str) -> String {
        match pii_type {
            "email" => {
                if let Some(at_pos) = value.find('@') {
                    let (local, domain) = value.split_at(at_pos);
                    if !local.is_empty() {
                        format!("{}***{}", &local[..1], domain)
                    } else {
                        "***@domain.com".to_string()
                    }
                } else {
                    "***@domain.com".to_string()
                }
            }
            "phone" => {
                let digits: String = value.chars().filter(|c| c.is_ascii_digit()).collect();
                if digits.len() >= 4 {
                    let last_four = &digits[digits.len() - 4..];
                    format!("***-***-{}", last_four)
                } else {
                    "***-***-****".to_string()
                }
            }
            "ssn" => {
                if value.len() >= 4 {
                    format!("***-**-{}", &value[value.len() - 4..])
                } else {
                    "***-**-****".to_string()
                }
            }
            "credit_card" => {
                let digits: String = value.chars().filter(|c| c.is_ascii_digit()).collect();
                if digits.len() >= 4 {
                    let last_four = &digits[digits.len() - 4..];
                    format!("**** **** **** {}", last_four)
                } else {
                    "**** **** **** ****".to_string()
                }
            }
            _ => "***".to_string(),
        }
    }
}

// C FFI interface
#[no_mangle]
pub extern "C" fn datacloak_create() -> *mut c_void {
    let config = DataCloakConfig::default();
    match DataCloakEngine::new(config) {
        Ok(engine) => Box::into_raw(Box::new(engine)) as *mut c_void,
        Err(_) => std::ptr::null_mut(),
    }
}

#[no_mangle]
pub extern "C" fn datacloak_destroy(engine: *mut c_void) {
    if !engine.is_null() {
        unsafe {
            let _ = Box::from_raw(engine as *mut DataCloakEngine);
        }
    }
}

#[no_mangle]
pub extern "C" fn datacloak_detect_pii(
    engine: *mut c_void,
    text: *const c_char,
) -> *mut c_char {
    if engine.is_null() || text.is_null() {
        return std::ptr::null_mut();
    }

    unsafe {
        let engine = &*(engine as *const DataCloakEngine);
        let text_str = match CStr::from_ptr(text).to_str() {
            Ok(s) => s,
            Err(_) => return std::ptr::null_mut(),
        };

        match engine.detect_pii(text_str) {
            Ok(results) => {
                let json = serde_json::to_string(&results).unwrap_or_default();
                match CString::new(json) {
                    Ok(cstring) => cstring.into_raw(),
                    Err(_) => std::ptr::null_mut(),
                }
            }
            Err(_) => std::ptr::null_mut(),
        }
    }
}

#[no_mangle]
pub extern "C" fn datacloak_mask_text(
    engine: *mut c_void,
    text: *const c_char,
) -> *mut c_char {
    if engine.is_null() || text.is_null() {
        return std::ptr::null_mut();
    }

    unsafe {
        let engine = &*(engine as *const DataCloakEngine);
        let text_str = match CStr::from_ptr(text).to_str() {
            Ok(s) => s,
            Err(_) => return std::ptr::null_mut(),
        };

        match engine.mask_text(text_str) {
            Ok(result) => {
                let json = serde_json::to_string(&result).unwrap_or_default();
                match CString::new(json) {
                    Ok(cstring) => cstring.into_raw(),
                    Err(_) => std::ptr::null_mut(),
                }
            }
            Err(_) => std::ptr::null_mut(),
        }
    }
}

#[no_mangle]
pub extern "C" fn datacloak_free_string(s: *mut c_char) {
    if !s.is_null() {
        unsafe {
            let _ = CString::from_raw(s);
        }
    }
}

#[no_mangle]
pub extern "C" fn datacloak_version() -> *mut c_char {
    let version = "1.0.0".to_string();
    match CString::new(version) {
        Ok(cstring) => cstring.into_raw(),
        Err(_) => std::ptr::null_mut(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_email_detection() {
        let config = DataCloakConfig::default();
        let engine = DataCloakEngine::new(config).unwrap();
        
        let text = "Contact us at support@example.com for help";
        let results = engine.detect_pii(text).unwrap();
        
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].pii_type, "email");
        assert_eq!(results[0].sample, "support@example.com");
    }

    #[test]
    fn test_luhn_validation() {
        let config = DataCloakConfig::default();
        let engine = DataCloakEngine::new(config).unwrap();
        
        // Valid Luhn number
        assert!(engine.validate_luhn("4532123456789012"));
        
        // Invalid Luhn number
        assert!(!engine.validate_luhn("4532123456789013"));
    }

    #[test]
    fn test_masking() {
        let config = DataCloakConfig::default();
        let engine = DataCloakEngine::new(config).unwrap();
        
        let text = "Call 555-123-4567 or email john@test.com";
        let result = engine.mask_text(text).unwrap();
        
        assert!(result.masked_text.contains("***-***-4567"));
        assert!(result.masked_text.contains("j***@test.com"));
        assert_eq!(result.metadata.pii_items_found, 2);
    }
}