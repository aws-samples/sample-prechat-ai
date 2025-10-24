#!/usr/bin/env node

/**
 * Translation Management Helper
 * 
 * This script helps manage translations by providing utilities to:
 * - Convert between JSON and CSV formats
 * - Merge existing translations with newly extracted ones
 * - Generate translation reports
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOCALES_DIR = path.join(__dirname, '../public/i18n/locales');
const EXTRACTED_FILE = path.join(LOCALES_DIR, 'extracted-translations.json');

class TranslationManager {
  constructor() {
    this.extractedData = null;
    this.existingTranslations = {
      ko: {},
      en: {}
    };
  }

  /**
   * Load extracted translations
   */
  loadExtractedTranslations() {
    if (fs.existsSync(EXTRACTED_FILE)) {
      const content = fs.readFileSync(EXTRACTED_FILE, 'utf-8');
      this.extractedData = JSON.parse(content);
      console.log(`📖 Loaded ${Object.keys(this.extractedData.translations).length} extracted translations`);
    } else {
      console.error('❌ No extracted translations found. Run extract-text first.');
      process.exit(1);
    }
  }

  /**
   * Load existing translations if they exist
   */
  loadExistingTranslations() {
    const koFile = path.join(LOCALES_DIR, 'ko.json');
    const enFile = path.join(LOCALES_DIR, 'en.json');

    if (fs.existsSync(koFile)) {
      const content = fs.readFileSync(koFile, 'utf-8');
      this.existingTranslations.ko = JSON.parse(content);
      console.log(`📖 Loaded ${Object.keys(this.existingTranslations.ko).length} existing Korean translations`);
    }

    if (fs.existsSync(enFile)) {
      const content = fs.readFileSync(enFile, 'utf-8');
      this.existingTranslations.en = JSON.parse(content);
      console.log(`📖 Loaded ${Object.keys(this.existingTranslations.en).length} existing English translations`);
    }
  }

  /**
   * Generate CSV file for easy translation editing
   */
  generateTranslationCSV() {
    if (!this.extractedData) {
      console.error('❌ No extracted data loaded');
      return;
    }

    const csvLines = ['key,korean,english,context,files,status'];
    
    for (const [key, data] of Object.entries(this.extractedData.translations)) {
      const korean = data.korean;
      const english = this.existingTranslations.en[key] || '';
      const context = data.context;
      const files = data.files.join('; ');
      const status = english ? 'translated' : 'needs_translation';
      
      const escapedKorean = this.escapeCsvField(korean);
      const escapedEnglish = this.escapeCsvField(english);
      const escapedContext = this.escapeCsvField(context);
      const escapedFiles = this.escapeCsvField(files);
      
      csvLines.push(`${key},${escapedKorean},${escapedEnglish},${escapedContext},${escapedFiles},${status}`);
    }
    
    const csvFile = path.join(LOCALES_DIR, 'translations-for-editing.csv');
    fs.writeFileSync(csvFile, csvLines.join('\n'), 'utf-8');
    console.log(`📄 Generated CSV for editing: ${csvFile}`);
  }

  /**
   * Import translations from CSV file
   */
  importFromCSV(csvFile) {
    if (!fs.existsSync(csvFile)) {
      console.error(`❌ CSV file not found: ${csvFile}`);
      return;
    }

    const content = fs.readFileSync(csvFile, 'utf-8');
    const lines = content.split('\n');
    const headers = lines[0].split(',');
    
    const keyIndex = headers.indexOf('key');
    const koreanIndex = headers.indexOf('korean');
    const englishIndex = headers.indexOf('english');
    
    if (keyIndex === -1 || koreanIndex === -1 || englishIndex === -1) {
      console.error('❌ CSV file must have key, korean, and english columns');
      return;
    }

    const koTranslations = {};
    const enTranslations = {};
    let importedCount = 0;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const columns = this.parseCSVLine(line);
      if (columns.length < Math.max(keyIndex, koreanIndex, englishIndex) + 1) continue;

      const key = columns[keyIndex];
      const korean = columns[koreanIndex];
      const english = columns[englishIndex];

      if (key && korean) {
        koTranslations[key] = korean;
        enTranslations[key] = english || '';
        importedCount++;
      }
    }

    // Write updated locale files
    const koFile = path.join(LOCALES_DIR, 'ko.json');
    const enFile = path.join(LOCALES_DIR, 'en.json');
    
    fs.writeFileSync(koFile, JSON.stringify(koTranslations, null, 2), 'utf-8');
    fs.writeFileSync(enFile, JSON.stringify(enTranslations, null, 2), 'utf-8');
    
    console.log(`✅ Imported ${importedCount} translations from CSV`);
    console.log(`📄 Updated: ${koFile}`);
    console.log(`📄 Updated: ${enFile}`);
  }

  /**
   * Generate translation report
   */
  generateReport() {
    if (!this.extractedData) {
      console.error('❌ No extracted data loaded');
      return;
    }

    const totalKeys = Object.keys(this.extractedData.translations).length;
    const translatedKeys = Object.keys(this.existingTranslations.en).filter(
      key => this.existingTranslations.en[key] && this.existingTranslations.en[key].trim()
    ).length;
    
    const completionRate = totalKeys > 0 ? (translatedKeys / totalKeys * 100).toFixed(1) : 0;
    
    console.log('\n📊 Translation Report');
    console.log('===================');
    console.log(`Total text strings: ${totalKeys}`);
    console.log(`Translated to English: ${translatedKeys}`);
    console.log(`Translation completion: ${completionRate}%`);
    console.log(`Remaining to translate: ${totalKeys - translatedKeys}`);
    
    // Show some untranslated keys as examples
    const untranslated = Object.keys(this.extractedData.translations).filter(
      key => !this.existingTranslations.en[key] || !this.existingTranslations.en[key].trim()
    );
    
    if (untranslated.length > 0) {
      console.log('\n📝 Sample untranslated keys:');
      untranslated.slice(0, 10).forEach(key => {
        const korean = this.extractedData.translations[key].korean;
        console.log(`  ${key}: "${korean}"`);
      });
      
      if (untranslated.length > 10) {
        console.log(`  ... and ${untranslated.length - 10} more`);
      }
    }
  }

  /**
   * Escape CSV field content
   */
  escapeCsvField(field) {
    if (typeof field !== 'string') field = String(field);
    if (field.includes(',') || field.includes('"') || field.includes('\n')) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  }

  /**
   * Parse CSV line handling quoted fields
   */
  parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current);
    return result;
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  const manager = new TranslationManager();
  
  switch (command) {
    case 'csv':
      manager.loadExtractedTranslations();
      manager.loadExistingTranslations();
      manager.generateTranslationCSV();
      break;
      
    case 'import':
      const csvFile = args[1] || path.join(LOCALES_DIR, 'translations-for-editing.csv');
      manager.importFromCSV(csvFile);
      break;
      
    case 'report':
      manager.loadExtractedTranslations();
      manager.loadExistingTranslations();
      manager.generateReport();
      break;
      
    default:
      console.log('Translation Management Helper');
      console.log('');
      console.log('Usage:');
      console.log('  npm run manage-translations csv     - Generate CSV file for editing');
      console.log('  npm run manage-translations import  - Import translations from CSV');
      console.log('  npm run manage-translations report  - Show translation status report');
      console.log('');
      break;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { TranslationManager };